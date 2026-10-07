import fs from 'node:fs/promises';import sharp from 'sharp';
const files=['AU-INTERNAL-AREAS-CATALOGUE.json','AU-INTERNAL-SYSTEMS-CATALOGUE.json'];
const products=(await Promise.all(files.map(f=>fs.readFile('data/product-library/catalogues/internal/'+f).then(JSON.parse)))).flatMap(c=>c.products);
const paths=[...new Set(products.filter(p=>p.active).map(p=>p.primary_image_url))];
for(const image of paths){const m=await sharp('public'+image).metadata();if(!m.width||!m.height)throw Error(image);}
const corinthian=products.filter(p=>p.brand==='Corinthian Doors');
const shared=[...new Set(corinthian.map(p=>p.primary_image_url))].map(image=>({image,models:[...new Set(corinthian.filter(p=>p.primary_image_url===image).map(p=>p.model))]})).filter(r=>r.models.length>1);
if(shared.some(r=>r.models.sort().join('|')!=='PMDF|Premium PMDF'))throw Error('Unexpected shared design '+JSON.stringify(shared));
const result={passed:true,enabledRecords:products.filter(p=>p.active).length,distinctLocalImages:paths.length,corinthianRecords:corinthian.length,corinthianModels:new Set(corinthian.map(p=>p.model)).size,sharedDesigns:shared};
await fs.writeFile('data/product-library/source-evidence/internal-finishing/LOCAL-IMAGE-AUDIT.json',JSON.stringify(result,null,2)+'\n');console.log(result);
