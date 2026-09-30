import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire}from'node:module';
import {applyRepairPatch}from'../../src/repair-patch.mjs';import{assessCheck}from'../../src/check-policy.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),require=createRequire(import.meta.url);
const hf=require.resolve('hyperframes/bin/hyperframes.mjs'),gsap=require.resolve('gsap/dist/gsap.min.js');
const safe=process.env.OPENCODE_SAFE_DIR;if(!safe||!process.env.OPENCODE_CONFIG)throw Error('Set the tool-disabled OpenCode workspace/config');
const requested=new Set(process.argv.slice(2));if(!requested.size)throw Error('Specify model IDs for the bounded study');
const models=JSON.parse(await readFile(path.join(root,'experiments/makemydemo-v0.1/models.json'))).filter(m=>requested.has(m.id));
const brief=await readFile(path.join(here,'brief.txt'),'utf8');const frames=Array.from({length:192},(_,i)=>i/24);
async function run(command,args,cwd,deadline=0){return new Promise(resolve=>{const start=Date.now(),c=spawn(command,args,{cwd,shell:false,env:process.env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;const timer=deadline?setTimeout(()=>{timedOut=true;c.kill('SIGTERM')},deadline):null;c.stdout.on('data',d=>stdout+=d);c.stderr.on('data',d=>stderr+=d);c.on('error',e=>stderr+='\n'+e);c.on('close',(code,signal)=>{clearTimeout(timer);resolve({stdout,stderr,code,signal,timedOut,durationMs:Date.now()-start})})})}
function parseReport(stdout){return JSON.parse(stdout.slice(stdout.indexOf('{'),stdout.lastIndexOf('}')+1))}
function usage(events){const parts=events.filter(e=>e.type==='step_finish').map(e=>e.part),sum=fn=>parts.length&&parts.every(p=>typeof fn(p)==='number')?parts.reduce((n,p)=>n+fn(p),0):null;return{cost:sum(p=>p.cost),tokens:{total:sum(p=>p.tokens?.total),input:sum(p=>p.tokens?.input),output:sum(p=>p.tokens?.output),reasoning:sum(p=>p.tokens?.reasoning),cache:{read:sum(p=>p.tokens?.cache?.read),write:sum(p=>p.tokens?.cache?.write)}}}}
function guardHTML(html){const local=html.replace(/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/g,'');if(!/^<!doctype html/i.test(html.trim())||!/id=["']root["']/i.test(html))throw Error('Complete HyperFrames HTML required');if(/https?:\/\/|data:|blob:|<iframe|<object|<embed|<link\b|@import|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|eval\s*\(|new\s+Function|import\s*\(|setTimeout|setInterval|requestAnimationFrame|Math.random|Date.now/i.test(local))throw Error('Nonlocal or nondeterministic HTML');const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]);if(scripts.length!==1||scripts[0]!=='assets/gsap.min.js')throw Error('Use only the frozen GSAP script')}
async function measure(model,arm){const grammar=await readFile(path.join(here,arm+'.txt'),'utf8');let previous=null,feedback=null;for(let number=1;number<=1;number++){
 const dir=path.join(here,'runs',model.id,arm,String(number));await mkdir(path.dirname(dir),{recursive:true});await mkdir(dir,{recursive:false});
 const repair=feedback?(arm==='framelang'?(previous?`\nRepair only the failed fields. Return a JSON object with only a patch key containing JSON Patch operations (add/remove/replace, JSON Pointer paths, at most16operations). Use ordinary JSON quotes, not escaped quote text. Do not regenerate the program.\n${feedback}\nPrevious JSON:\n${JSON.stringify(previous)}`:`\nReturn the complete JSON program required above. Previous answer was invalid:\n${feedback}`):`\nFix these diagnostics and return the complete HTML.\n${feedback}\nPrevious HTML:\n${previous}`):'';
 const prompt=brief+'\n'+grammar+repair;await writeFile(path.join(dir,'prompt.txt'),prompt);
 const variant={'deepseek-v4-1-flash':'low','glm-5-3':'low','hy4-preview':'none'}[model.id];
 const call=await run('opencode',['run',...(variant?['--variant',variant]:[]),'--pure','--agent','oneshot','--format','json','--print-logs','--log-level','WARN','--title',`FrameLang matched ${model.id} ${arm} ${number}`,'-m',model.opencode,'--dir',safe,prompt],safe,480000);
 await writeFile(path.join(dir,'opencode-events.jsonl'),call.stdout);await writeFile(path.join(dir,'opencode-stderr.txt'),call.stderr);
 const events=call.stdout.split('\n').flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}}),response=events.filter(e=>e.type==='text').map(e=>e.part?.text??'').join('').trim();await writeFile(path.join(dir,'response.txt'),response);
 const fence=response.match(/^```(?:json|html)?\s*\n([\s\S]*?)\n```$/i),answer=fence?fence[1]:response;
 const result={model:model.opencode,arm,number,variant:variant??'default',...usage(events),durationMs:call.durationMs,exitCode:call.code,signal:call.signal,status:call.timedOut?'Harness deadline':call.code?'OpenCode launch/provider failure':'No response',formatViolation:Boolean(fence)};
 if(answer&&call.code===0)try{
  if(arm==='framelang'){
   const parsed=JSON.parse(answer);previous=number===1||!previous?parsed:applyRepairPatch(previous,parsed.patch);await writeFile(path.join(dir,'program.json'),JSON.stringify(previous,null,2));await copyFile(path.join(root,'experiments/makemydemo-v0.1/bundle.json'),path.join(dir,'bundle.json'));
   for(const stage of ['lint','compile','check','render']){const args=stage==='lint'?[stage,path.join(dir,'program.json')]:stage==='compile'?[stage,path.join(dir,'program.json'),path.join(dir,'compiled')]:[stage,path.join(dir,'compiled')];const out=await run(process.execPath,['src/cli.mjs',...args],root);await writeFile(path.join(dir,stage+'.log'),out.stdout+out.stderr);if(out.code){result.status=stage+' rejected';if(stage==='check'){const f=JSON.parse(await readFile(path.join(dir,'compiled/feedback.json')));feedback=JSON.stringify({findings:f.findings.map(({code,location,message,hint})=>({code,location,message,hint}))})}else{try{const f=parseReport(out.stdout);feedback=JSON.stringify({findings:f.findings??f})}catch{feedback=(out.stdout+out.stderr).slice(-6000)}}break}result.status=stage==='render'?'Rendered':stage+' passed'}
  }else{
   previous=answer;const target=path.join(dir,'source');await mkdir(path.join(target,'assets'),{recursive:true});await writeFile(path.join(target,'index.html'),answer);await copyFile(gsap,path.join(target,'assets/gsap.min.js'));await copyFile(path.join(root,'fonts/Inter.ttf'),path.join(target,'assets/Inter.ttf'));
   const output=path.join(dir,'compiled');
   for(const stage of ['adopt','check','render']){const args=stage==='adopt'?[stage,target,output]:[stage,output];const out=await run(process.execPath,['src/cli.mjs',...args],root);await writeFile(path.join(dir,stage+'.txt'),out.stdout+out.stderr);if(out.code){result.status=stage+' rejected';feedback=stage==='check'?await readFile(path.join(output,'feedback.json'),'utf8'):(out.stdout+out.stderr).slice(-6000);break}result.status=stage==='render'?'Rendered':stage+' passed'}
  }
 }catch(e){result.status='Source rejected';feedback=String(e);await writeFile(path.join(dir,'error.txt'),feedback)}
 if(feedback)await writeFile(path.join(dir,'feedback.txt'),feedback);
 await writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status==='Rendered'||!feedback)break;
}}
// Same variants and max2attempts per arm. Alternate first arm to reduce ordering bias.
let index=0;async function worker(){while(index<models.length){const i=index++,model=models[i];for(const arm of ['raw'])await measure(model,arm)}}await Promise.all([worker(),worker()]);
