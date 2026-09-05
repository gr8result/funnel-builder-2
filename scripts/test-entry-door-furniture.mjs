import assert from 'node:assert/strict';
import fs from 'node:fs';
import catalogue from '../data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json' with {type:'json'};
import {exteriorEntryDoors,entryDoorHardwareLine,upsertEntryDoorSelection,entryDoorSelectionSchedules,connectEntryDoorFurnitureSchedules,updateDoorFurnitureBook,doorFurnitureSelections} from '../lib/builders/entryDoorFurnitureSelection.js';
import {normalizeSelectionDestination,canonicalNavigationUrl} from '../lib/navigation/selectionNavigation.js';
import {getMasterProducts, getEffectiveProductCatalogue} from '../lib/product-library/catalogueService.js';
import {getProductLibraryRoomCategory, productBelongsToRoomCategory, productBelongsToRoom} from '../lib/product-library/productLibraryTaxonomy.js';
import {createProjectInclusionsSnapshot,renderFinalInclusionsScheduleHtml} from '../lib/builders/finalInclusionsSchedule.js';
const products=catalogue.products;
const enabled=getEffectiveProductCatalogue({familyKey:'entry-door-furniture'}).products;
const master=getMasterProducts();
for(const p of products){const normalized=master.find(r=>r.productCode===p.product_code);assert(normalized,`${p.product_code} missing from master`);assert(enabled.some(r=>r.productCode===p.product_code));assert(productBelongsToRoomCategory(normalized,getProductLibraryRoomCategory('entry-doors')));assert(productBelongsToRoom(normalized,'exterior'));assert(!productBelongsToRoom(normalized,'internal-areas'));}
assert.equal(new Set(products.map(p=>p.manufacturer_identity)).size,products.length);
for(const p of products){assert(p.model);assert(p.active&&p.client_selections_enabled);assert.equal(p.family_key,'entry-door-furniture');assert.equal(p.category,'External Door Furniture');assert.equal(p.top_level_area,'exterior');assert(p.primary_image_url.startsWith('/images/product-library/'));assert(fs.statSync('public'+p.primary_image_url).size>0);assert.equal(p.rate,null);assert.equal(p.rate_status,'Rate required');assert(/lockweb.com.au|gainsboroughhardware.com.au|lemaar.com.au|zanda.com.au/.test(new URL(p.source_url).hostname));}
const doors=exteriorEntryDoors({workbook:{takeoffSchedule:{items:[{id:'D01',mark:'ED1',type:'Exterior entry door',level:'Ground',location:'Entry',quantity:1},{id:'D02',mark:'ED2',type:'Exterior entry door',level:'Upper',location:'Terrace',quantity:2},{id:'I01',type:'Internal door'},{id:'G01',type:'Garage door'}]}}});
assert.equal(doors.length,2);
const p=products.find(p=>p.brand==='Lemaar');const furniture={id:p.product_code,productCode:p.product_code,brand:p.brand,supplier:p.brand,model:p.model,manufacturerSku:p.manufacturer_sku,productName:p.product_name,finishOptions:p.attributes.finishOptions,imageUrl:p.primary_image_url,lockingType:p.attributes.lockingType,selectedCost:null};
assert.throws(()=>entryDoorHardwareLine(doors[0],furniture,'Invented finish'));
let selections=upsertEntryDoorSelection([],{door:doors[0],entryDoorFurniture:furniture,furnitureFinish:furniture.finishOptions[0]});
selections=upsertEntryDoorSelection(selections,{door:doors[1],entryDoorFurniture:furniture,furnitureFinish:furniture.finishOptions[0]});
selections=upsertEntryDoorSelection(selections,{...selections[0],furnitureFinish:furniture.finishOptions[0]});assert.equal(selections.length,2);
const schedules=entryDoorSelectionSchedules(selections);for(const lines of Object.values(schedules)){assert.equal(lines.length,2);assert.equal(lines.find(l=>l.doorId==='D02').quantity,2);assert.equal(lines[0].rate,null);assert.equal(lines[0].amount,null);}
const book={rooms:[{rows:[{guidedSelection:{entryDoors:selections}}]}]};const original={quotation:{Existing:{rows:[{id:'keep',item:'Existing product'}]}},procurement:{items:[{id:'keep'}]}};
const next=connectEntryDoorFurnitureSchedules(original,book);assert.deepEqual(next.quotation.Existing,original.quotation.Existing);assert.equal(next.procurement.items.length,3);assert.equal(original.procurement.items.length,1);assert.equal(connectEntryDoorFurnitureSchedules(next,book).procurement.items.length,3);
const quoteRows=next.quotation['ENTRY DOOR FURNITURE - CLIENT SELECTIONS'].rows;assert.equal(quoteRows.length,2);assert.equal(quoteRows[0].excelRate,'');
const finalSnapshot=createProjectInclusionsSnapshot({project:{id:'fixture',project_name:'Fixture'},selections:[{id:'entry-selection',category:'Exterior',subcategory:'Entry Doors',title:'Entry door',selected_product_name:'Selected entry doors',is_active:true,selection_status:'selected',status:'selected',selected_details:{requirementKey:'entry-door',entryDoors:selections,displayInSelectionsSchedule:true,clientDecisionRequired:true}}]});
const html=renderFinalInclusionsScheduleHtml(finalSnapshot);
assert(html.includes('ED1')&&html.includes('ED2'),'Both scheduled door references must reach Final Inclusions');assert(html.includes('Rate required'));assert(html.includes(furniture.model));
const url='http://localhost:3000/modules/estimate-builder?page=clientSelections&room=exterior&roomCategory=door-furniture&door=D01';
assert.equal(canonicalNavigationUrl(normalizeSelectionDestination(url)),canonicalNavigationUrl(url));assert(!normalizeSelectionDestination(url,undefined,{landing:true}).searchParams.has('room'));
console.log(JSON.stringify({passed:true,products:products.length,brands:Object.fromEntries(['Lockwood','Gainsborough','Lemaar','Zanda'].map(b=>[b,products.filter(p=>p.brand===b).length])),separateDoors:true,schedules:true,missingRatesRemainNull:true}));

const pickerUrl='http://localhost:3000/modules/estimate-builder?page=productLibrary&room=exterior&roomCategory=door-furniture&mode=client-selection&returnPage=clientSelections&door=D01&projectId=fixture';
assert.equal(canonicalNavigationUrl(normalizeSelectionDestination(pickerUrl)),canonicalNavigationUrl(pickerUrl));
const first=updateDoorFurnitureBook({rooms:[]},doors,furniture,{finish:furniture.finishOptions[0],quantity:3});
assert.equal(doorFurnitureSelections(first).length,2);
const connected=connectEntryDoorFurnitureSchedules(original,first);
assert(connected.entryDoorFurnitureSchedule.every(l=>l.quantity===3&&l.selectedAt&&l.unitRate===null));
const changed=updateDoorFurnitureBook(first,[doors[0]],{...furniture,productCode:'verified-test-alternate'},{finish:furniture.finishOptions[0],quantity:1});
assert.equal(doorFurnitureSelections(changed)[0].entryDoorFurniture.productCode,furniture.productCode);
const removed=updateDoorFurnitureBook(changed,doors,furniture,{}, {remove:true});
const cleared=connectEntryDoorFurnitureSchedules(connected,removed);
assert.equal(cleared.entryDoorFurnitureSchedule.length,0);
assert.equal(cleared.procurement.items.length,1);
assert.equal(cleared.quotation['ENTRY DOOR FURNITURE - CLIENT SELECTIONS'].rows.length,0);
assert.throws(()=>updateDoorFurnitureBook(first,[doors[0]],furniture,{finish:furniture.finishOptions[0],quantity:0}));
console.log('PASS explicit selection context, apply all, independent change, removal, and schedule cleanup');
