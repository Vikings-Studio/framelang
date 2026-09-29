import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PROFILE = Object.freeze({
  'landscape-1920x1080': { width: 1920, height: 1080, insetX: 120, insetY: 96, heading: 104, displayHeading: 156, body: 48, flow: 38 },
  'portrait-1080x1920': { width: 1080, height: 1920, insetX: 72, insetY: 96, heading: 88, displayHeading: 120, body: 50, flow: 40 },
});
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const SHA = /^sha256:[0-9a-f]{64}$/;
const SCENE_KEYS = ['id', 'role', 'blueprint', 'durationFrames', 'essential', 'content', 'layouts', 'initialState', 'resolvedState', 'states', 'events', 'design'];
const SCENE_REQUIRED = SCENE_KEYS.filter(key => key !== 'design');
const DOCUMENT_KEYS = ['language', 'fps', 'profiles', 'brandRef', 'assetsRef', 'seed', 'scenes', 'verification'];

export class FrameLangError extends Error {
  constructor(code, location, message) {
    super(`${code} at ${location}: ${message}`);
    this.name = 'FrameLangError';
    this.code = code;
    this.location = location;
  }
}

function fail(code, location, message) { throw new FrameLangError(code, location, message); }
function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('syntax.object', location, 'expected object');
  return value;
}
function keys(value, allowed, required, location) {
  object(value, location);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('syntax.field', `${location}.${key}`, 'unknown field');
  for (const key of required) if (!(key in value)) fail('syntax.required', `${location}.${key}`, 'required field');
}
function list(value, location, min = 0) {
  if (!Array.isArray(value) || value.length < min) fail('syntax.array', location, `expected array with at least ${min} items`);
  return value;
}
function int(value, location, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('syntax.integer', location, `expected integer ${min}..${max}`);
}
function identifier(value, location) {
  if (typeof value !== 'string' || !ID.test(value)) fail('syntax.id', location, 'expected lowercase ID (letters, numbers, hyphens)');
}
function color(value, location) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) fail('syntax.color', location, 'expected six-digit hex color');
}
function colorRef(value, location) {
  if (['background', 'foreground', 'accent'].includes(value)) return;
  color(value, location);
}
function paint(value, location, nested = false) {
  keys(value, ['kind', 'color', 'angle', 'center', 'stops', 'layers'], ['kind'], location);
  if (value.kind === 'layers') {
    if (nested) fail('syntax.paint', location, 'paint layers cannot nest');
    keys(value, ['kind', 'layers'], ['kind', 'layers'], location);
    const layers = list(value.layers, `${location}.layers`, 2);
    if (layers.length > 4) fail('syntax.paint', `${location}.layers`, 'at most four paint layers');
    layers.forEach((layer, index) => paint(layer, `${location}.layers[${index}]`, true));
    return;
  }
  if (value.kind === 'solid') {
    keys(value, ['kind', 'color'], ['kind', 'color'], location);
    colorRef(value.color, `${location}.color`);
    return;
  }
  if (!['linear', 'radial'].includes(value.kind)) fail('syntax.paint', `${location}.kind`, 'expected solid, linear, or radial');
  if (value.kind === 'linear') {
    keys(value, ['kind', 'angle', 'stops'], ['kind', 'angle', 'stops'], location);
    int(value.angle, `${location}.angle`, 0, 359);
  } else {
    keys(value, ['kind', 'center', 'stops'], ['kind', 'center', 'stops'], location);
    if (Array.isArray(value.center)) {
      if (value.center.length !== 2) fail('syntax.paint', `${location}.center`, 'expected [x,y] percentages');
      value.center.forEach((coordinate, index) => int(coordinate, `${location}.center[${index}]`, 0, 100));
    } else if (!['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(value.center)) fail('syntax.paint', `${location}.center`, 'unsupported radial center');
  }
  const stops = list(value.stops, `${location}.stops`, 2);
  if (stops.length > 5) fail('syntax.paint', `${location}.stops`, 'at most five color stops');
  let previous = -1;
  for (const [index, stop] of stops.entries()) {
    const at = `${location}.stops[${index}]`;
    keys(stop, ['at', 'color', 'opacity'], ['at', 'color'], at);
    int(stop.at, `${at}.at`, 0, 100);
    if (stop.at <= previous) fail('syntax.paint', `${at}.at`, 'stops must increase strictly');
    previous = stop.at;
    colorRef(stop.color, `${at}.color`);
    if (stop.opacity !== undefined) int(stop.opacity, `${at}.opacity`, 0, 100);
  }
}
function cssColor(value, brand) { return brand[value] || value; }
function cssStop(stop, brand) {
  const color = cssColor(stop.color, brand);
  const alpha = stop.opacity === undefined ? '' : Math.round(stop.opacity * 255 / 100).toString(16).padStart(2, '0');
  return `${color}${alpha} ${stop.at}%`;
}
function cssPaint(value, brand) {
  if (value.kind === 'layers') return value.layers.map(layer => layer.kind === 'solid'
    ? `linear-gradient(${cssColor(layer.color, brand)},${cssColor(layer.color, brand)})`
    : cssPaint(layer, brand)).join(',');
  if (value.kind === 'solid') return cssColor(value.color, brand);
  const stops = value.stops.map(stop => cssStop(stop, brand)).join(',');
  if (value.kind === 'linear') return `linear-gradient(${value.angle}deg,${stops})`;
  const center = Array.isArray(value.center) ? `${value.center[0]}% ${value.center[1]}%` : value.center.replace('-', ' ');
  return `radial-gradient(circle at ${center},${stops})`;
}
function plainText(value, location, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f]/.test(value)) fail('syntax.text', location, `nonempty plain text up to ${max} characters required`);
}
function textCopy(node, location) {
  if (node.text !== undefined && node.segments !== undefined) fail('syntax.text', location, 'use text or segments, not both');
  if (node.text !== undefined) { plainText(node.text, `${location}.text`); return node.text; }
  const segments = list(node.segments, `${location}.segments`, 1);
  if (segments.length > 8) fail('syntax.text', `${location}.segments`, 'at most 8 text segments');
  let copy = '';
  for (const [index, segment] of segments.entries()) {
    const at = `${location}.segments[${index}]`;
    keys(segment, ['text', 'tone', 'breakAfter'], ['text'], at);
    plainText(segment.text, `${at}.text`, 120);
    if (segment.tone !== undefined && !['foreground', 'accent', 'accentBlock'].includes(segment.tone)) fail('syntax.text', `${at}.tone`, 'invalid tone');
    if (segment.breakAfter !== undefined && typeof segment.breakAfter !== 'boolean') fail('syntax.text', `${at}.breakAfter`, 'expected boolean');
    if (index === segments.length - 1 && segment.breakAfter) fail('syntax.text', `${at}.breakAfter`, 'last segment cannot end with a break');
    copy += segment.text + (segment.breakAfter ? '\n' : '');
  }
  if (copy.length > 240) fail('syntax.text', location, 'combined copy exceeds 240 characters');
  return copy;
}
function hash(value) { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function bundleRefs(bundle) {
  object(bundle, 'bundle');
  return { brandRef: hash(canonical(bundle.brand)), assetsRef: hash(canonical(bundle.assets || {})) };
}
function unique(items, location) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) fail('semantic.duplicate', location, `duplicate ${item}`);
    seen.add(item);
  }
}
function canvasPlacements(tree, location, known, findings = null, context = {}) {
  const placements = list(tree.children, `${location}.children`, 1);
  if (placements.length > 16) fail('syntax.layout', `${location}.children`, 'canvas supports at most 16 placements');
  const resolved = [];
  const placed = new Map();
  for (const [index, placement] of placements.entries()) {
    const at = `${location}.children[${index}]`;
    keys(placement, ['node', 'rect', 'relative', 'layer', 'align', 'overlap'], ['node'], at);
    if (typeof placement.node !== 'string' || !known.has(placement.node)) fail('reference.node', `${at}.node`, 'expected known node ID');
    if ((placement.rect === undefined) === (placement.relative === undefined)) fail('syntax.layout', at, 'choose one of rect or relative');
    let rect = placement.rect;
    if (placement.relative !== undefined) {
      const relative = placement.relative;
      keys(relative, ['to', 'side', 'gap', 'width', 'height', 'crossAlign'], ['to', 'side', 'gap', 'width', 'height'], `${at}.relative`);
      const anchor = placed.get(relative.to);
      if (!anchor) fail('reference.layout', `${at}.relative.to`, 'relative anchor must be an earlier placed node');
      if (!['below', 'above', 'right', 'left'].includes(relative.side)) fail('syntax.layout', `${at}.relative.side`, 'unsupported relative side');
      if (relative.crossAlign !== undefined && !['start', 'center', 'end'].includes(relative.crossAlign)) fail('syntax.layout', `${at}.relative.crossAlign`, 'unsupported cross alignment');
      for (const field of ['gap', 'width', 'height']) int(relative[field], `${at}.relative.${field}`, field === 'gap' ? 0 : 1, 1000);
      const [ax, ay, aw, ah] = anchor;
      const { gap, width, height } = relative;
      const cross = relative.crossAlign || 'start';
      const offset = (span, size) => cross === 'end' ? span - size : cross === 'center' ? Math.floor((span - size) / 2) : 0;
      if (relative.side === 'below') rect = [ax + offset(aw, width), ay + ah + gap, width, height];
      if (relative.side === 'above') rect = [ax + offset(aw, width), ay - gap - height, width, height];
      if (relative.side === 'right') rect = [ax + aw + gap, ay + offset(ah, height), width, height];
      if (relative.side === 'left') rect = [ax - gap - width, ay + offset(ah, height), width, height];
    }
    if (!Array.isArray(rect) || rect.length !== 4) fail('syntax.layout', `${at}.rect`, 'expected [x,y,width,height] in thousandths');
    const [x, y, width, height] = rect;
    [x, y].forEach((value, i) => int(value, `${at}.rect[${i}]`, -Number.MAX_SAFE_INTEGER));
    [width, height].forEach((value, i) => int(value, `${at}.rect[${i + 2}]`, 1, 1000));
    if (x < 0 || y < 0 || x + width > 1000 || y + height > 1000) {
      if (!findings) fail('semantic.bounds', `${at}.rect`, 'placement exceeds the safe canvas');
      findings.push({
        code: 'semantic.bounds', severity: 'error', ...context, node: placement.node,
        location: `${at}.rect`, rect, message: `Node ${placement.node} exceeds the safe canvas`,
        hint: 'Move or resize this rectangle so x and y are nonnegative, and x + width and y + height are at most 1000.',
      });
    }
    if (placement.layer !== undefined) int(placement.layer, `${at}.layer`, 0, 9);
    if (placement.align !== undefined && !['start', 'center', 'end'].includes(placement.align)) fail('syntax.layout', `${at}.align`, 'unsupported alignment');
    if (placement.overlap !== undefined && !['avoid', 'intentional'].includes(placement.overlap)) fail('syntax.layout', `${at}.overlap`, 'unsupported overlap intent');
    for (const previous of resolved) {
      const [px, py, pw, ph] = previous.rect;
      if (x < px + pw && x + width > px && y < py + ph && y + height > py) {
        const mutual = placement.overlap === 'intentional' && previous.placement.overlap === 'intentional';
        const decorative = known.get(placement.node).importance === 'decorative' || known.get(previous.placement.node).importance === 'decorative';
        if (!mutual || !decorative) {
          if (!findings) fail('semantic.overlap', at, !mutual ? `overlaps ${previous.placement.node} without mutual intent` : 'intentional overlap requires a decorative node');
          findings.push({
            code: 'semantic.overlap', severity: 'error', ...context,
            nodes: [previous.placement.node, placement.node], locations: [previous.location, at],
            rects: [previous.rect, rect],
            intersection: [Math.max(x, px), Math.max(y, py), Math.min(x + width, px + pw) - Math.max(x, px), Math.min(y + height, py + ph) - Math.max(y, py)],
            message: `Nodes ${previous.placement.node} and ${placement.node} overlap${mutual ? ' without a decorative node' : ' without allowed intent'}`,
            hint: decorative
              ? 'Move or resize a rectangle to remove the intersection, or declare intentional overlap on both decorative and content placements if the composition requires it.'
              : 'Move or resize a rectangle to remove the intersection. Two functional nodes cannot opt out of this rule.',
          });
        }
      }
    }
    resolved.push({ placement, rect, location: at });
    placed.set(placement.node, rect);
  }
  return resolved;
}

export function lintProgram(program, bundle) {
  const findings = [];
  try {
    for (const [sceneIndex, scene] of (program.scenes || []).entries()) {
      const known = new Map((scene.content || []).map(node => [node.id, node]));
      for (const profile of program.profiles || []) {
        const location = `$.scenes[${sceneIndex}].layouts.${scene.layouts?.[profile] ? profile : 'default'}`;
        const tree = scene.layouts?.[profile] ?? scene.layouts?.default;
        if (tree?.type === 'canvas') canvasPlacements(tree, location, known, findings, { sceneId: scene.id, profile });
      }
    }
    if (findings.length === 0) validate(program, bundle);
  } catch (error) {
    if (!(error instanceof FrameLangError)) throw error;
    findings.push({ code: error.code, severity: 'error', location: error.location, message: error.message, hint: 'Edit the indicated FrameLang source field and run lint again.' });
  }
  return { version: 1, ok: findings.length === 0, findings, instruction: findings.length ? 'Edit the FrameLang source at the reported locations. Preserve the intended content, then rerun lint and check before rendering.' : 'The static lint passed. Run compile and check to verify browser geometry at rendered frames.' };
}
function layoutRefs(tree, location, known, refs) {
  if (typeof tree === 'string') {
    if (!known.has(tree)) fail('reference.node', location, `unknown node ${tree}`);
    refs.push(tree);
    return;
  }
  object(tree, location);
  switch (tree.type) {
    case 'stack':
      keys(tree, ['type', 'direction', 'gap', 'children'], ['type', 'direction', 'children'], location);
      if (!['column', 'row'].includes(tree.direction)) fail('syntax.layout', location, 'invalid stack direction');
      if (tree.gap !== undefined && !['tight', 'regular', 'comfortable'].includes(tree.gap)) fail('syntax.layout', location, 'invalid gap');
      list(tree.children, `${location}.children`, 1).forEach((child, i) => layoutRefs(child, `${location}.children[${i}]`, known, refs));
      break;
    case 'split':
      keys(tree, ['type', 'ratio', 'left', 'right'], ['type', 'ratio', 'left', 'right'], location);
      if (!['40:60', '50:50', '60:40'].includes(tree.ratio)) fail('syntax.layout', location, 'invalid split ratio');
      layoutRefs(tree.left, `${location}.left`, known, refs);
      layoutRefs(tree.right, `${location}.right`, known, refs);
      break;
    case 'overlay':
      keys(tree, ['type', 'base', 'attachments'], ['type', 'base', 'attachments'], location);
      layoutRefs(tree.base, `${location}.base`, known, refs);
      for (const [i, attachment] of list(tree.attachments, `${location}.attachments`).entries()) {
        keys(attachment, ['node', 'anchor', 'placement'], ['node', 'anchor', 'placement'], `${location}.attachments[${i}]`);
        if (attachment.placement !== 'sameBounds' || attachment.anchor !== tree.base) fail('syntax.layout', location, 'pilot supports sameBounds on base only');
        layoutRefs(attachment.node, `${location}.attachments[${i}].node`, known, refs);
      }
      break;
    case 'canvas': {
      keys(tree, ['type', 'children'], ['type', 'children'], location);
      for (const [index, { placement }] of canvasPlacements(tree, location, known).entries()) layoutRefs(placement.node, `${location}.children[${index}].node`, known, refs);
      break;
    }
    default: fail('syntax.layout', location, `unsupported layout ${tree.type}`);
  }
}

const MOTION_FIELDS = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity'];
const MOTION_EASES = ['none', 'power2.out', 'power3.out', 'power2.inOut', 'back.out(1.5)'];
function motionValue(value, location) {
  keys(value, MOTION_FIELDS, [], location);
  const properties = Object.keys(value).sort();
  if (!properties.length) fail('syntax.motion', location, 'motion value must name at least one property');
  for (const property of properties) {
    const [min, max] = property === 'opacity' ? [0, 1] : ['scale', 'scaleX', 'scaleY'].includes(property) ? [0, 4] : property === 'rotation' ? [-360, 360] : [-1000, 1000];
    if (typeof value[property] !== 'number' || !Number.isFinite(value[property]) || value[property] < min || value[property] > max) fail('syntax.motion', `${location}.${property}`, `expected number ${min}..${max}`);
  }
  return properties;
}

export function validate(program, bundle) {
  keys(program, DOCUMENT_KEYS, DOCUMENT_KEYS.filter(key => key !== 'verification'), '$');
  if (program.language !== 'framelang/v1') fail('syntax.version', '$.language', 'expected framelang/v1');
  if (program.fps !== 24) fail('syntax.fps', '$.fps', 'pilot supports 24 fps');
  int(program.seed, '$.seed', 0, 4294967295);
  if (program.verification !== undefined) {
    keys(program.verification, ['mode'], ['mode'], '$.verification');
    if (program.verification.mode !== 'allFrames') fail('syntax.verification', '$.verification.mode', 'unsupported verification mode');
  }
  for (const field of ['brandRef', 'assetsRef']) if (!SHA.test(program[field])) fail('syntax.hash', `$.${field}`, 'expected sha256 digest');
  const refs = bundleRefs(bundle);
  for (const field of ['brandRef', 'assetsRef']) if (program[field] !== refs[field]) fail('reference.bundle', `$.${field}`, 'frozen bundle hash differs');
  keys(bundle.brand, ['name', 'background', 'foreground', 'accent', 'font'], ['name', 'background', 'foreground', 'accent', 'font'], 'bundle.brand');
  for (const key of ['background', 'foreground', 'accent']) color(bundle.brand[key], `bundle.brand.${key}`);
  if (bundle.brand.font !== 'Inter') fail('reference.font', 'bundle.brand.font', 'pilot pins bundled Inter');
  unique(list(program.profiles, '$.profiles', 1), '$.profiles');
  for (const p of program.profiles) if (!(p in PROFILE)) fail('syntax.profile', '$.profiles', `unknown profile ${p}`);
  const scenes = list(program.scenes, '$.scenes', 1);
  unique(scenes.map(s => s.id), '$.scenes');
  for (const [index, scene] of scenes.entries()) {
    const at = `$.scenes[${index}]`;
    keys(scene, SCENE_KEYS, SCENE_REQUIRED, at);
    identifier(scene.id, `${at}.id`);
    if (!['hook', 'feature_showcase', 'benefit_highlight', 'cta', 'branding'].includes(scene.role)) fail('syntax.role', `${at}.role`, 'unsupported pilot role');
    if (!['type-reveal/v1', 'product-reveal/v1', 'before-after/v1', 'product-process/v1', 'workflow-demo/v1'].includes(scene.blueprint)) fail('syntax.blueprint', `${at}.blueprint`, 'unsupported pilot blueprint');
    int(scene.durationFrames, `${at}.durationFrames`, 48, 288);
    if (scene.design !== undefined) {
      keys(scene.design, ['alignment', 'scale', 'decoration', 'chrome', 'ambient', 'background'], [], `${at}.design`);
      if (scene.design.alignment !== undefined && !['left', 'center'].includes(scene.design.alignment)) fail('syntax.design', `${at}.design.alignment`, 'unsupported alignment');
      if (scene.design.scale !== undefined && !['standard', 'display'].includes(scene.design.scale)) fail('syntax.design', `${at}.design.scale`, 'unsupported type scale');
      if (scene.design.decoration !== undefined && !['none', 'rules', 'grid-glow'].includes(scene.design.decoration)) fail('syntax.design', `${at}.design.decoration`, 'unsupported decoration');
      if (scene.design.chrome !== undefined && !['none', 'editorial'].includes(scene.design.chrome)) fail('syntax.design', `${at}.design.chrome`, 'unsupported chrome');
      if (scene.design.ambient !== undefined && !['none', 'drift'].includes(scene.design.ambient)) fail('syntax.design', `${at}.design.ambient`, 'unsupported ambient motion');
      if (scene.design.ambient === 'drift' && scene.design.decoration !== 'grid-glow') fail('syntax.design', `${at}.design.ambient`, 'drift requires grid-glow decoration');
      if (scene.design.background !== undefined) paint(scene.design.background, `${at}.design.background`);
    }
    const nodes = list(scene.content, `${at}.content`, 1);
    unique(nodes.map(n => n.id), `${at}.content`);
    const byId = new Map();
    for (const [i, node] of nodes.entries()) {
      const na = `${at}.content[${i}]`;
      identifier(node.id, `${na}.id`);
      if (!['essential', 'supporting', 'decorative'].includes(node.importance)) fail('syntax.importance', na, 'invalid importance');
      if (node.kind === 'text') {
        keys(node, ['id', 'kind', 'importance', 'role', 'language', 'text', 'segments', 'fit', 'style'], ['id', 'kind', 'importance', 'role', 'language', 'fit'], na);
        if (!['headline', 'body', 'label'].includes(node.role) || node.fit !== 'wrapThenShrink') fail('syntax.text', na, 'unsupported text role or fit');
        textCopy(node, na);
        if (node.language !== 'en') fail('syntax.text', `${na}.language`, 'pilot supports English only');
        if (node.style !== undefined) {
          keys(node.style, ['align', 'size', 'weight', 'color', 'tracking', 'case', 'lineHeight', 'italic'], [], `${na}.style`);
          if (node.style.align !== undefined && !['left', 'center', 'right'].includes(node.style.align)) fail('syntax.text', `${na}.style.align`, 'unsupported text alignment');
          if (node.style.size !== undefined && !['compact', 'base', 'large', 'hero'].includes(node.style.size)) fail('syntax.text', `${na}.style.size`, 'unsupported type size');
          if (node.style.weight !== undefined && ![400, 500, 600, 700, 800, 900].includes(node.style.weight)) fail('syntax.text', `${na}.style.weight`, 'unsupported font weight');
          if (node.style.color !== undefined) colorRef(node.style.color, `${na}.style.color`);
          if (node.style.tracking !== undefined && !['tight', 'normal', 'wide', 'extraWide'].includes(node.style.tracking)) fail('syntax.text', `${na}.style.tracking`, 'unsupported tracking');
          if (node.style.case !== undefined && !['preserve', 'uppercase'].includes(node.style.case)) fail('syntax.text', `${na}.style.case`, 'unsupported text case');
          if (node.style.lineHeight !== undefined && !['tight', 'normal', 'relaxed'].includes(node.style.lineHeight)) fail('syntax.text', `${na}.style.lineHeight`, 'unsupported line height');
          if (node.style.italic !== undefined && typeof node.style.italic !== 'boolean') fail('syntax.text', `${na}.style.italic`, 'expected boolean');
        }
      } else if (node.kind === 'flow') {
        keys(node, ['id', 'kind', 'importance', 'steps', 'outcome', 'variant'], ['id', 'kind', 'importance', 'steps', 'outcome'], na);
        if (!['product-process/v1', 'workflow-demo/v1'].includes(scene.blueprint)) fail('syntax.flow', na, 'flow requires a process blueprint');
        const steps = list(node.steps, `${na}.steps`, 2);
        if (steps.length > 4) fail('syntax.flow', `${na}.steps`, 'at most four flow steps');
        steps.forEach((step, stepIndex) => plainText(step, `${na}.steps[${stepIndex}]`, 28));
        plainText(node.outcome, `${na}.outcome`, 36);
        if (node.variant !== undefined && node.variant !== 'chain') fail('syntax.flow', `${na}.variant`, 'unsupported flow variant');
      } else if (node.kind === 'inputCard') {
        keys(node, ['id', 'kind', 'importance', 'label', 'placeholder'], ['id', 'kind', 'importance', 'placeholder'], na);
        if (scene.blueprint !== 'workflow-demo/v1') fail('syntax.inputCard', na, 'input card requires workflow-demo/v1');
        if (node.label !== undefined) plainText(node.label, `${na}.label`, 36);
        plainText(node.placeholder, `${na}.placeholder`, 58);
      } else if (node.kind === 'videoArtifact') {
        keys(node, ['id', 'kind', 'importance', 'title', 'action', 'phase', 'density'], ['id', 'kind', 'importance', 'title', 'action', 'phase'], na);
        if (scene.blueprint !== 'workflow-demo/v1') fail('syntax.videoArtifact', na, 'video artifact requires workflow-demo/v1');
        plainText(node.title, `${na}.title`, 36);
        plainText(node.action, `${na}.action`, 22);
        if (!['preview', 'export'].includes(node.phase)) fail('syntax.videoArtifact', `${na}.phase`, 'expected preview or export');
        if (node.density !== undefined && node.density !== 'compact') fail('syntax.videoArtifact', `${na}.density`, 'unsupported artifact density');
      } else if (node.kind === 'productState') {
        keys(node, ['id', 'kind', 'importance', 'stateRef'], ['id', 'kind', 'importance', 'stateRef'], na);
        const asset = bundle.assets?.[node.stateRef];
        if (!asset) fail('reference.asset', `${na}.stateRef`, `missing ${node.stateRef}`);
        if (asset.kind !== 'productState' || asset.displayAllowed !== true || !SHA.test(asset.sha256 || '')) fail('reference.asset', `${na}.stateRef`, 'asset is not a verified displayable product state');
      } else if (node.kind === 'svg') {
        keys(node, ['id', 'kind', 'importance', 'assetRef', 'fit'], ['id', 'kind', 'importance', 'assetRef', 'fit'], na);
        const asset = bundle.assets?.[node.assetRef];
        if (!asset || asset.kind !== 'svg' || asset.displayAllowed !== true || !SHA.test(asset.sha256 || '') || typeof asset.license !== 'string' || !asset.license.trim()) fail('reference.asset', `${na}.assetRef`, 'missing verified displayable SVG with license');
        if (!['contain', 'cover'].includes(node.fit)) fail('syntax.svg', `${na}.fit`, 'unsupported SVG fit');
      } else if (node.kind === 'shape') {
        keys(node, ['id', 'kind', 'importance', 'primitive', 'fill', 'stroke', 'corner', 'origin'], ['id', 'kind', 'importance', 'primitive'], na);
        if (!['panel', 'circle', 'rule'].includes(node.primitive)) fail('syntax.shape', na, 'unsupported shape');
        if (node.fill !== undefined && node.fill !== 'none') paint(node.fill, `${na}.fill`);
        if (node.stroke !== undefined) {
          keys(node.stroke, ['color', 'width'], ['color', 'width'], `${na}.stroke`);
          colorRef(node.stroke.color, `${na}.stroke.color`);
          int(node.stroke.width, `${na}.stroke.width`, 1, 12);
        }
        if (node.corner !== undefined && !['square', 'soft', 'pill'].includes(node.corner)) fail('syntax.shape', `${na}.corner`, 'unsupported corner');
        if (node.primitive === 'circle' && node.corner !== undefined) fail('syntax.shape', `${na}.corner`, 'circle has a fixed round corner');
        if (node.origin !== undefined && !['left', 'center', 'right'].includes(node.origin)) fail('syntax.shape', `${na}.origin`, 'unsupported transform origin');
      } else fail('syntax.node', na, `unsupported node ${node.kind}`);
      byId.set(node.id, node);
    }
    const essentials = list(scene.essential, `${at}.essential`);
    unique(essentials, `${at}.essential`);
    if (canonical(essentials.slice().sort()) !== canonical(nodes.filter(n => n.importance === 'essential').map(n => n.id).sort())) fail('semantic.essential', `${at}.essential`, 'must equal essential content IDs');
    object(scene.layouts, `${at}.layouts`);
    const layoutVisible = new Map();
    for (const profile of program.profiles) {
      const tree = scene.layouts[profile] ?? scene.layouts.default;
      if (!tree) fail('semantic.profile', `${at}.layouts`, `missing layout for ${profile}`);
      if (program.verification?.mode === 'allFrames' && tree.type !== 'canvas') fail('semantic.verification', `${at}.layouts.${profile}`, 'allFrames verification requires a bounded canvas layout');
      const seen = [];
      layoutRefs(tree, `${at}.layouts.${profile}`, byId, seen);
      unique(seen, `${at}.layouts.${profile}`);
      layoutVisible.set(profile, new Set(seen));
      for (const node of nodes.filter(n => n.importance !== 'decorative')) if (!seen.includes(node.id)) fail('semantic.layout', `${at}.layouts.${profile}`, `missing ${node.id}`);
    }
    const states = list(scene.states, `${at}.states`, 1);
    unique(states.map(s => s.id), `${at}.states`);
    const stateMap = new Map();
    for (const [i, state] of states.entries()) {
      keys(state, ['id', 'visible'], ['id', 'visible'], `${at}.states[${i}]`);
      identifier(state.id, `${at}.states[${i}].id`);
      unique(list(state.visible, `${at}.states[${i}].visible`), `${at}.states[${i}].visible`);
      for (const id of state.visible) if (!byId.has(id)) fail('reference.node', `${at}.states[${i}]`, `unknown ${id}`);
      stateMap.set(state.id, state);
    }
    if (!stateMap.has(scene.initialState) || !stateMap.has(scene.resolvedState)) fail('reference.state', at, 'initial or resolved state missing');
    const events = list(scene.events, `${at}.events`);
    let latest = -1;
    const written = new Set();
    const initialVisible = stateMap.get(scene.initialState).visible;
    const resolvedVisible = stateMap.get(scene.resolvedState).visible;
    for (const [i, event] of events.entries()) {
      const ea = `${at}.events[${i}]`;
      keys(event, ['atFrame', 'durationFrames', 'effect', 'target', 'from', 'to', 'preset', 'ease', 'frames'], ['atFrame', 'durationFrames', 'effect'], ea);
      if (event.frames !== undefined && event.effect !== 'keyframes') fail('syntax.motion', `${ea}.frames`, 'frames require the keyframes effect');
      int(event.atFrame, `${ea}.atFrame`, 0, scene.durationFrames - 1);
      int(event.durationFrames, `${ea}.durationFrames`, 1, scene.durationFrames);
      if (event.atFrame < latest || event.atFrame + event.durationFrames > scene.durationFrames) fail('semantic.timing', ea, 'events out of order or past scene end');
      latest = event.atFrame;
      if (event.effect === 'appear') {
        if (!byId.has(event.target)) fail('reference.node', ea, 'appear target missing');
        for (const profile of program.profiles) if (!layoutVisible.get(profile).has(event.target)) fail('semantic.layout', ea, `animated ${event.target} is missing from ${profile}`);
        if (event.preset !== undefined && !['rise', 'slide', 'pop', 'fade', 'stagger', 'paste', 'reveal'].includes(event.preset)) fail('syntax.motion', `${ea}.preset`, 'unsupported entrance preset');
        if (event.preset === 'stagger' && byId.get(event.target).kind !== 'flow') fail('syntax.motion', `${ea}.preset`, 'stagger requires a flow node');
        if (event.preset === 'paste' && byId.get(event.target).kind !== 'inputCard') fail('syntax.motion', `${ea}.preset`, 'paste requires an input card');
        if (event.preset === 'reveal' && byId.get(event.target).kind !== 'videoArtifact') fail('syntax.motion', `${ea}.preset`, 'reveal requires a video artifact');
        if (initialVisible.includes(event.target) || !resolvedVisible.includes(event.target)) fail('semantic.state', ea, 'appear target must enter between initial and resolved');
        if (written.has(event.target)) fail('semantic.motion', ea, 'node receives multiple writes');
        written.add(event.target);
      } else if (event.effect === 'replace') {
        if (event.preset !== undefined) fail('syntax.motion', `${ea}.preset`, 'replace has no entrance preset');
        if (event.from !== scene.initialState || event.to !== scene.resolvedState) fail('reference.state', ea, 'pilot replace must connect initial to resolved');
        for (const id of [...initialVisible, ...resolvedVisible]) {
          if (written.has(id)) fail('semantic.motion', ea, 'node receives multiple writes');
          written.add(id);
        }
      } else if (event.effect === 'tween') {
        if (!byId.has(event.target) || !initialVisible.includes(event.target) || !resolvedVisible.includes(event.target)) fail('semantic.motion', ea, 'tween target must be visible throughout scene');
        for (const profile of program.profiles) if (!layoutVisible.get(profile).has(event.target)) fail('semantic.layout', ea, `animated ${event.target} is missing from ${profile}`);
        if (event.preset !== undefined) fail('syntax.motion', `${ea}.preset`, 'tween uses from/to, not preset');
        if (!MOTION_EASES.includes(event.ease)) fail('syntax.motion', `${ea}.ease`, 'unsupported easing');
        if (canonical(motionValue(event.from, `${ea}.from`)) !== canonical(motionValue(event.to, `${ea}.to`))) fail('syntax.motion', ea, 'from/to must name the same properties');
        if (written.has(event.target)) fail('semantic.motion', ea, 'node receives multiple writes');
        written.add(event.target);
      } else if (event.effect === 'keyframes') {
        keys(event, ['atFrame', 'durationFrames', 'effect', 'target', 'frames', 'ease'], ['atFrame', 'durationFrames', 'effect', 'target', 'frames', 'ease'], ea);
        if (!byId.has(event.target) || !initialVisible.includes(event.target) || !resolvedVisible.includes(event.target)) fail('semantic.motion', ea, 'keyframe target must remain visible throughout scene');
        for (const profile of program.profiles) if (!layoutVisible.get(profile).has(event.target)) fail('semantic.layout', ea, `animated ${event.target} is missing from ${profile}`);
        if (!MOTION_EASES.includes(event.ease)) fail('syntax.motion', `${ea}.ease`, 'unsupported easing');
        const frames = list(event.frames, `${ea}.frames`, 2);
        if (frames.length > 5) fail('syntax.motion', `${ea}.frames`, 'at most five keyframes');
        let previousFrame = -1;
        let properties = null;
        for (const [frameIndex, frame] of frames.entries()) {
          const location = `${ea}.frames[${frameIndex}]`;
          keys(frame, ['atFrame', 'value'], ['atFrame', 'value'], location);
          int(frame.atFrame, `${location}.atFrame`, 0, event.durationFrames);
          if (frame.atFrame <= previousFrame) fail('syntax.motion', `${location}.atFrame`, 'keyframes must increase strictly');
          previousFrame = frame.atFrame;
          const current = canonical(motionValue(frame.value, `${location}.value`));
          if (properties !== null && current !== properties) fail('syntax.motion', location, 'all keyframes must name the same properties');
          properties = current;
        }
        if (frames[0].atFrame !== 0 || frames.at(-1).atFrame !== event.durationFrames) fail('syntax.motion', ea, 'keyframes must start at 0 and end at durationFrames');
        if (written.has(event.target)) fail('semantic.motion', ea, 'node receives multiple writes');
        written.add(event.target);
      } else fail('syntax.effect', ea, `unsupported effect ${event.effect}`);
    }
    if (scene.initialState !== scene.resolvedState && !events.length) fail('semantic.state', at, 'state transition requires event');
    if (events.every(e => e.effect !== 'replace')) for (const id of resolvedVisible.filter(id => !initialVisible.includes(id))) {
      if (!written.has(id)) fail('semantic.state', at, `unrevealed final node ${id}`);
    }
    if (events.some(e => e.atFrame + e.durationFrames > Math.floor(scene.durationFrames * .85))) fail('semantic.hold', at, 'resolved state must hold last 15%');
    if (stateMap.get(scene.initialState).visible.length === 0 && (events[0]?.atFrame ?? Infinity) > 10) fail('semantic.opening', at, 'first visible content arrives after frame 10');
  }
  return true;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function cssId(scene, id) { return `fl-${scene.id}-${id}`; }
function gap(token) { return { tight: 16, regular: 32, comfortable: 56 }[token || 'regular']; }
function renderText(node) {
  if (node.text !== undefined) return escapeHtml(node.text);
  return node.segments.map(segment => `<span class="fl-tone-${segment.tone || 'foreground'}">${escapeHtml(segment.text)}</span>${segment.breakAfter ? '<br>' : ''}`).join('');
}
function renderFlow(node, stagger) {
  const hidden = stagger ? ' style="opacity:0"' : '';
  if (node.variant === 'chain') {
    const steps = node.steps.map((step, index) => `<div class="fl-chain-step fl-flow-item" data-flow-order="${index + 1}"${hidden}>${escapeHtml(step)}</div>${index < node.steps.length - 1 ? '<div class="fl-chain-plus" aria-hidden="true">+</div>' : ''}`).join('');
    return `<div class="fl-chain-steps">${steps}</div><div class="fl-chain-arrow" aria-hidden="true">→</div><div class="fl-chain-outcome fl-flow-item" data-flow-order="${node.steps.length + 1}"${hidden}>${escapeHtml(node.outcome)}</div>`;
  }
  const steps = node.steps.map((step, index) => `<div class="fl-flow-chip fl-flow-item" data-flow-order="${index + 1}"${hidden}>${escapeHtml(step)}</div>`).join('');
  return `<div class="fl-flow-steps">${steps}</div><div class="fl-flow-arrow fl-flow-item" data-flow-order="${node.steps.length + 1}"${hidden} aria-hidden="true">→</div><div class="fl-flow-outcome fl-flow-item" data-flow-order="${node.steps.length + 2}"${hidden}>${escapeHtml(node.outcome)}</div>`;
}
function renderInputCard(node) {
  return `<div class="fl-input-top"><div class="fl-input-dots"><i></i><i></i><i></i></div><span>PUBLIC LINK / INPUT</span><span class="fl-input-index">01</span></div><div class="fl-input-label">${escapeHtml(node.label || 'PASTE A PUBLIC PRODUCT URL')}</div><div class="fl-input-field"><span class="fl-input-link">${escapeHtml(node.placeholder)}</span><span class="fl-input-caret" aria-hidden="true"></span><span class="fl-input-go" aria-hidden="true">↗</span></div><div class="fl-input-foot"><span>URL</span><span class="fl-input-rule"></span><span>FIRST CUT</span></div>`;
}
function renderVideoArtifact(node, reveal) {
  const hidden = reveal ? ' style="opacity:0"' : '';
  const status = node.phase === 'export' ? 'READY TO REVIEW' : 'FIRST CUT PREVIEW';
  const foot = node.phase === 'export' ? 'REVIEW THE CUT' : 'ASSEMBLING THE CUT';
  return `<div class="fl-art-top"><span>VIDEO / FIRST CUT</span><span class="fl-art-indicator"><i></i> ${status}</span></div><div class="fl-art-body"><div class="fl-art-screen"><div class="fl-art-frame fl-art-frame-a"${hidden}><div class="fl-art-orbit" data-layout-allow-overflow></div></div><div class="fl-art-frame fl-art-frame-b"${hidden}><div class="fl-art-sun" data-layout-allow-overflow></div></div><div class="fl-art-frame fl-art-frame-c"${hidden}><div class="fl-art-bars"></div></div><div class="fl-art-play"${hidden} aria-hidden="true">▶</div><div class="fl-art-screen-label">${escapeHtml(node.title)}</div></div><div class="fl-art-timeline"${hidden}><div class="fl-art-ticks"><i></i><i></i><i></i><i></i><i></i></div><div class="fl-art-playhead"></div></div></div><div class="fl-art-bottom"><span>${foot}</span><span class="fl-art-action${node.phase === 'export' ? ' fl-art-action-live' : ''}"${hidden}>${escapeHtml(node.action)} <b>↗</b></span></div>`;
}
function textStyle(node, profile, brand, rect) {
  const css = [];
  if (node.style?.align) css.push(`text-align:${node.style.align}`);
  if (node.style?.weight) css.push(`font-weight:${node.style.weight}`);
  if (node.style?.color) css.push(`color:${cssColor(node.style.color, brand)}`);
  if (node.style?.tracking) css.push(`letter-spacing:${{ tight: '-.045em', normal: '0', wide: '.12em', extraWide: '.3em' }[node.style.tracking]}`);
  if (node.style?.case === 'uppercase') css.push('text-transform:uppercase');
  if (node.style?.lineHeight) css.push(`line-height:${{ tight: .98, normal: 1.1, relaxed: 1.3 }[node.style.lineHeight]}`);
  if (node.style?.italic) css.push('font-style:italic');
  const firstLine = node.segments?.[0]?.text || node.text || '';
  const size = node.style?.size || (node.fit === 'wrapThenShrink' && node.role === 'headline' && rect && rect[2] <= 550 && firstLine.length > 20 ? 'compact' : undefined);
  if (size) {
    const base = node.role === 'headline' ? PROFILE[profile].heading : node.role === 'body' ? PROFILE[profile].body : Math.round(PROFILE[profile].body * .75);
    const factor = { compact: .75, base: 1, large: 1.25, hero: 1.5 }[size];
    css.push(`font-size:${Math.round(base * factor)}px`);
  }
  return css.join(';');
}
function renderTree(tree, scene, profile, nodes, initial, brand, rect) {
  if (typeof tree === 'string') {
    const node = nodes.get(tree);
    const id = cssId(scene, tree);
    const hidden = initial.includes(tree) ? '' : ' style="opacity:0"';
    if (node.kind === 'text') { const style = [initial.includes(tree) ? '' : 'opacity:0', textStyle(node, profile, brand, rect)].filter(Boolean).join(';'); return `<div id="${id}" class="fl-node fl-text fl-${node.role}" data-fl-fit="${node.fit}"${style ? ` style="${style}"` : ''}>${renderText(node)}</div>`; }
    if (node.kind === 'flow') return `<div id="${id}" class="fl-node fl-flow${node.variant === 'chain' ? ' fl-flow-chain' : ''}"${hidden}>${renderFlow(node, scene.events.some(event => event.target === node.id && event.preset === 'stagger'))}</div>`;
    if (node.kind === 'inputCard') return `<div id="${id}" class="fl-node fl-input-card"${hidden}>${renderInputCard(node)}</div>`;
    if (node.kind === 'videoArtifact') return `<div id="${id}" class="fl-node fl-artifact fl-artifact-${node.phase}${node.density === 'compact' ? ' fl-artifact-compact' : ''}"${hidden}>${renderVideoArtifact(node, scene.events.some(event => event.target === node.id && event.preset === 'reveal'))}</div>`;
    if (node.kind === 'shape') {
      const style = [
        initial.includes(tree) ? '' : 'opacity:0',
        node.fill === 'none' ? 'background:transparent' : node.fill ? `background:${cssPaint(node.fill, brand)}` : '',
        node.stroke ? `border:${node.stroke.width}px solid ${cssColor(node.stroke.color, brand)}` : '',
        node.corner ? `border-radius:${{ square: '0', soft: '18px', pill: '9999px' }[node.corner]}` : '',
        node.origin ? `transform-origin:${node.origin} center` : '',
      ].filter(Boolean).join(';');
      return `<div id="${id}" class="fl-node fl-panel${node.primitive === 'circle' ? ' fl-circle' : node.primitive === 'rule' ? ' fl-rule-node' : ''}"${style ? ` style="${style}"` : ''}></div>`;
    }
    if (node.kind === 'svg') return `<div id="${id}" class="fl-node fl-media fl-svg"${hidden}><img src="assets/${scene.id}-${node.id}.svg" alt="" style="object-fit:${node.fit}" /></div>`;
    return `<div id="${id}" class="fl-node fl-media"${hidden}><img src="assets/${scene.id}-${node.id}.svg" alt="" /></div>`;
  }
  if (tree.type === 'stack') return `<div class="fl-layout fl-stack${scene.design?.alignment === 'left' ? ' fl-start' : ''}" style="flex-direction:${tree.direction};gap:${gap(tree.gap)}px">${tree.children.map(n => renderTree(n, scene, profile, nodes, initial, brand)).join('')}</div>`;
  if (tree.type === 'split') {
    const [a, b] = tree.ratio.split(':').map(n => Number(n) / 10);
    return `<div class="fl-layout fl-split" style="grid-template-columns:${a}fr ${b}fr">${renderTree(tree.left, scene, profile, nodes, initial, brand)}${renderTree(tree.right, scene, profile, nodes, initial, brand)}</div>`;
  }
  if (tree.type === 'canvas') return `<div class="fl-layout fl-canvas">${canvasPlacements(tree, `$.scenes.${scene.id}.layouts.${profile}`, nodes).map(({ placement, rect }) => { const [x, y, width, height] = rect; return `<div class="fl-placement fl-placement-${placement.align || 'start'}" style="left:${x / 10}%;top:${y / 10}%;width:${width / 10}%;height:${height / 10}%;z-index:${placement.layer || 0}">${renderTree(placement.node, scene, profile, nodes, initial, brand, rect)}</div>`; }).join('')}</div>`;
  return `<div class="fl-layout fl-overlay">${renderTree(tree.base, scene, profile, nodes, initial, brand)}${tree.attachments.map(a => `<div class="fl-attachment">${renderTree(a.node, scene, profile, nodes, initial, brand)}</div>`).join('')}</div>`;
}

function htmlFor(program, bundle, profile) {
  const p = PROFILE[profile];
  let cursor = 0;
  const clips = [];
  const timeline = [];
  for (const [i, scene] of program.scenes.entries()) {
    const nodes = new Map(scene.content.map(n => [n.id, n]));
    const tree = scene.layouts[profile] ?? scene.layouts.default;
    const initial = scene.states.find(s => s.id === scene.initialState).visible;
    const start = cursor / program.fps;
    const duration = (scene.durationFrames - (i === program.scenes.length - 1 ? 0 : 1)) / program.fps;
    const body = renderTree(tree, scene, profile, nodes, initial, bundle.brand);
    const design = scene.design || {};
    const decoration = design.decoration === 'grid-glow' ? '<div class="fl-grid" data-layout-allow-overflow></div><div class="fl-glow" data-layout-allow-overflow></div><div class="fl-rule fl-rule-top"></div><div class="fl-rule fl-rule-bottom"></div>' : design.decoration === 'rules' ? '<div class="fl-rule fl-rule-top"></div><div class="fl-rule fl-rule-bottom"></div>' : '';
    const chrome = design.chrome === 'editorial' ? `<div class="fl-chrome-top"><span>${escapeHtml(bundle.brand.name.toUpperCase())} / FRAMELANG</span><span>${String(i + 1).padStart(2, '0')} / ${String(program.scenes.length).padStart(2, '0')}</span></div><div class="fl-chrome-bottom"><span>ILLUSTRATIVE VIDEO WORKFLOW</span><span>TYPED SCENE → VIDEO</span></div><div class="fl-progress"><span style="width:${((i + 1) / program.scenes.length * 100).toFixed(3)}%"></span></div>` : '';
    const sceneClass = `fl-scene${design.alignment === 'left' ? ' fl-left' : ''}${design.scale === 'display' ? ' fl-display' : ''}${design.chrome === 'editorial' ? ' fl-chromed' : ''}`;
    clips.push(`<section class="clip" id="fl-${scene.id}" data-start="${start.toFixed(6)}" data-duration="${duration.toFixed(6)}" data-track-index="${i}"${design.background ? ` style="background:${cssPaint(design.background, bundle.brand)}"` : ''}>${decoration}${chrome}<div class="${sceneClass}">${body}</div></section>`);
    if (design.ambient === 'drift') {
      timeline.push(`tl.fromTo('#fl-${scene.id} .fl-glow',{x:-36,y:20},{x:36,y:-18,duration:${(scene.durationFrames / program.fps).toFixed(6)},ease:'none'},${start.toFixed(6)});`);
      timeline.push(`tl.fromTo('#fl-${scene.id} .fl-grid',{x:-18},{x:18,duration:${(scene.durationFrames / program.fps).toFixed(6)},ease:'none'},${start.toFixed(6)});`);
    }
    if (design.chrome === 'editorial') timeline.push(`tl.fromTo('#fl-${scene.id} .fl-progress span',{scaleX:0},{scaleX:1,duration:.48,ease:'power3.out'},${start.toFixed(6)});`);
    for (const event of scene.events) {
      const at = (cursor + event.atFrame) / program.fps;
      const dur = event.durationFrames / program.fps;
      if (event.effect === 'appear') {
        const selector = `#${cssId(scene, event.target)}`;
        const preset = event.preset || 'rise';
        if (preset === 'stagger') {
          timeline.push(`tl.set('${selector}',{opacity:1},${at.toFixed(6)});`);
          const flow = scene.content.find(n => n.id === event.target);
          const children = flow.steps.length + (flow.variant === 'chain' ? 1 : 2);
          const itemDuration = Math.max(.15, dur / (children + 1));
          for (let child = 0; child < children; child++) timeline.push(`tl.fromTo('${selector} [data-flow-order="${child + 1}"]',{opacity:0,y:20},{opacity:1,y:0,duration:${itemDuration.toFixed(6)},ease:'power2.out'},${(at + child * itemDuration).toFixed(6)});`);
        } else if (preset === 'paste') {
          timeline.push(`tl.fromTo('${selector}',{opacity:0,x:64,scale:.96},{opacity:1,x:0,scale:1,duration:${Math.min(dur, .55).toFixed(6)},ease:'power3.out'},${at.toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-input-link',{opacity:0,x:-16},{opacity:1,x:0,duration:.34,ease:'power2.out'},${(at + Math.min(dur * .38, .32)).toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-input-go',{scale:.7},{scale:1,duration:.3,ease:'back.out(1.5)'},${(at + Math.min(dur * .62, .52)).toFixed(6)});`);
        } else if (preset === 'reveal') {
          timeline.push(`tl.set('${selector}',{opacity:1},${at.toFixed(6)});`);
          const part = Math.max(.18, dur / 6);
          for (let frame = 0; frame < 3; frame++) timeline.push(`tl.fromTo('${selector} .fl-art-frame-${'abc'[frame]}',{opacity:0,y:32,scale:.92},{opacity:1,y:0,scale:1,duration:${(part * 1.5).toFixed(6)},ease:'power3.out'},${(at + frame * part).toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-art-play',{opacity:0,scale:.55},{opacity:1,scale:1,duration:${part.toFixed(6)},ease:'back.out(1.7)'},${(at + 2.5 * part).toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-art-timeline',{opacity:0,y:18},{opacity:1,y:0,duration:${part.toFixed(6)},ease:'power2.out'},${(at + 3 * part).toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-art-action',{opacity:0,x:-18},{opacity:1,x:0,duration:${part.toFixed(6)},ease:'power2.out'},${(at + 4 * part).toFixed(6)});`);
          timeline.push(`tl.fromTo('${selector} .fl-art-playhead',{x:0},{x:160,duration:${Math.max(.3, dur - 3 * part).toFixed(6)},ease:'none'},${(at + 3 * part).toFixed(6)});`);
        } else {
          const from = preset === 'slide' ? '{opacity:0,x:-28}' : preset === 'pop' ? '{opacity:0,scale:.92}' : preset === 'fade' ? '{opacity:0}' : '{opacity:0,y:24}';
          const to = preset === 'slide' ? `{opacity:1,x:0,duration:${dur.toFixed(6)},ease:'power2.out'}` : preset === 'pop' ? `{opacity:1,scale:1,duration:${dur.toFixed(6)},ease:'power2.out'}` : preset === 'fade' ? `{opacity:1,duration:${dur.toFixed(6)},ease:'power2.out'}` : `{opacity:1,y:0,duration:${dur.toFixed(6)},ease:'power2.out'}`;
          timeline.push(`tl.fromTo('${selector}',${from},${to},${at.toFixed(6)});`);
        }
      }
      if (event.effect === 'replace') {
        const oldIds = scene.states.find(s => s.id === event.from).visible.filter(id => !scene.states.find(s => s.id === event.to).visible.includes(id));
        const newIds = scene.states.find(s => s.id === event.to).visible.filter(id => !scene.states.find(s => s.id === event.from).visible.includes(id));
        const switchAt = at + dur / 2;
        for (const id of oldIds) timeline.push(`tl.set('#${cssId(scene, id)}',{opacity:0},${switchAt.toFixed(6)});`);
        for (const id of newIds) timeline.push(`tl.set('#${cssId(scene, id)}',{opacity:1},${switchAt.toFixed(6)});`);
      }
      if (event.effect === 'tween') {
        const to = { ...event.to, duration: Number(dur.toFixed(6)), ease: event.ease };
        timeline.push(`tl.fromTo('#${cssId(scene, event.target)}',${JSON.stringify(event.from)},${JSON.stringify(to)},${at.toFixed(6)});`);
      }
      if (event.effect === 'keyframes') {
        for (let index = 0; index < event.frames.length - 1; index++) {
          const from = event.frames[index];
          const to = event.frames[index + 1];
          const segment = (to.atFrame - from.atFrame) / program.fps;
          const position = at + from.atFrame / program.fps;
          timeline.push(`tl.fromTo('#${cssId(scene, event.target)}',${JSON.stringify(from.value)},${JSON.stringify({ ...to.value, duration: Number(segment.toFixed(6)), ease: event.ease })},${position.toFixed(6)});`);
        }
      }
    }
    cursor += scene.durationFrames;
  }
  const total = cursor / program.fps;
  const portrait = p.width < p.height;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${p.width},height=${p.height}"><title>${escapeHtml(bundle.brand.name)}</title><style>
@font-face{font-family:FrameLangInter;src:url('assets/Inter.ttf') format('truetype');font-style:normal;font-weight:100 900;font-display:block}
html,body{margin:0;width:${p.width}px;height:${p.height}px;background:${bundle.brand.background}}
*{box-sizing:border-box}#root{width:${p.width}px;height:${p.height}px;position:relative;overflow:hidden;background:${bundle.brand.background}}
.clip{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;isolation:isolate}
.fl-scene{position:absolute;left:${p.insetX}px;right:${p.insetX}px;top:${p.insetY}px;bottom:${p.insetY}px;display:flex;min-width:0;min-height:0;align-items:center;justify-content:center}
.fl-scene.fl-left{justify-content:flex-start;text-align:left}.fl-scene.fl-chromed{top:${p.insetY + 66}px;bottom:${p.insetY + 76}px}.fl-layout{width:100%;height:100%;min-width:0;min-height:0}.fl-stack{display:flex;justify-content:center;align-items:center}.fl-stack.fl-start{align-items:flex-start}.fl-split{display:grid;align-items:center;gap:48px}.fl-canvas{position:relative}.fl-placement{position:absolute;display:flex;min-width:0;min-height:0}.fl-placement-start{align-items:flex-start}.fl-placement-center{align-items:center}.fl-placement-end{align-items:flex-end}.fl-placement>.fl-node{width:100%;height:100%}
.fl-node{min-width:0;max-width:100%}.fl-text{font-family:FrameLangInter,sans-serif;color:${bundle.brand.foreground};overflow-wrap:anywhere;line-height:1.05;font-weight:700}
.fl-headline{font-size:${p.heading}px;letter-spacing:-.045em}.fl-display .fl-headline{font-size:${p.displayHeading}px;line-height:.98}.fl-body{font-size:${p.body}px;line-height:1.2;font-weight:500}.fl-label{font-size:${Math.round(p.body*.75)}px;color:${bundle.brand.accent};text-transform:uppercase;letter-spacing:.08em}.fl-tone-accent{color:${bundle.brand.accent}}.fl-tone-accentBlock{display:inline-block;background:${bundle.brand.accent};color:${bundle.brand.background};padding:0 .12em .06em;margin-left:.12em;white-space:nowrap}
.fl-flow{display:flex;align-items:center;gap:24px;font-family:FrameLangInter,sans-serif;font-size:${p.flow}px;font-weight:700;color:${bundle.brand.foreground}}
.fl-flow-steps{display:flex;flex-wrap:wrap;align-items:center;gap:16px}.fl-flow-chip{border:2px solid ${bundle.brand.foreground}66;padding:18px 25px;background:${bundle.brand.foreground}0d;white-space:nowrap}.fl-flow-arrow{font-size:${p.flow + 14}px;color:${bundle.brand.accent}}.fl-flow-outcome{background:${bundle.brand.accent};color:${bundle.brand.background};padding:20px 30px;white-space:nowrap}
.fl-canvas .fl-flow{flex-direction:column;align-items:stretch;width:100%;gap:12px}.fl-canvas .fl-flow-steps{flex-direction:column;align-items:stretch;width:100%;gap:11px}.fl-canvas .fl-flow-chip{white-space:normal}.fl-canvas .fl-flow-arrow{transform:rotate(90deg);align-self:center}.fl-canvas .fl-flow-outcome{text-align:center;white-space:normal}
${portrait ? '.fl-flow{flex-direction:column;align-items:stretch;width:100%;gap:18px}.fl-flow-steps{flex-direction:column;align-items:stretch;width:100%;gap:13px}.fl-flow-chip{text-align:left;white-space:normal}.fl-flow-arrow{transform:rotate(90deg);align-self:center}.fl-flow-outcome{text-align:center}.fl-chromed .fl-stack{justify-content:space-evenly}' : ''}
.fl-canvas .fl-flow-chain{display:flex;flex-direction:${portrait ? 'column' : 'row'};align-items:${portrait ? 'stretch' : 'center'};justify-content:center;gap:${portrait ? 17 : 24}px;width:100%;height:100%;font-size:${portrait ? 34 : 32}px}.fl-canvas .fl-chain-steps{display:flex;flex:1;min-width:0;align-items:stretch;gap:${portrait ? 12 : 15}px;flex-direction:${portrait ? 'column' : 'row'}}.fl-chain-step{display:flex;align-items:center;justify-content:center;min-width:0;flex:1;text-align:center;padding:${portrait ? '16px 22px' : '19px 20px'};border:2px solid ${bundle.brand.foreground}77;background:${bundle.brand.foreground}0c;line-height:1.1}.fl-chain-plus,.fl-chain-arrow{display:grid;place-items:center;flex:none;color:${bundle.brand.accent};font-weight:900}.fl-chain-arrow{font-size:${portrait ? 51 : 52}px;transform:${portrait ? 'rotate(90deg)' : 'none'}}.fl-chain-outcome{display:grid;place-items:center;flex:none;text-align:center;padding:${portrait ? '20px 28px' : '20px 36px'};background:${bundle.brand.accent};color:${bundle.brand.background};font-weight:900}.fl-canvas .fl-chain-plus{font-size:${portrait ? 30 : 38}px}
.fl-grid{position:absolute;inset:0;background-image:linear-gradient(90deg,${bundle.brand.foreground}0b 1px,transparent 1px);background-size:160px 100%;pointer-events:none}.fl-glow{position:absolute;width:880px;height:880px;right:-220px;top:-300px;background:radial-gradient(circle,${bundle.brand.accent}22,transparent 65%);pointer-events:none}.fl-rule{position:absolute;left:${p.insetX}px;right:${p.insetX}px;height:2px;background:${bundle.brand.foreground}2a;pointer-events:none}.fl-rule-top{top:${p.insetY}px}.fl-rule-bottom{bottom:${p.insetY}px}
.fl-chrome-top,.fl-chrome-bottom{position:absolute;left:${p.insetX}px;right:${p.insetX}px;display:flex;align-items:center;justify-content:space-between;font-family:FrameLangInter,sans-serif;font-size:${portrait ? 27 : 25}px;font-weight:700;letter-spacing:.12em;color:${bundle.brand.foreground}a8}.fl-chrome-top{top:${p.insetY + 5}px}.fl-chrome-bottom{bottom:${p.insetY + 15}px}.fl-chrome-top span:first-child{color:${bundle.brand.accent}}.fl-progress{position:absolute;left:${p.insetX}px;right:${p.insetX}px;bottom:${p.insetY - 19}px;height:5px;background:${bundle.brand.foreground}38;overflow:hidden}.fl-progress span{display:block;height:100%;background:${bundle.brand.accent};transform-origin:left}
.fl-input-card{width:100%;height:${portrait ? 620 : 400}px;padding:${portrait ? 44 : 38}px;border:2px solid ${bundle.brand.foreground}75;background:#131315;box-shadow:22px 28px 0 ${bundle.brand.accent}26,0 35px 100px #0009;font-family:FrameLangInter,sans-serif;color:${bundle.brand.foreground};display:flex;flex-direction:column;justify-content:space-between}
.fl-input-top,.fl-input-foot{display:flex;align-items:center;gap:24px;font-size:${portrait ? 28 : 24}px;letter-spacing:.12em;font-weight:700}.fl-input-top{color:${bundle.brand.foreground}9c}.fl-input-dots{display:flex;gap:10px;margin-right:15px}.fl-input-dots i{display:block;width:14px;height:14px;border:2px solid ${bundle.brand.foreground}78;border-radius:50%}.fl-input-index{margin-left:auto;color:${bundle.brand.accent}}.fl-input-label{font-size:${portrait ? 30 : 28}px;font-weight:800;letter-spacing:.12em;color:${bundle.brand.accent}}
.fl-input-field{display:flex;align-items:center;gap:15px;min-height:${portrait ? 160 : 124}px;padding:20px 24px;border:2px solid ${bundle.brand.accent};background:${bundle.brand.accent}0c;font-size:${portrait ? 48 : 50}px;font-weight:600;letter-spacing:-.035em;box-shadow:inset 0 0 50px ${bundle.brand.accent}12}.fl-input-link{overflow-wrap:anywhere}.fl-input-caret{width:4px;height:1.2em;background:${bundle.brand.accent};flex:none}.fl-input-go{margin-left:auto;display:grid;place-items:center;flex:none;width:${portrait ? 82 : 76}px;height:${portrait ? 82 : 76}px;background:${bundle.brand.accent};color:${bundle.brand.background};font-size:58px;line-height:1}.fl-input-foot{color:${bundle.brand.foreground}9c}.fl-input-rule{flex:1;height:2px;background:${bundle.brand.accent}8c}
.fl-artifact{width:100%;height:${portrait ? 900 : 550}px;padding:${portrait ? 34 : 30}px;border:2px solid ${bundle.brand.foreground}6d;background:#141416;box-shadow:18px 24px 0 ${bundle.brand.accent}21,0 35px 100px #0008;font-family:FrameLangInter,sans-serif;color:${bundle.brand.foreground};display:flex;flex-direction:column;gap:19px}.fl-art-top,.fl-art-bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:${portrait ? 26 : 22}px;font-weight:800;letter-spacing:.1em}.fl-art-top{color:${bundle.brand.foreground}a8}.fl-art-indicator{display:flex;align-items:center;gap:12px;color:${bundle.brand.accent}}.fl-art-indicator i{display:block;width:15px;height:15px;border-radius:50%;background:${bundle.brand.accent};box-shadow:0 0 22px ${bundle.brand.accent}}
.fl-art-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:17px}.fl-art-screen{position:relative;flex:1;overflow:hidden;border:2px solid ${bundle.brand.foreground}65;background:radial-gradient(circle at 72% 25%,${bundle.brand.accent}24,transparent 43%),#0A0A0C}.fl-art-frame{position:absolute;width:42%;height:57%;top:19%;border:3px solid ${bundle.brand.foreground}e0;background:#222226;box-shadow:15px 20px 40px #000a;overflow:hidden}.fl-art-frame-a{left:7%;background:linear-gradient(145deg,#292A2D,#111114)}.fl-art-frame-b{left:29%;top:14%;background:linear-gradient(135deg,#3B3C20,#1B1B1B)}.fl-art-frame-c{left:51%;top:9%;background:linear-gradient(155deg,#18191A,#323317)}.fl-art-orbit{position:absolute;left:19%;top:15%;width:60%;aspect-ratio:1;border:12px solid ${bundle.brand.accent};border-radius:50%;box-shadow:0 0 45px ${bundle.brand.accent}64}.fl-art-sun{position:absolute;right:15%;top:15%;width:41%;aspect-ratio:1;border-radius:50%;background:${bundle.brand.accent};box-shadow:0 0 58px ${bundle.brand.accent}95}.fl-art-bars{position:absolute;inset:29% 12%;background:repeating-linear-gradient(90deg,${bundle.brand.accent} 0 12px,transparent 12px 24px);clip-path:polygon(0 45%,10% 45%,10% 20%,20% 20%,20% 70%,30% 70%,30% 5%,40% 5%,40% 85%,50% 85%,50% 30%,60% 30%,60% 63%,70% 63%,70% 10%,80% 10%,80% 77%,90% 77%,90% 42%,100% 42%,100% 100%,0 100%)}.fl-art-play{position:absolute;left:48%;top:27%;display:grid;place-items:center;width:${portrait ? 110 : 94}px;height:${portrait ? 110 : 94}px;border:3px solid ${bundle.brand.foreground};border-radius:50%;background:#111d;font-size:${portrait ? 42 : 35}px;color:${bundle.brand.accent};box-shadow:0 0 50px #000c}.fl-art-screen-label{position:absolute;left:22px;bottom:20px;padding:10px 15px;background:#09090Bde;font-size:${portrait ? 25 : 24}px;font-weight:800;letter-spacing:.08em;color:${bundle.brand.accent}}
.fl-art-timeline{height:${portrait ? 130 : 80}px;padding:16px 20px;border:2px solid ${bundle.brand.foreground}5c;background:#0B0B0D;position:relative}.fl-art-ticks{display:flex;gap:7px;height:100%}.fl-art-ticks i{flex:1;background:linear-gradient(135deg,${bundle.brand.accent}7a,${bundle.brand.foreground}35);border:1px solid ${bundle.brand.foreground}4a}.fl-art-ticks i:nth-child(2n){background:linear-gradient(145deg,${bundle.brand.foreground}45,${bundle.brand.accent}45)}.fl-art-playhead{position:absolute;left:20px;top:8px;bottom:8px;width:4px;background:${bundle.brand.accent};box-shadow:0 0 14px ${bundle.brand.accent}}
.fl-artifact-compact{padding:${portrait ? 20 : 14}px;gap:8px}.fl-artifact-compact .fl-art-top,.fl-artifact-compact .fl-art-bottom{font-size:${portrait ? 25 : 16}px}.fl-artifact-compact .fl-art-body{gap:8px}.fl-artifact-compact .fl-art-timeline{height:${portrait ? 66 : 42}px;padding:6px 10px}.fl-artifact-compact .fl-art-bottom{min-height:${portrait ? 42 : 34}px}.fl-artifact-compact .fl-art-play{top:19%;width:${portrait ? 72 : 60}px;height:${portrait ? 72 : 60}px;font-size:${portrait ? 28 : 24}px}.fl-artifact-compact .fl-art-screen-label{font-size:${portrait ? 24 : 15}px;bottom:8px}.fl-artifact-compact .fl-art-action{padding:6px 12px}
.fl-art-bottom{min-height:${portrait ? 75 : 56}px}.fl-art-action{padding:12px 22px;border:2px solid ${bundle.brand.accent};color:${bundle.brand.accent};white-space:nowrap}.fl-art-action-live{background:${bundle.brand.accent};color:${bundle.brand.background}}.fl-art-action b{font-size:1.3em}
${portrait ? '.fl-chrome-bottom{font-size:22px}.fl-art-top{flex-wrap:wrap}.fl-input-top{flex-wrap:wrap}.fl-input-field{font-size:44px}.fl-art-screen-label{max-width:80%}' : ''}
.fl-media{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.fl-media img{display:block;width:100%;height:100%;object-fit:contain}
.fl-panel{background:${bundle.brand.accent};border-radius:24px;min-height:120px;width:100%}.fl-rule-node{min-height:0;border-radius:0}.fl-circle{border-radius:50%;aspect-ratio:1}.fl-overlay{position:relative}.fl-overlay>.fl-node{width:100%;height:100%}.fl-attachment{position:absolute;inset:0}.fl-attachment>.fl-node{width:100%;height:100%}
</style></head><body><div id="root" data-composition-id="main" data-start="0" data-width="${p.width}" data-height="${p.height}" data-fps="${program.fps}" data-duration="${total.toFixed(6)}">${clips.join('')}</div><script src="assets/gsap.min.js"></script><script>const tl=gsap.timeline({paused:true});${timeline.join('')}window.__renderReady=false;document.fonts.ready.then(()=>{for(const el of document.querySelectorAll('.fl-placement>.fl-text[data-fl-fit="wrapThenShrink"]')){const original=parseFloat(getComputedStyle(el).fontSize);const min=22;const fits=()=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1;if(!fits()){let lo=min,hi=original;if(lo>hi){window.__framelangFitError=el.id;console.error('FrameLang text fit failed: '+el.id);return}el.style.fontSize=lo+'px';if(!fits()){window.__framelangFitError=el.id;console.error('FrameLang text fit failed: '+el.id);return}for(let i=0;i<14;i++){const mid=(lo+hi)/2;el.style.fontSize=mid+'px';if(fits())lo=mid;else hi=mid}el.style.fontSize=Math.floor(lo*10)/10+'px'}}window.__timelines['main']=tl;window.__renderReady=true}).catch(error=>{window.__framelangFitError=String(error);console.error('FrameLang text fit failed: '+error)});</script></body></html>`;
}

function verifySvg(bytes, location) {
  if (bytes.length > 1_000_000) fail('reference.svg', location, 'SVG exceeds 1 MB limit');
  const svg = bytes.toString('utf8');
  if (!/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(svg)) fail('reference.svg', location, 'expected standalone SVG');
  const allowed = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask']);
  for (const tag of svg.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)) if (!allowed.has(tag[1].toLowerCase())) fail('reference.svg', location, `unsupported SVG element ${tag[1]}`);
  const stripped = svg.replace(/xmlns(?:\:[\w-]+)?\s*=\s*["'][^"']*["']/gi, '').replace(/url\(\s*#[a-zA-Z0-9_-]+\s*\)/g, '');
  if (/<!|<\?|&|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|\b(?:https?|file|data|javascript):|\burl\s*\(|@import/i.test(stripped)) fail('reference.svg', location, 'SVG contains executable or external content');
}

export async function loadProgram(programPath) {
  const source = await readFile(programPath, 'utf8');
  const authored = JSON.parse(source);
  let program = authored;
  let inputDir = path.dirname(path.resolve(programPath));
  let recipe = null;
  if (authored.recipe !== undefined && authored.language === undefined) {
    keys(authored, ['recipe', 'hook', 'assembly', 'handoff'], ['recipe', 'hook', 'assembly', 'handoff'], '$');
    const recipeDirs = { 'makemydemo-workflow/v1': 'makemydemo-cinematic', 'makemydemo-workflow/v2': 'makemydemo-editorial' };
    if (!(authored.recipe in recipeDirs)) fail('syntax.recipe', '$.recipe', 'unknown vetted recipe');
    const fields = ['hook', 'assembly', 'handoff'];
    const limits = { hook: 32, assembly: 36, handoff: 30 };
    for (const field of fields) plainText(authored[field], `$.${field}`, limits[field]);
    if (!/\bpublic\b/i.test(authored.hook) || !/\burl\b/i.test(authored.hook)) fail('semantic.copy', '$.hook', 'hook must identify a public URL');
    if (!/script/i.test(authored.assembly) || !/visual/i.test(authored.assembly) || !/music/i.test(authored.assembly)) fail('semantic.copy', '$.assembly', 'assembly must name script, visuals, and music');
    if (!/review/i.test(authored.handoff) || /export|mp4/i.test(authored.handoff)) fail('semantic.copy', '$.handoff', 'handoff must cover review; the fixed accent covers MP4 export');
    inputDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples', recipeDirs[authored.recipe]);
    program = JSON.parse(await readFile(path.join(inputDir, 'program.json'), 'utf8'));
    for (const [sceneId, lead] of [
      ['source', 'hook'],
      ['assembly', 'assembly'],
      ['delivery', 'handoff'],
    ]) {
      const scene = program.scenes.find(item => item.id === sceneId);
      const headline = scene.content.find(item => item.id === 'headline');
      headline.segments[0].text = authored[lead];
    }
    recipe = { id: authored.recipe, inputHash: hash(canonical(authored)), templateHash: hash(canonical(JSON.parse(await readFile(path.join(inputDir, 'program.json'), 'utf8')))) };
  }
  const bundlePath = path.join(inputDir, 'bundle.json');
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  return { authored, program, inputDir, recipe, bundle };
}

export async function compile(programPath, outDir) {
  const { authored, program, inputDir, recipe, bundle } = await loadProgram(programPath);
  validate(program, bundle);
  await mkdir(outDir, { recursive: true });
  await rm(path.join(outDir, 'feedback.json'), { force: true });
  const gsapPath = require.resolve('gsap/dist/gsap.min.js');
  const fontPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts', 'Inter.ttf');
  const outputs = {};
  for (const profile of program.profiles) {
    const target = path.join(outDir, profile);
    await mkdir(path.join(target, 'assets'), { recursive: true });
    const html = htmlFor(program, bundle, profile);
    await writeFile(path.join(target, 'index.html'), html);
    await copyFile(gsapPath, path.join(target, 'assets', 'gsap.min.js'));
    await copyFile(fontPath, path.join(target, 'assets', 'Inter.ttf'));
    outputs[profile] = { directory: profile, htmlHash: hash(html), assetHashes: {} };
    for (const scene of program.scenes) for (const node of scene.content) if (node.kind === 'productState' || node.kind === 'svg') {
      const item = bundle.assets[node.kind === 'svg' ? node.assetRef : node.stateRef];
      const ref = node.kind === 'svg' ? node.assetRef : node.stateRef;
      if (!item || typeof item.path !== 'string' || !item.path.startsWith('assets/')) fail('reference.asset', ref, 'invalid asset path');
      const absolute = path.resolve(inputDir, item.path);
      if (!absolute.startsWith(inputDir + path.sep)) fail('reference.asset', ref, 'asset escapes input directory');
      const bytes = await readFile(absolute);
      if (hash(bytes) !== item.sha256) fail('reference.asset', ref, 'asset digest mismatch');
      verifySvg(bytes, ref);
      await copyFile(absolute, path.join(target, 'assets', `${scene.id}-${node.id}.svg`));
    }
    const stagedFiles = ['gsap.min.js', 'Inter.ttf', ...program.scenes.flatMap(scene => scene.content
      .filter(node => node.kind === 'productState' || node.kind === 'svg').map(node => `${scene.id}-${node.id}.svg`))];
    for (const file of stagedFiles) outputs[profile].assetHashes[file] = hash(await readFile(path.join(target, 'assets', file)));
  }
  const sourceMap = Object.fromEntries(program.scenes.flatMap((scene, sceneIndex) =>
    scene.content.map((node, nodeIndex) => [`#${cssId(scene, node.id)}`, {
      sceneId: scene.id, nodeId: node.id,
      location: `$.scenes[${sceneIndex}].content[${nodeIndex}]`,
      layoutLocations: Object.fromEntries(program.profiles.map(profile =>
        [profile, `$.scenes[${sceneIndex}].layouts.${scene.layouts[profile] ? profile : 'default'}`])),
    }])));
  const report = { language: program.language, pilot: true, inputHash: hash(canonical(authored)), expandedHash: hash(canonical(program)), recipe, verification: program.verification ? { ...program.verification, fps: program.fps, totalFrames: program.scenes.reduce((total, scene) => total + scene.durationFrames, 0) } : null, bundleRefs: bundleRefs(bundle), sourceMap, outputs, checked: false, degraded: false };
  await writeFile(path.join(outDir, 'compile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export { PROFILE };
