import {readFile,writeFile,mkdir,copyFile}from'node:fs/promises';import{spawnSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),frontend=path.resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Pass frontend directory');
const summary=JSON.parse(await readFile(path.join(here,'summary.json'))),references=JSON.parse(await readFile(path.join(frontend,'src/data/framelangCreativeComparisons.json')));
const rows=[];
for(const model of summary){
 const reference=references.find(r=>r.id===model.id);if(!reference)throw Error(`Missing frozen raw reference: ${model.id}`);
 const sample={status:model.accepted?(model.accepted.replay?'Rendered · prior source replay':'Rendered'):(model.attempts.at(-1)?.status??'Not run'),attempts:model.attempts.map(a=>({number:a.number,status:a.status,tokens:a.tokens,cost:a.cost})),firstRenderedAttempt:model.accepted?.number??null,previewKind:'model'};
 if(model.accepted){
  const accepted=path.resolve(here,model.accepted.directory),report=JSON.parse(await readFile(path.join(accepted,'compile-report.json')));
  if(!report.checked||!Object.values(report.checks).every(c=>c.ok&&c.allFramesObserved))throw Error(`Incomplete frame checks: ${model.id}`);
  const video=model.accepted.replay?path.join(accepted,'video.mp4'):path.join(accepted,'renders/source-1920x1080/video.mp4');
  const target=path.join(frontend,'public/framelang/v0.1/html-five',model.id);await mkdir(target,{recursive:true});await copyFile(video,path.join(target,'landscape.mp4'));
  const poster=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','3.4','-i',video,'-frames:v','1','-q:v','2',path.join(target,'landscape.jpg')],{encoding:'utf8'});if(poster.status)throw Error(poster.stderr);
  sample.video=`/framelang/v0.1/html-five/${model.id}/landscape.mp4`;sample.poster=`/framelang/v0.1/html-five/${model.id}/landscape.jpg`;sample.checkedFrames=report.verification.totalFrames;
 }
 rows.push({id:model.id,name:model.label,license:model.license,source:model.source,withFramework:sample,withoutFramework:reference.withoutFramework});
}
await writeFile(path.join(frontend,'src/data/framelangHtmlComparisons.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({id:r.id,status:r.withFramework.status,attempts:r.withFramework.attempts.length,video:r.withFramework.video??null}))));
