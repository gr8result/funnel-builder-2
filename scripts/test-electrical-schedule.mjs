import assert from 'node:assert/strict';
import fs from 'node:fs';
import { houseRoomNames, projectLocations } from '../lib/builders/projectLocations.js';
import {
  ELECTRICAL_ROOM_STATUS, ELECTRICAL_SCHEDULE_SECTION, ELECTRICAL_SCHEDULE_SOURCE, connectElectricalScheduleToQuotation, electricalEstimateCounts, electricalInclusionBaseline,
  electricalPointsForRoom, electricalQuoteRates, electricalRoomSummary, electricalScheduleLines, electricalScheduleProgress, electricalSelectionPatch, normaliseElectricalSchedule,
} from '../lib/builders/electricalSchedule.js';
import { ALL_GUIDED_REQUIREMENTS, statusForRequirement } from '../lib/builders/clientSelectionWorkflow.js';
import { CLIENT_SELECTION_CATEGORY_BY_KEY, duplicateCategoryRequirementKeys } from '../lib/builders/clientSelectionCategories.js';
import { RESIDENTIAL_SERVICE_KEYS } from '../lib/builders/residentialServices.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { clientSelectionCategoryProducts } from '../lib/product-library/plumbingFixtureCatalogue.js';

// Client Selections > Electrical: a room-by-room quantity schedule over the project's own rooms,
// synced to the Quotation Builder with stable row ids. Lighting & Ceiling Fans stays the product
// selection module.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-electrical-schedule.mjs
const pass = message => console.log(`PASS ${message}`);
const requirement = ALL_GUIDED_REQUIREMENTS.find(item => item.requirementKey === 'electrical-schedule');
const bookWith = schedule => ({ rooms: [{ id: 'guided-electrical', rows: [{ id: 'row', guidedRequirementKey: 'electrical-schedule', ...electricalSelectionPatch(requirement, schedule, { now: '2026-10-06T00:00:00.000Z' }) }] }] });
const setRoom = (schedule, name, patch) => ({ ...schedule, rooms: schedule.rooms.map(room => (room.room === name ? { ...room, ...patch } : room)) });
const scheduleRows = workbook => workbook.quotation[ELECTRICAL_SCHEDULE_SECTION]?.rows || [];

// ---- The module is a quantity schedule, not a product category --------------------------------
const category = CLIENT_SELECTION_CATEGORY_BY_KEY['electrical-technology'];
assert.equal(category.label, 'Electrical');
assert.deepEqual(category.requirementKeys, ['electrical-schedule']);
assert.equal(category.selectionModel, 'quantity-schedule');
assert(requirement && requirement.allocationModel !== 'location-quantity', 'the schedule is not a product allocation requirement');
for (const key of ['power-outlets', 'switches-dimmers', 'smart-home', 'data-tv', 'security']) {
  assert(!ALL_GUIDED_REQUIREMENTS.some(item => item.requirementKey === key), `${key} is no longer a Client Selections requirement`);
  assert(!RESIDENTIAL_SERVICE_KEYS.includes(key));
}
assert.deepEqual(duplicateCategoryRequirementKeys(), []);
const catalogue = getMasterProducts('electrical-schedule-test');
assert.equal(catalogue.filter(product => /clipsal/i.test(`${product.supplier} ${product.productCode}`)).length, 0, 'the retired electrical product catalogue is not in the Product Library');
assert(!fs.existsSync('data/product-library/catalogues/residential/AU-CLIPSAL-RESIDENTIAL.json'));
pass('Electrical is one quantity-schedule requirement; the old product categories and catalogue are gone');

// ---- Lighting & Ceiling Fans is still the product module --------------------------------------
const lighting = CLIENT_SELECTION_CATEGORY_BY_KEY['lighting-fans'];
assert.deepEqual(lighting.requirementKeys, ['interior-lighting', 'ceiling-fan']);
assert.equal(lighting.selectionModel, 'product');
for (const key of lighting.requirementKeys) {
  const products = clientSelectionCategoryProducts({ requirementKey: key }, { products: catalogue });
  assert(products.length > 20, `${key}: real fittings to choose from`);
  assert(!products.some(product => /power point|\bgpo\b|data point|tv point/i.test(product.productName)), `${key}: no electrical points among the fittings`);
}
assert(!lighting.requirementKeys.includes('electrical-schedule') && !category.requirementKeys.some(key => lighting.requirementKeys.includes(key)));
pass('Lighting & Ceiling Fans keeps Product Library fittings and fans, with no electrical points');

// ---- Rooms come from the project room source ---------------------------------------------------
const opening = (roomKey, roomLabel) => ({ id: `${roomKey}-${roomLabel}`, openingType: 'window', roomKey, roomLabel, location: roomLabel });
const book = { rooms: ['External Walls', 'Roof', 'Windows', 'Garage', 'Kitchen', 'Laundry', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Living', 'Electrical', 'Lighting', 'Paint', 'External'].map((name, index) => ({ id: `r${index}`, name })) };
// The Selections Book's template rooms (Bedroom 1-3, Living, ...) are pages of a document: a room is
// listed only when the project itself has it. Here the takeoff has no Living room.
const takeoff = { placedOpenings: [opening('kitchen', 'Kitchen'), opening('laundry', 'Laundry'), opening('bed-1', 'Bed 1'), opening('bed-2', 'Bed 2'), opening('bed-3', 'Bed 3'), opening('media-theatre', 'Media / Theatre'), opening('bed-4', 'Bed 4'), opening('other', 'Study'), opening('family', 'Family')], completedFloorplans: [{ type: 'Garage' }, { type: 'Alfresco' }, { type: 'Footprint' }] };
const rooms = houseRoomNames(projectLocations({ book, workbook: { aiPlanTakeoffJob: takeoff } }).map(location => location.name));
assert.deepEqual(rooms, ['Garage', 'Kitchen', 'Laundry', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Media Room', 'Bedroom 4', 'Study', 'Family', 'Alfresco']);
const smaller = houseRoomNames(projectLocations({ book, workbook: { aiPlanTakeoffJob: { placedOpenings: [opening('bed-1', 'Bed 1')] } } }).map(location => location.name));
assert(!smaller.includes('Media Room') && !smaller.includes('Bedroom 4'), 'a room the project does not have is never added');
assert.deepEqual(smaller, ['Bedroom 1'], 'template rooms are not project rooms: no Living, no Bedroom 2 the plans do not show');
pass('rooms are the project room list (Media Room and Bedroom 4 from the takeoff); trade containers are not rooms');

// ---- Schedule, completion and summaries ---------------------------------------------------------
let schedule = normaliseElectricalSchedule(null, rooms);
assert.deepEqual(schedule.rooms.map(room => room.room), rooms);
assert.deepEqual(electricalScheduleProgress(schedule), { total: 11, complete: 0, started: 0, allComplete: false });
schedule = setRoom(schedule, 'Kitchen', { points: { 'double-gpo': 6, data: 1, fridge: 1, dishwasher: 1 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
assert.deepEqual(electricalRoomSummary(schedule.rooms.find(room => room.room === 'Kitchen')), ['6 powerpoints', '1 data point', '2 appliance points']);
schedule = setRoom(schedule, 'Garage', { status: ELECTRICAL_ROOM_STATUS.standard });
assert.equal(electricalScheduleProgress(schedule).complete, 2, 'a room with no additional electrical changes still counts as complete');
const kitchenPoints = electricalPointsForRoom({ room: 'Kitchen', points: {}, included: {} }).shown.map(type => type.key);
for (const key of ['double-gpo', 'single-gpo', 'tv', 'data', 'fridge', 'dishwasher', 'microwave', 'rangehood', 'oven', 'cooktop']) assert(kitchenPoints.includes(key));
assert(!electricalPointsForRoom({ room: 'Bedroom 2', points: {}, included: {} }).shown.some(type => type.key === 'dishwasher'), 'appliance points are offered where they belong, and available elsewhere on request');
const patch = electricalSelectionPatch(requirement, schedule);
assert.equal(patch.allowanceAmount + patch.selectedCost + patch.upgradeCost + patch.guidedSelection.selectedPrice, 0, 'no pricing is created in Client Selections');
assert(!JSON.stringify(patch).match(/productId|productCode|brand|supplier|unitPrice/), 'no product fields on the schedule');
assert.equal(statusForRequirement(requirement, { selected_details: patch.guidedSelection }), 'incomplete');
const everyRoom = { ...schedule, rooms: schedule.rooms.map(room => ({ ...room, status: room.status || ELECTRICAL_ROOM_STATUS.standard })) };
assert.equal(statusForRequirement(requirement, { selected_details: electricalSelectionPatch(requirement, everyRoom).guidedSelection }), 'complete');
// A room added to the project later appears, incomplete, without disturbing saved rooms.
const grown = normaliseElectricalSchedule(patch.guidedSelection.electricalSchedule, [...rooms, 'Rumpus']);
assert.equal(grown.rooms.at(-1).room, 'Rumpus');
assert.equal(grown.rooms.find(room => room.room === 'Kitchen').points['double-gpo'], 6);
assert.deepEqual([electricalScheduleProgress(grown).total, electricalScheduleProgress(grown).complete], [12, 2]);
// A saved room the project no longer lists keeps its quantities, flagged, and is not counted.
const shrunk = normaliseElectricalSchedule(patch.guidedSelection.electricalSchedule, rooms.filter(name => name !== 'Kitchen'));
assert.equal(shrunk.rooms.find(room => room.room === 'Kitchen').notInProject, true);
assert.equal(electricalScheduleProgress(shrunk).total, 10);
pass('completion follows the real room count; standard-inclusion rooms count as complete');

// ---- Quotation Builder sync ---------------------------------------------------------------------
const quotation = () => ({
  'ELECTRICAL (84)': { rows: [
    { id: 'quote-1208', item: 'SINGLE POWER POINT', unit: 'ITEM', excelRate: '$45.00', manualRate: '$75.00', quantity: '6' },
    { id: 'quote-1209', item: 'DOUBLE POWER POINT', unit: 'ITEM', excelRate: '$50.00', manualRate: '$150.00', quantity: '' },
    { id: 'quote-1210', item: 'DOUBLE WEATHERPROOF POWER POINT', unit: 'ITEM', excelRate: '$85.00', manualRate: '', quantity: '1' },
    { id: 'quote-1211', item: 'RANGE HOOD INC FITTING OF SLIDE OUT UNIT', unit: 'ITEM', excelRate: '$95.00' },
    { id: 'quote-1212', item: 'RANGE HOOD INC FITTING OF CANOPY HOOD', unit: 'ITEM', excelRate: '$225.00' },
    { id: 'quote-1214', item: 'TV POINT TO CEILING ONLY', unit: 'ITEM', excelRate: '$50.00', quantity: '4' },
    { id: 'quote-1223', item: 'WALL OVEN', unit: 'ITEM', excelRate: '$130.00' },
    { id: 'quote-1225', item: 'OVEN & HOT PLATE', unit: 'ITEM', excelRate: '$200.00' },
  ] },
  PLUMBING: { rows: [{ id: 'p1', item: 'Basin', quantity: '2' }] },
});
const rates = electricalQuoteRates(quotation());
assert.deepEqual([rates['double-gpo'].rowId, rates['double-gpo'].rate], ['quote-1209', '$150.00'], "the estimator's manual rate is the rate in force");
assert.equal(rates['weatherproof-gpo'].rowId, 'quote-1210');
assert.equal(rates.oven.rowId, 'quote-1223', '"OVEN & HOT PLATE" is not the oven point');
assert.deepEqual(rates.rangehood.ambiguous.length, 2, 'two rangehood rates: never guessed');
assert.deepEqual(electricalEstimateCounts({ quotation: quotation() }, rooms).house.map(item => `${item.quantity} ${item.pointKey}`), ['6 single-gpo', '4 tv', '1 weatherproof-gpo']);

let workbook = { quotation: quotation(), procurement: { items: [{ id: 'keep' }] } };
schedule = setRoom(normaliseElectricalSchedule(null, rooms), 'Kitchen', { points: { 'double-gpo': 6, rangehood: 1 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
workbook = connectElectricalScheduleToQuotation(workbook, bookWith(schedule));
let kitchen = scheduleRows(workbook).find(row => row.id === 'electrical-schedule:kitchen:double-gpo');
assert.deepEqual([kitchen.item, kitchen.location, kitchen.quantity, kitchen.qty, kitchen.excelRate, kitchen.rateSourceRowId, kitchen.source], ['Double Powerpoint - Kitchen', 'Kitchen', 6, 6, '$150.00', 'quote-1209', ELECTRICAL_SCHEDULE_SOURCE]);
assert.equal(scheduleRows(workbook).find(row => row.electricalPointKey === 'rangehood').excelRate, '', 'an ambiguous rate is left for the estimator');
pass('Kitchen Double Powerpoints = 6 reaches the quotation at the estimate rate');

schedule = setRoom(schedule, 'Bedroom 1', { points: { 'double-gpo': 4 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
workbook = connectElectricalScheduleToQuotation(workbook, bookWith(schedule));
const bedroomId = 'electrical-schedule:bedroom-1:double-gpo';
assert.equal(scheduleRows(workbook).find(row => row.id === bedroomId).quantity, 4);
assert.equal(scheduleRows(workbook).length, 3);
// The estimator overrides the rate on the schedule row; the client then changes the quantity.
workbook = { ...workbook, quotation: { ...workbook.quotation, [ELECTRICAL_SCHEDULE_SECTION]: { ...workbook.quotation[ELECTRICAL_SCHEDULE_SECTION], rows: scheduleRows(workbook).map(row => (row.id === bedroomId ? { ...row, manualRate: '$160.00' } : row)) } } };
schedule = setRoom(schedule, 'Bedroom 1', { points: { 'double-gpo': 5 } });
workbook = connectElectricalScheduleToQuotation(workbook, bookWith(schedule));
const bedroomRows = scheduleRows(workbook).filter(row => row.location === 'Bedroom 1');
assert.equal(bedroomRows.length, 1, 'the existing line is updated, not duplicated');
assert.deepEqual([bedroomRows[0].id, bedroomRows[0].quantity, bedroomRows[0].manualRate], [bedroomId, 5, '$160.00']);
assert.equal(scheduleRows(workbook).length, 3);
assert.deepEqual(connectElectricalScheduleToQuotation(workbook, bookWith(schedule)).quotation, workbook.quotation, 'syncing again changes nothing');
pass('Bedroom 1 4 -> 5 updates the same quotation line (stable id, no duplicate, manual rate kept)');

// The estimate's own rows are never touched, and a rate changed there follows through.
assert.deepEqual(workbook.quotation['ELECTRICAL (84)'], quotation()['ELECTRICAL (84)']);
assert.deepEqual(workbook.quotation.PLUMBING, quotation().PLUMBING);
assert.deepEqual(workbook.procurement.items, [{ id: 'keep' }], 'schedule items are not procurement products');
const repriced = connectElectricalScheduleToQuotation({ ...workbook, quotation: { ...workbook.quotation, 'ELECTRICAL (84)': { rows: quotation()['ELECTRICAL (84)'].rows.map(row => (row.id === 'quote-1209' ? { ...row, manualRate: '$175.00' } : row)) } } }, bookWith(schedule));
assert.equal(scheduleRows(repriced).find(row => row.id === 'electrical-schedule:kitchen:double-gpo').excelRate, '$175.00');
// Save / reload: the stored selection round-trips through JSON and rebuilds the same schedule.
const reloaded = JSON.parse(JSON.stringify(bookWith(schedule)));
const restored = normaliseElectricalSchedule(reloaded.rooms[0].rows[0].guidedSelection.electricalSchedule, rooms);
assert.equal(restored.rooms.find(room => room.room === 'Kitchen').points['double-gpo'], 6);
assert.equal(restored.rooms.find(room => room.room === 'Bedroom 1').points['double-gpo'], 5);
assert.equal(restored.rooms.find(room => room.room === 'Bedroom 1').status, ELECTRICAL_ROOM_STATUS.confirmed);
// Removing a quantity removes its row; clearing the schedule removes the section.
workbook = connectElectricalScheduleToQuotation(workbook, bookWith(setRoom(schedule, 'Kitchen', { points: { 'double-gpo': 6 } })));
assert.equal(scheduleRows(workbook).length, 2);
assert.equal(connectElectricalScheduleToQuotation(workbook, { rooms: [] }).quotation[ELECTRICAL_SCHEDULE_SECTION], undefined);
assert.equal(connectElectricalScheduleToQuotation({ quotation: quotation() }, { rooms: [] }).quotation[ELECTRICAL_SCHEDULE_SECTION], undefined);
pass('estimate rows untouched; rates follow the Quotation Builder; quantities persist; removed points are removed');

// ---- Standard Inclusions baseline: INCLUDED / SELECTED / VARIATION -------------------------------
const inclusions = { selectedPackageId: 'premier', packages: [{ id: 'premier' }], sections: [
  { package_id: 'premier', title: 'Electrical', bullets: ['3 x double powerpoints per bedroom', 'Kitchen: 6 double power points', '1 x TV point to Media Room', 'Power point allowance', 'LED downlight allowance'] },
  { package_id: 'other', title: 'Electrical', bullets: ['9 x double powerpoints per bedroom'] },
] };
const baseline = electricalInclusionBaseline(inclusions, rooms);
assert.deepEqual(baseline.byRoom['bedroom-1'], { 'double-gpo': 3 });
assert.deepEqual(baseline.byRoom['bedroom-4'], { 'double-gpo': 3 });
assert.deepEqual(baseline.byRoom.kitchen, { 'double-gpo': 6 });
assert.deepEqual(baseline.byRoom['media-room'], { tv: 1 });
assert.equal(baseline.byRoom.garage, undefined, 'an allowance that names no room is never guessed into rooms');
assert.deepEqual(baseline.lines, ['3 x double powerpoints per bedroom', 'Kitchen: 6 double power points', '1 x TV point to Media Room', 'Power point allowance'], 'light fitting allowances are not listed under Electrical');
assert.deepEqual(electricalInclusionBaseline({ sections: [{ title: 'Electrical', bullets: ['Power point allowance'] }] }, rooms).byRoom, {});
assert.deepEqual(electricalInclusionBaseline({ electricalAllowances: [{ room: 'Bedroom 2', point: 'double-gpo', quantity: 2 }] }, rooms).byRoom, { 'bedroom-2': { 'double-gpo': 2 } });
let included = normaliseElectricalSchedule(null, rooms, { baseline });
assert.deepEqual(included.rooms.find(room => room.room === 'Bedroom 1').points, { 'double-gpo': 3 }, 'a room starts from its included quantities');
included = setRoom(included, 'Bedroom 1', { points: { 'double-gpo': 5 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
included = setRoom(included, 'Bedroom 2', { status: ELECTRICAL_ROOM_STATUS.standard });
const lines = electricalScheduleLines(included);
const line = id => lines.find(item => item.id === id);
assert.deepEqual([line(bedroomId).includedQty, line(bedroomId).selectedQty, line(bedroomId).variationQty], [3, 5, 2]);
assert.deepEqual([line('electrical-schedule:bedroom-2:double-gpo').includedQty, line('electrical-schedule:bedroom-2:double-gpo').selectedQty, line('electrical-schedule:bedroom-2:double-gpo').variationQty], [3, 3, 0]);
const includedRow = scheduleRows(connectElectricalScheduleToQuotation({ quotation: quotation() }, bookWith(included))).find(row => row.id === bedroomId);
assert.deepEqual([includedRow.includedQty, includedRow.selectedQty, includedRow.variationQty, includedRow.quantity], [3, 5, 2, 5]);
assert.equal(includedRow.description, 'Included 3 · Selected 5 · Variation +2');
pass('Standard Inclusions baseline: included 3, selected 5, variation 2 kept separate');

// An estimate row that names a room pre-populates that room; whole-house counts are not spread about.
const located = electricalEstimateCounts({ quotation: { ELECTRICAL: { rows: [{ id: 'd', item: 'DOUBLE POWER POINT', quantity: '4', location: 'Bedroom 1' }, { id: 't', item: 'TV POINT', quantity: '3' }] } } }, rooms);
assert.deepEqual(located.byRoom, { 'bedroom-1': { 'double-gpo': 4 } });
const prefilled = normaliseElectricalSchedule(null, rooms, { estimate: located });
assert.deepEqual(prefilled.rooms.find(room => room.room === 'Bedroom 1').points, { 'double-gpo': 4 });
assert.deepEqual(prefilled.rooms.find(room => room.room === 'Bedroom 2').points, {});
pass('existing room quantities in the estimate are pre-populated');

// ---- The current project (recovered copy of the live job), when it is on this machine -----------
const jobCopy = 'recovery/quotation-changes-2026-10-03/browser-1-01-1f7.json';
if (fs.existsSync(jobCopy)) {
  const raw = JSON.parse(fs.readFileSync(jobCopy, 'utf8'));
  const job = raw.workbook || raw;
  const jobBook = job.clientSelectionsBook;
  const cabinetry = jobBook.rooms.flatMap(room => room.rows || []).find(row => row.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection.locations || [];
  const jobRooms = houseRoomNames(projectLocations({ book: jobBook, cabinetryLocations: cabinetry, workbook: job }).map(location => location.name));
  console.log(`\nCurrent project "${job.jobName || job.projectName}" - canonical rooms (${jobRooms.length}):\n  ${jobRooms.join(', ')}`);
  assert(jobRooms.includes('Media Room') && jobRooms.includes('Bedroom 4'));
  assert(!jobRooms.includes('Living'), 'Living was only a Selections Book template room');
  assert(jobRooms.includes("Butler's Pantry"));
  for (const name of ['External Walls', 'Roof', 'Windows', 'Electrical', 'Lighting', 'Paint', 'External']) assert(!jobRooms.includes(name));
  let jobSchedule = normaliseElectricalSchedule(null, jobRooms, { baseline: electricalInclusionBaseline(job.standardInclusions, jobRooms), estimate: electricalEstimateCounts(job, jobRooms) });
  jobSchedule = setRoom(jobSchedule, 'Kitchen', { points: { 'double-gpo': 6 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
  let jobWorkbook = connectElectricalScheduleToQuotation(job, bookWith(jobSchedule));
  const jobRow = id => scheduleRows(jobWorkbook).find(row => row.id === id);
  assert.deepEqual([jobRow('electrical-schedule:kitchen:double-gpo').quantity, jobRow('electrical-schedule:kitchen:double-gpo').excelRate, jobRow('electrical-schedule:kitchen:double-gpo').rateSourceRowId], [6, '$150.00', 'quote-1209']);
  jobSchedule = setRoom(jobSchedule, 'Bedroom 1', { points: { 'double-gpo': 4 }, status: ELECTRICAL_ROOM_STATUS.confirmed });
  jobWorkbook = connectElectricalScheduleToQuotation(jobWorkbook, bookWith(jobSchedule));
  assert.equal(jobRow(bedroomId).quantity, 4);
  jobSchedule = setRoom(jobSchedule, 'Bedroom 1', { points: { 'double-gpo': 5 } });
  jobWorkbook = connectElectricalScheduleToQuotation(jobWorkbook, bookWith(jobSchedule));
  assert.equal(jobRow(bedroomId).quantity, 5);
  assert.equal(scheduleRows(jobWorkbook).length, 2);
  assert.deepEqual(jobWorkbook.quotation['ELECTRICAL (84)'], job.quotation['ELECTRICAL (84)']);
  console.log(`  Whole-house counts already in the estimate: ${electricalEstimateCounts(job, jobRooms).house.map(item => `${item.quantity} x ${item.label}`).join(', ') || 'none'}`);
  pass('current project: real rooms, Kitchen 6 and Bedroom 1 4 -> 5 on one quotation line each');
} else console.log('SKIP current-project check (recovered job copy not on this machine)');

console.log('\nElectrical schedule: all checks passed');
