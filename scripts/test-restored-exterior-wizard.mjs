import fs from 'node:fs';
import assert from 'node:assert/strict';
import {exteriorHardwarePage,exteriorHardwareType,EXTERIOR_HARDWARE_BRANDS,matchesDoorGlassType} from '../lib/builders/exteriorHardwareWizard.js';
import {entryDoorSelectionSchedules,upsertEntryDoorSelection,selectionsFromDoorDetails,defaultManualEntryDoor} from '../lib/builders/entryDoorFurnitureSelection.js';
const file='data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json';
assert(fs.readFileSync(file).equals(fs.readFileSync('test-artifacts/exterior-wizard-restore/hardware-catalogue.before.json')),'Imported catalogue must remain byte-for-byte unchanged');
const products=JSON.parse(fs.readFileSync(file)).products.map(p=>({...p,productName:p.product_name,productCode:p.product_code,handleStyle:p.attributes.hardwareType}));
let browsed=0;
for(const brand of EXTERIOR_HARDWARE_BRANDS){const types=[...new Set(products.filter(p=>p.brand===brand).map(exteriorHardwareType))];assert(types.length);for(const type of types){const first=exteriorHardwarePage(products,brand,type);const seen=[];for(let page=0;page<first.pages;page++){const result=exteriorHardwarePage(products,brand,type,page);assert(result.products.length<=12);seen.push(...result.products.map(p=>p.productCode));}assert.equal(seen.length,first.total);assert.equal(new Set(seen).size,seen.length);browsed+=seen.length;}}
assert.equal(browsed,products.length);
assert(matchesDoorGlassType({name:'Grey Tint'},'Grey tinted'));assert(matchesDoorGlassType({name:'Rice Paper',classification:'Patterned obscure'},'Obscure/privacy'));assert(matchesDoorGlassType({name:'Acid etched'},'Frosted'));
const door=defaultManualEntryDoor(),hardware={id:'canonical-hardware',productCode:products[0].productCode,brand:'Lockwood',productName:'Preserved catalogue choice',finishOptions:['Chrome'],selectedCost:null};
const legacy={productCode:'previous-door',door};let selected=selectionsFromDoorDetails(legacy);selected=upsertEntryDoorSelection(selected,{productCode:'another-door',door:{...door,id:'another'},entryDoorFurniture:hardware,furnitureFinish:'Chrome',hardwareOptions:{quantity:3,lockType:'Double cylinder',size:'Published size'}});assert.equal(selected.length,2);assert.equal(selected[0].productCode,'previous-door');const schedules=entryDoorSelectionSchedules(selected);assert.equal(schedules.quotationSchedule[0].quantity,3);assert.equal(schedules.quotationSchedule[0].lockType,'Double cylinder');assert.equal(schedules.quotationSchedule[0].size,'Published size');
console.log(JSON.stringify({passed:true,cataloguePreserved:true,products:browsed,brands:4,paginationComplete:true,legacySelectionPreserved:true,hardwareOptionsPreserved:true}));
