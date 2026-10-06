// Cabinetry Requirements Import Engine: takeoff owns Qty, selections own finish.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-requirements-import.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { preserveQuoteQuantityOwnership } from '../lib/builders/selectionRegistry.js';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryCatalogueRow, cabinetryRequirementTypes, cabinetryFinishFor, benchtopRangeFor,
  CABINETRY_FINISHES, BENCHTOP_RANGES, CABINETRY_MATCHED, CABINETRY_UNMATCHED, CABINETRY_SELECTION_REQUIRED, setCabinetryRequirements } from '../lib/construction-estimation/cabinetryRequirements.js';

const owner = source.workspaceId;
const results = {};
const check = (name, run) => { try { run(); results[name] ??= 'PASS'; } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, error.message); } };

// --- Canonical type table against the approved catalogue (independent of row position). ---
const EXPECTED = {
  kitchen: { base_unit_600_1door: '1 door base unit - 600mm', base_unit_1200_2door: '2 door base unit - 1200mm', sink_base: 'Sink base cabinet', underbench_oven: 'Underbench oven cabinet', corner_base: 'Corner base cabinet',
    dishwasher_opening: 'Dishwasher cabinet', microwave_cabinet: 'Microwave cabinet', pullout_bin: 'Pull-out bin cabinet', drawer_base_2: '2 drawer pot drawer base', drawer_base_3: '3 drawer pot drawer base - 1 small + 2 large',
    drawer_base_4: '4 drawer base unit', drawer_base_5: '5 drawer base unit', hidden_internal_drawer: 'Hidden internal drawer', overhead_1door_standard: 'Overhead cabinet - 1 door - standard height',
    overhead_2door_standard: 'Overhead cabinet - 2 door - standard height', overhead_1door_extended: 'Overhead cabinet - 1 door - extended height', overhead_2door_extended: 'Overhead cabinet - 2 door - extended height',
    rangehood_cabinet: 'Rangehood cabinet', tall_pantry_600: 'Tall pantry cabinet - 1 door - 600mm - 5 shelves', tall_pantry_1200: 'Tall pantry cabinet - 2 door - 1200mm - 5 shelves', oven_tower_600: 'Tall oven tower cabinet - 600mm',
    bulkhead_300: 'MDF bulkhead - 300mm - LM', bulkhead_450: 'MDF bulkhead - 450mm - LM', handle_upgrade_sharkfin: 'Sharkfin handle upgrade - per unit', handle_upgrade_recessed_rail: 'Recessed rail upgrade - per unit',
    wine_rack: 'Wine rack cabinet', cleated_shelf: 'Cleated shelving module', floating_shelf: 'Floating shelf module', open_shelf: 'Open shelving module', short_end_panel: /^Short end panel - /, tall_end_panel: /^Tall end panel - /,
    benchtop_600: / - 600mm wide - LM$/, benchtop_900: / - 900mm wide - LM$/, benchtop_1200: / - 1200mm wide - LM$/, benchtop_sink_cutout: 'Standard sink cutout', benchtop_undermount_sink_cutout: 'Undermount sink cutout & polish',
    benchtop_cooktop_cutout: 'Standard cooktop cutout', benchtop_flush_cooktop_cutout: 'Flush cooktop cutout', benchtop_tap_hole: 'Tap hole', benchtop_drainer_grooves: 'Drainer grooves - set',
    benchtop_mitred_edge_40: '40mm mitred edge upgrade - LM', benchtop_mitred_edge_60: '60mm mitred edge upgrade - LM', benchtop_waterfall_standard: 'Standard waterfall end', benchtop_waterfall_premium: 'Premium waterfall end',
    benchtop_waterfall_porcelain: 'Porcelain / sintered waterfall end', benchtop_upstand: 'Stone upstand - LM', benchtop_splashback_full_height: 'Full-height stone splashback - m2' },
  laundry: { sink_base: 'Laundry sink cabinet', washer_dryer_opening: 'Washer / dryer opening with end panels', tall_linen_600: 'Tall linen cabinet - 1 door - 600mm', tall_linen_1200: 'Tall linen cabinet - 2 door - 1200mm', open_shelf: 'Open shelving module' },
  bathroom: { vanity_floor_1door_600: 'Floor mounted vanity - 1 door - 600mm', vanity_floor_2door_1200: 'Floor mounted vanity - 2 door - 1200mm', vanity_floor_2drawer_600: 'Floor mounted vanity - 2 drawer - 600mm',
    vanity_floor_2drawer_750: 'Floor mounted vanity - 2 drawer - 750mm', vanity_floor_3drawer_900: 'Floor mounted vanity - 3 drawer - 900mm', vanity_floor_3drawer_1200: 'Floor mounted vanity - 3 drawer - 1200mm',
    vanity_wallhung_1door_600: 'Wall hung vanity - 1 door - 600mm', vanity_wallhung_2door_1200: 'Wall hung vanity - 2 door - 1200mm', vanity_wallhung_2drawer_750: 'Wall hung vanity - 2 drawer - 750mm',
    vanity_wallhung_3drawer_900: 'Wall hung vanity - 3 drawer - 900mm', vanity_wallhung_3drawer_1200: 'Wall hung vanity - 3 drawer - 1200mm', vanity_wallhung_towel_shelf_1200: 'Wall hung vanity with open towel shelf - 1200mm',
    shaving_cabinet_600: 'Mirrored shaving cabinet - 1 door - 600mm', shaving_cabinet_1200: 'Mirrored shaving cabinet - 2 door - 1200mm', tall_linen_600: 'Tall linen cabinet - 1 door - 600mm', tall_linen_1200: 'Tall linen cabinet - 2 door - 1200mm',
    open_towel_shelf: 'Open towel shelf / module', bulkhead_300: 'MDF bulkhead - 300mm - LM', bulkhead_450: 'MDF bulkhead - 450mm - LM' },
  wardrobes: { wardrobe_hanging_single_600_900: 'Single hanging bay - 600-900mm - shelf + rail', wardrobe_hanging_single_900_1200: 'Single hanging bay - 900-1200mm - shelf + rail', wardrobe_hanging_double_900_1200: 'Double hanging bay - 900-1200mm',
    wardrobe_shelving_tower_450_600: 'Tall shelving tower - 450-600mm', wardrobe_shelving_bay_900_1200: 'Adjustable shelving bay - 900-1200mm', wardrobe_drawer_shelf_tower_450_600: 'Drawer / shelf tower - 450-600mm',
    wardrobe_drawers_4: '4 drawer soft-close bank', wardrobe_drawers_5: '5 drawer soft-close bank', wardrobe_overhead_900_1200: 'Overhead storage cabinet - 900-1200mm', wardrobe_shoe_bay_900_1200: 'Shoe shelving bay - 900-1200mm',
    wardrobe_island_4drawer: 'Wardrobe island - 4 drawer', wardrobe_island_8drawer: 'Wardrobe island - 8 drawer', wardrobe_jewellery_drawer: 'Jewellery drawer', wardrobe_pullout_hamper: 'Pull-out hamper', wardrobe_tie_belt_rack: 'Tie / belt rack',
    wardrobe_valet_rail: 'Valet rail', wardrobe_led_lighting: 'LED wardrobe lighting allowance', wardrobe_door_hinged: 'Hinged wardrobe door - up to 600mm wide', wardrobe_door_sliding: 'Sliding wardrobe door - per panel',
    wardrobe_door_mirror_sliding: 'Mirror sliding wardrobe door - per panel' },
};
EXPECTED.butlers_pantry = Object.fromEntries(Object.entries(EXPECTED.kitchen).filter(([key]) => !['underbench_oven', 'oven_tower_600', 'short_end_panel', 'tall_end_panel'].includes(key)));
const products = source.rows.filter(row => row.type === 'product');
const catalogueKey = row => row.key || `final-cabinetry:${row.sourceRow}`;
const mapped = new Set();
for (const [group, expected] of Object.entries(EXPECTED)) {
  if (['kitchen', 'butlers_pantry', 'wardrobes'].includes(group)) assert.deepEqual(new Set(cabinetryRequirementTypes(group).map(type => type.key)), new Set(Object.keys(expected)), `${group} type list`);
  for (const [type, description] of Object.entries(expected)) {
    const meta = cabinetryRequirementTypes(group).find(item => item.key === type);
    const finishes = !meta.finishDependent ? [null] : meta.area === 'benchtops' ? BENCHTOP_RANGES : CABINETRY_FINISHES;
    for (const finish of finishes) {
      const row = cabinetryCatalogueRow(group, type, finish?.key);
      assert(row, `${group}/${type}/${finish?.key}`);
      if (description instanceof RegExp) assert.match(row.description, description); else assert.equal(row.description, description);
      if (finish) assert(row.range.includes(finish.range), `${row.range} is the ${finish.label} block`);
      const approved = products.find(item => catalogueKey(item) === row.importKey);
      assert.equal(row.price, approved.price); assert.equal(row.description, approved.description);
      mapped.add(row.importKey);
    }
  }
}
// Laundry and bathroom benchtops / shared units are not all listed above: they must still resolve to approved rows.
for (const type of cabinetryRequirementTypes()) for (const finish of type.finishDependent ? (type.area === 'benchtops' ? BENCHTOP_RANGES : CABINETRY_FINISHES) : [null]) mapped.add(cabinetryCatalogueRow(type.group, type.key, finish?.key).importKey);
assert.equal(mapped.size, products.length, 'every approved catalogue product has exactly one canonical type + finish');
assert.equal(cabinetryFinishFor('Two-pack painted').key, 'two_pack'); assert.equal(cabinetryFinishFor('Other/custom'), null); assert.equal(cabinetryFinishFor('Gloss decorative board'), null);
assert.equal(benchtopRangeFor('Mid Range Stone').key, 'mid_range_stone'); assert.equal(benchtopRangeFor('Laminate'), null); assert.equal(benchtopRangeFor('Solid Timber'), null);

// --- Job fixture. ---
const takeoff = quantity1200 => [
  { id: 'k-base-600', room: 'Kitchen', type: 'base_unit_600_1door', widthMm: 600, quantity: 3 },
  { id: 'k-base-1200', room: 'Kitchen', type: 'base_unit_1200_2door', widthMm: 1200, quantity: quantity1200 },
  { id: 'k-drawers', room: 'Kitchen', type: 'drawer_base_3', quantity: 1 },
  { id: 'k-overheads', room: 'Kitchen', type: 'overhead_2door_standard', quantity: 4 },
  { id: 'k-pantry', room: 'Kitchen', type: 'tall_pantry', widthMm: 600, quantity: 1 },
  { id: 'k-short-panel', room: 'Kitchen', type: 'short_end_panel', quantity: 2 },
  { id: 'k-tall-panel', room: 'Kitchen', type: 'tall_end_panel', quantity: 1 },
  { id: 'k-bench', room: 'Kitchen', type: 'benchtop', widthMm: 600, lengthLm: 4.8 },
  { id: 'k-island', room: 'Kitchen', type: 'benchtop', widthMm: 1200, lengthLm: 2.4 },
  { id: 'bp-base', room: "Butler's Pantry", type: 'base_unit_1200_2door', quantity: 1 },
  { id: 'bp-bench', room: "Butler's Pantry", type: 'benchtop', widthMm: 600, lengthLm: 2.1 },
  { id: 'bp-panel', room: "Butler's Pantry", type: 'short_end_panel', quantity: 1 },
  { id: 'l-sink', room: 'Laundry', type: 'sink_base', quantity: 1 },
  { id: 'l-overhead', room: 'Laundry', type: 'overhead_1door_standard', quantity: 2 },
  { id: 'l-bench', room: 'Laundry', type: 'benchtop', widthMm: 600, lengthLm: 1.8 },
  { id: 'b-vanity', room: 'Bathroom', type: 'vanity_floor', widthMm: 900, drawers: 3, quantity: 1 },
  { id: 'e-vanity', room: 'Ensuite', type: 'vanity_wallhung', widthMm: 1200, drawers: 3, quantity: 1 },
  { id: 'p-vanity', room: 'Powder Room', type: 'vanity_floor', widthMm: 1200, quantity: 1 },
  { id: 'w-hanging', room: 'Bed 1', type: 'wardrobe_hanging', widthMm: 1000, quantity: 3 },
  { id: 'w-drawers', room: 'Bed 1', type: 'wardrobe_drawers', drawers: 4, quantity: 1 },
  { id: 'w-doors', room: 'Bed 1', type: 'wardrobe_door_sliding', quantity: 4 },
  { id: 'g-base', room: 'Garage', type: 'base_unit_600_1door', quantity: 1 },
];
const inclusions = { schedule: { id: 'premier', display_name: 'Premier Inclusions', workspace_id: owner }, items: [
  { selection_slot_id: 'cabinetry_finish', baselineProductName: 'Standard Colourboard' },
  { selection_slot_id: 'benchtop_range', baselineProductName: 'Base Range Stone' }] };
const clientBook = (material, benchtop, extra = {}) => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: { requirementKey: 'cabinetry', cabinetrySelection: {
  locations: [{ location: 'Kitchen', doorMaterialGroup: material, confirmedAt: '2026-10-05T00:00:00.000Z', benchtop, cabinetSchedule: [{ unitType: 'Standard base unit', quantity: 99 }], ...extra }] } } }] }] });
// A job reaches the engine already stamped with the approved catalogue revision.
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
base.quotation.CABINETRY.rows = base.quotation.CABINETRY.rows.map(row => row.room === 'KITCHEN CABINETRY' && row.range === 'VINYL WRAP' && row.item === 'Wine rack cabinet' ? { ...row, quantity: 7, selectionSpec: 'Estimator note' } : row);
base.quotation.UNRELATED = { rows: [{ id: 'unrelated', item: 'Electrical labour', quantity: 2, manualRate: 100 }] };
const withTakeoff = (book, quantity1200 = 2) => ({ ...book, aiPlanTakeoffJob: { ...book.aiPlanTakeoffJob, cabinetryRequirements: takeoff(quantity1200) } });
const rowsOf = book => book.quotation.CABINETRY.rows;
const find = (book, room, range, item) => { const hits = rowsOf(book).filter(row => row.room === room && row.range === range && (item instanceof RegExp ? item.test(row.item) : row.item === item)); assert.equal(hits.length, 1, `${room}/${range}/${item}`); return hits[0]; };
const qty = (book, room, range, item) => find(book, room, range, item).quantity;
const populated = book => rowsOf(book).filter(row => row.quantity !== '' && row.quantity != null).map(row => `${row.room}|${row.range}|${row.item}|${row.quantity}`);
const entry = (book, id) => book.cabinetryReconciliation.entries.find(item => item.requirementId === id);
const structure = book => rowsOf(book).map(row => `${row.id}|${row.item}|${row.excelRate}|${row.sortOrder}`);
const K = 'KITCHEN CABINETRY', BP = "BUTLER'S PANTRY CABINETRY", L = 'LAUNDRY CABINETRY', BATH = 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', W = 'WARDROBES';

// No requirements: an existing job is returned untouched.
assert.equal(apply(base, owner), base);
assert.equal(apply(withTakeoff(base), 'other-workspace').cabinetryReconciliation, undefined);

// --- 1. Inclusion Schedule only. ---
const included = apply(withTakeoff({ ...base, jobInclusionSnapshot: inclusions }), owner);
const std = 'STANDARD COLOURBOARD', stone = 'BASE RANGE STONE - 20MM';
check('Kitchen', () => {
  assert.equal(qty(included, K, std, '1 door base unit - 600mm'), 3);
  assert.equal(qty(included, K, std, '2 door base unit - 1200mm'), 2);
  assert.equal(qty(included, K, std, '3 drawer pot drawer base - 1 small + 2 large'), 1);
  assert.equal(qty(included, K, std, 'Overhead cabinet - 2 door - standard height'), 4);
  assert.equal(qty(included, K, std, 'Tall pantry cabinet - 1 door - 600mm - 5 shelves'), 1);
  for (const finish of CABINETRY_FINISHES.filter(item => item.key !== 'standard_colourboard')) assert.equal(qty(included, K, finish.range, '2 door base unit - 1200mm'), '');
});
check('Panels', () => {
  assert.equal(qty(included, K, std, /^Short end panel/), 2); assert.equal(qty(included, K, std, /^Tall end panel/), 1);
  assert.equal(qty(included, K, 'PREMIUM LAMINATE', /^Short end panel/), ''); assert.equal(qty(included, K, '2 PACK', /^Tall end panel/), '');
});
check('Benchtops', () => {
  assert.equal(qty(included, 'KITCHEN BENCHTOPS', stone, /600mm wide/), 4.8); assert.equal(qty(included, 'KITCHEN BENCHTOPS', stone, /1200mm wide/), 2.4);
  assert.equal(qty(included, 'KITCHEN BENCHTOPS', stone, /900mm wide/), ''); assert.equal(qty(included, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /600mm wide/), '');
  assert.equal(qty(included, "BUTLER'S PANTRY BENCHTOPS", stone, /600mm wide/), 2.1); assert.equal(qty(included, 'LAUNDRY BENCHTOPS', stone, /600mm wide/), 1.8);
});
check('Butlers Pantry', () => {
  assert.equal(qty(included, BP, std, '2 door base unit - 1200mm'), 1); assert.equal(qty(included, BP, std, '1 door base unit - 600mm'), '');
  assert.equal(entry(included, 'bp-panel').status, CABINETRY_UNMATCHED);
});
check('Laundry', () => { assert.equal(qty(included, L, std, 'Laundry sink cabinet'), 1); assert.equal(qty(included, L, std, 'Overhead cabinet - 1 door - standard height'), 2); });
check('Bathrooms', () => {
  assert.equal(qty(included, BATH, std, 'Floor mounted vanity - 3 drawer - 900mm'), 1); assert.equal(qty(included, BATH, std, 'Wall hung vanity - 3 drawer - 1200mm'), 1);
  // 1200mm floor vanity without door/drawer count has two approved variants: reported, never guessed.
  assert.equal(entry(included, 'p-vanity').status, CABINETRY_UNMATCHED);
});
check('Wardrobes', () => {
  assert.equal(qty(included, W, 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD', 'Single hanging bay - 900-1200mm - shelf + rail'), 3);
  assert.equal(qty(included, W, 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD', '4 drawer soft-close bank'), 1);
  assert.equal(qty(included, W, 'WARDROBE DOORS - STANDARD COLOURBOARD', 'Sliding wardrobe door - per panel'), 4);
  assert.equal(qty(included, W, 'WARDROBE DOORS - 2 PACK', 'Sliding wardrobe door - per panel'), '');
});
check('INCLUSION FALLBACK', () => {
  assert.equal(entry(included, 'k-base-1200').finishSource, 'INCLUSION_SCHEDULE');
  assert.equal(find(included, K, std, '2 door base unit - 1200mm').selectionSpec, 'Kitchen · Standard Colourboard · From Premier Inclusions');
  assert.equal(populated(included).length, 19 + 1);
});
check('RECONCILIATION', () => {
  const { entries, summary } = included.cabinetryReconciliation;
  assert.equal(entries.length, takeoff(2).length);
  assert(entries.every(item => [CABINETRY_MATCHED, CABINETRY_UNMATCHED].includes(item.status)));
  assert.deepEqual(entries.filter(item => item.status === CABINETRY_UNMATCHED).map(item => item.requirementId), ['bp-panel', 'p-vanity', 'g-base']);
  assert(entries.filter(item => item.status === CABINETRY_UNMATCHED).every(item => item.reason && item.quantity > 0));
  assert.deepEqual(summary, { total: 22, matched: 19, unmatched: 3, selectionRequired: 0, legacyArchived: 0, manualOverrides: 0 });
  assert.equal(entry(included, 'k-base-1200').matchedQuoteRow, 'STANDARD COLOURBOARD - 2 door base unit - 1200mm');
  assert.equal(entry(included, 'k-bench').dimensions, '600mm wide x 4.8 LM');
});

// --- 2. Client Selection override (Kitchen only), with a selection-side quantity that must be ignored. ---
const overridden = apply({ ...included, clientSelectionsBook: clientBook('Two-pack painted', { rangeKey: 'mid_range_stone' }) }, owner);
check('CLIENT OVERRIDE', () => {
  assert.equal(qty(overridden, K, '2 PACK', '2 door base unit - 1200mm'), 2); assert.equal(qty(overridden, K, std, '2 door base unit - 1200mm'), '');
  assert.equal(qty(overridden, K, '2 PACK', /^Short end panel/), 2); assert.equal(qty(overridden, K, std, /^Short end panel/), '');
  assert.equal(qty(overridden, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /600mm wide/), 4.8); assert.equal(qty(overridden, 'KITCHEN BENCHTOPS', stone, /600mm wide/), '');
  assert.equal(find(overridden, K, '2 PACK', '2 door base unit - 1200mm').selectionSpec, 'Kitchen · 2 Pack · From Client Selections');
  assert.equal(find(overridden, K, std, '2 door base unit - 1200mm').selectionSpec ?? '', '');
  // Rooms without a client selection stay on the inclusion finish.
  assert.equal(qty(overridden, BP, std, '2 door base unit - 1200mm'), 1); assert.equal(qty(overridden, "BUTLER'S PANTRY BENCHTOPS", stone, /600mm wide/), 2.1);
  assert.equal(entry(overridden, 'k-base-1200').finishSource, 'CLIENT_SELECTION'); assert.equal(entry(overridden, 'bp-base').finishSource, 'INCLUSION_SCHEDULE');
});
// --- 3. Selection changed after the quote was populated. ---
const changed = apply({ ...overridden, clientSelectionsBook: clientBook('Shaker/profile door', { rangeKey: 'High End Stone' }) }, owner);
check('SELECTION -> FINISH', () => {
  assert.equal(qty(changed, K, 'SHAKER STYLE', '2 door base unit - 1200mm'), 2);
  for (const range of [std, '2 PACK', 'PREMIUM LAMINATE', 'VINYL WRAP']) assert.equal(qty(changed, K, range, '2 door base unit - 1200mm'), '');
  assert.equal(qty(changed, 'KITCHEN BENCHTOPS', 'HIGH END STONE - 20MM', /1200mm wide/), 2.4); assert.equal(qty(changed, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /1200mm wide/), '');
  assert.equal(populated(changed).length, populated(included).length);
  // An unapproved client finish is flagged, not replaced by the inclusion finish or a near match.
  const custom = apply({ ...changed, clientSelectionsBook: clientBook('Other/custom', { range: 'Laminate' }) }, owner);
  assert.equal(entry(custom, 'k-base-1200').flag, CABINETRY_SELECTION_REQUIRED); assert.equal(entry(custom, 'k-bench').flag, CABINETRY_SELECTION_REQUIRED);
  assert.equal(rowsOf(custom).filter(row => row.room === K && row.item === '2 door base unit - 1200mm' && row.quantity !== '').length, 0);
});
// --- 4. Takeoff Qty changed; selections never move Qty. ---
const remeasured = apply(withTakeoff(changed, 5), owner);
check('TAKEOFF -> QTY', () => {
  assert.equal(qty(remeasured, K, 'SHAKER STYLE', '2 door base unit - 1200mm'), 5); assert.equal(qty(remeasured, K, 'SHAKER STYLE', '1 door base unit - 600mm'), 3);
  for (const book of [included, overridden, changed]) assert.equal(entry(book, 'k-base-1200').quantity, 2);
  // The selection's own schedule quantity (99) and a selection save's quantity restore never win.
  assert(!populated(remeasured).some(line => line.endsWith('|99')));
  const edited = { ...remeasured, quotation: { ...remeasured.quotation, CABINETRY: { ...remeasured.quotation.CABINETRY, rows: rowsOf(remeasured).map(row => row.importKey === entry(remeasured, 'k-base-1200').matchedImportKey ? { ...row, quantity: 12, quantityFormulaOverride: true, formulas: { B: '40' } } : row) } } };
  // An estimator's own quantity on a linked row is kept and marked, never silently replaced.
  const kept = apply(edited, owner);
  assert.equal(qty(kept, K, 'SHAKER STYLE', '2 door base unit - 1200mm'), 12);
  assert(find(kept, K, 'SHAKER STYLE', '2 door base unit - 1200mm').selectionSpec.startsWith('MANUAL OVERRIDE 12 (linked qty 5)'));
  assert.equal(entry(kept, 'k-base-1200').flag, 'MANUAL OVERRIDE'); assert.equal(apply(kept, owner), kept);
  // A Client Selections save restores every row's quantity fields before the engine runs (updateClientSelectionsBook).
  const beforeSave = apply(withTakeoff(included, 5), owner);
  const savedSelection = apply(preserveQuoteQuantityOwnership(beforeSave, { ...beforeSave, clientSelectionsBook: changed.clientSelectionsBook }), owner);
  assert.deepEqual(populated(savedSelection), populated(remeasured));
  // Explicit Job Setup requirements use the same path.
  const jobSetup = apply(setCabinetryRequirements({ ...base, jobInclusionSnapshot: inclusions }, [{ room: 'Laundry', type: 'tall_linen', doors: 2, quantity: 1 }]), owner);
  assert.equal(qty(jobSetup, L, std, 'Tall linen cabinet - 2 door - 1200mm'), 1);
  assert.equal(apply({ ...jobSetup, cabinetryRequirements: { items: [] } }, owner).quotation.CABINETRY.rows.filter(row => row.room === L && row.quantity !== '').length, 0);
});
check('NO DUPLICATES', () => {
  for (const book of [included, overridden, changed, remeasured]) {
    assert.deepEqual(structure(book), structure(base));
    assert.equal(new Set(rowsOf(book).map(row => row.id)).size, 870);
    assert.equal(book.quotation.UNRELATED, base.quotation.UNRELATED);
    assert.deepEqual(Object.keys(book.quotation), Object.keys(base.quotation));
    assert.equal(qty(book, K, 'VINYL WRAP', 'Wine rack cabinet'), 7); assert.equal(find(book, K, 'VINYL WRAP', 'Wine rack cabinet').selectionSpec, 'Estimator note');
    assert.equal(rowsOf(book).filter((row, index) => row !== rowsOf(base)[index]).length <= 40, true);
  }
  assert.equal(apply(remeasured, owner), remeasured);
});
check('Kitchen', () => {
  // Price comes from the approved catalogue row of the selected finish.
  const preview = calculateEstimateBuilderWorkbook(remeasured);
  const row = preview.quotation.CABINETRY.rows.find(item => item.importKey === entry(remeasured, 'k-base-1200').matchedImportKey);
  const approved = products.find(item => item.room === K && item.range === 'SHAKER STYLE' && item.description === '2 door base unit - 1200mm');
  assert.equal(row.excelRate, approved.price); assert.equal(row.qty, 5); assert.equal(row.cost, 5 * approved.price);
  const bench = preview.quotation.CABINETRY.rows.find(item => item.importKey === entry(remeasured, 'k-bench').matchedImportKey);
  assert.equal(bench.unit, 'LM'); assert.equal(bench.cost, Math.round(4.8 * bench.excelRate * 100) / 100);
});
// --- 5. Save / reload. ---
check('SAVE/RELOAD', () => {
  const reloaded = JSON.parse(JSON.stringify(remeasured));
  const reopened = apply(reconcileCabinetryQuotation(reloaded, owner), owner);
  assert.equal(reopened, reloaded);
  assert.deepEqual(populated(reopened), populated(remeasured)); assert.deepEqual(reopened.cabinetryReconciliation, remeasured.cabinetryReconciliation);
  // A catalogue revision rebuild on open keeps the takeoff-owned rows and the estimator's own row.
  const { cabinetryDatasetRevision, ...older } = reloaded;
  const rebuilt = apply(reconcileCabinetryQuotation(older, owner), owner);
  assert.deepEqual(populated(rebuilt), populated(remeasured)); assert.equal(apply(rebuilt, owner), rebuilt);
  // A reload that also carries a newer selection re-points the rows.
  const later = apply({ ...reloaded, clientSelectionsBook: clientBook('Vinyl wrap', { rangeKey: 'standard_laminate' }) }, owner);
  assert.equal(qty(later, K, 'VINYL WRAP', '2 door base unit - 1200mm'), 5); assert.equal(qty(later, K, 'SHAKER STYLE', '2 door base unit - 1200mm'), '');
});
// --- 6. No finish anywhere: flagged, requirement and quantity preserved, nothing guessed. ---
check('INCLUSION FALLBACK', () => {
  const unselected = apply({ ...remeasured, jobInclusionSnapshot: null, clientSelectionsBook: null }, owner);
  const flagged = unselected.cabinetryReconciliation.entries.filter(item => item.flag === CABINETRY_SELECTION_REQUIRED);
  assert.equal(flagged.length, 17); assert(flagged.every(item => item.status === CABINETRY_UNMATCHED && item.quantity > 0));
  assert.equal(entry(unselected, 'k-base-1200').quantity, 5);
  // Only the finish-independent wardrobe fitout and the estimator's own row keep a quantity.
  assert.deepEqual(populated(unselected).map(line => line.split('|')[1]).sort(), ['VINYL WRAP', 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD', 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD']);
});

const order = ['Kitchen', 'Butlers Pantry', 'Laundry', 'Bathrooms', 'Wardrobes', 'Benchtops', 'Panels', 'TAKEOFF -> QTY', 'SELECTION -> FINISH', 'INCLUSION FALLBACK', 'CLIENT OVERRIDE', 'RECONCILIATION', 'NO DUPLICATES', 'SAVE/RELOAD'];
for (const name of order) console.log(`${name}: ${results[name] || 'NOT RUN'}`);
if (order.some(name => results[name] !== 'PASS')) process.exit(1);
