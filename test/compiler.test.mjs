import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, FrameLangError, validate } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const program = JSON.parse(await readFile(path.join(root, 'examples/type-reveal.json'), 'utf8'));
const bundle = JSON.parse(await readFile(path.join(root, 'examples/bundle.json'), 'utf8'));
const clone = value => structuredClone(value);

test('example validates and compiles reproducibly for both profiles', async () => {
  assert.equal(validate(program, bundle), true);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-test-'));
  try {
    const a = await compile(path.join(root, 'examples/type-reveal.json'), path.join(dir, 'a'));
    const b = await compile(path.join(root, 'examples/type-reveal.json'), path.join(dir, 'b'));
    assert.deepEqual(a.outputs, b.outputs);
    assert.equal(Object.keys(a.outputs).length, 2);
    const html = await readFile(path.join(dir, 'a/landscape-1920x1080/index.html'), 'utf8');
    assert.match(html, /data-composition-id="main"/);
    assert.match(html, /assets\/Inter.ttf/);
    assert.doesNotMatch(html, /tl\.set\([^)]*opacity:0/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('duplicate content identity is rejected before generation', () => {
  const changed = clone(program);
  changed.scenes[0].content[1].id = 'eyebrow';
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'semantic.duplicate');
});

test('essential content missing from portrait layout is rejected', () => {
  const changed = clone(program);
  changed.scenes[0].layouts['portrait-1080x1920'] = { type: 'stack', direction: 'column', children: ['eyebrow'] };
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'semantic.layout');
});

test('unrevealed final state and late hold are rejected', () => {
  const changed = clone(program);
  changed.scenes[0].events = [];
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'semantic.state');
  changed.scenes[0].events = [{ atFrame: 86, durationFrames: 8, effect: 'appear', target: 'headline' }];
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'semantic.hold');
});

test('missing or unlicensed product evidence is rejected', () => {
  const changed = clone(program);
  changed.scenes[0].content[1] = { id: 'headline', kind: 'productState', importance: 'essential', stateRef: 'capture:missing' };
  assert.throws(() => validate(changed, bundle), e => e instanceof FrameLangError && e.code === 'reference.asset');
});
