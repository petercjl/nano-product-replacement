import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {blackout} from '../src/images.mjs';
import {inspect} from '../src/inspect.mjs';
import {validateRegions} from '../src/regions.mjs';
import {writeNew,hash} from '../src/common.mjs';
process.env.NANO_PRODUCT_REPLACEMENT_UPDATE_CHECK='0';

const base={coordinate_width:100,coordinate_height:80,cover:[{points:[[10,10],[80,10],[80,70],[10,70]],grow:0}],protect:[],feather:0};
async function setup(t,cfg=base){const d=await fs.mkdtemp(path.join(os.tmpdir(),'nano-mask-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));const source=path.join(d,'source.png'),regions=path.join(d,'regions.json');await writeNew(source,await sharp({create:{width:100,height:80,channels:3,background:'#c8a0a5'}}).png().toBuffer());await writeNew(regions,JSON.stringify(cfg));return {d,source,regions,output:path.join(d,'out.png'),maskOutput:path.join(d,'mask.png')};}
for(const [label,points] of [
 ['crossed',[[10,10],[80,70],[10,70],[80,10]]],
 ['midpoint-corner-order',[[0,40],[50,0],[100,40],[50,80],[0,0],[100,0],[100,80],[0,80]]],
 ['duplicate',[[10,10],[80,10],[80,70],[10,10],[10,70]]],
 ['outside',[[10,10],[101,10],[80,70]]],
 ['collinear',[[10,10],[30,30],[50,50]]],
 ['backtracking',[[10,10],[50,10],[30,10],[30,40],[10,40]]]
])test(`geometry rejects ${label} without outputs`,async t=>{const a=await setup(t,{...base,cover:[{points}]});await assert.rejects(blackout(a),{code:'INVALID_REGIONS'});await assert.rejects(fs.stat(a.output),{code:'ENOENT'});await assert.rejects(fs.stat(a.maskOutput),{code:'ENOENT'});});
test('valid concave contour keeps concavity and allows explicit closure',async t=>{const a=await setup(t,{...base,cover:[{grow:0,points:[[10,10],[80,10],[80,30],[30,30],[30,70],[10,70],[10,10]]}]});await blackout(a);const {data}=await sharp(a.output).removeAlpha().raw().toBuffer({resolveWithObject:true});const rgb=(x,y)=>[...data.slice((y*100+x)*3,(y*100+x)*3+3)];assert.deepEqual(rgb(20,50),[0,0,0]);assert.deepEqual(rgb(50,50),[200,160,165]);});
test('local warm-pixels preserves matching pixels only within ROI',async t=>{
 const a=await setup(t,{...base,protect:[{points:[[30,20],[50,20],[50,60],[30,60]],selection:{type:'warm-pixels'}}]});
 const {data,info}=await sharp(a.source).raw().toBuffer({resolveWithObject:true});
 for(let y=30;y<50;y++)for(let x=35;x<45;x++)data.set([200,140,100],(y*100+x)*3);
 const fixture=path.join(a.d,'fixture.png');await writeNew(fixture,await sharp(data,{raw:info}).png().toBuffer());
 await blackout({...a,source:fixture});const out=await sharp(a.output).removeAlpha().raw().toBuffer();
 assert.deepEqual([...out.slice((40*100+40)*3,(40*100+40)*3+3)],[200,140,100]);
 assert.deepEqual([...out.slice((40*100+32)*3,(40*100+32)*3+3)],[0,0,0]);
 assert.deepEqual([...out.slice((40*100+60)*3,(40*100+60)*3+3)],[0,0,0]);
});
test('unsupported selection and thresholds are rejected',()=>{for(const p of [{selection:{type:'skin'}},{selection:{type:'warm-pixels',min_green_blue:-1}},{selection:{type:'warm-pixels',guess:true}}])assert.throws(()=>validateRegions({...base,protect:[{points:[[10,10],[20,10],[20,20]],...p}]},100,80),{code:'INVALID_REGIONS'});});
test('inspect preserves source, previews alpha overlay and crops with exact global mapping',async t=>{
 const a=await setup(t,{...base,protect:[{points:[[30,20],[50,20],[50,60],[30,60]]}],check_areas:[{id:'hand',rect:[20,10,40,50]}]});
 const before=hash(await fs.readFile(a.source)),outputDirectory=path.join(a.d,'inspection');const r=await inspect({...a,outputDirectory});
 assert.deepEqual([r.width,r.height],[100,80]);assert.equal(r.visual_acceptance,'pending');assert.equal(hash(await fs.readFile(a.source)),before);
 const crop=r.crops.find(c=>c.file==='check-hand.png');assert.deepEqual([crop.left,crop.top,crop.width,crop.height],[20,10,40,50]);
 const original=await sharp(a.source).extract({left:20,top:10,width:40,height:50}).ensureAlpha().raw().toBuffer();const actual=await sharp(path.join(outputDirectory,crop.file)).ensureAlpha().raw().toBuffer();assert.deepEqual(actual,original);
 const pix=await sharp(path.join(outputDirectory,'regions-overlay.png')).removeAlpha().raw().toBuffer();assert.deepEqual([...pix.slice(0,3)],[200,160,165]);assert.ok(pix[(15*100+15)*3]>200);assert.ok(pix[(40*100+40)*3+1]>160);
 await assert.rejects(inspect({...a,outputDirectory}),{code:'OUTPUT_EXISTS'});
});
test('inspect scales crop coordinates from declared coordinate system',async t=>{const a=await setup(t,{coordinate_width:50,coordinate_height:40,cover:[{points:[[5,5],[40,5],[40,35],[5,35]]}],check_areas:[{id:'detail',rect:[10,5,20,25]}]});const r=await inspect({...a,outputDirectory:path.join(a.d,'i')});const c=r.crops[0];assert.deepEqual([c.left,c.top,c.width,c.height],[20,10,40,50]);});
test('inspect rejects invalid checks before creating directory',async t=>{const a=await setup(t,{...base,check_areas:[{id:'../escape',rect:[0,0,10,10]}]}),outputDirectory=path.join(a.d,'i');await assert.rejects(inspect({...a,outputDirectory}),{code:'INVALID_REGIONS'});await assert.rejects(fs.stat(outputDirectory),{code:'ENOENT'});});
test('CLI inspect creates discoverable coordinate artifacts',async t=>{const a=await setup(t);const r=spawnSync(process.execPath,[path.resolve('bin/nano-product-replacement.mjs'),'inspect','--source',a.source,'--output-directory',path.join(a.d,'cli'),'--json'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);assert.equal(j.width,100);assert.ok(await fs.stat(path.join(j.output_directory,'coordinate-grid.png')));});
test('CLI rejects misplaced options and positional arguments',()=>{for(const args of [['inspect','--output','some.png'],['blackout','unexpected'],['collect','--regions','some.json']]){const r=spawnSync(process.execPath,[path.resolve('bin/nano-product-replacement.mjs'),...args],{encoding:'utf8'});assert.equal(r.status,1);assert.ok(['UNKNOWN_OPTION','INVALID_INPUT'].includes(JSON.parse(r.stderr).error.code));}});
