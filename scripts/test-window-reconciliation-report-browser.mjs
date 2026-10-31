import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

dotenv.config({ path: '.env.local', quiet: true });
const origin = process.argv.find((argument) => argument.startsWith('--origin='))?.slice(9) || 'http://localhost:3000';
const source = 'C:/Users/grant/Downloads/New Job 03 09.gr8job';
const output = path.resolve(process.argv.find((argument) => argument.startsWith('--output='))?.slice(9) || 'artifacts/test-artifacts/window-reconciliation-audit');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(fs.readFileSync(source));
const zip = await JSZip.loadAsync(fs.readFileSync(source));
const workbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
const jobId = 'gr8-window-report-audit-20261014';
const workspaceId = workbook.workspaceId;
const commercialProjectId = '00000000-0000-4000-8000-000000000101';
const commercialSnapshotId = '00000000-0000-4000-8000-000000000102';
const isolatedName = 'Isolated window report audit';
const isolated = {
  ...structuredClone(workbook),
  id: jobId,
  jobId,
  projectId: jobId,
  registeredJobId: jobId,
  commercialProjectId,
  jobName: isolatedName,
  registeredJob: { ...(workbook.registeredJob || {}), jobId, jobName: isolatedName, jobNumber: 'TEST-WINDOW-20261014' },
  jobFileMeta: {
    ...(workbook.jobFileMeta || {}),
    projectId: jobId,
    jobName: isolatedName,
    jobNumber: 'TEST-WINDOW-20261014',
    sourceProjectId: jobId,
    recoveredFromProtectedJob: false,
  },
  page: 'quotation',
};
// The Project Estimate editor carries roughly 93 MB of artwork in this legacy fixture.
// It is not consumed by the Quotation Builder route; keep quotation, selections and takeoff
// calculation fields intact while avoiding unrelated editor assets in this browser regression.
delete isolated.projectEstimateBuilder;
const captureScreenshots = process.argv.includes('--screenshots');
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'window-audit@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const report = { passed: false, jobId, protectedSourceHash: sourceHash, errors: [], externalWrites: [], commercialRecordsMocked: true };
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true, pipe: true, userDataDir: path.join(output, `browser-profile-${crypto.randomUUID()}`), executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', defaultViewport: { width: 1600, height: 1100 }, protocolTimeout: 600000 });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return request.continue();
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return request.continue();
    if (!['GET', 'OPTIONS'].includes(request.method())) report.externalWrites.push({ method: request.method(), path: url.pathname });
    const body = url.pathname.includes('/auth/v1/user') ? user : url.pathname.includes('/rest/v1/accounts') ? { approved: true, is_approved: true, status: 'active', subscription_status: 'active' } : url.pathname === '/api/workspaces' ? { workspaces: [{ id: workspaceId, name: 'Isolated window audit workspace', role: 'owner', plan: 'enterprise' }] } : url.searchParams.get('resource') === 'requirementMappings' ? { records: [] } : [];
    let responseBody = body;
    if (url.pathname.endsWith('/builder_commercial_projects')) responseBody = [
      { id: '00000000-0000-4000-8000-000000000199', workspace_id: workspaceId, source_workbook_job_id: 'unrelated-job', project_name: 'Unrelated project must never be selected' },
      { id: commercialProjectId, workspace_id: workspaceId, source_workbook_job_id: jobId, project_name: 'Isolated linked window project', status: 'active' },
    ];
    if (url.pathname.endsWith('/builder_estimate_snapshots')) responseBody = [
      { id: commercialSnapshotId, workspace_id: workspaceId, project_id: commercialProjectId, source_workbook_job_id: jobId, snapshot_number: 1, status: 'current' },
    ];
    return request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(responseBody) });
  });
  await page.evaluateOnNewDocument(({ authKey, user, workspaceId, jobId }) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    localStorage.setItem('active_workspace_id', workspaceId);
    localStorage.setItem('estimate-builder-explicit-active-job-key', `job:${jobId}`);
    sessionStorage.setItem('estimate-builder-explicit-active-job-key', `job:${jobId}`);
    localStorage.setItem('estimate-builder-permission-mode', 'admin');
    window.__auditSheet = () => {
      let fiber;
      for (const element of document.querySelectorAll('#__next, input, button')) {
        fiber = element[Object.keys(element).find((key) => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'))];
        if (fiber) break;
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
  }, { authKey, user, workspaceId, jobId });
  report.phase = 'open disposable profile';
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  report.phase = 'externalize assets with existing repository helper';
  await page.evaluate(async (source) => {
    const assetStorage = await import(`data:text/javascript;base64,${btoa(source)}`);
    window.__auditExternalize = assetStorage.externalizeTakeoffPlanPages;
  }, fs.readFileSync('components/construction-estimation/ai-plan-takeoff/planBlobStorage.js', 'utf8'));
  for (const field of ['aiPlanTakeoffJob', 'takeoffEngine']) {
    const encoded = await page.evaluate(async (partial) => window.__auditExternalize(partial), { [field]: isolated[field] });
    isolated[field] = encoded[field];
  }
  for (const field of ['quotation', 'quotationSectionOrder', 'cashflowPayments', 'purchaseOrders', 'procurement', 'jobInclusionSnapshot', 'summaryAdjustments']) assert.deepEqual(isolated[field], workbook[field], `${field} preserved before browser storage`);
  report.fixtureBytes = JSON.stringify(isolated).length;
  report.omittedForQuotationBrowser = ['projectEstimateBuilder'];
  report.assetCount = 0;
  report.phase = 'seed isolated workbook';
  await page.evaluate(async ({ workbook, workspaceId }) => {
    const databaseName = workspaceId === '846885cd-25b9-4eca-b9f9-3fd02f5882d8' ? 'estimate-builder-template-db' : `estimate-builder-template-db:workspace:${encodeURIComponent(workspaceId || 'anonymous-local')}`;
    await new Promise((resolve, reject) => {
      const open = indexedDB.open(databaseName, 2);
      open.onupgradeneeded = () => { for (const store of ['jobs', 'templates']) if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store); };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction('jobs', 'readwrite');
        transaction.objectStore('jobs').put({ key: `job:${workbook.jobId}`, type: 'job', jobId: workbook.jobId, name: workbook.jobName, workbook, revision: 1, schemaVersion: 3, jobSchemaVersion: 3, savedAt: new Date().toISOString() }, `job:${workbook.jobId}`);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    });
  }, { workbook: isolated, workspaceId });
  report.phase = 'open isolated quotation route';
  await page.goto(`${origin}/modules/estimate-builder?jobId=${jobId}&page=quotation`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  try {
    await page.waitForFunction((jobId) => window.__auditSheet?.()?.hydrated && window.__auditSheet().workbook.jobId === jobId, { timeout: 120000 }, jobId);
    report.routeHydrated = true;
  } catch (error) {
    report.routeHydrated = false;
    report.routeBlocker = { message: error.message, body: await page.$eval('body', (element) => element.innerText.slice(0, 4000)) };
    report.routeIdentity = await page.evaluate(async (expectedJobId) => {
      const workspaceId = localStorage.getItem('active_workspace_id') || '';
      const databaseName = workspaceId === '846885cd-25b9-4eca-b9f9-3fd02f5882d8'
        ? 'estimate-builder-template-db'
        : `estimate-builder-template-db:workspace:${encodeURIComponent(workspaceId || 'anonymous-local')}`;
      const stored = await new Promise((resolve) => {
        const request = indexedDB.open(databaseName, 2);
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('jobs', 'readonly').objectStore('jobs').get(`job:${expectedJobId}`);
          read.onsuccess = () => { db.close(); resolve(read.result || null); };
          read.onerror = () => { db.close(); resolve(null); };
        };
      });
      return {
        requestedJobId: expectedJobId,
        urlJobId: new URLSearchParams(location.search).get('jobId') || '',
        activeWorkspaceId: workspaceId,
        sessionActiveJobKey: sessionStorage.getItem('estimate-builder-explicit-active-job-key') || '',
        localActiveJobKey: localStorage.getItem('estimate-builder-explicit-active-job-key') || '',
        storedRecordJobId: stored?.workbook?.jobId || '',
        storedRecordName: stored?.name || stored?.workbook?.jobFileMeta?.jobName || '',
        renderedJobId: window.__auditSheet?.()?.workbook?.jobId || '',
        renderedJobName: window.__auditSheet?.()?.workbook?.jobFileMeta?.jobName || '',
      };
    }, jobId);
    if (captureScreenshots) await page.screenshot({ path: path.join(output, 'route-blocked.png'), fullPage: false });
    throw new Error(`Full route did not hydrate; component-only fallback is not accepted: ${report.errors[0] || report.routeBlocker.body || error.message}`);
  }
  report.phase = 'two read-only report previews';
  const signature = () => page.evaluate(() => {
    const workbook = window.__auditSheet().workbook;
    return JSON.stringify(Object.fromEntries(['quotation', 'quotationSectionOrder', 'cashflowPayments', 'purchaseOrders', 'procurement', 'jobInclusionSnapshot', 'summaryAdjustments'].map((key) => [key, workbook[key]])));
  });
  const before = await signature();
  const snapshots = [];
  for (const attempt of [1, 2]) {
    await page.click('[data-testid="reconcile-selections-open"]');
    await page.waitForSelector('[data-testid="reconcile-saved-windows"]');
    const summary = await page.$eval('[data-testid="reconcile-saved-requirements"]', (element) => ({ visible: element.innerText, html: element.outerHTML }));
    assert(!summary.visible.includes('quote-windows-list-'), 'raw catalogue IDs must not appear in visible report summaries');
    const windowRow = await page.$eval('[data-testid="reconcile-saved-windows"]', (element) => element.closest('tr').innerText);
    assert(windowRow.includes('30'), 'actual schedule must show 30 in-scope windows/glazed doors');
    await page.$eval('[data-testid="reconcile-diagnostics-windows"]', (element) => { element.open = true; });
    const dimensionalRows = await page.$$eval('[data-testid="reconcile-diagnostics-windows"] table tbody tr', (rows) => rows.map((row) => row.innerText));
    assert.equal(dimensionalRows.length, 14, 'window review must contain actual type/dimension groups, not catalogue alternatives');
    const diagnosticCount = await page.$$eval('[data-testid="reconcile-diagnostics-windows"] li', (elements) => elements.length);
    assert(diagnosticCount <= 8, 'technical diagnostic candidates must be bounded');
    snapshots.push({ attempt, windowRow, dimensionalRows, diagnosticCount });
    if (captureScreenshots) await page.screenshot({ path: path.join(output, `browser-preview-${attempt}.png`), fullPage: false });
    await page.$eval('[data-testid="reconcile-selections-preview"] header button', (button) => button.click());
    assert.equal(await signature(), before, 'opening and closing report preview must preserve quotation, order, PO/payment/baseline data');
  }
  assert.deepEqual(snapshots[0].dimensionalRows, snapshots[1].dimensionalRows, 'repeated browser preview must be identical');
  report.snapshots = snapshots;
  const financialSignature = () => page.evaluate(() => {
    const sheet = window.__auditSheet();
    return { jobId: sheet.workbook.jobId, total: sheet.preview.summary.finalQuoteTotal, protectedFields: JSON.stringify(Object.fromEntries(['quotation', 'quotationSectionOrder', 'cashflowPayments', 'purchaseOrders', 'jobInclusionSnapshot', 'summaryAdjustments'].map((key) => [key, sheet.workbook[key]]))) };
  });
  const originalFinancial = await financialSignature();
  report.phase = 'refresh existing procurement pipeline on isolated copy';
  await page.evaluate(() => window.__auditSheet().refreshProcurementListFromQuote());
  await page.waitForFunction(() => window.__auditSheet().workbook.procurement.items.some((item) => String(item.quoteRowId || '').startsWith('quote-windows-unpriced-window-')));
  const procurementMapping = () => page.evaluate(() => {
    const sheet = window.__auditSheet();
    const rows = Object.entries(sheet.preview.quotation).flatMap(([section, group]) => group.rows.map((row) => ({ section, ...row }))).filter((row) => String(row.quantityKey || '').startsWith('windowPriceList:window|') && Number(row.qty) > 0);
    return rows.map((row) => ({ quoteRowId: row.id, type: row.windowType, quantity: row.qty, cost: row.cost, rate: row.finalRateUsed, procurement: sheet.workbook.procurement.items.filter((item) => item.quoteRowId === row.id && !item.removedFromQuote).map((item) => ({ id: item.id, quantity: item.qty, rate: item.estimatedRate, cost: item.estimatedTotal })) }));
  });
  report.procurementMapping = await procurementMapping();
  assert.equal(report.procurementMapping.length, 14);
  assert.equal(report.procurementMapping.reduce((sum, row) => sum + row.quantity, 0), 30);
  assert(report.procurementMapping.every((row) => row.procurement.length === 1 && row.procurement[0].quantity === row.quantity), 'each dimensional quote group must have exactly one matching procurement requirement');
  assert.deepEqual(await financialSignature(), originalFinancial, 'procurement refresh must not alter quotation, total, overrides or payments');
  report.supplierRequirements = await page.evaluate(async () => {
    const workbook = window.__auditSheet().workbook;
    const integrityModule = await import('/lib/builders/productSelectionIntegrity.js').catch(() => null);
    const windows = workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows).find((row) => row.guidedSelection?.requirementKey === 'windows').guidedSelection;
    return { rfqCount: windows.procurementSchedule.length, uniqueOpeningIds: new Set(windows.procurementSchedule.map((item) => String(item.windowId))).size, audit: integrityModule?.reconcileProductSelections?.({ workbook }) || null };
  });
  assert.equal(report.supplierRequirements.rfqCount, 30);
  assert.equal(report.supplierRequirements.uniqueOpeningIds, 30);
  const quotationIdentity = () => page.evaluate(() => {
    const sheet = window.__auditSheet();
    const workbook = sheet.workbook;
    const quotation = workbook.quotation || {};
    return {
      jobId: workbook.jobId,
      workspaceId: workbook.workspaceId || workbook.workspace_id,
      rowCount: Object.values(quotation).reduce((sum, section) => sum + (section.rows || []).length, 0),
      sectionOrder: workbook.quotationSectionOrder || [],
      sectionRows: Object.fromEntries(Object.entries(quotation).map(([name, section]) => [name, (section.rows || []).map((row) => ({ id: row.id, productId: row.productId || row.activeProductId || row.selectedProductId || '', quantity: row.quantity ?? row.qty ?? '', rate: row.finalRateUsed ?? row.excelRate ?? '', manualRate: row.manualRate ?? '', formulas: row.formulas || {} }))])),
      selectedProductIds: [...new Set((workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).flatMap((row) => {
        const selection = row.guidedSelection || row.selected_details || {};
        return [selection.productId, selection.canonicalProductId, ...(selection.selectedProducts || []).map((product) => product.productId || product.id)];
      }).filter(Boolean))].sort(),
      total: sheet.preview.summary.finalQuoteTotal,
    };
  });
  const identityBeforeSave = await quotationIdentity();
  assert.equal(identityBeforeSave.jobId, jobId, 'Never save if the requested isolated job is not the active workbook.');
  assert.equal(identityBeforeSave.workspaceId, workspaceId);
  assert.equal(identityBeforeSave.total, originalFinancial.total);
  const firstProcurement = await page.evaluate(() => JSON.stringify(window.__auditSheet().workbook.procurement.items));
  await page.evaluate(() => window.__auditSheet().refreshProcurementListFromQuote());
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const repeatedProcurement = await page.evaluate(() => JSON.stringify(window.__auditSheet().workbook.procurement.items));
  if (repeatedProcurement !== firstProcurement) {
    const before = JSON.parse(firstProcurement);
    const after = JSON.parse(repeatedProcurement);
    const index = Math.max(0, before.findIndex((item, itemIndex) => JSON.stringify(item) !== JSON.stringify(after[itemIndex])));
    const beforeItem = before[index] || null;
    const afterItem = after[index] || null;
    const changedFields = [...new Set([...Object.keys(beforeItem || {}), ...Object.keys(afterItem || {})])]
      .filter((key) => JSON.stringify(beforeItem?.[key]) !== JSON.stringify(afterItem?.[key]));
    const changes = Object.fromEntries(changedFields.map((key) => [key, { before: beforeItem?.[key], after: afterItem?.[key] }]));
    throw new Error(`Repeated procurement refresh changed item ${index}: ${beforeItem?.id || "<missing>"} -> ${afterItem?.id || "<missing>"}; changes: ${JSON.stringify(changes)}`);
  }
  assert.deepEqual(await financialSignature(), originalFinancial, 'repeated procurement refresh must preserve all financial values');
  report.phase = 'save isolated job';
  report.identityBeforeSave = identityBeforeSave;
  report.saveResult = await page.evaluate(() => window.__auditSheet().saveDraft());
  assert.notEqual(report.saveResult?.ok, false, 'isolated save must succeed');
  report.phase = 'hard refresh saved isolated job';
  await page.reload({ waitUntil: [], timeout: 30000 });
  await page.waitForFunction((jobId) => window.__auditSheet?.()?.hydrated && window.__auditSheet().workbook.jobId === jobId, {}, jobId);
  assert.deepEqual(await financialSignature(), originalFinancial, 'hard refresh must retain financial content');
  assert.deepEqual(await quotationIdentity(), identityBeforeSave, 'hard refresh preserves quotation row IDs, products, quantities, manual rates, formulas and order.');
  assert.deepEqual(await procurementMapping(), report.procurementMapping, 'hard refresh must retain all thirty opening procurement mappings');
  report.phase = 'reopen isolated job from local storage';
  await page.goto(`${origin}/modules/estimate-builder?jobId=${jobId}&page=quotation`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction((jobId) => window.__auditSheet?.()?.hydrated && window.__auditSheet().workbook.jobId === jobId, {}, jobId);
  assert.deepEqual(await financialSignature(), originalFinancial, 'reopen must retain total and financial content');
  assert.deepEqual(await quotationIdentity(), identityBeforeSave, 'reopen preserves quotation row IDs, products, quantities, manual rates, formulas and order.');
  report.phase = 'visit BOQ and procurement routes';
  report.routes = {};
  for (const view of ['boq', 'supplierProcurement', 'procurement']) {
    await page.goto(`${origin}/modules/estimate-builder?jobId=${jobId}&page=${view}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction((view) => {
      const text = document.body.innerText;
      const expected = view === 'boq' ? /bill of quantities|BOQ/i : view === 'supplierProcurement' ? /Supplier & Procurement/ : /Procurement Schedule/i;
      const headings = [...document.querySelectorAll('h1, h2, h3')].map((element) => element.innerText);
      return !text.includes('Preparing Estimate Builder') && headings.some((heading) => expected.test(heading));
    }, {}, view);
    report.routes[view] = await page.$eval('body', (element) => element.innerText.slice(-10000));
    if (view === 'procurement') {
      const verifyAssociation = async () => {
        await page.waitForFunction(({ projectId, snapshotId }) => {
          const selects = [...document.querySelectorAll('select')];
          return selects.some((select) => select.value === projectId && select.disabled) && selects.some((select) => select.value === snapshotId && select.disabled);
        }, {}, { projectId: commercialProjectId, snapshotId: commercialSnapshotId });
      };
      await verifyAssociation();
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
      await verifyAssociation();
      await page.goto(`${origin}/modules/estimate-builder?jobId=${jobId}&page=procurement`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await verifyAssociation();
      report.procurementAssociation = { projectId: commercialProjectId, snapshotId: commercialSnapshotId, saveRefreshReopenPassed: true, sourceJobId: jobId };
    }
    if (captureScreenshots) await page.screenshot({ path: path.join(output, `full-route-${view}.png`), fullPage: false });
  }
  report.phase = 'verify isolated records after downstream navigation';
  await page.goto(`${origin}/modules/estimate-builder?jobId=${jobId}&page=quotation`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction((jobId) => window.__auditSheet?.()?.hydrated && window.__auditSheet().workbook.jobId === jobId, {}, jobId);
  assert.deepEqual(await financialSignature(), originalFinancial, 'downstream navigation must retain total and financial content');
  assert.deepEqual(await procurementMapping(), report.procurementMapping, 'downstream navigation must retain all opening requirements');
  assert.deepEqual(await quotationIdentity(), identityBeforeSave, 'downstream routes preserve the saved quotation and selected-product identities.');
  report.fullRouteWorkflowPassed = true;
  report.commercialSnapshotVerified = false;
  report.finalIsolatedFinancial = await financialSignature();
  report.protectedUnchanged = hash(fs.readFileSync(source)) === sourceHash;
  assert(report.protectedUnchanged);
  assert.equal(report.errors.length, 0, 'browser must not have runtime errors');
  report.passed = true;
  console.log('PASS full isolated route: two reconciliation previews, 30-opening procurement mapping, save, refresh, reopen, BOQ/procurement route visits; financial content unchanged. Live commercial snapshot remains unverified.');
} catch (error) {
  report.failure = error.stack || error.message;
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  report.protectedUnchanged = hash(fs.readFileSync(source)) === sourceHash;
  assert(report.protectedUnchanged, 'protected package must remain byte-identical even when browser acceptance fails');
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}