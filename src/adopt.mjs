import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, lstat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function walk(node, visit) { visit(node); for (const child of node.childNodes || []) walk(child, visit); if (node.content) walk(node.content, visit); }
export async function assetInventory(dir, prefix = '') {
  const result = [];
  for (const name of await readdir(dir)) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const file = path.join(dir, name), stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error(`asset symlinks are unsupported: ${relative}`);
    if (stat.isDirectory()) result.push(...await assetInventory(file, relative));
    else if (stat.isFile()) result.push({ file, relative });
    else throw new Error(`unsupported asset: ${relative}`);
  }
  return result;
}

// Trusted authoring only. This parser checks packaging, not JavaScript security.
// Browser checks determine admission; no source rewriting or model call occurs.
export async function adopt(sourceDir, outDir) {
  const source = path.resolve(sourceDir), output = path.resolve(outDir);
  if (output === source || output.startsWith(source + path.sep)) throw new Error('output must be outside the source directory');
  if ((await lstat(source)).isSymbolicLink()) throw new Error('source directory symlinks are unsupported');
  const htmlFile = path.join(source, 'index.html');
  if ((await lstat(htmlFile)).isSymbolicLink()) throw new Error('HTML symlinks are unsupported');
  const bytes = await readFile(htmlFile), html = bytes.toString('utf8');
  const document = parse(html, { sourceCodeLocationInfo: true });
  const nodes = []; walk(document, node => nodes.push(node));
  const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
  const roots = nodes.filter(node => attr(node, 'id') === 'root');
  if (roots.length !== 1) throw new Error('exactly one #root composition is required');
  const root = roots[0];
  const width = Number(attr(root, 'data-width')), height = Number(attr(root, 'data-height'));
  const fps = Number(attr(root, 'data-fps')), duration = Number(attr(root, 'data-duration'));
  const totalFrames = Math.round(fps * duration);
  if (![width, height].every(n => Number.isInteger(n) && n >= 16 && n <= 4096) || !Number.isInteger(fps) || fps < 1 || fps > 60 || !(duration > 0) || totalFrames < 1 || totalFrames > 18000 || Math.abs(totalFrames - fps * duration) > 1e-6) throw new Error('explicit dimensions, fps and a whole-frame duration are required (max 18000 frames)');
  if (!attr(root, 'data-composition-id')) throw new Error('root data-composition-id is required');
  if ((await lstat(path.join(source, 'assets'))).isSymbolicLink()) throw new Error('assets directory symlinks are unsupported');
  const localAssets = await assetInventory(path.join(source, 'assets')); 
  const available = new Set(localAssets.map(a => `assets/${a.relative}`));
  function reference(value) {
    if (value.startsWith('#')) return;
    if (!available.has(value)) throw new Error(`resource must name a packaged local asset: ${value}`);
  }
  for (const node of nodes) {
    if (['iframe', 'object', 'embed', 'base'].includes(node.tagName)) throw new Error(`unsupported embedded resource: ${node.tagName}`);
    for (const name of ['src', 'href', 'poster', 'xlink:href']) { const value = attr(node, name); if (value !== undefined) reference(value); }
    if (attr(node, 'srcset') !== undefined) throw new Error('srcset is unsupported; package an explicit asset');
  }
  // Packaging scan only, not a security filter. Dynamic JS requests are outside
  // this trusted-source contract; do not expose this command to untrusted users.
  for (const match of html.matchAll(/url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/gi)) reference(match[1] ?? match[2]);
  if (/@import\b/i.test(html)) throw new Error('inline stylesheet imports are unsupported');
  for (const asset of localAssets) {
    if (!/\.(css|svg)$/i.test(asset.relative)) continue;
    const text = await readFile(asset.file, 'utf8');
    const localReference = value => {
      if (value.startsWith('#')) return;
      const resolved = path.posix.normalize(path.posix.join('assets', path.posix.dirname(asset.relative), value));
      if (/^(?:[a-z]+:|\/)/i.test(value) || !available.has(resolved)) throw new Error(`resource in ${asset.relative} must name a packaged local asset: ${value}`);
    };
    if (/@import\b/i.test(text)) throw new Error(`stylesheet imports are unsupported: ${asset.relative}`);
    for (const match of text.matchAll(/url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/gi)) localReference(match[1] ?? match[2]);
    if (/\.svg$/i.test(asset.relative)) walk(parse(text), node => { for (const name of ['src', 'href', 'poster', 'xlink:href']) {const value=attr(node,name);if(value!==undefined)localReference(value);} });
  }
  const sourceMap = {};
  for (const node of nodes) {
    const id = attr(node, 'id');
    if (id && /^[a-zA-Z_][\w-]*$/.test(id) && node.sourceCodeLocation) sourceMap[`#${id}`] = { nodeId: id, location: `index.html:${node.sourceCodeLocation.startLine}` };
  }
  await mkdir(output, { recursive: false });
  const profile = `source-${width}x${height}`, target = path.join(output, profile);
  await mkdir(path.join(target, 'assets'), { recursive: true });
  await writeFile(path.join(target, 'index.html'), bytes);
  const assetHashes = {};
  for (const asset of localAssets) {
    const destination = path.join(target, 'assets', asset.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(asset.file, destination);
    assetHashes[asset.relative] = digest(await readFile(destination));
  }
  const report = { language: 'framelang/trusted-hyperframes-v0.1', sourceLanguage: 'hyperframes/html', pilot: true, guarantees: 'source-preserving, measured frame checks; trusted JavaScript, no deterministic or security guarantee', inputHash: digest(bytes), verification: { mode: 'allFrames', fps, totalFrames }, sourceMap, outputs: { [profile]: { directory: profile, htmlHash: digest(bytes), assetHashes } }, checked: false, degraded: false };
  await writeFile(path.join(output, 'compile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
