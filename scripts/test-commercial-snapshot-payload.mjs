import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialSnapshotHasCompleteWorkbook, commercialSnapshotPayload } from '../lib/builders/commercialSnapshotPayload.js';

test('small commercial snapshots retain complete workbook and calculations', () => {
  const workbook = { jobId: 'job-a', quotation: { Windows: { rows: [{ id: 'w1', qty: 1, excelRate: 100 }] } }, projectEstimateBuilder: { pages: [] } };
  const calculated = { quotation: workbook.quotation, summary: { finalQuoteTotal: 110 }, quantities: { lowerFloorAreaM2: 4 }, debug: { value: true } };
  const result = commercialSnapshotPayload({ workspaceId: 'workspace-a', project: {}, workbook, calculated });
  assert.equal(result.completeWorkbookSnapshot, true);
  assert.deepEqual(result.omittedSections, []);
  assert.equal(result.body.workbook.projectEstimateBuilder, workbook.projectEstimateBuilder);
  assert.equal(result.body.calculated.debug.value, true);
});

test('oversized non-quotation modules are omitted while quote and selection evidence is preserved', () => {
  const workbook = {
    jobId: 'job-a', workspaceId: 'workspace-a',
    quotation: { Windows: { rows: [{ id: 'w1', qty: 1, excelRate: 100 }] } },
    clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { productId: 'product-a', quantity: 1 } }] }] },
    procurement: { items: [{ id: 'draft', quoteRequired: true, approvedForOrdering: false }] },
    projectEstimateBuilder: { plan: 'x'.repeat(18 * 1024 * 1024) },
    aiPlanTakeoffJob: { plan: 'y'.repeat(3 * 1024 * 1024) },
    takeoffEngine: { plan: 'z'.repeat(3 * 1024 * 1024) },
  };
  const calculated = { quotation: workbook.quotation, summary: { finalQuoteTotal: 110 }, quantities: { lowerFloorAreaM2: 4 }, ignoredDebug: 'not needed' };
  const result = commercialSnapshotPayload({ workspaceId: 'workspace-a', project: {}, workbook, calculated });
  assert.equal(result.completeWorkbookSnapshot, false);
  assert.deepEqual(result.omittedSections.sort(), ['aiPlanTakeoffJob', 'projectEstimateBuilder', 'takeoffEngine']);
  assert.equal(result.body.workbook.jobId, 'job-a');
  assert.deepEqual(result.body.workbook.quotation, workbook.quotation);
  assert.deepEqual(result.body.workbook.clientSelectionsBook, workbook.clientSelectionsBook);
  assert.deepEqual(result.body.workbook.procurement, workbook.procurement);
  assert.equal(result.body.workbook.projectEstimateBuilder, undefined);
  assert.equal(result.body.calculated.finalQuoteTotal, undefined);
  assert.deepEqual(result.body.calculated.quantities, calculated.quantities);
  assert.deepEqual(workbook.projectEstimateBuilder, { plan: 'x'.repeat(18 * 1024 * 1024) }, 'Original local workbook remains unchanged.');
});

test('large quotation payload is rejected rather than silently truncated', () => {
  const workbook = { jobId: 'job-a', quotation: { rows: 'x'.repeat(23 * 1024 * 1024) } };
  assert.throws(() => commercialSnapshotPayload({ workspaceId: 'workspace-a', project: {}, workbook, calculated: {} }), /more than 22 MB/);
});

test('legacy snapshots remain complete by default; compact quotation snapshots are explicitly partial', () => {
  assert.equal(commercialSnapshotHasCompleteWorkbook({ workbook_metadata: {} }), true);
  assert.equal(commercialSnapshotHasCompleteWorkbook({ workbook_metadata: { source_workbook_snapshot_complete: true } }), true);
  assert.equal(commercialSnapshotHasCompleteWorkbook({ workbook_metadata: { source_workbook_snapshot_complete: false } }), false);
});