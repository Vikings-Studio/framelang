#!/usr/bin/env node
// Export the immutable first-shot results, subsequent retry ledger, and
// admitted/clearly labeled preview videos to a MakeMyDemo frontend checkout.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: node export-site.mjs <absolute-or-relative-frontend-directory>');
const results = JSON.parse(await readFile(path.join(here, 'results.json'), 'utf8'));
const reviews = JSON.parse(await readFile(path.join(here, 'visual-review.json'), 'utf8'));
const exported = [];
const ledger = [];

async function optionalJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function asset(source, id, arm, filename) {
  const relative = path.join('framelang', 'v0.1', id, arm, filename);
  const dest = path.join(frontend, 'public', relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
  if (filename === 'landscape.mp4') {
    const poster = dest.replace(/\.mp4$/, '.jpg');
    const ffmpeg = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2', '-i', source, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'pipe' });
    if (ffmpeg.status !== 0) throw new Error(`ffmpeg poster failed for ${source}: ${ffmpeg.stderr}`);
  }
  return `/${relative.split(path.sep).join('/')}`;
}

for (const model of results) {
  const entry = Object.fromEntries(['id', 'name', 'license', 'source'].map(key => [key, model[key]]));
  const record = { id: model.id, arms: {} };
  for (const [field, arm] of [['withFramework', 'with-framework'], ['withoutFramework', 'without-framework']]) {
    const original = model[field];
    const attempts = [{ number: 1, status: original.status, detail: original.detail, tokens: original.tokens ?? null, cost: original.cost ?? null }];
    if (arm === 'without-framework' && model.id.startsWith('glm-')) {
      for (let number = 2; number <= 3; number++) {
        const result = await optionalJson(path.join(here, 'runs', model.id, arm, 'attempts', String(number), 'result.json'));
        if (!result) throw new Error(`missing recorded ${model.id} attempt ${number}`);
        attempts.push({ number, status: result.status, detail: result.detail, tokens: result.tokens, cost: result.cost });
      }
    }
    const rendered = attempts.find(attempt => attempt.status === 'Rendered');
    const publicSample = { status: original.status, detail: original.detail, tokens: original.tokens ?? null, review: reviews[model.id][field], attempts, firstRenderedAttempt: rendered?.number ?? null, previewKind: 'model' };
    let landscape = original.video && path.join(here, original.video);
    let portrait = original.portraitVideo && path.join(here, original.portraitVideo);
    if (rendered && rendered.number > 1) {
      const retry = await optionalJson(path.join(here, 'runs', model.id, arm, 'attempts', String(rendered.number), 'result.json'));
      landscape = path.join(here, retry.video);
      publicSample.status = `Rendered on attempt ${rendered.number}`;
      publicSample.detail = `The first attempt failed. The unchanged prompt rendered on raw retry #${rendered.number}; all attempts remain in the ledger.`;
      publicSample.tokens = rendered.tokens;
      publicSample.review = 'The retry video passed sampled checks; the original first-shot visual judgment does not apply to this later response.';
    } else if (!rendered && arm === 'without-framework' && model.id.startsWith('glm-')) {
      const repair = await optionalJson(path.join(here, 'runs', model.id, arm, 'repair-preview', 'repair.json'));
      if (!repair) throw new Error(`missing repair preview for ${model.id}`);
      landscape = path.join(here, repair.video);
      publicSample.status = 'Human repair preview';
      publicSample.detail = `No model attempt passed the raw check. This watchable preview applies one documented human repair to attempt #${repair.sourceAttempt}: ${repair.repair}`;
      publicSample.previewKind = 'human-repair';
      publicSample.tokens = attempts[repair.sourceAttempt - 1].tokens;
      publicSample.review = 'Preview is visually readable at both sampled scene midpoints; it remains excluded from model success counts.';
    }
    if (landscape) {
      publicSample.video = await asset(landscape, model.id, arm, 'landscape.mp4');
      publicSample.poster = publicSample.video.replace(/\.mp4$/, '.jpg');
    }
    if (portrait) publicSample.portraitVideo = await asset(portrait, model.id, arm, 'portrait.mp4');
    entry[field] = publicSample;
    record.arms[field] = { attempts, firstRenderedAttempt: rendered?.number ?? null, previewKind: publicSample.previewKind };
  }
  exported.push(entry);
  ledger.push(record);
}
for (const profile of ['landscape', 'portrait']) {
  const actual = profile === 'landscape' ? 'landscape-1920x1080' : 'portrait-1080x1920';
  const video = path.resolve(here, '../../out/makemydemo-rich', actual, 'video.mp4');
  const relative = path.join('framelang', 'v0.1', 'rich', `${profile}.mp4`);
  const dest = path.join(frontend, 'public', relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(video, dest);
  const poster = dest.replace(/\.mp4$/, '.jpg');
  const ffmpeg = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2', '-i', video, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'pipe' });
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg poster failed: ${ffmpeg.stderr}`);
}
await writeFile(path.join(frontend, 'src', 'data', 'framelangComparisons.json'), `${JSON.stringify(exported, null, 2)}\n`);
await writeFile(path.join(here, 'retry-results.json'), `${JSON.stringify(ledger, null, 2)}\n`);
process.stdout.write(`exported ${exported.length} model pairs, retry ledger, and rich landscape/portrait example\n`);
