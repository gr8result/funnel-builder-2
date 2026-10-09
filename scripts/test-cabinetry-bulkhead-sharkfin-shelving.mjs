// MDF bulkheads in LM, Sharkfin handle upgrade by eligible fronts, open shelving standard sizes.
// All three run through the one cabinetry engine and the one approved catalogue.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-bulkhead-sharkfin-shelving.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { normaliseCabinetrySelection, buildCabinetrySelectionPayload } from '../lib/builders/cabinetryWorkflow.js';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryScheduleCatalogue, cabinetryScheduleGroup, cabinetryWetAreaTag, bulkheadRuns, sharkfinUpgrade, openShelvingUnit, cabinetScheduleMeasure,
  OPEN_SHELVING_SIZES, CABINETRY_ACTION_REQUIRED, CABINETRY_OUTCOME_MATCHED, CABINETRY_MANUAL_OVERRIDE, CABINETRY_MEASUREMENT_REQUIRED, CABINETRY_RATE_REQUIRED } from '../lib/construction-estimation/cabinetryRequirements.js';

const owner = source.workspaceId;
const results = {};
const check = (name, run) => { try { run(); results[name] = 'PASS'; } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, String(error.message).slice(0, 1200)); } };
const offered = room => cabinetryScheduleCatalogue(room).flatMap(group => group.items);
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const rowsOf = book => book.quotation.CABINETRY.rows;
const find = (book, room, range, item) => { const hits = rowsOf(book).filter(row => row.room === room && row.range === range && row.item === item); assert.equal(hits.length, 1, `${room}/${range}/${item}`); return hits[0]; };
const entry = (book, room, type) => book.cabinetryReconciliation.entries.filter(item => item.room === room && item.type === type);
const std = 'STANDARD COLOURBOARD', K = 'KITCHEN CABINETRY', L = 'LAUNDRY CABINETRY', BP = "BUTLER'S PANTRY CABINETRY";
let n = 0;
const line = (room, id, quantity, more = {}) => ({ componentId: `LINE-${++n}`, location: room, cabinetTypeId: id, unitType: offered(room).find(item => item.id === id).label, quantity, handleQuantity: quantity,
  ...(cabinetryScheduleGroup(room) === 'bathroom' ? { type: cabinetryWetAreaTag(id) } : {}), ...more });
const bookOf = selection => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: {
  ...buildCabinetrySelectionPayload({ workspaceId: owner, projectId: 'p1', selection, requirement: { requirementKey: 'cabinetry', label: 'Cabinetry', areaKey: 'cabinetry' } }).selected_details, requirementKey: 'cabinetry' } }] }] });
const selectionOf = book => book.clientSelectionsBook.rooms[0].rows[0].guidedSelection.cabinetrySelection;
const job = (locations, schedule, from = base) => apply({ ...from, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations, schedule })) }, owner);
const room = (name, more = {}) => ({ location: name, name, ...more });
const sharkfin = { base: { openingMethod: 'Sharkfin', productName: 'Sharkfin' }, overhead: { openingMethod: 'Handleless', productName: 'Handleless' } };
const run = (location, lengthMm) => ({ id: `run-${location}`, location, lengthMm });

check('BULKHEADS ARE MEASURED AND PRICED IN LM', () => {
  // Several runs in one room, entered in mm; a second room has its own runs.
  const book = job([room('Kitchen'), room('Laundry')], [
    line('Kitchen', 'bulkhead_300', 0, { runs: [run('Above overheads', 2400), run('Above fridge', 950), run('Return', 600)] }),
    line('Laundry', 'bulkhead_300', 0, { runs: [run('Above overheads', 1800)] })]);
  assert.equal(bulkheadRuns({ runs: [run('a', 2400), run('b', 950), run('c', 600)] }).lm, 3.95);
  assert.equal(find(book, K, std, 'MDF bulkhead - 300mm - LM').quantity, 3.95);
  assert.equal(find(book, K, std, 'MDF bulkhead - 300mm - LM').unit, 'LM');
  assert.equal(find(book, L, std, 'MDF bulkhead - 300mm - LM').quantity, 1.8);
  const kitchen = entry(book, 'Kitchen', 'bulkhead_300');
  assert.equal(kitchen.length, 1, 'one requirement, however many runs');
  assert.deepEqual([kitchen[0].outcome, kitchen[0].quantity, kitchen[0].basis], [CABINETRY_OUTCOME_MATCHED, 3.95, '3 runs: Above overheads 2400mm + Above fridge 950mm + Return 600mm']);
  // The runs survive the Client Selections save, and BOQ / RFQ / procurement carry the same LM.
  const saved = selectionOf(book);
  assert.deepEqual(saved.schedule[0].runs.map(item => item.lengthMm), [2400, 950, 600]);
  const boq = saved.boqLines.filter(item => item.cabinetTypeId === 'bulkhead_300');
  assert.deepEqual(boq.map(item => [item.location, item.quantity, item.unit]), [['Kitchen', 3.95, 'LM'], ['Laundry', 1.8, 'LM']]);
  assert.deepEqual(saved.cabinetmakerRfq.lines.filter(item => item.cabinetTypeId === 'bulkhead_300').map(item => [item.quantity, item.unit]), [[3.95, 'LM'], [1.8, 'LM']]);
  assert.deepEqual(saved.procurementSchedule.filter(item => /bulkhead/i.test(item.itemName)).map(item => [item.quantity, item.unit]), [[3.95, 'LM'], [1.8, 'LM']]);
  assert(!saved.boqLines.some(item => /handles/.test(item.itemName) && /bulkhead/i.test(item.componentId || '')), 'a bulkhead has no handle line');
  // A run changed: the same quote row follows; nothing is appended.
  const longer = job([room('Kitchen')], [{ ...saved.schedule[0], runs: [run('Above overheads', 3000)] }], book);
  assert.equal(find(longer, K, std, 'MDF bulkhead - 300mm - LM').quantity, 3);
  assert.equal(find(longer, L, std, 'MDF bulkhead - 300mm - LM').quantity, '', 'the removed room is cleared');
  assert.equal(rowsOf(longer).length, rowsOf(base).length);
});

check('A BULKHEAD COUNT IS NEVER READ AS A LENGTH', () => {
  // A line saved before runs existed: a count of 2, no length.
  const before = job([room('Kitchen')], [line('Kitchen', 'bulkhead_450', 2)]);
  assert.equal(find(before, K, std, 'MDF bulkhead - 450mm - LM').quantity, '', 'no LM is invented');
  const [item] = entry(before, 'Kitchen', 'bulkhead_450');
  assert.deepEqual([item.outcome, item.flag, item.reason, item.quantity], [CABINETRY_ACTION_REQUIRED, CABINETRY_MEASUREMENT_REQUIRED, 'Bulkhead length required - saved as a count of 2, not a length', 0]);
  assert.match(item.action.label, /Enter the length of each bulkhead run in Client Selections > Cabinetry > Kitchen > Cabinet Schedule/);
  assert.equal(selectionOf(before).schedule[0].quantity, 2, 'the saved line is kept as it was');
  assert.deepEqual(cabinetScheduleMeasure(selectionOf(before).schedule[0]), { quantity: 0, unit: 'LM', name: '', note: 'Length required' });
  // Runs added but not yet measured are still "length required"; an unticked bulkhead asks for nothing.
  assert.equal(entry(job([room('Kitchen')], [line('Kitchen', 'bulkhead_450', 0, { runs: [run('Above overheads', '')] })]), 'Kitchen', 'bulkhead_450')[0].reason, 'Bulkhead length required');
  assert.deepEqual(entry(job([room('Kitchen')], [line('Kitchen', 'bulkhead_450', 0)]), 'Kitchen', 'bulkhead_450').map(found => found.outcome), [CABINETRY_OUTCOME_MATCHED]);
});

const kitchenUnits = () => [line('Kitchen', 'base_unit_1200_2door', 2), line('Kitchen', 'base_unit_600_1door', 1), line('Kitchen', 'drawer_base_3', 2), line('Kitchen', 'drawer_base_4', 1), line('Kitchen', 'hidden_internal_drawer', 3),
  line('Kitchen', 'dishwasher_opening', 1), line('Kitchen', 'underbench_oven', 1), line('Kitchen', 'overhead_2door_standard', 3), line('Kitchen', 'tall_pantry_1200', 1)];
check('SHARKFIN QUANTITY IS THE ELIGIBLE FRONTS', () => {
  // 2x2 + 1 short doors, 2x3 + 4 external drawer fronts = 15. Internal drawers, appliance openings,
  // tall doors and the handleless overheads are not counted.
  const book = job([room('Kitchen', { handles: sharkfin })], kitchenUnits());
  assert.equal(find(book, K, std, 'Sharkfin handle upgrade - per unit').quantity, 15);
  const [item] = entry(book, 'Kitchen', 'handle_upgrade_sharkfin');
  assert.deepEqual([item.outcome, item.quantity], [CABINETRY_OUTCOME_MATCHED, 15]);
  const upgrade = sharkfinUpgrade({ handles: sharkfin }, selectionOf(book).schedule);
  assert.deepEqual(upgrade.counted.map(found => [found.typeId, found.units, found.each, found.fronts]), [['base_unit_1200_2door', 2, 2, 4], ['base_unit_600_1door', 1, 1, 1], ['drawer_base_3', 2, 3, 6], ['drawer_base_4', 1, 4, 4]]);
  assert.deepEqual(upgrade.excluded.map(found => [found.label, found.reason]), [['Hidden internal drawer', 'internal drawer'], ['Dishwasher cabinet', 'appliance opening'], ['Underbench oven cabinet', 'appliance opening'],
    ['Overhead cabinet - 2 door - standard height', 'overhead cabinets do not have Sharkfin'], ['Tall pantry cabinet - 2 door - 1200mm - 5 shelves', 'tall door']]);
  // Overheads with Sharkfin as well: their short doors join in. Tall doors only when asked for.
  const both = { base: sharkfin.base, overhead: sharkfin.base };
  assert.equal(sharkfinUpgrade({ handles: both }, selectionOf(book).schedule).quantity, 21);
  assert.equal(sharkfinUpgrade({ handles: both }, [...selectionOf(book).schedule, { cabinetTypeId: 'handle_upgrade_sharkfin', quantity: 1, includeTall: true }]).quantity, 23);
  // A door count typed on a line is that unit's front count.
  assert.equal(sharkfinUpgrade({ handles: sharkfin }, selectionOf(book).schedule.map(found => found.cabinetTypeId === 'dishwasher_opening' ? { ...found, doorDrawerCount: '1' } : found)).quantity, 16);
  // No Sharkfin chosen and the upgrade not ticked: nothing is charged.
  assert.deepEqual(entry(job([room('Kitchen')], kitchenUnits()), 'Kitchen', 'handle_upgrade_sharkfin'), []);
  // The quantity in BOQ and procurement is the same one.
  const withLine = job([room('Kitchen', { handles: sharkfin })], [...kitchenUnits(), line('Kitchen', 'handle_upgrade_sharkfin', 1)]);
  assert.deepEqual(selectionOf(withLine).boqLines.filter(found => found.cabinetTypeId === 'handle_upgrade_sharkfin').map(found => [found.quantity, found.unit]), [[15, 'EACH']]);
});

check('SHARKFIN: ONE CHARGE PER ROOM, RECALCULATED, WITH A MANUAL OVERRIDE', () => {
  // The ticked upgrade line (saved as 1) and the handle choice are one charge, not two.
  const units = kitchenUnits();
  const ticked = line('Kitchen', 'handle_upgrade_sharkfin', 1);
  const book = job([room('Kitchen', { handles: sharkfin }), room("Butler's Pantry", { handles: sharkfin })], [...units, ticked, line("Butler's Pantry", 'drawer_base_3', 2)]);
  assert.equal(entry(book, 'Kitchen', 'handle_upgrade_sharkfin').length, 1);
  assert.equal(find(book, K, std, 'Sharkfin handle upgrade - per unit').quantity, 15, 'not 1, and not 15 + 1');
  assert.equal(find(book, BP, std, 'Sharkfin handle upgrade - per unit').quantity, 6, 'every room with Sharkfin has its own quantity');
  // Cabinets change: the existing quote row is updated, none added.
  const fewer = job([room('Kitchen', { handles: sharkfin })], [...units.filter(found => found.cabinetTypeId !== 'drawer_base_4'), ticked], book);
  assert.equal(find(fewer, K, std, 'Sharkfin handle upgrade - per unit').quantity, 11);
  assert.equal(find(fewer, BP, std, 'Sharkfin handle upgrade - per unit').quantity, '');
  assert.equal(rowsOf(fewer).length, rowsOf(base).length);
  // Handle changed away from Sharkfin: the upgrade is no longer charged (the ticked line still asks for the base cabinets).
  assert.equal(find(job([room('Kitchen', { handles: { base: sharkfin.overhead } })], units, book), K, std, 'Sharkfin handle upgrade - per unit').quantity, '');
  // Manual total on the upgrade line; clearing it returns to the calculated quantity.
  const manual = job([room('Kitchen', { handles: sharkfin })], [...units, { ...ticked, quantityOverride: 12 }], book);
  assert.equal(find(manual, K, std, 'Sharkfin handle upgrade - per unit').quantity, 12);
  assert.match(entry(manual, 'Kitchen', 'handle_upgrade_sharkfin')[0].basis, /^Manual quantity 12 \(calculated 15\)/);
  assert.equal(find(job([room('Kitchen', { handles: sharkfin })], [...units, { ...ticked, quantityOverride: '' }], manual), K, std, 'Sharkfin handle upgrade - per unit').quantity, 15);
  // An estimator's own quantity typed on the quote row is still kept and marked.
  const typed = apply({ ...book, quotation: { ...book.quotation, CABINETRY: { ...book.quotation.CABINETRY, rows: rowsOf(book).map(row => row === find(book, K, std, 'Sharkfin handle upgrade - per unit') ? { ...row, quantity: 20 } : row) } } }, owner);
  assert.equal(find(typed, K, std, 'Sharkfin handle upgrade - per unit').quantity, 20);
  assert.equal(entry(typed, 'Kitchen', 'handle_upgrade_sharkfin')[0].outcome, CABINETRY_MANUAL_OVERRIDE);
  // The finish changes: the upgrade moves to that finish's rate row.
  const painted = job([room('Kitchen', { handles: sharkfin, doorMaterialGroup: 'Two-pack painted' })], units, book);
  assert.equal(find(painted, K, '2 PACK', 'Sharkfin handle upgrade - per unit').quantity, 15); assert.equal(find(painted, K, std, 'Sharkfin handle upgrade - per unit').quantity, '');
});

check('SHARKFIN USES ONE MASTER RATE ACROSS CABINETRY ROOMS', () => {
  const book = job([room('Laundry', { handles: sharkfin }), room('Ensuite', { bathroomHandles: { wallMountedVanity: { openingMethod: 'Finger Pull - Shark Fin' } } })],
    [line('Laundry', 'base_unit_1200_2door', 1), line('Ensuite', 'vanity_wallhung_3drawer_900', 1), line('Ensuite', 'vanity_floor_2door_1200', 1), line('Ensuite', 'shaving_cabinet_600', 1)]);
  const [laundry] = entry(book, 'Laundry', 'handle_upgrade_sharkfin'), [ensuite] = entry(book, 'Ensuite', 'handle_upgrade_sharkfin');
  assert.deepEqual([laundry.outcome, laundry.flag, laundry.quantity], [CABINETRY_OUTCOME_MATCHED, '', 2]);
  // Only the wall-mounted vanity has Sharkfin: its 3 drawer fronts, not the floor vanity or the mirror.
  assert.deepEqual([ensuite.outcome, ensuite.quantity], [CABINETRY_OUTCOME_MATCHED, 3]);
  const sharkfinRow = rowsOf(book).find(row => /Sharkfin/.test(row.item) && row.quantity === 5);
  assert(sharkfinRow, 'Laundry and Ensuite fronts are carried on the approved master-rate row');
  assert.equal(Number(sharkfinRow.excelRate), 30);
  assert.match(sharkfinRow.selectionSpec, /Laundry 2, Ensuite 3/);
  const configured = apply({ ...book, cabinetryPricing: { sharkfin: { masterRate: 32 } } }, owner);
  assert.equal(Number(rowsOf(configured).find(row => row.importKey === sharkfinRow.importKey).excelRate), 32);
});

check('OPEN SHELVING: STANDARD SIZES, EDITABLE, PRICED BY SIZE', () => {
  assert.deepEqual(OPEN_SHELVING_SIZES.map(size => [size.label, size.heightMm, size.widthMm, size.shelves]), [['Tall Wide', 2100, 1200, 5], ['Tall Narrow', 2100, 600, 5], ['Medium Wide', 1200, 1200, null], ['Low Wide', 900, 1200, null]]);
  assert.equal(openShelvingUnit({ shelfUnit: { sizeKey: 'tall_wide' } }).label, 'Open shelving - Tall Wide 2100 x 1200mm - 5 adjustable shelves');
  assert.equal(openShelvingUnit({ shelfUnit: { sizeKey: 'tall_narrow', shelves: 6, depthMm: 400, boardThicknessMm: 18, material: 'Melamine', finish: 'White' } }).label, 'Open shelving - Tall Narrow 2100 x 600mm - 400mm deep - 6 adjustable shelves - 18mm board - Melamine - White');
  assert.equal(openShelvingUnit({ shelfUnit: { sizeKey: 'medium_wide' } }).label, 'Open shelving - Medium Wide 1200 x 1200mm - shelf quantity to be set');
  assert.equal(openShelvingUnit({ shelfUnit: { sizeKey: 'low_wide', shelves: 2 } }).label, 'Open shelving - Low Wide 900 x 1200mm - 2 adjustable shelves');
  // Dimensions changed from the standard: a custom unit.
  assert.deepEqual([openShelvingUnit({ shelfUnit: { sizeKey: 'tall_wide', widthMm: 1500 } }).sizeKey, openShelvingUnit({ shelfUnit: { sizeKey: 'custom', heightMm: 1800, widthMm: 800, shelves: 4 } }).label], ['custom', 'Open shelving - Custom 1800 x 800mm - 4 adjustable shelves']);
  assert.equal(openShelvingUnit({ quantity: 1 }), null, 'a line saved before sizes has no unit');

  // Several units in one room, and a unit in another room.
  const book = job([room('Kitchen'), room('Laundry')], [
    line('Kitchen', 'open_shelf', 2, { shelfUnit: { sizeKey: 'tall_wide', position: 'Beside fridge' } }), line('Kitchen', 'open_shelf', 1, { shelfUnit: { sizeKey: 'low_wide', shelves: 2 } }),
    line('Laundry', 'open_shelf', 1, { shelfUnit: { sizeKey: 'tall_narrow' } }), line('Kitchen', 'base_unit_1200_2door', 1)]);
  const units = entry(book, 'Kitchen', 'open_shelf');
  assert.deepEqual(units.map(item => [item.label, item.quantity, item.outcome, item.flag]), [['Open shelving - Tall Wide 2100 x 1200mm - 5 adjustable shelves', 2, CABINETRY_ACTION_REQUIRED, CABINETRY_RATE_REQUIRED], ['Open shelving - Low Wide 900 x 1200mm - 2 adjustable shelves', 1, CABINETRY_ACTION_REQUIRED, CABINETRY_RATE_REQUIRED]]);
  assert.match(units[0].action.label, /Add an EA rate for open shelving Tall Wide \(2100 x 1200mm\)/);
  // No size has a rate in the approved catalogue, so the single "module" rate is not applied to it.
  assert.equal(find(book, K, std, 'Open shelving module').quantity, '');
  assert.equal(find(book, L, std, 'Open shelving module').quantity, '');
  assert.equal(find(book, K, std, '2 door base unit - 1200mm').quantity, 1, 'other cabinetry is unaffected');
  // The configuration survives the save; BOQ / RFQ name the size and count units in EA.
  const saved = selectionOf(book);
  assert.deepEqual(saved.schedule[0].shelfUnit, { sizeKey: 'tall_wide', position: 'Beside fridge' });
  assert.deepEqual(saved.boqLines.filter(item => item.cabinetTypeId === 'open_shelf').map(item => [item.itemName, item.quantity, item.unit]),
    [['Kitchen Open shelving - Tall Wide 2100 x 1200mm - 5 adjustable shelves', 2, 'EA'], ['Kitchen Open shelving - Low Wide 900 x 1200mm - 2 adjustable shelves', 1, 'EA'], ['Laundry Open shelving - Tall Narrow 2100 x 600mm - 5 adjustable shelves', 1, 'EA']]);
  assert.equal(saved.cabinetmakerRfq.lines.find(item => item.cabinetTypeId === 'open_shelf').shelfUnit.position, 'Beside fridge');
});

check('AN EXISTING OPEN SHELVING SELECTION IS KEPT AS IT WAS', () => {
  // Saved before sizes existed: still the catalogue's module, at the quantity selected.
  const book = job([room('Kitchen')], [line('Kitchen', 'open_shelf', 2), line('Kitchen', 'cleated_shelf', 1), line('Kitchen', 'floating_shelf', 3)]);
  assert.equal(find(book, K, std, 'Open shelving module').quantity, 2);
  assert.equal(find(book, K, std, 'Cleated shelving module').quantity, 1);
  assert.equal(find(book, K, std, 'Floating shelf module').quantity, 3);
  assert.deepEqual(entry(book, 'Kitchen', 'open_shelf').map(item => item.outcome), [CABINETRY_OUTCOME_MATCHED]);
});

for (const [name, result] of Object.entries(results)) console.log(`${name}: ${result}`);
if (Object.values(results).includes('FAIL')) process.exit(1);
