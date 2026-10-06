import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateWallLinings, withWallLiningMappings } from '../lib/construction-estimation/quotationWallLinings.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quotationNotifications, acknowledgeQuotationNotification, isNotificationAcknowledged } from '../lib/construction-estimation/quotationNotifications.js';
import { updateQuoteQuantityField } from '../lib/construction-estimation/quoteQuantityFormula.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const levels = ['Ground Floor', 'Second Level', 'Third Level'];
const prefixes = ['lower', 'upper', 'third'];
function fixture(count) {
  const rows = { floorCount: { value: `${count} storey` } };
  const completedWallRuns = [], placedOpenings = [];
  levels.forEach((level, i) => {
    rows[`${prefixes[i]}CeilingHeight`] = { value: 3 };
    completedWallRuns.push({ id: `e${i}`, page: i+1, level, category: 'exterior', exteriorType: i === 0 ? 'Rendered Brick Veneer' : 'Lightweight Cladding', lengthMm: 10000, wallHeightM: 3 }, { id: `i${i}`, page: i+1, level, category: 'interior', lengthMm: 10000, wallHeightM: 3, linedFaces: 2 });
    placedOpenings.push({ id: `w${i}`, hostWallId: `e${i}`, page: i+1, level, openingClass: i === 1 ? 'External Door' : i === 2 ? 'Large Glazed/Stacker/Sliding Door' : 'Window', widthMm: 2000, heightMm: 2000, quantity: 1 }, { id: `d${i}`, hostWallId: `i${i}`, page: i+1, level, openingClass: 'Internal Door', widthMm: 1000, heightMm: 2000, quantity: 1 });
  });
  return { data: { inputDataSheet: { rows } }, aiPlanTakeoffJob: { completedWallRuns, placedOpenings }, quotation: {}, windowsDoors: [] };
}
for (const count of [1, 2, 3]) {
  const w = fixture(count), s = calculateWallLinings(w);
  assert.equal(s.gross, 30*count); assert.equal(s.openings, 4*count);
  assert.equal(s.quantities.totalNetExteriorWallAreaM2, 26*count);
  assert.equal(s.quantities.totalExternalPlasterboardWallM2, 26*count);
  assert.equal(s.quantities.totalInternalPlasterboardWallM2, 56*count);
  w.aiPlanTakeoffJob.placedOpenings.push(w.aiPlanTakeoffJob.placedOpenings[0]);
  assert.deepEqual(calculateWallLinings(w), s, 'duplicate opening references are deducted once');
}
const zero = fixture(3);
const changing = fixture(2);
changing.aiPlanTakeoffJob.completedWallRuns.forEach(wall=>{ wall.wallHeightM=null; });
changing.data.inputDataSheet.rows.upperCeilingHeight.value=4;
assert.equal(calculateWallLinings(changing).quantities.totalNetExteriorWallAreaM2,62,'Job Setup height changes refresh both levels');
changing.aiPlanTakeoffJob.placedOpenings[0].widthMm=3000;
assert.equal(calculateWallLinings(changing).quantities.totalNetExteriorWallAreaM2,60,'live opening change refreshes deduction');
changing.data.inputDataSheet.rows.floorCount.value='Single storey';
assert.equal(calculateWallLinings(changing).quantities.totalNetExteriorWallAreaM2,24,'removed levels cannot leave stale areas');
const three = fixture(3);
const importedFields=createJobSetupPayload(createTakeoffSchedule({...three.aiPlanTakeoffJob,totalPages:3,jobSetupRows:three.data.inputDataSheet.rows})).dataInputFields;
const reimported={data:{inputDataSheet:{rows:Object.fromEntries(Object.entries(importedFields).map(([key,value])=>[key,{value}]))}}};
assert.deepEqual(calculateWallLinings(reimported).quantities,calculateWallLinings(three).quantities,'canonical takeoff import and live geometry agree');
zero.aiPlanTakeoffJob.completedWallRuns = zero.aiPlanTakeoffJob.completedWallRuns.filter((wall) => wall.level !== 'Second Level');
zero.aiPlanTakeoffJob.placedOpenings = zero.aiPlanTakeoffJob.placedOpenings.filter((opening) => opening.level !== 'Second Level');
assert.equal(calculateWallLinings(zero).quantities.totalNetExteriorWallAreaM2, 52);
zero.aiPlanTakeoffJob.completedWallRuns = []; zero.aiPlanTakeoffJob.placedOpenings = [];
zero.data.inputDataSheet.rows.lowerBrickVeneerNetWallM2 = { value: 999 };
assert.equal(calculateWallLinings(zero).quantities.totalNetExteriorWallAreaM2, 0, 'deleting the last live wall clears stale import values');
const imported = { data: { inputDataSheet: { rows: Object.fromEntries(Object.entries({ floorCount: 'Two storey', lowerBrickVeneerGrossWallM2: 100, lowerBrickVeneerNetWallM2: 80, lowerExternalOpeningAreaM2: 20, lowerInternalWallNetPlasterboardM2: 150, upperOtherGrossWallM2: 60, upperOtherNetWallM2: 45, upperExternalOpeningAreaM2: 15, upperInternalWallNetPlasterboardM2: 90, thirdOtherGrossWallM2: 900, thirdOtherNetWallM2: 800 }).map(([k,v])=>[k,{value:v}])) } } };
assert.deepEqual(calculateWallLinings(imported).quantities, { totalNetExteriorWallAreaM2:125, totalExternalPlasterboardWallM2:125, totalInternalPlasterboardWallM2:240 });
const rows = ['quote-30013','quote-1269','quote-1270','quote-1271'].map((id)=>({ id, quantity: '999', quantityManualOverride: true, quantityFormulaOverride: true, quantityKey: id === 'quote-1271' ? 'totalCeilingAreasM2' : 'lowerExternalPlasterboardWallM2', formulas: { B: '999' }, excelRate: '$14.00', active: true }));
const migrated = withWallLiningMappings({ 'DOORS (71)': { rows: [], sortOrder: 7 }, 'PIVOT DOOR (67)': { sortOrder: 8, rows }, 'Custom': { rows: [] } });
assert.equal(migrated['DOORS (71)'].displayName, 'ENTRY DOORS');
assert.equal(migrated['PIVOT DOOR (67)'].displayName, undefined);
assert.deepEqual(migrated['PIVOT DOOR (67)'].rows.map(r=>r.id),rows.map(r=>r.id));
assert.equal(migrated['PIVOT DOOR (67)'].rows[3].quantity, '999', 'ceiling quantity logic stays unchanged');
assert.equal(updateQuoteQuantityField(migrated['PIVOT DOOR (67)'].rows[0], 'quantity', '100').quantity, '');
const issue = { windowScheduleUnmatched: [{ code:'W1',heightMm:1234,widthMm:1600,quantity:1,style:'Sliding' }] };
const n = quotationNotifications(issue)[0]; const acknowledged = JSON.parse(JSON.stringify(acknowledgeQuotationNotification({ quotation: migrated }, n)));
assert(isNotificationAcknowledged(acknowledged,n));
assert.deepEqual(acknowledged.quotation,JSON.parse(JSON.stringify(migrated)));
assert(!isNotificationAcknowledged(acknowledged,quotationNotifications({windowScheduleUnmatched:[{...issue.windowScheduleUnmatched[0],quantity:2}]})[0]));

const current = JSON.parse(fs.readFileSync('recovery/quotation-changes-2026-10-03/download-workbook.json','utf8'));
const ceilingBefore = Object.values(current.quotation).flatMap(s=>s.rows).find(r=>r.id==='quote-1271');
const source = calculateWallLinings(current);
const calculated = calculateEstimateBuilderWorkbook(current);
const actualRows = Object.values(calculated.quotation).flatMap(s=>s.rows).filter(r=>['quote-30013','quote-1269','quote-1270','quote-1271'].includes(r.id));
assert.equal(actualRows.find(r=>r.id==='quote-1271').quantityKey,ceilingBefore.quantityKey);
for(const r of actualRows) { if(r.id!=='quote-30013') assert.equal(Number(String(r.finalRateUsed).replace(/[$,]/g,'')),22); }
assert.equal(actualRows.find(r=>r.id==='quote-1269').qty,source.quantities.totalExternalPlasterboardWallM2);
assert.equal(actualRows.find(r=>r.id==='quote-1270').qty,source.quantities.totalInternalPlasterboardWallM2);
assert.equal(actualRows.find(r=>r.id==='quote-30013').qty,source.quantities.totalNetExteriorWallAreaM2);
fs.mkdirSync('artifacts/test-results/quotation-wall-linings',{recursive:true});
fs.writeFileSync('artifacts/test-results/quotation-wall-linings/unit-report.json',JSON.stringify({passed:true,source,rows:actualRows.map(({id,item,qty,finalRateUsed,cost,quantityKey})=>({id,item,qty,finalRateUsed,cost,quantityKey})),tests:['1/2/3 storeys','zero level','all exterior wall types','exterior window/door/glazing deductions once','net imported plaster','deleted live geometry','forced quantity links','ceiling mapping preserved','acknowledgement round trip','changed source reappears']},null,2));
console.log('PASS wall quantities, mappings, notifications, and current job',JSON.stringify({source,rows:actualRows.map(({id,qty,finalRateUsed,cost})=>({id,qty,finalRateUsed,cost}))}));
