// Client Selections room Cabinet Schedule <-> Quotation Builder: one cabinet taxonomy, one quantity.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-selection-quote-sync.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { preserveQuoteQuantityOwnership } from '../lib/builders/selectionRegistry.js';
import { buildCabinetrySelectionPayload, defaultCabinetryDraft, normaliseCabinetrySelection, cabinetryScheduleScope, cabinetryLocationMissingRequirements, CABINETRY_WORKFLOW_STAGES, CABINETRY_SCHEDULE_TYPE_OPTIONS, LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS } from '../lib/builders/cabinetryWorkflow.js';
import fs from 'node:fs';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryScheduleCatalogue, cabinetryCatalogueRow, cabinetryRoomGroup, legacyCabinetryScheduleType, migrateWorkbookCabinetSchedules, migrateCabinetSchedule,
  CABINETRY_FINISHES, CABINETRY_LINK_FIELD, CABINETRY_MATCHED, CABINETRY_UNMATCHED } from '../lib/construction-estimation/cabinetryRequirements.js';

const owner = source.workspaceId;
const results = {};
const check = (name, run) => { try { run(); results[name] ??= 'PASS'; } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, String(error.message).slice(0, 700)); } };
const products = source.rows.filter(row => row.type === 'product');
const K = 'KITCHEN CABINETRY', BP = "BUTLER'S PANTRY CABINETRY", L = 'LAUNDRY CABINETRY';
const ROOMS = { Kitchen: K, "Butler's Pantry": BP, Laundry: L };

// --- The schedule offered in Client Selections IS the quotation catalogue for the room. ---
const item = (room, label) => { const hits = cabinetryScheduleCatalogue(room).flatMap(group => group.items).filter(entry => entry.label === label); assert.equal(hits.length, 1, `${room}: ${label}`); return hits[0]; };
check('TAXONOMY', () => {
  for (const [room, catalogueRoom] of Object.entries(ROOMS)) {
    const groups = cabinetryScheduleCatalogue(room);
    const offered = groups.flatMap(group => group.items);
    assert.equal(new Set(offered.map(entry => entry.id)).size, offered.length, 'stable ids are unique in a room');
    // Every offered item has an approved quote row in every finish; every quote row can be scheduled.
    for (const finish of CABINETRY_FINISHES) {
      const quoteRows = products.filter(row => row.room === catalogueRoom && row.range === finish.range);
      const mapped = offered.map(entry => cabinetryCatalogueRow(cabinetryRoomGroup(room), entry.id, finish.key));
      assert(mapped.every(Boolean), `${room}/${finish.label}: an offered item has no quote row`);
      assert.deepEqual(new Set(mapped.map(row => row.importKey)), new Set(quoteRows.map(row => row.key || `final-cabinetry:${row.sourceRow}`)), `${room}/${finish.label}: schedule and quotation list the same items`);
    }
    // End panels (priced for Kitchen only) are their own group, set in Doors & Panels.
    assert.deepEqual(groups.map(group => group.key), room === 'Kitchen' ? ['base', 'overhead', 'tall', 'extras', 'panels'] : ['base', 'overhead', 'tall', 'extras']);
    const overhead = groups.find(group => group.key === 'overhead').items.map(entry => entry.label);
    assert(overhead.includes('Overhead cabinet - 1 door - standard height') && overhead.includes('Overhead cabinet - 2 door - standard height'), `${room} offers 1 door and 2 door overheads`);
    const base = groups.find(group => group.key === 'base').items.map(entry => entry.label);
    assert(base.includes('1 door base unit - 600mm') && base.includes('2 door base unit - 1200mm'), `${room} offers 1 door and 2 door base units`);
    assert(!offered.some(entry => /standard base unit/i.test(entry.label)));
  }
  // Same id for the same cabinet in every room; the label may differ (Laundry's sink cabinet).
  assert.equal(item('Kitchen', '2 door base unit - 1200mm').id, item('Laundry', '2 door base unit - 1200mm').id);
  assert.equal(item('Kitchen', 'Sink base cabinet').id, item('Laundry', 'Laundry sink cabinet').id);
  assert.deepEqual(cabinetryScheduleCatalogue("Butler's Pantry").find(group => group.key === 'tall').items.map(entry => entry.label), ['Tall pantry cabinet - 1 door - 600mm - 5 shelves', 'Tall pantry cabinet - 2 door - 1200mm - 5 shelves']);
  assert(cabinetryScheduleCatalogue('Kitchen').find(group => group.key === 'tall').items.some(entry => entry.label === 'Tall oven tower cabinet - 600mm'));
  assert.deepEqual(cabinetryScheduleCatalogue('Bathroom'), [], 'wet areas keep the vanity schedule');
});

// --- Job fixture: the book is built by the same functions the Client Selections page uses. ---
let lineNumber = 0;
const line = (room, label, quantity) => ({ componentId: `CAB-${room}-${++lineNumber}`, location: room, cabinetTypeId: item(room, label).id, unitType: label, quantity, handleQuantity: quantity });
const location = (name, extra = {}) => ({ location: name, name, ...extra });
const bookFrom = selection => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: {
  ...buildCabinetrySelectionPayload({ workspaceId: owner, projectId: 'project-1', selection, requirement: { requirementKey: 'cabinetry', label: 'Cabinetry', areaKey: 'cabinetry' } }).selected_details, requirementKey: 'cabinetry' } }] }] });
const scheduleOf = book => book.rooms[0].rows[0].guidedSelection.cabinetrySelection.schedule;
const setQuantity = (selection, room, label, quantity) => normaliseCabinetrySelection({ ...selection, schedule: selection.schedule.map(entry => entry.location === room && entry.cabinetTypeId === item(room, label).id ? { ...entry, quantity, handleQuantity: quantity } : entry) });
const inclusions = { schedule: { id: 'premier', display_name: 'Premier Inclusions', workspace_id: owner }, items: [{ selection_slot_id: 'cabinetry_finish', baselineProductName: 'Standard Colourboard' }] };
const base = { ...reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner), jobInclusionSnapshot: inclusions };
const rowsOf = book => book.quotation.CABINETRY.rows;
const find = (book, room, range, label) => { const hits = rowsOf(book).filter(row => row.room === room && row.range === range && row.item === label); assert.equal(hits.length, 1, `${room}/${range}/${label}`); return hits[0]; };
const quoted = (book, room, range) => Object.fromEntries(rowsOf(book).filter(row => row.room === room && row.range === range && row.quantity !== '' && row.quantity != null).map(row => [row.item, row.quantity]));
const populated = book => rowsOf(book).filter(row => row.quantity !== '' && row.quantity != null).length;
const structure = book => rowsOf(book).map(row => `${row.id}|${row.item}|${row.excelRate}`);
// What updateClientSelectionsBook does on every Client Selections save.
const saveSelections = (workbook, selection) => { const next = { ...workbook, clientSelectionsBook: bookFrom(selection) }; return apply(preserveQuoteQuantityOwnership(workbook, next), owner); };
const std = 'STANDARD COLOURBOARD', pack = '2 PACK';

const KITCHEN = { '1 door base unit - 600mm': 2, '2 door base unit - 1200mm': 4, 'Corner base cabinet': 1, '4 drawer base unit': 2, 'Overhead cabinet - 1 door - standard height': 3,
  'Overhead cabinet - 2 door - standard height': 4, 'Rangehood cabinet': 1, 'Tall pantry cabinet - 1 door - 600mm - 5 shelves': 1 };
let selection = defaultCabinetryDraft({ locations: [location('Kitchen', { doorMaterialGroup: 'Two-pack painted', confirmedAt: '2026-10-05T00:00:00.000Z' }), location("Butler's Pantry"), location('Laundry')],
  schedule: Object.entries(KITCHEN).map(([label, quantity]) => line('Kitchen', label, quantity)) });
let job = saveSelections(base, selection);

check('KITCHEN', () => {
  assert.deepEqual(quoted(job, K, pack), KITCHEN, 'Quotation Builder shows exactly the scheduled quantities');
  for (const finish of CABINETRY_FINISHES.filter(entry => entry.range !== pack)) assert.deepEqual(quoted(job, K, finish.range), {});
  assert.equal(populated(job), Object.keys(KITCHEN).length);
  const row = find(job, K, pack, '2 door base unit - 1200mm');
  assert.equal(row.selectionSpec, 'Kitchen · 2 Pack · From Client Selections · Qty from Client Selections');
  assert.equal(row[CABINETRY_LINK_FIELD].cabinetTypeId, 'base_unit_1200_2door'); assert.deepEqual(row[CABINETRY_LINK_FIELD].roomQuantities, { Kitchen: 4 });
});
check('QTY CHANGE -> QUOTE', () => {
  selection = setQuantity(selection, 'Kitchen', '2 door base unit - 1200mm', 6);
  job = saveSelections(job, selection);
  assert.equal(find(job, K, pack, '2 door base unit - 1200mm').quantity, 6);
  selection = setQuantity(selection, 'Kitchen', 'Overhead cabinet - 2 door - standard height', 5);
  job = saveSelections(job, selection);
  assert.equal(find(job, K, pack, 'Overhead cabinet - 2 door - standard height').quantity, 5);
  assert.deepEqual(quoted(job, K, pack), { ...KITCHEN, '2 door base unit - 1200mm': 6, 'Overhead cabinet - 2 door - standard height': 5 });
  // Line total, section and project recalculate from the quote's own approved rate.
  const preview = calculateEstimateBuilderWorkbook(job);
  const rate = products.find(row => row.room === K && row.range === pack && row.description === '2 door base unit - 1200mm').price;
  const calculated = preview.quotation.CABINETRY.rows.find(row => row.importKey === find(job, K, pack, '2 door base unit - 1200mm').importKey);
  assert.equal(calculated.qty, 6); assert.equal(calculated.cost, 6 * rate);
  const expected = Object.entries(quoted(job, K, pack)).reduce((sum, [label, quantity]) => sum + quantity * products.find(row => row.room === K && row.range === pack && row.description === label).price, 0);
  assert.equal(preview.quotation.CABINETRY.rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0), expected);
});
check('OTHER ROOMS', () => {
  selection = normaliseCabinetrySelection({ ...selection, schedule: [...selection.schedule, line("Butler's Pantry", '2 door base unit - 1200mm', 2), line("Butler's Pantry", 'Overhead cabinet - 2 door - standard height', 2),
    line('Laundry', 'Laundry sink cabinet', 1), line('Laundry', 'Overhead cabinet - 1 door - standard height', 2), line('Laundry', '2 door base unit - 1200mm', 1)] });
  job = saveSelections(job, selection);
  assert.deepEqual(quoted(job, BP, std), { '2 door base unit - 1200mm': 2, 'Overhead cabinet - 2 door - standard height': 2 });
  assert.deepEqual(quoted(job, L, std), { 'Laundry sink cabinet': 1, 'Overhead cabinet - 1 door - standard height': 2, '2 door base unit - 1200mm': 1 });
  // Rooms never merge: Kitchen 6, Butler's Pantry 2, Laundry 1 are three quote rows.
  assert.equal(find(job, K, pack, '2 door base unit - 1200mm').quantity, 6);
  assert.deepEqual(find(job, BP, std, '2 door base unit - 1200mm')[CABINETRY_LINK_FIELD].roomQuantities, { "Butler's Pantry": 2 });
  selection = setQuantity(setQuantity(selection, "Butler's Pantry", '2 door base unit - 1200mm', 3), 'Laundry', 'Overhead cabinet - 1 door - standard height', 4);
  job = saveSelections(job, selection);
  assert.equal(find(job, BP, std, '2 door base unit - 1200mm').quantity, 3); assert.equal(find(job, L, std, 'Overhead cabinet - 1 door - standard height').quantity, 4);
  assert.equal(find(job, K, pack, '2 door base unit - 1200mm').quantity, 6);
});
check('FINISH SEPARATE FROM QTY', () => {
  // Changing the room finish moves the quantities to the new finish rows; the schedule lines are untouched.
  const before = structuredClone(selection.schedule);
  const shaker = normaliseCabinetrySelection({ ...selection, locations: selection.locations.map(entry => entry.location === 'Kitchen' ? { ...entry, doorMaterialGroup: 'Shaker/profile door', doorAndPanelSelections: { material: 'Shaker/profile door' } } : entry) });
  const moved = saveSelections(job, shaker);
  assert.deepEqual(shaker.schedule, before);
  assert.deepEqual(quoted(moved, K, 'SHAKER STYLE'), quoted(job, K, pack)); assert.deepEqual(quoted(moved, K, pack), {});
  assert.equal(populated(moved), populated(job));
});
check('NO DUPLICATES', () => {
  assert.deepEqual(structure(job), structure(base)); assert.equal(new Set(rowsOf(job).map(row => row.id)).size, rowsOf(base).length);
  assert.equal(populated(job), 8 + 2 + 3);
  assert.equal(apply(job, owner), job, 'a save with no change rewrites nothing');
  assert.equal(job.cabinetryReconciliation.summary.unmatched, 0);
});
check('PERSISTENCE', () => {
  const reloaded = JSON.parse(JSON.stringify(job));
  assert.equal(apply(reconcileCabinetryQuotation(reloaded, owner), owner), reloaded);
  // Reopening Client Selections re-normalises the saved selection: ids, quantities and overheads survive.
  const reopened = defaultCabinetryDraft(reloaded.clientSelectionsBook.rooms[0].rows[0].guidedSelection.cabinetrySelection);
  assert.deepEqual(reopened.schedule.map(entry => [entry.location, entry.cabinetTypeId, entry.quantity]), selection.schedule.map(entry => [entry.location, entry.cabinetTypeId, entry.quantity]));
  assert(reopened.schedule.some(entry => entry.cabinetTypeId === 'overhead_2door_standard' && entry.location === 'Kitchen' && entry.quantity === 5));
  const resaved = saveSelections(reloaded, reopened);
  assert.deepEqual(rowsOf(resaved).map(row => [row.id, row.quantity]), rowsOf(job).map(row => [row.id, row.quantity]));
  // BOQ, cabinetmaker RFQ and procurement lines carry the same stable id.
  const saved = scheduleOf(reloaded.clientSelectionsBook);
  const details = reloaded.clientSelectionsBook.rooms[0].rows[0].guidedSelection.cabinetrySelection;
  for (const lines of [details.boqLines.filter(entry => entry.componentId && !String(entry.componentId).endsWith('-handle') && saved.some(s => s.componentId === entry.componentId)), details.cabinetmakerRfq.lines])
    assert.deepEqual(lines.map(entry => entry.cabinetTypeId), saved.map(entry => entry.cabinetTypeId));
  assert(details.procurementSchedule.some(entry => entry.metadata.cabinetTypeId === 'overhead_2door_standard'));
});
check('BASELINE vs SELECTION', () => {
  // Takeoff / Job Setup pre-populates; the schedule then owns the unit and the baseline is kept.
  const takeoff = { ...base, aiPlanTakeoffJob: { cabinetryRequirements: [{ id: 't-base', room: 'Kitchen', type: 'base_unit_1200_2door', quantity: 4 }, { id: 't-pantry', room: 'Kitchen', type: 'tall_pantry', widthMm: 600, quantity: 1 }] } };
  const before = apply(takeoff, owner);
  assert.deepEqual(quoted(before, K, std), { '2 door base unit - 1200mm': 4, 'Tall pantry cabinet - 1 door - 600mm - 5 shelves': 1 });
  const chosen = saveSelections(before, defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', '2 door base unit - 1200mm', 5)] }));
  const row = find(chosen, K, std, '2 door base unit - 1200mm');
  assert.equal(row.quantity, 5); assert.equal(row[CABINETRY_LINK_FIELD].baselineQuantity, 4);
  assert.equal(row.selectionSpec, 'Kitchen · Standard Colourboard · From Client Selections · Qty from Client Selections (baseline 4)');
  assert.equal(find(chosen, K, std, 'Tall pantry cabinet - 1 door - 600mm - 5 shelves').quantity, 1, 'units the schedule has not touched keep the takeoff quantity');
  const entries = chosen.cabinetryReconciliation.entries;
  assert.equal(entries.find(entry => entry.requirementId === 't-base').quantity, 4); assert.match(entries.find(entry => entry.requirementId === 't-base').reason, /^Baseline/);
  // An explicit 0 in the schedule removes the unit from the quote; removing the line returns to the takeoff.
  const zero = saveSelections(chosen, defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', '2 door base unit - 1200mm', 0)] }));
  assert.equal(find(zero, K, std, '2 door base unit - 1200mm').quantity, '');
  assert.equal(find(saveSelections(zero, defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [] })), K, std, '2 door base unit - 1200mm').quantity, 4);
});
check('MANUAL OVERRIDE', () => {
  const key = find(job, K, pack, 'Corner base cabinet').importKey;
  const edited = apply({ ...job, quotation: { ...job.quotation, CABINETRY: { ...job.quotation.CABINETRY, rows: rowsOf(job).map(row => row.importKey === key ? { ...row, quantity: 3, quantityManualOverride: true } : row) } } }, owner);
  const row = find(edited, K, pack, 'Corner base cabinet');
  assert.equal(row.quantity, 3); assert(row.selectionSpec.startsWith('MANUAL OVERRIDE 3 (linked qty 1)')); assert.equal(edited.cabinetryReconciliation.summary.manualOverrides, 1);
  // A later Client Selections change does not destroy it, and still reports the linked quantity.
  const later = saveSelections(edited, setQuantity(selection, 'Kitchen', 'Corner base cabinet', 2));
  assert.equal(find(later, K, pack, 'Corner base cabinet').quantity, 3); assert(find(later, K, pack, 'Corner base cabinet').selectionSpec.startsWith('MANUAL OVERRIDE 3 (linked qty 2)'));
  // Clearing the manual quantity re-links the row.
  const cleared = apply({ ...later, quotation: { ...later.quotation, CABINETRY: { ...later.quotation.CABINETRY, rows: rowsOf(later).map(row => row.importKey === key ? { ...row, quantity: '' } : row) } } }, owner);
  assert.equal(find(cleared, K, pack, 'Corner base cabinet').quantity, 2); assert.equal(cleared.cabinetryReconciliation.summary.manualOverrides, 0);
  // A quantity the estimator had typed BEFORE the row was ever linked is kept the same way.
  const typed = { ...base, quotation: { ...base.quotation, CABINETRY: { ...base.quotation.CABINETRY, rows: rowsOf(base).map(row => row.room === K && row.range === std && row.item === 'Rangehood cabinet' ? { ...row, quantity: 2 } : row) } } };
  const linked = saveSelections(typed, defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', 'Rangehood cabinet', 1)] }));
  assert.equal(find(linked, K, std, 'Rangehood cabinet').quantity, 2); assert(find(linked, K, std, 'Rangehood cabinet').selectionSpec.startsWith('MANUAL OVERRIDE 2 (linked qty 1)'));
});
check('LEGACY MIGRATION', () => {
  // A job as the previous screens saved it: display names only, in three rooms, with notes.
  const KITCHEN_OLD = [['Standard base unit', 5], ['Corner unit', 1], ['Sink cupboard', 1], ['Pull-out bin', 1], ['Underbench oven cabinet', 1], ['Dishwasher cabinet', 1], ['Microwave cabinet', 1], ['Rangehood cabinet', 1], ['Tall pantry', 1], ['Four-bank drawers', 2], ['Five-bank drawers', 1]];
  const oldLines = [
    ...KITCHEN_OLD.map(([unitType, quantity], index) => ({ componentId: `OLD-K${index}`, location: 'Kitchen', unitType, quantity, handleQuantity: quantity, notes: unitType === 'Sink cupboard' ? 'under window' : '' })),
    { componentId: 'OLD-BP1', location: "Butler's Pantry", unitType: 'Standard base unit', quantity: 2 }, { componentId: 'OLD-BP2', location: "Butler's Pantry", unitType: 'Sink cupboard', quantity: 1 },
    { componentId: 'OLD-BP3', location: "Butler's Pantry", unitType: 'Underbench oven cabinet', quantity: 1 },
    { componentId: 'OLD-L1', location: 'Laundry', unitType: 'Laundry tub base unit', quantity: 1 }, { componentId: 'OLD-L2', location: 'Laundry', unitType: 'Overhead cabinets', quantity: 3 },
    { componentId: 'OLD-L3', location: 'Laundry', unitType: 'Four-bank drawers', quantity: 1 }, { componentId: 'OLD-L4', location: 'Laundry', unitType: 'Underbench dryer provision', quantity: 1 }];
  const rooms = [location('Kitchen', { doorMaterialGroup: 'Standard colourboard', benchtop: { range: 'Stone' }, handles: { base: { productName: 'Sharkfin' } }, notes: 'client notes' }), location("Butler's Pantry"), location('Laundry')];
  const legacy = defaultCabinetryDraft({ locations: rooms, schedule: oldLines });

  // 1. The schedule a user sees and saves holds ONLY current cabinet items - no old line, in any room.
  assert(legacy.schedule.every(entry => entry.cabinetTypeId), 'every schedule line is a canonical cabinet item');
  for (const room of ['Kitchen', "Butler's Pantry", 'Laundry']) {
    const offered = new Map(cabinetryScheduleCatalogue(room).flatMap(group => group.items).map(entry => [entry.id, entry.label]));
    for (const entry of legacy.schedule.filter(item => item.location === room)) assert.equal(entry.unitType, offered.get(entry.cabinetTypeId), `${room}: line is shown under its current catalogue name`);
  }
  const migratedLines = room => Object.fromEntries(legacy.schedule.filter(entry => entry.location === room).map(entry => [entry.unitType, entry.quantity]));
  assert.deepEqual(migratedLines('Kitchen'), { 'Corner base cabinet': 1, 'Sink base cabinet': 1, 'Pull-out bin cabinet': 1, 'Underbench oven cabinet': 1, 'Dishwasher cabinet': 1, 'Microwave cabinet': 1, 'Rangehood cabinet': 1, '4 drawer base unit': 2, '5 drawer base unit': 1 });
  assert.deepEqual(migratedLines("Butler's Pantry"), { 'Sink base cabinet': 1 });
  assert.deepEqual(migratedLines('Laundry'), { 'Laundry sink cabinet': 1 });
  // Quantity, notes, room, handle count and the line's own id move with it.
  const sink = legacy.schedule.find(entry => entry.componentId === 'OLD-K2');
  assert.deepEqual([sink.cabinetTypeId, sink.location, sink.quantity, sink.handleQuantity, sink.notes], ['sink_base', 'Kitchen', 1, 1, 'under window']);
  // 2. Nothing is guessed and nothing is lost: ambiguous / unpriced old lines are archived whole.
  assert.deepEqual(legacy.legacyCabinetSchedule.map(entry => [entry.location, entry.unitType, entry.quantity]), [['Kitchen', 'Standard base unit', 5], ['Kitchen', 'Tall pantry', 1], ["Butler's Pantry", 'Standard base unit', 2],
    ["Butler's Pantry", 'Underbench oven cabinet', 1], ['Laundry', 'Overhead cabinets', 3], ['Laundry', 'Four-bank drawers', 1], ['Laundry', 'Underbench dryer provision', 1]]);
  assert(legacy.legacyCabinetSchedule.every(entry => entry.archiveReason));
  assert.equal(legacy.cabinetScheduleMigration.length, 11);
  // 3. Everything else about the rooms is untouched.
  const kitchenRoom = legacy.locations.find(entry => entry.location === 'Kitchen');
  assert.deepEqual([kitchenRoom.benchtop, kitchenRoom.handles, kitchenRoom.notes], [{ range: 'Stone' }, { base: { productName: 'Sharkfin' } }, 'client notes']);
  // 4. Stable: loading / saving again changes nothing more and never duplicates the archive.
  const again = normaliseCabinetrySelection(JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(again.schedule, legacy.schedule); assert.deepEqual(again.legacyCabinetSchedule, legacy.legacyCabinetSchedule); assert.equal(again.cabinetScheduleMigration.length, 11);

  // 5. One quotation row per cabinet; archived lines contribute nothing.
  const migrated = saveSelections(base, legacy);
  assert.deepEqual(quoted(migrated, K, std), { 'Corner base cabinet': 1, 'Sink base cabinet': 1, 'Pull-out bin cabinet': 1, 'Underbench oven cabinet': 1, 'Dishwasher cabinet': 1, 'Microwave cabinet': 1, 'Rangehood cabinet': 1, '4 drawer base unit': 2, '5 drawer base unit': 1 });
  assert.deepEqual(quoted(migrated, BP, std), { 'Sink base cabinet': 1 }); assert.deepEqual(quoted(migrated, L, std), { 'Laundry sink cabinet': 1 });
  assert.equal(populated(migrated), 11); assert.deepEqual(structure(migrated), structure(base));
  assert.equal(migrated.cabinetryReconciliation.summary.unmatched, 0); assert.equal(migrated.cabinetryReconciliation.summary.legacyArchived, 7);
  assert.deepEqual(migrated.cabinetryReconciliation.legacyArchive.map(entry => entry.label).sort(), ['Four-bank drawers', 'Overhead cabinets', 'Standard base unit', 'Standard base unit', 'Tall pantry', 'Underbench dryer provision', 'Underbench oven cabinet']);
  // No 1 door / 2 door split is invented for the generic base unit.
  assert.equal(find(migrated, K, std, '1 door base unit - 600mm').quantity, ''); assert.equal(find(migrated, K, std, '2 door base unit - 1200mm').quantity, '');

  // 6. The same job loaded straight from a stored / .gr8job copy (old lines still in it): the quote is identical
  //    BEFORE anyone opens Client Selections, and the job loader rewrites the stored schedule in every book copy.
  const rawSelection = { locations: rooms.map(room => ({ ...room })), schedule: oldLines };
  const rawBook = () => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: { requirementKey: 'cabinetry', cabinetrySelection: structuredClone(rawSelection) } }, { id: 'other', guidedSelection: { requirementKey: 'kitchen_sink', productId: 'p-1' } }] }] });
  const stored = { ...base, clientSelectionsBook: rawBook(), selectionsBook: rawBook(), selectionSchedule: rawBook(), selectionSchedules: rawBook() };
  assert.deepEqual(rowsOf(apply(stored, owner)).map(row => [row.id, row.quantity]), rowsOf(migrated).map(row => [row.id, row.quantity]));
  const loaded = migrateWorkbookCabinetSchedules(stored);
  for (const key of ['clientSelectionsBook', 'selectionsBook', 'selectionSchedule', 'selectionSchedules']) {
    const saved = loaded[key].rooms[0].rows[0].guidedSelection.cabinetrySelection;
    assert(saved.schedule.every(entry => entry.cabinetTypeId), `${key}: stored schedule is canonical`);
    assert.equal(saved.schedule.length, 11); assert.equal(saved.legacyCabinetSchedule.length, 7);
    assert.equal(loaded[key].rooms[0].rows[1], stored[key].rooms[0].rows[1], 'other selections are untouched');
    assert.deepEqual(saved.locations, rawSelection.locations);
  }
  assert.equal(loaded.quotation, stored.quotation); assert.equal(migrateWorkbookCabinetSchedules(loaded), loaded);
  assert.deepEqual(rowsOf(apply(loaded, owner)).map(row => [row.id, row.quantity]), rowsOf(migrated).map(row => [row.id, row.quantity]));

  // 7. Old + new for the same cabinet never both count: the current line stands, the old one is retired.
  const both = defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', 'Sink base cabinet', 1), { componentId: 'OLD-S', location: 'Kitchen', unitType: 'Sink cupboard', quantity: 1 },
    line('Kitchen', 'Pull-out bin cabinet', 2), { componentId: 'OLD-P', location: 'Kitchen', unitType: 'Pull-out bin', quantity: 1 }, { componentId: 'OLD-D1', location: 'Kitchen', unitType: 'Four-bank drawers', quantity: 1 }] });
  assert.deepEqual(both.schedule.map(entry => [entry.unitType, entry.quantity]), [['Sink base cabinet', 1], ['Pull-out bin cabinet', 2], ['4 drawer base unit', 1]]);
  assert.deepEqual(both.legacyCabinetSchedule.map(entry => entry.unitType), ['Sink cupboard', 'Pull-out bin']);
  let job2 = saveSelections(base, both);
  assert.deepEqual(quoted(job2, K, std), { 'Sink base cabinet': 1, 'Pull-out bin cabinet': 2, '4 drawer base unit': 1 });
  // 8. Sync after cleanup: one row moves, nothing else.
  let cleaned = normaliseCabinetrySelection({ ...both, schedule: [...both.schedule, line('Kitchen', '2 door base unit - 1200mm', 1)] });
  job2 = saveSelections(job2, cleaned);
  cleaned = setQuantity(cleaned, 'Kitchen', '2 door base unit - 1200mm', 3); job2 = saveSelections(job2, cleaned);
  assert.equal(find(job2, K, std, '2 door base unit - 1200mm').quantity, 3);
  cleaned = setQuantity(cleaned, 'Kitchen', 'Sink base cabinet', 2); job2 = saveSelections(job2, cleaned);
  assert.deepEqual(quoted(job2, K, std), { 'Sink base cabinet': 2, 'Pull-out bin cabinet': 2, '4 drawer base unit': 1, '2 door base unit - 1200mm': 3 });
  assert.equal(populated(job2), 4); assert.deepEqual(structure(job2), structure(base));
  // 9. An estimator's quantities already on quote rows are never overwritten or removed by the cleanup.
  const priced = { ...base, quotation: { ...base.quotation, CABINETRY: { ...base.quotation.CABINETRY, rows: rowsOf(base).map(row => row.room === K && row.range === std && row.item === '1 door base unit - 600mm' ? { ...row, quantity: 2 } : row.room === K && row.range === std && row.item === '2 door base unit - 1200mm' ? { ...row, quantity: 3 } : row) } } };
  const kept = saveSelections(priced, legacy);
  assert.equal(find(kept, K, std, '1 door base unit - 600mm').quantity, 2); assert.equal(find(kept, K, std, '2 door base unit - 1200mm').quantity, 3);
  // 10. Bathroom vanity lines are a different schedule and are left alone.
  const bath = [{ componentId: 'B1', location: 'Bathroom', type: 'bath-floor-two-door', unitType: 'Base unit with 2 doors', quantity: 1 }];
  assert.equal(migrateCabinetSchedule(bath).schedule, bath);
});

check('CURRENT JOB', () => {
  // The Kitchen as it stands in the live job: in progress, never confirmed, finish left on the
  // default the screen shows, and no cabinetry finish in any Inclusion Schedule.
  const WANT = { '2 door base unit - 1200mm': 1, 'Sink base cabinet': 1, 'Underbench oven cabinet': 1, 'Corner base cabinet': 2, 'Dishwasher cabinet': 1, 'Microwave cabinet': 1, 'Pull-out bin cabinet': 1,
    '3 drawer pot drawer base - 1 small + 2 large': 2, '4 drawer base unit': 1 };
  const bare = { ...base, jobInclusionSnapshot: null };
  let current = defaultCabinetryDraft({ locations: [location('Kitchen'), location('Laundry')], schedule: Object.entries(WANT).map(([label, quantity]) => line('Kitchen', label, quantity)) });
  assert.equal(current.locations[0].confirmedAt, ''); assert.equal(current.locations[0].doorMaterialGroup, 'Standard colourboard');
  let live = saveSelections(bare, current);
  assert.deepEqual(quoted(live, K, std), WANT);
  assert.deepEqual(live.cabinetryReconciliation.summary, { total: 9, matched: 9, unmatched: 0, selectionRequired: 0, legacyArchived: 0, manualOverrides: 0 });
  for (const finish of CABINETRY_FINISHES.filter(entry => entry.range !== std)) assert.deepEqual(quoted(live, K, finish.range), {});
  assert.equal(find(live, K, std, 'Corner base cabinet').selectionSpec, 'Kitchen · Standard Colourboard · From Client Selections · Qty from Client Selections');
  // Change a quantity.
  current = setQuantity(current, 'Kitchen', 'Corner base cabinet', 3); live = saveSelections(live, current);
  assert.equal(find(live, K, std, 'Corner base cabinet').quantity, 3);
  // Untick (Reset) an item: its quote quantity is cleared, nothing stale is left.
  current = normaliseCabinetrySelection({ ...current, schedule: current.schedule.filter(entry => entry.unitType !== 'Microwave cabinet') }); live = saveSelections(live, current);
  assert.equal(find(live, K, std, 'Microwave cabinet').quantity, ''); assert.equal(find(live, K, std, 'Microwave cabinet').selectionSpec ?? '', '');
  assert.equal(populated(live), 8);
  // Every finish offered in Doors & Panels moves the same quantities to exactly that finish block.
  const before = quoted(live, K, std);
  for (const [material, range] of [['Premium laminate', 'PREMIUM LAMINATE'], ['Two-pack painted', '2 PACK'], ['Shaker/profile door', 'SHAKER STYLE'], ['Vinyl wrap', 'VINYL WRAP'], ['Standard colourboard', std]]) {
    current = normaliseCabinetrySelection({ ...current, locations: current.locations.map(entry => entry.location === 'Kitchen' ? { ...entry, doorMaterialGroup: material, doorAndPanelSelections: { material } } : entry) });
    live = saveSelections(live, current);
    assert.deepEqual(quoted(live, K, range), before, material);
    for (const other of CABINETRY_FINISHES.filter(entry => entry.range !== range)) assert.deepEqual(quoted(live, K, other.range), {}, `${material}: nothing left in ${other.label}`);
    assert.equal(populated(live), 8);
  }
  // Room mapping: the same item scheduled in Laundry lands in the Laundry block only.
  current = normaliseCabinetrySelection({ ...current, schedule: [...current.schedule, line('Laundry', '2 door base unit - 1200mm', 2)] }); live = saveSelections(live, current);
  assert.deepEqual(quoted(live, L, std), { '2 door base unit - 1200mm': 2 }); assert.equal(find(live, K, std, '2 door base unit - 1200mm').quantity, 1);
  // Save, hard refresh, reopen: identical.
  const reopened = JSON.parse(JSON.stringify(live));
  assert.equal(apply(reconcileCabinetryQuotation(migrateWorkbookCabinetSchedules(reopened), owner), owner), reopened);
  assert.deepEqual(structure(live), structure(base));
});

check('NO LEGACY IN UI', () => {
  // Every old name is either one current item or archived; none can be offered or created again.
  for (const unitType of [...CABINETRY_SCHEDULE_TYPE_OPTIONS, ...LAUNDRY_CABINETRY_SCHEDULE_TYPE_OPTIONS]) assert(legacyCabinetryScheduleType({ unitType }) || ['Standard base unit', 'Tall pantry', 'Overhead cabinets', 'Underbench washing-machine provision', 'Underbench dryer provision'].includes(unitType), unitType);
  const page = fs.readFileSync('pages/modules/builders/selections-book.js', 'utf8');
  for (const gone of ['Previously scheduled', 'Requires classification', 'Saved before the cabinet list', 'enter it against the matching item', 'linked to the quotation', 'cabinet-schedule-earlier', 'laundry-earlier-schedule',
    'CABINETRY_SCHEDULE_TYPE_OPTIONS', 'LAUNDRY_CABINETRY_SCHEDULE_GROUPS', 'cabinetryScheduleTypeOptionsForLocation', 'legacyCabinetryScheduleType', 'legacyCabinetSchedule', 'cabinetScheduleMigration']) assert(!page.includes(gone), `Client Selections page still contains "${gone}"`);
  // A room added to a new job is scheduled from the current list only, including a builder-named room.
  for (const room of ['Kitchen', "Butler's Pantry", 'Laundry', 'Kitchenette', 'Study nook']) {
    const offered = cabinetryScheduleCatalogue(room).flatMap(group => group.items);
    assert(offered.length > 10, room); assert(!offered.some(entry => /standard base unit|^corner unit$|sink cupboard|four-bank/i.test(entry.label)), room);
  }
  assert.deepEqual(defaultCabinetryDraft({ locations: [location('Kitchen')] }).schedule, [], 'a new room starts with no lines');
});

check('NO SCOPE STEP', () => {
  assert.deepEqual(CABINETRY_WORKFLOW_STAGES, ['Cabinet Schedule', 'Doors & Panels', 'Colours & Finishes', 'Benchtops', 'Handles', 'Features', 'Review & Confirm']);
  const room = (selection, name) => selection.locations.find(entry => entry.location === name);
  const areas = (selection, name) => room(selection, name).enabledAreaKeys;
  // The brief's Kitchen: nothing answered on any Scope page, only quantities scheduled.
  const kitchen = defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', '1 door base unit - 600mm', 2), line('Kitchen', '2 door base unit - 1200mm', 4),
    line('Kitchen', 'Overhead cabinet - 1 door - standard height', 2), line('Kitchen', 'Overhead cabinet - 2 door - standard height', 3), line('Kitchen', 'Tall pantry cabinet - 1 door - 600mm - 5 shelves', 1)] });
  const scope = cabinetryScheduleScope(room(kitchen, 'Kitchen'), kitchen.schedule);
  assert.deepEqual([scope.hasBaseCabinets, scope.hasOverheadCabinets, scope.hasTallCabinets, scope.hasDrawerUnits, scope.hasEndPanels], [true, true, true, false, false]);
  assert.deepEqual(areas(kitchen, 'Kitchen'), ['lowerDoorsDrawers', 'overheadDoors']);
  assert(!cabinetryLocationMissingRequirements(room(kitchen, 'Kitchen')).some(entry => entry.stage === 'Scope' || entry.key === 'scope'));
  // The contradictory state cannot be stored: "Overheads = yes" with no overheads scheduled.
  const noOverheads = defaultCabinetryDraft({ locations: [location('Kitchen', { enabledAreaKeys: ['overheadDoors'] })], schedule: [line('Kitchen', '2 door base unit - 1200mm', 4), line('Kitchen', 'Overhead cabinet - 2 door - standard height', 0)] });
  assert.deepEqual(areas(noOverheads, 'Kitchen'), ['lowerDoorsDrawers']);
  assert.equal(cabinetryScheduleScope(room(noOverheads, 'Kitchen'), noOverheads.schedule).hasOverheadCabinets, false);
  // Island back and unpriced end panels are real choices and survive (now made in Doors & Panels);
  // a priced Kitchen end panel quantity switches the end-panel area on by itself.
  const island = defaultCabinetryDraft({ locations: [location('Kitchen', { enabledAreaKeys: ['lowerDoorsDrawers', 'islandBenchBack', 'endPanels', 'overheadDoors'] })], schedule: [line('Kitchen', '2 door base unit - 1200mm', 4)] });
  assert.deepEqual(areas(island, 'Kitchen'), ['lowerDoorsDrawers', 'islandBenchBack', 'endPanels']);
  const panels = defaultCabinetryDraft({ locations: [location('Kitchen')], schedule: [line('Kitchen', '2 door base unit - 1200mm', 4), line('Kitchen', 'Short end panel', 2)] });
  assert.deepEqual(areas(panels, 'Kitchen'), ['lowerDoorsDrawers', 'endPanels']);
  assert.equal(find(saveSelections(base, panels), K, std, 'Short end panel - Standard Colourboard').quantity, 2);
  // Rooms differ: each room's own schedule decides.
  const rooms = defaultCabinetryDraft({ locations: [location("Butler's Pantry"), location('Laundry')], schedule: [line("Butler's Pantry", 'Overhead cabinet - 2 door - standard height', 2), line('Laundry', 'Laundry sink cabinet', 1)] });
  assert.deepEqual(areas(rooms, "Butler's Pantry"), ['overheadDoors']); assert.deepEqual(areas(rooms, 'Laundry'), ['lowerDoorsDrawers']);
  // Existing job from the 8-step workflow: old scope answers, old-style lines, colours already chosen.
  const colour = { id: 'c1', supplier: 'Polytec', colourName: 'Classic White', finish: 'Matt' };
  const old = { locations: [location('Kitchen', { scope: ['lowerDoorsDrawers', 'islandBenchBack', 'overheadDoors'], enabledAreaKeys: ['lowerDoorsDrawers', 'islandBenchBack', 'overheadDoors'],
    areaSelections: { lowerDoorsDrawers: colour, overheadDoors: colour, islandBenchBack: colour }, benchtop: { range: 'Stone' }, handles: { base: { productName: 'Sharkfin' } }, features: ['Wine rack'], confirmedAt: '2026-09-30T00:00:00.000Z' })],
    schedule: [{ componentId: 'OLD-1', location: 'Kitchen', unitType: 'Standard base unit', quantity: 5 }, { componentId: 'OLD-2', location: 'Kitchen', unitType: 'Corner unit', quantity: 1 }] };
  const loaded = defaultCabinetryDraft(structuredClone(old));
  const kept = room(loaded, 'Kitchen');
  assert.deepEqual(kept.enabledAreaKeys, ['lowerDoorsDrawers', 'islandBenchBack', 'overheadDoors'], 'nothing an older room chose is switched off before it uses the new schedule');
  assert.equal(kept.areaSelections.overheadDoors.colourName, 'Classic White'); assert.deepEqual(kept.benchtop, old.locations[0].benchtop); assert.deepEqual(kept.handles, old.locations[0].handles);
  assert.deepEqual(kept.features, ['Wine rack']); assert.equal(kept.confirmedAt, '2026-09-30T00:00:00.000Z');
  assert.deepEqual(loaded.schedule.map(entry => [entry.unitType, entry.quantity, entry.migratedFrom]), [['Corner base cabinet', 1, 'Corner unit']]);
  assert.deepEqual(loaded.legacyCabinetSchedule.map(entry => [entry.unitType, entry.quantity]), [['Standard base unit', 5]]);
  assert.equal(loaded.summary.unresolvedLocations.length, 0);
  // Once that room schedules overheads on the shared list, its scope follows the schedule and every colour is still there.
  const upgraded = normaliseCabinetrySelection({ ...loaded, schedule: [...loaded.schedule, line('Kitchen', 'Overhead cabinet - 2 door - standard height', 3)] });
  assert.deepEqual(areas(upgraded, 'Kitchen'), ['lowerDoorsDrawers', 'overheadDoors', 'islandBenchBack']);
  assert.equal(room(upgraded, 'Kitchen').areaSelections.islandBenchBack.colourName, 'Classic White');
  // Bathrooms: the vanity schedule defines the room the same way.
  const bath = defaultCabinetryDraft({ locations: [location('Bathroom', { bathroomScopeKeys: ['wallMountedVanity', 'tallLinenCupboard'] })], schedule: [{ componentId: 'B1', location: 'Bathroom', type: 'bath-floor-two-door', unitType: 'Base unit with 2 doors', quantity: 1 }, { componentId: 'B2', location: 'Bathroom', type: 'bath-shaving-one-door', unitType: '1-door mirrored shaving cabinet', quantity: 1 }] });
  assert.deepEqual(room(bath, 'Bathroom').bathroomScopeKeys, ['floorMountedVanity', 'mirroredShavingCabinet']);
  assert.deepEqual(room(defaultCabinetryDraft({ locations: [location('Ensuite', { bathroomScopeKeys: ['wallMountedVanity'] })] }), 'Ensuite').bathroomScopeKeys, ['wallMountedVanity'], 'an older bathroom with nothing scheduled keeps its stored scope');
  // Scope has no part in the quote: the same schedule gives the same quote whatever old flags say.
  const flagged = normaliseCabinetrySelection({ ...kitchen, locations: kitchen.locations.map(entry => ({ ...entry, scope: [], enabledAreaKeys: [] })) });
  assert.deepEqual(quoted(saveSelections(base, flagged), K, std), quoted(saveSelections(base, kitchen), K, std));
});

const order = ['NO SCOPE STEP', 'TAXONOMY', 'KITCHEN', 'QTY CHANGE -> QUOTE', 'OTHER ROOMS', 'FINISH SEPARATE FROM QTY', 'NO DUPLICATES', 'PERSISTENCE', 'BASELINE vs SELECTION', 'MANUAL OVERRIDE', 'LEGACY MIGRATION', 'CURRENT JOB', 'NO LEGACY IN UI'];
for (const name of order) console.log(`${name}: ${results[name] || 'NOT RUN'}`);
if (order.some(name => results[name] !== 'PASS')) process.exit(1);
