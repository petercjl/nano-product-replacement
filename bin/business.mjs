#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { PACKAGE, SOURCE, fail, packageInfo, readJSON, hashes } from '../src/common.mjs';

import { doctor, run } from '../src/doctor.mjs';

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
 else if(cmd==='inspect'){
  const {inspect}=await import('../src/inspect.mjs');result=await inspect({source:opts.source,regions:opts.regions,outputDirectory:opts['output-directory']});
 }else if(cmd==='blackout'){
  const {blackout}=await import('../src/images.mjs');result=await blackout({source:opts.source,regions:opts.regions,output:opts.output,maskOutput:opts['mask-output']});
 }else if(cmd==='collect'){
  const {collect}=await import('../src/images.mjs');result=await collect({taskJson:opts['task-json'],outputDirectory:opts['output-directory']});
 }else if(!cmd||cmd==='help')result={ok:true,usage:['version','capabilities --json','doctor --json','skill source|status|install|update [--agent AGENT] [--mode link|copy] [--home AGENT_HOME | --target-directory EXACT_SKILL_DIR] [--backup-edits] --json','inspect --source FILE [--regions JSON] --output-directory NEW_DIR --json','blackout --source FILE --regions JSON --output NEW.png [--mask-output NEW.png] --json','collect --task-json JSON --output-directory NEW_DIR --json','update status|check|install [--yes] --json'],boundaries:'Local masking and collection only. Generation uses the host-selected media capability. No generation or authentication is performed by this CLI.'};
 else fail('INVALID_INPUT',`Unknown command: ${cmd}`);

 console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=1;
}catch(e){console.error(JSON.stringify({ok:false,error:{code:e.code??'INTERNAL_ERROR',message:e.message}},null,2));process.exitCode=1;}
