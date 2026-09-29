import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, FrameLangError, validate } from '../src/compiler.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'examples/makemydemo-editorial');
const program = JSON.parse(await readFile(path.join(example, 'model-options.json'), 'utf8'));
const bundle = JSON.parse(await readFile(path.join(example, 'bundle.json'), 'utf8'));

test('model options compile layered alpha gradients, typography, rules, and keyframes in both profiles', async () => {
  assert.equal(validate(program, bundle), true);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-options-'));
  try {
    const report = await compile(path.join(example, 'model-options.json'), dir);
    assert.equal(Object.keys(report.outputs).length, 2);
    for (const profile of program.profiles) {
      const html = await readFile(path.join(dir, profile, 'index.html'), 'utf8');
      assert.match(html, /radial-gradient\(circle at 75% 18%,#DFE10438/);
      assert.match(html, /linear-gradient\(132deg/);
      assert.match(html, /letter-spacing:\.3em/);
      assert.match(html, /line-height:\.98/);
      assert.match(html, /fl-rule-node/);
      assert.match(html, /scaleX/);
      assert.match(html, /rotation/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('model options reject unbounded paint, typography, shape, and keyframe values', () => {
  const changed = structuredClone(program);
  const source = changed.scenes[0];
  const expect = code => assert.throws(() => validate(changed, bundle), error => error instanceof FrameLangError && error.code === code);
  source.design.background.layers[0].stops[0].opacity = 101;
  expect('syntax.integer');
  source.design.background.layers[0].stops[0].opacity = 22;
  source.content.find(node => node.id === 'headline').style.tracking = 'arbitrary';
  expect('syntax.text');
  source.content.find(node => node.id === 'headline').style.tracking = 'tight';
  source.content.find(node => node.id === 'accent-rule').stroke = { color: 'accent', width: 13 };
  expect('syntax.integer');
  source.content.find(node => node.id === 'accent-rule').stroke.width = 2;
  source.events[0].frames[1].atFrame = 0;
  expect('syntax.motion');
  source.events[0].frames[1].atFrame = 24;
  source.events[0].frames[1].value = { rotation: 8 };
  expect('syntax.motion');
});
