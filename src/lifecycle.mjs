import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SOURCE, PACKAGE, exists, fail, hashes, packageInfo, readJSON, writeNew } from './common.mjs';
const MARKER='.nano-install.json';
export function targetFor(agent,home){
 if(!['codex','sealseek'].includes(agent))fail('UNKNOWN_TARGET','Use codex or sealseek.');
 const base=home??(agent==='codex'?(process.env.CODEX_HOME||path.join(os.homedir(),'.codex')):path.join(os.homedir(),'.sealseek'));
 return path.resolve(base,'skills','nano-product-replacement');
}
export async function status({agent='codex',home,source=SOURCE}={}){
 const target=targetFor(agent,home),st=await exists(target);
 if(!st)return {ok:true,installed:false,managed:false,target,source};
 if(st.isSymbolicLink()){
  const actual=await fs.realpath(target).catch(()=>null),expected=await fs.realpath(source);
  return {ok:true,installed:true,managed:actual===expected,mode:'link',target,source,actual,up_to_date:actual===expected};
 }
 const m=await readJSON(path.join(target,MARKER)).catch(()=>null);
 if(m?.package!==PACKAGE)return {ok:true,installed:true,managed:false,target,source};
 const current=await hashes(target),canonical=await hashes(source);
 const edited=Object.keys({...current,...m.hashes}).filter(k=>current[k]!==m.hashes[k]);
 return {ok:true,installed:true,managed:true,mode:'copy',target,source,version:m.version,edited,up_to_date:Object.keys({...current,...canonical}).every(k=>k==='agents/openai.yaml'||current[k]===canonical[k])};
}
export async function install({agent='codex',home,mode=(process.platform==='win32'?'copy':'link'),source=SOURCE,update=false,backupEdits=false,forceInPlace=false}={}){
 if(!['copy','link'].includes(mode))fail('INVALID_INPUT','mode must be copy or link.');
 const s=await status({agent,home,source}),target=s.target;
 if(s.installed&&!s.managed)fail('UNMANAGED_TARGET',`Preserving unrelated installation: ${target}`);
 if(s.installed&&s.mode==='link')return {...s,changed:false};
 if(s.installed&&!update)return {...s,changed:false};
 if(s.edited?.some(k=>k!=='agents/openai.yaml')&&!backupEdits)fail('LOCAL_EDITS','Managed files changed. Use skill update --backup-edits to save a complete backup first.');
 if(s.up_to_date&&update&&!s.edited?.length)return {...s,changed:false};
 const pkg=await packageInfo();let backup=null;
 await fs.mkdir(path.dirname(target),{recursive:true});
 if(!s.installed&&mode==='link'){
  await fs.symlink(source,target,process.platform==='win32'?'junction':'dir');
  return {...await status({agent,home,source}),changed:true};
 }
 const stage=await fs.mkdtemp(path.join(path.dirname(target),'.nano-stage-'));
 try{
  await fs.cp(source,stage,{recursive:true,errorOnExist:false,force:false});
  if(s.installed&&await exists(path.join(target,'agents/openai.yaml'))){
   const yaml=await fs.readFile(path.join(target,'agents/openai.yaml'));
   // Stage was created by this operation, so replacing its copied metadata is owned.
   await fs.writeFile(path.join(stage,'agents/openai.yaml'),yaml);
  }
  const meta={package:PACKAGE,version:pkg.version,source,hashes:await hashes(stage)};
  await writeNew(path.join(stage,MARKER),JSON.stringify(meta,null,2)+'\n');
  if(s.installed){
   backup=await fs.mkdtemp(path.join(path.dirname(target),'.nano-backup-'));
   await fs.cp(target,backup,{recursive:true,errorOnExist:false,force:false});
   if(JSON.stringify(await hashes(backup))!==JSON.stringify(await hashes(target)))fail('BACKUP_FAILED','Backup hash verification failed.');
   try {if(forceInPlace)throw Object.assign(new Error('locked directory'),{code:'EPERM'});await fs.rename(target,`${backup}-original`);}
   catch(e){
    if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;
    // Backup is complete; sync a locked managed directory in place and restore on error.
    try {await syncInto(stage,target);}
    catch(e2){await syncInto(backup,target);throw e2;}
    await fs.rm(stage,{recursive:true,force:true});
    return {...await status({agent,home,source}),changed:true,backup,in_place:true};
   }
  }
  try{await fs.rename(stage,target);}catch(e){if(s.installed)await fs.rename(`${backup}-original`,target);throw e;}
  if(s.installed)await fs.rm(`${backup}-original`,{recursive:true,force:true});
  const result=await status({agent,home,source});
  if(!result.managed||result.edited?.length)fail('INSTALL_VERIFY_FAILED','Installed hashes differ.');
  return {...result,changed:true,backup};
 }finally{await fs.rm(stage,{recursive:true,force:true});}
}
async function syncInto(from,to){
 for(const entry of await fs.readdir(to))await fs.rm(path.join(to,entry),{recursive:true,force:true});
 await fs.cp(from,to,{recursive:true,force:true});
 if(JSON.stringify(await hashes(from))!==JSON.stringify(await hashes(to)))fail('INSTALL_VERIFY_FAILED','In-place sync hash mismatch.');
}
