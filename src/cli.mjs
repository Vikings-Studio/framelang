#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compile, FrameLangError } from './compiler.mjs';

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
async function verifyOutputs(dir, report) {
  for (const [profile, entry] of Object.entries(report.outputs)) {
    const html = await readFile(path.join(dir, profile, 'index.html'));
    if (digest(html) !== entry.htmlHash) throw new Error(`compiled ${profile} HTML changed after compilation`);
    for (const [file, expected] of Object.entries(entry.assetHashes || {})) {
      const asset = await readFile(path.join(dir, profile, 'assets', file));
      if (digest(asset) !== expected) throw new Error(`compiled ${profile} asset ${file} changed after compilation`);
    }
  }
}
async function main() {
  if (command === 'compile') {
    if (!first || !second) throw new Error('usage: compile <program.json> <out-dir>');
    const report = await compile(path.resolve(first), path.resolve(second));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (!['check', 'render'].includes(command) || !first) throw new Error('usage: check|render <out-dir>');
  const dir = path.resolve(first);
  const { file, report } = await reportFor(dir);
  await verifyOutputs(dir, report);
  if (command === 'check') {
    report.checked = false;
    report.checks = {};
    for (const [profile, entry] of Object.entries(report.outputs)) {
      const cwd = path.join(dir, entry.directory);
      const result = await run(['check', '--json', '--samples=15', '--at-transitions', cwd], cwd);
      let parsed = null;
      try {
        const start = result.stdout.indexOf('{');
        const end = result.stdout.lastIndexOf('}');
        parsed = JSON.parse(result.stdout.slice(start, end + 1));
      } catch { /* non-JSON is a failure */ }
      const layoutRan = Array.isArray(parsed?.layout?.samples) && parsed.layout.samples.length > 0;
      const hardWarnings = (parsed?.lint?.findings || []).filter(f => f.code === 'gsap_timeline_set_initial_hide');
      report.checks[profile] = { ok: result.code === 0 && parsed?.ok === true && layoutRan && hardWarnings.length === 0, exitCode: result.code, layoutRan, hardWarnings, report: parsed };
    }
    report.checked = Object.values(report.checks).every(v => v.ok);
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
    if (!report.checked) throw new Error('one or more HyperFrames profile checks failed');
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
    : { code: 'operation.failed', message: error.message };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = 1;
});
