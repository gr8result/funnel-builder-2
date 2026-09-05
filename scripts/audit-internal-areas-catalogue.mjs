import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='data/product-library/catalogues/internal';
const {products}=JSON.parse(await fs.readFile(`${dir}/AU-INTERNAL-AREAS-CATALOGUE.json`,'utf8'));
const enabled=products.filter(p=>p.active);
const images=[...new Set(enabled.flatMap(p=>[p.primary_image_url,...p.gallery_images]).filter(Boolean))];
const imageFailures=[];
for(const image of images){try{const m=await sharp('public'+image).metadata();if(!m.width||!m.height)throw Error('Empty image');}catch(e){imageFailures.push({image,error:e.message});}}
const brands=Object.fromEntries([...new Set(products.map(p=>p.brand))].map(brand=>{
 const all=products.filter(p=>p.brand===brand),active=all.filter(p=>p.active);
 return [brand,{records:all.length,enabled:active.length,withLocalImages:active.filter(p=>p.primary_image_url).length,missingManufacturerSkus:active.filter(p=>!p.sku).length,missingModels:active.filter(p=>!p.model).length,withPublishedSizePrices:active.filter(p=>p.attributes.sizePrices?.some(s=>s.price!=null)).length,quoteRequiredWithoutSize:active.filter(p=>p.client_price==null).length}];
}));
const importReport=JSON.parse(await fs.readFile(`${dir}/INTERNAL-AREAS-IMPORT-REPORT.json`,'utf8'));
const report={auditedAt:new Date().toISOString(),records:products.length,enabled:enabled.length,brands,categories:{internalDoors:enabled.filter(p=>p.family_key==='internal-doors').length,internalDoorFurniture:enabled.filter(p=>p.family_key==='door-hardware').length,skirtingAndArchitraves:enabled.filter(p=>p.family_key==='skirting').length},uniqueLocalProductImages:images.length,categoryImages:3,imageFailures,missingEnabledImages:enabled.filter(p=>!p.primary_image_url).length,duplicateProductIds:products.length-new Set(products.map(p=>p.product_id)).size,heldRecords:products.filter(p=>!p.active).map(p=>({id:p.product_id,sku:p.sku,name:p.product_name,reason:p.attributes.reviewReason,imageStatus:p.image_status,url:p.source_url})),sourceFailures:importReport.unresolved.map(r=>({...r,url:r.url==='[object Object]'?(r.error.match(/https?:\/\/\S+/)?.[0]||r.url):r.url})),notes:['606 enabled records use manufacturer model identifiers rather than finish/size-specific order SKUs. No manufacturer SKU was invented.','Corinthian model photographs and Lockwood range photographs are labelled where a selected construction, glazing, finish or function may differ.','Porta dual-use profiles are one canonical SKU, selectable independently as Skirting or Architraves.','Corinthian published size prices are QLD GST-inclusive. Other unverified rates remain null.']};
await fs.writeFile(`${dir}/INTERNAL-AREAS-QUALITY-REPORT.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(imageFailures.length||report.duplicateProductIds||report.missingEnabledImages)process.exitCode=1;
