#!/usr/bin/env node
// Creates a labeled, reproducible human repair preview from a rejected model
// response. Never changes the submitted attempt or its score.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!['glm-5-2', 'glm-5-3'].includes(id)) throw new Error('usage: node repair-preview.mjs glm-5-2|glm-5-3');
const source = path.join(here, 'runs', id, 'without-framework', 'attempts', '2', 'scene', 'index.html');
const target = path.join(here, 'runs', id, 'without-framework', 'repair-preview');
await mkdir(path.join(target, 'assets'), { recursive: true });
let html = await readFile(source, 'utf8');
let repair;
if (id === 'glm-5-2') {
  const before = "    .set('#s1', {display:'none'}, 3.958333)\n";
  if (!html.includes(before)) throw new Error('expected clip display tween is absent');
  html = html.replace(before, '');
  repair = 'Removed the GSAP display write to the clip section; HyperFrames owns clip visibility.';
} else {
  const eyebrow = `      tl.fromTo(scope + " .eyebrow-text",\n        { letterSpacing: "0.6em" },\n        { letterSpacing: "0.35em", duration: 0.8, ease: "power3.out" }, at);\n`;
  const headline = `      tl.fromTo(scope + " .headline",\n        { letterSpacing: "0.05em" },\n        { letterSpacing: "-0.015em", duration: 1.1, ease: "power3.out" }, at);\n`;
  if (!html.includes(eyebrow) || !html.includes(headline)) throw new Error('expected letter-spacing tweens are absent');
  html = html.replace(eyebrow, '').replace(headline, '');
  repair = 'Removed two GSAP letter-spacing tweens that HyperFrames rejects because layout snapping stutters.';
}
await writeFile(path.join(target, 'index.html'), html);
await copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(target, 'assets', 'gsap.min.js'));
await copyFile(path.resolve(here, '../../fonts/Inter.ttf'), path.join(target, 'assets', 'Inter.ttf'));

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('hyperframes/bin/hyperframes.mjs'), ...args], { cwd: target, shell: false });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}
const checked = await run(['check', '--json', '--samples=15', '--at-transitions', target]);
await writeFile(path.join(target, 'check.log'), checked.output);
if (checked.code !== 0) throw new Error(`repair preview check failed for ${id}`);
const video = path.join(target, 'video.mp4');
const rendered = await run(['render', '--quality', 'draft', '--output', video, target]);
await writeFile(path.join(target, 'render.log'), rendered.output);
if (rendered.code !== 0) throw new Error(`repair preview render failed for ${id}`);
await writeFile(path.join(target, 'repair.json'), `${JSON.stringify({ sourceAttempt: 2, repair, modelInferenceCost: 0, modelAttemptSuccess: false, video: path.relative(here, video).replaceAll('\\', '/') }, null, 2)}\n`);
process.stdout.write(`${id}: repaired preview rendered; original model attempt remains rejected\n`);
