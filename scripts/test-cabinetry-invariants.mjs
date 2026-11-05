// Cabinetry system invariants: one catalogue, one taxonomy, one engine.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-invariants.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, finalCabinetryRows, reconcileCabinetryQuotation, isCabinetrySection } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { buildQuotationSubgroups, visibleSubgroupRows } from '../lib/construction-estimation/quotationSubgroups.js';
import { normaliseCabinetrySelection, buildCabinetrySelectionPayload } from '../lib/builders/cabinetryWorkflow.js';
import { canonicalProjectRoomName } from '../lib/builders/projectRoomModel.js';
import { applyCabinetryRequirementsToQuotation as apply, setCabinetryRequirements, classifyLegacyCabinetLine, returnCabinetryRowToAutomatic, migrateWorkbookCabinetSchedules,
  cabinetryScheduleCatalogue, cabinetryScheduleGroup, cabinetryRequirementTypes, cabinetryCatalogueRow, cabinetryCatalogueIdentity, cabinetryWetAreaTag, canonicalCabinetryProducts,
  CABINETRY_FINISHES, BENCHTOP_RANGES, CABINETRY_LINK_FIELD, CABINETRY_ACTION_REQUIRED, CABINETRY_MANUAL_OVERRIDE, CABINETRY_OUTCOME_MATCHED } from '../lib/construction-estimation/cabinetryRequirements.js';

const owner = source.workspaceId;
assert.equal(canonicalProjectRoomName('Bed 2', { rooms: [{ id: 'room-2', name: 'Bedroom 2', sourceKeys: ['bed-2'] }] }), 'Bedroom 2', 'cabinetry room aliases resolve only through explicit room history');
const results = {};
const check = (name, run) => { try { run(); results[name] = 'PASS'; } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, String(error.message).slice(0, 1200)); } };
const products = source.rows.filter(row => row.type === 'product');
const keyOf = row => row.key || `final-cabinetry:${row.sourceRow}`;
const ROOMS = ['Kitchen', "Butler's Pantry", 'Laundry', 'Bathroom', 'Main Bathroom', 'Ensuite', 'Powder Room', 'Bedroom 1', 'WIR'];
const offered = room => cabinetryScheduleCatalogue(room).flatMap(group => group.items);
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const rowsOf = book => book.quotation.CABINETRY.rows;
const find = (book, room, range, item) => { const hits = rowsOf(book).filter(row => row.room === room && row.range === range && (item instanceof RegExp ? item.test(row.item) : row.item === item)); assert.equal(hits.length, 1, `${room}/${range}/${item}`); return hits[0]; };
const quantities = book => Object.fromEntries(rowsOf(book).filter(row => row.quantity !== '' && row.quantity != null).map(row => [row.importKey, row.quantity]));
const outcomes = book => book.cabinetryReconciliation.entries.reduce((count, entry) => ({ ...count, [entry.outcome]: (count[entry.outcome] || 0) + 1 }), {});
const attention = book => book.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED);
const std = 'STANDARD COLOURBOARD', BATH = 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', W = 'WARDROBES', L = 'LAUNDRY CABINETRY', K = 'KITCHEN CABINETRY';

// A schedule line exactly as the Client Selections Cabinet Schedule saves it, and the Selections
// Book built by the same functions the page uses.
let n = 0;
const line = (room, id, quantity) => ({ componentId: `LINE-${++n}`, location: room, cabinetTypeId: id, unitType: offered(room).find(item => item.id === id).label, quantity, handleQuantity: quantity,
  ...(cabinetryScheduleGroup(room) === 'bathroom' ? { type: cabinetryWetAreaTag(id) } : {}) });
const bookOf = selection => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: {
  ...buildCabinetrySelectionPayload({ workspaceId: owner, projectId: 'p1', selection, requirement: { requirementKey: 'cabinetry', label: 'Cabinetry', areaKey: 'cabinetry' } }).selected_details, requirementKey: 'cabinetry' } }] }] });
const scheduleOf = book => book.clientSelectionsBook.rooms[0].rows[0].guidedSelection.cabinetrySelection.schedule;
const job = (locations, schedule, extra = {}) => apply({ ...base, ...extra, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations, schedule })) }, owner);
const room = (name, more = {}) => ({ location: name, name, ...more });

check('1 EVERY CLIENT SELECTION ITEM HAS A CANONICAL ID', () => {
  for (const name of ROOMS) {
    const group = cabinetryScheduleGroup(name);
    const canonical = new Set(cabinetryRequirementTypes(group).filter(type => type.area === 'cabinetry').map(type => type.key));
    const items = offered(name);
    assert(items.length > 0, `${name} offers a schedule`);
    assert(items.every(item => canonical.has(item.id) && item.label), `${name}: every offered item is a canonical cabinet item`);
    assert.equal(new Set(items.map(item => item.id)).size, items.length, `${name}: ids are unique`);
    // ...and nothing canonical is missing from what the room offers.
    assert.deepEqual(new Set(items.map(item => item.id)), canonical, `${name}: the schedule is the whole room catalogue`);
    if (group === 'bathroom') assert(items.every(item => cabinetryWetAreaTag(item.id)), `${name}: every vanity item has its wet-area tag`);
  }
  // A schedule line built by the workflow keeps its canonical id through normalise / save.
  const saved = scheduleOf(job(ROOMS.map(name => room(name)), ROOMS.flatMap(name => offered(name).slice(0, 2).map(item => line(name, item.id, 1)))));
  assert.equal(saved.length, ROOMS.length * 2); assert(saved.every(entry => entry.cabinetTypeId));
});

check('2-3 EXACTLY ONE QUOTE ROW PER ITEM x FINISH', () => {
  // Counted from the approved rows themselves, independently of the lookup index.
  const identities = products.map(row => ({ ...cabinetryCatalogueIdentity(keyOf(row)), key: keyOf(row) }));
  assert(identities.every(item => item.cabinetryGroup && item.cabinetTypeId), 'every approved row has a canonical identity');
  const count = (group, type, finish) => identities.filter(item => item.cabinetryGroup === group && item.cabinetTypeId === type && (item.cabinetryFinishKey || item.benchtopRangeKey || '') === (finish || '')).length;
  for (const group of ['kitchen', 'butlers_pantry', 'laundry', 'bathroom', 'wardrobes']) for (const type of cabinetryRequirementTypes(group)) {
    const finishes = !type.finishDependent ? [''] : (type.area === 'benchtops' ? BENCHTOP_RANGES : CABINETRY_FINISHES).map(finish => finish.key);
    for (const finish of finishes) {
      assert.equal(count(group, type.key, finish), 1, `${group} / ${type.key} / ${finish || 'fixed'} maps to exactly one approved row`);
      assert.equal(cabinetryCatalogueIdentity(cabinetryCatalogueRow(group, type.key, finish).importKey).cabinetTypeId, type.key);
    }
  }
  assert.equal(new Set(identities.map(item => `${item.cabinetryGroup}|${item.cabinetTypeId}|${item.cabinetryFinishKey || item.benchtopRangeKey || ''}`)).size, products.length, 'no two rows share an identity');
});

check('4 EVERY SELECTED ITEM REACHES THE QUOTE', () => {
  const all = job(ROOMS.map(name => room(name)), ROOMS.flatMap(name => offered(name).map((item, index) => /^bulkhead_/.test(item.id) ? { ...line(name, item.id, 0), runs: [{ id: 'run-1', location: 'Above overheads', lengthMm: (index + 1) * 1000 }] } : line(name, item.id, index + 1))), { jobInclusionSnapshot: { items: [{ selection_slot_id: 'wardrobe_finish', baselineProductName: 'Standard Colourboard' }] } });
  assert.deepEqual(attention(all).map(entry => `${entry.room}|${entry.type}|${entry.reason}`), []);
  const sourceTotal = all.cabinetryReconciliation.entries.reduce((total, entry) => total + entry.quantity, 0);
  assert.equal(Object.values(quantities(all)).reduce((total, quantity) => total + Number(quantity), 0), sourceTotal, 'the quote carries exactly the scheduled quantity');
  assert.equal(rowsOf(all).length, rowsOf(base).length, 'no row is appended');
});

const kitchen = [line('Kitchen', 'corner_base', 2), line('Kitchen', 'base_unit_1200_2door', 3), line('Laundry', 'base_unit_1200_2door', 2), line('Laundry', 'overhead_2door_standard', 3)];
const dry = [room('Kitchen'), room('Laundry')];
const first = job(dry, kitchen);
check('5 UNTICK REMOVES ONLY ITS GENERATED QUANTITY', () => {
  const typed = { ...first, quotation: { ...first.quotation, CABINETRY: { ...first.quotation.CABINETRY, rows: rowsOf(first).map(row => row.room === K && row.range === std && row.item === 'Wine rack cabinet' ? { ...row, quantity: 4 } : row) } } };
  const next = apply({ ...typed, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations: dry, schedule: kitchen.filter(entry => entry.cabinetTypeId !== 'corner_base') })) }, owner);
  assert.equal(find(next, K, std, 'Corner base cabinet').quantity, '');
  assert.equal(find(next, K, std, '2 door base unit - 1200mm').quantity, 3);
  assert.equal(find(next, K, std, 'Wine rack cabinet').quantity, 4, 'an unrelated manual quantity is untouched');
  assert.equal(find(next, L, std, '2 door base unit - 1200mm').quantity, 2);
});
check('6 FINISH CHANGE MOVES THE QUANTITY', () => {
  const next = job([room('Kitchen', { doorMaterialGroup: 'Two-pack painted' }), room('Laundry')], kitchen);
  assert.equal(find(next, K, '2 PACK', '2 door base unit - 1200mm').quantity, 3); assert.equal(find(next, K, std, '2 door base unit - 1200mm').quantity, '');
  assert.equal(find(next, L, std, '2 door base unit - 1200mm').quantity, 2, 'another room keeps its own finish');
  // The canonical finish key is what is stored and resolved by.
  assert.equal(next.clientSelectionsBook.rooms[0].rows[0].guidedSelection.cabinetrySelection.locations[0].cabinetryFinishKey, 'two_pack');
  assert.equal(find(next, K, '2 PACK', '2 door base unit - 1200mm')[CABINETRY_LINK_FIELD].finishKey, 'two_pack');
});
check('7 BATHROOM ROOMS AGGREGATE, BREAKDOWN KEPT', () => {
  const baths = ['Main Bathroom', 'Ensuite', 'Bathroom'];
  const next = job(baths.map(name => room(name)), [...baths.map(name => line(name, 'vanity_wallhung_2door_1200', 1)), line('Ensuite', 'vanity_floor_3drawer_900', 1)]);
  const shared = find(next, BATH, std, 'Wall hung vanity - 2 door - 1200mm');
  assert.equal(shared.quantity, 3);
  assert.deepEqual(shared[CABINETRY_LINK_FIELD].roomQuantities, { 'Main Bathroom': 1, Ensuite: 1, Bathroom: 1 });
  assert.match(shared.selectionSpec, /Main Bathroom 1, Ensuite 1, Bathroom 1/);
  assert.equal(find(next, BATH, std, 'Floor mounted vanity - 3 drawer - 900mm').quantity, 1);
  // A room with its own finish lands on its own finish block.
  const split = job([room('Main Bathroom', { doorMaterialGroup: 'Two-pack painted' }), room('Ensuite'), room('Bathroom')], baths.map(name => line(name, 'vanity_wallhung_2door_1200', 1)));
  assert.equal(find(split, BATH, '2 PACK', 'Wall hung vanity - 2 door - 1200mm').quantity, 1); assert.equal(find(split, BATH, std, 'Wall hung vanity - 2 door - 1200mm').quantity, 2);
});
check('8 LAUNDRY IS INDEPENDENT OF KITCHEN', () => {
  const only = job([room('Laundry')], [line('Laundry', 'sink_base', 1), line('Laundry', 'washer_dryer_opening', 1), line('Laundry', 'tall_linen_600', 1)]);
  assert.deepEqual(Object.keys(quantities(only)).map(key => products.find(row => keyOf(row) === key).room), [L, L, L]);
  assert.equal(find(only, L, std, 'Laundry sink cabinet').quantity, 1);
  assert.equal(rowsOf(only).filter(row => row.room === K && row.quantity !== '').length, 0);
});
check('9 WARDROBE LOCATIONS', () => {
  // From Client Selections (a bedroom / WIR added to Cabinetry) and from Job Setup, together.
  const next = apply(setCabinetryRequirements({ ...base, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations: [room('Bedroom 1'), room('WIR', { doorMaterialGroup: 'Two-pack painted' })],
    schedule: [line('Bedroom 1', 'wardrobe_hanging_double_900_1200', 2), line('WIR', 'wardrobe_hanging_double_900_1200', 1), line('WIR', 'wardrobe_door_sliding', 3), line('Bedroom 1', 'wardrobe_door_sliding', 2)] })) },
    [{ id: 'w', room: 'Bedroom 2', type: 'wardrobe_hanging_double_900_1200', quantity: 1 }]), owner);
  const hanging = find(next, W, 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD', 'Double hanging bay - 900-1200mm');
  assert.equal(hanging.quantity, 4); assert.deepEqual(hanging[CABINETRY_LINK_FIELD].roomQuantities, { 'Bedroom 2': 1, 'Bedroom 1': 2, WIR: 1 });
  // Doors follow each room's own finish.
  assert.equal(find(next, W, 'WARDROBE DOORS - 2 PACK', 'Sliding wardrobe door - per panel').quantity, 3);
  assert.equal(find(next, W, 'WARDROBE DOORS - STANDARD COLOURBOARD', 'Sliding wardrobe door - per panel').quantity, 2);
  assert.deepEqual(attention(next), []);
});

const stone = rangeKey => ({ supplier: 'Caesarstone', colourName: 'Cloudburst', rangeKey });
check('10 BENCHTOP LM: MEASURED, ELSE CABINET WIDTHS, ELSE ASKED FOR', () => {
  const locations = [
    room('Kitchen', { benchtopAreas: [{ id: 'benchtop-main', label: 'Main benchtop', lengthMm: 4800, depthMm: 600, surface: stone('mid_range_stone') }, { id: 'benchtop-island', label: 'Island benchtop', lengthMm: 2300, depthMm: 1200, surface: stone('mid_range_stone') }] }),
    // No saved length: the run is the laundry's cabinets (1200 + 1200 + 600).
    room('Laundry', { benchtopAreas: [{ id: 'benchtop-main', label: 'Laundry benchtop', lengthMm: '', depthMm: 600, surface: { supplier: 'Laminex', colourName: 'White', rangeKey: 'standard_laminate' } }] }),
    // A vanity top is as long as its vanity.
    room('Ensuite', { bathroomBenchtops: { wallMountedVanity: { targetKey: 'wallMountedVanity', targetLabel: 'Wall-mounted vanity benchtop', ...stone('base_range_stone') } } }),
    room('Bathroom', { bathroomBenchtops: { floorMountedVanity: { targetKey: 'floorMountedVanity', targetLabel: 'Floor-mounted vanity benchtop', ...stone('base_range_stone') } } }),
    // A sink cabinet has no width in its item, so this run cannot be derived.
    room("Butler's Pantry", { benchtopAreas: [{ id: 'benchtop-main', label: "Butler's Pantry benchtop", lengthMm: '', depthMm: 600, surface: stone('mid_range_stone') }] }),
  ];
  const schedule = [line('Laundry', 'base_unit_1200_2door', 2), line('Laundry', 'base_unit_600_1door', 1), line('Ensuite', 'vanity_wallhung_2door_1200', 1), line('Bathroom', 'vanity_floor_3drawer_900', 1), line("Butler's Pantry", 'sink_base', 1), line("Butler's Pantry", 'base_unit_600_1door', 1)];
  const next = job(locations, schedule);
  assert.equal(find(next, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /600mm wide/).quantity, 4.8);
  assert.equal(find(next, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /1200mm wide/).quantity, 2.3);
  assert.equal(find(next, 'LAUNDRY BENCHTOPS', 'STANDARD LAMINATE', /600mm wide/).quantity, 3);
  // Two vanity rooms share the one Base Range Stone row: 1.2 + 0.9 LM, each room recorded.
  const vanityTops = find(next, 'BATHROOM BENCHTOPS', 'BASE RANGE STONE - 20MM', /600mm wide/);
  assert.equal(vanityTops.quantity, 2.1); assert.deepEqual(vanityTops[CABINETRY_LINK_FIELD].roomQuantities, { Ensuite: 1.2, Bathroom: 0.9 });
  const pantry = attention(next);
  assert.deepEqual(pantry.map(entry => [entry.room, entry.reason, entry.action.kind]), [["Butler's Pantry", 'Measurement required', 'open-selections']]);
  assert.match(pantry[0].action.label, /Enter the benchtop length in Client Selections > Cabinetry > Butler's Pantry > Benchtops/);
  // A measured takeoff benchtop is the length; the selection only supplies the range.
  const measured = apply(setCabinetryRequirements(next, [{ id: 'm', room: 'Laundry', type: 'benchtop', widthMm: 600, lengthLm: 3.4, source: 'AI_TAKEOFF' }]), owner);
  assert.equal(find(measured, 'LAUNDRY BENCHTOPS', 'STANDARD LAMINATE', /600mm wide/).quantity, 3.4);
});
check('11 NO AUTOMATIC PATH OVERWRITES A MANUAL QUANTITY', () => {
  const typed = apply({ ...first, quotation: { ...first.quotation, CABINETRY: { ...first.quotation.CABINETRY, rows: rowsOf(first).map(row => row.room === K && row.range === std && row.item === 'Corner base cabinet' ? { ...row, quantity: 9 } : row) } } }, owner);
  assert.equal(find(typed, K, std, 'Corner base cabinet').quantity, 9);
  assert.deepEqual(outcomes(typed), { [CABINETRY_OUTCOME_MATCHED]: 3, [CABINETRY_MANUAL_OVERRIDE]: 1 });
  // A later selection change still leaves it alone...
  const later = apply({ ...typed, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations: dry, schedule: kitchen.map(entry => entry.cabinetTypeId === 'corner_base' ? { ...entry, quantity: 5 } : entry) })) }, owner);
  assert.equal(find(later, K, std, 'Corner base cabinet').quantity, 9);
  const entry = later.cabinetryReconciliation.entries.find(item => item.outcome === CABINETRY_MANUAL_OVERRIDE);
  assert.equal(entry.action.kind, 'return-to-automatic');
  // ...until the estimator returns the row to automatic.
  const automatic = returnCabinetryRowToAutomatic(later, entry.action.importKey, owner);
  assert.equal(find(automatic, K, std, 'Corner base cabinet').quantity, 5);
  assert.deepEqual(outcomes(automatic), { [CABINETRY_OUTCOME_MATCHED]: 4 });
});
check('12-13 SAVE / RELOAD AND JOB FILE ROUND TRIP', () => {
  const stored = JSON.parse(JSON.stringify(first));
  // What opening a saved job or importing a .gr8job does to cabinetry: migrate, reconcile, apply.
  const reopened = apply(reconcileCabinetryQuotation(migrateWorkbookCabinetSchedules(stored), owner), owner);
  assert.equal(reopened, stored, 'a saved job reopens with nothing to recompute');
  assert.deepEqual(quantities(reopened), quantities(first));
  assert.deepEqual(reopened.cabinetryReconciliation, first.cabinetryReconciliation);
  assert.deepEqual(scheduleOf(reopened), scheduleOf(first));
});
check('14 AN OLD SAVED JOB BECOMES CANONICAL DATA', () => {
  const old = { locations: [room('Kitchen'), room('Laundry'), room('Bathroom')], schedule: [
    { componentId: 'O1', location: 'Kitchen', unitType: 'Corner unit', quantity: 1 }, { componentId: 'O2', location: 'Kitchen', unitType: 'Standard base unit', width: '1200', quantity: 2 },
    { componentId: 'O3', location: 'Laundry', unitType: 'Standard base unit', quantity: 1 }, { componentId: 'O4', location: 'Bathroom', type: 'bath-wall-two-drawer', unitType: '2-drawer unit', quantity: 1 }] };
  const raw = () => ({ rooms: [{ id: 'c', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: { requirementKey: 'cabinetry', cabinetrySelection: structuredClone(old) } }] }] });
  const loaded = apply(migrateWorkbookCabinetSchedules({ ...base, clientSelectionsBook: raw(), selectionsBook: raw() }), owner);
  for (const key of ['clientSelectionsBook', 'selectionsBook']) {
    const selection = loaded[key].rooms[0].rows[0].guidedSelection.cabinetrySelection;
    assert.deepEqual(selection.schedule.map(entry => entry.cabinetTypeId), ['corner_base', 'base_unit_1200_2door', 'vanity_wallhung_2drawer_750'], `${key}: every line is canonical`);
    assert.deepEqual(selection.legacyCabinetSchedule.map(entry => entry.componentId), ['O3']);
  }
  // The one line with no size on record asks once, offering only what it can be...
  const [pending] = attention(loaded);
  assert.deepEqual([pending.room, pending.label, pending.action.kind, pending.action.options.map(option => option.id)], ['Laundry', 'Standard base unit', 'classify', ['base_unit_600_1door', 'base_unit_1200_2door']]);
  assert(!/previous cabinet list|ambiguous/i.test(JSON.stringify(loaded.cabinetryReconciliation.entries)), 'no internal wording reaches the reconciliation');
  // ...and once answered it is an ordinary canonical line in every copy, for good.
  const settled = apply(classifyLegacyCabinetLine(loaded, 'O3', 'base_unit_600_1door'), owner);
  assert.deepEqual(attention(settled), []);
  assert.equal(find(settled, L, std, '1 door base unit - 600mm').quantity, 1);
  for (const key of ['clientSelectionsBook', 'selectionsBook']) assert.equal(settled[key].rooms[0].rows[0].guidedSelection.cabinetrySelection.schedule.find(entry => entry.componentId === 'O3').cabinetTypeId, 'base_unit_600_1door');
  assert.equal(apply(migrateWorkbookCabinetSchedules(JSON.parse(JSON.stringify(settled))), owner).cabinetryReconciliation.summary.unmatched, 0);
});
check('15 NO OLD ROOM SECTIONS REAPPEAR', () => {
  const old = { ...base, cabinetryDatasetRevision: 'older', quotation: { ...base.quotation, BENCHTOPS: { rows: [{ id: 'x', item: 'Old benchtop', quantity: 3 }] }, WARDROBES: { rows: [] }, LAUNDRY: { rows: [] }, 'CABINETRY - KITCHEN': { rows: [] }, 'BUTLERS PANTRY': { rows: [] } } };
  const sections = Object.keys(reconcileCabinetryQuotation(old, owner).quotation).filter(isCabinetrySection);
  assert.deepEqual(sections, ['CABINETRY']);
  assert.deepEqual(Object.keys(apply(first, owner).quotation).filter(isCabinetrySection), ['CABINETRY']);
});
check('16 COLLAPSE / EXPAND IS DISPLAY ONLY', () => {
  const rows = rowsOf(first);
  const snapshot = JSON.stringify(rows);
  const options = { headingLevel: row => row.cabinetryRowType === 'heading' ? row.cabinetryHeadingLevel : 0, isSpacer: row => row.cabinetryRowType === 'spacer', isActive: row => Number(row.quantity) > 0, cost: row => Number(row.quantity) * Number(row.excelRate) };
  const model = buildQuotationSubgroups(rows, options);
  const total = list => list.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.excelRate) || 0), 0);
  const closed = visibleSubgroupRows(rows, model, () => false), opened = visibleSubgroupRows(rows, model, () => true);
  assert(closed.length < opened.length && opened.length === rows.length);
  assert(closed.every(row => rows.includes(row)), 'the same row objects are drawn, never copies');
  assert.equal(JSON.stringify(rows), snapshot, 'rows are not changed by opening or closing');
  assert.equal(total(rows), total(rowsOf(first)));
  assert.equal(model.list.filter(group => group.level === 1).reduce((sum, group) => sum + group.total, 0), total(rows), 'heading totals are the sum of all rows, open or closed');
});
check('17 TENANT ISOLATION', () => {
  assert.deepEqual(finalCabinetryRows('another-workspace'), []);
  assert(canonicalCabinetryProducts.every(product => product.organisationId === owner), 'every approved cabinetry product belongs to this builder');
  const foreign = { ...first, workspaceId: 'another-workspace' };
  assert.equal(apply(foreign, owner), foreign, 'a job of another workspace is never recomputed by this builder');
  assert.equal(apply(first, 'another-workspace'), first);
  assert.equal(reconcileCabinetryQuotation(foreign, owner), foreign);
  assert.equal(returnCabinetryRowToAutomatic(first, 'final-cabinetry:9', 'another-workspace'), first);
});

for (const [name, result] of Object.entries(results)) console.log(`${name}: ${result}`);
if (Object.values(results).includes('FAIL')) process.exit(1);
