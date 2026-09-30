import {readFile,readdir,writeFile} from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const models=JSON.parse(await readFile(path.join(root,'experiments/makemydemo-v0.1/models.json')));
const rows=[];
for(const model of models){
 let attempts=[],accepted=null;
 if(model.id==='glm-5-3'){
  const result=JSON.parse(await readFile(path.join(root,'experiments/guarded-html-v0.1/runs/glm-5-3/raw/1/result.json')));
  attempts=[{...result,status:'Prior source rejected → unchanged replay rendered',replay:true}];
  accepted={directory:'../guarded-html-v0.1/replay/glm-5-3',number:1,replay:true};
 }else{
  let dirs=[];try{dirs=(await readdir(path.join(here,'runs',model.id))).sort((a,b)=>Number(a)-Number(b))}catch{}
  for(const dir of dirs)try{const result=JSON.parse(await readFile(path.join(here,'runs',model.id,dir,'result.json')));attempts.push(result);if(result.status==='Rendered')accepted={directory:`runs/${model.id}/${dir}/compiled`,number:result.number,replay:false}}catch{}
 }
 const costKnown=attempts.some(a=>a.cost!==null),tokensKnown=attempts.some(a=>a.tokens?.total!=null);
 rows.push({...model,attempts,accepted,costComplete:attempts.length>0&&attempts.every(a=>a.cost!==null),inferenceUSD:costKnown?attempts.reduce((n,a)=>n+(a.cost??0),0):null,tokensComplete:attempts.length>0&&attempts.every(a=>a.tokens?.total!=null),totalTokens:tokensKnown?attempts.reduce((n,a)=>n+(a.tokens?.total??0),0):null});
}
await writeFile(path.join(here,'summary.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({id:r.id,attempts:r.attempts.length,accepted:r.accepted,cost:r.inferenceUSD,costComplete:r.costComplete,tokens:r.totalTokens}))));
