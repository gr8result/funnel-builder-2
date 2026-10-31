import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { commercialSnapshotSignature } from '../lib/builders/commercialSnapshotSignature.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Supabase URL and acceptance credentials are required.');

const origin = process.env.QUOTATION_ACCEPTANCE_ORIGIN || 'http://localhost:3000';
const workspaceId = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const jobId = 'gr8-quotation-api-acceptance-1995a11b-94f6-4ac4-98a1-82f2cc53b44b';
const projectId = '7e249e5b-f99d-4a5e-92c4-147ff7579e61';
const snapshotId = '5bbb4337-c70a-427e-91f9-07322f260cc0';
const sourcePath = path.join(root, 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job');
const sourceHashExpected = '821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46';
const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
assert.equal(sourceHash, sourceHashExpected);

const runId = crypto.randomUUID();
const email = `quotation-live-browser-${runId}@example.test`;
const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
const outputDir = path.join(root, 'artifacts/test-results/quotation-commercial-persistence');
const report = { jobId, workspaceId, projectId, snapshotId, sourceHash, protectedJobTouched: false, commercialRecordsMocked: false, passed: false };
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = '';
let browser = null;

function firstDifference(left, right, path = '$') {
  if (Object.is(left, right)) return null;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return path;
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  for (const key of keys) {
    if (!(key in left) || !(key in right)) return `${path}.${key}`;
    const difference = firstDifference(left[key], right[key], Array.isArray(left) ? `${path}[${key}]` : `${path}.${key}`);
    if (difference) return difference;
  }
  return null;
}

try {
  const zip = await JSZip.loadAsync(sourceBytes);
  const sourceWorkbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
  assert.equal(sourceWorkbook.jobId, 'gr8-reconcile-test-47c50983a480');
  assert.equal(sourceWorkbook.workspaceId, workspaceId);
  const [projectCheck, snapshotCheck] = await Promise.all([
    admin.from('builder_commercial_projects').select('id,workspace_id,source_workbook_job_id').eq('id', projectId).maybeSingle(),
    admin.from('builder_estimate_snapshots').select('id,workspace_id,project_id,source_workbook_job_id,status,workbook_metadata,workbook_snapshot,summary').eq('id', snapshotId).maybeSingle(),
  ]);
  if (projectCheck.error) throw projectCheck.error;
  if (snapshotCheck.error) throw snapshotCheck.error;
  assert.equal(projectCheck.data?.workspace_id, workspaceId);
  assert.equal(projectCheck.data?.source_workbook_job_id, jobId);
  assert.equal(snapshotCheck.data?.project_id, projectId);
  assert.equal(snapshotCheck.data?.source_workbook_job_id, jobId);
  assert.equal(snapshotCheck.data?.status, 'current');
  const persistedWorkbook = snapshotCheck.data.workbook_snapshot;
  assert.equal(persistedWorkbook?.jobId, jobId);
  assert.equal(persistedWorkbook?.workspaceId, workspaceId);
  const procuredWorkbook = {
    ...persistedWorkbook,
    id: jobId,
    jobId,
    workspaceId,
    projectId,
    commercialProjectId: projectId,
    commercialSnapshotId: snapshotId,
    registeredJobId: persistedWorkbook.registeredJobId || jobId,
    aiPlanTakeoffJob: sourceWorkbook.aiPlanTakeoffJob,
    takeoffEngine: sourceWorkbook.takeoffEngine,
    page: 'quotation',
  };
  const calculated = calculateEstimateBuilderWorkbook(structuredClone(procuredWorkbook));
  const signature = commercialSnapshotSignature({ workspaceId, projectId, jobId, workbook: persistedWorkbook, calculated });
  const selectionAudit = reconcileProductSelections({ workbook: procuredWorkbook });
  report.preflight = {
    computedSignature: signature,
    storedSignature: snapshotCheck.data?.workbook_metadata?.source_workbook_signature || '',
    computedJobId: procuredWorkbook.jobId,
    storedJobId: snapshotCheck.data?.source_workbook_job_id || '',
    computedRegisteredJobId: procuredWorkbook.registeredJobId || procuredWorkbook.registeredJob?.jobId || '',
    snapshotComplete: snapshotCheck.data?.workbook_metadata?.source_workbook_snapshot_complete,
    workbookSnapshotPresent: Boolean(snapshotCheck.data?.workbook_snapshot),
    workbookSnapshotKeys: Object.keys(snapshotCheck.data?.workbook_snapshot || {}),
    workbookSnapshotType: typeof snapshotCheck.data?.workbook_snapshot,
    storedQuotationSections: Object.keys(persistedWorkbook?.quotation || {}).length,
    storedSelectionRooms: persistedWorkbook?.clientSelectionsBook?.rooms?.length || 0,
    storedProcurementItems: persistedWorkbook?.procurement?.items?.length || 0,
    selectionAudit: selectionAudit.counts,
    selectionBlockers: selectionAudit.entries.filter((entry) => String(entry.outcome || '').startsWith('BLOCKED_')).map((entry) => ({ key: entry.key, productId: entry.productId, productName: entry.productName, location: entry.location, outcome: entry.outcome, targetReason: entry.targetReason, blockers: entry.blockers })),
    missingProcurementIdentities: selectionAudit.procurementMissing.map((entry) => ({ key: entry.key, productId: entry.productId, productName: entry.productName, location: entry.location, outcome: entry.outcome })),
    duplicateAllocationClaims: selectionAudit.duplicates,
    duplicateProcurementClaims: selectionAudit.procurementDuplicates,
    firstQuotationDifference: firstDifference(snapshotCheck.data?.workbook_snapshot?.quotation || {}, procuredWorkbook.quotation || {}),
    firstSelectionDifference: firstDifference(snapshotCheck.data?.workbook_snapshot?.clientSelectionsBook || {}, procuredWorkbook.clientSelectionsBook || {}),
    firstProcurementDifference: firstDifference(snapshotCheck.data?.workbook_snapshot?.procurement || {}, procuredWorkbook.procurement || {}),
    storedSummaryTotal: snapshotCheck.data?.summary?.finalQuoteTotal || null,
    computedSummaryTotal: calculated.summary.finalQuoteTotal,
    storedSummaryTotal: snapshotCheck.data?.summary?.final_quote_total,
    sourceQuotationRows: Object.values(procuredWorkbook.quotation || {}).reduce((sum, section) => sum + (section.rows || []).length, 0),
    storedQuotationRows: Object.values(snapshotCheck.data?.workbook_snapshot?.quotation || {}).reduce((sum, section) => sum + (section.rows || []).length, 0),
    sourceSelectionRows: (procuredWorkbook.clientSelectionsBook?.rooms || []).reduce((sum, room) => sum + (room.rows || []).length, 0),
    storedSelectionRows: (snapshotCheck.data?.workbook_snapshot?.clientSelectionsBook?.rooms || []).reduce((sum, room) => sum + (room.rows || []).length, 0),
    sourceProcurementRows: procuredWorkbook.procurement?.items?.length || 0,
    storedProcurementRows: snapshotCheck.data?.workbook_snapshot?.procurement?.items?.length || 0,
    sourceOrderCount: procuredWorkbook.quotationSectionOrder?.length || 0,
    storedOrderCount: snapshotCheck.data?.workbook_snapshot?.quotationSectionOrder?.length || 0,
  };
  if (report.preflight.computedSignature !== report.preflight.storedSignature) {
    writeReport(report, '-preflight-failed');
    throw new Error('Snapshot fingerprint does not match this isolated workbook; no browser or sync write was started.');
  }

  const user = await createWorkspaceUser();
  userId = user.id;
  const { data: auth, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError || !auth.session?.access_token) throw signInError || new Error('Temporary acceptance user could not sign in.');

  browser = await puppeteer.launch({ headless: true, pipe: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-crash-reporter', '--disable-breakpad'], userDataDir: path.join(os.tmpdir(), `gr8-quote-${runId.slice(0, 8)}`), defaultViewport: { width: 1600, height: 1100 }, protocolTimeout: 600000 });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  const syncResponses = [];
  report.consoleErrors = [];
  report.httpErrors = [];
  report.failedRequests = [];
  page.on('response', async (response) => {
    if (response.status() >= 400) report.httpErrors.push({ status: response.status(), url: response.url() });
    if (!response.url().includes('/api/builders/sync-commercial-snapshot') || response.request().method() !== 'POST') return;
    const bodyText = await response.text().catch(() => "");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}
    syncResponses.push({ status: response.status(), method: response.request().method(), contentType: response.headers()["content-type"] || "", bodyText, body });
  });
  page.on('pageerror', (error) => {
    report.browserError ||= error.message;
    report.browserErrorStack ||= error.stack || '';
  });
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'failed' }));
  const authKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await page.evaluateOnNewDocument(({ authKey, session, workspaceId, jobId }) => {
    localStorage.setItem(authKey, JSON.stringify(session));
    localStorage.setItem('active_workspace_id', workspaceId);
    localStorage.setItem('estimate-builder-show-developer-controls', 'true');
    localStorage.setItem('estimate-builder-explicit-active-job-key', `job:${jobId}`);
    sessionStorage.setItem('estimate-builder-explicit-active-job-key', `job:${jobId}`);
    window.__auditSheet = () => {
      let fiber;
      for (const element of document.querySelectorAll('#__next, input, button')) {
        const key = Object.keys(element).find((candidate) => candidate.startsWith('__reactContainer$') || candidate.startsWith('__reactFiber$'));
        if (key) { fiber = element[key]; break; }
      }
      if (!fiber) return null;
      while (fiber.return) fiber = fiber.return;
      const stack = [fiber.stateNode?.current || fiber];
      while (stack.length) {
        const current = stack.pop();
        if (current.memoizedProps?.sheet?.workbook) return current.memoizedProps.sheet;
        if (current.sibling) stack.push(current.sibling);
        if (current.child) stack.push(current.child);
      }
      return null;
    };
  }, { authKey, session: auth.session, workspaceId, jobId });

  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const browserWorkbook = { ...procuredWorkbook };
  delete browserWorkbook.projectEstimateBuilder;
  if (browserWorkbook.takeoffEngine?.aiPlanTakeoffJob && browserWorkbook.aiPlanTakeoffJob) {
    const takeoffEngine = { ...browserWorkbook.takeoffEngine };
    delete takeoffEngine.aiPlanTakeoffJob;
    browserWorkbook.takeoffEngine = takeoffEngine;
  }
  await page.evaluate(({ workbook }) => new Promise((resolve, reject) => {
    const database = indexedDB.open('estimate-builder-template-db', 2);
    database.onupgradeneeded = () => { for (const name of ['jobs', 'templates']) if (!database.result.objectStoreNames.contains(name)) database.result.createObjectStore(name); };
    database.onerror = () => reject(database.error);
    database.onsuccess = () => {
      const db = database.result;
      const transaction = db.transaction('jobs', 'readwrite');
      transaction.objectStore('jobs').put({ key: `job:${workbook.jobId}`, type: 'job', jobId: workbook.jobId, name: workbook.jobName, workbook, revision: 1, schemaVersion: 3, jobSchemaVersion: 3, savedAt: new Date().toISOString() }, `job:${workbook.jobId}`);
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), { workbook: browserWorkbook });

  const route = `${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobId)}&page=quotation`;
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction((id, workspace) => {
    const sheet = window.__auditSheet?.();
    return sheet?.hydrated && sheet.workbook.jobId === id && sheet.workbook.workspaceId === workspace;
  }, { timeout: 180000 }, jobId, workspaceId);

  const quotationSnapshot = () => page.evaluate(() => {
    const sheet = window.__auditSheet();
    const workbook = sheet.workbook;
    const rows = Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, id: row.id, productId: row.productId || row.activeProductId || row.selectedProductId || '', quantity: row.quantity ?? row.qty ?? '', rate: row.finalRateUsed ?? row.excelRate ?? '', manualRate: row.manualRate ?? '', formulas: row.formulas || {} })));
    return { jobId: workbook.jobId, workspaceId: workbook.workspaceId, projectId: workbook.commercialProjectId, snapshotId: workbook.commercialSnapshotId, rows, rowCount: rows.length, order: workbook.quotationSectionOrder, total: sheet.preview.summary.finalQuoteTotal, payment: workbook.cashflowPayments, purchaseOrders: workbook.purchaseOrders, baseline: workbook.jobInclusionSnapshot };
  });
  const before = await quotationSnapshot();
  assert.equal(before.jobId, jobId, 'Never save unless the requested dedicated job is loaded.');
  assert.equal(before.workspaceId, workspaceId);
  assert.equal(before.projectId, projectId);
  assert.equal(before.snapshotId, snapshotId);
  assert.equal(before.total, calculated.summary.finalQuoteTotal);
  report.identityBeforeSave = { jobId: before.jobId, workspaceId: before.workspaceId, projectId: before.projectId, snapshotId: before.snapshotId, rowCount: before.rowCount, sectionCount: before.order.length, selectedProductRows: before.rows.filter((row) => row.productId).length, total: before.total };
  const saveBeforeSync = await page.evaluate(() => window.__auditSheet().saveDraft());
  assert.equal(saveBeforeSync.ok, true);

  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.innerText.trim() === 'Sync to Project Commercials'), { timeout: 30000 });
  const clickSync = () => page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.innerText.trim() === 'Sync to Project Commercials');
    if (!button || button.disabled) throw new Error('Commercial sync control is unavailable.');
    button.click();
  });
  await clickSync();
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (!syncResponses.length) {
    report.syncUiState = await page.evaluate(() => ({
      status: [...document.querySelectorAll('[role="status"],[role="alert"]')].map((element) => element.innerText).filter(Boolean),
      buttonText: [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Sync to Project Commercials'))?.innerText || '',
      jobId: window.__auditSheet?.()?.workbook?.jobId || '',
      workspaceId: window.__auditSheet?.()?.workbook?.workspaceId || '',
      projectId: window.__auditSheet?.()?.workbook?.commercialProjectId || '',
      snapshotId: window.__auditSheet?.()?.workbook?.commercialSnapshotId || '',
    }));
  }
  await waitForSyncCount(syncResponses, 1);
  report.syncPostResponses = syncResponses;
  report.syncUiAfterPost = await page.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"]')].map((element) => element.innerText).filter(Boolean));
  assert.equal(syncResponses[0].status, 200);
  assert.equal(syncResponses[0].body.ok, true);
  assert.equal(syncResponses[0].body.project_id, projectId);
  assert.equal(syncResponses[0].body.snapshot_id, snapshotId);
  assert.equal(syncResponses[0].body.already_synced, true);
  const afterSync = await quotationSnapshot();
  assert.deepEqual(afterSync, before, 'Real commercial sync cannot alter quotation rows, ordering, selections, formulas, payments or totals.');

  const quoteSignature = JSON.stringify(before);
  await page.evaluate(() => window.location.reload());
  try {
    await page.waitForFunction((id, workspace, project, snapshot) => {
      const sheet = window.__auditSheet?.();
      const workbook = sheet?.workbook;
      return sheet?.hydrated && workbook?.jobId === id && workbook.workspaceId === workspace && workbook.commercialProjectId === project && workbook.commercialSnapshotId === snapshot;
    }, { timeout: 180000 }, jobId, workspaceId, projectId, snapshotId);
  } catch (error) {
    report.refreshState = await page.evaluate(() => {
      const sheet = window.__auditSheet?.();
      return {
        href: location.href,
        readyState: document.readyState,
        title: document.title,
        bodyText: document.body.innerText.slice(0, 2000),
        hydrated: sheet?.hydrated || false,
        workbookJobId: sheet?.workbook?.jobId || '',
        workspaceId: sheet?.workbook?.workspaceId || '',
        projectId: sheet?.workbook?.commercialProjectId || '',
        snapshotId: sheet?.workbook?.commercialSnapshotId || '',
      };
    }).catch(() => ({}));
    report.refreshWaitError = error?.message || String(error);
    throw error;
  }
  assert.equal(JSON.stringify(await quotationSnapshot()), quoteSignature, 'Hard refresh preserves quotation and association.');

  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction((id, workspace, project, snapshot) => {
    const sheet = window.__auditSheet?.();
    const workbook = sheet?.workbook;
    return sheet?.hydrated && workbook?.jobId === id && workbook.workspaceId === workspace && workbook.commercialProjectId === project && workbook.commercialSnapshotId === snapshot;
  }, { timeout: 180000 }, jobId, workspaceId, projectId, snapshotId);
  assert.equal(JSON.stringify(await quotationSnapshot()), quoteSignature, 'Reopen preserves quotation and association.');

  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobId)}&page=boq`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => /Bill of Quantities|BOQ/i.test(document.body.innerText), { timeout: 120000 });
  report.boqVisible = true;
  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobId)}&page=procurement`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => [...document.querySelectorAll('h1,h2,h3')].some((heading) => heading.innerText.trim() === 'Procurement Schedule'), { timeout: 120000 });
  try {
    await page.waitForFunction((expectedProjectId, expectedSnapshotId) => {
      const valueForLabel = (text) => [...document.querySelectorAll('label')]
        .find((label) => label.textContent.trim().toLowerCase().startsWith(text.toLowerCase()))
        ?.querySelector('select')?.value || '';
      return valueForLabel('Commercial project') === expectedProjectId && valueForLabel('Estimate snapshot') === expectedSnapshotId;
    }, { timeout: 30000 }, projectId, snapshotId);
  } catch (error) {
    report.procurementLoadState = await page.evaluate(() => {
      const valueForLabel = (text) => [...document.querySelectorAll('label')]
        .find((label) => label.textContent.trim().toLowerCase().startsWith(text.toLowerCase()))
        ?.querySelector('select');
      const projectSelect = valueForLabel('Commercial project');
      const snapshotSelect = valueForLabel('Estimate snapshot');
      const workbook = window.__auditSheet?.()?.workbook || {};
      return {
        href: location.href,
        bodyText: document.body.innerText.slice(-4000),
        workbookJobId: workbook.jobId || '',
        workbookWorkspaceId: workbook.workspaceId || workbook.workspace_id || '',
        workbookProjectId: workbook.commercialProjectId || '',
        workbookSnapshotId: workbook.commercialSnapshotId || '',
        projectValue: projectSelect?.value || '',
        projectOptions: [...(projectSelect?.options || [])].map((option) => ({ value: option.value, text: option.text })),
        snapshotValue: snapshotSelect?.value || '',
        snapshotOptions: [...(snapshotSelect?.options || [])].map((option) => ({ value: option.value, text: option.text })),
      };
    }).catch(() => ({}));
    report.procurementWaitError = error?.message || String(error);
    throw error;
  }
  const procurementAssociation = await page.evaluate(() => {
    const valueForLabel = (text) => [...document.querySelectorAll('label')]
      .find((label) => label.textContent.trim().toLowerCase().startsWith(text.toLowerCase()))
      ?.querySelector('select')?.value || '';
    return {
      projectId: valueForLabel('Commercial project'),
      snapshotId: valueForLabel('Estimate snapshot'),
    };
  });
  assert.equal(procurementAssociation.projectId, projectId);
  assert.equal(procurementAssociation.snapshotId, snapshotId);
  report.procurementAssociationVerified = true;

  const persisted = await countSnapshotRecords();
  assert.equal(persisted.projects, 1);
  assert.equal(persisted.snapshots, 1);
  assert.equal(persisted.boqItems, 327);
  assert.equal(persisted.procurementItems, 86);
  assert.equal(persisted.unpricedDrafts, 29);
  report.persistedDatabase = persisted;
  report.passed = true;
  report.finalTotal = before.total;
  report.rowCount = before.rowCount;
  report.protectedSourceUnchanged = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex') === sourceHashExpected;
  assert.equal(report.protectedSourceUnchanged, true);
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error?.message || String(error);
  writeReport(report, '-failed');
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (userId) {
    await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
    await admin.from('accounts').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}

async function createWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const account = { user_id: userId, email, full_name: 'Quotation Live Browser Acceptance', business_name: 'Quotation Acceptance', approved: true, is_approved: true, status: 'approved', subscription_status: 'active', onboarding_completed: true, phone_verified: true, email_verified: true };
  let fields = { ...account };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from('accounts').upsert(fields, { onConflict: 'user_id' });
    if (!result.error) break;
    const missing = result.error.message.match(/'([^']+)' column|column "([^"]+)"/i);
    const key = missing?.[1] || missing?.[2];
    if (!key || !(key in fields)) throw result.error;
    delete fields[key];
    if (attempt === 19) throw result.error;
  }
  const { error: memberError } = await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role: 'owner', status: 'active' });
  if (memberError) throw memberError;
  return data.user;
}

async function waitForSyncCount(responses, expected, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (responses.length < expected && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(responses.length, expected);
}

async function countSnapshotRecords() {
  const [projects, snapshots, boqItems, procurementItems, unpriced] = await Promise.all([
    admin.from('builder_commercial_projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('source_workbook_job_id', jobId),
    admin.from('builder_estimate_snapshots').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('source_workbook_job_id', jobId),
    admin.from('builder_boq_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId).eq('order_status', 'quote_required').eq('metadata->>quoteRequired', 'true').eq('metadata->>approvedForOrdering', 'false').not('metadata->>selectionIdentityKey', 'is', null),
  ]);
  for (const result of [projects, snapshots, boqItems, procurementItems, unpriced]) if (result.error) throw result.error;
  return { projects: projects.count || 0, snapshots: snapshots.count || 0, boqItems: boqItems.count || 0, procurementItems: procurementItems.count || 0, unpricedDrafts: unpriced.count || 0 };
}

function writeReport(report, suffix = '') {
  const outputPath = path.join(root, 'artifacts/test-results/quotation-commercial-persistence', `live-browser-${jobId}${suffix}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
}