#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const stages = ['pilot-runs', 'runs', 'copy-runs', 'final-runs'];
const attempts = [];
for (const stage of stages) {
  const root = path.join(here, stage);
  for (const model of await readdir(root)) {
    for (const arm of await readdir(path.join(root, model))) {
      const relative = `${stage}/${model}/${arm}`;
      const result = JSON.parse(await readFile(path.join(here, relative, 'result.json'), 'utf8'));
      attempts.push({ stage, model, arm, status: result.status, tokens: result.tokens, cost: result.cost, durationMs: result.durationMs, evidence: relative });
    }
  }
}
const byModel = {};
for (const attempt of attempts) {
  const row = byModel[attempt.model] ||= { attempts: 0, knownCost: 0 };
  row.attempts++;
  row.knownCost = Number((row.knownCost + (attempt.cost || 0)).toFixed(10));
}
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const preview = {};
for (const file of ['landscape.mp4', 'portrait.mp4', 'landscape.jpg', 'portrait.jpg']) preview[file] = sha(await readFile(path.join(here, 'preview', file)));
const summary = {
  protocol: 'FrameLang token-efficient v0.1 local OpenCode study',
  modelAttempts: attempts.length,
  knownInferenceCost: Number(attempts.reduce((sum, attempt) => sum + (attempt.cost || 0), 0).toFixed(10)),
  costUnit: 'OpenCode-reported USD; local compile/check/render and human review excluded',
  byModel,
  attempts,
  finalPreview: {
    source: 'final-runs/mimo-v2-6-flash/copy-final/program.json',
    sourceAttemptCost: 0.0000988736,
    note: 'The saved model response was rerendered after a reviewed input-card template copy change without another inference call.',
    assets: preview,
  },
};
await writeFile(path.join(here, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`wrote ${attempts.length} attempts, known inference cost $${summary.knownInferenceCost}\n`);
