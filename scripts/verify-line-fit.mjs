import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=path.resolve('out/line-fit-regression');await mkdir(dir,{recursive:true});
await copyFile('experiments/makemydemo-v0.1/bundle.json',path.join(dir,'bundle.json'));
const program={language:'framelang/creative-v0.1',profiles:['landscape-1920x1080'],scenes:[{id:'line-fit',durationFrames:48,nodes:[{id:'line',text:'A readable single line',rect:[0,0,1000,300],style:{size:64,minSize:64,maxLines:1,lineHeight:'tight'},motion:'none'}]}]};
async function verify(expected){await writeFile(path.join(dir,'program.json'),JSON.stringify(program));for(const stage of ['compile','check']){const args=stage==='compile'?[stage,path.join(dir,'program.json'),path.join(dir,'compiled')]:[stage,path.join(dir,'compiled')];const result=spawnSync(process.execPath,['src/cli.mjs',...args],{encoding:'utf8'});if(stage==='compile'&&result.status!==0)throw new Error(result.stderr);if(stage==='check'&&(result.status===0)!==expected)throw new Error(result.stdout+result.stderr);}return JSON.parse(await readFile(path.join(dir,'compiled','feedback.json'),'utf8'));}
await verify(true);
program.scenes[0].nodes[0].text='This text must occupy several lines at the required minimum size';program.scenes[0].nodes[0].rect=[0,0,200,1000];
const feedback=await verify(false);if(!feedback.findings.some(f=>f.code==='geometry.textFit'&&f.location==='$.scenes[0].nodes[0]'))throw new Error('Missing authored text-fit diagnostic');
program.scenes[0].nodes=[{id:'flow',kind:'flow',variant:'chain',steps:['Paste URL','AI-written script','Product visuals'],outcome:'Video first cut',rect:[0,0,1000,500],portrait:[0,0,1000,300],motion:'stagger'}];program.profiles=['portrait-1080x1920'];
await verify(true);
console.log('Measured single-line typography passes, excess lines fail, and an animated portrait chain fits its owned rectangle.');
