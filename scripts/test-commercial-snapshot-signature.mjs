import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { assertCommercialProjectAssociation, withCommercialSnapshotAssociation } from '../lib/builders/commercialJobAssociation.js';
import { commercialSnapshotSignature } from '../lib/builders/commercialSnapshotSignature.js';

const input = {
  workspaceId: 'workspace-a',
  projectId: 'project-a',
  jobId: 'job-a',
  workbook: {
    registeredJobId: 'registered-a',
    quotation: { Windows: { rows: [{ id: 'window-1', quantity: 2, rate: 500 }] } },
    quotationSectionOrder: ['Windows'],
    clientSelectionsBook: { rooms: [{ name: 'Kitchen' }] },
    procurement: { items: [{ id: 'draft-1', quoteRequired: true, approvedForOrdering: false }] },
    jobInclusionSnapshot: null,
    summaryAdjustments: { gst: 10 },
    page: 'quotation',
    savedAt: '2026-10-16T01:00:00.000Z',
  },
  calculated: { quotation: { Windows: { rows: [{ id: 'window-1', quantity: 2, rate: 500 }] } }, summary: { finalQuoteTotal: 1100 } },
};

test('snapshot fingerprint is stable across object key order and storage-only metadata', () => {
  const reordered = structuredClone(input);
  reordered.workbook.quotation = { Windows: { rows: [{ rate: 500, quantity: 2, id: 'window-1' }] } };
  reordered.workbook.savedAt = '2026-10-16T02:00:00.000Z';
  reordered.workbook.page = 'procurement';
  reordered.calculated.quotation = { Windows: { rows: [{ rate: 500, quantity: 2, id: 'window-1' }] } };
  assert.equal(commercialSnapshotSignature(input), commercialSnapshotSignature(reordered));
});

test('snapshot fingerprint changes for tenant, project, job, quote, procurement or financial changes', () => {
  const baseline = commercialSnapshotSignature(input);
  for (const update of [
    { workspaceId: 'workspace-b' },
    { projectId: 'project-b' },
    { jobId: 'job-b' },
  ]) assert.notEqual(commercialSnapshotSignature({ ...input, ...update }), baseline);

  const quoteChanged = structuredClone(input);
  quoteChanged.workbook.quotation.Windows.rows[0].rate = 501;
  assert.notEqual(commercialSnapshotSignature(quoteChanged), baseline);

  const procurementChanged = structuredClone(input);
  procurementChanged.workbook.procurement.items[0].approvedForOrdering = true;
  assert.notEqual(commercialSnapshotSignature(procurementChanged), baseline);

  const totalChanged = structuredClone(input);
  totalChanged.calculated.summary.finalQuoteTotal = 1101;
  assert.notEqual(commercialSnapshotSignature(totalChanged), baseline);
});

test('snapshot fingerprint requires all three durable identities', () => {
  for (const field of ['workspaceId', 'projectId', 'jobId']) {
    assert.throws(() => commercialSnapshotSignature({ ...input, [field]: '' }), /workspace, commercial project and Estimate Builder job/);
  }
});

test('persisted association retains job data and records exact project and snapshot IDs', () => {
  const workbook = { jobId: 'job-a', workspaceId: 'workspace-a', quotation: { Windows: { rows: [] } }, clientSelectionsBook: { rooms: [] } };
  const linked = withCommercialSnapshotAssociation(workbook, {
    workspaceId: 'workspace-a', jobId: 'job-a', projectId: 'project-a', snapshotId: 'snapshot-a',
  });
  assert.deepEqual([linked.workspaceId, linked.commercialProjectId, linked.commercialSnapshotId], ['workspace-a', 'project-a', 'snapshot-a']);
  assert.deepEqual(linked.quotation, workbook.quotation);
  assert.deepEqual(linked.clientSelectionsBook, workbook.clientSelectionsBook);
  assert.equal(workbook.commercialProjectId, undefined, 'the input workbook remains immutable');
  assert.throws(() => withCommercialSnapshotAssociation(workbook, {
    workspaceId: 'workspace-a', jobId: 'different-job', projectId: 'project-a', snapshotId: 'snapshot-a',
  }), /active job changed/);
  assert.throws(() => withCommercialSnapshotAssociation(workbook, {
    workspaceId: 'workspace-b', jobId: 'job-a', projectId: 'project-a', snapshotId: 'snapshot-a',
  }), /different builder workspace/);
});

test('project association requires matching workspace and exact workbook or registered job identity', () => {
  const project = { id: 'project-a', workspace_id: 'workspace-a', source_workbook_job_id: 'job-a', source_registered_job_id: 'registered-a' };
  assert.equal(assertCommercialProjectAssociation(project, { workspaceId: 'workspace-a', jobId: 'job-a', registeredJobId: 'registered-a' }), project);
  assert.throws(() => assertCommercialProjectAssociation(project, { workspaceId: 'workspace-b', jobId: 'job-a', registeredJobId: 'registered-a' }), /different builder job/);
  assert.throws(() => assertCommercialProjectAssociation(project, { workspaceId: 'workspace-a', jobId: 'job-b', registeredJobId: 'registered-b' }), /different builder job/);
  const legacy = { id: 'legacy-project', workspace_id: 'workspace-a', source_workbook_job_id: null, source_registered_job_id: 'registered-a' };
  assert.equal(assertCommercialProjectAssociation(legacy, { workspaceId: 'workspace-a', jobId: 'job-a', registeredJobId: 'registered-a' }), legacy);
  assert.throws(() => assertCommercialProjectAssociation(legacy, { workspaceId: 'workspace-a', jobId: 'job-a', registeredJobId: 'registered-b' }), /different builder job/);
});

test('commercial snapshot sync records and reuses a complete matching current snapshot', () => {
  const api = fs.readFileSync(new URL('../pages/api/builders/sync-commercial-snapshot.js', import.meta.url), 'utf8');
  assert.match(api, /source_workbook_signature/);
  assert.match(api, /requestedProjectId: uuidOrNull/);
  assert.match(api, /matchingSnapshots\.length === 1/);
  assert.match(api, /countSnapshotRows/);
  assert.match(api, /expectedSnapshotCounts/);
  assert.match(api, /already_synced: true/);
  assert.match(api, /incomplete\. It was not duplicated/);
});