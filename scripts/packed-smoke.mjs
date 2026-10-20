import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nano-packed-'));
function run(exe,args,cwd=process.cwd(),env=process.env){const r=spawnSync(exe,args,{cwd,env,encoding:'utf8',timeout:120000,windowsHide:true,shell:process.platform==='win32'&&exe==='npm'});if(r.status!==0)throw Error(`${exe} ${args.join(' ')}: ${r.stderr||r.stdout}`);return r.stdout;}
try{
 const pack=JSON.parse(run('npm',['pack','--json','--pack-destination',dir]))[0];
 for(const f of pack.files)assert.ok(!/^(test|dev|scripts|\.github)\//.test(f.path),`Private/dev file packed: ${f.path}`);
 const prefix=path.join(dir,'install');run('npm',['install','--prefix',prefix,'--no-audit','--no-fund',path.join(dir,pack.filename)]);
 const root=path.join(prefix,'node_modules','@petercjl','nano-product-replacement'),cli=path.join(root,'bin','nano-product-replacement.mjs');
 const call=(...a)=>JSON.parse(run(process.execPath,[cli,...a]));
 assert.equal(call('version').version,pack.version);
 const source=call('skill','source').source;assert.ok(await fs.stat(path.join(source,'SKILL.md')));
 const home=path.join(dir,'agent');assert.equal(call('skill','install','--home',home,'--mode','copy').managed,true);assert.equal(call('skill','install','--home',home).changed,false);assert.equal(call('skill','status','--home',home).up_to_date,true);
 assert.equal(call('doctor').local_ready,true);
 const sharp=(await import('sharp')).default;
 const input=path.join(dir,'原图.png'),regions=path.join(dir,'区域.json'),output=path.join(dir,'涂黑.png');
 await fs.writeFile(input,await sharp({create:{width:60,height:40,channels:3,background:'pink'}}).png().toBuffer(),{flag:'wx'});
 await fs.writeFile(regions,JSON.stringify({coordinate_width:60,coordinate_height:40,cover:[{points:[[5,5],[50,5],[50,35],[5,35]]}]}),{flag:'wx'});
 assert.equal(call('blackout','--source',input,'--regions',regions,'--output',output).width,60);
 const task=path.join(dir,'task.json');await fs.writeFile(task,JSON.stringify({status:'succeeded',artifacts:[{path:output},{path:input}]}),{flag:'wx'});
 const report=call('collect','--task-json',task,'--output-directory',path.join(dir,'delivery'));assert.equal(report.actual_count,2);assert.ok(await fs.stat(report.comparison));
 // Installed entry has no development tools. Missing native runtime must be explicit.
 const module=path.join(prefix,'node_modules','sharp'),hidden=path.join(prefix,'node_modules','.sharp-disabled');await fs.rename(module,hidden);
 const missing=spawnSync(process.execPath,[cli,'doctor'],{encoding:'utf8',timeout:30000});assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).local_ready,false);await fs.rename(hidden,module);
 console.log(JSON.stringify({ok:true,package:pack.name,version:pack.version,files:pack.files.map(f=>f.path),packed_install:'pass',local_output:'pass',missing_dependency:'pass'},null,2));
}finally{await fs.rm(dir,{recursive:true,force:true});}
