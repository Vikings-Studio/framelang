import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../..');
const models=JSON.parse(await readFile(path.join(root,'experiments/makemydemo-v0.1/models.json'),'utf8'));
const results=[];
for(const model of models){
 const base=path.join(here,'runs',model.id);const attempts=[];
 for(const number of (await readdir(base)).sort((a,b)=>Number(a)-Number(b))) attempts.push(JSON.parse(await readFile(path.join(base,number,'result.json'),'utf8')));
 const replay=path.join(here,'replays',model.id), selection=JSON.parse(await readFile(path.join(replay,'selection.json'),'utf8'));
 const report=JSON.parse(await readFile(path.join(replay,'compiled','compile-report.json'),'utf8'));
 if(!report.checked||!Object.values(report.checks).every(check=>check.ok&&check.allFramesObserved))throw new Error(model.id+' lacks passing final checks');
 for(const entry of Object.values(report.outputs))await stat(path.join(replay,'compiled',entry.directory,'video.mp4'));
 const checks=Object.fromEntries(Object.entries(report.checks).map(([profile,check])=>[profile,{requestedFrames:report.verification.totalFrames,observedSamples:check.report.layout.samples.length,allFramesObserved:check.allFramesObserved,geometryFindings:check.report.layout.findings.length,runtimeFindings:check.report.runtime.findings.filter(f=>['warning','error'].includes(f.severity)).length,contrastSamples:check.report.contrast.samples,htmlHash:report.outputs[profile].htmlHash}]));
 results.push({id:model.id,name:model.label,model:model.opencode,selectedAttempt:selection.attempt,attempts,recordedTokens:attempts.reduce((sum,a)=>sum+(a.tokens?.total??0),0),recordedUSD:attempts.reduce((sum,a)=>sum+(a.cost??0),0),usageIncomplete:attempts.some(a=>a.cost===null||a.tokens?.total==null),checks});
}
await writeFile(path.join(here,'results.json'),JSON.stringify({study:'creative-authoring-v0.1',controlledComparison:false,results},null,2)+'\n');
console.log(results.map(r=>({model:r.name,attempts:r.attempts.length,selected:r.selectedAttempt,tokens:r.recordedTokens,USD:r.recordedUSD,minimum:r.usageIncomplete})));
