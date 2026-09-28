#!/usr/bin/env node
// Independent retry of one failed raw arm. The frozen prompt, model alias and
// tool-disabled OpenCode config stay unchanged; attempts never overwrite one another.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const [id, attemptText, deadlineText] = process.argv.slice(2);
const attempt = Number(attemptText);
const deadlineMs = Number(deadlineText);
if (!id || !Number.isSafeInteger(attempt) || attempt < 2 || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1000) {
  throw new Error('usage: node retry-raw.mjs <model-id> <attempt-number>=2+ <deadline-ms>');
}
const model = JSON.parse(await readFile(path.join(here, 'models.json'), 'utf8')).find(m => m.id === id);
if (!model) throw new Error(`unknown model ${id}`);
const prompt = JSON.parse(await readFile(path.join(here, 'prompts.json'), 'utf8')).withoutFramework;
const safeDir = process.env.OPENCODE_SAFE_DIR;
if (!safeDir || !process.env.OPENCODE_CONFIG) throw new Error('set OPENCODE_SAFE_DIR and OPENCODE_CONFIG to a tool-disabled isolated OpenCode workspace');
const target = path.join(here, 'runs', id, 'without-framework', 'attempts', String(attempt));
await mkdir(path.dirname(target), { recursive: true });
await mkdir(target, { recursive: false }); // Refuse to overwrite any prior attempt.

function run(command, args, cwd, env = process.env, deadline = 0) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [], err = [];
    child.stdout.on('data', d => out.push(d));
    child.stderr.on('data', d => err.push(d));
    child.on('error', reject);
    const timer = deadline ? setTimeout(() => child.kill('SIGTERM'), deadline) : null;
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal, durationMs: Date.now() - started, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
  });
}
function totalUsage(events) {
  const finishes = events.filter(e => e.type === 'step_finish');
  if (!finishes.length) return { tokens: null, cost: null };
  const tokens = { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
  let cost = 0;
  for (const event of finishes) {
    const t = event.part?.tokens;
    if (t) {
      for (const field of ['total', 'input', 'output', 'reasoning']) tokens[field] += t[field] || 0;
      for (const field of ['read', 'write']) tokens.cache[field] += t.cache?.[field] || 0;
    }
    cost += event.part?.cost || 0;
  }
  return { tokens, cost };
}
function clean(raw) {
  const text = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\s*>\s*oneshot[^\n]*\n/, '').trim();
  const fence = text.match(/^```(?:html)?\s*\n([\s\S]*?)\n```$/i);
  return { html: fence ? fence[1].trim() : text, formatViolation: Boolean(fence) };
}
function safeHtml(html) {
  if (!/^<!doctype html/i.test(html) || !/<html[\s>]/i.test(html)) return 'not a complete HTML document';
  if (!/id=["']root["']/i.test(html) || !/data-composition-id=["']main["']/i.test(html)) return 'missing HyperFrames root';
  if (/https?:\/\/|data:|blob:|<iframe|<object|<embed|<link\b|@import|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|eval\s*\(|new\s+Function|import\s*\(/i.test(html)) return 'contains remote or executable feature outside the frozen local assets';
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  if (scripts.length !== 1 || scripts[0] !== 'assets/gsap.min.js') return 'script source differs from bundled GSAP';
  return null;
}

const started = Date.now();
const call = await run('opencode', ['run', '--pure', '--agent', 'oneshot', '--format', 'json', '--print-logs', '--log-level', 'WARN', '--title', `FrameLang v0.1 ${id} raw attempt ${attempt}`, '-m', model.opencode, '--dir', safeDir, prompt], safeDir, process.env, deadlineMs);
const events = call.stdout.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
const raw = events.filter(e => e.type === 'text').map(e => e.part?.text || '').join('');
const usage = totalUsage(events);
const meta = { id, model: model.opencode, arm: 'without-framework', attempt, deadlineMs, code: call.code, signal: call.signal, durationMs: call.durationMs, outputBytes: Buffer.byteLength(raw), ...usage, sessionID: events[0]?.sessionID || null };
await writeFile(path.join(target, 'opencode-events.jsonl'), call.stdout);
await writeFile(path.join(target, 'opencode-stderr.txt'), call.stderr);
await writeFile(path.join(target, 'response.txt'), raw);
await writeFile(path.join(target, 'run-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
const { html, formatViolation } = clean(raw);
const result = { attempt, status: '', detail: '', tokens: usage.tokens, cost: usage.cost, formatViolation };
if (!html) {
  result.status = call.signal ? 'Harness deadline' : 'No response';
  result.detail = call.signal ? `No answer before the ${Math.round(deadlineMs / 1000)}-second harness deadline.` : 'OpenCode emitted no visible response.';
} else if (call.code !== 0) {
  result.status = 'Provider error'; result.detail = `OpenCode exited with code ${call.code}.`;
} else if (safeHtml(html)) {
  result.status = 'HTML rejected'; result.detail = safeHtml(html);
} else {
  const scene = path.join(target, 'scene');
  await mkdir(path.join(scene, 'assets'), { recursive: true });
  await writeFile(path.join(scene, 'index.html'), html);
  await copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(scene, 'assets/gsap.min.js'));
  await copyFile(path.join(repo, 'fonts/Inter.ttf'), path.join(scene, 'assets/Inter.ttf'));
  const hf = require.resolve('hyperframes/bin/hyperframes.mjs');
  const checked = await run(process.execPath, [hf, 'check', '--json', '--samples=15', '--at-transitions', scene], scene);
  await writeFile(path.join(target, 'check.log'), checked.stdout + checked.stderr);
  let report;
  try { report = JSON.parse(checked.stdout.slice(checked.stdout.indexOf('{'), checked.stdout.lastIndexOf('}') + 1)); } catch { /* missing report fails */ }
  if (checked.code !== 0 || report?.ok !== true || !report.layout?.samples?.length) {
    result.status = 'Check rejected'; result.detail = 'The raw HTML failed its first sampled HyperFrames check.';
  } else {
    const video = path.join(scene, 'video.mp4');
    const rendered = await run(process.execPath, [hf, 'render', '--quality', 'draft', '--output', video, scene], scene);
    await writeFile(path.join(target, 'render.log'), rendered.stdout + rendered.stderr);
    if (rendered.code !== 0) { result.status = 'Render failed'; result.detail = 'The checked HTML did not render.'; }
    else {
      result.status = 'Rendered'; result.detail = 'Retry response passed sampled HyperFrames checks and rendered in landscape.';
      result.video = path.relative(here, video).replaceAll('\\', '/');
    }
  }
}
if (formatViolation) result.detail += ' A single enclosing Markdown fence was removed and counted as a format violation.';
await writeFile(path.join(target, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${id} attempt ${attempt}: ${result.status}, tokens=${usage.tokens?.total ?? 'unavailable'}, cost=${usage.cost ?? 'unknown'}, elapsed=${Date.now() - started}ms\n`);
