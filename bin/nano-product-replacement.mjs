#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { PACKAGE, SOURCE, fail, packageInfo, readJSON, hashes } from '../src/common.mjs';
import { status, install } from '../src/lifecycle.mjs';
import { doctor, run } from '../src/doctor.mjs';
import {automaticUpdateCheck,updatePolicy} from '../src/updates.mjs';
const args=process.argv.slice(2),pos=[],opts={};
try{
 const bool=new Set(['json','yes','backup-edits']);
 const allowed=new Set([...bool,'agent','home','target-directory','mode','source','regions','output','mask-output','task-json','output-directory']);
 for(let i=0;i<args.length;i++){
  const a=args[i];if(a.startsWith('--')){const k=a.slice(2);if(k==='help'){pos.splice(0,pos.length,'help');break;}if(!allowed.has(k))fail('UNKNOWN_OPTION',a);if(Object.hasOwn(opts,k))fail('INVALID_INPUT',`Duplicate ${a}`);if(bool.has(k))opts[k]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))fail('INVALID_INPUT',`Missing ${a} value`);opts[k]=args[++i];}}else pos.push(a);
 }
 const [cmd,sub]=pos;let result;
 if(['inspect','blackout','collect'].includes(cmd)){
  const contracts={inspect:['source','regions','output-directory','json'],blackout:['source','regions','output','mask-output','json'],collect:['task-json','output-directory','json']};
  if(pos.length!==1)fail('INVALID_INPUT',`${cmd} does not accept positional arguments.`);
  for(const k of Object.keys(opts))if(!contracts[cmd].includes(k))fail('UNKNOWN_OPTION',`${cmd} does not accept --${k}.`);
 }
 if(cmd==='version')result={ok:true,name:PACKAGE,version:(await packageInfo()).version};
 else if(cmd==='capabilities')result={...await readJSON(path.resolve(import.meta.dirname,'../capabilities.json')),...await readJSON(path.join(SOURCE,'capabilities.json'))};
 else if(cmd==='doctor')result=await doctor();
 else if(cmd==='skill'){
  if(sub==='source')result={ok:true,name:'nano-product-replacement',source:SOURCE,version:(await packageInfo()).version};
  else if(sub==='status')result=await status({agent:opts.agent??'codex',home:opts.home,targetDirectory:opts['target-directory']});
  else if(['install','update'].includes(sub))result=await install({agent:opts.agent??'codex',home:opts.home,targetDirectory:opts['target-directory'],mode:opts.mode,update:sub==='update',backupEdits:opts['backup-edits']});
  else fail('INVALID_INPUT','Use skill source/status/install/update.');
 }else if(cmd==='inspect'){
  const {inspect}=await import('../src/inspect.mjs');result=await inspect({source:opts.source,regions:opts.regions,outputDirectory:opts['output-directory']});
 }else if(cmd==='blackout'){
  const {blackout}=await import('../src/images.mjs');result=await blackout({source:opts.source,regions:opts.regions,output:opts.output,maskOutput:opts['mask-output']});
 }else if(cmd==='collect'){
  const {collect}=await import('../src/images.mjs');result=await collect({taskJson:opts['task-json'],outputDirectory:opts['output-directory']});
 }else if(cmd==='update'){
  if(sub==='status'){console.log(JSON.stringify({ok:true,policy:updatePolicy()},null,2));process.exit(0);}
  if(!['check','install'].includes(sub))fail('INVALID_INPUT','Use update status/check/install.');
  const q=run('npm',['view',PACKAGE,'version','--json']);if(q.status!==0)fail('REGISTRY_UNAVAILABLE','npm registry query failed; installed files preserved.');
  const latest=JSON.parse(q.stdout),current=(await packageInfo()).version;
  result={ok:true,current,latest,update_available:current!==latest,channel:'latest'};
  if(sub==='install'){
   if(!opts.yes)fail('PERMISSION_REQUIRED','update install requires --yes.');
   if(result.update_available){
    const root=path.resolve(import.meta.dirname,'..'),prefix=run('npm',['root','-g']);
    if(prefix.status!==0||root!==path.join(prefix.stdout.trim(),'@petercjl','nano-product-replacement'))fail('DEV_CHECKOUT','Only update global npm installations; preserve development checkouts.');
    const preserved=[];
    for(const agent of ['codex','sealseek']){
     const s=await status({agent});
     if(s.managed&&s.edited?.some(k=>k!=='agents/openai.yaml'))fail('LOCAL_EDITS','Managed Skill edited; back up edits before package update.');
     if(s.managed){
      const base=path.join(os.homedir(),'.local','state','nano-product-replacement','backups');await fs.mkdir(base,{recursive:true});
      const backup=await fs.mkdtemp(path.join(base,agent+'-'));await fs.cp(await fs.realpath(s.target),backup,{recursive:true});
      if(JSON.stringify(await hashes(backup))!==JSON.stringify(await hashes(s.target)))fail('BACKUP_FAILED','Package update backup verification failed.');
      const ui=await fs.readFile(path.join(s.target,'agents/openai.yaml'));
      preserved.push({agent,mode:s.mode,backup,ui,custom:s.edited?.includes('agents/openai.yaml')});
     }
    }
    const p=run('npm',['install','-g',`${PACKAGE}@${latest}`]);if(p.status!==0)fail('UPDATE_FAILED','npm update failed; inspect installed version before retrying.');
    for(const agent of ['codex','sealseek']){const s=await status({agent});if(s.managed){const q=run(process.execPath,[path.join(root,'bin/nano-product-replacement.mjs'),'skill','update','--agent',agent,'--json']);if(q.status!==0)fail('SKILL_SYNC_FAILED','Package updated; managed Skill synchronization needs recovery.');}}
    for(const p of preserved){
     if(p.mode==='link'&&p.custom){const s=await status({agent:p.agent});await fs.writeFile(path.join(s.target,'agents/openai.yaml'),p.ui);}
    }
    result.installed=latest;result.backups=preserved.map(({agent,backup})=>({agent,backup}));
   }
  }
 }else if(!cmd||cmd==='help')result={ok:true,usage:['version','capabilities --json','doctor --json','skill source|status|install|update [--agent AGENT] [--mode link|copy] [--home AGENT_HOME | --target-directory EXACT_SKILL_DIR] [--backup-edits] --json','inspect --source FILE [--regions JSON] --output-directory NEW_DIR --json','blackout --source FILE --regions JSON --output NEW.png [--mask-output NEW.png] --json','collect --task-json JSON --output-directory NEW_DIR --json','update status|check|install [--yes] --json'],boundaries:'Local masking and collection only. Generation uses the host-selected media capability. No generation or authentication is performed by this CLI.'};
 else fail('INVALID_INPUT',`Unknown command: ${cmd}`);
 if(['inspect','blackout'].includes(cmd))result.update_check=await automaticUpdateCheck();
 console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=1;
}catch(e){console.error(JSON.stringify({ok:false,error:{code:e.code??'INTERNAL_ERROR',message:e.message}},null,2));process.exitCode=1;}
