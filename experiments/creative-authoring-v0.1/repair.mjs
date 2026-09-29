import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {attempt,models,here} from './measure.mjs';
const [id,previousText,nextText,feedbackPath]=process.argv.slice(2);
const model=models.find(m=>m.id===id), previous=Number(previousText), next=Number(nextText);
if(!model||!Number.isInteger(previous)||previous<1||!Number.isInteger(next)||next<=previous||!feedbackPath) throw new Error('Usage: node repair.mjs <model-id> <previous-attempt> <next-attempt> <feedback-file>');
const saved=await readFile(path.join(here,'runs',id,String(previous),'program.json'),'utf8');
const feedback=await readFile(feedbackPath,'utf8');
await attempt(model,next,feedback+'\nPrevious JSON:\n'+saved);
