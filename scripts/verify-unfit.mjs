import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../src/compiler.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'examples/makemydemo-editorial');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'framelang-unfit-'));

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: process.env, shell: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

try {
  const input = path.join(temporary, 'input');
  await mkdir(path.join(input, 'assets'), { recursive: true });
  await copyFile(path.join(source, 'bundle.json'), path.join(input, 'bundle.json'));
  await copyFile(path.join(source, 'assets/orbit-mark.svg'), path.join(input, 'assets/orbit-mark.svg'));
  const program = JSON.parse(await readFile(path.join(source, 'program.json'), 'utf8'));
  program.scenes[0].content.find(node => node.id === 'eyebrow').text = 'X'.repeat(240);
  const programPath = path.join(input, 'program.json');
  await writeFile(programPath, JSON.stringify(program));
  const output = path.join(temporary, 'output');
  await compile(programPath, output);
  const profile = path.join(output, 'landscape-1920x1080');
  const result = await run([require.resolve('hyperframes/bin/hyperframes.mjs'), 'check', '--json', '--samples=3', profile], profile);
  const start = result.stdout.indexOf('{'), end = result.stdout.lastIndexOf('}');
  assert.ok(start >= 0 && end > start, `checker did not return JSON: ${result.stderr.slice(0, 300)}`);
  const report = JSON.parse(result.stdout.slice(start, end + 1));
  assert.notEqual(result.code, 0, 'impossible text unexpectedly passed');
  assert.equal(report.ok, false);
  assert.ok(report.runtime?.findings?.some(finding => finding.code === 'console_error' && finding.message?.includes('FrameLang text fit failed: fl-source-eyebrow')),
    'checker did not report the specific text-fit failure');
  process.stdout.write('Impossible text rejected by browser check.\n');
} finally {
  try {
    await rm(temporary, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 });
  } catch (error) {
    // A just-closed Chrome process can hold a file handle briefly on Windows.
    // The temporary runner is discarded after CI; cleanup does not change the
    // already asserted browser rejection result.
    if (!['EBUSY', 'EPERM'].includes(error.code)) throw error;
    process.stderr.write(`Temporary browser files remained locked: ${error.code}\n`);
  }
}
