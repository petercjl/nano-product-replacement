import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { blackout, collect } from '../src/images.mjs';
import { install, status, targetFor } from '../src/lifecycle.mjs';
import { SOURCE, hash, writeNew } from '../src/common.mjs';
import { doctor } from '../src/doctor.mjs';
process.env.NANO_PRODUCT_REPLACEMENT_UPDATE_CHECK='0';
async function temp(t){const p=await fs.mkdtemp(path.join(os.tmpdir(),'nano-test-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));return p;}
async function image(p,color='white',w=100,h=80){await writeNew(p,await sharp({create:{width:w,height:h,channels:3,background:color}}).png().toBuffer());}
const cfg={coordinate_width:100,coordinate_height:80,cover:[{points:[[20,20],[60,20],[60,60],[20,60]]}],protect:[{points:[[30,30],[40,30],[40,40],[30,40]]}],feather:0};
async function setup(t,c=cfg){const d=await temp(t);const source=path.join(d,'原图.png'),regions=path.join(d,'区域.json'),output=path.join(d,'涂黑.png'),maskOutput=path.join(d,'mask.png');await image(source);await writeNew(regions,JSON.stringify(c));return {d,source,regions,output,maskOutput};}
test('blackout grows polygon, protects person, preserves dimensions and source bytes',async t=>{
 const a=await setup(t),before=hash(await fs.readFile(a.source));const r=await blackout(a);assert.equal(r.width,100);assert.equal(r.height,80);assert.equal(r.default_cover_grow,1.2);
 const {data,info}=await sharp(a.output).removeAlpha().raw().toBuffer({resolveWithObject:true});const px=(x,y)=>data[(y*info.width+x)*3];
 assert.equal(px(22,22),0);assert.equal(px(19,40),0);assert.equal(px(35,35),255);assert.equal(px(5,5),255);assert.equal(hash(await fs.readFile(a.source)),before);
 const m=await sharp(a.maskOutput).metadata();assert.equal(m.width,100);
});
test('feather remains bounded and protection survives',async t=>{const a=await setup(t,{...cfg,feather:4});await blackout(a);const {data,info}=await sharp(a.output).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(data[(35*info.width+35)*3],255);assert.equal(data[(50*info.width+50)*3],0);});
test('default grow can be explicitly zero',async t=>{const a=await setup(t,{...cfg,cover:[{...cfg.cover[0],grow:0}]});await blackout(a);const {data,info}=await sharp(a.output).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(data[(40*info.width+18)*3],255);});
test('blackout refuses existing targets and duplicate outputs before mutation',async t=>{const a=await setup(t);await writeNew(a.output,'owned');await assert.rejects(blackout(a),{code:'OUTPUT_EXISTS'});assert.equal(await fs.readFile(a.output,'utf8'),'owned');await assert.rejects(blackout({...a,output:a.maskOutput}),{code:'INVALID_INPUT'});});
for(const [name,c] of [['ratio',{...cfg,coordinate_width:90}],['NaN-like', {...cfg,cover:[{points:[[0,0],[1,'x'],[2,2]]}]}],['grow',{...cfg,cover:[{...cfg.cover[0],grow:-1}]}],['feather',{...cfg,feather:21}],['empty',{...cfg,cover:[]}]])test(`invalid regions: ${name}`,async t=>{const a=await setup(t,c);await assert.rejects(blackout(a),{code:'INVALID_REGIONS'});await assert.rejects(fs.stat(a.output),{code:'ENOENT'});});
test('EXIF orientation is normalized before coordinate mapping',async t=>{const d=await temp(t),source=path.join(d,'oriented.jpg'),regions=path.join(d,'r.json'),output=path.join(d,'out.png');await writeNew(source,await sharp({create:{width:100,height:80,channels:3,background:'white'}}).jpeg().withMetadata({orientation:6}).toBuffer());await writeNew(regions,JSON.stringify({...cfg,coordinate_width:80,coordinate_height:100}));const r=await blackout({source,regions,output});assert.deepEqual([r.width,r.height],[80,100]);});
test('collect preserves all bytes, actual sizes and numbered 2x2 comparison',async t=>{const d=await temp(t);const artifacts=[];for(let i=0;i<4;i++){const f=path.join(d,`图${i}.png`);await image(f,['red','green','blue','white'][i],100+i,80);artifacts.push({path:path.basename(f),sha256:hash(await fs.readFile(f))});}const taskJson=path.join(d,'task.json'),outputDirectory=path.join(d,'delivery');await writeNew(taskJson,JSON.stringify({status:'succeeded',requested_count:4,task_id:'synthetic',artifacts}));const r=await collect({taskJson,outputDirectory});assert.equal(r.actual_count,4);assert.equal(r.files[3].width,103);assert.equal(hash(await fs.readFile(r.files[0].delivery)),artifacts[0].sha256);const m=await sharp(r.comparison).metadata();assert.deepEqual([m.width,m.height],[1024,900]);await assert.rejects(collect({taskJson,outputDirectory}),{code:'OUTPUT_EXISTS'});});
test('collect validates every input before creating a delivery and handles partial',async t=>{const d=await temp(t),a=path.join(d,'a.png'),taskJson=path.join(d,'task.json');await image(a);const outputDirectory=path.join(d,'delivery');await writeNew(taskJson,JSON.stringify({status:'partial',requested_count:4,artifacts:[{path:a,sha256:'bad'}]}));await assert.rejects(collect({taskJson,outputDirectory}),{code:'HASH_MISMATCH'});await assert.rejects(fs.stat(outputDirectory),{code:'ENOENT'});await fs.writeFile(taskJson,JSON.stringify({status:'partial',requested_count:4,artifacts:[{path:a}]}));const r=await collect({taskJson,outputDirectory});assert.equal(r.actual_count,1);assert.equal(r.requested_count,4);assert.equal(r.comparison,null);});
test('nonterminal and empty tasks rejected',async t=>{const d=await temp(t);for(const [i,record,code]of [[0,{status:'running'},'TASK_NOT_TERMINAL'],[1,{status:'succeeded',artifacts:[]},'OUTPUT_CONTRACT_FAILED']]){const taskJson=path.join(d,`t${i}.json`);await writeNew(taskJson,JSON.stringify(record));await assert.rejects(collect({taskJson,outputDirectory:path.join(d,`out${i}`)}),{code});}});
test('missing media executable does not block local doctor',async()=>{const r=await doctor({probe:()=>({status:1,stdout:'',stderr:'missing'})});assert.equal(r.local_ready,true);assert.equal(r.generation_dependency_ready,false);});
test('CLI structured failures, version and managed runtime entry',()=>{const cli=path.resolve('bin/nano-product-replacement.mjs');const v=spawnSync(process.execPath,[cli,'version'],{encoding:'utf8'});assert.equal(JSON.parse(v.stdout).name,'@petercjl/nano-product-replacement');const q=spawnSync(process.execPath,[cli,'blackout','--unknown'],{encoding:'utf8'});assert.equal(q.status,1);assert.equal(JSON.parse(q.stderr).error.code,'UNKNOWN_OPTION');});

test('canonical integrity manifest matches all shipped Skill bytes',async()=>{const {hashes,ROOT,readJSON}=await import('../src/common.mjs');assert.deepEqual(await hashes(SOURCE),await readJSON(path.join(ROOT,'skill-integrity.json')));});
