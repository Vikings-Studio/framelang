import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, FrameLangError, validate } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'examples/makemydemo-cinematic');
const program = JSON.parse(await readFile(path.join(example, 'program.json'), 'utf8'));
const bundle = JSON.parse(await readFile(path.join(example, 'bundle.json'), 'utf8'));
const clone = value => structuredClone(value);

test('expressive example compiles gradients, positioned content, staged SVG and tween for both profiles', async () => {
  assert.equal(validate(program, bundle), true);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-expressive-'));
  try {
    const report = await compile(path.join(example, 'program.json'), dir);
    assert.equal(Object.keys(report.outputs).length, 2);
    for (const profile of program.profiles) {
      const html = await readFile(path.join(dir, profile, 'index.html'), 'utf8');
      assert.match(html, /radial-gradient\(/);
      assert.match(html, /class="fl-layout fl-canvas"/);
      assert.match(html, /source-mark\.svg/);
      assert.match(html, /rotation/);
      assert.match(report.outputs[profile].assetHashes['source-mark.svg'], /^sha256:[0-9a-f]{64}$/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('canvas refuses out-of-bounds and undeclared overlap', () => {
  const changed = clone(program);
  changed.scenes[0].layouts['landscape-1920x1080'].children[0].rect = [900, 0, 200, 100];
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'semantic.bounds');
  const overlapping = clone(program);
  const placements = overlapping.scenes[0].layouts['landscape-1920x1080'].children;
  placements[1].rect = clone(placements[0].rect);
  placements[1].overlap = 'avoid';
  placements[0].overlap = 'avoid';
  assert.throws(() => validate(overlapping, bundle), e => e instanceof FrameLangError && e.code === 'semantic.overlap');
});

test('paint and tween values are constrained before rendering', () => {
  const badPaint = clone(program);
  badPaint.scenes[0].design.background.stops[1].at = 0;
  assert.throws(() => validate(badPaint, bundle), e => e instanceof FrameLangError && e.code === 'syntax.paint');
  const badTween = clone(program);
  const tween = badTween.scenes[0].events.find(event => event.effect === 'tween');
  tween.to.scale = Number.POSITIVE_INFINITY;
  assert.throws(() => validate(badTween, bundle), e => e instanceof FrameLangError && e.code === 'syntax.motion');
});

test('unsafe SVG is rejected even when its declared hash matches', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-svg-'));
  try {
    const unsafe = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const assetsDir = path.join(dir, 'assets');
    await (await import('node:fs/promises')).mkdir(assetsDir);
    await writeFile(path.join(assetsDir, 'mark.svg'), unsafe);
    const { createHash } = await import('node:crypto');
    const copiedBundle = clone(bundle);
    copiedBundle.assets['orbit-mark'].path = 'assets/mark.svg';
    copiedBundle.assets['orbit-mark'].sha256 = `sha256:${createHash('sha256').update(unsafe).digest('hex')}`;
    const { bundleRefs } = await import('../src/compiler.mjs');
    const copiedProgram = clone(program);
    Object.assign(copiedProgram, bundleRefs(copiedBundle));
    await writeFile(path.join(dir, 'bundle.json'), JSON.stringify(copiedBundle));
    await writeFile(path.join(dir, 'program.json'), JSON.stringify(copiedProgram));
    await assert.rejects(() => compile(path.join(dir, 'program.json'), path.join(dir, 'out')), e => e instanceof FrameLangError && e.code === 'reference.svg');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
