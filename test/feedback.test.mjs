import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lintProgram } from '../src/compiler.mjs';
import { checkFeedback } from '../src/feedback.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'examples/makemydemo-editorial');
const program = JSON.parse(await readFile(path.join(example, 'program.json'), 'utf8'));
const bundle = JSON.parse(await readFile(path.join(example, 'bundle.json'), 'utf8'));

test('lint reports every overlap with node IDs, rectangles, intersection and source locations', () => {
  const bad = structuredClone(program);
  for (const profile of bad.profiles) {
    const placements = bad.scenes[0].layouts[profile].children;
    placements[1].rect = structuredClone(placements[0].rect);
    placements[1].overlap = 'avoid';
  }
  const feedback = lintProgram(bad, bundle);
  assert.equal(feedback.ok, false);
  const overlaps = feedback.findings.filter(finding => finding.code === 'semantic.overlap');
  assert.ok(overlaps.length >= 2);
  assert.deepEqual(new Set(overlaps.map(finding => finding.profile)), new Set(bad.profiles));
  for (const finding of overlaps) {
    assert.equal(finding.sceneId, 'source');
    assert.equal(finding.nodes.length, 2);
    assert.equal(finding.locations.length, 2);
    assert.equal(finding.rects.length, 2);
    assert.ok(finding.intersection[2] > 0 && finding.intersection[3] > 0);
    assert.match(finding.hint, /Move or resize/);
  }
  assert.equal(lintProgram(program, bundle).ok, true);
});

test('lint CLI emits parseable repair feedback and passes after the layout is fixed', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-lint-'));
  try {
    const bad = structuredClone(program);
    bad.scenes[0].layouts['landscape-1920x1080'].children[1].rect = structuredClone(bad.scenes[0].layouts['landscape-1920x1080'].children[0].rect);
    await copyFile(path.join(example, 'bundle.json'), path.join(dir, 'bundle.json'));
    const input = path.join(dir, 'program.json');
    await writeFile(input, JSON.stringify(bad));
    const rejected = spawnSync(process.execPath, [path.join(root, 'src/cli.mjs'), 'lint', input], { encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.equal(JSON.parse(rejected.stdout).findings[0].code, 'semantic.overlap');
    await writeFile(input, JSON.stringify(program));
    const accepted = spawnSync(process.execPath, [path.join(root, 'src/cli.mjs'), 'lint', input], { encoding: 'utf8' });
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).ok, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('browser feedback groups repeated frame findings and resolves selectors to source', () => {
  const finding = { code: 'element_overlap', selector: '#fl-source-headline', message: 'Headline overlaps input', bbox: { x: 20, y: 30, width: 40, height: 50 } };
  const report = { checked: false, sourceMap: { '#fl-source-headline': { sceneId: 'source', nodeId: 'headline', location: '$.scenes[0].content[1]', layoutLocations: { 'landscape-1920x1080': '$.scenes[0].layouts.landscape-1920x1080' } } }, checks: { 'landscape-1920x1080': { ok: false, layoutRan: true, allFramesObserved: true, report: { layout: { findings: [{ ...finding, time: 1 }, { ...finding, time: 1.042 }] }, runtime: { findings: [] } } } } };
  const feedback = checkFeedback(report);
  assert.equal(feedback.ok, false);
  assert.equal(feedback.findings.length, 1);
  assert.equal(feedback.findings[0].nodeId, 'headline');
  assert.equal(feedback.findings[0].occurrences, 2);
  assert.equal(feedback.findings[0].firstTime, 1);
  assert.equal(feedback.findings[0].lastTime, 1.042);
});

test('browser text fit feedback points back to authored node', () => {
  const report = { checked: false, sourceMap: { '#fl-source-headline': { sceneId: 'source', nodeId: 'headline', location: '$.scenes[0].content[1]', layoutLocations: { 'portrait-1080x1920': '$.scenes[0].layouts.portrait-1080x1920' } } }, checks: { 'portrait-1080x1920': { ok: false, layoutRan: true, allFramesObserved: true, report: { layout: { findings: [] }, runtime: { findings: [{ code: 'console_error', severity: 'error', selector: '[data-composition-id]', message: 'FrameLang text fit failed: fl-source-headline' }] } } } } };
  const feedback = checkFeedback(report);
  assert.equal(feedback.findings[0].code, 'geometry.textFit');
  assert.equal(feedback.findings[0].nodeId, 'headline');
  assert.match(feedback.findings[0].hint, /Shorten this text/);
});


test('contrast feedback exposes the measured finding and authored location to a repair model', () => {
  const report = { checked: false, sourceMap: { '#fl-source-label': { sceneId: 'source', nodeId: 'label', location: '$.scenes[0].nodes[2]' } }, checks: { landscape: { ok: false, layoutRan: true, allFramesObserved: true, report: { contrast: { findings: [{ code: 'contrast_aa_failure', severity: 'error', selector: '#fl-source-label', ratio: 1.34, message: 'Low contrast' }] } } } } };
  const feedback = checkFeedback(report);
  assert.equal(feedback.findings.length, 1);
  assert.equal(feedback.findings[0].location, '$.scenes[0].nodes[2]');
  assert.equal(feedback.findings[0].ratio, 1.34);
  assert.match(feedback.findings[0].hint, /higher-contrast/);
});


test('component-child diagnostics resolve to the unique active authored node', () => {
  const report={checked:false,sourceMap:{'#fl-s1-input':{sceneId:'s1',nodeId:'input',location:'$.scenes[0].nodes[2]',componentPrefixes:['.fl-input-'],startTime:0,endTime:4}},checks:{landscape:{ok:false,layoutRan:true,allFramesObserved:true,report:{layout:{findings:[{code:'text_box_overflow',selector:'div.fl-input-foot > span',time:1,message:'Overflow'}]}}}}};
  assert.equal(checkFeedback(report).findings[0].location,'$.scenes[0].nodes[2]');
});
