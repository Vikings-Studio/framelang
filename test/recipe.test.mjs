import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, FrameLangError } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recipePath = path.join(root, 'examples/makemydemo-recipe.json');
const fullPath = path.join(root, 'examples/makemydemo-cinematic/program.json');

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
