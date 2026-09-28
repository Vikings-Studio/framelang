#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const models = JSON.parse(await readFile(path.join(here, 'models.json'), 'utf8'));
const rows = [];
for (const model of models) {
  const run = async arm => JSON.parse(await readFile(path.join(here, 'runs', model.id, arm, 'result.json'), 'utf8'));
  rows.push({
    id: model.id,
    name: model.label,
    license: model.license,
    source: model.source,
    opencode: model.opencode,
    withFramework: await run('with-framework'),
    withoutFramework: await run('without-framework'),
  });
}
await writeFile(path.join(here, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`);
