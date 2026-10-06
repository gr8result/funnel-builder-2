import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import {FINAL_CABINETRY as source, finalCabinetryRows, isCabinetryDivider, isCabinetrySection, isCabinetryProduct, reconcileCabinetryQuotation, addCabinetryCatalogueItem} from '../lib/construction-estimation/finalCabinetryQuotation.js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {calculateEstimateBuilderWorkbook} from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import {getBuilderProducts,getMasterProducts,getClientSelectableProducts} from '../lib/product-library/catalogueService.js';
const owner=source.workspaceId;
const canonical=finalCabinetryRows(owner);
const products=canonical.filter(r=>r.cabinetryRowType==='product');
const csv=Papa.parse(fs.readFileSync('data/product-library/catalogues/builder-cabinetry/cabinetry-quotation-final-review.csv','utf8'),{skipEmptyLines:false}).data;
if(csv.at(-1).length===1)csv.pop();
assert.deepEqual(canonical.filter(r=>!r.cabinetryApprovedAddition).map(r=>r.item),csv.slice(2).map(r=>r[0]));
for(const row of products.filter(r=>!r.cabinetryApprovedAddition))assert.equal(row.excelRate,Number(csv[row.cabinetrySourceRow-1][1]));
assert.equal(products.length,657);assert.equal(canonical.filter(r=>r.cabinetryRowType==='heading').length,88);assert.equal(canonical.filter(r=>r.cabinetryRowType==='spacer').length,125);
const panels=products.filter(r=>r.cabinetryApprovedAddition);
assert.equal(panels.length,10);assert.equal(panels.filter(r=>r.item.startsWith('Short')).length,5);assert.equal(panels.filter(r=>r.item.startsWith('Tall')).length,5);
const prices={'STANDARD COLOURBOARD':[250,450],'PREMIUM LAMINATE':[325,575],'2 PACK':[400,700],'SHAKER STYLE':[450,800],'VINYL WRAP':[350,625]};
for(const [finish,rates] of Object.entries(prices)) {
 const rows=products.filter(r=>r.room==='KITCHEN CABINETRY'&&r.range===finish);
 assert.deepEqual(rows.slice(-2).map(r=>r.excelRate),rates);
 assert(rows.slice(-2).every(r=>r.unit==='EACH'&&r.cabinetryApprovedAddition));
}
assert(panels.every(r=>r.room==='KITCHEN CABINETRY'));
const old={id:'obsolete-populated',item:'Obsolete cupboard',quantity:3,manualRate:925,selectionFormula:'=1',legacyCatalogueReference:true};
const approved={...products[0],quantity:4,quantityFormula:'=2+2',selectedDetails:{colour:'white'}};
const unrelated={rows:[{id:'electric',item:'Electrical labour',quantity:2,manualRate:100}],sortOrder:0};
const book={workspaceId:owner,jobId:'keep',clientSelectionsBook:{keep:true},cabinetryQuoteMigration:{revision:'retired'},cabinetryCatalogueAudit:{retired:true},quotationSectionOrder:['ELECTRICAL','CABINET MAKER','CABINETRY','BENCHTOPS - KITCHEN','AFTER'],quotation:{ELECTRICAL:unrelated,'CABINET MAKER':{rows:[old]},CABINETRY:{rows:[approved,old]},'BENCHTOPS - KITCHEN':{rows:[old]},AFTER:{rows:[]}},productLibrary:{products:[{productCode:'obsolete',category:'CABINETRY'},{productCode:'other',category:'ELECTRICAL'}]}};
const before=structuredClone(book);const result=reconcileCabinetryQuotation(book,owner);
assert.deepEqual(book,before);assert.deepEqual(Object.keys(result.quotation),['ELECTRICAL','CABINETRY','AFTER']);assert.equal(result.quotation.ELECTRICAL,unrelated);assert.equal(result.jobId,book.jobId);assert.deepEqual(result.clientSelectionsBook,book.clientSelectionsBook);
const rows=result.quotation.CABINETRY.rows;assert.equal(rows.length,870);assert(!rows.some(r=>r.legacyCatalogueReference||r.id===old.id));assert(!result.cabinetryQuoteMigration);assert(!result.cabinetryCatalogueAudit);assert.equal(result.productLibrary.products.length,1);
assert.equal(rows.find(r=>r.importKey===approved.importKey).quantity,4);
assert.deepEqual(rows.map(r=>r.item),canonical.map(r=>r.item));assert.equal(new Set(rows.map(r=>r.id)).size,870);
assert.equal(reconcileCabinetryQuotation(result,owner),result);const restored=JSON.parse(JSON.stringify(result));assert.equal(reconcileCabinetryQuotation(restored,owner),restored);
assert.equal(reconcileCabinetryQuotation(book,'other'),book);assert.equal(reconcileCabinetryQuotation({...book,workspaceId:'other'},owner).workspaceId,'other');
assert.equal(addCabinetryCatalogueItem(result,panels[0].importKey,owner),result);
const defaults=createEstimateBuilderWorkbookDefaults({}, {workspaceId:owner});assert.deepEqual(Object.keys(defaults.quotation).filter(isCabinetrySection),['CABINETRY']);assert.deepEqual(defaults.quotation.CABINETRY.rows,canonical);
const preview=calculateEstimateBuilderWorkbook({...defaults,quotation:result.quotation});assert(preview.quotation.CABINETRY.rows.filter(isCabinetryDivider).every(r=>r.cost===0&&r.qty===0));assert.equal(preview.quotation.CABINETRY.rows.find(r=>r.importKey===approved.importKey).cost,3400);
for(const fetch of [getMasterProducts,getBuilderProducts,getClientSelectableProducts]) {
 const active=fetch(owner).filter(isCabinetryProduct);
 assert.equal(active.length,657);assert.equal(new Set(active.map(p=>p.productCode)).size,657);
 assert(active.every(p=>p.attributes.approvedCabinetryRevision===source.datasetRevision&&!p.archived));
 for(const p of active)assert.equal(p.clientPrice,products.find(r=>r.importKey===p.productCode).excelRate);
}
assert(getBuilderProducts('other').filter(isCabinetryProduct).length>0);assert(!getBuilderProducts('other').some(p=>p.attributes?.approvedCabinetryRevision));
console.log('PASS: 657 approved products, 5 short + 5 tall Kitchen-only panels, exact prices/EACH, CSV order, spacers/headings, old rows removed, tenant isolation, sole catalogue source, defaults, totals and reload.');
