import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

// Runs against the development app using a disposable browser and synthetic data.
// Every API and remote request is intercepted; no real user session is required.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const baseUrl = process.env.JOB_SETUP_TAKEOFF_BASE_URL || 'http://localhost:3000';
const outDir = path.resolve(root, process.env.JOB_SETUP_TAKEOFF_ARTIFACT_DIR || 'artifacts/test-results/job-setup-takeoff-browser');
fs.mkdirSync(outDir, { recursive: true });
const jobId = 'synthetic-job-setup-takeoff-browser';
const jobKey = `job:${jobId}`;
const projectName = 'Synthetic takeoff import verification';
const savedAt = '2026-09-10T00:00:00.000Z';
const rectangle = (widthM, depthM) => [
  { x: 0, y: 0 }, { x: widthM * 1000, y: 0 },
  { x: widthM * 1000, y: depthM * 1000 }, { x: 0, y: depthM * 1000 },
];
const floor = (id, type, page, width, depth) => ({ id, type, page, level: page === 1 ? 'Ground Floor' : 'Second Level', nodes: rectangle(width, depth) });
const takeoff = {
  schemaVersion: 'ai-plan-takeoff.v1',
  takeoffId: 'synthetic-takeoff-browser', jobName: projectName, takeoffName: projectName,
  associatedProjectId: jobId, platformProject: { projectId: jobId, projectName },
  projectInfo: { projectName, clientName: 'Synthetic Client', siteAddress: '1 Fixture Street' },
  revision: 1, currentPage: 1, totalPages: 2, pixelsPerMm: 1,
  planFilename: 'synthetic-plan.pdf',
  plan: { type: 'embedded-pages', totalPages: 2, pages: [] },
  completedFloorplans: [
    floor('ground-footprint', 'Footprint', 1, 20, 12),
    floor('ground-garage', 'Garage', 1, 6, 6),
    floor('ground-alfresco', 'Alfresco', 1, 6, 3),
    floor('ground-porch', 'Porch', 1, 3, 2),
    floor('upper-footprint', 'Footprint', 2, 10, 10),
    floor('upper-balcony', 'Balcony', 2, 5, 2),
  ],
  completedWallRuns: [
    { id: 'ground-exterior', page: 1, level: 'Ground Floor', category: 'exterior', exteriorClass: 'Brick Veneer', lengthMm: 64000, thicknessMm: 230, nodes: [{ x: 0, y: 0 }, { x: 64000, y: 0 }] },
    { id: 'ground-interior', page: 1, level: 'Ground Floor', category: 'interior', lengthMm: 32000, thicknessMm: 90, nodes: [{ x: 0, y: 0 }, { x: 32000, y: 0 }] },
  ],
  completedAreas: [], completedEaves: [],
  placedOpenings: [{ id: 'fixture-exterior-window', page: 1, level: 'Ground Floor', hostWallId: 'ground-exterior', openingClass: 'Window', widthMm: 1200, heightMm: 900 }],
  completedMeasurements: [],
};
const initialValues = {
  projectName, clientName: 'Existing Client', projectAddress: 'Existing Address',
  lowerFloorAreaM2: '77', lowerGarageAreaM2: '', lowerAlfrescoAreaM2: '', lowerPorchAreaM2: '',
  lowerOtherAreaM2: '4', upperFloorAreaM2: '', upperGarageAreaM2: '9', upperAlfrescoAreaM2: '',
  upperPorchAreaM2: '', upperOtherAreaM2: '', balconyAreaM2: '',
  thirdFloorAreaM2: '', thirdGarageAreaM2: '', thirdAlfrescoAreaM2: '', thirdPorchAreaM2: '', upperBalconyAreaM2: '',
  lowerExternalWallsLm: '', lowerInternalWallsLm: '', marginPercent: '23',
};
const fixture = {
  key: jobKey, type: 'job', jobId, name: projectName, savedAt, revision: 1,
  workbook: {
    jobId, templateType: 'job', page: 'dataInput', savedAt,
    data: { inputDataSheet: { collapsed: false, customRows: INPUT_DATA_SHEET_TEMPLATE.rows.filter((row) => row.section === 'Takeoff Mappings' || row.key === 'heading_takeoff_mappings').map((row) => ({ ...row })), rows: Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, { value, notes: key === 'lowerFloorAreaM2' ? 'Keep this estimator note' : '' }])) } },
    aiPlanTakeoffJob: takeoff,
  },
};
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(chromePath) ? chromePath : undefined),
  defaultViewport: { width: 1600, height: 1000 },
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const runtimeErrors = [];
const blockedWrites = [];
let page;
try {
  page = await newPage();
  // A static page establishes this disposable profile's localhost origin.
  await page.goto(`${baseUrl}/recovered-takeoff.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ fixture, jobKey }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('estimate-builder-template-db', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('templates');
        request.result.createObjectStore('jobs');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('jobs', 'readwrite');
      transaction.objectStore('jobs').put(fixture, jobKey);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    sessionStorage.setItem('estimate-builder-explicit-active-job-key', jobKey);
    localStorage.setItem('estimate-builder-explicit-active-job-key', jobKey);
  }, { fixture, jobKey });

  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitForInput('projectName', projectName);
  await page.waitForSelector('[data-testid="job-setup-takeoff-import"]');
  await verifyRecoveredJobSetup();
  await clickButton('Import takeoff quantities');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Import selected quantities'));
  await page.screenshot({ path: path.join(outDir, '01-review.png'), fullPage: false });

  // Explicitly select measured quantity rows, including the existing ground area.
  // Leave project identity replacements unchecked; they are not measurements.
  const reviewRows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="job-setup-takeoff-import"] tr')].filter((row) => row.querySelector('input[type="checkbox"]')).map((row) => ({ text: row.innerText, checked: row.querySelector('input[type="checkbox"]').checked })));
  assert.ok(reviewRows.length >= 6, 'Review exposes the measured floor quantities');
  await page.evaluate(() => {
    for (const row of document.querySelectorAll('[data-testid="job-setup-takeoff-import"] tr')) {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox || checkbox.disabled) continue;
      const identity = /project name|client(?: name)?|project address|site address/i.test(row.innerText);
      if (checkbox.checked === identity) checkbox.click();
    }
  });
  await clickButton('Import selected quantities');
  const expected = {
    lowerFloorAreaM2: '180', lowerGarageAreaM2: '36', lowerAlfrescoAreaM2: '18', lowerPorchAreaM2: '6',
    upperFloorAreaM2: '90', balconyAreaM2: '10', lowerOtherAreaM2: '4', upperGarageAreaM2: '9',
    lowerExternalWallsLm: '64', lowerInternalWallsLm: '32', marginPercent: '23',
    clientName: 'Existing Client', projectAddress: 'Existing Address',
  };
  for (const [key, value] of Object.entries(expected)) await waitForInput(key, value);
  const imported = await mountedWorkbook();
  assert.equal(imported.workbook.data.inputDataSheet.customRows.length, 0, 'Saved canonical mapping copies migrate out of customRows');
  const mappingCount = Object.keys(imported.workbook.data.inputDataSheet.rows).length;
  assert.equal(imported.workbook.data.inputDataSheet.rows.lowerFloorAreaM2.notes, 'Keep this estimator note');
  assert.equal(imported.preview.quantities.lowerSlabAreaM2, 244, 'Ground slab recalculates from imported areas and retained Other area');
  assert.equal(imported.preview.quantities.secondLevelFloorAreaM2, 109, 'Second level recalculates from living, balcony, and retained garage');
  await page.screenshot({ path: path.join(outDir, '02-imported.png'), fullPage: false });

  await clickButton('Save Job');
  // Verify both the committed record and the visible save status.
  await page.waitForFunction(async ({ jobKey, revision }) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(jobKey); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    return record?.revision > revision && record.workbook?.data?.inputDataSheet?.customRows?.length === 0;
  }, {}, { jobKey, revision: fixture.revision });
  await page.waitForFunction(() => document.querySelector('[data-testid="job-persistence-status"]')?.innerText.includes('Saved at'));
  const persisted = await storedJob();
  const saveStatusText = await page.$eval('[data-testid="job-persistence-status"]', (element) => element.innerText);
  assert.ok(persisted.revision > fixture.revision, 'Import is saved as a new job revision');
  for (const [key, value] of Object.entries(expected)) assert.equal(String(persisted.workbook.data.inputDataSheet.rows[key].value), value, `${key} is saved`);
  assert.equal(persisted.workbook.aiPlanTakeoffJob.completedFloorplans.length, takeoff.completedFloorplans.length, 'Takeoff source is retained');

  // Destroy React and session storage by opening a fresh tab, then restore the job
  // using the same local pointer that a normal application reopen uses.
  await page.close();
  page = await newPage();
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  for (const [key, value] of Object.entries(expected)) await waitForInput(key, value);
  await page.screenshot({ path: path.join(outDir, '03-reopened.png'), fullPage: false });
  const reopened = await mountedWorkbook();
  assert.equal(reopened.workbook.data.inputDataSheet.customRows.length, 0, 'Reopening does not regenerate canonical mapping copies');
  assert.equal(Object.keys(reopened.workbook.data.inputDataSheet.rows).length, mappingCount, 'Mapping row count is unchanged after saving and a full browser remount');
  assert.equal(reopened.preview.quantities.lowerSlabAreaM2, 244);
  assert.equal(reopened.preview.quantities.secondLevelFloorAreaM2, 109);
  await verifyRecoveredJobSetup();
  assert.deepEqual(runtimeErrors, [], 'No browser runtime errors');
  const report = { ok: true, jobId, saveStatusText, mappingCount, reviewRows, expected, calculated: { lowerSlabAreaM2: 244, secondLevelFloorAreaM2: 109 }, savedRevision: persisted.revision, fullUnmountAndReopen: true, blockedWrites, runtimeErrors, outDir };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (page && !page.isClosed()) {
    fs.writeFileSync(path.join(outDir, 'failure-state.json'), JSON.stringify({ error: error.stack, runtimeErrors, state: await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 16000) })) }, null, 2));
    await page.screenshot({ path: path.join(outDir, 'failure.png'), fullPage: false }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}

async function newPage() {
  const next = await browser.newPage();
  next.setDefaultTimeout(60000);
  next.on('pageerror', (error) => runtimeErrors.push(error.stack || error.message));
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'takeoff-import@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  const account = { approved: true, is_approved: true, status: 'active', subscription_status: 'active', business_name: 'Synthetic import test' };
  await next.setRequestInterception(true);
  next.on('request', (request) => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return request.continue();
    if (url.origin !== new URL(baseUrl).origin || url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) blockedWrites.push({ method: request.method(), path: url.pathname });
      let body = {};
      if (url.pathname.includes('/auth/v1/user')) body = user;
      else if (url.pathname.includes('/rest/v1/accounts')) body = account;
      else if (url.pathname === '/api/workspaces') body = { workspaces: [] };
      else if (url.pathname.includes('/rest/v1/')) body = [];
      return request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) });
    }
    return request.continue();
  });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  assert.ok(supabaseUrl, 'Public Supabase URL is required only to derive the mocked auth storage key');
  const authKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  await next.evaluateOnNewDocument(({ authKey, user }) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: 'synthetic-import-token', refresh_token: 'synthetic-import-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    localStorage.setItem('estimate-builder-permission-mode', 'admin');
  }, { authKey, user });
  return next;
}

async function clickButton(label) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === label && !button.disabled), {}, label);
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label && !item.disabled);
    button.scrollIntoView({ block: 'center' });
    button.click();
  }, label);
}

async function verifyRecoveredJobSetup() {
  assert.equal(await page.$('[data-estimate-builder-live-summary="true"]'), null, 'Job Setup uses the recovered layout without the quotation summary');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === 'Window Schedule').length), 1, 'One Window Schedule tab is mounted');
  await clickButton('Window Schedule');
  await page.waitForFunction(() => document.body.innerText.includes('fixture-exterior-window'));
  assert.equal(new URL(page.url()).searchParams.get('page'), 'windowSchedule', 'The tab opens the measured takeoff schedule');
  const scheduleRow = await page.evaluate(() => [...document.querySelectorAll('tr')].find((row) => row.innerText.includes('fixture-exterior-window'))?.innerText);
  assert.match(scheduleRow, /1\.08/, 'Window area is calculated from the real fixture dimensions');
  assert.match(scheduleRow, /ground-exterior/, 'The window retains its measured wall connection');
  await clickButton('Data Input');
  await waitForInput('projectName', projectName);
  await page.waitForSelector('[data-testid="job-setup-takeoff-import"]');
}

async function waitForInput(key, expected) {
  const selector = `#data-edit-inputDataSheet-${key}`;
  await page.waitForFunction((selector, expected) => document.querySelector(selector)?.value === expected, {}, selector, expected).catch(async (error) => {
    const actual = await page.$eval(selector, (input) => input.value).catch(() => 'missing');
    throw new Error(`${key}: expected ${expected}, received ${actual}. ${error.message}`);
  });
}

async function mountedWorkbook() {
  return page.evaluate(() => {
    const element = document.querySelector('#data-edit-inputDataSheet-projectName');
    let fiber = element?.[Object.keys(element).find((key) => key.startsWith('__reactFiber$'))];
    while (fiber) {
      if (fiber.memoizedProps?.sheet?.workbook) return JSON.parse(JSON.stringify({ workbook: fiber.memoizedProps.sheet.workbook, preview: fiber.memoizedProps.sheet.preview }));
      fiber = fiber.return;
    }
    throw new Error('Mounted workbook and calculated preview not found');
  });
}

async function storedJob() {
  return page.evaluate((key) => new Promise((resolve, reject) => {
    const open = indexedDB.open('estimate-builder-template-db', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), jobKey);
}
