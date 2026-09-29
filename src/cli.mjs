#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { authoredLocation, canonical, compile, FrameLangError, lintProgram, loadProgram } from './compiler.mjs';
import { assessCheck, frameTimes } from './check-policy.mjs';
import { checkFeedback } from './feedback.mjs';
import { adopt, assetInventory } from './adopt.mjs';

const require = createRequire(import.meta.url);
const hf = require.resolve('hyperframes/bin/hyperframes.mjs');
const [command, first, second] = process.argv.slice(2);
function digest(s) { return `sha256:${createHash('sha256').update(s).digest('hex')}`; }
function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hf, ...args], { cwd, shell: false, env: process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
    child.stderr.on('data', d => { stderr += d; process.stderr.write(d); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
async function reportFor(dir) {
  const file = path.join(dir, 'compile-report.json');
  return { file, report: JSON.parse(await readFile(file, 'utf8')) };
}
async function verificationPin() {
  const files = ['cli.mjs', 'adopt.mjs', 'check-policy.mjs', 'feedback.mjs'];
  const hashes = {};
  for (const name of files) hashes[name] = digest(await readFile(new URL(name, import.meta.url)));
  hashes.hyperframes = digest(await readFile(hf));
  hashes.lockfile = digest(await readFile(new URL('../package-lock.json', import.meta.url)));
  return digest(JSON.stringify({ node: process.version, hashes }));
}
async function verifyOutputs(dir, report) {
  if (report.verificationPin && report.verificationPin !== await verificationPin()) throw new Error('checker or runtime changed; re-adopt or recompile before checking');
  for (const [profile, entry] of Object.entries(report.outputs)) {
    const html = await readFile(path.join(dir, profile, 'index.html'));
    if (digest(html) !== entry.htmlHash) throw new Error(`compiled ${profile} HTML changed after compilation`);
    if (report.language === 'framelang/trusted-hyperframes-v0.1') {
      const actual = (await assetInventory(path.join(dir, entry.directory, 'assets'))).map(asset => asset.relative).sort();
      if (JSON.stringify(actual) !== JSON.stringify(Object.keys(entry.assetHashes || {}).sort())) throw new Error('asset inventory changed; re-adopt and recheck before rendering');
    }
    for (const [file, expected] of Object.entries(entry.assetHashes || {})) {
      const asset = await readFile(path.join(dir, profile, 'assets', file));
      if (digest(asset) !== expected) throw new Error(`compiled ${profile} asset ${file} changed after compilation`);
    }
  }
}
async function main() {
  if (command === 'lint') {
    if (!first) throw new Error('usage: lint <program.json>');
    const { authored, program, bundle, recipe } = await loadProgram(path.resolve(first));
    const feedback = lintProgram(program, bundle);
    for (const finding of feedback.findings) {
      if (finding.location) finding.location = authoredLocation(finding.location, authored.language, authored, program);
      if (finding.locations) finding.locations = finding.locations.map(location => authoredLocation(location, authored.language, authored, program));
    }
    feedback.stage = 'static';
    feedback.inputHash = digest(canonical(authored));
    if (recipe) feedback.recipe = recipe.id;
    process.stdout.write(`${JSON.stringify(feedback, null, 2)}\n`);
    if (!feedback.ok) process.exitCode = 1;
    return;
  }
  if (command === 'adopt') {
    if (!first || !second) throw new Error('usage: adopt <trusted-html-dir> <out-dir>');
    const report = await adopt(path.resolve(first), path.resolve(second));
    report.verificationPin = await verificationPin();
    await writeFile(path.join(path.resolve(second), 'compile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (command === 'compile') {
    if (!first || !second) throw new Error('usage: compile <program.json> <out-dir>');
    const report = await compile(path.resolve(first), path.resolve(second));
    report.verificationPin = await verificationPin();
    await writeFile(path.join(path.resolve(second), 'compile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (!['check', 'render'].includes(command) || !first) throw new Error('usage: lint <program.json> | compile <program.json> <out-dir> | adopt <trusted-html-dir> <out-dir> | check|render <out-dir>');
  const dir = path.resolve(first);
  const { file, report } = await reportFor(dir);
  await verifyOutputs(dir, report);
  if (command === 'check') {
    report.checked = false;
    report.checks = {};
    const frames = frameTimes(report.verification);
    for (const [profile, entry] of Object.entries(report.outputs)) {
      const cwd = path.join(dir, entry.directory);
      const args = ['check', '--json', '--samples=15', '--at-transitions'];
      if (frames) args.push(`--at=${frames.join(',')}`, '--frame-check=severity=error');
      const result = await run([...args, cwd], cwd);
      let parsed = null;
      try {
        const start = result.stdout.indexOf('{');
        const end = result.stdout.lastIndexOf('}');
        parsed = JSON.parse(result.stdout.slice(start, end + 1));
      } catch { /* non-JSON is a failure */ }
      report.checks[profile] = assessCheck(parsed, result.code, frames);
    }
    report.checked = Object.values(report.checks).every(v => v.ok);
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.join(dir, 'feedback.json'), `${JSON.stringify(checkFeedback(report), null, 2)}\n`);
    if (!report.checked) throw new Error('one or more HyperFrames profile checks failed; see feedback.json');
    return;
  }
  if (!report.checked || !Object.values(report.checks || {}).every(v => v.ok)) throw new Error('render requires a passing check of every profile');
  for (const [profile, entry] of Object.entries(report.outputs)) {
    const cwd = path.join(dir, entry.directory);
    const output = path.join(cwd, 'video.mp4');
    const result = await run(['render', '--quality', 'draft', '--output', output, cwd], cwd);
    if (result.code !== 0) throw new Error(`render failed for ${profile}`);
  }
}
main().catch(error => {
  const payload = error instanceof FrameLangError
    ? { code: error.code, location: error.location, message: error.message }
    : error instanceof SyntaxError ? { code: 'syntax.json', message: error.message }
    : { code: 'operation.failed', message: error.message };
  if (command === 'lint') {
    process.stdout.write(`${JSON.stringify({ version: 1, stage: 'static', ok: false, findings: [{ ...payload, severity: 'error', hint: 'Revise the indicated FrameLang source, then rerun lint.' }], instruction: 'Revise the FrameLang source and rerun lint before compiling.' }, null, 2)}\n`);
  } else process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = 1;
});
