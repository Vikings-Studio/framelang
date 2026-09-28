#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const [modelId, arm] = process.argv.slice(2);
const models = JSON.parse(await readFile(path.join(root, 'experiments/makemydemo-v0.1/models.json'), 'utf8'));
const model = models.find(item => item.id === modelId);
if (!model || !['recipe', 'full', 'copy', 'copy-final'].includes(arm)) throw new Error('usage: node measure.mjs <model-id> recipe|full|copy|copy-final');
const safeDir = process.env.OPENCODE_SAFE_DIR;
if (!safeDir || !process.env.OPENCODE_CONFIG) throw new Error('Set OPENCODE_SAFE_DIR and OPENCODE_CONFIG to a tool-disabled local OpenCode workspace');
const target = path.join(here, arm === 'copy' ? 'copy-runs' : arm === 'copy-final' ? 'final-runs' : 'runs', modelId, arm);
await mkdir(path.dirname(target), { recursive: true });
await mkdir(target, { recursive: false }); // Each arm is one shot; refuse overwrites.

const recipe = await readFile(path.join(root, 'examples/makemydemo-recipe.json'), 'utf8');
const full = await readFile(path.join(root, 'examples/makemydemo-cinematic/program.json'), 'utf8');
const common = 'Create one 11.5-second MakeMyDemo.com workflow video for landscape and portrait. Facts: a visitor can paste a public product URL; the first cut uses an AI-written script, product visuals and music; the user can review and export an MP4. Do not invent customers, metrics, screenshots, URLs, or features. Preserve the three-scene input → assembly → handoff story and the supplied visual structure. Return one JSON object only, with no Markdown. Use concise, factual copy.';
const prompt = arm === 'copy-final'
  ? `Write only three short factual MakeMyDemo.com lines. Return exactly one JSON object with keys "recipe":"makemydemo-workflow/v1", "hook", "assembly", "handoff"; no other keys or markdown. The compiler adds these fixed following lines: "One first cut.", "A first cut.", and "Export MP4." respectively. Therefore hook (max 32 chars) only says to paste a public product URL; assembly (max 36 chars) only lists script, product visuals, and music; handoff (max 30 chars) only says to review the cut. Do not repeat the following lines. Do not invent claims or URLs. Example shape: ${recipe.trim()}`
  : arm === 'copy'
  ? `Write three short, factual lines of MakeMyDemo.com copy. Return ONLY one JSON object with exactly four keys: "recipe":"makemydemo-workflow/v1", "hook", "assembly", "handoff". Do not add scenes, config, layout, or explanations; the compiler creates the video. The hook (max 32 characters) is about pasting a public product URL. The assembly line (max 36 characters) mentions script, product visuals, and music. The handoff line (max 30 characters) mentions reviewing and exporting MP4. No customers, metrics, screenshots, URLs, or extra claims. Example shape: ${recipe.trim()}`
  : `${common}\n\nThis is a text-only JSON transformation. Do not use tools. Use the ${arm === 'recipe' ? 'compact FrameLang recipe' : 'full expressive FrameLang scene program'} below as the output shape. You may improve only the source, assembly, and delivery headline lead lines. Keep the reviewed accent phrases, workflow labels, every key, ID, layout, event, asset reference, value type, and scene count otherwise unchanged. Return the complete ${arm === 'recipe' ? 'recipe' : 'scene program'} JSON.\n\n${arm === 'recipe' ? recipe : full}`;
await writeFile(path.join(target, 'prompt.txt'), prompt);

function run(command, args, cwd, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(command, args, { cwd, env: process.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    child.stdout.on('data', data => stdout.push(data));
    child.stderr.on('data', data => stderr.push(data));
    child.on('error', reject);
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal, durationMs: Date.now() - start, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() });
    });
  });
}
const deadlineMs = 300_000;
const call = await run('opencode', ['run', '--pure', '--agent', 'oneshot', '--format', 'json', '--print-logs', '--log-level', 'WARN', '--title', `FrameLang token ablation ${modelId} ${arm}`, '-m', model.opencode, '--dir', safeDir, prompt], safeDir, deadlineMs);
await writeFile(path.join(target, 'opencode-events.jsonl'), call.stdout);
await writeFile(path.join(target, 'opencode-stderr.txt'), call.stderr);
const events = call.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
const raw = events.filter(event => event.type === 'text').map(event => event.part?.text || '').join('');
await writeFile(path.join(target, 'response.txt'), raw);
const finishes = events.filter(event => event.type === 'step_finish');
const tokens = finishes.length ? { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } : null;
let cost = finishes.length ? 0 : null;
for (const event of finishes) {
  const usage = event.part?.tokens || {};
  for (const key of ['total', 'input', 'output', 'reasoning']) tokens[key] += usage[key] || 0;
  for (const key of ['read', 'write']) tokens.cache[key] += usage.cache?.[key] || 0;
  cost += event.part?.cost || 0;
}
const meta = { model: model.opencode, arm, deadlineMs, exitCode: call.code, signal: call.signal, durationMs: call.durationMs, tokens, cost, outputBytes: Buffer.byteLength(raw) };
await writeFile(path.join(target, 'run-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
const cleaned = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\s*>\s*oneshot[^\n]*\n/, '').trim();
const fenced = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
let status = call.signal ? 'Harness deadline' : call.code !== 0 ? 'Provider error' : 'No response';
if (cleaned && call.code === 0) {
  try {
    const program = JSON.parse(fenced ? fenced[1] : cleaned);
    const programPath = path.join(target, 'program.json');
    await writeFile(programPath, `${JSON.stringify(program, null, 2)}\n`);
    if (arm === 'full') {
      await cp(path.join(root, 'examples/makemydemo-cinematic/bundle.json'), path.join(target, 'bundle.json'));
      await cp(path.join(root, 'examples/makemydemo-cinematic/assets'), path.join(target, 'assets'), { recursive: true });
    }
    const compiled = await run(process.execPath, [path.join(root, 'src/cli.mjs'), 'compile', programPath, path.join(target, 'compiled')], root);
    await writeFile(path.join(target, 'compile.log'), compiled.stdout + compiled.stderr);
    status = compiled.code === 0 ? 'Compiled' : 'Compile rejected';
    if (compiled.code === 0) {
      const checked = await run(process.execPath, [path.join(root, 'src/cli.mjs'), 'check', path.join(target, 'compiled')], root);
      await writeFile(path.join(target, 'check.log'), checked.stdout + checked.stderr);
      status = checked.code === 0 ? 'Checked' : 'Check rejected';
      if (checked.code === 0) {
        const rendered = await run(process.execPath, [path.join(root, 'src/cli.mjs'), 'render', path.join(target, 'compiled')], root);
        await writeFile(path.join(target, 'render.log'), rendered.stdout + rendered.stderr);
        status = rendered.code === 0 ? 'Rendered' : 'Render failed';
      }
    }
  } catch (error) { status = 'Invalid JSON'; await writeFile(path.join(target, 'parse-error.txt'), `${error}\n`); }
}
const result = { ...meta, status, formatViolation: Boolean(fenced) };
await writeFile(path.join(target, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${modelId} ${arm}: ${status}, tokens=${tokens?.total ?? 'unavailable'}, cost=${cost ?? 'unavailable'}\n`);
