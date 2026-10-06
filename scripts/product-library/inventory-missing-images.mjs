import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const CATALOGUES = path.join(ROOT, 'data/product-library/catalogues');
const IMAGE_FIELDS = ['primaryImage','primaryImageUrl','imageUrl','swatchImage','thumbnailUrl','image','primary_image_url'];
function walk(d){const o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())o.push(...walk(f));else if(e.name.endsWith('.json')&&!e.name.endsWith('.report.json'))o.push(f);}return o;}
function records(v){if(Array.isArray(v))return v.filter(x=>x&&typeof x==='object');if(v&&typeof v==='object'){for(const k of ['products','items','records','data'])if(v[k])return records(v[k]);}return [];}
const rows=[];
for(const file of walk(CATALOGUES)){
  let json; try{json=JSON.parse(fs.readFileSync(file,'utf8'));}catch{continue;}
  for(const r of records(json)){
    const img=IMAGE_FIELDS.map(f=>r[f]).find(Boolean);
    if(img)continue;
    rows.push({file:path.relative(CATALOGUES,file),brand:r.brandName||r.brand||'',model:r.manufacturerModel||r.model||r.sku||'',family:r.familyId||r.familyKey||'',name:r.productName||r.product_name||r.name||'',page:r.productPageUrl||r.sourceUrl||r.officialProductUrl||''});
  }
}
console.log('records with no image field:',rows.length);
const byFile=new Map(); for(const r of rows) byFile.set(r.file,(byFile.get(r.file)||0)+1);
console.log('\n-- by catalogue file --'); for(const [f,n] of [...byFile].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(4),f);
const byBrand=new Map(); for(const r of rows) byBrand.set(r.brand||'(none)',(byBrand.get(r.brand||'(none)')||0)+1);
console.log('\n-- by brand --'); for(const [b,n] of [...byBrand].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(4),b);
const byFam=new Map(); for(const r of rows) byFam.set(r.family||'(none)',(byFam.get(r.family||'(none)')||0)+1);
console.log('\n-- by family --'); for(const [b,n] of [...byFam].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(4),b);
console.log('\nwith a known product page URL:',rows.filter(r=>r.page).length,'/',rows.length);
fs.writeFileSync(path.join(ROOT,'scripts/product-library/missing-images.json'),JSON.stringify(rows,null,2));
