import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire}from'node:module';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),require=createRequire(import.meta.url);
const safe=process.env.OPENCODE_SAFE_DIR;if(!safe||!process.env.OPENCODE_CONFIG)throw Error('Set the tool-disabled OpenCode workspace/config');
const requested=new Set(process.argv.slice(2));if(!requested.size)throw Error('Specify model IDs');
const models=JSON.parse(await readFile(path.join(root,'experiments/makemydemo-v0.1/models.json'))).filter(m=>requested.has(m.id));
const brief=await readFile(path.join(here,'brief.txt'),'utf8'),grammar=await readFile(path.join(here,'grammar.txt'),'utf8');
const freeze={};for(const file of ['src/cli.mjs','src/adopt.mjs','src/provenance.mjs','src/check-policy.mjs','src/feedback.mjs','package-lock.json'])freeze[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
for(const file of ['brief.txt','grammar.txt','targeted-repair.mjs'])freeze[file]=createHash('sha256').update(await readFile(path.join(here,file))).digest('hex');
await writeFile(path.join(here,'targeted-repair-frozen-sources.json'),JSON.stringify(freeze,null,2)+'\n');
async function run(command,args,cwd,dir,prefix,deadline=0){return new Promise(resolve=>{
 const start=Date.now(),stdoutFile=createWriteStream(path.join(dir,prefix+'-stdout.txt')),stderrFile=createWriteStream(path.join(dir,prefix+'-stderr.txt'));
 const c=spawn(command,args,{cwd,shell:false,env:process.env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;
 const timer=deadline?setTimeout(()=>{timedOut=true;c.kill('SIGTERM')},deadline):null;
 c.stdout.on('data',d=>{stdout+=d;stdoutFile.write(d)});c.stderr.on('data',d=>{stderr+=d;stderrFile.write(d)});c.on('error',e=>{stderr+='\n'+e;stderrFile.write(String(e))});
 c.on('close',async(code,signal)=>{clearTimeout(timer);await Promise.all([new Promise(r=>stdoutFile.end(r)),new Promise(r=>stderrFile.end(r))]);resolve({stdout,stderr,code,signal,timedOut,durationMs:Date.now()-start})});
})}
function usage(events){const parts=events.filter(e=>e.type==='step_finish').map(e=>e.part),sum=fn=>parts.length&&parts.every(p=>typeof fn(p)==='number')?parts.reduce((n,p)=>n+fn(p),0):null;return{cost:sum(p=>p.cost),tokens:{total:sum(p=>p.tokens?.total),input:sum(p=>p.tokens?.input),output:sum(p=>p.tokens?.output),reasoning:sum(p=>p.tokens?.reasoning),cache:{read:sum(p=>p.tokens?.cache?.read),write:sum(p=>p.tokens?.cache?.write)}}}}
async function measure(model){let previous=await readFile(path.join(here,'runs',model.id,'4/source/index.html'),'utf8'),feedback=await readFile(path.join(here,'runs',model.id,'4/feedback.txt'),'utf8');feedback+='\nPrecise diagnosis: #s2-url is at left:0 inside .safe whose left edge is 120px. Its fromTo entrance starts x:-40, moving required URL content left of that parent. Reducing width does not fix the left-edge violation. Change that entrance to opacity only with x:0 throughout, or start at nonnegative x; preserve the layout and all other repaired content. Do not exempt the URL bar or its text from the layout checker. Use transform motion only. Keep caption contrast above4.5:1. If a decorative shape intentionally extends a clipped preview window, mark only that decorative shape data-layout-allow-overflow; do not exempt text or functional content. Otherwise contain its animated bounds.';for(let number=5;number<=5;number++){
 const dir=path.join(here,'runs',model.id,String(number));await mkdir(path.dirname(dir),{recursive:true});await mkdir(dir,{recursive:false});
 const repair=feedback?`\nFix these diagnostics. Return complete corrected HTML, preserving the intended design.\n${feedback}\n${previous?'Previous HTML:\n'+previous:'Previous call produced no usable source; generate the requested HTML.'}`:'';
 const prompt=brief+'\n'+grammar+repair;await writeFile(path.join(dir,'prompt.txt'),prompt);
 const variant={'deepseek-v4-1-flash':'low','glm-5-3':'low','hy4-preview':'none'}[model.id];
 const call=await run('opencode',['run',...(variant?['--variant',variant]:[]),'--pure','--agent','oneshot','--format','json','--print-logs','--log-level','WARN','--title',`FrameLang HTML ${model.id} ${number}`,'-m',model.opencode,'--dir',safe,prompt],safe,dir,'opencode',480000);
 const events=call.stdout.split('\n').flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}}),response=events.filter(e=>e.type==='text').map(e=>e.part?.text??'').join('').trim();await writeFile(path.join(dir,'response.txt'),response);
 const fence=response.match(/^```(?:html)?\s*\n([\s\S]*?)\n```$/i),answer=fence?fence[1]:response;
 const result={model:model.opencode,arm:'framelang-html',number,variant:variant??'default',...usage(events),durationMs:call.durationMs,exitCode:call.code,signal:call.signal,status:call.timedOut?'Harness deadline':call.code?'OpenCode launch/provider failure':'No response',formatViolation:Boolean(fence)};
 feedback=null;
 if(answer&&call.code===0)try{
  previous=answer;const source=path.join(dir,'source');await mkdir(path.join(source,'assets'),{recursive:true});await writeFile(path.join(source,'index.html'),answer);await copyFile(require.resolve('gsap/dist/gsap.min.js'),path.join(source,'assets/gsap.min.js'));await copyFile(path.join(root,'fonts/Inter.ttf'),path.join(source,'assets/Inter.ttf'));
  const output=path.join(dir,'compiled');
  for(const stage of ['adopt','check','render']){const args=stage==='adopt'?[stage,source,output]:[stage,output];const out=await run(process.execPath,['src/cli.mjs',...args],root,dir,stage);if(out.code){result.status=stage+' rejected';feedback=stage==='check'?await readFile(path.join(output,'feedback.json'),'utf8'):(out.stdout+out.stderr).slice(-6000);break}result.status=stage==='render'?'Rendered':stage+' passed'}
 }catch(e){result.status='Source rejected';feedback=String(e);await writeFile(path.join(dir,'error.txt'),feedback)}
 if(result.status!=='Rendered'&&!feedback)feedback=JSON.stringify({status:result.status,message:'No usable source was received; recorded usage may be unavailable. Generate complete HTML.'});
 if(feedback)await writeFile(path.join(dir,'feedback.txt'),feedback);
 await writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status==='Rendered')break;
}}
let index=0;async function worker(){while(index<models.length)await measure(models[index++])}await Promise.all([worker(),worker()]);
