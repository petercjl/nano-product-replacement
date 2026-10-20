import sharp from 'sharp';
import { fail } from './common.mjs';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const same = (a,b) => a[0]===b[0] && a[1]===b[1];
const on = (a,b,p) => Math.abs(cross(a,b,p))<1e-8 && p[0]>=Math.min(a[0],b[0])-1e-8 && p[0]<=Math.max(a[0],b[0])+1e-8 && p[1]>=Math.min(a[1],b[1])-1e-8 && p[1]<=Math.max(a[1],b[1])+1e-8;
function intersects(a,b,c,d) {
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 return (ab1*ab2<0 && cd1*cd2<0) || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}
function validatePolygon(p,cw,ch,kind,index) {
 const label=`${kind}[${index}]`;
 if(!Array.isArray(p?.points)||p.points.length<3||p.points.length>4096||p.points.some(a=>!Array.isArray(a)||a.length!==2||!a.every(finite))) fail('INVALID_REGIONS',`${label}: use 3–4096 finite [x,y] points.`);
 let points=p.points;
 if(same(points[0],points.at(-1)))points=points.slice(0,-1);
 if(points.length<3 || new Set(points.map(a=>a.join(','))).size!==points.length)fail('INVALID_REGIONS',`${label}: repeated vertices or fewer than three distinct points.`);
 if(points.some(([x,y])=>x<0||y<0||x>cw||y>ch))fail('INVALID_REGIONS',`${label}: point outside coordinate dimensions.`);
 const n=points.length;
 for(let i=0;i<n;i++) {
  const a=points[i],b=points[(i+1)%n],prev=points[(i+n-1)%n];
  if(Math.abs(cross(prev,a,b))<1e-8 && ((prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1]))>0)fail('INVALID_REGIONS',`${label}: adjacent edges overlap.`);
  for(let j=i+1;j<n;j++)if(j!==i+1 && !(i===0 && j===n-1) && intersects(a,b,points[j],points[(j+1)%n]))fail('INVALID_REGIONS',`${label}: self-intersection between edges ${i} and ${j}; list vertices in boundary order.`);
 }
 const area=Math.abs(points.reduce((s,a,i)=>s+a[0]*points[(i+1)%n][1]-points[(i+1)%n][0]*a[1],0))/2;
 if(area<1e-6)fail('INVALID_REGIONS',`${label}: polygon area is zero.`);
 const grow=p.grow??(kind==='cover'?Math.min(cw,ch)*.015:0);
 if(!finite(grow)||grow<0)fail('INVALID_REGIONS',`${label}: grow must be finite and nonnegative.`);
 let selection=null;
 if(p.selection!==undefined) {
  if(kind!=='protect'||p.selection?.type!=='warm-pixels')fail('INVALID_REGIONS',`${label}: selection is only supported as protect warm-pixels.`);
  const s=p.selection;
  if(Object.keys(s).some(k=>!['type','min_red_green','min_green_blue'].includes(k)))fail('INVALID_REGIONS',`${label}: unknown selection field.`);
  selection={type:'warm-pixels',min_red_green:s.min_red_green??6,min_green_blue:s.min_green_blue??8};
  if(![selection.min_red_green,selection.min_green_blue].every(v=>finite(v)&&v>=0&&v<=255))fail('INVALID_REGIONS',`${label}: color differences must be 0–255.`);
 }
 return {...p,points,grow,selection};
}
export function validateRegions(cfg,width,height) {
 const cw=cfg.coordinate_width,ch=cfg.coordinate_height;
 if(!finite(cw)||!finite(ch)||cw<=0||ch<=0||!Array.isArray(cfg.cover)||!cfg.cover.length||(cfg.protect!==undefined&&!Array.isArray(cfg.protect)))fail('INVALID_REGIONS','Positive coordinate dimensions, cover polygons and optional protect array required.');
 if(cfg.cover.length+(cfg.protect?.length??0)>256)fail('INVALID_REGIONS','At most 256 polygons.');
 const sx=width/cw,sy=height/ch;
 if(Math.abs(sx/sy-1)>.005)fail('INVALID_REGIONS','Coordinate aspect ratio differs from the oriented image.');
 const feather=cfg.feather??0;
 if(!Number.isInteger(feather)||feather<0||feather>20)fail('INVALID_REGIONS','feather must be an integer from 0 to 20.');
 const checks=cfg.check_areas??[];
 if(!Array.isArray(checks)||checks.length>32)fail('INVALID_REGIONS','check_areas must contain at most 32 rectangles.');
 const ids=new Set();
 for(const c of checks){if(!/^[a-zA-Z0-9_-]{1,64}$/.test(c.id??'')||ids.has(c.id)||!Array.isArray(c.rect)||c.rect.length!==4||!c.rect.every(finite))fail('INVALID_REGIONS','check_areas need unique safe id and [left,top,width,height].');ids.add(c.id);const [x,y,w,h]=c.rect;if(x<0||y<0||w<=0||h<=0||x+w>cw||y+h>ch)fail('INVALID_REGIONS',`check_areas ${c.id} outside image.`);}
 return {...cfg,cover:cfg.cover.map((p,i)=>validatePolygon(p,cw,ch,'cover',i)),protect:(cfg.protect??[]).map((p,i)=>validatePolygon(p,cw,ch,'protect',i)),feather,check_areas:checks,sx,sy,width,height};
}
export function polygonSVG(p,cfg) {
 return `<polygon points="${p.points.map(([x,y])=>`${x*cfg.sx},${y*cfg.sy}`).join(' ')}" stroke-width="${2*p.grow*(cfg.sx+cfg.sy)/2}" stroke-linejoin="round"/>`;
}
async function raster(polys,cfg) {
 const {width,height}=cfg;
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/><g fill="white" stroke="white">${polys.map(p=>polygonSVG(p,cfg)).join('')}</g></svg>`);
 return sharp(svg).removeAlpha().greyscale().raw().toBuffer();
}
export async function regionMasks(cfg,rgba) {
 let cover=await raster(cfg.cover,cfg);
 if(cfg.feather)cover=await sharp(cover,{raw:{width:cfg.width,height:cfg.height,channels:1}}).blur(Math.max(.3,cfg.feather/2)).greyscale().raw().toBuffer();
 const protect=Buffer.alloc(cover.length);
 for(const p of cfg.protect){const local=await raster([p],cfg);for(let i=0;i<local.length;i++){
  if(!local[i])continue;
  if(p.selection){const j=i*4;if(!(rgba[j]-rgba[j+1]>p.selection.min_red_green && rgba[j+1]-rgba[j+2]>p.selection.min_green_blue))continue;}
  protect[i]=Math.max(protect[i],local[i]);
 }}
 const mask=Buffer.from(cover);for(let i=0;i<mask.length;i++)mask[i]=Math.round(mask[i]*(1-protect[i]/255));
 return {cover,protect,mask};
}
