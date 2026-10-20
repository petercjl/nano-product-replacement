import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { exists, fail, readJSON, writeNew, hash } from './common.mjs';
import {validateRegions,regionMasks} from './regions.mjs';
export async function blackout({ source, regions, output, maskOutput }) {
 if (!source || !regions || !output) fail('INVALID_INPUT', 'source, regions and output are required.');
 const targets = [output, maskOutput].filter(Boolean).map(p => path.resolve(p));
 if (new Set(targets).size !== targets.length) fail('INVALID_INPUT', 'Output paths must differ.');
 for (const p of targets) { if (await exists(p)) fail('OUTPUT_EXISTS', `Preserving ${p}`); if (path.extname(p).toLowerCase() !== '.png') fail('INVALID_INPUT', 'Outputs must use .png.'); }
 const decoded = await sharp(source, { limitInputPixels: 100_000_000 }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
 const { width, height } = decoded.info;
 const cfg=validateRegions(await readJSON(regions),width,height),{feather}=cfg;
 const grow=Math.min(cfg.coordinate_width,cfg.coordinate_height)*.015;
 const {mask}=await regionMasks(cfg,decoded.data);
 const pixels = decoded.data;
 for (let i=0;i<mask.length;i++) {
  const a=mask[i]/255, j=i*4;
  for (let c=0;c<3;c++) pixels[j+c]=Math.round(pixels[j+c]*(1-a));
  pixels[j+3]=Math.round(pixels[j+3]+(255-pixels[j+3])*a);
 }
 const result = await sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer();
 const maskPNG = maskOutput ? await sharp(mask,{raw:{width,height,channels:1}}).png().toBuffer() : null;
 await writeNew(output,result); if (maskOutput) await writeNew(maskOutput,maskPNG);
 return {ok:true,output:path.resolve(output),mask:maskOutput?path.resolve(maskOutput):null,width,height,feather,default_cover_grow:grow,sha256:hash(result)};
}
export async function collect({ taskJson, outputDirectory }) {
 if (!taskJson || !outputDirectory) fail('INVALID_INPUT','task-json and output-directory required.');
 if (await exists(outputDirectory)) fail('OUTPUT_EXISTS',`Use a new directory: ${outputDirectory}`);
 const record=await readJSON(taskJson), task=record.task ?? record;
 if (!['succeeded','partial','failed'].includes(task.status)) fail('TASK_NOT_TERMINAL',`Task is ${task.status}`);
 if (!Array.isArray(task.artifacts) || !task.artifacts.length || task.artifacts.length > 64) fail('OUTPUT_CONTRACT_FAILED','Expected 1–64 local image artifacts.');
 const entries=[];
 for (let i=0;i<task.artifacts.length;i++) {
  const a=task.artifacts[i]; if (typeof a.path !== 'string' || /^https?:/.test(a.path)) fail('INVALID_INPUT','Artifact path must be a local file.');
  const source=path.resolve(path.dirname(path.resolve(taskJson)),a.path);
  const data=await fs.readFile(source), digest=hash(data);
  if (a.sha256 && digest!==a.sha256.toLowerCase()) fail('HASH_MISMATCH',`Artifact ${i+1}`);
  const meta=await sharp(data).metadata();
  const extension={png:'.png',jpeg:'.jpg',webp:'.webp'}[meta.format];
  if (!extension || !meta.width || !meta.height || (meta.pages ?? 1)>1) fail('UNSUPPORTED_IMAGE','Use still PNG, JPEG or WebP.');
  entries.push({data,file:`result-${String(i+1).padStart(2,'0')}${extension}`,source,width:meta.width,height:meta.height,bytes:data.length,sha256:digest});
 }
 // Prepare comparison before creating output; never stretch a source image.
 let comparison=null;
 if(entries.length>1) {
  const width=1024,cellW=512,cellH=450,height=cellH*Math.ceil(entries.length/2),layers=[];
  for(let i=0;i<entries.length;i++) {
   const x=(i%2)*cellW,y=Math.floor(i/2)*cellH;
   layers.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="40"><text x="16" y="29" font-family="sans-serif" font-size="24" fill="black">${String(i+1).padStart(2,'0')}</text></svg>`),left:x,top:y});
   layers.push({input:await sharp(entries[i].data).rotate().resize(480,394,{fit:'inside'}).png().toBuffer(),left:x+16,top:y+48});
  }
  comparison=await sharp({create:{width,height,channels:3,background:'#f6f6f4'}}).composite(layers).jpeg({quality:92}).toBuffer();
 }
 await fs.mkdir(path.dirname(path.resolve(outputDirectory)),{recursive:true});
 await fs.mkdir(outputDirectory); // exclusive directory creation
 const files=[];
 for(const e of entries){ const {data,...f}=e; f.delivery=path.resolve(outputDirectory,e.file);await writeNew(f.delivery,data);if(hash(await fs.readFile(f.delivery))!==f.sha256)fail('HASH_MISMATCH',f.file);files.push(f); }
 const comparisonPath=comparison?path.resolve(outputDirectory,'comparison.jpg'):null;
 if(comparison) await writeNew(comparisonPath,comparison);
 const report={ok:true,task_id:task.task_id??null,status:task.status,model:task.model??null,requested_count:task.requested_count??null,actual_count:files.length,cost:task.cost??null,files,comparison:comparisonPath};
 await writeNew(path.join(outputDirectory,'files.json'),JSON.stringify(report,null,2)+'\n');return report;
}
