import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, FrameLangError, validate } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'examples/makemydemo-rich');
const program = JSON.parse(await readFile(path.join(fixture, 'program.json'), 'utf8'));
const bundle = JSON.parse(await readFile(path.join(fixture, 'bundle.json'), 'utf8'));

test('rich process compiles into distinct, seekable landscape and portrait scenes', async () => {
  assert.equal(validate(program, bundle), true);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-rich-'));
  try {
    const report = await compile(path.join(fixture, 'program.json'), dir);
    assert.equal(Object.keys(report.outputs).length, 2);
    for (const profile of program.profiles) {
      const html = await readFile(path.join(dir, profile, 'index.html'), 'utf8');
      assert.match(html, /fl-tone-accent/);
      assert.match(html, /fl-flow-steps/);
      assert.match(html, /data-flow-order="5"/);
      assert.match(html, /fl-grid/);
      assert.match(html, /tl\.fromTo/);
      assert.doesNotMatch(html, /<script src="https?:/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rich content stays typed and bounded', () => {
  const copy = structuredClone(program);
  copy.scenes[1].content[2].steps.push('Unbounded extra step', 'One more');
  assert.throws(() => validate(copy, bundle), e => e instanceof FrameLangError && e.code === 'syntax.flow');
  copy.scenes[1].content[2].steps = ['AI script', 'Visuals', 'Music'];
  copy.scenes[0].content[1].segments[2].text = '<script>alert(1)</script>';
  assert.throws(() => validate(copy, bundle), e => e instanceof FrameLangError && e.code === 'syntax.text');
  copy.scenes[0].content[1].segments[2].text = 'video first cut.';
  copy.scenes[1].events[0].preset = 'stagger';
  assert.throws(() => validate(copy, bundle), e => e instanceof FrameLangError && e.code === 'syntax.motion');
});
