// Client Selections > Cabinetry > Benchtops: setup first; the benchtop areas the PROJECT has (main
// run, an island the cabinetry scope shows, each vanity); a surface per area; the quotation range
// from the builder's supplier price group mapping; the quantity on the Quotation Builder row of
// each surface's range.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-benchtop-selection.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryCatalogueRow, BENCHTOP_RANGES, CABINETRY_SELECTION_REQUIRED } from '../lib/construction-estimation/cabinetryRequirements.js';
import { normaliseCabinetrySelection, cabinetryLocationMissingRequirements } from '../lib/builders/cabinetryWorkflow.js';
import { STONE_BENCHTOP_CATALOGUE } from '../lib/builders/stoneBenchtopWorkflow.js';
import { benchtopPriceGroupKey, getBuilderBenchtopRangeMapping, saveBuilderBenchtopRangeMapping, setBenchtopRangeMappingStorage, supplierPriceGroups } from '../lib/builders/benchtopRangeMapping.js';
import {
  ISLAND_AREA_ID, benchRunFromSchedule, benchtopAreasFor, benchtopDepthsForRoom, benchtopLocationPatch, benchtopNextStep, benchtopProfile, benchtopQuantitySummary, benchtopRangeFor, benchtopRangeKeyFor,
  benchtopSetupFor, islandEvidence, knownBenchtopCutouts, stoneSurfaceForArea, surfaceWithSetup,
} from '../lib/builders/benchtopSelection.js';

const pass = message => console.log(`PASS ${message}`);
const owner = source.workspaceId;
const store = new Map();
setBenchtopRangeMappingStorage({ getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)) });
const byGroup = group => STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.priceGroup === group);
const eclipse = STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.colourName === 'Eclipse');
const prestige = byGroup('Prestige'), signature = byGroup('Signature');
const porcelain = STONE_BENCHTOP_CATALOGUE.find(product => /porcelain/i.test(product.materialType));
assert(eclipse && prestige && signature && porcelain);

// ---- 1. Supplier -> supplier price group -> GR8 quotation range ----------------------------------
const groups = supplierPriceGroups(STONE_BENCHTOP_CATALOGUE);
const sa = groups.filter(group => group.supplier === 'Stone Ambassador');
for (const name of ['Essential', 'Deluxe', 'Prestige', 'Premium', 'Signature']) assert(sa.some(group => group.published && group.priceGroup === name), `Stone Ambassador ${name} is a supplier price group`);
assert.equal(groups.reduce((total, group) => total + group.products, 0), STONE_BENCHTOP_CATALOGUE.length, 'every product belongs to exactly one group');
assert(groups.length < STONE_BENCHTOP_CATALOGUE.length / 3, 'groups, not individual colours');
// A supplier that publishes no price group for a product is grouped by collection, never per colour.
assert.equal(benchtopPriceGroupKey(eclipse), 'stone-ambassador|collection-kaya-surfaces');
assert.equal(groups.find(group => group.key === benchtopPriceGroupKey(eclipse)).published, false);
// NOTHING is mapped until the builder maps it: no tier is guessed for any engineered-stone group.
assert.deepEqual(getBuilderBenchtopRangeMapping(owner), { groups: {}, updatedAt: '' });
const unmapped = { mapping: getBuilderBenchtopRangeMapping(owner), classifications: {} };
for (const product of STONE_BENCHTOP_CATALOGUE) {
  const range = benchtopRangeFor(product, unmapped);
  assert(range.rangeKey === '' || (range.rangeKey === 'porcelain_sintered' && range.source === 'material'), `${product.supplier} ${product.colourName} is not placed on a guessed tier`);
}
assert.equal(benchtopRangeKeyFor(prestige, unmapped), '');
assert.equal(benchtopRangeKeyFor(porcelain, unmapped), 'porcelain_sintered', 'porcelain / sintered is that range by material');
// The builder maps two groups; every product in them inherits the range.
let mapping = saveBuilderBenchtopRangeMapping(owner, { [benchtopPriceGroupKey(prestige)]: 'mid_range_stone', [benchtopPriceGroupKey(eclipse)]: 'mid_range_stone', [benchtopPriceGroupKey(signature)]: 'not-a-range' }, { catalogue: STONE_BENCHTOP_CATALOGUE });
assert.deepEqual([mapping.groups[benchtopPriceGroupKey(prestige)].rangeKey, mapping.groups[benchtopPriceGroupKey(prestige)].supplier, mapping.groups[benchtopPriceGroupKey(prestige)].priceGroup], ['mid_range_stone', 'Stone Ambassador', 'Prestige']);
assert.equal(mapping.groups[benchtopPriceGroupKey(signature)], undefined, 'an invalid range is not stored');
const inPrestige = STONE_BENCHTOP_CATALOGUE.filter(product => product.supplier === 'Stone Ambassador' && product.priceGroup === 'Prestige');
assert(inPrestige.length > 5 && inPrestige.every(product => benchtopRangeFor(product, { mapping }).rangeKey === 'mid_range_stone' && benchtopRangeFor(product, { mapping }).source === 'supplier-price-group'));
assert.equal(benchtopRangeKeyFor(signature, { mapping }), '', 'a group the builder has not mapped stays unset');
assert.equal(getBuilderBenchtopRangeMapping('another-builder').groups[benchtopPriceGroupKey(prestige)], undefined, 'the mapping is per builder');
// A range confirmed on a job before the mapping existed is kept where the mapping says nothing.
assert.equal(benchtopRangeFor(signature, { mapping, classifications: { 'stone-ambassador|signature': 'high_end_stone' } }).source, 'job-confirmation');
assert.equal(benchtopRangeFor(prestige, { mapping, classifications: { 'stone-ambassador|prestige': 'high_end_stone' } }).rangeKey, 'mid_range_stone', "the builder's mapping wins over an older job confirmation");
pass('supplier price groups map to quotation ranges per builder; nothing is mapped by default; products inherit');

// ---- 2. Project geometry: what the project already knows ------------------------------------------
const schedule = [
  { componentId: 'a', location: 'Kitchen', cabinetTypeId: 'base_unit_1200_2door', quantity: 2 },
  { componentId: 'b', location: 'Kitchen', cabinetTypeId: 'base_unit_600_1door', quantity: 1 },
  { componentId: 'c', location: 'Kitchen', cabinetTypeId: 'sink_base', quantity: 1, width: 900 },
  { componentId: 'd', location: 'Kitchen', cabinetTypeId: 'dishwasher_opening', quantity: 1, width: 600 },
  { componentId: 'e', location: 'Kitchen', cabinetTypeId: 'overhead_2door_standard', quantity: 3 },
  { componentId: 'f', location: 'Kitchen', cabinetTypeId: 'tall_pantry_600', quantity: 1 },
];
assert.deepEqual(benchRunFromSchedule(schedule, 'Kitchen'), { lengthMm: 4500, counted: 5, unknown: [] }, 'base cabinets only: overheads and tall units carry no benchtop');
const plainKitchen = { location: 'Kitchen', enabledAreaKeys: ['lowerDoorsDrawers', 'overheadDoors'] };
const islandKitchen = { location: 'Kitchen', enabledAreaKeys: ['lowerDoorsDrawers', 'islandBenchBack', 'endPanels', 'overheadDoors'] };
assert.deepEqual(knownBenchtopCutouts(schedule, { hasCooktop: true }), ['Sink', 'Tap', 'Cooktop']);
let setup = benchtopSetupFor(plainKitchen, { scheduleLines: schedule, project: { hasCooktop: true } });
assert.deepEqual([setup.edgeProfile, setup.waterfallEnds, setup.upstand, setup.cutouts], ['Square arris', 'None', 'None', ['Sink', 'Tap', 'Cooktop']]);
// No island evidence: no island. A kitchen is not given one because kitchens often have one.
assert.equal(islandEvidence(plainKitchen, { scheduleLines: schedule }), '');
assert.deepEqual(benchtopAreasFor(plainKitchen, { scheduleLines: schedule }).map(area => [area.label, area.lengthMm, area.depthMm, area.source]), [['Main benchtop', 4500, 600, 'cabinetry']]);
// Island bench back in the cabinetry scope: an Island benchtop exists, with no invented length.
assert.equal(islandEvidence(islandKitchen, { scheduleLines: schedule }), 'Cabinetry scope: Island bench back');
let areas = benchtopAreasFor(islandKitchen, { scheduleLines: schedule });
assert.deepEqual(areas.map(area => [area.id, area.label, area.lengthMm, area.depthMm, area.source]), [['benchtop-main', 'Main benchtop', 4500, 600, 'cabinetry'], [ISLAND_AREA_ID, 'Island benchtop', '', 900, 'project']]);
assert.equal(areas[1].evidence, 'Cabinetry scope: Island bench back');
// Other strong evidence: an island unit on the schedule, or island cabinetry in Job Setup / the takeoff.
assert.equal(islandEvidence(plainKitchen, { scheduleLines: [...schedule, { location: 'Kitchen', unitType: 'Island drawer bank', quantity: 1 }] }), 'Cabinet schedule: island unit');
assert.equal(islandEvidence(plainKitchen, { workbook: { cabinetryRequirements: { items: [{ room: 'Kitchen', type: 'base_unit_1200_2door', label: 'Island bench base', quantity: 2 }] } } }), 'Job Setup: island cabinetry');
assert.equal(islandEvidence(plainKitchen, { workbook: { aiPlanTakeoffJob: { aiAnalysis: { cabinetry: [{ room: 'Kitchen', description: 'Kitchen island', basis: 'OBSERVED', confidence: 0.9 }] } } } }), 'AI Plan Takeoff: island cabinetry');
assert.equal(islandEvidence(plainKitchen, { workbook: { aiPlanTakeoffJob: { aiAnalysis: { cabinetry: [{ room: 'Kitchen', description: 'Kitchen island', basis: 'ASSUMED' }] } } } }), '', 'an assumed takeoff item is not evidence');
assert.equal(islandEvidence({ ...islandKitchen, location: 'Ensuite' }), '', 'a vanity room has no island');
// A cabinet with no recorded width is reported, and the length is then asked for - never assumed.
const legacy = [{ location: 'Kitchen', unitType: 'Sink cupboard', quantity: 1 }, { location: 'Kitchen', unitType: 'Corner unit', quantity: 1 }];
assert.deepEqual(benchRunFromSchedule(legacy, 'Kitchen').unknown, ['Sink base cabinet', 'Corner base cabinet']);
assert.deepEqual(benchtopAreasFor(islandKitchen, { scheduleLines: legacy }).map(area => [area.label, area.lengthMm]), [['Main benchtop', ''], ['Island benchtop', '']], 'both areas exist; both lengths are required');
assert.deepEqual([benchtopDepthsForRoom('Kitchen'), benchtopDepthsForRoom('Laundry'), benchtopDepthsForRoom('Ensuite')], [[600, 900, 1200], [600, 900], [600]]);
assert.deepEqual(benchtopProfile({ location: 'Laundry' }).cutouts, ['Sink', 'Tap', 'Other'], 'a laundry bench has no cooktop cut-out');
pass('the main run and the island come from the project; no island without evidence; no length is invented');

// ---- 3. The client's workflow: setup -> areas -> surface ------------------------------------------
assert.equal(benchtopNextStep(setup, areas), 'setup', 'setup comes before any surface');
setup = { ...setup, edgeProfile: 'Square arris', waterfallEnds: 'None', upstand: '100mm', cutouts: ['Sink', 'Cooktop'], confirmedAt: '2026-10-06T00:00:00.000Z' };
assert.equal(benchtopNextStep(setup, areas), 'areas');
areas = areas.map(area => ({ ...area, lengthMm: area.id === ISLAND_AREA_ID ? 3200 : 4800 }));
assert.equal(benchtopQuantitySummary(areas).totalLm, 8);
assert.equal(benchtopNextStep(setup, areas), 'surfaces');
let ranges = { mapping, classifications: {} };
const surface = stoneSurfaceForArea(eclipse, { room: 'Kitchen', area: areas[0], setup, ranges });
assert.deepEqual([surface.supplier, surface.colourName, surface.collection, surface.rangeKey, surface.rangeSource, surface.supplierPriceGroup, surface.classificationKey, surface.edgeProfile, surface.waterfallEnds, surface.upstand, surface.cutouts, surface.applications],
  ['Stone Ambassador', 'Eclipse', eclipse.collection, 'mid_range_stone', 'supplier-price-group', '', 'stone-ambassador|collection-kaya-surfaces', 'Square arris', 'None', '100 mm', ['Sink', 'Cooktop'], ['Main benchtop']]);
assert.deepEqual([stoneSurfaceForArea(prestige, { area: areas[0], setup, ranges }).supplierPriceGroup, stoneSurfaceForArea(prestige, { area: areas[0], setup, ranges }).rangeKey], ['Prestige', 'mid_range_stone'], "the supplier's own price group and the GR8 range are both stored");
// Fabrication detail is not asked of the client; it is held as needing supplier confirmation.
assert.deepEqual([surface.supplierConfirmationStatus, surface.templateRequired, surface.supplierQuoteRequired, surface.physicalSampleConfirmed, surface.fullSlabViewed, surface.approximateAreaSqm, surface.dimensions], ['required', true, true, false, false, '', '']);
areas = areas.map(area => ({ ...area, surface: stoneSurfaceForArea(eclipse, { room: 'Kitchen', area, setup, ranges }) }));
assert.equal(benchtopNextStep(setup, areas), 'configured');
pass('setup, then areas (8.00 lm), then the surface; Eclipse inherits Mid Range Stone without being asked');

// ---- Saved on the cabinetry location and through a reload ----------------------------------------
const selectionWith = (kitchenAreas, useRanges = ranges, location = islandKitchen) => normaliseCabinetrySelection(JSON.parse(JSON.stringify({ locations: [{ ...location, ...benchtopLocationPatch({ location, setup, areas: kitchenAreas, ranges: useRanges }) }] })));
let selection = selectionWith(areas);
const saved = selection.locations.find(location => location.location === 'Kitchen');
assert.deepEqual(saved.benchtopAreas.map(area => [area.label, area.lengthMm, area.surface.colourName, area.surface.rangeKey]), [['Main benchtop', 4800, 'Eclipse', 'mid_range_stone'], ['Island benchtop', 3200, 'Eclipse', 'mid_range_stone']]);
assert.deepEqual([saved.benchtopSetup.upstand, saved.benchtopSetup.cutouts, saved.benchtop.colourName], ['100mm', ['Sink', 'Cooktop'], 'Eclipse']);
assert(!cabinetryLocationMissingRequirements(saved).some(item => item.key === 'benchtop'), 'the benchtop stage is complete');
assert.deepEqual(benchtopAreasFor(saved).map(area => area.lengthMm), [4800, 3200], 'the saved areas are what the screen reopens with');
// An island the user removed is not listed again, although the scope still shows the bench back.
const removed = { ...saved, benchtopSetup: { ...saved.benchtopSetup, islandRemoved: true }, benchtopAreas: saved.benchtopAreas.slice(0, 1) };
assert.deepEqual(benchtopAreasFor(removed).map(area => area.label), ['Main benchtop']);
assert.deepEqual(benchtopAreasFor({ ...saved, benchtopAreas: saved.benchtopAreas.slice(0, 1) }).map(area => area.label), ['Main benchtop', 'Island benchtop'], 'a job saved before island detection gains the island area');
pass('the setup, areas and surfaces persist with the cabinetry selection');

// ---- 4. Quotation Builder --------------------------------------------------------------------------
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const quote = (chosen, previous = base) => apply({ ...previous, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: chosen } }] }] } }, owner);
const rowFor = (workbook, type, rangeKey, group = 'kitchen') => workbook.quotation.CABINETRY.rows.find(row => row.importKey === cabinetryCatalogueRow(group, type, rangeKey).importKey);
const qty = (workbook, type, rangeKey, group) => { const value = rowFor(workbook, type, rangeKey, group).quantity; return value === '' || value == null ? null : Number(value); };
const benchQuantity = workbook => workbook.quotation.CABINETRY.rows.filter(row => / wide - LM$/.test(row.item || row.description || '')).reduce((total, row) => total + (Number(row.quantity) || 0), 0);
let quoted = quote(selection);
assert.deepEqual([qty(quoted, 'benchtop_600', 'mid_range_stone'), qty(quoted, 'benchtop_900', 'mid_range_stone'), qty(quoted, 'benchtop_600', 'high_end_stone')], [4.8, 3.2, null], 'Main 4.80 lm and Island 3.20 lm on Mid Range Stone');
assert.deepEqual([qty(quoted, 'benchtop_sink_cutout'), qty(quoted, 'benchtop_cooktop_cutout'), qty(quoted, 'benchtop_tap_hole'), qty(quoted, 'benchtop_upstand'), qty(quoted, 'benchtop_waterfall_standard')], [1, 1, null, 4.8, null], 'cut-outs and the 100mm upstand follow the setup; the island has no upstand');
assert(/Kitchen/.test(rowFor(quoted, 'benchtop_600', 'mid_range_stone').selectionSpec) && /Stone Ambassador Eclipse/.test(rowFor(quoted, 'benchtop_600', 'mid_range_stone').selectionSpec));
pass('Kitchen 8.00 lm reaches the Mid Range Stone rows, with cut-outs and upstand');

// The builder re-maps the supplier group to High End Stone: saved benchtops follow, the quantity MOVES.
mapping = saveBuilderBenchtopRangeMapping(owner, { [benchtopPriceGroupKey(eclipse)]: 'high_end_stone' }, { catalogue: STONE_BENCHTOP_CATALOGUE });
ranges = { mapping, classifications: {} };
assert.equal(surfaceWithSetup(saved.benchtopAreas[0].surface, { area: saved.benchtopAreas[0], setup, ranges }).rangeKey, 'high_end_stone');
selection = selectionWith(saved.benchtopAreas, ranges);
quoted = quote(selection, quoted);
assert.deepEqual([qty(quoted, 'benchtop_600', 'mid_range_stone'), qty(quoted, 'benchtop_900', 'mid_range_stone'), qty(quoted, 'benchtop_600', 'high_end_stone'), qty(quoted, 'benchtop_900', 'high_end_stone')], [null, null, 4.8, 3.2]);
assert.equal(benchQuantity(quoted), 8, 'no duplicate quantity anywhere in the benchtop ranges');
pass('changing a group mapping moves the Kitchen quantity from Mid Range Stone to High End Stone');

// Main benchtop = Eclipse (High End), Island = a Prestige product (Mid Range): independent.
const mixed = areas.map(area => ({ ...area, surface: stoneSurfaceForArea(area.id === ISLAND_AREA_ID ? prestige : eclipse, { room: 'Kitchen', area, setup, ranges }) }));
selection = selectionWith(mixed);
assert.deepEqual(selection.locations[0].benchtopAreas.map(area => `${area.label}: ${area.surface.colourName} / ${area.surface.rangeKey}`), ['Main benchtop: Eclipse / high_end_stone', `Island benchtop: ${prestige.colourName} / mid_range_stone`]);
quoted = quote(selection, quoted);
assert.deepEqual([qty(quoted, 'benchtop_600', 'high_end_stone'), qty(quoted, 'benchtop_900', 'high_end_stone'), qty(quoted, 'benchtop_900', 'mid_range_stone'), qty(quoted, 'benchtop_600', 'mid_range_stone')], [4.8, null, 3.2, null]);
assert.equal(benchQuantity(quoted), 8);
assert.deepEqual(quote(selection, quoted).quotation, quoted.quotation, 'syncing again changes nothing');
// A deliberate override on one benchtop wins over the group mapping.
const overridden = mixed.map(area => (area.id === ISLAND_AREA_ID ? { ...area, surface: { ...area.surface, rangeOverrideKey: 'base_range_stone' } } : area));
const overriddenSelection = selectionWith(overridden);
assert.deepEqual([overriddenSelection.locations[0].benchtopAreas[1].surface.rangeKey, overriddenSelection.locations[0].benchtopAreas[1].surface.rangeSource, overriddenSelection.locations[0].benchtopAreas[1].surface.supplierPriceGroup], ['base_range_stone', 'override', 'Prestige']);
assert.equal(qty(quote(overriddenSelection, quoted), 'benchtop_900', 'base_range_stone'), 3.2);
pass('main bench and island hold different surfaces on their own ranges; a deliberate override is honoured');

// A surface from an unmapped group is flagged for the builder, never priced on a guessed range.
const unclassified = areas.map(area => ({ ...area, surface: stoneSurfaceForArea(signature, { room: 'Kitchen', area, setup, ranges }) }));
const pending = quote(selectionWith(unclassified));
assert.equal(benchQuantity(pending), 0);
assert(pending.cabinetryReconciliation.entries.some(entry => entry.flag === CABINETRY_SELECTION_REQUIRED && new RegExp(`Stone Ambassador ${signature.colourName} has no quotation range set`).test(entry.reason)));
assert.equal(benchQuantity(quote(normaliseCabinetrySelection({ locations: [{ location: 'Kitchen' }, { location: 'Laundry' }] }))), 0, 'rooms without benchtop areas create nothing');
pass('an unmapped surface is flagged, and rooms without benchtop areas create nothing');

// ---- 5. Bathroom vanity benchtops ------------------------------------------------------------------
const ensuite = { location: 'Ensuite', bathroomScopeKeys: ['wallMountedVanity', 'tallLinenCupboard'], bathroomBenchtops: { wallMountedVanity: { targetKey: 'wallMountedVanity', materialChoice: 'Stone with mitred drop front', dropFrontDetail: 'Mitred drop front required' } } };
const vanitySchedule = [{ location: 'Ensuite', cabinetTypeId: 'vanity_wallhung_3drawer_1200', quantity: 1 }, { location: 'Ensuite', cabinetTypeId: 'tall_linen_600', quantity: 1 }];
const profile = benchtopProfile(ensuite);
assert.deepEqual([profile.variant, profile.cutouts, profile.cutoutLabels.Sink, profile.waterfall, profile.canAddAreas, profile.fixedAreas.map(area => area.label)], ['vanity', ['Sink', 'Tap'], 'Basin', false, false, ['Wall-mounted vanity benchtop']]);
assert(!profile.cutouts.includes('Cooktop') && !profile.edgeProfiles.includes('Shark nose') && profile.edgeProfiles.includes('Mitred drop front'), 'no kitchen-only options on a vanity');
let vanitySetup = benchtopSetupFor(ensuite, { scheduleLines: vanitySchedule, project: { hasBasin: true } });
assert.deepEqual([vanitySetup.edgeProfile, vanitySetup.waterfallEnds, vanitySetup.cutouts], ['Mitred drop front', 'None', ['Sink', 'Tap']], 'the earlier drop-front choice and the selected basin carry in');
assert.deepEqual(benchtopSetupFor(ensuite, { scheduleLines: vanitySchedule }).cutouts, [], 'no basin selected yet: nothing is pre-ticked');
let vanityAreas = benchtopAreasFor(ensuite, { scheduleLines: vanitySchedule });
assert.deepEqual(vanityAreas.map(area => [area.id, area.label, area.lengthMm, area.depthMm, area.source, area.surface]), [['wallMountedVanity', 'Wall-mounted vanity benchtop', 1200, 600, 'cabinetry', null]], 'one area per vanity, its length from the vanity cabinet');
assert.deepEqual(benchtopAreasFor({ location: 'Powder Room', bathroomScopeKeys: ['wallMountedVanity', 'floorMountedVanity'] }, { scheduleLines: [{ location: 'Powder Room', unitType: 'bath-wall-two-door', quantity: 1 }] }).map(area => [area.label, area.lengthMm]),
  [['Floor-mounted vanity benchtop', ''], ['Wall-mounted vanity benchtop', '']], 'separate vanity tops; a vanity with no recorded width needs its length');
assert.deepEqual(benchtopAreasFor({ location: 'Bathroom', bathroomScopeKeys: ['tallLinenCupboard'] }), [], 'a wet room with no vanity has no vanity benchtop');
vanitySetup = { ...vanitySetup, upstand: '100mm', confirmedAt: '2026-10-06T00:00:00.000Z' };
vanityAreas = vanityAreas.map(area => ({ ...area, surface: stoneSurfaceForArea(prestige, { room: 'Ensuite', area, setup: vanitySetup, ranges }) }));
const vanityPatch = benchtopLocationPatch({ location: ensuite, setup: vanitySetup, areas: vanityAreas, ranges });
assert.deepEqual([vanityPatch.bathroomBenchtops.wallMountedVanity.colourName, vanityPatch.bathroomBenchtops.wallMountedVanity.targetLabel, vanityPatch.bathroomBenchtops.wallMountedVanity.edgeProfile, vanityPatch.bathroomBenchtops.wallMountedVanity.waterfallEnds, vanityPatch.bathroomBenchtops.wallMountedVanity.rangeKey],
  [prestige.colourName, 'Wall-mounted vanity benchtop', 'Mitred drop front', 'None', 'mid_range_stone']);
const vanitySelection = normaliseCabinetrySelection(JSON.parse(JSON.stringify({ locations: [{ ...ensuite, ...vanityPatch }] })));
const savedEnsuite = vanitySelection.locations[0];
assert(!cabinetryLocationMissingRequirements(savedEnsuite).some(item => /^benchtop/.test(item.key)), 'the vanity benchtop stage is complete');
assert.deepEqual(benchtopAreasFor(savedEnsuite).map(area => [area.label, area.lengthMm, area.surface.colourName]), [['Wall-mounted vanity benchtop', 1200, prestige.colourName]], 'retained through save / reload');
const vanityQuote = quote(vanitySelection);
assert.deepEqual([qty(vanityQuote, 'benchtop_600', 'mid_range_stone', 'bathroom'), qty(vanityQuote, 'benchtop_sink_cutout', null, 'bathroom'), qty(vanityQuote, 'benchtop_tap_hole', null, 'bathroom'), qty(vanityQuote, 'benchtop_upstand', null, 'bathroom')], [1.2, 1, 1, 1.2], 'vanity top 1.20 lm with basin cut-out, tap hole and upstand');
assert.equal(qty(vanityQuote, 'benchtop_600', 'mid_range_stone'), null, 'nothing lands on the Kitchen rows');
pass('vanity benchtops: setup first, vanity-only options, one area per vanity, quoted on the bathroom rows');

// ---- The current project (recovered copy of the live job), when it is on this machine -----------
const jobCopy = 'recovery/quotation-changes-2026-10-03/browser-1-01-1f7.json';
if (fs.existsSync(jobCopy)) {
  const raw = JSON.parse(fs.readFileSync(jobCopy, 'utf8'));
  const job = raw.workbook || raw;
  const cabinetry = normaliseCabinetrySelection(job.clientSelectionsBook.rooms.flatMap(room => room.rows || []).find(row => row.guidedSelection?.cabinetrySelection).guidedSelection.cabinetrySelection);
  console.log(`\nCurrent project "${job.jobName || job.projectName}" - benchtop areas the project gives each cabinetry room:`);
  for (const location of cabinetry.locations) {
    const lines = cabinetry.schedule.filter(line => line.location === location.location);
    const found = benchtopAreasFor(location, { scheduleLines: lines, workbook: job });
    console.log(`  ${location.location.padEnd(16)} ${found.map(area => `${area.label} (${area.lengthMm ? `${area.lengthMm} mm` : 'length required'}${area.evidence ? `; ${area.evidence}` : ''})`).join(' + ') || 'no benchtop'}`);
  }
  const jobKitchen = cabinetry.locations.find(location => location.location === 'Kitchen');
  const jobAreas = benchtopAreasFor(jobKitchen, { scheduleLines: cabinetry.schedule.filter(line => line.location === 'Kitchen'), workbook: job });
  assert.deepEqual(jobAreas.map(area => [area.label, area.lengthMm]), [['Main benchtop', ''], ['Island benchtop', '']], 'the Kitchen has an island (Island bench back is in its cabinetry scope); neither length is invented');
  pass('current project: Kitchen island detected from the cabinetry scope');
} else console.log('SKIP current-project check (recovered job copy not on this machine)');
assert.equal(BENCHTOP_RANGES.length, 12);

console.log('\nBenchtop selection: all checks passed');
