import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import * as life from '../lifecycle/engine.mjs';
const temp=t=>{const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'managed-lifecycle-')));const key=life.config.env+'_STATE_DIR',prev=process.env[key];process.env[key]=path.join(dir,'state');t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;fs.rmSync(dir,{recursive:true,force:true});});return dir;};
const target=(dir,name='target')=>life.resolveTarget({agent:'future-agent',path:path.join(dir,name)});
const run=(args,env={})=>spawnSync(process.execPath,[path.join(life.root,life.config.entry),...args],{encoding:'utf8',timeout:90000,env:{...process.env,[life.config.env+'_AUTO_UPDATE']:'0',...env}});

test('automatic detection defaults to notify, caches persistently, handles offline and opt-out',async t=>{
 const autoKey=life.config.env+'_AUTO_UPDATE',autoPrev=process.env[autoKey];process.env[autoKey]='1';t.after(()=>{if(autoPrev===undefined)delete process.env[autoKey];else process.env[autoKey]=autoPrev;});
 const dir=temp(t),r=target(dir);const key=life.config.env+'_STATE_DIR',prev=process.env[key];process.env[key]=path.join(dir,'state');t.after(()=>{if(prev===undefined)delete process.env[key];else process.env[key]=prev;});let calls=0;
 const probe=async()=>{calls++;return '99.0.0';};const first=await life.automatic(r,{probe,now:10000000});assert.equal(first.state,'update-available');assert.equal(fs.existsSync(r.target),false);
 assert.equal((await life.automatic(r,{probe,now:10000001})).state,'cached');assert.equal(calls,1);
 const offline=await life.automatic(r,{probe:async()=>{throw Error('offline');},now:200000000});assert.equal(offline.state,'offline');
 assert.equal(life.policy({mode:'off',yes:true},r).mode,'off');assert.equal((await life.automatic(r,{probe})).state,'disabled');
});
test('automatic installation requires independent authorization and compatible stable versions',t=>{
 const dir=temp(t),r=target(dir);assert.equal(life.compatible('0.6.9','0.6.8'),true);assert.equal(life.compatible('0.7.0','0.6.8'),false);assert.equal(life.compatible('2.0.0','1.9.0'),false);assert.equal(life.compatible('1.9.1','1.9.0'),true);assert.equal(life.compatible('1.9.1-beta.0','1.9.0'),false);
 assert.throws(()=>life.policy({mode:'auto'},r),{code:'PERMISSION_REQUIRED'});assert.throws(()=>life.policy({mode:'auto',yes:true}),{code:'TARGET_PATH_REQUIRED'});
});

test('generic and arbitrary named hosts require explicit own destination before any mutation',t=>{
 const dir=temp(t);for(const agent of ['generic','codex','sealseek','future-agent']){
  assert.throws(()=>life.resolveTarget({agent}),{code:'TARGET_PATH_REQUIRED'});
  assert.equal(life.resolveTarget({agent,path:path.join(dir,agent)}).agent,agent);
 }
 for(const agent of ['../host','Bad Agent','__proto__',''])assert.throws(()=>life.resolveTarget({agent,path:path.join(dir,'x')}),{code:'INVALID_TARGET'});
 assert.throws(()=>life.resolveTarget({path:dir,root:dir}),{code:'CONFLICTING_TARGET'});
 const before=fs.readdirSync(dir);const r=run(['update','install','--yes','--agent','future-agent','--json']);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).code,'TARGET_PATH_REQUIRED');assert.deepEqual(fs.readdirSync(dir),before);
});
test('bootstrap source, duplicate and unknown arguments are read-only',t=>{
 const dir=temp(t),r=run(['skill','source','--json']);assert.equal(r.status,0,r.stderr+r.stdout);const body=JSON.parse(r.stdout);assert.equal(body.source,life.source);assert.equal(body.installationLifecycle.agentNeutral,true);
 for(const a of [['skill','install','--path',dir,'--path',dir],['skill','install','--wat'],['skill','install','--path'],['skill','source','--root',dir],['skill','install','extra','--path',dir]])assert.equal(run(a).status,1,JSON.stringify(a));
 assert.equal(run(['skill','install','--help']).status,0);assert.deepEqual(fs.readdirSync(dir),[]);
});

test('read-only status and version reject mutating or unknown flags before writing',t=>{
 const dir=temp(t),before=fs.readdirSync(dir);const r=run(['update','status','--path',path.join(dir,'target'),'--mode','auto','--yes']);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).code,'INVALID_ARGUMENT');assert.deepEqual(fs.readdirSync(dir),before);
 const version=run(['version','--unknown']);assert.equal(version.status,1);assert.equal(JSON.parse(version.stdout).code,'INVALID_ARGUMENT');
});
