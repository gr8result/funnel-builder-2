// Bounded, repeatable import. HNC confirms supplier/brand coverage; manufacturer tables
// supply model combinations. HNC's crossed-out installation prices are not current prices.
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
const splitSupplier = 'https://www.hncairconditioning.com.au/air-conditioning-solutions/wall-mounted-split-systems';
const ductSupplier = 'https://www.hncairconditioning.com.au/air-conditioning-solutions/high-static-inverter-ducted-systems';
const splitSource = 'https://assist.fujitsugeneral.com.au/support/solutions/articles/6000285880-wall-hung-split-systems-asth-astg-system-combinations-nominal-capacities-and-compatible-accessorie';
const ductSource = 'https://www.panasonic.com/au/hvac/product-top/air-conditioner/pac/ducted/r32-inverter-nx-series-high-static-ducted.html';
const now = new Date().toISOString();
const assetDir = 'public/images/catalogues/services/hvac';
await fs.mkdir(assetDir, {recursive:true});
async function get(url) { const r = await fetch(url, {signal:AbortSignal.timeout(45000)}); if(!r.ok) throw new Error(`${r.status} ${url}`); return r; }
async function doc(url) { return new JSDOM(await (await get(url)).text()).window.document; }
const [split, duct, hncSplit, hncDuct] = await Promise.all([splitSource,ductSource,splitSupplier,ductSupplier].map(doc));
if (!/fujitsu/i.test(hncSplit.body.textContent) || !/panasonic/i.test(hncDuct.body.textContent)) throw new Error('HNC brand coverage changed');
async function asset(url,name) { const bytes = Buffer.from(await (await get(url)).arrayBuffer()); await sharp(bytes).webp({quality:90}).toFile(`${assetDir}/${name}.webp`); return `/images/catalogues/services/hvac/${name}.webp`; }
const splitImageSource = 'https://www.hncairconditioning.com.au/assets/images/wall-mounted-products/fujitsu_products.jpg';
const ductImageSource = new URL([...duct.images].find(i=>i.alt === 'R32 Inverter NX Series High Static Ducted PE3').src,ductSource).href;
const splitImage = await asset(splitImageSource,'fujitsu-wall-mounted-range');
const ductImage = await asset(ductImageSource,'panasonic-pe3-ducted-range');
const heroSource = 'https://www.panasonic.com/content/dam/common/HVAC/category-browse/z-xkr-banner.jpg';
await fs.mkdir('public/images/client-selections',{recursive:true});
await sharp(Buffer.from(await (await get(heroSource)).arrayBuffer())).webp({quality:92}).toFile('public/images/client-selections/air-conditioning.webp');
function product(brand, model, name, type, source, supplierUrl, image, imageSource, attributes) {
  return {productCode:`HVAC-${brand.toUpperCase()}-${model}`, sku:model, model, manufacturer:brand, brand,
    supplier:'Harvey Norman Commercial', productName:name, familyKey:'air-conditioning', requirementKeys:['air-conditioning'],
    categoryKey:'air-conditioning', subcategory:`${type} Systems`, productType:`${type} Systems`, topLevelArea:'services',
    officialProductUrl:source, sourceUrl:source, supplierUrl, sourceType:'manufacturer_specification_and_supplier_range',
    sourceVerifiedAt:now, sourceRetrievedAt:now, lastImportedAt:now, lastPriceCheckedAt:now,
    primaryImageUrl:image, imageSourceUrl:imageSource, imageStatus:'verified_range', imageVerifiedAt:now,
    rrp:null, clientPrice:null, priceStatus:'quote_required', priceUnit:'system', currency:'AUD', active:true,
    attributes:{clientSelectionRequirement:'air-conditioning', systemType:type, reverseCycle:true,
      indoorUnitType:type === 'Split' ? 'Wall mounted' : 'Concealed ducted', warranty:null, energyRating:null,
      supplierAvailability:'Exact model availability requires HNC confirmation', confirmationStatus:'Supplier / Design Confirmation Required',
      publishedPrice:null, priceNote:'Project installation quotation required; no current model price published by HNC.',
      imageScope:'Manufacturer/supplier range image, not an exact model photograph', ...attributes,
      selectionFacets:{'System type':`${type} Systems`,Brand:brand,'Reverse cycle':'Yes'} }};
}
const products = [];
for(const code of ['SET-ASTH09KNCA','SET-ASTH18KMTD','SET-ASTH24KNTA']) {
  const cells=[...split.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td')].map(c=>c.textContent.trim())).find(c=>c[0]===code);
  if(!cells || cells.length<5) throw new Error(`Manufacturer combination missing: ${code}`);
  products.push(product('Fujitsu',code,`Fujitsu ${code} reverse-cycle split system`,'Split',splitSource,splitSupplier,splitImage,splitImageSource,
    {indoorModel:cells[1],outdoorModel:cells[2],coolingCapacityKw:parseFloat(cells[3]),heatingCapacityKw:parseFloat(cells[4]), phase:null,zoningCapability:null,wifi:null,dimensions:null}));
}
// These combinations and phases are published in Panasonic's Line Up table. Heating remains
// unset where the table combines variants; never choose one of two ratings by guessing.
for(const [indoor,outdoor,cooling,phase,heating] of [['S-100PE3R','U-100PZ3R5',10,'Single phase',null],['S-140PE3R','U-140PZ3R5',14,'Single phase',null],['S-160PE3R','U-160PZH3R8',16,'Three phase',18]]) {
  const table=duct.querySelector('table')?.textContent || '';
  if(!table.includes(indoor)||!table.includes(outdoor)) throw new Error(`Panasonic combination missing: ${indoor}/${outdoor}`);
  products.push(product('Panasonic',`${indoor}/${outdoor}`,`Panasonic ${indoor} / ${outdoor} ducted reverse-cycle system`,'Ducted',ductSource,ductSupplier,ductImage,ductImageSource,
    {indoorModel:indoor,outdoorModel:outdoor,coolingCapacityKw:cooling,heatingCapacityKw:heating,phase,zoningCapability:true,
      wifi:'Optional compatible WLAN adaptor/controller required',controllerOptions:['CONEX','CZ-RTC5B','CZ-RTC4'],dimensions:null}));
}
await fs.writeFile('data/product-library/catalogues/residential/AU-RESIDENTIAL-HVAC.json',JSON.stringify({importedAt:now,heroSource,products},null,2)+'\n');
console.log(`Imported ${products.length} residential HVAC systems with local range images. Prices require supplier quotation.`);
