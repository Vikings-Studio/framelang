import {createHash} from 'node:crypto';
import {readdir,lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
export async function treeFingerprint(directory) {
  const hash=createHash('sha256');
  async function visit(dir,prefix='') {
    for(const name of (await readdir(dir)).sort()) {
      const file=path.join(dir,name),relative=prefix+name,stat=await lstat(file);
      if(stat.isSymbolicLink()) throw Error(`unsealed runtime symlink: ${relative}`);
      if(stat.isDirectory()) await visit(file,relative+'/');
      else if(stat.isFile()) {const bytes=await readFile(file);hash.update(JSON.stringify([relative,bytes.length]));hash.update(bytes);}
      else throw Error(`unsupported runtime input: ${relative}`);
    }
  }
  await visit(directory);return `sha256:${hash.digest('hex')}`;
}
export async function verifyCompositionInventory(directory) {
  const entries=(await readdir(directory)).sort();
  if(JSON.stringify(entries)!==JSON.stringify(['assets','index.html'])) throw Error('composition input inventory changed; re-adopt and recheck before rendering');
  for(const name of entries) if((await lstat(path.join(directory,name))).isSymbolicLink()) throw Error('composition input symlink changed; re-adopt and recheck before rendering');
}
