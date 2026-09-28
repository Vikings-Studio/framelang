#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a MakeMyDemo dark-background experiment gate, not a general proof of visibility.
// Scene-midpoint samples detect an empty four-second scene that sampled layout checks missed.
const here = path.dirname(fileURLToPath(import.meta.url));
const models = JSON.parse(await readFile(path.join(here, 'models.json'), 'utf8'));
const only = new Set(process.argv.slice(2));
const sampleSeconds = [2, 6];
const minBrightPixels = 1000;

function frame(video, second) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-ss', String(second), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let stderr = '';
    child.stdout.on('data', data => chunks.push(data));
    child.stderr.on('data', data => stderr += data);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr || `ffmpeg exited ${code}`)));
  });
}
async function brightCount(video, second) {
  const bytes = await frame(video, second);
  let bright = 0;
  for (let i = 0; i < bytes.length; i += 3) if (bytes[i] > 80 || bytes[i + 1] > 80 || bytes[i + 2] > 80) bright++;
  return bright;
}
for (const model of models) {
  if (only.size && !only.has(model.id)) continue;
  for (const arm of ['with-framework', 'without-framework']) {
    const file = path.join(here, 'runs', model.id, arm, 'result.json');
    const result = JSON.parse(await readFile(file, 'utf8'));
    if (!result.video) continue;
    const videos = { landscape: result.video };
    if (result.portraitVideo) videos.portrait = result.portraitVideo;
    const counts = {};
    for (const [profile, relativeVideo] of Object.entries(videos)) {
      const video = path.join(here, relativeVideo);
      counts[profile] = {};
      for (const second of sampleSeconds) counts[profile][second] = await brightCount(video, second);
    }
    result.frameAudit = { sampleSeconds, minBrightPixels, brightPixelCounts: counts };
    if (Object.values(counts).some(samples => Object.values(samples).some(count => count < minBrightPixels))) {
      result.visualGate = 'failed_blank_scene';
      result.status = 'Rendered · blank scene';
      result.detail += ' Scene-midpoint frame audit found an empty or near-empty scene; this render fails visual acceptance.';
    } else result.visualGate = 'sampled_visible';
    await writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${model.id} ${arm}: ${result.visualGate}\n`);
  }
}
