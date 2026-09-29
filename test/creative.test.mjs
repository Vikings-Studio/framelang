import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expandCreative, validate, lintProgram, compile, authoredLocation } from '../src/compiler.mjs';
const bundle = JSON.parse(await readFile(new URL('../examples/bundle.json', import.meta.url), 'utf8'));
const draft = () => ({ language: 'framelang/creative-v0.1', scenes: [{ id: 's1', durationFrames: 96, design: { decoration: 'grid-glow', ambient: 'drift' }, nodes: [
  { id: 'label', role: 'label', text: 'PUBLIC URL', rect: [0, 0, 1000, 90], motion: 'none' },
  { id: 'headline', segments: [{ text: 'Paste a public URL.', breakAfter: true }, { text: 'Get a first cut.', tone: 'accent' }], rect: [0, 140, 1000, 500], style: { size: 170, minSize: 64, maxLines: 3 }, motion: { preset: 'slide', atFrame: 0, durationFrames: 24 } },
  { id: 'rule', kind: 'shape', primitive: 'rule', rect: [0, 700, 300, 4], fill: { kind: 'solid', color: 'accent' } },
] }] });
test('compact design expands into validated all-frame IR without replacing model choices', () => {
  const source = draft(), program = expandCreative(source, bundle);
  assert.equal(validate(program, bundle), true);
  assert.deepEqual(program.scenes[0].content[1].segments, source.scenes[0].nodes[1].segments);
  assert.equal(program.scenes[0].content[1].style.size, 170);
  assert.deepEqual(program.scenes[0].states[0].visible, ['label', 'rule']);
  assert.equal(program.scenes[0].events[0].preset, 'slide');
  assert.equal(program.verification.mode, 'allFrames');
});
test('compact nodes retain profile-specific relative placement and lint collision feedback', () => {
  const source = draft();
  source.scenes[0].nodes[1].portrait = { relative: { to: 'label', side: 'below', gap: 40, width: 1000, height: 500 } };
  const expanded = expandCreative(source, bundle);
  assert.equal(validate(expanded, bundle), true);
  source.scenes[0].nodes[1].rect = [0, 0, 1000, 500];
  const finding = lintProgram(expandCreative(source, bundle), bundle).findings.find(f => f.code === 'semantic.overlap');
  assert.deepEqual(finding.nodes, ['label', 'headline']);
  assert.equal(authoredLocation(finding.locations[1], source.language), '$.scenes[0].nodes[1]');
});
test('compact format rejects unknown fields, malformed style and unsafe typography', () => {
  for (const mutation of [s => s.css = 'unsafe', s => s.scenes[0].nodes[0].style = 'unsafe', s => s.scenes[0].design = null]) {
    const source = draft(); mutation(source); assert.throws(() => expandCreative(source, bundle));
  }
  for (const mutation of [s => s.scenes[0].nodes[1].style.minSize = 200, s => s.scenes[0].nodes[1].style.size = 50, s => s.scenes[0].nodes[1].motion.atFrame = 90, s => s.scenes[0].nodes[1].css = 'unsafe']) {
    const source = draft(); mutation(source); assert.throws(() => validate(expandCreative(source, bundle), bundle));
  }
});
test('compact compiler preserves provenance and readable fit limits in both profiles', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'framelang-creative-'));
  try {
    const source = path.join(dir, 'program.json');
    await writeFile(source, JSON.stringify(draft())); await writeFile(path.join(dir, 'bundle.json'), JSON.stringify(bundle));
    const a = await compile(source, path.join(dir, 'a')); const b = await compile(source, path.join(dir, 'b'));
    assert.deepEqual(a.outputs, b.outputs);
    assert.equal(a.sourceMap['#fl-s1-headline'].location, '$.scenes[0].nodes[1]');
    assert.equal(a.sourceMap['#fl-s1-headline'].layoutLocations['portrait-1080x1920'], '$.scenes[0].nodes[1]');
    const html = await readFile(path.join(dir, 'a/landscape-1920x1080/index.html'), 'utf8');
    assert.match(html, /font-size:170px/); assert.match(html, /data-fl-min-size="64"/); assert.match(html, /data-fl-max-lines="3"/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('static choices are valid IR and profile-aware typography floors cannot be bypassed', () => {
  const source = draft(); for (const node of source.scenes[0].nodes) node.motion = 'none';
  assert.equal(validate(expandCreative(source, bundle), bundle), true);
  for (const style of [{ size: 24, minSize: 24 }, { size: 'compact', minSize: 160 }]) {
    const changed = draft(); changed.scenes[0].nodes[1].style = style;
    assert.throws(() => validate(expandCreative(changed, bundle), bundle));
  }
});
test('feedback maps sorted motion events and inherited portrait placements to authored nodes', () => {
  const source = draft(); source.scenes[0].nodes[0].motion = { atFrame: 20, durationFrames: 18, preset: 'fade' };
  const program = expandCreative(source, bundle);
  assert.equal(authoredLocation('$.scenes[0].events[1].atFrame', source.language, source, program), '$.scenes[0].nodes[0].motion.atFrame');
  assert.equal(authoredLocation('$.scenes[0].layouts.portrait-1080x1920.children[1].rect', source.language, source, program), '$.scenes[0].nodes[1].rect');
});
test('contained panel underlays stay below readable content without allowing text collisions', () => {
  const source = draft(); source.scenes[0].nodes.unshift({ id: 'panel', kind: 'shape', primitive: 'panel', rect: [0,0,1000,1000], fill: 'background' });
  const program = expandCreative(source, bundle);
  assert.equal(validate(program, bundle), true);
  const nodes = program.scenes[0].layouts['landscape-1920x1080'].children;
  assert.equal(nodes[0].layer, 0); assert.equal(nodes[1].layer, 1);
  source.scenes[0].nodes[2].rect = [0,0,1000,500];
  assert.equal(lintProgram(expandCreative(source,bundle),bundle).ok, false);
});
test('compact base-first paint layers preserve the model gradient above its opaque base', () => {
  const source = draft(); source.scenes[0].design.background = { kind: 'layers', layers: [{ kind: 'solid', color: 'background' }, { kind: 'radial', center: 'top-right', stops: [{ at: 0, color: 'accent', opacity: 20 }, { at: 100, color: 'background', opacity: 0 }] }] };
  const program = expandCreative(source, bundle);
  assert.equal(validate(program,bundle),true);
  assert.equal(program.scenes[0].design.background.layers[0].kind,'radial');
  assert.equal(source.scenes[0].design.background.layers[0].kind,'solid');
});
test('shared named styles preserve model typography without oversized defaults', () => {
  const source = draft(); source.styles = { title: source.scenes[0].nodes[1].style };
  source.scenes[0].nodes[1].style = 'title'; delete source.scenes[0].design.scale;
  const program = expandCreative(source,bundle);
  assert.equal(program.scenes[0].design.scale,'standard');
  assert.equal(program.scenes[0].content[1].style.size,170);
  assert.equal(validate(program,bundle),true);
  source.scenes[0].nodes[1].style='missing'; assert.throws(()=>expandCreative(source,bundle),/unknown named style/);
});
test('decorative progress graphics may intersect while functional text and explicit avoid stay protected', () => {
  const source=draft(); source.scenes[0].nodes.push(
    {id:'track',kind:'shape',primitive:'rule',rect:[0,900,1000,8],fill:'foreground'},
    {id:'progress',kind:'shape',primitive:'rule',rect:[0,900,400,8],fill:'accent'},
    {id:'handle',kind:'shape',primitive:'circle',rect:[390,880,40,40],fill:'accent'});
  assert.equal(lintProgram(expandCreative(source,bundle),bundle).ok,true);
  source.scenes[0].nodes.at(-1).overlap='avoid'; assert.equal(lintProgram(expandCreative(source,bundle),bundle).ok,false);
  delete source.scenes[0].nodes.at(-1).overlap;
  source.scenes[0].nodes.at(-1).rect=[0,0,1000,500]; assert.equal(lintProgram(expandCreative(source,bundle),bundle).ok,false);
});
test('essential text cannot disappear through an opacity or scale keyframe at the final hold', () => {
  for (const value of [{ opacity: 0 }, { scale: 0 }]) {
    const source = draft(); const key = Object.keys(value)[0];
    source.scenes[0].nodes[1].motion = { durationFrames: 24, frames: [{ atFrame:0,value:{[key]:1} },{atFrame:24,value}],ease:'none' };
    assert.throws(() => validate(expandCreative(source,bundle),bundle), error => error.code === 'semantic.visibility');
  }
});


test('rich components reject undersized authored rectangles before browser rendering', () => {
  const source = draft(); source.scenes[0].nodes.push({id:'input',kind:'inputCard',placeholder:'MakeMyDemo.com',rect:[0,800,1000,180],motion:'none'});
  assert.throws(() => expandCreative(source,bundle),error=>error.code==='semantic.componentFit'&&error.location==='$.scenes[0].nodes[3]');
});
test('paint diagnostics refer to the authored base-first layer index', () => {
  const source=draft();source.scenes[0].design.background={kind:'layers',layers:[{kind:'solid',color:'#INVALID'},{kind:'solid',color:'background'}]};
  assert.throws(()=>expandCreative(source,bundle),error=>error.location==='$.scenes[0].design.background.layers[0].color');
});

test('decorative motion can continue through the readable hold; text receives precise repair feedback', () => {
  const source=draft(); source.scenes[0].nodes[2].motion={atFrame:0,durationFrames:96,ease:'none',frames:[{atFrame:0,value:{rotation:0}},{atFrame:96,value:{rotation:20}}]};
  assert.equal(validate(expandCreative(source,bundle),bundle),true);
  source.scenes[0].nodes[1].motion={atFrame:30,durationFrames:60,ease:'none',frames:[{atFrame:0,value:{opacity:0}},{atFrame:60,value:{opacity:1}}]};
  const program=expandCreative(source,bundle),finding=lintProgram(program,bundle).findings.find(f=>f.code==='semantic.hold');
  assert.ok(finding);
  assert.match(finding.message,/by frame 81/);
  assert.match(finding.message,/final atFrame/);
  assert.equal(authoredLocation(finding.location,source.language,source,program),'$.scenes[0].nodes[1].motion');
});
