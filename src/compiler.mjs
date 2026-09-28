import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PROFILE = Object.freeze({
  'landscape-1920x1080': { width: 1920, height: 1080, insetX: 120, insetY: 96, heading: 104, body: 48 },
  'portrait-1080x1920': { width: 1080, height: 1920, insetX: 72, insetY: 96, heading: 88, body: 50 },
});
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const SHA = /^sha256:[0-9a-f]{64}$/;
const SCENE_KEYS = ['id', 'role', 'blueprint', 'durationFrames', 'essential', 'content', 'layouts', 'initialState', 'resolvedState', 'states', 'events'];
const DOCUMENT_KEYS = ['language', 'fps', 'profiles', 'brandRef', 'assetsRef', 'seed', 'scenes'];

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
    default: fail('syntax.layout', location, `unsupported layout ${tree.type}`);
  }
}

export function validate(program, bundle) {
  keys(program, DOCUMENT_KEYS, DOCUMENT_KEYS, '$');
  if (program.language !== 'framelang/v1') fail('syntax.version', '$.language', 'expected framelang/v1');
  if (program.fps !== 24) fail('syntax.fps', '$.fps', 'pilot supports 24 fps');
  int(program.seed, '$.seed', 0, 4294967295);
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
    keys(scene, SCENE_KEYS, SCENE_KEYS, at);
    identifier(scene.id, `${at}.id`);
    if (!['hook', 'feature_showcase', 'benefit_highlight', 'cta', 'branding'].includes(scene.role)) fail('syntax.role', `${at}.role`, 'unsupported pilot role');
    if (!['type-reveal/v1', 'product-reveal/v1', 'before-after/v1'].includes(scene.blueprint)) fail('syntax.blueprint', `${at}.blueprint`, 'unsupported pilot blueprint');
    int(scene.durationFrames, `${at}.durationFrames`, 48, 288);
    const nodes = list(scene.content, `${at}.content`, 1);
    unique(nodes.map(n => n.id), `${at}.content`);
    const byId = new Map();
    for (const [i, node] of nodes.entries()) {
      const na = `${at}.content[${i}]`;
      identifier(node.id, `${na}.id`);
      if (!['essential', 'supporting', 'decorative'].includes(node.importance)) fail('syntax.importance', na, 'invalid importance');
      if (node.kind === 'text') {
        keys(node, ['id', 'kind', 'importance', 'role', 'language', 'text', 'fit'], ['id', 'kind', 'importance', 'role', 'language', 'text', 'fit'], na);
        if (!['headline', 'body', 'label'].includes(node.role) || node.fit !== 'wrapThenShrink') fail('syntax.text', na, 'unsupported text role or fit');
        if (typeof node.text !== 'string' || !node.text.trim() || node.text.length > 240 || /[<>]/.test(node.text)) fail('syntax.text', `${na}.text`, 'nonempty plain text up to 240 characters required');
        if (node.language !== 'en') fail('syntax.text', `${na}.language`, 'pilot supports English only');
      } else if (node.kind === 'productState') {
        keys(node, ['id', 'kind', 'importance', 'stateRef'], ['id', 'kind', 'importance', 'stateRef'], na);
        const asset = bundle.assets?.[node.stateRef];
        if (!asset) fail('reference.asset', `${na}.stateRef`, `missing ${node.stateRef}`);
        if (asset.kind !== 'productState' || asset.displayAllowed !== true || !SHA.test(asset.sha256 || '')) fail('reference.asset', `${na}.stateRef`, 'asset is not a verified displayable product state');
      } else if (node.kind === 'shape') {
        keys(node, ['id', 'kind', 'importance', 'primitive'], ['id', 'kind', 'importance', 'primitive'], na);
        if (node.primitive !== 'panel') fail('syntax.shape', na, 'pilot supports panel only');
      } else fail('syntax.node', na, `unsupported node ${node.kind}`);
      byId.set(node.id, node);
    }
    const essentials = list(scene.essential, `${at}.essential`);
    unique(essentials, `${at}.essential`);
    if (canonical(essentials.slice().sort()) !== canonical(nodes.filter(n => n.importance === 'essential').map(n => n.id).sort())) fail('semantic.essential', `${at}.essential`, 'must equal essential content IDs');
    object(scene.layouts, `${at}.layouts`);
    for (const profile of program.profiles) {
      const tree = scene.layouts[profile] ?? scene.layouts.default;
      if (!tree) fail('semantic.profile', `${at}.layouts`, `missing layout for ${profile}`);
      const seen = [];
      layoutRefs(tree, `${at}.layouts.${profile}`, byId, seen);
      unique(seen, `${at}.layouts.${profile}`);
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
      keys(event, ['atFrame', 'durationFrames', 'effect', 'target', 'from', 'to'], ['atFrame', 'durationFrames', 'effect'], ea);
      int(event.atFrame, `${ea}.atFrame`, 0, scene.durationFrames - 1);
      int(event.durationFrames, `${ea}.durationFrames`, 1, scene.durationFrames);
      if (event.atFrame < latest || event.atFrame + event.durationFrames > scene.durationFrames) fail('semantic.timing', ea, 'events out of order or past scene end');
      latest = event.atFrame;
      if (event.effect === 'appear') {
        if (!byId.has(event.target)) fail('reference.node', ea, 'appear target missing');
        if (initialVisible.includes(event.target) || !resolvedVisible.includes(event.target)) fail('semantic.state', ea, 'appear target must enter between initial and resolved');
        if (written.has(event.target)) fail('semantic.motion', ea, 'node receives multiple writes');
        written.add(event.target);
      } else if (event.effect === 'replace') {
        if (event.from !== scene.initialState || event.to !== scene.resolvedState) fail('reference.state', ea, 'pilot replace must connect initial to resolved');
        for (const id of [...initialVisible, ...resolvedVisible]) {
          if (written.has(id)) fail('semantic.motion', ea, 'node receives multiple writes');
          written.add(id);
        }
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
function renderTree(tree, scene, profile, nodes, initial) {
  if (typeof tree === 'string') {
    const node = nodes.get(tree);
    const id = cssId(scene, tree);
    const hidden = initial.includes(tree) ? '' : ' style="opacity:0"';
    if (node.kind === 'text') return `<div id="${id}" class="fl-node fl-text fl-${node.role}"${hidden}>${escapeHtml(node.text)}</div>`;
    if (node.kind === 'shape') return `<div id="${id}" class="fl-node fl-panel"${hidden}></div>`;
    return `<div id="${id}" class="fl-node fl-media"${hidden}><img src="assets/${scene.id}-${node.id}.svg" alt="" /></div>`;
  }
  if (tree.type === 'stack') return `<div class="fl-layout fl-stack" style="flex-direction:${tree.direction};gap:${gap(tree.gap)}px">${tree.children.map(n => renderTree(n, scene, profile, nodes, initial)).join('')}</div>`;
  if (tree.type === 'split') {
    const [a, b] = tree.ratio.split(':').map(n => Number(n) / 10);
    return `<div class="fl-layout fl-split" style="grid-template-columns:${a}fr ${b}fr">${renderTree(tree.left, scene, profile, nodes, initial)}${renderTree(tree.right, scene, profile, nodes, initial)}</div>`;
  }
  return `<div class="fl-layout fl-overlay">${renderTree(tree.base, scene, profile, nodes, initial)}${tree.attachments.map(a => `<div class="fl-attachment">${renderTree(a.node, scene, profile, nodes, initial)}</div>`).join('')}</div>`;
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
    const body = renderTree(tree, scene, profile, nodes, initial);
    clips.push(`<section class="clip" id="fl-${scene.id}" data-start="${start.toFixed(6)}" data-duration="${duration.toFixed(6)}" data-track-index="${i}"><div class="fl-scene">${body}</div></section>`);
    for (const event of scene.events) {
      const at = (cursor + event.atFrame) / program.fps;
      const dur = event.durationFrames / program.fps;
      if (event.effect === 'appear') timeline.push(`tl.fromTo('#${cssId(scene, event.target)}',{opacity:0,y:24},{opacity:1,y:0,duration:${dur.toFixed(6)},ease:'power2.out'},${at.toFixed(6)});`);
      if (event.effect === 'replace') {
        const oldIds = scene.states.find(s => s.id === event.from).visible.filter(id => !scene.states.find(s => s.id === event.to).visible.includes(id));
        const newIds = scene.states.find(s => s.id === event.to).visible.filter(id => !scene.states.find(s => s.id === event.from).visible.includes(id));
        const switchAt = at + dur / 2;
        for (const id of oldIds) timeline.push(`tl.set('#${cssId(scene, id)}',{opacity:0},${switchAt.toFixed(6)});`);
        for (const id of newIds) timeline.push(`tl.set('#${cssId(scene, id)}',{opacity:1},${switchAt.toFixed(6)});`);
      }
    }
    cursor += scene.durationFrames;
  }
  const total = cursor / program.fps;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${p.width},height=${p.height}"><title>${escapeHtml(bundle.brand.name)}</title><style>
@font-face{font-family:FrameLangInter;src:url('assets/Inter.ttf') format('truetype');font-style:normal;font-weight:100 900;font-display:block}
html,body{margin:0;width:${p.width}px;height:${p.height}px;background:${bundle.brand.background}}
*{box-sizing:border-box}#root{width:${p.width}px;height:${p.height}px;position:relative;overflow:hidden;background:${bundle.brand.background}}
.clip{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;isolation:isolate}
.fl-scene{position:absolute;left:${p.insetX}px;right:${p.insetX}px;top:${p.insetY}px;bottom:${p.insetY}px;display:flex;min-width:0;min-height:0;align-items:center;justify-content:center}
.fl-layout{width:100%;height:100%;min-width:0;min-height:0}.fl-stack{display:flex;justify-content:center;align-items:center}.fl-split{display:grid;align-items:center;gap:48px}
.fl-node{min-width:0;max-width:100%}.fl-text{font-family:FrameLangInter,sans-serif;color:${bundle.brand.foreground};overflow-wrap:anywhere;line-height:1.05;font-weight:700}
.fl-headline{font-size:${p.heading}px;letter-spacing:-.045em}.fl-body{font-size:${p.body}px;line-height:1.2;font-weight:500}.fl-label{font-size:${Math.round(p.body*.75)}px;color:${bundle.brand.accent};text-transform:uppercase;letter-spacing:.08em}
.fl-media{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.fl-media img{display:block;width:100%;height:100%;object-fit:contain}
.fl-panel{background:${bundle.brand.accent};border-radius:24px;min-height:120px;width:100%}.fl-overlay{position:relative}.fl-overlay>.fl-node{width:100%;height:100%}.fl-attachment{position:absolute;inset:0}.fl-attachment>.fl-node{width:100%;height:100%}
</style></head><body><div id="root" data-composition-id="main" data-start="0" data-width="${p.width}" data-height="${p.height}" data-fps="${program.fps}" data-duration="${total.toFixed(6)}">${clips.join('')}</div><script src="assets/gsap.min.js"></script><script>const tl=gsap.timeline({paused:true});${timeline.join('')}window.__timelines['main']=tl;window.__renderReady=true;</script></body></html>`;
}

export async function compile(programPath, outDir) {
  const source = await readFile(programPath, 'utf8');
  const program = JSON.parse(source);
  const inputDir = path.dirname(path.resolve(programPath));
  const bundlePath = path.join(inputDir, 'bundle.json');
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  validate(program, bundle);
  await mkdir(outDir, { recursive: true });
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
    for (const scene of program.scenes) for (const node of scene.content) if (node.kind === 'productState') {
      const item = bundle.assets[node.stateRef];
      if (!item || typeof item.path !== 'string' || !item.path.startsWith('assets/')) fail('reference.asset', node.stateRef, 'invalid asset path');
      const absolute = path.resolve(inputDir, item.path);
      if (!absolute.startsWith(inputDir + path.sep)) fail('reference.asset', node.stateRef, 'asset escapes input directory');
      const bytes = await readFile(absolute);
      if (hash(bytes) !== item.sha256) fail('reference.asset', node.stateRef, 'asset digest mismatch');
      await copyFile(absolute, path.join(target, 'assets', `${scene.id}-${node.id}.svg`));
    }
    const stagedFiles = ['gsap.min.js', 'Inter.ttf', ...program.scenes.flatMap(scene => scene.content
      .filter(node => node.kind === 'productState').map(node => `${scene.id}-${node.id}.svg`))];
    for (const file of stagedFiles) outputs[profile].assetHashes[file] = hash(await readFile(path.join(target, 'assets', file)));
  }
  const report = { language: program.language, pilot: true, inputHash: hash(canonical(program)), bundleRefs: bundleRefs(bundle), outputs, checked: false, degraded: false };
  await writeFile(path.join(outDir, 'compile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export { PROFILE };
