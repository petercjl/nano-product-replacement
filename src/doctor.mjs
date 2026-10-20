import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SOURCE, packageInfo } from './common.mjs';
export function run(exe,args){return spawnSync(exe,args,{encoding:'utf8',timeout:30000,windowsHide:true,shell:process.platform==='win32'&&exe==='npm'});}
export async function doctor({probe=run}={}){
 const checks=[{id:'node',ok:Number(process.versions.node.split('.')[0])>=22,value:process.version}];
 try{const sharp=(await import('sharp')).default;const b=await sharp({create:{width:2,height:2,channels:3,background:'black'}}).png().toBuffer();checks.push({id:'sharp',ok:b.length>0,value:sharp.versions.sharp});}catch(e){checks.push({id:'sharp',ok:false,value:e.code??e.message});}
 try{const s=await fs.readFile(path.join(SOURCE,'SKILL.md'),'utf8');checks.push({id:'canonical-skill',ok:s.includes('name: nano-product-replacement')});}catch{checks.push({id:'canonical-skill',ok:false});}
 const p=probe('sealseek-media',['skill','source','--json']);
 let source;
 try{const j=JSON.parse(p.stdout);source=j.source;if(!j.ok||!source)throw Error();const text=await fs.readFile(path.join(source,'SKILL.md'),'utf8');checks.push({id:'sealseek-media',ok:text.includes('name: sealseek-media'),value:source});}catch{checks.push({id:'sealseek-media',ok:false,value:'Install @petercjl/sealseek-media-cli for explicit SealSeek generation.'});}
 const local=checks.filter(c=>c.id!=='sealseek-media').every(c=>c.ok);
 return {ok:local,version:(await packageInfo()).version,local_ready:local,generation_dependency_ready:checks.find(c=>c.id==='sealseek-media').ok,authentication:'not-checked',checks};
}
