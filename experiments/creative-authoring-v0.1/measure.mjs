import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../..');
const selected=new Set(process.argv.slice(2));
const models=JSON.parse(await readFile(path.join(root,'experiments/makemydemo-v0.1/models.json'),'utf8')).filter(model=>!selected.size||selected.has(model.id));
const prompt=await readFile(path.resolve(here,process.env.FRAMELANG_PROMPT || 'PROMPT.txt'),'utf8');
const safe=process.env.OPENCODE_SAFE_DIR;
if (!safe || !process.env.OPENCODE_CONFIG) throw new Error('Set OPENCODE_SAFE_DIR and OPENCODE_CONFIG to a tool-disabled local OpenCode workspace.');
async function run(cmd,args,cwd,timeout=0){return new Promise((resolve,reject)=>{const start=Date.now();const c=spawn(cmd,args,{cwd,shell:false,env:{...process.env,OPENCODE_CONFIG:process.env.OPENCODE_CONFIG},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',d=>stdout+=d);c.stderr.on('data',d=>stderr+=d);c.on('error',reject);let timedOut=false;const timer=timeout?setTimeout(()=>{timedOut=true;c.kill('SIGTERM')},timeout):null;c.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,timedOut,durationMs:Date.now()-start,stdout,stderr})})})}
async function attempt(model,number,feedback){
 const dir=path.join(here,'runs',model.id,String(number));await mkdir(path.dirname(dir),{recursive:true});await mkdir(dir,{recursive:false});
 const request=feedback?`${prompt}\nRevise your previous JSON using this validation or visual feedback. Preserve your design and fix the reported issue; return the full JSON only.\n${feedback}`:prompt;
 await writeFile(path.join(dir,'prompt.txt'),request);
 const variant = {'deepseek-v4-1-flash':'low','glm-5-3':'low','hy4-preview':'none'}[model.id];
 const call=await run('opencode',['run',...(variant?['--variant',variant]:[]),'--pure','--agent','oneshot','--format','json','--print-logs','--log-level','WARN','--title',`FrameLang creative ${model.id} ${number}`,'-m',model.opencode,'--dir',safe,request],safe,480000);
 await writeFile(path.join(dir,'opencode-events.jsonl'),call.stdout);await writeFile(path.join(dir,'opencode-stderr.txt'),call.stderr);
 const events=call.stdout.split('\n').flatMap(x=>{try{return[JSON.parse(x)]}catch{return[]}});const raw=events.filter(e=>e.type==='text').map(e=>e.part?.text??'').join('');await writeFile(path.join(dir,'response.txt'),raw);
 const finishes=events.filter(e=>e.type==='step_finish');const tokens=finishes.length?{total:0,input:0,output:0,reasoning:0,cache:{read:0,write:0}}:null;let cost=finishes.length?0:null;
 for(const e of finishes){for(const key of ['total','input','output','reasoning'])tokens[key]=tokens[key]===null||typeof e.part?.tokens?.[key]!=='number'?null:tokens[key]+e.part.tokens[key];for(const key of ['read','write'])tokens.cache[key]=tokens.cache[key]===null||typeof e.part?.tokens?.cache?.[key]!=='number'?null:tokens.cache[key]+e.part.tokens.cache[key];cost=cost===null||typeof e.part?.cost!=='number'?null:cost+e.part.cost;}
 const result={number,model:model.opencode,variant:variant??'default',status:call.timedOut?'Harness deadline':call.code?'Provider error':'No response',durationMs:call.durationMs,exitCode:call.code,signal:call.signal,tokens,cost};let feedbackNext=null;
 if(raw&&call.code===0){
  const fence=raw.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);result.formatViolation=Boolean(fence);
  let parsedJSON=false;try{const program=JSON.parse(fence?fence[1]:raw);parsedJSON=true;await writeFile(path.join(dir,'program.json'),JSON.stringify(program,null,2)+'\n');await copyFile(path.join(root,'experiments/makemydemo-v0.1/bundle.json'),path.join(dir,'bundle.json'));
   for(const stage of ['lint','compile','check','render']){
    const args=stage==='lint'?['src/cli.mjs','lint',path.join(dir,'program.json')]:stage==='compile'?['src/cli.mjs','compile',path.join(dir,'program.json'),path.join(dir,'compiled')]:['src/cli.mjs',stage,path.join(dir,'compiled')];
    const v=await run(process.execPath,args,root);await writeFile(path.join(dir,stage+'.log'),v.stdout+v.stderr);
    if(v.code){result.status=stage+' rejected';feedbackNext=stage==='check'?await readFile(path.join(dir,'compiled/feedback.json'),'utf8'):v.stdout+v.stderr;break;}
    result.status=stage==='render'?'Rendered':stage+' passed';
   }
  }catch(e){result.status=parsedJSON?'Harness operation failed':'Invalid JSON';feedbackNext=String(e);await writeFile(path.join(dir,'error.txt'),String(e));}
 }
 await writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(model.id,number,result.status,'tokens',tokens?.total,'cost',cost);
 return {result,feedback:feedbackNext?feedbackNext+'\nPrevious JSON:\n'+raw:null};
}
const first=Number(process.env.FRAMELANG_FIRST_ATTEMPT || 1), limit=Number(process.env.FRAMELANG_MAX_ATTEMPTS || 2);
if(!Number.isInteger(first)||first<1||!Number.isInteger(limit)||limit<1||limit>5)throw new Error('Invalid attempt range');
let index=0;async function worker(){while(index<models.length){const model=models[index++];let feedback=null;for(let n=first;n<first+limit;n++){const current=await attempt(model,n,feedback);if(current.result.status==='Rendered'||!current.feedback)break;feedback=current.feedback;}}}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await Promise.all([worker(),worker()]);
export {attempt,models,here};
