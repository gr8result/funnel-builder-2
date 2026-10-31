import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applySelectionQuoteUpdates, applyInclusionScheduleToQuote, applySelectionProduct, selectionVariation } from '../lib/builders/selectionQuoteEngine.js';
import { connectTilingSelectionsToQuotation, newTilingRoom, tilingSelectionPatch } from '../lib/builders/tilingRooms.js';
import { connectTenantSelectionMetadata } from '../lib/builders/tenantSelectionQuotation.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { readJob, writeJob } from '../lib/jobFile.ts';
import { hydrateBuilderCatalogue } from '../lib/product-library/catalogueService.js';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://offline.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'offline';
const { __quotationPersistenceTestUtils: persistence } = await import('../hooks/estimate-builder/useEstimateBuilderWorkbook.js');

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const privateProductId = '44444444-4444-4444-8444-444444444444';
const privateProduct = {
  id: privateProductId, workspace_id: A, product_name: 'Builder Private Floor Tile', sku: 'PRIVATE-TILE-1', unit: 'BOX',
  upgrade_cost: 132, base_allowance: 80, active: true,
  metadata: { productEntity: { productCode: 'PRIVATE-TILE-1', productName: 'Builder Private Floor Tile', familyKey: 'floor-tiles', category: 'Flooring', clientPrice: 132, builderCost: 80, priceUnit: 'BOX', gstIncluded: true, priceStatus: 'current', enabled: true } },
};
hydrateBuilderCatalogue(A, { products: [privateProduct] });
const privateLookup = persistence.productByIdForWorkbook({ workspaceId: A });
assert.equal(privateLookup(privateProductId)?.productId, privateProductId, 'schedule resolver sees a private product from its effective workspace catalogue');
assert.equal(persistence.productByIdForWorkbook({ workspaceId: B })(privateProductId), null, 'schedule resolver never returns another workspace private product');
const privateTileRoom = { ...newTilingRoom({ type: 'laundry', name: 'Laundry', id: 'private-tile-room' }), geometry: { mode: 'custom', floorAreaM2: 3 }, products: { floor: privateProductId } };
const privateTileSelection = tilingSelectionPatch({ requirementKey: 'tiling-rooms', label: 'Tiling', areaKey: 'tiles', defaultAllowance: 0 }, [privateTileRoom], { productById: privateLookup }).guidedSelection;
const privateTileBook = { rooms: [{ id: 'laundry', name: 'Laundry', rows: [{ id: 'private-tile-selection', guidedSelection: privateTileSelection }] }] };
const privateTileWorkbook = connectTilingSelectionsToQuotation({ jobId: 'private-tile-job', workspaceId: A, templateKey: 'private-tile-template', quotation: {}, procurement: { items: [] }, clientSelectionsBook: privateTileBook }, privateTileBook, { productById: privateLookup });
const privateTileRow = Object.values(privateTileWorkbook.quotation).flatMap(section => section.rows || []).find(row => row.id === 'tiling:private-tile-room:floor');
assert(privateTileRow, 'a builder-private schedule product resolves to a quotation row');
assert.equal(privateTileRow.excelRate, 120, 'inclusive private product rate is converted to ex GST once');
assert.equal(privateTileRow.productLibrarySnapshot.clientPrice, 132);
const repricedPrivateTile = { ...privateProduct, upgrade_cost: 165, metadata: { ...privateProduct.metadata, productEntity: { ...privateProduct.metadata.productEntity, clientPrice: 165 } } };
hydrateBuilderCatalogue(A, { products: [repricedPrivateTile] });
const reloadedPrivateTileWorkbook = connectTilingSelectionsToQuotation(
  JSON.parse(JSON.stringify(privateTileWorkbook)),
  JSON.parse(JSON.stringify(privateTileBook)),
  { productById: persistence.productByIdForWorkbook({ workspaceId: A }) },
);
const reloadedPrivateTileRow = Object.values(reloadedPrivateTileWorkbook.quotation).flatMap(section => section.rows || []).find(row => row.id === 'tiling:private-tile-room:floor');
assert.equal(reloadedPrivateTileRow.excelRate, 120, 'reopen does not silently reprice a saved private-product selection');
assert.equal(reloadedPrivateTileRow.productLibrarySnapshot.clientPrice, 132);
const slots = ['kitchen_sink', 'kitchen_mixer', 'toilet_suite', 'basin_mixer', 'shower_screen', 'floor_tile', 'wall_tile', 'cooktop', 'internal_door_handle', 'mirror', 'oven'];
const foundation = { workspace_id: A, configurations: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, enabled: true, allow_apply_to_all: true, allow_room_override: true })), aliases: [], mappings: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, template_id: 'test', status: 'MAPPED', quote_section_id: 'fixtures', quote_row_id: slot })) };
const original = { ...createEstimateBuilderWorkbookDefaults(), workspaceId: A, templateKey: 'test', jobId: '33333333-3333-4333-8333-333333333333', quotation: {
  Fixtures: { id: 'fixtures', rows: slots.map((slot, i) => ({ id: slot, item: slot, quantity: '3', quantityFormula: '', quantityKey: '', unit: 'EACH', excelRate: 420, manualRate: '', formulas: { custom: 'preserve' }, active: true, sortOrder: i })) },
  Untouched: { id: 'other', rows: [{ id: 'labour', item: 'Labour', quantity: 7, excelRate: 33 }] },
} };
const snapshot = { schedule: { id: 'schedule-a', workspace_id: A, name: 'Included', version: 1 }, items: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, default_product_id: `baseline-${slot}`, allowance: { unitPrice: 420 } })) };
const baseline = applyInclusionScheduleToQuote(original, snapshot, foundation);
const namedFoundation = { ...foundation, mappings: foundation.mappings.map((mapping) => ({ ...mapping, quote_section_id: 'Fixtures' })) };
const namedFoundationBefore = JSON.stringify(namedFoundation);
const boundFoundation = persistence.bindSelectionFoundationToQuotation(original, namedFoundation);
assert.deepEqual(applyInclusionScheduleToQuote(original, snapshot, boundFoundation).quotation, baseline.quotation, 'exact section-name mappings bind to persisted IDs without guessed targets');
assert.equal(JSON.stringify(namedFoundation), namedFoundationBefore, 'shared mapping records are not mutated');
const rowOf = (workbook, slot) => workbook.quotation.Fixtures.rows.find(row => row.id === slot);
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'selection-quote-engine-'));
let checks = 0;
async function check(label, fn) { await fn(); console.log('PASS', label); checks++; }
try {
  for (const slot of slots) await check(slot, async () => {
    const book = { workspace_id: A, rooms: [{ id: 'bathroom', rows: [{ guidedSelection: { selectionSlotId: slot, productId: `selected-${slot}`, selectedPrice: 610, priceIncludesGst: false } }] }] };
    const next = connectTenantSelectionMetadata(baseline, book, foundation);
    const repeated = connectTenantSelectionMetadata(next, book, foundation);
    assert.deepEqual(repeated.quotation, next.quotation, `${slot}: replayed confirmation is exactly-once`);
    assert.deepEqual(repeated.jobInclusionSnapshot, next.jobInclusionSnapshot);
    const reapplied = applyInclusionScheduleToQuote(repeated, snapshot, foundation);
    assert.deepEqual(reapplied.quotation, next.quotation, `${slot}: baseline replay cannot reprice the selected item`);
    const row = rowOf(next, slot), before = rowOf(baseline, slot);
    assert.equal(row.activeProductId, `selected-${slot}`); assert.equal(row.activeUnitPrice, 610);
    assert.equal(row.baselineProductId, `baseline-${slot}`); assert.equal(row.baselineUnitPrice, 420);
    assert.equal(row.selectionSource, 'CLIENT_SELECTION'); assert.equal(row.selectionStatus, 'UPGRADE');
    assert.equal(row.variationUnitDifference, 190); assert.equal(row.variationTotal, 570);
    for (const key of ['quantity', 'quantityFormula', 'quantityKey', 'formulas', 'sortOrder']) assert.deepEqual(row[key], before[key]);
    assert.deepEqual(next.jobInclusionSnapshot, baseline.jobInclusionSnapshot);
    assert.deepEqual(Object.keys(next.quotation), Object.keys(baseline.quotation));
    assert.deepEqual(next.quotation.Fixtures.rows.map(row => row.id), slots);
    assert.strictEqual(next.quotation.Untouched, baseline.quotation.Untouched);
    for (const other of slots.filter(other => other !== slot)) assert.deepEqual(rowOf(next, other), rowOf(baseline, other));
    const calculated = calculateEstimateBuilderWorkbook(next);
    const priced = rowOf(calculated, slot);
    assert.equal(priced.finalRateUsed, 610); assert.equal(priced.qty, 3); assert.equal(priced.cost, 1830); assert.equal(priced.variationTotal, 570);
    const file = path.join(folder, `${slot}.json`);
    await fs.writeFile(file, JSON.stringify(next));
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), next);
    const normalizedQuotation = persistence.normalizeWorkbook(JSON.parse(await fs.readFile(file, 'utf8'))).quotation;
    assert.deepEqual(normalizedQuotation, persistence.withPersistedQuotationOrder(next).quotation);
    let bytes;
    const handle = { name: `${slot}.gr8job`, getFile: async () => new File(bytes ? [bytes] : [], `${slot}.gr8job`), createWritable: async () => ({ write: async blob => { bytes = await blob.arrayBuffer(); }, close: async () => {} }) };
    assert.equal((await writeJob(handle, { jobId: next.jobId, jobName: 'Selection quote test', workbook: next })).ok, true);
    const restored = await readJob(handle);
    assert.deepEqual(restored.workbook.quotation, next.quotation);
    assert.deepEqual(restored.workbook.jobInclusionSnapshot, next.jobInclusionSnapshot);
  });
  await check('client survives schedule refresh; manual override wins; downgrades and zero quantity', () => {
    const row = rowOf(baseline, 'toilet_suite');
    const client = applySelectionProduct(row, { productId: 'client', unitPrice: 610 });
    const refreshed = applySelectionProduct(client, { source: 'INCLUSION_SCHEDULE', productId: 'new-baseline', unitPrice: 999 });
    assert.deepEqual(refreshed, client);
    const manual = applySelectionProduct(client, { source: 'MANUAL_OVERRIDE', productId: 'manual', unitPrice: 500 });
    assert.deepEqual(applySelectionProduct(manual, { productId: 'later-client', unitPrice: 700 }), manual);
    const downgrade = applySelectionProduct(row, { productId: 'cheaper', unitPrice: 300 });
    assert.equal(downgrade.variationTotal, -360); assert.equal(downgrade.selectionStatus, 'DOWNGRADE');
    assert.equal(selectionVariation(downgrade, 0).variationTotal, 0);
    for (const status of ['CLIENT_SUPPLIED', 'NOT_REQUIRED']) {
      const changed = applySelectionProduct(row, { status }); assert.equal(changed.activeUnitPrice, 0); assert.equal(changed.quantity, '3'); assert.equal(changed.variationTotal, -1260); assert.equal(changed.selectionStatus, status);
    }
    assert.equal(applySelectionProduct(row, { productId: 'same', unitPrice: 420 }).selectionStatus, 'SELECTED');
    const unpriced = applySelectionProduct(row, { productId: 'pending', unitPrice: null });
    assert.equal(unpriced.selectionStatus, 'SELECTED');
    assert.equal(unpriced.selectionPricePending, true);
    assert.equal(unpriced.variationTotal, null);
    assert.equal(applySelectionProduct(row, { productId: null, unitPrice: null }).selectionStatus, 'AWAITING_SELECTION');
  });
  await check('GST-inclusive Product Library selection is converted once at quote boundary', () => {
    const book = { workspace_id: A, rooms: [{ id: 'kitchen', rows: [{ guidedSelection: { selectionSlotId: 'oven', productId: 'selected-oven', productName: 'Selected oven', selectedPrice: 1100, priceIncludesGst: true } }] }] };
    const next = connectTenantSelectionMetadata(baseline, book, foundation);
    const row = rowOf(next, 'oven');
    assert.equal(row.activeUnitPrice, 1000, 'quote rate is ex GST');
    assert.equal(row.variationUnitDifference, 580, 'variation compares ex-GST prices against the ex-GST inclusion baseline');
    const calculated = calculateEstimateBuilderWorkbook(next);
    assert.equal(rowOf(calculated, 'oven').finalRateUsed, 1000);
    assert.equal(rowOf(calculated, 'oven').cost, 3000);
    const manual = applySelectionQuoteUpdates(baseline, [{ selectionSlotId: 'oven', productId: 'manual-oven', unitPrice: 1100, priceIncludesGst: true, source: 'MANUAL_OVERRIDE' }], foundation);
    assert.equal(rowOf(manual, 'oven').activeUnitPrice, 1100, 'manual quote rates are not converted');
    const unknown = connectTenantSelectionMetadata(baseline, { workspace_id: A, rooms: [{ id: 'kitchen', rows: [{ guidedSelection: { selectionSlotId: 'oven', productId: 'selected-oven-unknown-basis', selectedPrice: 1100 } }] }] }, foundation);
    assert.equal(rowOf(unknown, 'oven').activeUnitPrice, null, 'unknown GST basis blocks the quote price rather than assuming ex GST');
    assert.equal(rowOf(unknown, 'oven').selectionPricePending, true);
  });
  await check('apply all bathrooms then ensuite override survives subsequent scheme refresh', () => {
    const rooms = ['main-bathroom', 'ensuite', 'powder-room'];
    const workbook = { ...baseline, jobInclusionSnapshot: null, quotation: { Fixtures: { id: 'fixtures', rows: rooms.map(locationId => ({ ...rowOf(baseline, 'wall_tile'), id: locationId, selectionSlotId: 'wall_tile', locationId })) } } };
    const scheme = { selectionSlotId: 'wall_tile', applyToAll: true, productId: 'Tile A', unitPrice: 450 };
    const all = applySelectionQuoteUpdates(workbook, [scheme], foundation);
    const overridden = applySelectionQuoteUpdates(all, [{ selectionSlotId: 'wall_tile', locationId: 'ensuite', roomOverride: true, productId: 'Tile B', unitPrice: 600 }], foundation);
    const refreshed = applySelectionQuoteUpdates(overridden, [{ ...scheme, productId: 'Tile C' }], foundation);
    assert.deepEqual(refreshed.quotation.Fixtures.rows.map(row => row.activeProductId), ['Tile C', 'Tile B', 'Tile C']);
    assert.deepEqual(overridden.quotation.Fixtures.rows.map(row => row.activeProductId), ['Tile A', 'Tile B', 'Tile A']);
    assert(overridden.quotation.Fixtures.rows.every(row => row.quantity === '3' && row.baselineUnitPrice === 420));
    assert.deepEqual(JSON.parse(JSON.stringify(overridden)), overridden);
    const combined = applySelectionQuoteUpdates(workbook, [{ selectionSlotId: 'wall_tile', locationId: 'ensuite', productId: 'Tile B', unitPrice: 600 }, scheme], foundation);
    assert.deepEqual(combined.quotation.Fixtures.rows.map(row => row.activeProductId), ['Tile A', 'Tile B', 'Tile A']);
  });
  await check('tenant isolation, unknown locations and ambiguous matches fail closed', () => {
    assert.throws(() => applySelectionQuoteUpdates({ ...baseline, workspaceId: B }, [], foundation), /workspace mismatch/);
    assert.throws(() => applySelectionQuoteUpdates(baseline, [{ workspace_id: B, selectionSlotId: 'mirror' }], foundation), /workspace mismatch/);
    assert.throws(() => connectTenantSelectionMetadata(baseline, { workspace_id: B }, foundation), /workspace mismatch/);
    const events = [{ selectionSlotId: 'mirror', productId: 'x', unitPrice: 50 }, { selectionSlotId: 'mirror', productId: 'y', unitPrice: 60 }];
    const conflicted = applySelectionQuoteUpdates(baseline, events, foundation);
    assert.deepEqual(conflicted.quotation, baseline.quotation); assert.equal(conflicted.selectionMappingReport[0].status, 'CONFLICT');
    const tagged = { ...baseline, quotation: { Fixtures: { id: 'fixtures', rows: [{ ...rowOf(baseline, 'mirror'), selectionSlotId: 'mirror', locationId: 'main' }] } } };
    const unknown = applySelectionQuoteUpdates(tagged, [{ ...events[0], locationId: 'foreign-room' }], foundation);
    assert.deepEqual(unknown.quotation, tagged.quotation); assert.equal(unknown.selectionMappingReport[0].status, 'UNMAPPED');
  });
  await check('saved tiling rooms and plumbing allocations target only their matching locations', () => {
    const workbook = { ...baseline, jobInclusionSnapshot: null, quotation: { Fixtures: { id: 'fixtures', rows: ['main', 'ensuite'].flatMap(locationId => ['floor_tile', 'wall_tile', 'basin_mixer'].map(slot => ({ ...rowOf(baseline, slot), id: `${slot}:${locationId}`, locationId, selectionSlotId: slot }))) } } };
    const book = { rooms: [{ id: 'group', rows: [{ guidedSelection: { tilingRooms: [{ id: 'main', products: { floor: 'Floor A', wall: 'Wall A' } }, { id: 'ensuite', products: { floor: 'Floor A', wall: 'Wall B' } }] } }, { guidedSelection: { selectionSlotId: 'basin_mixer', plumbingAllocation: { lines: [{ productId: 'Mixer', unitPrice: 610, priceIncludesGst: false, allocations: [{ locationKey: 'ensuite', quantity: 99 }] }] } } }] }] };
    const next = connectTenantSelectionMetadata(workbook, book, foundation, { productById: id => ({ productId: id, clientPrice: id === 'Wall B' ? 600 : 450, gstIncluded: false }) });
    const rows = next.quotation.Fixtures.rows;
    assert.equal(rows.find(row => row.id === 'wall_tile:main').activeProductId, 'Wall A');
    assert.equal(rows.find(row => row.id === 'wall_tile:ensuite').activeProductId, 'Wall B');
    assert.equal(rows.find(row => row.id === 'basin_mixer:main').activeProductId, 'baseline-basin_mixer');
    assert.equal(rows.find(row => row.id === 'basin_mixer:ensuite').activeProductId, 'Mixer');
    assert(rows.every(row => row.quantity === '3'));
  });
  await check('formula quantity remains authoritative and unpriced selections never reuse an old rate', () => {
    const source = { ...baseline, quotation: { Fixtures: { id: 'fixtures', rows: [{ ...rowOf(baseline, 'toilet_suite'), quantity: '', quantityFormula: '3', quantityFormulaOverride: true, formulas: { B: '3' } }] } } };
    const selected = applySelectionQuoteUpdates(source, [{ selectionSlotId: 'toilet_suite', productId: 'upgrade', unitPrice: 610 }], foundation);
    assert.equal(rowOf(selected, 'toilet_suite').quantityFormula, '3');
    const calculated = rowOf(calculateEstimateBuilderWorkbook(selected), 'toilet_suite');
    assert.equal(calculated.qty, 3); assert.equal(calculated.variationTotal, 570);
    const unpriced = applySelectionQuoteUpdates(source, [{ selectionSlotId: 'toilet_suite', productId: 'unpriced', unitPrice: null }], foundation);
    const pending = rowOf(calculateEstimateBuilderWorkbook(unpriced), 'toilet_suite');
    assert.equal(pending.finalRateUsed, ''); assert.equal(pending.variationTotal, null);
  });
  console.log(`Selection quote engine: ${checks} checks passed; ten categories include real .gr8job ZIP export/import and quote calculation.`);
} finally {
  if (path.dirname(path.resolve(folder)) !== path.resolve(os.tmpdir()) || !path.basename(folder).startsWith('selection-quote-engine-')) throw Error('Unexpected temporary test path.');
  await fs.rm(folder, { recursive: true, force: true });
}
