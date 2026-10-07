import fs from 'node:fs/promises';import path from 'node:path';
const dir=path.resolve('public/images/product-library/stairs');
const manifest=JSON.parse(await fs.readFile('data/product-library/source-evidence/stair-workflow/image-sources.json'));
const used=new Set(manifest.images.map(i=>path.resolve('public'+i.imageUrl)));
const reviewed=JSON.parse(await fs.readFile('data/product-library/source-evidence/stair-workflow/review-images.json'));
let removed=0;
for(const p of new Set(reviewed.map(i=>path.resolve('public'+i.local)))){if(path.dirname(p)!==dir||!/^\w+\.jpg$/.test(path.basename(p)))throw Error('Unexpected review asset path');if(!used.has(p)){await fs.unlink(p).catch(e=>{if(e.code!=='ENOENT')throw e;});removed++;}}
console.log({unusedReviewDownloadsRemoved:removed,referencedImages:used.size,newLocalAssets:[...used].filter(p=>path.dirname(p)===dir).length});
