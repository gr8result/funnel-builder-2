import {roomForSavedRequirement} from '../lib/builders/selectionBookSource.js';
import fs from 'node:fs';
import {parse} from '@babel/parser';
import * as workflow from '../lib/builders/clientSelectionWorkflow.js';
import * as cabinet from '../lib/builders/cabinetryWorkflow.js';
import * as budget from '../lib/builders/selectionBudget.js';
import * as internal from '../lib/product-library/internalSelection.js';
import * as ownership from '../lib/builders/selectionRowOwnership.js';
import {getMasterProducts} from '../lib/product-library/catalogueService.js';
import {planCabinetryQuotation} from '../lib/construction-estimation/cabinetryRequirements.js';
const source=fs.readFileSync('pages/modules/builders/selections-book.js','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const names=['slug','ensureKitchenRoom','ensureGuidedRoom','guidedRequirementsIncludingSaved','rowForRequirement','rowsWithGuidedRequirement','blankGuidedRow','isCanonicalCabinetryRow','legacyCabinetryRowsForRoom','rowMatchesRequirement','rowLabelMatchesRequirement','guidedSelectionsFromBook','cabinetryGuidedSelectionFromBook','cabinetryProgressLabel','migratedCabinetrySelectionFromRows','guidedSelectedByRequirement','requirementAppliesToBook'];
const declarations=ast.program.body.filter(n=>names.includes(n.id?.name)||n.type==='VariableDeclaration'&&n.declarations.some(d=>['ROW_OWNER_ALIASES','CABINETRY_SELECTION_TYPE','CABINETRY_WORKFLOW_TYPE','CABINETRY_SCHEMA_VERSION','APPROVED_SELECTIONS_CSV_PATH'].includes(d.id?.name)));
const bindings={roomForSavedRequirement,APPROVED_SELECTIONS_CSV_PATH:"data/product-library/PRODUCTS-LIBRARY.csv",...workflow,...cabinet,...budget,...internal,...ownership,uid:()=> 'audit-blank',titleCase:x=>x, guidedProductsForRequirement:()=>[]};
const helpers=new Function(...Object.keys(bindings),declarations.map(n=>source.slice(n.start,n.end)).join('\n')+'\nreturn {guidedSelectionsFromBook,requirementAppliesToBook};')(...Object.values(bindings));
const out='recovery/client-selection-integrity-2026-10-09/audit';
for(const blob of ['local']){
 const record=JSON.parse(fs.readFileSync(`${out}/blob-${blob}.json`));const w=record.workbook,b=w.clientSelectionsBook;
 const selections=helpers.guidedSelectionsFromBook(b),map=new Map(selections.map(s=>[s.selected_details.requirementKey,s]));
 const all=workflow.ALL_GUIDED_REQUIREMENTS.filter(r=>!(r.optionalSelection&&!map.has(r.requirementKey))&&!(r.requirementKey==='appliance-pack'&&!map.has(r.requirementKey))&&helpers.requirementAppliesToBook(r,b));
 const audit=all.map(r=>{const s=map.get(r.requirementKey),g=s?.selected_details;return {requirement:r.requirementKey,category:r.areaLabel,room:s?.room,status:workflow.statusForRequirement(r,s),sourceRow:s?.id,product:s?.product_name,brand:s?.brand,model:s?.model_number,range:g?.range,colour:g?.colour,quantity:g?.quantity,configurationComplete:g?.configurationComplete,confirmation:g?.confirmed,priceState:g?.priceState,quotation:g?.linkedQuoteItemCode,details:g};});
 const plan=planCabinetryQuotation(w);
 fs.writeFileSync(`${out}/requirements-${blob}.json`,JSON.stringify(audit,null,2));fs.writeFileSync(`${out}/cabinetry-${blob}.json`,JSON.stringify(plan.entries,null,2));
 console.log(JSON.stringify({blob,total:audit.length,complete:audit.filter(a=>a.status==='complete').length,requirements:audit.map(({details,...a})=>a),cabinetryAttention:plan.entries.filter(e=>e.outcome!=='MATCHED')},null,2));
}
