import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { commercialSnapshotPayload } from '../lib/builders/commercialSnapshotPayload.js';
import { refreshSelectionProcurementRequirements } from '../lib/builders/selectionProcurementRequirements.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Supabase URL and authenticated test credentials are required.');

const origin = process.env.QUOTATION_ACCEPTANCE_ORIGIN || 'http://localhost:3000';
const workspaceId = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const sourcePath = path.join(root, 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job');
const expectedSourceHash = '821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46';
const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
assert.equal(sourceHash, expectedSourceHash);

const runId = crypto.randomUUID();
const jobId = process.env.QUOTATION_ACCEPTANCE_JOB_ID || `gr8-quotation-api-acceptance-${runId}`;
const email = `quotation-api-acceptance-${runId}@example.test`;
const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = '';
let projectId = '';
let snapshotId = '';
const report = { jobId, workspaceId, sourceHash, protectedJobTouched: false, passed: false };

try {
  const user = await createWorkspaceUser();
  userId = user.id;
  const { data: auth, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError || !auth.session?.access_token) throw signInError || new Error('Test user sign-in failed.');

  const zip = await JSZip.loadAsync(sourceBytes);
  const sourceWorkbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
  assert.equal(sourceWorkbook.jobId, 'gr8-reconcile-test-47c50983a480');
  assert.equal(sourceWorkbook.workspaceId, workspaceId);
  const jobName = `TEST Quotation API Acceptance ${runId.slice(0, 8)}`;
  let workbook = {
    ...structuredClone(sourceWorkbook),
    id: jobId,
    jobId,
    workspaceId,
    projectId: jobId,
    commercialProjectId: '',
    commercialSnapshotId: '',
    registeredJobId: jobId,
    jobName,
    registeredJob: { ...(sourceWorkbook.registeredJob || {}), jobId, jobName, jobNumber: `QAT-${runId.slice(0, 8)}` },
    jobFileMeta: { ...(sourceWorkbook.jobFileMeta || {}), projectId: jobId, sourceProjectId: jobId, recoveredFromProtectedJob: false, jobName },
  };
  const beforeAudit = reconcileProductSelections({ workbook });
  assert.equal(beforeAudit.selected, 52);
  assert.equal(beforeAudit.procurementMissing.length, 27);
  const before = calculateEstimateBuilderWorkbook(structuredClone(workbook));
  const quoteTotal = before.summary.finalQuoteTotal;
  const existingIds = new Set((workbook.procurement?.items || []).map((item) => item.id));
  workbook = refreshSelectionProcurementRequirements(workbook, before);
  const afterAudit = reconcileProductSelections({ workbook });
  assert.deepEqual(
    afterAudit.procurementMissing.map((entry) => entry.key).sort(),
    [
      'architraves|master-INT-PORTA-200082|Interior',
      'door-hardware|master-INT-GAINSBOROUGH-105BAISC|Interior',
      'exterior-paint|exterior-colour-schedule|Exterior',
      'internal-doors|master-INT-CORINTHIAN-DOORS-PMDF-HONEYCOMB-PRIMED-NONE|Interior',
    ].sort(),
    'Unresolved target/procurement items remain explicit rather than being marked complete.',
  );
  assert.deepEqual(afterAudit.counts, beforeAudit.counts);
  const added = workbook.procurement.items.filter((item) => !existingIds.has(item.id));
  assert.equal(added.length, 23);
  const unresolvedSelectionDrafts = added.filter((item) => item.id?.startsWith('procurement:selection:'));
  assert.equal(unresolvedSelectionDrafts.length, 11);
  assert(unresolvedSelectionDrafts.every((item) => item.quoteRequired && item.costPending && item.approvedForOrdering === false && item.estimatedRate === null && item.estimatedTotal === null));
  const calculated = calculateEstimateBuilderWorkbook(structuredClone(workbook));
  assert.equal(calculated.summary.finalQuoteTotal, quoteTotal);
  const projectMetadata = { projectName: jobName, clientName: 'Isolated quotation acceptance', sourceWorkbookJobId: jobId, sourceRegisteredJobId: jobId };

  async function sync(commercialProjectId = null) {
    const snapshotPayload = commercialSnapshotPayload({ workspaceId, projectId: commercialProjectId, project: projectMetadata, workbook, calculated });
    const response = await fetch(`${origin}/api/builders/sync-commercial-snapshot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.session.access_token}`, 'x-workspace-id': workspaceId },
      body: JSON.stringify({ ...snapshotPayload.body, workbook_snapshot_complete: snapshotPayload.completeWorkbookSnapshot }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Commercial sync returned ${response.status}: ${body.error || 'unknown error'}`);
    return body;
  }

  const first = await sync();
  assert.equal(first.ok, true);
  assert([undefined, true].includes(first.already_synced), 'First sync may safely reuse the existing dedicated test snapshot on a retry.');
  assert.equal(first.workbook_snapshot_complete, false);
  assert.deepEqual([...first.workbook_snapshot_omitted_sections].sort(), ['aiPlanTakeoffJob', 'projectEstimateBuilder', 'takeoffEngine']);
  projectId = first.project_id;
  snapshotId = first.snapshot_id;
  assert(projectId && snapshotId);
  const firstRows = await verifyDatabaseRows(projectId, snapshotId);
  const repeated = await sync(projectId);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.already_synced, true);
  assert.equal(repeated.project_id, projectId);
  assert.equal(repeated.snapshot_id, snapshotId);
  assert.equal(repeated.workbook_snapshot_complete, false);
  assert.deepEqual([...repeated.workbook_snapshot_omitted_sections].sort(), [...first.workbook_snapshot_omitted_sections].sort());
  const repeatedRows = await verifyDatabaseRows(projectId, snapshotId);
  assert.deepEqual(repeatedRows, firstRows, 'Repeated sync must reuse one project/snapshot and preserve all row counts.');

  report.passed = true;
  report.projectId = projectId;
  report.snapshotId = snapshotId;
  report.quoteTotal = quoteTotal;
  report.firstSyncCounts = first.counts;
  report.repeatedSyncAlreadySynced = repeated.already_synced;
  report.database = firstRows;
  report.workbookSnapshotComplete = first.workbook_snapshot_complete;
  report.workbookSnapshotOmittedSections = first.workbook_snapshot_omitted_sections;
  report.procurementDrafts = added.length;
  report.windowRfqEntries = workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.requirementKey === 'windows').guidedSelection.procurementSchedule.length;
  report.protectedSourceUnchanged = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex') === expectedSourceHash;
  assert.equal(report.protectedSourceUnchanged, true);
  const output = path.join(root, 'artifacts/test-results/quotation-commercial-persistence', `${jobId}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error.message;
  report.projectId = projectId || undefined;
  report.snapshotId = snapshotId || undefined;
  const output = path.join(root, 'artifacts/test-results/quotation-commercial-persistence', `${jobId}-api-failed.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  throw error;
} finally {
  if (userId) {
    await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
    await admin.from('accounts').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}

async function createWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = data.user;
  userId = user.id;
  const account = { user_id: user.id, email, full_name: 'Quotation API Acceptance Test', business_name: 'Quotation API Acceptance', approved: true, is_approved: true, status: 'approved', subscription_status: 'active', onboarding_completed: true, phone_verified: true, email_verified: true };
  let fields = { ...account };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from('accounts').upsert(fields, { onConflict: 'user_id' });
    if (!result.error) break;
    const missing = result.error.message.match(/'([^']+)' column|column "([^"]+)"/i);
    const field = missing?.[1] || missing?.[2];
    if (!field || !(field in fields)) throw result.error;
    delete fields[field];
    if (attempt === 19) throw result.error;
  }
  const { error: membershipError } = await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: user.id, role: 'owner', status: 'active' });
  if (membershipError) throw membershipError;
  return user;
}

async function verifyDatabaseRows(id, currentSnapshotId) {
  const [projects, snapshots, boq, procurement, unpriced] = await Promise.all([
    admin.from('builder_commercial_projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('source_workbook_job_id', jobId),
    admin.from('builder_estimate_snapshots').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', id).eq('source_workbook_job_id', jobId),
    admin.from('builder_boq_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', id).eq('snapshot_id', currentSnapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', id).eq('snapshot_id', currentSnapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', id).eq('snapshot_id', currentSnapshotId).eq('order_status', 'quote_required').eq('metadata->>quoteRequired', 'true').eq('metadata->>approvedForOrdering', 'false').not('metadata->>selectionIdentityKey', 'is', null),
  ]);
  for (const result of [projects, snapshots, boq, procurement, unpriced]) if (result.error) throw result.error;
  const project = await admin.from('builder_commercial_projects').select('workspace_id,source_workbook_job_id').eq('id', id).maybeSingle();
  const snapshot = await admin.from('builder_estimate_snapshots').select('workspace_id,project_id,source_workbook_job_id,status,workbook_metadata').eq('id', currentSnapshotId).maybeSingle();
  if (project.error) throw project.error;
  if (snapshot.error) throw snapshot.error;
  assert.deepEqual(project.data, { workspace_id: workspaceId, source_workbook_job_id: jobId });
  assert.deepEqual(snapshot.data && { workspace_id: snapshot.data.workspace_id, project_id: snapshot.data.project_id, source_workbook_job_id: snapshot.data.source_workbook_job_id, status: snapshot.data.status }, { workspace_id: workspaceId, project_id: id, source_workbook_job_id: jobId, status: 'current' });
  assert(snapshot.data.workbook_metadata?.source_workbook_signature);
  assert.equal(snapshot.data.workbook_metadata?.source_workbook_snapshot_complete, false);
  assert.deepEqual(snapshot.data.workbook_metadata?.source_workbook_snapshot_omitted_sections?.sort(), ['aiPlanTakeoffJob', 'projectEstimateBuilder', 'takeoffEngine']);
  assert.equal(projects.count, 1);
  assert.equal(snapshots.count, 1);
  assert.equal(unpriced.count, 11);
  return { projects: projects.count || 0, snapshots: snapshots.count || 0, boqItems: boq.count || 0, procurementItems: procurement.count || 0, unpricedDrafts: unpriced.count || 0, signaturePresent: true };
}