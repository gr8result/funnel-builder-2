import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

// Disposable browser storage and mocked remote services; never touches a real job.
dotenv.config({ path: '.env.local', quiet: true });
const baseUrl = process.env.DATA_INPUT_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-results/data-input-stability');
fs.mkdirSync(out, { recursive: true });
const jobId = 'data-input-stability-regression';
const jobKey = `job:${jobId}`;
const recoveryFixture = process.env.DATA_INPUT_RECOVERY_FIXTURE !== '0';
const report = { passed: false, recoveryFixture, errors: [], samples: [] };
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  defaultViewport: { width: 1600, height: 1000 },
  protocolTimeout: 180000,
});
console.log('Browser started');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
try {
  page = await newPage();
  await page.goto(`${baseUrl}/recovered-takeoff.html`);
  console.log('Seeding isolated workbook');
  await page.evaluate(async ({ jobId, jobKey, recoveryFixture }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('estimate-builder-template-db', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('templates');
        request.result.createObjectStore('jobs');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const workbook = {
      jobId, templateType: 'job', page: 'dataInput', savedAt: '2026-09-29T00:00:00Z',
      data: { inputDataSheet: { collapsed: false, rows: {
        projectName: { value: 'Data Input stability test' },
        lowerFloorAreaM2: { value: '100' }, lowerGarageAreaM2: { value: '20' },
        lowerOtherAreaM2: { value: '0' }, lowerAlfrescoAreaM2: { value: '0' }, lowerPorchAreaM2: { value: '0' },
      } } },
      aiPlanTakeoffJob: { takeoffId: 'stability', completedWallRuns: [{ id: 'wall', page: 1, level: 'Ground Floor', category: 'interior', lengthMm: 10000, thicknessMm: 90, nodes: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] }], placedOpenings: [] },
      retainedDocument: { text: 'x'.repeat(8 * 1024 * 1024) },
    };
    const takeoff = { ...workbook.aiPlanTakeoffJob, pixelsPerMm: 1, updatedAt: '2026-09-29T00:00:00Z', plan: { type: 'embedded-pages', totalPages: 1, pages: [{ pageNumber: 1, width: 1, height: 1, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAAAAABJRU5ErkJggg==' }] } };
    if (recoveryFixture) workbook.aiPlanTakeoffJob = {};
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['jobs', 'templates'], 'readwrite');
      tx.objectStore('jobs').put({ key: jobKey, type: 'job', jobId, name: 'Data Input stability test', revision: 1, workbook }, jobKey);
      for (let revision = 1; revision <= 12; revision++) {
        const key = `${jobKey}:snapshot:revision-${revision}`;
        tx.objectStore('jobs').put({ key, revision, savedAt: '2026-09-29T00:00:00Z', workbook: { aiPlanTakeoffJob: takeoff, document: 's'.repeat(1024 * 1024) } }, key);
        tx.objectStore('templates').put({ type: 'master-template-backup', key: `backup:${revision}`, workbook: { document: 't'.repeat(1024 * 1024) } }, `backup:${revision}`);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    sessionStorage.setItem('estimate-builder-explicit-active-job-key', jobKey);
    localStorage.setItem('estimate-builder-explicit-active-job-key', jobKey);
  }, { jobId, jobKey, recoveryFixture });
  console.log('Opening Data Input');
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitInput('lowerFloorAreaM2', '100');
  await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) throw new Error('React commit instrumentation is unavailable');
    const commit = hook.onCommitFiberRoot;
    hook.onCommitFiberRoot = function(...args) { window.__stabilityCounts.commits++; return commit?.apply(this, args); };
  });
  console.log('PASS Data Input opens');
  if (recoveryFixture) {
    await page.waitForFunction(() => window.__stabilitySheet()?.workbook.aiPlanTakeoffJob?.completedWallRuns?.length === 1);
    console.log('PASS takeoff recovery from saved history');
  }
  await edit('lowerFloorAreaM2', '150');
  await page.waitForFunction(() => window.__stabilitySheet()?.preview.quantities.lowerSlabAreaM2 === 170);
  await waitStored('150');
  console.log('PASS edit, recalculation and autosave');
  await edit('lowerFloorAreaM2', '175');
  await click('Save Job');
  await waitStored('175');
  await page.waitForFunction(() => document.querySelector('[data-testid="job-persistence-status"]')?.textContent.includes('Saved at'));
  console.log('PASS manual save');
  await edit('lowerFloorAreaM2', '180');
  await waitStored('180');
  await edit('lowerFloorAreaM2', '175');
  await waitStored('175');
  await page.waitForFunction(() => window.__stabilitySheet()?.persistenceStatus.state === 'saved' && !window.__stabilitySheet()?.dirty);
  console.log('PASS autosave continues after a manual save');
  for (let i = 0; i < 3; i++) {
    await click('Calculations');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'formulaSheet');
    await click('Quote Sheet');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === 'quotation');
    await click('Data Input');
    await waitInput('lowerFloorAreaM2', '175');
  }
  console.log('PASS repeated tab navigation');
  await pause(6000);
  const client = await page.createCDPSession();
  const duration = Number(process.env.DATA_INPUT_SOAK_SECONDS || 120);
  for (let elapsed = 0; elapsed <= duration; elapsed += 10) {
    if (elapsed) await pause(10000);
    await client.send('HeapProfiler.collectGarbage');
    const heap = await client.send('Runtime.getHeapUsage');
    const dom = await client.send('Memory.getDOMCounters');
    const state = await page.evaluate(() => ({ ...window.__stabilityCounts, navigationId: window.__stabilityNavigationId, value: document.querySelector('#data-edit-inputDataSheet-lowerFloorAreaM2')?.value, total: window.__stabilitySheet()?.preview.quantities.lowerSlabAreaM2 }));
    report.samples.push({ elapsed, heap: heap.usedSize, ...dom, ...state });
    console.log('IDLE', JSON.stringify(report.samples.at(-1)));
  }
  const first = report.samples[0], last = report.samples.at(-1);
  assert.equal(last.value, '175');
  assert.equal(last.total, 195);
  assert.equal(last.navigationId, first.navigationId, 'Idle page must not reload');
  assert.equal(last.calculations, first.calculations, 'Idle does not recalculate');
  assert.equal(last.commits, first.commits, 'Idle does not render');
  assert.ok(last.heap - first.heap < 5 * 1024 * 1024, 'Retained heap remains stable');
  assert.equal(last.nodes, first.nodes, 'DOM nodes do not accumulate');
  assert.equal(last.bulkReads, 0, 'Startup must not materialize all saved jobs or templates');
  await page.screenshot({ path: path.join(out, 'data-input.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitInput('lowerFloorAreaM2', '175');
  await page.waitForFunction(() => window.__stabilitySheet()?.preview.quantities.lowerSlabAreaM2 === 195);
  console.log('PASS saved workbook reopens and recalculates');
  await page.close();

  // A transient storage failure keeps its pointer for a later reload. It must not
  // launch a fresh asynchronous restore on every state/status render.
  page = await newPage(true);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__stabilityCounts.failedReads > 0);
  await pause(4000);
  const reads = await page.evaluate(() => window.__stabilityCounts.failedReads);
  await pause(4000);
  const laterReads = await page.evaluate(() => window.__stabilityCounts.failedReads);
  report.failedRestoreReads = { reads, laterReads };
  assert.equal(laterReads, reads, 'Failed restores stop retrying until reload or a different job is requested');
  assert.ok(reads <= 8, `Restore requests are bounded: ${reads}`);
  console.log('PASS failed restoration stays idle');
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) {
    report.page = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 5000), counts: window.__stabilityCounts })).catch(() => null);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  }
  console.error(report.page);
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

async function newPage(failReads = false) {
  const next = await browser.newPage();
  next.setDefaultTimeout(180000);
  next.on('pageerror', e => { report.errors.push(e.message); console.error('PAGE ERROR', e.stack); });
  next.on('error', e => report.errors.push(e.message));
  next.on('requestfailed', r => console.error('REQUEST FAILED', r.url(), r.failure()?.errorText));
  next.on('response', r => { if (r.status() >= 400) console.error('HTTP', r.status(), r.url()); });
  next.on('console', message => { if (message.type() === 'error') console.error('BROWSER', message.text().slice(0, 300)); });
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'stability@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  await next.setRequestInterception(true);
  next.on('request', request => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return request.continue();
    if (url.origin === new URL(baseUrl).origin && !url.pathname.startsWith('/api/')) return request.continue();
    let body = {};
    if (url.pathname.includes('/auth/v1/user')) body = user;
    else if (url.pathname.includes('/rest/v1/accounts')) body = { approved: true, is_approved: true, status: 'active', subscription_status: 'active' };
    else if (url.pathname === '/api/workspaces') body = { workspaces: [] };
    else if (url.pathname.includes('/rest/v1/')) body = [];
    return request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) });
  });
  const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  await next.evaluateOnNewDocument(({ authKey, user, failReads, jobKey }) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    window.__stabilityCounts = { commits: 0, calculations: 0, failedReads: 0, bulkReads: 0 };
    window.__stabilityNavigationId = crypto.randomUUID();
    const getAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function(...args) {
      if (['jobs', 'templates'].includes(this.name)) window.__stabilityCounts.bulkReads++;
      return getAll.apply(this, args);
    };
    const log = console.log;
    console.log = (...args) => { if (args[0] === 'Estimate Builder summary recalculation') window.__stabilityCounts.calculations++; log(...args); };
    window.__stabilitySheet = () => {
      const element = document.querySelector('#data-edit-inputDataSheet-projectName');
      let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
      if (!fiber) return null;
      while (fiber.return) fiber = fiber.return;
      const stack = [fiber.stateNode.current];
      while (stack.length) {
        const current = stack.pop();
        if (current.memoizedProps?.sheet?.workbook) return current.memoizedProps.sheet;
        if (current.sibling) stack.push(current.sibling);
        if (current.child) stack.push(current.child);
      }
    };
    if (failReads) {
      const get = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.get = function(key) {
        if (this.name !== 'jobs' || key !== jobKey) return get.call(this, key);
        window.__stabilityCounts.failedReads++;
        const request = { error: new Error('Synthetic storage read failure') };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      };
    }
  }, { authKey, user, failReads, jobKey });
  return next;
}

async function waitInput(key, value) {
  await page.waitForFunction((key, value) => document.querySelector(`#data-edit-inputDataSheet-${key}`)?.value === value, {}, key, value);
}
async function edit(key, value) {
  const input = await page.$(`#data-edit-inputDataSheet-${key}`);
  await input.click({ clickCount: 3 });
  await input.type(value);
  await input.press('Tab');
  await waitInput(key, value);
}
async function click(label) {
  await page.evaluate(label => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === label && !button.disabled);
    if (!button) throw new Error(`Missing button ${label}`);
    button.click();
  }, label);
}
async function waitStored(value) {
  await page.waitForFunction(async ({ jobKey, value }) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const record = await new Promise((resolve, reject) => { const r = db.transaction('jobs').objectStore('jobs').get(jobKey); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close();
    return record?.workbook?.data?.inputDataSheet?.rows?.lowerFloorAreaM2?.value === value && record?.workbook?.retainedDocument?.text?.length === 8 * 1024 * 1024;
  }, {}, { jobKey, value });
}
