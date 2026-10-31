import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { refreshSelectionProcurementRequirements } from '../lib/builders/selectionProcurementRequirements.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';
import { refreshTakeoffProcurementItems } from '../lib/construction-estimation/takeoffProcurement.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Supabase URL, anon key and service role are required for the isolated acceptance test.');

const workspaceId = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const baseUrl = (process.env.QUOTATION_ACCEPTANCE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const sourcePath = path.join(root, 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job');
const expectedSourceHash = '821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46';
const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
assert.equal(sourceHash, expectedSourceHash, 'The isolated fixture changed since its verified checkpoint.');

const runId = crypto.randomUUID();
const jobId = `gr8-quotation-acceptance-${runId}`;
const email = `quotation-acceptance-${runId}@example.test`;
const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
const outputDir = path.join(root, 'artifacts/test-results/quotation-commercial-persistence');
fs.mkdirSync(outputDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
if (process.argv.includes('--cleanup-test-users')) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const testUsers = (data.users || []).filter((user) => String(user.email || '').startsWith('quotation-acceptance-') && String(user.email || '').endsWith('@example.test'));
  for (const user of testUsers) {
    await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', user.id);
    await admin.from('accounts').delete().eq('user_id', user.id);
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
  }
  console.log(JSON.stringify({ cleanedTemporaryQuotationTestUsers: testUsers.length }));
  process.exit(0);
}

let browser = null;
let diagnosticPage = null;
const syncResponses = [];
let userId = '';
let testProjectId = '';
let testSnapshotId = '';
const report = {
  jobId,
  workspaceId,
  sourceHash,
  baseUrl,
  writesScopedToDedicatedJob: true,
  protectedJobTouched: false,
  passed: false,
  browserDiagnostics: { pageErrors: [], runtimeExceptions: [], consoleErrors: [], failedRequests: [], responses: [], apiResponses: [], httpErrors: [] },
};
let stage = 'launch isolated browser';
const SEED_CHUNK_BYTES = 512 * 1024;
const EXPLICIT_ACTIVE_JOB_SESSION_KEY = 'estimate-builder-explicit-active-job-key';
const quotationRowCount = (quotation = {}) => Object.values(quotation).reduce((total, section) => total + (section?.rows?.length || 0), 0);
const diagnosticPath = (value) => {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value).split('?')[0];
  }
};

function workbookForBrowserAcceptance(workbook) {
  const pages = (workbook.projectEstimateBuilder?.pages || []).map((page) => ({
    ...page,
    baseArtwork: typeof page.baseArtwork === 'string' && page.baseArtwork.startsWith('data:image/') ? '' : page.baseArtwork,
    design: page.design ? {
      ...page.design,
      backgroundImageUrl: typeof page.design.backgroundImageUrl === 'string' && page.design.backgroundImageUrl.startsWith('data:image/') ? '' : page.design.backgroundImageUrl,
    } : page.design,
    importedDocument: page.importedDocument ? {
      ...page.importedDocument,
      baseArtwork: typeof page.importedDocument.baseArtwork === 'string' && page.importedDocument.baseArtwork.startsWith('data:image/') ? '' : page.importedDocument.baseArtwork,
    } : page.importedDocument,
  }));
  return {
    ...workbook,
    projectEstimateBuilder: workbook.projectEstimateBuilder ? { ...workbook.projectEstimateBuilder, pages } : workbook.projectEstimateBuilder,
  };
}

try {
  browser = await puppeteer.launch({ headless: true, pipe: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-crash-reporter', '--disable-breakpad'], userDataDir: path.join(root, 'artifacts/test-results/quotation-commercial-persistence', `${jobId}-profile`), defaultViewport: { width: 1600, height: 1100 }, protocolTimeout: 180000 });
  stage = 'create temporary test user';
  const user = await createWorkspaceUser();
  userId = user.id;
  stage = 'verify isolated fixture blocker classifications';
  const zip = await JSZip.loadAsync(sourceBytes);
  const estimate = JSON.parse(await zip.file('estimate.json').async('string'));
  const sourceWorkbook = estimate.workbook;
  assert.equal(sourceWorkbook.jobId, 'gr8-reconcile-test-47c50983a480');
  assert.equal(sourceWorkbook.workspaceId, workspaceId);

  const testName = `TEST Quotation Acceptance ${runId.slice(0, 8)}`;
  let workbook = {
    ...structuredClone(sourceWorkbook),
    id: jobId,
    jobId,
    workspaceId,
    projectId: runId,
    commercialProjectId: '',
    commercialSnapshotId: '',
    registeredJobId: jobId,
    jobName: testName,
    registeredJob: { ...(sourceWorkbook.registeredJob || {}), jobId, jobName: testName, jobNumber: `QAT-${runId.slice(0, 8)}` },
    jobFileMeta: { ...(sourceWorkbook.jobFileMeta || {}), projectId: runId, sourceProjectId: runId, recoveredFromProtectedJob: false, jobName: testName },
    page: 'quotation',
  };
  const products = getMasterProducts(workbook.workspaceId);
  const productsById = new Map(products.map((product) => [product.productId, product]));
  const productsByCode = new Map(products.flatMap((product) => [product.productCode, product.supplierCode, product.model].filter(Boolean).map((code) => [String(code), product])));
  const productById = (id) => productsById.get(id) || null;
  productById.byCode = (code) => productsByCode.get(String(code)) || null;
  const beforeAudit = reconcileProductSelections({ workbook });
  assert.equal(beforeAudit.selected, 52);
  assert.equal(beforeAudit.procurementMissing.length, 27);
  const roofingBeforeRefresh = beforeAudit.entries.find((entry) => entry.requirementKey === 'roofing');
  assert.deepEqual({
    outcome: roofingBeforeRefresh?.outcome,
    quoteRowIds: roofingBeforeRefresh?.quoteRowIds,
    procurementRepresented: roofingBeforeRefresh?.procurementRepresented,
    priceVerified: roofingBeforeRefresh?.priceVerified,
  }, {
    outcome: 'VERIFIED_INCLUDED_IN_PACKAGE',
    quoteRowIds: ['quote-803'],
    procurementRepresented: true,
    priceVerified: true,
  }, 'The existing all-in roofing row is a priced package; no separate selected-product price is invented.');
  const calculatedBeforeRefresh = calculateEstimateBuilderWorkbook(structuredClone(workbook));
  const quoteTotal = calculatedBeforeRefresh.summary.finalQuoteTotal;
  const existingProcurementItems = workbook.procurement?.items || [];
  const existingProcurementIds = new Set(existingProcurementItems.map((item) => item.id));
  workbook = refreshSelectionProcurementRequirements(
    workbook,
    calculatedBeforeRefresh,
    workbook.procurement?.items || [],
    { productById, productByCode: productById.byCode },
  );
  const afterAudit = reconcileProductSelections({ workbook });
  assert.deepEqual(afterAudit.procurementMissing.map((entry) => entry.requirementKey).sort(), ['architraves', 'door-hardware', 'exterior-paint', 'internal-doors']);
  const beforeByIdentity = new Map(beforeAudit.entries.map((entry) => [entry.key, entry]));
  const blockerTransitions = afterAudit.entries.filter((entry) => beforeByIdentity.get(entry.key)?.outcome !== entry.outcome)
    .map((entry) => ({
      key: entry.key,
      before: beforeByIdentity.get(entry.key)?.outcome,
      after: entry.outcome,
      procurementRepresented: entry.procurementRepresented,
      priceVerified: entry.priceVerified,
    }));
  assert.equal(afterAudit.unresolvedCount, beforeAudit.unresolvedCount, 'RFQ drafts must not resolve financial blockers.');
  assert.equal(afterAudit.counts.PRICED_IN_QUOTE, beforeAudit.counts.PRICED_IN_QUOTE, 'RFQ drafts must not mark products priced.');
  assert.equal(afterAudit.counts.VERIFIED_INCLUDED_IN_PACKAGE, beforeAudit.counts.VERIFIED_INCLUDED_IN_PACKAGE, 'RFQ drafts must not alter existing inclusions.');
  assert.deepEqual(blockerTransitions, [], 'Creating deterministic procurement drafts must not change a selection\'s primary commercial decision.');
  const primaryDecisions = Object.fromEntries(afterAudit.entries
    .filter((entry) => ['cladding', 'driveway', 'entry-door', 'windows'].includes(entry.requirementKey))
    .map((entry) => [entry.requirementKey, entry.outcome]));
  assert.deepEqual(primaryDecisions, {
    cladding: 'BLOCKED_MISSING_PRICE',
    driveway: 'BLOCKED_MISSING_PRICE',
    'entry-door': 'BLOCKED_MISSING_PRICE',
    windows: 'BLOCKED_MISSING_PRICE',
  }, 'Primary financial causes remain stable and are not mislabeled as procurement mapping failures.');
  const addedDrafts = (workbook.procurement?.items || []).filter((item) => !existingProcurementIds.has(item.id));
  const topLevelDrafts = addedDrafts.filter((item) => item.selectionIdentityKey);
  assert.equal(new Set(addedDrafts.map((item) => item.id)).size, addedDrafts.length, 'Procurement refresh must produce unique requirement IDs.');
  assert.equal(new Set(topLevelDrafts.map((item) => item.selectionIdentityKey)).size, topLevelDrafts.length, 'Each unresolved selection may have only one top-level RFQ draft.');
  const connectorOwnedRequirements = new Set(['oven', 'cooktop', 'rangehood', 'dishwasher', 'interior-lighting', 'ceiling-fan', 'towel-rail', 'hand-towel', 'toilet-roll-holder', 'robe-hook', 'hot-water-system', 'exterior-paint']);
  assert.deepEqual(
    topLevelDrafts.filter((item) => connectorOwnedRequirements.has(item.requirementKey)).map((item) => item.requirementKey),
    [],
    'Deterministic connector-owned procurement records must not receive duplicate generic RFQ drafts.',
  );
  const procurementDraftCount = addedDrafts.length;
  assert(topLevelDrafts.every((item) => item.estimatedRate === null && item.estimatedTotal === null && item.approvedForOrdering === false && item.quoteRequired === true));
  const windows = workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.requirementKey === 'windows')?.guidedSelection;
  assert.equal(windows.procurementSchedule.length, 30);
  assert.equal(new Set(windows.procurementSchedule.map((item) => String(item.windowId))).size, 30);
  const calculatedAfterRefresh = calculateEstimateBuilderWorkbook(structuredClone(workbook));
  assert.equal(calculatedAfterRefresh.summary.finalQuoteTotal, quoteTotal);
  const expectedUnpricedProcurementCount = refreshTakeoffProcurementItems(calculatedAfterRefresh, workbook.procurement?.items || [])
    .filter((item) => (item.quoteRequired === true || item.costPending === true) && item.approvedForOrdering !== true)
    .length;
  const initialUnpricedSelectionProcurementCount = (workbook.procurement?.items || [])
    .filter((item) => (item.quoteRequired === true || item.costPending === true) && item.approvedForOrdering !== true)
    .length;

  const page = await browser.newPage();
  diagnosticPage = page;
  page.setDefaultTimeout(120000);
  const diagnosticSession = await page.createCDPSession();
  await diagnosticSession.send('Runtime.enable');
  await diagnosticSession.send('Network.enable');
  page.on('domcontentloaded', () => {
    report.domContentLoadedAt ||= { stage, url: diagnosticPath(page.url()) };
  });
  diagnosticSession.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    if (report.browserDiagnostics.runtimeExceptions.length >= 50) return;
    report.browserDiagnostics.runtimeExceptions.push({
      text: exceptionDetails.text || '',
      exception: exceptionDetails.exception?.description || '',
      url: diagnosticPath(exceptionDetails.url || page.url()),
      lineNumber: exceptionDetails.lineNumber,
      columnNumber: exceptionDetails.columnNumber,
      stackTrace: (exceptionDetails.stackTrace?.callFrames || []).slice(0, 12).map((frame) => ({
        functionName: frame.functionName,
        url: diagnosticPath(frame.url),
        lineNumber: frame.lineNumber,
        columnNumber: frame.columnNumber,
      })),
    });
  });
  diagnosticSession.on('Network.responseReceived', ({ response, type }) => {
    if (!['Document', 'Script', 'XHR', 'Fetch'].includes(type)) return;
    const destination = ['XHR', 'Fetch'].includes(type) ? report.browserDiagnostics.apiResponses : report.browserDiagnostics.responses;
    if (destination.length >= 100) return;
    destination.push({
      url: diagnosticPath(response.url),
      type,
      status: response.status,
      mimeType: response.mimeType,
      fromDiskCache: response.fromDiskCache,
      fromServiceWorker: response.fromServiceWorker,
    });
  });
  browser.on('disconnected', () => { report.browserDisconnectedAt ||= stage; });
  page.on('close', () => { report.pageClosedAt ||= stage; });
  page.on('response', async (response) => {
    if (!response.url().includes('/api/builders/sync-commercial-snapshot')) return;
    syncResponses.push({ status: response.status(), body: await response.json().catch(() => ({})) });
  });
  page.on('pageerror', (error) => {
    report.browserError ||= error.message;
    if (report.browserDiagnostics.pageErrors.length < 50) {
      report.browserDiagnostics.pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack || '',
        url: diagnosticPath(page.url()),
      });
    }
  });
  page.on('console', (message) => {
    if (message.type() !== 'error' || report.browserDiagnostics.consoleErrors.length >= 50) return;
    report.browserDiagnostics.consoleErrors.push({
      text: message.text(),
      location: { ...message.location(), url: diagnosticPath(message.location().url || '') },
      url: diagnosticPath(page.url()),
    });
  });
  page.on('requestfailed', (request) => {
    if (report.browserDiagnostics.failedRequests.length >= 100) return;
    report.browserDiagnostics.failedRequests.push({
      url: diagnosticPath(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText || '',
    });
  });
  page.on('response', async (response) => {
    if (response.status() < 400 || report.browserDiagnostics.httpErrors.length >= 50) return;
    const entry = {
      url: diagnosticPath(response.url()),
      status: response.status(),
      statusText: response.statusText(),
      resourceType: response.request().resourceType(),
    };
    if (['document', 'script', 'xhr', 'fetch'].includes(entry.resourceType)) {
      entry.body = (await response.text().catch(() => '')).slice(0, 2000);
    }
    report.browserDiagnostics.httpErrors.push(entry);
  });
  await page.evaluateOnNewDocument(({ workspaceId }) => {
    localStorage.setItem('active_workspace_id', workspaceId);
    localStorage.setItem('estimate-builder-show-developer-controls', 'true');
    localStorage.setItem('estimate-builder-hydration-timing', 'true');
    window.__auditSheet = () => window.__estimateBuilderSheet || null;
  }, { workspaceId });

  stage = 'sign in temporary workspace user through application login';
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Sign In');
    if (!button) throw new Error('Application Sign In button is unavailable.');
    button.click();
  });
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 120000 });

  stage = 'seed isolated local workbook';
  const seedUrl = `${baseUrl}/__quotation_acceptance_seed__`;
  await page.setRequestInterception(true);
  const seedRequestHandler = (request) => {
    if (request.isNavigationRequest() && request.url() === seedUrl) {
      request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Quotation acceptance seed</title>' });
    } else {
      request.continue();
    }
  };
  page.on('request', seedRequestHandler);
  await page.goto(seedUrl, { waitUntil: 'domcontentloaded' });
  page.off('request', seedRequestHandler);
  await page.setRequestInterception(false);
  const browserWorkbook = workbookForBrowserAcceptance(workbook);
  assert.deepEqual(browserWorkbook.quotation, workbook.quotation, 'Browser transport must preserve the complete quotation.');
  assert.deepEqual(browserWorkbook.clientSelectionsBook, workbook.clientSelectionsBook, 'Browser transport must preserve all selected products and schedules.');
  assert.deepEqual(browserWorkbook.procurement, workbook.procurement, 'Browser transport must preserve procurement blockers.');
  const serializedWorkbook = JSON.stringify(browserWorkbook);
  const seedChunks = Array.from({ length: Math.ceil(serializedWorkbook.length / SEED_CHUNK_BYTES) }, (_, index) =>
    serializedWorkbook.slice(index * SEED_CHUNK_BYTES, (index + 1) * SEED_CHUNK_BYTES));
  report.browserSeed = {
    sourceWorkbookBytes: Buffer.byteLength(JSON.stringify(workbook)),
    transportedWorkbookBytes: Buffer.byteLength(serializedWorkbook),
    chunkBytes: SEED_CHUNK_BYTES,
    chunks: seedChunks.length,
    strippedProposalArtworkOnly: true,
  };
  await page.evaluate(() => { globalThis.__quotationAcceptanceSeedChunks = []; });
  for (const chunk of seedChunks) {
    await page.evaluate((value) => { globalThis.__quotationAcceptanceSeedChunks.push(value); }, chunk);
  }
  const seedTiming = await page.evaluate(({ jobId, jobName, explicitSessionKey }) => new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let workbook;
    try {
      workbook = JSON.parse(globalThis.__quotationAcceptanceSeedChunks.join(''));
      delete globalThis.__quotationAcceptanceSeedChunks;
    } catch (error) {
      reject(error);
      return;
    }
    const open = indexedDB.open('estimate-builder-template-db', 2);
    open.onupgradeneeded = () => { for (const name of ['jobs', 'templates']) if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('jobs', 'readwrite');
      tx.objectStore('jobs').put({ key: `job:${jobId}`, type: 'job', jobId, name: jobName, workbook, revision: 1, schemaVersion: 3, jobSchemaVersion: 3, savedAt: new Date().toISOString() }, `job:${jobId}`);
      tx.oncomplete = () => {
        sessionStorage.setItem(explicitSessionKey, `job:${jobId}`);
        db.close();
        resolve({
          totalMs: Math.round(performance.now() - startedAt),
          rows: Object.values(workbook.quotation || {}).reduce((total, section) => total + (section?.rows?.length || 0), 0),
        });
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { jobId: browserWorkbook.jobId, jobName: browserWorkbook.jobName, explicitSessionKey: EXPLICIT_ACTIVE_JOB_SESSION_KEY });
  const indexedDbReadStarted = Date.now();
  const seedReadback = await page.evaluate(({ jobId, explicitSessionKey }) => new Promise((resolve, reject) => {
    const open = indexedDB.open('estimate-builder-template-db', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('jobs', 'readonly');
      const request = tx.objectStore('jobs').get(`job:${jobId}`);
      request.onsuccess = () => resolve({
        jobId: request.result?.workbook?.jobId || '',
        rows: Object.values(request.result?.workbook?.quotation || {}).reduce((total, section) => total + (section?.rows?.length || 0), 0),
        explicitJobKey: sessionStorage.getItem(explicitSessionKey) || '',
      });
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    };
  }), { jobId, explicitSessionKey: EXPLICIT_ACTIVE_JOB_SESSION_KEY });
  assert.deepEqual(seedReadback, {
    jobId,
    rows: quotationRowCount(browserWorkbook.quotation),
    explicitJobKey: `job:${jobId}`,
  }, 'IndexedDB record and tab-scoped job identity must agree before application hydration.');
  report.hydrationTiming = {
    beforeMs: 120000,
    beforeResult: 'Timed out because the tab-scoped explicit job pointer was absent',
    seedParseAndWriteMs: seedTiming.totalMs,
    indexedDbReadbackMs: Date.now() - indexedDbReadStarted,
  };
  assert.equal(seedTiming.rows, 3531, 'The isolated browser seed must preserve all 3,531 quotation rows.');

  const route = `${baseUrl}/modules/estimate-builder?jobId=${encodeURIComponent(jobId)}&page=quotation`;
  stage = 'open isolated quotation job';
  const hydrationStarted = Date.now();
  const routeResponse = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 120000 });
  report.quotationDocument = {
    status: routeResponse?.status() ?? null,
    url: diagnosticPath(routeResponse?.url() || page.url()),
  };
  await page.waitForFunction((id) => location.pathname === '/login'
    || (window.__auditSheet?.()?.hydrated
      && window.__auditSheet().workbook.jobId === id
      && window.__estimateBuilderHydrationTrace?.some((entry) => entry.stage === 'react-ready' && entry.jobId === id)), { polling: 250, timeout: 120000 }, jobId);
  if (new URL(page.url()).pathname === '/login') throw new Error('Authenticated acceptance browser was redirected to login before isolated job hydration.');
  report.hydrationTiming.afterMs = Date.now() - hydrationStarted;
  report.hydrationTiming.trace = await page.evaluate(() => window.__estimateBuilderHydrationTrace || []);
  report.hydrationTiming.navigation = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      responseMs: Math.round(navigation.responseEnd - navigation.requestStart),
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      scriptLoadMs: Math.round(resources.filter((entry) => entry.initiatorType === 'script').reduce((total, entry) => total + entry.duration, 0)),
      scriptBytes: resources.filter((entry) => entry.initiatorType === 'script').reduce((total, entry) => total + (entry.transferSize || 0), 0),
    };
  });
  const workbookIdentity = await page.evaluate(() => ({ jobId: window.__auditSheet().workbook.jobId, workspaceId: window.__auditSheet().workbook.workspaceId, total: window.__auditSheet().preview.summary.finalQuoteTotal, procurementCount: window.__auditSheet().workbook.procurement.items.length }));
  assert.deepEqual(workbookIdentity, { jobId, workspaceId, total: quoteTotal, procurementCount: workbook.procurement.items.length });
  stage = 'verify compact commercial issue review';
  await page.waitForSelector('[data-testid="selection-integrity-warning"]', { timeout: 120000 });
  const compactWarning = await page.$eval('[data-testid="selection-integrity-warning"]', (element) => ({
    height: element.getBoundingClientRect().height,
    text: element.textContent || '',
    issueCount: Number((element.textContent || '').match(/(\d+)\s+commercial issue/i)?.[1] || 0),
  }));
  assert(compactWarning.height < 160, `Commercial issue summary must remain compact; rendered height was ${compactWarning.height}px.`);
  assert.match(compactWarning.text, /commercial issue/i);
  assert.match(compactWarning.text, /financial approval remains blocked/i);
  assert.equal(compactWarning.issueCount, 41, `The authenticated workspace fixture must surface its current canonical issue set; found ${compactWarning.issueCount}.`);
  const liveCanonicalSummary = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    const audit = sheet.productSelectionIntegrity();
    const outcomes = {};
    const decisions = {};
    for (const entry of audit.entries || []) {
      outcomes[entry.outcome] = (outcomes[entry.outcome] || 0) + 1;
      decisions[entry.reconciliationDecision || 'UNCLASSIFIED'] = (decisions[entry.reconciliationDecision || 'UNCLASSIFIED'] || 0) + 1;
    }
    const quoteRows = Object.entries(sheet.preview?.quotation || {}).flatMap(([section, group]) =>
      (group?.rows || []).map((row) => ({ section, row })));
    const rowEvidence = (row) => ({
      rowId: row.id,
      item: row.item || row.description || '',
      quantity: row.qty ?? row.quantity ?? null,
      unit: row.unit || '',
      rate: row.finalRateUsed ?? row.manualRate ?? row.excelRate ?? null,
      priceStatus: row.priceStatus || row.rateStatus || '',
      priceSource: row.sourceOfRate || '',
      quoteRequired: row.quoteRequired === true,
    });
    const blockedEntries = (audit.blocked || []).map((entry) => {
      const linkedRows = quoteRows.filter(({ row }) => entry.quoteRowIds?.includes(row.id));
      return {
        identityKey: entry.key,
        requirementKey: entry.requirementKey,
        productId: entry.productId || '',
        product: entry.productName || '',
        section: entry.section || linkedRows[0]?.section || '',
        location: entry.location || '',
        quantity: entry.quantity ?? null,
        unit: entry.unit || '',
        outcome: entry.outcome,
        reason: entry.reason || entry.procurementIssue || entry.blockers?.join(', ') || entry.outcome,
        priceVerified: entry.priceVerified === true,
        price: entry.unitPrice ?? null,
        priceIncludesGst: typeof entry.priceIncludesGst === 'boolean' ? entry.priceIncludesGst : null,
        priceSource: entry.priceEvidenceSource || '',
        procurementStatus: entry.procurementStatus || '',
        linkedRows: linkedRows.map(({ row }) => rowEvidence(row)),
      };
    });
    const unpricedDrafts = (sheet.workbook.procurement?.items || [])
      .filter((item) => (item.quoteRequired === true || item.costPending === true) && item.approvedForOrdering !== true)
      .map((item) => ({
        id: item.id,
        selectionIdentityKey: item.selectionIdentityKey || '',
        requirementKey: item.requirementKey || '',
        productId: item.productId || '',
        description: item.itemDescription || item.description || '',
        section: item.sectionName || '',
        quantity: item.qty ?? item.quantity ?? null,
        unit: item.unit || '',
        rate: item.estimatedRate ?? item.unitPrice ?? null,
        status: item.status || '',
        reason: item.quantitySource || item.notes || '',
      }));
    const rateRows = quoteRows
      .filter(({ row }) => row.active !== false && (row.quoteRequired === true || row.sourceOfRate === 'rate missing' || row.discontinuedWarning))
      .filter(({ row }) => Number(row.qty ?? row.quantity) > 0 || row.productId || row.requirementKey || row.selectionPricePending)
      .map(({ section, row }) => ({ section, ...rowEvidence(row), reason: row.rateReason || row.quoteRequiredReason || row.discontinuedWarning || '' }));
    return {
      selected: audit.selected,
      unresolved: audit.unresolvedCount,
      procurementMissing: audit.procurementMissing.length,
      outcomes,
      decisions,
      blockedIds: (audit.blocked || []).map((entry) => entry.key),
      blockedEntries,
      unpricedDrafts,
      rateRows,
    };
  });
  const cabinetryAttention = await page.$eval('[data-testid="cabinetry-reconciliation"]', (element) => Number(element.getAttribute('data-cabinetry-attention')));
  assert.equal(cabinetryAttention, 9, 'All nine specific cabinetry setup decisions must remain traceable.');
  const cabinetryIssues = await page.evaluate(() => window.__auditSheet().workbook.cabinetryReconciliation.entries
    .filter((entry) => entry.outcome === 'ACTION REQUIRED')
    .map((entry) => ({ requirementId: entry.requirementId, room: entry.room, label: entry.label, quantity: entry.quantity, selectedFinish: entry.selectedFinish, reason: entry.reason, action: entry.action?.kind || '' })));
  assert.deepEqual(cabinetryIssues.map((entry) => entry.requirementId).sort(), [
    'benchtop:kitchen:benchtop-main',
    'benchtop:main-bathroom:wallMountedVanity',
    'selection-retired:CAB-butler-s-pantry-1789947466579',
    'selection-retired:CAB-butler-s-pantry-1789947471734',
    'selection-retired:CAB-kitchen-1789936190593',
    'selection-retired:CAB-laundry-1790211658528',
    'selection:CAB-butler-s-pantry-1791249462338',
    'selection:CAB-kitchen-1791182975207',
    'selection:CAB-laundry-1791189816203',
  ]);
  const windowStatus = await page.$$eval('[data-notification-key="section53-window-status"]', (elements) => elements.map((element) => ({
    text: element.textContent || '',
    buttons: element.querySelectorAll('button').length,
  })));
  assert.equal(windowStatus.length, 1, 'Window reconciliation must render one canonical status.');
  assert.match(windowStatus[0].text, /30 openings mapped, 28 priced, 2 pending supplier rates/i);
  assert.match(windowStatus[0].text, /650H x 3000W \(Kitchen\)/i);
  assert.match(windowStatus[0].text, /650H x 1800W \(Pantry\)/i);
  assert.equal(windowStatus[0].buttons, 0, 'Window status is not an acknowledgeable error.');
  const beforeScreenshot = path.join(outputDir, `${jobId}-canonical-issues-before.png`);
  await page.screenshot({ path: beforeScreenshot, fullPage: true });
  assert.equal(await page.$('[data-testid="selection-integrity-issues"]'), null, 'Issue details must not dominate the quotation page before Review Issues is selected.');
  await page.click('[data-testid="selection-integrity-review"]');
  await page.waitForSelector('[data-testid="selection-integrity-issues"]');
  const issueReview = await page.$eval('[data-testid="selection-integrity-issues"]', (element) => ({
    height: element.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    groups: [...element.querySelectorAll('summary')].map(item => item.textContent || ''),
    rateIssues: element.querySelectorAll('[data-testid="selection-integrity-rate-issue"]').length,
    issueIds: [...element.querySelectorAll('[data-commercial-issue-id]')].map((item) => item.getAttribute('data-commercial-issue-id')),
    issueDetails: [...element.querySelectorAll('[data-commercial-issue-id]')].map((item) => ({
      id: item.getAttribute('data-commercial-issue-id'),
      kind: item.getAttribute('data-testid') || '',
      text: (item.innerText || item.textContent || '').trim().slice(0, 1600),
    })),
  }));
  assert(issueReview.height <= issueReview.viewportHeight - 32, 'Commercial issue review must remain within the desktop viewport.');
  assert(issueReview.groups.some(label => /missing supplier pricing/i.test(label)));
  assert(issueReview.groups.some(label => /missing quotation rates/i.test(label)));
  assert(issueReview.rateIssues > 0, 'Active missing quotation rates must remain visible for commercial review.');
  await page.click('[data-testid="selection-integrity-close"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="selection-integrity-issues"]'));
  stage = 'exercise canonical cabinetry review controls';
  await page.click('[data-testid="cabinetry-review-toggle"]');
  await page.waitForSelector('[data-testid="cabinetry-review-panel"]');
  const kitchenBulkhead = '[data-cabinetry-requirement="selection:CAB-kitchen-1791182975207"]';
  await page.type(`${kitchenBulkhead} input[type="number"]`, '2.75');
  await page.click(`${kitchenBulkhead} button`);
  await page.waitForFunction((selector) => !document.querySelector(selector), {}, kitchenBulkhead);
  const kitchenBenchtopRow = '[data-cabinetry-requirement="benchtop:kitchen:benchtop-main"]';
  await page.type(`${kitchenBenchtopRow} input[type="number"]`, '3.2');
  await page.click(`${kitchenBenchtopRow} button`);
  await page.waitForSelector(`${kitchenBenchtopRow} select`);
  const bathroomBenchtopRow = '[data-cabinetry-requirement="benchtop:main-bathroom:wallMountedVanity"]';
  await page.select(`${bathroomBenchtopRow} select`, 'base_range_stone');
  await page.click(`${bathroomBenchtopRow} button`);
  await page.waitForFunction((selector) => !document.querySelector(selector), {}, bathroomBenchtopRow);
  const cabinetryAfterInput = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    const issues = sheet.workbook.cabinetryReconciliation.entries.filter((entry) => entry.outcome === 'ACTION REQUIRED');
    const kitchen = issues.find((entry) => entry.requirementId === 'benchtop:kitchen:benchtop-main');
    const bathroom = sheet.workbook.cabinetryReconciliation.entries.find((entry) => entry.requirementId === 'benchtop:main-bathroom:wallMountedVanity');
    const bulkhead = sheet.workbook.cabinetryReconciliation.entries.find((entry) => entry.requirementId === 'selection:CAB-kitchen-1791182975207');
    return {
      attention: issues.length,
      kitchen: { reason: kitchen?.reason || '', finish: kitchen?.selectedFinish || '', action: kitchen?.action?.kind || '' },
      bathroom: { outcome: bathroom?.outcome || '', quantity: bathroom?.quantity, finish: bathroom?.selectedFinish || '' },
      bulkhead: { outcome: bulkhead?.outcome || '', quantity: bulkhead?.quantity },
    };
  });
  assert.deepEqual(cabinetryAfterInput, {
    attention: 7,
    kitchen: { reason: 'Benchtop range not selected', finish: 'Stone Ambassador Eclipse', action: 'choose-benchtop-range' },
    bathroom: { outcome: 'MATCHED', quantity: 1.95, finish: 'Base Range Stone' },
    bulkhead: { outcome: 'MATCHED', quantity: 2.75 },
  });
  await page.click('[data-testid="cabinetry-review-toggle"]');
  const reconciliationPreview = await page.evaluate(() => {
    const plan = window.__auditSheet().previewSelectionReconciliation();
    const requirements = new Set(['oven', 'cooktop', 'rangehood', 'dishwasher', 'internal-doors', 'door-hardware', 'interior-lighting', 'ceiling-fan', 'hot-water-system']);
    return {
      duplicates: plan.duplicates.length,
      blockingQuantityChanges: plan.blocking.length,
      financialApprovalRequired: plan.financialImpact.requiresApproval,
      unresolvedSoftwareTargets: plan.targetResults.filter((result) => requirements.has(result.requirementKey) && result.status !== 'TARGET_RESOLVED')
        .map((result) => `${result.requirementKey}:${result.productId}:${result.status}`),
      selectionRecords: plan.mutationSummary.selectionRecords,
      concreteProductDecisions: plan.mutationSummary.concreteProductDecisions,
      addedRows: plan.mutationSummary.addedRows,
      addedSelectionDecisions: plan.mutationSummary.addedSelectionDecisions,
      replacementRows: plan.mutationSummary.replacementRows,
      replacementSelectionDecisions: plan.mutationSummary.replacementSelectionDecisions,
      unownedMutations: plan.mutationSummary.unownedMutations.length,
    };
  });
  assert.deepEqual(reconciliationPreview, {
    duplicates: 0,
    blockingQuantityChanges: 0,
    financialApprovalRequired: true,
    unresolvedSoftwareTargets: [],
    selectionRecords: 43,
    concreteProductDecisions: 52,
    addedRows: 9,
    addedSelectionDecisions: 7,
    replacementRows: 4,
    replacementSelectionDecisions: 4,
    unownedMutations: 0,
  });
  const approvalGate = await page.evaluate(async () => {
    try {
      await window.__auditSheet().applySelectionReconciliation();
      return '';
    } catch (error) {
      return error?.message || String(error);
    }
  });
  assert.match(approvalGate, /explicitly approve/i, 'Reconciliation cannot change the quotation total without matching financial approval.');
  stage = 'apply explicit builder reconciliation decisions';
  const approvalResult = await page.evaluate(async () => {
    const sheet = window.__auditSheet();
    const initial = sheet.previewSelectionReconciliation();
    let confirmed = Object.fromEntries(initial.proposals.map((proposal) => [proposal.identityKey, '']));
    for (const proposal of initial.proposals.filter((item) => item.proposalKind !== 'NEW_QUOTE_ROW' && item.recommendedRowId)) {
      const candidateConfirmed = { ...confirmed, [proposal.identityKey]: proposal.recommendedRowId };
      const candidate = sheet.previewSelectionReconciliation({ confirmed: candidateConfirmed });
      if (!candidate.duplicates.length) {
        confirmed = candidateConfirmed;
        break;
      }
    }
    let preview = sheet.previewSelectionReconciliation({ confirmed });
    const approvedQuantities = Object.fromEntries(preview.quantityChecks.filter((check) => check.status !== 'DUPLICATE_LOCATION_ALIAS').map((check) => [check.rowId, true]));
    const approvedReplacement = preview.replacements.find((replacement) => replacement.proposedVariation !== null);
    const approvedBaselines = approvedReplacement ? { [approvedReplacement.rowId]: true } : {};
    preview = sheet.previewSelectionReconciliation({ confirmed, approvedBaselines, approvedQuantities });
    if (preview.duplicates.length || preview.blocking.length) throw new Error('Explicit acceptance decisions produced duplicate or blocked quotation changes.');
    const acknowledgedPending = [
      ...preview.held.map((item) => `target:${item.identityKey}`),
      ...preview.priceProblems.map((item) => `price:${item.identityKey}`),
      ...preview.replacements.filter((item) => approvedBaselines[item.rowId] !== true).map((item) => `baseline:${item.rowId}`),
      ...preview.fixtures.filter((item) => !item.target?.rowId).map((item) => `fixture:${item.key}`),
    ];
    const result = await sheet.applySelectionReconciliation({
      confirmed,
      approvedBaselines,
      approvedQuantities,
      acknowledgedPending,
      approvedFinancialImpact: preview.financialImpact,
      saveForBuilder: false,
    });
    return {
      result,
      expectedTotal: preview.financialImpact.after,
      approvedFinancialDelta: preview.financialImpact.delta,
      approvedBaseline: approvedReplacement?.rowId || '',
      mappedTarget: Object.entries(confirmed).find(([, rowId]) => rowId)?.[0] || '',
      acknowledgedPendingCount: acknowledgedPending.length,
    };
  });
  await page.waitForFunction((expectedTotal) => {
    const sheet = window.__auditSheet();
    return (sheet.workbook.selectionReconciliationDecisionLog || []).length === 1
      && sheet.preview.summary.finalQuoteTotal === expectedTotal;
  }, { timeout: 120000 }, approvalResult.expectedTotal);
  const approvalState = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    const log = sheet.workbook.selectionReconciliationDecisionLog || [];
    const decision = log.at(-1);
    const audit = sheet.productSelectionIntegrity();
    return {
      jobId: sheet.workbook.jobId,
      total: sheet.preview.summary.finalQuoteTotal,
      decisionCount: log.length,
      decisionJobId: decision?.jobId || '',
      financialApproved: decision?.financialImpact?.approved === true,
      pendingCount: decision?.acknowledgedPending?.length || 0,
      duplicateCount: audit.duplicates.length,
      duplicates: audit.duplicates,
      financialBlockers: audit.blocked.length,
      unpricedSelectionProcurementCount: (sheet.workbook.procurement?.items || [])
        .filter((item) => (item.quoteRequired === true || item.costPending === true) && item.approvedForOrdering !== true)
        .length,
    };
  });
  assert.equal(approvalState.jobId, jobId);
  assert.equal(approvalState.decisionJobId, jobId);
  assert.equal(approvalState.total, approvalResult.expectedTotal);
  assert.equal(approvalState.decisionCount, 1);
  assert.equal(approvalState.financialApproved, true);
  assert.equal(approvalState.pendingCount, approvalResult.acknowledgedPendingCount);
  assert.equal(approvalState.duplicateCount, 0, `Approved reconciliation introduced duplicate quotation claims: ${JSON.stringify(approvalState.duplicates)}`);
  assert(approvalState.financialBlockers > 0, 'Pending commercial decisions must continue to block financial approval.');
  stage = 'approve one verified retail-reference proposal';
  const priceProposalApproval = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    const entry = sheet.productSelectionIntegrity().entries.find((item) => item.productId === 'master-INT-GAINSBOROUGH-105BAISC');
    const rowId = entry?.quoteRowIds?.[0];
    const section = entry?.section;
    if (!entry || !rowId || !section) throw new Error('The exact Bailey passage-set quotation target is unavailable.');
    const options = {
      proposalId: 'retail-reference:gainsborough:105baisc:2026-10-22',
      section,
      rowId,
      gstIncluded: true,
    };
    const impact = sheet.previewCommercialPriceProposal(options);
    sheet.applyCommercialPriceProposal({ ...options, approvedFinancialImpact: impact });
    return { productId: entry.productId, rowId, section, impact };
  });
  await page.waitForFunction((expectedTotal) => window.__auditSheet().preview.summary.finalQuoteTotal === expectedTotal, { timeout: 120000 }, priceProposalApproval.impact.after);
  const approvedProposalState = await page.evaluate((rowId) => {
    const sheet = window.__auditSheet();
    const row = Object.values(sheet.workbook.quotation).flatMap((section) => section.rows || []).find((item) => item.id === rowId);
    return {
      total: sheet.preview.summary.finalQuoteTotal,
      proposalId: row?.commercialPriceApproval?.proposalId || '',
      retailReferencePrice: row?.commercialPriceApproval?.retailReferencePrice || null,
      gstIncluded: row?.commercialPriceApproval?.gstIncluded,
      manualRateApproved: row?.manualRateApproved === true,
      manualRateSource: row?.manualRateSource || '',
    };
  }, priceProposalApproval.rowId);
  assert.equal(approvedProposalState.total, priceProposalApproval.impact.after);
  assert.equal(approvedProposalState.proposalId, 'retail-reference:gainsborough:105baisc:2026-10-22');
  assert.equal(approvedProposalState.retailReferencePrice, 47.04);
  assert.equal(approvedProposalState.gstIncluded, true);
  assert.equal(approvedProposalState.manualRateApproved, true);
  assert.equal(approvedProposalState.manualRateSource, 'verified-retail-reference');
  const acceptedTotal = priceProposalApproval.impact.after;
  const saveResult = await page.evaluate(() => window.__auditSheet().saveDraft());
  assert.equal(saveResult.ok, true, 'Dedicated quotation job saves before commercial sync.');

  stage = 'sync real commercial snapshot';
  const clickCommercialSync = () => page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Sync to Project Commercials');
    if (!button) throw new Error('Sync to Project Commercials button is not visible.');
    button.click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((item) => item.textContent?.trim() === 'Sync to Project Commercials'));
  await clickCommercialSync();
  await page.waitForSelector('[data-testid="commercial-sync-status"][data-state="syncing"]');
  await page.waitForFunction(() => ['success', 'error'].includes(document.querySelector('[data-testid="commercial-sync-status"]')?.dataset.state), { timeout: 180000 });
  const firstSyncStatus = await page.$eval('[data-testid="commercial-sync-status"]', element => ({ state: element.dataset.state, message: element.textContent || '' }));
  assert.equal(firstSyncStatus.state, 'success', firstSyncStatus.message);
  await waitForSyncResponseCount(syncResponses, 1);
  assert.equal(syncResponses.length, 1);
  assert.equal(syncResponses[0].status, 200);
  assert.equal(syncResponses[0].body.ok, true);
  testProjectId = syncResponses[0].body.project_id;
  testSnapshotId = syncResponses[0].body.snapshot_id;
  assert(testProjectId && testSnapshotId);

  const afterAssociation = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    return { jobId: sheet.workbook.jobId, workspaceId: sheet.workbook.workspaceId, projectId: sheet.workbook.commercialProjectId, snapshotId: sheet.workbook.commercialSnapshotId, total: sheet.preview.summary.finalQuoteTotal };
  });
  assert.deepEqual(afterAssociation, { jobId, workspaceId, projectId: testProjectId, snapshotId: testSnapshotId, total: acceptedTotal });

  stage = 'verify persisted commercial rows';
  const persistedCounts = await countCommercialRecords(testProjectId, testSnapshotId);
  const expectedPersistedUnpricedCount = expectedUnpricedProcurementCount
    + approvalState.unpricedSelectionProcurementCount
    - initialUnpricedSelectionProcurementCount;
  assert.equal(persistedCounts.projectsForJob, 1);
  assert.equal(persistedCounts.snapshotsForJob, 1);
  assert(persistedCounts.boqItems > 0);
  assert(persistedCounts.procurementItems > procurementDraftCount);
  assert.equal(persistedCounts.unpricedDrafts, expectedPersistedUnpricedCount, 'Commercial persistence preserves every projected genuine unpriced procurement item.');

  stage = 'verify idempotent repeated sync';
  await clickCommercialSync();
  await page.waitForSelector('[data-testid="commercial-sync-status"][data-state="syncing"]');
  await page.waitForFunction(() => ['success', 'error'].includes(document.querySelector('[data-testid="commercial-sync-status"]')?.dataset.state), { timeout: 180000 });
  const repeatedSyncStatus = await page.$eval('[data-testid="commercial-sync-status"]', element => ({ state: element.dataset.state, message: element.textContent || '' }));
  assert.equal(repeatedSyncStatus.state, 'success', repeatedSyncStatus.message);
  await waitForSyncResponseCount(syncResponses, 2);
  assert.equal(syncResponses.length, 2);
  assert.equal(syncResponses[1].status, 200);
  assert.equal(syncResponses[1].body.already_synced, true, 'Identical sync must reuse the complete current snapshot.');
  assert.equal(syncResponses[1].body.project_id, testProjectId);
  assert.equal(syncResponses[1].body.snapshot_id, testSnapshotId);
  const afterRepeat = await countCommercialRecords(testProjectId, testSnapshotId);
  assert.deepEqual(afterRepeat, persistedCounts, 'Repeated sync must not duplicate project, snapshot, BOQ or procurement rows.');

  const quoteSignature = () => page.evaluate(async () => {
    const sheet = window.__auditSheet();
    const meaningful = (value) => value === undefined || value === null || value === '' ? null : value;
    const quotation = Object.fromEntries(Object.entries(sheet.workbook.quotation || {}).map(([section, group]) => [
      section,
      (group.rows || []).map((row) => ({
        id: row.id,
        item: row.item,
        quantity: meaningful(row.qty ?? row.quantity),
        unit: meaningful(row.unit),
        formulas: row.formulas || {},
        excelRate: meaningful(row.excelRate),
        supplierCatalogueRate: meaningful(row.supplierCatalogueRate),
        quotedSupplierRate: meaningful(row.quotedSupplierRate),
        manualRate: meaningful(row.manualRate),
        supplierQuote: meaningful(row.supplierQuote),
        sourceOfRate: meaningful(row.sourceOfRate),
        variation: meaningful(row.variation),
        quantityKey: meaningful(row.quantityKey),
        active: row.active !== false,
        selectedProductId: meaningful(row.selectedProductId),
        selectionIdentityKey: meaningful(row.selectionIdentityKey),
        selectionInclusionStatus: meaningful(row.selectionInclusionStatus),
        selectionSpecificationOnly: row.selectionSpecificationOnly === true,
        manualRateApproved: row.manualRateApproved === true,
        manualRateSource: meaningful(row.manualRateSource),
        commercialPriceApproval: row.commercialPriceApproval || null,
      })),
    ]));
    const parts = {
      quotation,
      quotationSectionOrder: sheet.workbook.quotationSectionOrder,
      cashflowPayments: sheet.workbook.cashflowPayments,
      purchaseOrders: sheet.workbook.purchaseOrders,
      jobInclusionSnapshot: sheet.workbook.jobInclusionSnapshot,
      summaryAdjustments: sheet.workbook.summaryAdjustments,
      selectionReconciliationDecisionLog: sheet.workbook.selectionReconciliationDecisionLog,
    };
    const rowFingerprints = {};
    for (const [section, rows] of Object.entries(quotation)) {
      rows.forEach((row, index) => {
        const text = JSON.stringify(row);
        let hash = 2166136261;
        for (let offset = 0; offset < text.length; offset += 1) hash = Math.imul(hash ^ text.charCodeAt(offset), 16777619);
        rowFingerprints[`${section}:${row.id}:${index}`] = (hash >>> 0).toString(16).padStart(8, '0');
      });
    }
    const hashes = {};
    for (const [key, value] of Object.entries(parts)) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value ?? null)));
      hashes[`${key}Hash`] = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return {
      ...hashes,
      rowFingerprints,
      rows: Object.values(sheet.workbook.quotation || {}).reduce((total, section) => total + (section.rows || []).length, 0),
      total: sheet.preview.summary.finalQuoteTotal,
      decisions: (sheet.workbook.selectionReconciliationDecisionLog || []).length,
    };
  });
  stage = 'verify saved quotation hard refresh and reopen';
  const savedQuoteSignature = await quoteSignature();
  const assertQuoteSignature = (actual, expected, message) => {
    const changedRows = [...new Set([...Object.keys(actual.rowFingerprints), ...Object.keys(expected.rowFingerprints)])]
      .filter((key) => actual.rowFingerprints[key] !== expected.rowFingerprints[key]);
    const { rowFingerprints: _actualRows, ...actualSummary } = actual;
    const { rowFingerprints: _expectedRows, ...expectedSummary } = expected;
    assert.deepEqual({ ...actualSummary, changedRows }, { ...expectedSummary, changedRows: [] }, message);
  };
  const hardRefreshStartedAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction((id, project, snapshot) => {
    const workbook = window.__auditSheet?.()?.workbook;
    return workbook?.jobId === id && workbook.commercialProjectId === project && workbook.commercialSnapshotId === snapshot;
  }, { timeout: 120000 }, jobId, testProjectId, testSnapshotId);
  const hardRefreshMs = Date.now() - hardRefreshStartedAt;
  assertQuoteSignature(await quoteSignature(), savedQuoteSignature, 'Hard refresh preserves quotation, totals and payment/baseline data.');

  const reopenStartedAt = Date.now();
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction((id, project, snapshot) => {
    const workbook = window.__auditSheet?.()?.workbook;
    return workbook?.jobId === id && workbook.commercialProjectId === project && workbook.commercialSnapshotId === snapshot;
  }, { timeout: 120000 }, jobId, testProjectId, testSnapshotId);
  const reopenMs = Date.now() - reopenStartedAt;
  assertQuoteSignature(await quoteSignature(), savedQuoteSignature, 'Reopen preserves the same quotation and financial values.');
  await page.waitForSelector('[data-testid="selection-integrity-warning"]', { timeout: 120000 });
  await page.click('[data-testid="selection-integrity-review"]');
  await page.waitForSelector('[data-testid="selection-integrity-issues"]');
  const finalIssueIds = await page.$$eval('[data-commercial-issue-id]', (elements) => elements.map((element) => element.getAttribute('data-commercial-issue-id')));
  assert.deepEqual(finalIssueIds.filter((id) => !issueReview.issueIds.includes(id)), [], 'Approved reconciliation must not create new commercial issue identities.');
  const afterScreenshot = path.join(outputDir, `${jobId}-canonical-issues-reopen.png`);
  await page.screenshot({ path: afterScreenshot, fullPage: true });
  const reopenedCabinetry = await page.evaluate(() => {
    const sheet = window.__auditSheet();
    const issues = sheet.workbook.cabinetryReconciliation.entries.filter((entry) => entry.outcome === 'ACTION REQUIRED');
    const kitchen = issues.find((entry) => entry.requirementId === 'benchtop:kitchen:benchtop-main');
    const bathroom = sheet.workbook.cabinetryReconciliation.entries.find((entry) => entry.requirementId === 'benchtop:main-bathroom:wallMountedVanity');
    const bulkhead = sheet.workbook.cabinetryReconciliation.entries.find((entry) => entry.requirementId === 'selection:CAB-kitchen-1791182975207');
    return {
      attention: issues.length,
      kitchen: { reason: kitchen?.reason || '', finish: kitchen?.selectedFinish || '', action: kitchen?.action?.kind || '' },
      bathroom: { outcome: bathroom?.outcome || '', quantity: bathroom?.quantity, finish: bathroom?.selectedFinish || '' },
      bulkhead: { outcome: bulkhead?.outcome || '', quantity: bulkhead?.quantity },
    };
  });
  assert.deepEqual(reopenedCabinetry, cabinetryAfterInput, 'Cabinetry review inputs must survive save, hard refresh and reopen.');
  await page.click('[data-testid="selection-integrity-close"]');
  const reopenedProposalState = await page.evaluate((rowId) => {
    const row = Object.values(window.__auditSheet().workbook.quotation).flatMap((section) => section.rows || []).find((item) => item.id === rowId);
    return {
      proposalId: row?.commercialPriceApproval?.proposalId || '',
      retailReferencePrice: row?.commercialPriceApproval?.retailReferencePrice || null,
      gstIncluded: row?.commercialPriceApproval?.gstIncluded,
      manualRateApproved: row?.manualRateApproved === true,
      manualRateSource: row?.manualRateSource || '',
    };
  }, priceProposalApproval.rowId);
  assert.deepEqual(reopenedProposalState, {
    proposalId: approvedProposalState.proposalId,
    retailReferencePrice: approvedProposalState.retailReferencePrice,
    gstIncluded: approvedProposalState.gstIncluded,
    manualRateApproved: approvedProposalState.manualRateApproved,
    manualRateSource: approvedProposalState.manualRateSource,
  }, 'Approved retail-reference evidence must persist through save, hard refresh and reopen.');
  report.passed = true;
  report.projectId = testProjectId;
  report.snapshotId = testSnapshotId;
  report.syncResponses = syncResponses.map(({ status, body }) => ({ status, project_id: body.project_id, snapshot_id: body.snapshot_id, already_synced: body.already_synced === true, counts: body.counts }));
  report.recordCounts = persistedCounts;
  report.quoteTotalBeforeApproval = quoteTotal;
  report.quoteTotal = acceptedTotal;
  report.approvalWorkflow = { ...approvalResult, ...approvalState };
  report.issueRootCountAfterGrouping = compactWarning.issueCount;
  report.liveCanonicalSummary = liveCanonicalSummary;
  report.issueIdentities = { original: issueReview.issueIds, final: finalIssueIds };
  report.reconciliationAccounting = reconciliationPreview;
  report.cabinetryAttention = cabinetryAttention;
  report.cabinetryIssues = cabinetryIssues;
  report.cabinetryAfterInput = cabinetryAfterInput;
  report.cabinetryReopen = reopenedCabinetry;
  report.windowStatus = windowStatus[0].text;
  report.screenshots = { before: beforeScreenshot, reopen: afterScreenshot };
  report.priceProposalApproval = { ...priceProposalApproval, state: approvedProposalState };
  report.reloadTimings = { hardRefreshMs, reopenMs };
  report.procurementDrafts = procurementDraftCount;
  report.windowRfqEntries = windows.procurementSchedule.length;
  report.protectedSourceUnchanged = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex') === expectedSourceHash;
  assert.equal(report.protectedSourceUnchanged, true);
  fs.writeFileSync(path.join(outputDir, `${jobId}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failedStage = stage;
  report.error = error?.message || String(error);
  if (diagnosticPage) {
    report.failurePage = {
      url: diagnosticPath(diagnosticPage.url()),
      visibleAlerts: await diagnosticPage.$$eval('[role="alert"]', (elements) => elements
        .map((element) => (element.textContent || '').trim()).filter(Boolean).slice(0, 5)).catch(() => []),
      visibleButtonLabels: await diagnosticPage.$$eval('button', (elements) => elements
        .filter((element) => element.getClientRects().length)
        .map((element) => (element.textContent || '').trim()).filter(Boolean).slice(0, 20)).catch(() => []),
      commercialSyncStatus: await diagnosticPage.$eval('[data-testid="commercial-sync-status"]', (element) => ({
        state: element.dataset.state || '',
        text: (element.textContent || '').trim(),
      })).catch(() => null),
      persistenceStatus: await diagnosticPage.$eval('[data-testid="job-persistence-status"]', (element) => (element.textContent || '').trim()).catch(() => ''),
      browserLocks: await diagnosticPage.evaluate(() => navigator.locks?.query()).catch(() => null),
    };
  }
  report.syncResponses = syncResponses;
  report.passed = false;
  report.protectedSourceUnchanged = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex') === expectedSourceHash;
  fs.writeFileSync(path.join(outputDir, `${jobId}-failed.json`), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch((error) => { report.browserCloseWarning = error?.message || String(error); });
  if (userId) {
    try {
      await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
      await admin.from('accounts').delete().eq('user_id', userId);
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) report.cleanupWarning = deleted.error.message;
    } catch (error) {
      report.cleanupWarning = error?.message || String(error);
    }
  }
}

async function createWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = data.user;
  userId = user.id;
  const account = {
    user_id: user.id, email, full_name: 'Quotation Acceptance Test', business_name: 'Quotation Acceptance',
    approved: true, is_approved: true, status: 'approved', subscription_status: 'active',
    onboarding_completed: true, phone_verified: true, email_verified: true,
  };
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

async function countCommercialRecords(projectId, snapshotId) {
  const [projects, snapshots, boq, procurement, unpriced] = await Promise.all([
    admin.from('builder_commercial_projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('source_workbook_job_id', jobId),
    admin.from('builder_estimate_snapshots').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('source_workbook_job_id', jobId),
    admin.from('builder_boq_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId),
    admin.from('builder_procurement_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('snapshot_id', snapshotId).eq('order_status', 'quote_required').eq('metadata->>quoteRequired', 'true').eq('metadata->>approvedForOrdering', 'false'),
  ]);
  for (const result of [projects, snapshots, boq, procurement, unpriced]) if (result.error) throw result.error;
  const projectQuery = await admin.from('builder_commercial_projects').select('id,workspace_id,source_workbook_job_id').eq('id', projectId).maybeSingle();
  const snapshotQuery = await admin.from('builder_estimate_snapshots').select('id,workspace_id,project_id,source_workbook_job_id,status,workbook_metadata').eq('id', snapshotId).maybeSingle();
  if (projectQuery.error) throw projectQuery.error;
  if (snapshotQuery.error) throw snapshotQuery.error;
  assert.equal(projectQuery.data?.workspace_id, workspaceId);
  assert.equal(projectQuery.data?.source_workbook_job_id, jobId);
  assert.equal(snapshotQuery.data?.workspace_id, workspaceId);
  assert.equal(snapshotQuery.data?.project_id, projectId);
  assert.equal(snapshotQuery.data?.source_workbook_job_id, jobId);
  assert.equal(snapshotQuery.data?.status, 'current');
  return {
    projectsForJob: projects.count || 0,
    snapshotsForJob: snapshots.count || 0,
    currentSnapshotId: snapshotQuery.data.id,
    signaturePresent: Boolean(snapshotQuery.data.workbook_metadata?.source_workbook_signature),
    boqItems: boq.count || 0,
    procurementItems: procurement.count || 0,
    unpricedDrafts: unpriced.count || 0,
  };
}

async function waitForSyncResponseCount(responses, expected) {
  const deadline = Date.now() + 10000;
  while (responses.length < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(responses.length, expected, `Expected ${expected} authenticated sync response(s).`);
}