import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { exists,fail,readJSON,writeNew,hash } from './common.mjs';
import {validateRegions,regionMasks} from './regions.mjs';

export async function inspect({source,regions,outputDirectory}) {
 if(!source||!outputDirectory)fail('INVALID_INPUT','inspect requires source and output-directory.');
 if(await exists(outputDirectory))fail('OUTPUT_EXISTS',`Preserving ${outputDirectory}`);
 const decoded=await sharp(source,{limitInputPixels:100_000_000}).rotate().ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height}=decoded.info;
 const cfg=regions?validateRegions(await readJSON(regions),width,height):null;
 const raw={width,height,channels:4};
 const oriented=await sharp(decoded.data,{raw}).png().toBuffer();
 const step=Math.max(10,Math.ceil(Math.min(width,height)/100)*10);
 const lines=[];
 for(let x=0;x<width;x+=step)lines.push(`<path d="M${x} 0V${height}"/><text x="${x+3}" y="20">${x}</text>`);
 for(let y=step;y<height;y+=step)lines.push(`<path d="M0 ${y}H${width}"/><text x="3" y="${y+20}">${y}</text>`);
 const grid=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g stroke="#00bfff" stroke-width="1" fill="white" font-family="sans-serif" font-size="18" paint-order="stroke" stroke-linejoin="round">${lines.join('')}</g></svg>`);
 const gridPNG=await sharp(oriented).composite([{input:grid}]).png().toBuffer();
 const entries=[['oriented.png',oriented],['coordinate-grid.png',gridPNG]];
 const crops=[];let coverage=null;
 if(cfg){
  const {cover,protect,mask}=await regionMasks(cfg,decoded.data);
  const overlay=Buffer.from(decoded.data);
  for(let i=0;i<mask.length;i++){const j=i*4;let color=null,a=0;if(cover[i]){color=[255,0,255];a=.45*cover[i]/255;}if(protect[i]){color=[0,255,70];a=.6*protect[i]/255;}if(color){for(let c=0;c<3;c++)overlay[j+c]=Math.round(overlay[j+c]*(1-a)+color[c]*a);}}
  entries.push(['regions-overlay.png',await sharp(overlay,{raw}).png().toBuffer()]);
  const automatic=cfg.protect.map((p,i)=>{const xs=p.points.map(a=>a[0]),ys=p.points.map(a=>a[1]);return {id:`protect-${i+1}`,rect:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)],padding:Math.max(12,Math.min(width,height)*.02)};});
  for(const c of [...automatic,...cfg.check_areas.map(c=>({...c,id:`check-${c.id}`,padding:0}))]){
   const [x,y,w,h]=c.rect,pad=c.padding;
   const left=Math.max(0,Math.floor(x*cfg.sx-pad)),top=Math.max(0,Math.floor(y*cfg.sy-pad));
   const right=Math.min(width,Math.ceil((x+w)*cfg.sx+pad)),bottom=Math.min(height,Math.ceil((y+h)*cfg.sy+pad));
   const rect={left,top,width:right-left,height:bottom-top};
   const file=`${c.id}.png`;entries.push([file,await sharp(oriented).extract(rect).png().toBuffer()]);
   crops.push({file,...rect,coordinate_mapping:'global_x = left + local_x; global_y = top + local_y'});
  }
  coverage=mask.reduce((s,v)=>s+v/255,0)/(width*height);
 }
 await fs.mkdir(path.dirname(path.resolve(outputDirectory)),{recursive:true});await fs.mkdir(outputDirectory);
 for(const [name,bytes] of entries)await writeNew(path.join(outputDirectory,name),bytes);
 const result={ok:true,source:path.resolve(source),output_directory:path.resolve(outputDirectory),width,height,coordinate_width:cfg?.coordinate_width??width,coordinate_height:cfg?.coordinate_height??height,grid_step:step,oriented_sha256:hash(oriented),crops,mask_fraction:coverage,warnings:coverage>.8?['MASK_COVERS_OVER_80_PERCENT: visually check background and person.']:[],visual_acceptance:'pending',files:entries.map(([name])=>path.resolve(outputDirectory,name))};
 await writeNew(path.join(outputDirectory,'inspection.json'),JSON.stringify(result,null,2)+'\n');return result;
}
