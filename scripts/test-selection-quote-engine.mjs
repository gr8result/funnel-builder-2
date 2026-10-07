import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applySelectionQuoteUpdates, applyInclusionScheduleToQuote, applySelectionProduct, selectionVariation } from '../lib/builders/selectionQuoteEngine.js';
import { connectTenantSelectionMetadata } from '../lib/builders/tenantSelectionQuotation.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { readJob, writeJob } from '../lib/jobFile.ts';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://offline.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'offline';
const { __quotationPersistenceTestUtils: persistence } = await import('../hooks/estimate-builder/useEstimateBuilderWorkbook.js');

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const slots = ['kitchen_sink', 'kitchen_mixer', 'toilet_suite', 'basin_mixer', 'shower_screen', 'floor_tile', 'wall_tile', 'cooktop', 'internal_door_handle', 'mirror'];
const foundation = { workspace_id: A, configurations: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, enabled: true, allow_apply_to_all: true, allow_room_override: true })), aliases: [], mappings: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, template_id: 'test', status: 'MAPPED', quote_section_id: 'fixtures', quote_row_id: slot })) };
const original = { ...createEstimateBuilderWorkbookDefaults(), workspaceId: A, templateKey: 'test', jobId: '33333333-3333-4333-8333-333333333333', quotation: {
  Fixtures: { id: 'fixtures', rows: slots.map((slot, i) => ({ id: slot, item: slot, quantity: '3', quantityFormula: '', quantityKey: '', unit: 'EACH', excelRate: 420, manualRate: '', formulas: { custom: 'preserve' }, active: true, sortOrder: i })) },
  Untouched: { id: 'other', rows: [{ id: 'labour', item: 'Labour', quantity: 7, excelRate: 33 }] },
} };
const snapshot = { schedule: { id: 'schedule-a', workspace_id: A, name: 'Included', version: 1 }, items: slots.map(slot => ({ workspace_id: A, selection_slot_id: slot, default_product_id: `baseline-${slot}`, allowance: { unitPrice: 420 } })) };
const baseline = applyInclusionScheduleToQuote(original, snapshot, foundation);
const rowOf = (workbook, slot) => workbook.quotation.Fixtures.rows.find(row => row.id === slot);
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'selection-quote-engine-'));
let checks = 0;
async function check(label, fn) { await fn(); console.log('PASS', label); checks++; }
try {
  for (const slot of slots) await check(slot, async () => {
    const book = { workspace_id: A, rooms: [{ id: 'bathroom', rows: [{ guidedSelection: { selectionSlotId: slot, productId: `selected-${slot}`, selectedPrice: 610 } }] }] };
    const next = connectTenantSelectionMetadata(baseline, book, foundation);
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
    assert.deepEqual(persistence.normalizeWorkbook(JSON.parse(await fs.readFile(file, 'utf8'))).quotation, next.quotation);
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
    assert.equal(applySelectionProduct(row, { productId: 'pending', unitPrice: null }).selectionStatus, 'AWAITING_SELECTION');
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
    const book = { rooms: [{ id: 'group', rows: [{ guidedSelection: { tilingRooms: [{ id: 'main', products: { floor: 'Floor A', wall: 'Wall A' } }, { id: 'ensuite', products: { floor: 'Floor A', wall: 'Wall B' } }] } }, { guidedSelection: { selectionSlotId: 'basin_mixer', plumbingAllocation: { lines: [{ productId: 'Mixer', unitPrice: 610, allocations: [{ locationKey: 'ensuite', quantity: 99 }] }] } } }] }] };
    const next = connectTenantSelectionMetadata(workbook, book, foundation, { productById: id => ({ productId: id, clientPrice: id === 'Wall B' ? 600 : 450 }) });
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
