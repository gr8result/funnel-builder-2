// The island benchtop follows the Main benchtop's selection by default ("Use same benchtop as Main
// Benchtop"). Only the selection is inherited - never the island's length, depth or quantity.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-benchtop-island-inheritance.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryCatalogueRow } from '../lib/construction-estimation/cabinetryRequirements.js';
import { normaliseCabinetrySelection } from '../lib/builders/cabinetryWorkflow.js';
import { STONE_BENCHTOP_CATALOGUE } from '../lib/builders/stoneBenchtopWorkflow.js';
import { benchtopPriceGroupKey, saveBuilderBenchtopRangeMapping, setBenchtopRangeMappingStorage, getBuilderBenchtopRangeMapping } from '../lib/builders/benchtopRangeMapping.js';
import { ISLAND_AREA_ID, benchtopAreasFor, benchtopLocationPatch, benchtopSetupFor, stoneSurfaceForArea } from '../lib/builders/benchtopSelection.js';
import { islandInheritsMain, setIslandSameAsMain } from '../lib/builders/benchtopInheritance.js';

const pass = message => console.log(`PASS ${message}`);
const owner = source.workspaceId;
const store = new Map();
setBenchtopRangeMappingStorage({ getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)) });
const byGroup = group => STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.priceGroup === group);
const prestige = byGroup('Prestige'), signature = byGroup('Signature');
const eclipse = STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.colourName === 'Eclipse');
saveBuilderBenchtopRangeMapping(owner, { [benchtopPriceGroupKey(prestige)]: 'mid_range_stone', [benchtopPriceGroupKey(signature)]: 'high_end_stone', [benchtopPriceGroupKey(eclipse)]: 'base_range_stone' }, { catalogue: STONE_BENCHTOP_CATALOGUE });
const ranges = { mapping: getBuilderBenchtopRangeMapping(owner), classifications: {} };

const kitchen = { location: 'Kitchen', enabledAreaKeys: ['lowerDoorsDrawers', 'islandBenchBack'] };
const setup = { ...benchtopSetupFor(kitchen, {}), upstand: 'None', cutouts: [], confirmedAt: '2026-10-09T00:00:00.000Z' };
const lengths = { 'benchtop-main': 4800, [ISLAND_AREA_ID]: 3200 };
const base = benchtopAreasFor(kitchen, {}).map(area => ({ ...area, lengthMm: lengths[area.id] }));
assert.deepEqual(base.map(area => [area.id, area.sameAsMain]), [['benchtop-main', undefined], [ISLAND_AREA_ID, true]]);
assert(islandInheritsMain(base[1]), 'the link is ON by default');

const withMain = (areas, product) => areas.map(area => (area.id === 'benchtop-main' ? { ...area, surface: stoneSurfaceForArea(product, { room: 'Kitchen', area, setup, ranges }) } : area));
const save = areas => normaliseCabinetrySelection(JSON.parse(JSON.stringify({ locations: [{ ...kitchen, ...benchtopLocationPatch({ location: kitchen, setup, areas, ranges }) }] }))).locations[0];
const names = location => location.benchtopAreas.map(area => `${area.label}: ${area.surface?.colourName || '-'}`);

// 1. Selecting the Main benchtop selects the island too; geometry stays separate.
let location = save(withMain(base, prestige));
assert.deepEqual(names(location), ['Main benchtop: ' + prestige.colourName, 'Island benchtop: ' + prestige.colourName]);
assert.deepEqual(location.benchtopAreas.map(area => [area.lengthMm, area.depthMm]), [[4800, 600], [3200, 900]], 'length and depth are not linked');
assert.deepEqual(location.benchtopAreas[1].surface.applications, ['Island benchtop']);
assert.equal(location.benchtopAreas[1].surface.inheritedFromAreaId, 'benchtop-main');
pass('main benchtop selection flows to the island by default; length and depth stay separate');

// 2. Changing the Main benchtop product changes the island.
location = save(withMain(location.benchtopAreas, signature));
assert.deepEqual(names(location), ['Main benchtop: ' + signature.colourName, 'Island benchtop: ' + signature.colourName]);
assert.equal(location.benchtopAreas[1].surface.rangeKey, 'high_end_stone');
pass('a Main benchtop change updates the inheriting island (product, colour, range)');

// 3. Turning the link OFF keeps the inherited selection as the starting point.
let result = setIslandSameAsMain(location.benchtopAreas, false);
assert(!result.blocked);
location = save(result.areas);
assert.equal(location.benchtopAreas[1].sameAsMain, false);
assert.equal(location.benchtopAreas[1].surface.colourName, signature.colourName, 'inherited selection preserved');
assert(!location.benchtopAreas[1].surface.inheritedFromAreaId, 'no longer marked inherited');
location = save(withMain(location.benchtopAreas, prestige));
assert.deepEqual(names(location), ['Main benchtop: ' + prestige.colourName, 'Island benchtop: ' + signature.colourName], 'main change no longer moves the island');
// The island can now be anything, with its own edge profile.
const own = location.benchtopAreas.map(area => (area.id === ISLAND_AREA_ID ? { ...area, edgeProfile: 'Pencil round', surface: stoneSurfaceForArea(eclipse, { room: 'Kitchen', area, setup, ranges }) } : area));
location = save(own);
assert.deepEqual([location.benchtopAreas[1].surface.colourName, location.benchtopAreas[1].surface.edgeProfile, location.benchtopAreas[0].surface.edgeProfile], ['Eclipse', 'Pencil round', setup.edgeProfile]);
pass('turning OFF preserves the selection; the island then holds a different product and edge profile');

// 4. Turning ON again warns before replacing an independent choice.
result = setIslandSameAsMain(location.benchtopAreas, true);
assert(result.blocked && result.replacing.includes('Eclipse') && result.with.includes(prestige.colourName), 'blocked with both names for the warning');
assert.equal(result.areas, location.benchtopAreas, 'nothing changed while warning');
result = setIslandSameAsMain(location.benchtopAreas, true, { force: true });
assert(!result.blocked);
location = save(result.areas);
assert.deepEqual(names(location), ['Main benchtop: ' + prestige.colourName, 'Island benchtop: ' + prestige.colourName]);
// An island that was unlinked but still matches the main is re-linked without a warning.
const matching = setIslandSameAsMain(setIslandSameAsMain(location.benchtopAreas, false).areas, true);
assert(!matching.blocked);
pass('re-linking warns before replacing an independent island selection, and replaces on confirmation');

// 5. Quotation: linked island rides the main's range; independent island its own; no duplicate rows.
const book = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const quote = (loc) => apply({ ...book, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: normaliseCabinetrySelection({ locations: [loc] }) } }] }] } }, owner);
const qty = (workbook, type, rangeKey) => { const row = workbook.quotation.CABINETRY.rows.find(item => item.importKey === cabinetryCatalogueRow('kitchen', type, rangeKey).importKey); return row.quantity === '' || row.quantity == null ? null : Number(row.quantity); };
let quoted = quote(location);
assert.deepEqual([qty(quoted, 'benchtop_600', 'mid_range_stone'), qty(quoted, 'benchtop_900', 'mid_range_stone')], [4.8, 3.2], 'main 4.80 lm and island 3.20 lm, same range');
const unlinked = { ...location, benchtopAreas: setIslandSameAsMain(location.benchtopAreas, false).areas.map(area => (area.id === ISLAND_AREA_ID ? { ...area, surface: stoneSurfaceForArea(signature, { room: 'Kitchen', area, setup, ranges }) } : area)) };
quoted = quote(unlinked);
assert.deepEqual([qty(quoted, 'benchtop_600', 'mid_range_stone'), qty(quoted, 'benchtop_900', 'mid_range_stone'), qty(quoted, 'benchtop_900', 'high_end_stone')], [4.8, null, 3.2], 'independent island lands on its own range');
// A job saved before the link existed: island has no surface, main has one -> the island is quoted.
const legacy = { ...location, benchtopAreas: location.benchtopAreas.map(area => (area.id === ISLAND_AREA_ID ? { ...area, surface: null } : area)) };
quoted = quote(legacy);
assert.equal(qty(quoted, 'benchtop_900', 'mid_range_stone'), 3.2, 'a legacy island with no surface follows the main benchtop in the quotation');
assert(!quoted.cabinetryReconciliation.entries.some(entry => /Island/.test(entry.legacyLabel || entry.label || '') && /surface not selected/i.test(entry.reason || '')));
pass('quotation reflects the actual selection per benchtop; legacy islands inherit; no duplicate rows');

console.log('\nBenchtop island inheritance: all checks passed');
