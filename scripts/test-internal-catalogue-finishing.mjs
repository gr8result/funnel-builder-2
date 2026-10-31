import assert from 'node:assert/strict';import fs from 'node:fs';
import {getMasterProducts,getClientSelectableProducts,setCatalogueStorage,updateBuilderProductOverride} from '../lib/product-library/catalogueService.js';
import {trimRates,trimIdentity,sortCatalogueProducts,INTERNAL_CATALOGUE_SECTIONS,catalogueFilterValues} from '../lib/product-library/cataloguePresentation.js';
import {productsToExchangeCsv,rowsFromCsv,previewProductLibraryPackageImport} from '../lib/product-library/productLibraryExchange.js';
import {getProductLibraryRoomCategory,productBelongsToRoomCategory} from '../lib/product-library/productLibraryTaxonomy.js';
import {productsForRequirement,INTERIOR_REQUIREMENTS,createSelectionPayloadFromProduct} from '../lib/builders/clientSelectionWorkflow.js';
import {prepareInternalSelection,prepareRobeSlidingDoorSystem,connectInternalSelectionsToQuotation} from '../lib/product-library/internalSelection.js';
import {extractScheduleRows} from '../lib/builders/selectionsScheduleDocument.js';
const mem=new Map();setCatalogueStorage({getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)});
const all=getMasterProducts(),trims=all.filter(p=>p.attributes.trimIdentity),systems=all.filter(p=>p.productCode.startsWith('INT-SYS-'));
assert.equal(trims.length,94);assert.equal(new Set(trims.map(trimIdentity)).size,94);assert.equal(systems.length,29);assert.equal(new Set(systems.map(p=>p.productId)).size,29);
for(const p of [...trims,...systems]){assert(fs.existsSync('public'+p.primaryImageUrl),p.productCode);assert(p.description&&p.model&&p.range&&p.size&&p.material&&p.finish,p.productCode);}
for(const p of trims){assert.equal(p.attributes.stock_length_m,5.4);assert.equal(p.attributes.price_per_stock_length,Math.round(p.attributes.price_per_linear_metre*5.4*100)/100);assert(!/\b2\.[147]\s*m\b/.test(p.productName));}
assert.deepEqual(trimRates(10),{price_per_linear_metre:10,stock_length_m:5.4,price_per_stock_length:54});assert.deepEqual(trimRates(54,'stock'),trimRates(10));assert.throws(()=>trimRates(-1));
const trim=trims.find(p=>p.attributes.originalSourceVariants.length>1);const alias=trim.attributes.originalSourceVariants.at(-1);const row=rowsFromCsv(productsToExchangeCsv([trim]))[0];row.canonical_product_id=alias.code;row.product_code=alias.code;row.model=alias.sku;row.price=27;row.specifications_json='{}';
row.attributes_json='{}';
for(const importMode of ['add','update']){const preview=previewProductLibraryPackageImport({rows:[row]},all,{builderId:'finishing-test',importMode});assert.equal(preview.newProducts,0);assert.equal(preview.rows[0].product.productId,trim.productId);assert.equal(preview.invalidProducts,0,JSON.stringify(preview.rows[0].issues));assert.equal(preview.rows[0].product.clientPrice,trimRates(27/Number(alias.length[0].match(/[\d.]+/)[0])).price_per_stock_length);}
const sample=[{productName:'Zulu',brand:'A',price:30,updatedAt:'2026-01-01'},{productName:'Alpha',brand:'B',price:10,updatedAt:'2026-02-01'},{productName:'Bravo',brand:'C',price:null,updatedAt:'2026-03-01'}];
for(const [sort,expected] of [['name','Alpha'],['name-desc','Zulu'],['brand','Zulu'],['price','Alpha'],['price-desc','Zulu'],['updated','Bravo']])assert.equal(sortCatalogueProducts(sample,sort)[0].productName,expected);
for(const key of ['internal-doors','door-furniture','skirting-architraves','stair-components','wardrobe-systems']){const ps=all.filter(p=>productBelongsToRoomCategory(p,getProductLibraryRoomCategory(key)));assert(ps.length,key);const values=catalogueFilterValues(ps);assert(!values.ranges.some(r=>/air fry|oven|cooktop/i.test(r)),key);for(const [section] of INTERNAL_CATALOGUE_SECTIONS[key]||[])if(section!=='all')assert(ps.some(p=>p.attributes.catalogueSection===section),section);}
updateBuilderProductOverride('finishing-test',trim.productCode,{builderPrice:54,customFields:{productAttributes:{...trim.attributes,...trimRates(10),priceIncludesGst:true}}});
const enabled=getClientSelectableProducts('finishing-test');const changed=enabled.find(p=>p.productId===trim.productId);assert.equal(prepareInternalSelection(changed).selectedCost,54);assert(changed.updatedAt);assert.equal(sortCatalogueProducts(enabled.filter(p=>p.attributes.trimIdentity),'updated')[0].productId,trim.productId);
const selections=[];
for(const key of ['stairs','robes','skirting']){const req=INTERIOR_REQUIREMENTS.find(r=>r.requirementKey===key);const available=productsForRequirement(enabled,req);assert(available.length,key);const p=key==='skirting'?changed:available.find(p=>p.brand==='Liyana Cabinet')||available[0];const selected=prepareInternalSelection(p,{quantity:2});const entity=selected.metadata.productEntity;selections.push({guidedSelection:{...selected,requirementKey:key,requirementLabel:req.label,productName:entity.productName,description:entity.description,selectedPrice:selected.selectedCost,imageReference:entity.primaryImageUrl}});}
const quote=connectInternalSelectionsToQuotation({quotation:{}},{rooms:[{rows:selections}]}).quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;
assert.equal(quote.length,3);for(const r of quote){assert(r.productId&&r.productImageUrl&&r.unit&&r.description);assert.equal(r.qty,2);}assert.equal(quote.find(r=>r.id.endsWith('skirting')).excelRate,49.0909);
const robeRequirement=INTERIOR_REQUIREMENTS.find(r=>r.requirementKey==='robes');
const robeTwoPanel=all.find(p=>p.productCode==='E0000620');
const robeThreePanel=all.find(p=>p.productCode==='E0000803');
const robeChoices=(locationId,location,width,product)=>({locationId,location,quantity:1,widthTopMm:width,widthBottomMm:width-20,heightLeftMm:2400,heightRightMm:2390,frameColour:product.attributes.frameColours[0],insertMaterial:'Vinyl',insertColour:product.attributes.vinylInsertColours[0],trackConfiguration:product.attributes.trackConfiguration,supplierConfirmed:false,quoteReference:''});
const bedroomDoor=prepareRobeSlidingDoorSystem(robeTwoPanel,robeChoices('bedroom-1','Bedroom 1',2200,robeTwoPanel));
const secondBedroomDoor=prepareRobeSlidingDoorSystem(robeTwoPanel,robeChoices('bedroom-2','Bedroom 2',2150,robeTwoPanel));
const linenDoor=prepareRobeSlidingDoorSystem(robeThreePanel,robeChoices('linen','Linen',3000,robeThreePanel));
assert.notEqual(bedroomDoor.id,secondBedroomDoor.id);assert.notEqual(bedroomDoor.locationId,secondBedroomDoor.locationId);
assert.equal(bedroomDoor.configurationComplete,false);assert.equal(linenDoor.configurationComplete,false);assert.equal(bedroomDoor.selectedPrice,null);assert.equal(bedroomDoor.priceStatus,'quote_required');
assert.throws(()=>prepareRobeSlidingDoorSystem(robeTwoPanel,{...robeChoices('bedroom-1','Bedroom 1',2200,robeTwoPanel),widthBottomMm:700}),/outside the supplier's published size range/);
const robeGuided={requirementKey:'robes',requirementLabel:robeRequirement.label,productId:bedroomDoor.productId,productName:'Robe & Linen Sliding Doors',selectedProduct:'Framed Two Door Wardrobe Sliding; Framed Three Door Wardrobe Sliding',quantity:2,unit:'EACH',priceState:'quote_required',variationPending:true,robeSlidingDoorSystems:[bedroomDoor,secondBedroomDoor,linenDoor]};
const robeBook={rooms:[{rows:[{id:'robes-selection',guidedRequirementKey:'robes',guidedSelection:robeGuided}]}]};
let robeQuote=connectInternalSelectionsToQuotation({quotation:{}},robeBook).quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;
assert.equal(robeQuote.length,3);assert.deepEqual(robeQuote.map(r=>r.id),['internal-selection:robes:robe-door:'+bedroomDoor.productId+':bedroom-1','internal-selection:robes:robe-door:'+secondBedroomDoor.productId+':bedroom-2','internal-selection:robes:robe-door:'+linenDoor.productId+':linen']);
assert.deepEqual(robeQuote.map(r=>r.productCode),['E0000620','E0000620','E0000803']);assert(robeQuote.every(r=>r.excelRate===''&&r.priceStatus==='Quote required'));
assert(robeQuote[0].description.includes('Bedroom 1')&&robeQuote[0].description.includes('2200/2180 x 2400/2390 mm'));
robeQuote[0].manualRate=900;const repriced=connectInternalSelectionsToQuotation({quotation:{'INTERNAL PRODUCTS - CLIENT SELECTIONS':{rows:robeQuote}}},robeBook).quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;
assert.equal(repriced[0].manualRate,900);assert.equal(repriced[1].manualRate,'');
const changedBedroomSystem={...bedroomDoor,widthTopMm:2190};const changedBook={rooms:[{rows:[{id:'robes-selection',guidedRequirementKey:'robes',guidedSelection:{...robeGuided,robeSlidingDoorSystems:[changedBedroomSystem,linenDoor]}}]}]};
const changedRate=connectInternalSelectionsToQuotation({quotation:{'INTERNAL PRODUCTS - CLIENT SELECTIONS':{rows:repriced}}},changedBook).quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;
assert.equal(changedRate[0].manualRate,'');assert.equal(changedRate[1].manualRate,'');
const robeSchedule=extractScheduleRows(robeBook);assert.equal(robeSchedule.rows.length,3);assert.deepEqual(robeSchedule.rows.map(r=>r.product),[bedroomDoor.productName,secondBedroomDoor.productName,linenDoor.productName]);
assert.deepEqual(robeSchedule.rows.map(r=>r.status),['TBC','TBC','TBC']);assert(robeSchedule.rows[0].details.includes('Bedroom')===false);assert(robeSchedule.rows[0].qtyLocation.includes('Bedroom 1'));assert(robeSchedule.rows[1].qtyLocation.includes('Bedroom 2'));assert.equal(robeSchedule.recordReconciliation.missing.length,0);assert.equal(robeSchedule.recordReconciliation.represented,1);
const audit=JSON.parse(fs.readFileSync('data/product-library/source-evidence/internal-finishing/CORINTHIAN-IMAGE-AUDIT.json'));assert.equal(audit.models,160);assert.equal(audit.unresolved.length,0);assert.equal(all.filter(p=>p.brand==='Corinthian Doors'&&p.familyKey==='internal-doors'&&p.primaryImageUrl.includes('corinthian-front')).length,246);
console.log(JSON.stringify({passed:true,trims:94,stairs:13,wardrobes:16,corinthianRecords:246,sorts:6,aliases:true,pricingAndSync:true}));
