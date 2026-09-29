import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {treeFingerprint,verifyCompositionInventory} from '../src/provenance.mjs';
test('effective runtime edits invalidate fingerprint even when launcher is unchanged',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'framelang-pin-'));
 try{await mkdir(path.join(dir,'dist'));await writeFile(path.join(dir,'launcher.js'),'import("./dist/cli.js")');await writeFile(path.join(dir,'dist/cli.js'),'v1');const before=await treeFingerprint(dir);assert.equal(await treeFingerprint(dir),before);await writeFile(path.join(dir,'dist/cli.js'),'v2');assert.notEqual(await treeFingerprint(dir),before);}finally{await rm(dir,{recursive:true,force:true})}
});
test('unsealed root inputs including renderer config invalidate admission',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'framelang-inventory-'));
 try{await mkdir(path.join(dir,'assets'));await writeFile(path.join(dir,'index.html'),'source');await verifyCompositionInventory(dir);await writeFile(path.join(dir,'hyperframes.json'),'{}');await assert.rejects(verifyCompositionInventory(dir),/inventory changed/);}finally{await rm(dir,{recursive:true,force:true})}
});
