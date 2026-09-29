import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, validate, FrameLangError } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recipePath = path.join(root, 'examples/makemydemo-recipe.json');
const fullPath = path.join(root, 'examples/makemydemo-cinematic/program.json');
const recipeV2Path = path.join(root, 'examples/makemydemo-recipe-v2.json');
const fullV2Path = path.join(root, 'examples/makemydemo-editorial/program.json');

test('compact recipe expands to the same verified two-profile video as its full scene program', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-recipe-'));
  try {
    const compact = await compile(recipePath, path.join(dir, 'compact'));
    const full = await compile(fullPath, path.join(dir, 'full'));
    assert.equal(compact.recipe.id, 'makemydemo-workflow/v1');
    assert.equal(compact.expandedHash, full.expandedHash);
    assert.deepEqual(compact.outputs, full.outputs);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('editorial recipe preserves the model copy while compiling rich, bounded scenes in both profiles', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-editorial-'));
  try {
    const compact = await compile(recipeV2Path, path.join(dir, 'compact'));
    const full = await compile(fullV2Path, path.join(dir, 'full'));
    assert.equal(compact.recipe.id, 'makemydemo-workflow/v2');
    assert.equal(compact.verification.mode, 'allFrames');
    assert.equal(compact.verification.totalFrames, 276);
    assert.equal(compact.expandedHash, full.expandedHash);
    assert.deepEqual(compact.outputs, full.outputs);
    for (const profile of Object.keys(compact.outputs)) {
      const html = await readFile(path.join(dir, 'compact', profile, 'index.html'), 'utf8');
      assert.match(html, /fl-flow-chain/);
      assert.match(html, /fl-tone-accentBlock/);
      assert.match(html, /data-fl-fit="wrapThenShrink"/);
      assert.match(html, /window\.__framelangFitError/);
      assert.match(html, /left:0%;top:47\.5%;width:61%;height:38\.5%|left:0%;top:38\.5%;width:100%;height:39%/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('relative placement rejects missing anchors, out-of-bounds boxes and text-on-text overlap', async () => {
    const program = JSON.parse(await readFile(fullV2Path, 'utf8'));
    const bundle = JSON.parse(await readFile(path.join(root, 'examples/makemydemo-editorial/bundle.json'), 'utf8'));
    const input = program.scenes[0].layouts['landscape-1920x1080'].children[2];
    function expectFailure(expected) { assert.throws(() => validate(program, bundle), error => error instanceof FrameLangError && error.code === expected); }
    input.relative.to = 'missing';
    expectFailure('reference.layout');
    input.relative.to = 'headline';
    input.relative.gap = 500;
    expectFailure('semantic.bounds');
    input.relative.gap = 45;
    const subline = program.scenes[0].layouts['landscape-1920x1080'].children[3];
    subline.rect = [100, 100, 350, 130];
    subline.overlap = 'intentional';
    program.scenes[0].layouts['landscape-1920x1080'].children[1].overlap = 'intentional';
    expectFailure('semantic.overlap');
});

test('recipe rejects unknown fields and unsupported copy before output', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-recipe-bad-'));
  try {
    const original = JSON.parse(await readFile(recipePath, 'utf8'));
    original.hook = '<script>unsupported</script>';
    const pathBad = path.join(dir, 'bad.json');
    await writeFile(pathBad, JSON.stringify(original));
    await assert.rejects(() => compile(pathBad, path.join(dir, 'out')), error => error instanceof FrameLangError && error.code === 'syntax.text');
    original.hook = 'One public URL.';
    original.layout = 'arbitrary';
    await writeFile(pathBad, JSON.stringify(original));
    await assert.rejects(() => compile(pathBad, path.join(dir, 'out')), error => error instanceof FrameLangError && error.code === 'syntax.field');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('recipe rejects missing product facts and duplicated export copy', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-recipe-claims-'));
  try {
    const original = JSON.parse(await readFile(recipePath, 'utf8'));
    const programPath = path.join(dir, 'copy.json');
    for (const [field, value] of [['hook', 'Paste a product URL.'], ['assembly', 'A script and visuals.'], ['handoff', 'Review and export MP4.']]) {
      const changed = { ...original, [field]: value };
      await writeFile(programPath, JSON.stringify(changed));
      await assert.rejects(() => compile(programPath, path.join(dir, 'out')), error => error instanceof FrameLangError && error.code === 'semantic.copy');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
