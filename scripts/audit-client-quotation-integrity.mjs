import fs from 'node:fs';
import assert from 'node:assert/strict';
import {applyCabinetryRequirementsToQuotation} from '../lib/construction-estimation/cabinetryRequirements.js';
const out='recovery/client-selection-integrity-2026-10-09/audit';const original=JSON.parse(fs.readFileSync(`${out}/blob-141.json`));const w=original.workbook;const fingerprint=JSON.stringify(w);
const next=applyCabinetryRequirementsToQuotation(w,w.workspaceId);assert.equal(JSON.stringify(w),fingerprint);
const changes=[];const protectedFields=['manualRate','margin','marginRate','markup','allowance','allowanceAmount','baselineUnitPrice','variation','variationTotal','manualQuantity','quantityOverride','notes'];
for(const [sectionKey,section] of Object.entries(w.quotation)){
 const rows=next.quotation[sectionKey].rows;assert.equal(rows.length,section.rows.length);
 for(let i=0;i<section.rows.length;i++){const before=section.rows[i],after=rows[i];assert.equal(before.id,after.id);for(const key of protectedFields)assert.deepEqual(after[key],before[key],`${sectionKey}/${before.id}/${key}`);
 const fields=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));if(fields.length)changes.push({section:sectionKey,id:before.id,item:before.item,fields,beforeQuantity:before.quantity,afterQuantity:after.quantity});}
}
assert.deepEqual(next.clientSelectionsBook,w.clientSelectionsBook);const again=applyCabinetryRequirementsToQuotation(next,w.workspaceId);assert.deepEqual(again.quotation,next.quotation);
const report={sourceRevision:original.revision,sourceUntouched:true,duplicateRowsAdded:0,protectedFieldsPreserved:protectedFields,changes,summary:next.cabinetryReconciliation.summary,attention:next.cabinetryReconciliation.entries.filter(e=>e.status!=='MATCHED TO QUOTE ROW')};fs.writeFileSync(`${out}/quotation-change-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({summary:report.summary,changedRows:changes.length,actualQuantityChanges:changes.filter(r=>r.beforeQuantity!==r.afterQuantity)}));
