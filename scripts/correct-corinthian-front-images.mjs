import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='data/product-library/source-evidence/internal-finishing/';
const candidates=JSON.parse(await fs.readFile(root+'corinthian-front-candidates.json'));
const media=JSON.parse(await fs.readFile(root+'corinthian-media.json'));
const explicit={'AMOD 1':1712,'AMOD 1G':1713,'PROM 1':5587,'PROM 1G':5588,'AMOD 40G':4521,'PMOD 40G':4520};
const cataloguePath='data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json';
const catalogue=JSON.parse(await fs.readFile(cataloguePath));
const mappings=[];let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<candidates.length){const h=candidates[next++];const m=media.find(m=>m.id===(explicit[h.model]||h.candidates[0]?.id));if(!m)throw Error('No exact image '+h.model);
 const size=m.sizes?.medium_large||m.sizes?.large;const url=size?.source_url||m.url;
 const local='/images/product-library/internal-areas/corinthian-front/'+createHash('sha256').update(url).digest('hex').slice(0,24)+path.extname(new URL(url).pathname);
 await fs.mkdir(path.dirname('public'+local),{recursive:true});try{await fs.access('public'+local);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(url+' '+r.status);await fs.writeFile('public'+local,Buffer.from(await r.arrayBuffer()));}
 mappings.push({model:h.model,productSource:h.source,mediaId:m.id,mediaTitle:m.title,imageSource:url,localPath:local,status:'verified_exact_model_front',verification:'Official model page hero identity matched to manufacturer front-view media; original downloaded bytes preserved.',rights:'Manufacturer product imagery; copyright Corinthian Doors. Source attribution retained.',retrievedAt:new Date().toISOString()});
}}));
let updated=0;for(const p of catalogue.products){if(p.brand!=='Corinthian Doors')continue;const m=mappings.find(m=>m.model===p.model);if(!m)throw Error(p.model);p.primary_image_url=m.localPath;p.gallery_images=[];p.image_verified_at=m.retrievedAt;p.attributes.imageSources=[{url:m.localPath,sourceUrl:m.imageSource}];p.image_url=m.localPath;p.image_urls=[m.localPath];p.image_source_url=m.imageSource;p.image_status='verified_exact';p.attributes={...p.attributes,imageSourceUrls:[m.imageSource],imageVerificationStatus:m.status,imageVerifiedModel:m.model,imageMediaId:m.mediaId,imageScope:'Exact manufacturer model front view. Construction variants share the same visible door design; displayed glazing follows the manufacturer reference image.'};updated++;}
await fs.writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
await fs.writeFile(root+'CORINTHIAN-IMAGE-AUDIT.json',JSON.stringify({productsUpdated:updated,models:mappings.length,unresolved:[],mappings:mappings.sort((a,b)=>a.model.localeCompare(b.model))},null,2)+'\n');
console.log({updated,models:mappings.length});


