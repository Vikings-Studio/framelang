#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = path.dirname(fileURLToPath(import.meta.url));
const rawRoot = process.argv[2];
if (!rawRoot) throw new Error('usage: node evaluate.mjs <isolated-raw-output-directory>');
const models = JSON.parse(await readFile(path.join(here, 'models.json'), 'utf8'));
const only = new Set(process.argv.slice(3));
const cli = path.join(repo, 'src/cli.mjs');
const hf = require.resolve('hyperframes/bin/hyperframes.mjs');
const gsap = require.resolve('gsap/dist/gsap.min.js');
const font = path.join(repo, 'fonts/Inter.ttf');
const bundle = path.join(here, 'bundle.json');

function cleanTransport(raw) {
  return raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\s*>\s*oneshot[^\n]*\n/, '').trim();
}
function run(args, cwd) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd, shell: false, env: process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('error', e => resolve({ code: -1, stdout, stderr: `${stderr}\n${e}` }));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
function safeHtml(html) {
  if (!/^<!doctype html/i.test(html) || !/<html[\s>]/i.test(html)) return 'not a complete HTML document';
  if (!/id=["']root["']/i.test(html) || !/data-composition-id=["']main["']/i.test(html)) return 'missing HyperFrames root';
  if (/https?:\/\/|data:|blob:|<iframe|<object|<embed|<link\b|@import|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|eval\s*\(|new\s+Function|import\s*\(/i.test(html)) return 'contains remote or executable feature outside the frozen local assets';
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  if (scripts.length !== 1 || scripts[0] !== 'assets/gsap.min.js') return 'script source differs from bundled GSAP';
  return null;
}

const rows = [];
for (const model of models) {
  if (only.size && !only.has(model.id)) continue;
  const row = { id: model.id, name: model.label, license: model.license, source: model.source };
  for (const [arm, field] of [['with-framework', 'withFramework'], ['without-framework', 'withoutFramework']]) {
    const sourceDir = path.join(rawRoot, model.id);
    const targetDir = path.join(here, 'runs', model.id, arm);
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });
    const raw = await readFile(path.join(sourceDir, `${arm}.raw.txt`), 'utf8');
    const meta = JSON.parse(await readFile(path.join(sourceDir, `${arm}.meta.json`), 'utf8'));
    await writeFile(path.join(targetDir, 'response.txt'), raw);
    await copyFile(path.join(sourceDir, `${arm}.meta.json`), path.join(targetDir, 'run-meta.json'));
    await copyFile(path.join(sourceDir, `${arm}.events.jsonl`), path.join(targetDir, 'opencode-events.jsonl'));
    await copyFile(path.join(sourceDir, `${arm}.stderr.txt`), path.join(targetDir, 'opencode-stderr.txt'));
    const transported = cleanTransport(raw);
    const fence = transported.match(/^```(?:json|html)?\s*\n([\s\S]*?)\n```$/i);
    const response = fence ? fence[1].trim() : transported;
    if (fence) await writeFile(path.join(targetDir, 'unwrapped-response.txt'), `${response}\n`);
    const result = { status: 'failed', detail: '', video: undefined, tokens: meta.tokens ?? null, cost: meta.cost ?? null, formatViolation: Boolean(fence) };
    if (!response) {
      result.status = meta.timedOut ? 'Harness deadline' : 'No response';
      result.detail = meta.timedOut ? `No answer before the ${Math.round(meta.durationMs / 1000)}-second harness deadline; inspect the OpenCode event and stderr records.` : 'OpenCode emitted no answer; inspect the OpenCode event and stderr records.';
    } else if (meta.code !== 0) {
      result.status = 'Provider error';
      result.detail = `OpenCode exited with code ${meta.code}; the first response was not admitted.`;
    } else if (field === 'withFramework') {
      let program;
      try { program = JSON.parse(response); }
      catch (error) {
        result.status = 'Invalid JSON'; result.detail = `The first answer could not be parsed as FrameLang JSON: ${error.message}`;
      }
      if (program) {
        await writeFile(path.join(targetDir, 'program.json'), `${JSON.stringify(program, null, 2)}\n`);
        await copyFile(bundle, path.join(targetDir, 'bundle.json'));
        const out = path.join(targetDir, 'compiled');
        const compiled = await run([cli, 'compile', path.join(targetDir, 'program.json'), out], repo);
        await writeFile(path.join(targetDir, 'compile.log'), compiled.stdout + compiled.stderr);
        if (compiled.code !== 0) {
          result.status = 'Compile rejected';
          result.detail = (compiled.stderr.trim().split('\n').at(-1) || 'FrameLang compiler rejected the first answer').slice(0, 260);
        } else {
          const checked = await run([cli, 'check', out], repo);
          await writeFile(path.join(targetDir, 'check.log'), checked.stdout + checked.stderr);
          if (checked.code !== 0) {
            result.status = 'Check rejected'; result.detail = 'The compiled video failed a HyperFrames profile check.';
          } else {
            const rendered = await run([cli, 'render', out], repo);
            await writeFile(path.join(targetDir, 'render.log'), rendered.stdout + rendered.stderr);
            if (rendered.code !== 0) {
              result.status = 'Render failed'; result.detail = 'Both profile checks passed, but rendering failed.';
            } else {
              result.status = 'Rendered'; result.detail = 'First response compiled, passed sampled checks, and rendered in landscape and portrait.';
              result.video = path.relative(here, path.join(targetDir, 'compiled/landscape-1920x1080/video.mp4')).replaceAll('\\', '/');
              result.portraitVideo = path.relative(here, path.join(targetDir, 'compiled/portrait-1080x1920/video.mp4')).replaceAll('\\', '/');
            }
          }
        }
      }
    } else {
      const rejection = safeHtml(response);
      if (rejection) { result.status = 'HTML rejected'; result.detail = rejection; }
      else {
        const scene = path.join(targetDir, 'scene');
        await mkdir(path.join(scene, 'assets'), { recursive: true });
        await writeFile(path.join(scene, 'index.html'), response);
        await copyFile(gsap, path.join(scene, 'assets/gsap.min.js'));
        await copyFile(font, path.join(scene, 'assets/Inter.ttf'));
        const checked = await run([hf, 'check', '--json', '--samples=15', '--at-transitions', scene], scene);
        await writeFile(path.join(targetDir, 'check.log'), checked.stdout + checked.stderr);
        let checkReport = null;
        try { checkReport = JSON.parse(checked.stdout.slice(checked.stdout.indexOf('{'), checked.stdout.lastIndexOf('}') + 1)); } catch { /* missing report is a failure */ }
        if (checked.code !== 0 || checkReport?.ok !== true || !checkReport.layout?.samples?.length) { result.status = 'Check rejected'; result.detail = 'The raw HyperFrames HTML failed its first sampled check.'; }
        else {
          const video = path.join(scene, 'video.mp4');
          const rendered = await run([hf, 'render', '--quality', 'draft', '--output', video, scene], scene);
          await writeFile(path.join(targetDir, 'render.log'), rendered.stdout + rendered.stderr);
          if (rendered.code !== 0) { result.status = 'Render failed'; result.detail = 'Raw HTML passed its sampled check, but rendering failed.'; }
          else { result.status = 'Rendered'; result.detail = 'First response passed sampled HyperFrames checks and rendered in landscape.'; result.video = path.relative(here, video).replaceAll('\\', '/'); }
        }
      }
    }
    if (fence) {
      if (result.status === 'Rendered') result.status = 'Rendered with fence';
      result.detail += ' The model added a Markdown fence despite the prompt; only that enclosing fence was removed for validation.';
    }
    row[field] = result;
    process.stdout.write(`${model.id} ${arm}: ${result.status}\n`);
    await writeFile(path.join(targetDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
  rows.push(row);
}
if (!only.size) await writeFile(path.join(here, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`);
