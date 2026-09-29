import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { adopt } from '../src/adopt.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const html = `<div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-fps="24" data-duration="8"><svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg><b id="title">Hi</b></div><script src="assets/gsap.min.js"></script>`;
async function fixture(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-adopt-'));
  try { const source = path.join(dir, 'source'); await mkdir(path.join(source, 'assets'), {recursive:true}); await writeFile(path.join(source, 'index.html'), html); await writeFile(path.join(source, 'assets/gsap.min.js'), 'fixture'); await fn(source, dir); } finally { await rm(dir, {recursive:true,force:true}); }
}
test('trusted adoption preserves source bytes, sealed assets and all-frame verification', () => fixture(async(source,dir) => {
  const output=path.join(dir,'out'), report=await adopt(source,output);
  assert.equal(report.checked,false);
  assert.equal(report.verification.totalFrames,192);
  assert.deepEqual(await readFile(path.join(output,'source-1920x1080/index.html')),await readFile(path.join(source,'index.html')));
  assert.ok(report.outputs['source-1920x1080'].assetHashes['gsap.min.js']);
  assert.equal(report.sourceMap['#title'].location,'index.html:1');
  assert.match(report.guarantees,/no deterministic or security guarantee/);
}));
test('adoption rejects missing assets, external references and malformed timeline metadata', async () => {
  for (const bad of [html.replace('assets/gsap.min.js','assets/missing.js'), html.replace('assets/gsap.min.js','https://example.org/a.js'), html.replace('data-fps="24"','data-fps="0"'),html.replace('data-duration="8"','data-duration="0"'),html.replace('data-duration="8"','data-duration="0.000000001"'),html.replace('data-duration="8"','data-duration="8.01"')]) await fixture(async(source,dir) => {await writeFile(path.join(source,'index.html'),bad);await assert.rejects(adopt(source,path.join(dir,'out')));});
});
test('adoption rejects symlinked inputs and output inside the source', () => fixture(async(source,dir) => {
  await assert.rejects(adopt(source,path.join(source,'out')),/outside/);
  if (process.platform === 'win32') return; // File symlinks require an OS privilege; coverage runs on Mac/Linux.
  await symlink(path.join(source,'assets/gsap.min.js'),path.join(source,'assets/linked.js'));
  await assert.rejects(adopt(source,path.join(dir,'out')),/symlinks/);
}));

test('transitive CSS and SVG references must resolve to packaged local assets', () => fixture(async(source,dir) => {
  await writeFile(path.join(source,'assets/theme.css'), 'body{background:url(https://example.org/a.png)}');
  await assert.rejects(adopt(source,path.join(dir,'out')),/packaged local asset/);
  await rm(path.join(source,'assets/theme.css'));
  await writeFile(path.join(source,'assets/icon.svg'), '<svg><image href="missing.png"/></svg>');
  await assert.rejects(adopt(source,path.join(dir,'out')),/packaged local asset/);
}));

test('export rejects newly added assets and modified source before invoking the renderer', () => fixture(async(source,dir) => {
  const out=path.join(dir,'out');
  const cli=fileURLToPath(new URL('../src/cli.mjs',import.meta.url));
  const imported=spawnSync(process.execPath,[cli,'adopt',source,out],{encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);
  await writeFile(path.join(out,'source-1920x1080/assets/added.js'),'change');
  let result=spawnSync(process.execPath,[cli,'render',out],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/asset inventory changed/);
  await rm(path.join(out,'source-1920x1080/assets/added.js'));
  await writeFile(path.join(out,'source-1920x1080/index.html'),html+'changed');
  result=spawnSync(process.execPath,[cli,'render',out],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/HTML changed/);
}));

test('unfinalized API reports cannot bypass the mandatory trusted runtime pin', () => fixture(async(source,dir) => {
 const out=path.join(dir,'out');await adopt(source,out);
 const cli=fileURLToPath(new URL('../src/cli.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[cli,'check',out],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/requires a runtime pin/);
}));
