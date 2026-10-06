import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { readJob } from '../lib/jobFile.ts';

// Real Next/React UI, isolated Chrome storage, synthetic plan/measurements and
// mocked remote services. No customer account or existing file is modified.
dotenv.config({ path: '.env.local', quiet: true });
const baseUrl = process.env.MASTER_JOB_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-results/master-job-workflow');
fs.mkdirSync(out, { recursive: true });
const name = 'Michael and Sarah Johnson';
const report = { passed: false, name, steps: [], errors: [], dialogs: [], samples: [] };
const source = ts.createSourceFile('takeoff.jsx', fs.readFileSync('components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const component = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'AIPlanTakeoffStandalone');
const indexes = {};
let index = 0;
(function visit(node) {
  if (ts.isFunctionLike(node) && node !== component) return;
  if (ts.isCallExpression(node) && /^use(State|Ref|Effect|Callback|Memo)$/.test(node.expression.getText(source))) {
    const d = node.parent;
    if (ts.isVariableDeclaration(d)) indexes[ts.isArrayBindingPattern(d.name) ? d.name.elements[0].name.getText(source) : d.name.getText(source)] = index;
    index++;
    return;
  }
  ts.forEachChild(node, visit);
})(component.body);
console.log('Starting isolated Chrome');
const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', defaultViewport: { width: 1600, height: 1100 }, protocolTimeout: 180000, timeout: 90000, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
console.log('Chrome started');
const page = await browser.newPage();
page.setDefaultTimeout(90000);
page.on('pageerror', error => { report.errors.push(error.message); console.error(error.message); });
page.on('dialog', async dialog => { report.dialogs.push(dialog.message()); await dialog.accept(); });
page.on('console', msg => { if (msg.type() === 'error') console.error('BROWSER', msg.text().slice(0, 350)); });
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'master-job@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (!['http:', 'https:'].includes(url.protocol)) return request.continue();
  if (url.origin === new URL(baseUrl).origin && !url.pathname.startsWith('/api/')) return request.continue();
  let body = {};
  if (url.pathname.includes('/auth/v1/user')) body = user;
  else if (url.pathname.includes('/rest/v1/accounts')) body = { approved: true, is_approved: true, status: 'active', subscription_status: 'active' };
  else if (url.pathname === '/api/workspaces') body = { workspaces: [] };
  else if (url.pathname.includes('/rest/v1/')) body = [];
  request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) });
});
const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
await page.evaluateOnNewDocument(({ authKey, user }) => {
  localStorage.setItem(authKey, JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  localStorage.setItem('estimate-builder-permission-mode', 'admin');
  window.__masterFileName = '';
  window.showSaveFilePicker = async options => {
    window.__masterFileName = options.suggestedName;
    // Native handles are cloneable into the real recent-file IndexedDB store.
    // OPFS keeps these test files entirely inside this disposable browser profile.
    const directory = await navigator.storage.getDirectory();
    return directory.getFileHandle(options.suggestedName, { create: true });
  };
  window.__findFiber = predicate => {
    const element = document.querySelector('#__next');
    let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactContainer$'))];
    if (!fiber) {
      for (const el of document.querySelectorAll('input,button')) {
        fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber$'))];
        if (fiber) break;
      }
    }
    if (!fiber) return null;
    while (fiber.return) fiber = fiber.return;
    const stack = [fiber.stateNode.current];
    while (stack.length) {
      const current = stack.pop();
      if (predicate(current)) return current;
      if (current.sibling) stack.push(current.sibling);
      if (current.child) stack.push(current.child);
    }
    return null;
  };
  window.__sheet = () => window.__findFiber(f => Boolean(f.memoizedProps?.sheet?.workbook))?.memoizedProps.sheet;
  window.__takeoff = () => window.__findFiber(f => f.type?.name === 'AIPlanTakeoffStandalone');
  window.__readJob = key => new Promise((resolve, reject) => {
    const open = indexedDB.open('estimate-builder-template-db', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const request = db.transaction('jobs').objectStore('jobs').get(key); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; };
  });
}, { authKey, user });
try {
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await click('File');
  await click('Create New Job');
  await page.waitForSelector('[aria-label="Create new job"]');
  await page.evaluate(name => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const label of document.querySelectorAll('[aria-label="Create new job"] label')) {
      const input = label.querySelector('input');
      const value = { 'Job Name': name, 'Client Name': name, 'Job Number': 'MSJ-001', Address: '10 Test Street, Brisbane' }[label.querySelector('span')?.textContent];
      if (input && value) { set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  }, name);
  await click('Create Job');
  await waitInput('projectName', name);
  const jobId = await page.evaluate(() => window.__sheet().workbook.jobId);
  report.jobId = jobId;
  assert.match(jobId, /^[0-9a-f-]{36}$/i);
  await saveComputer();
  const created = await lastFile();
  assert.equal(created.data.jobId, jobId);
  assert.equal(created.data.workbook.jobId, jobId);
  pass('Create once in Job Setup and save a master .gr8job with permanent UUID');

  // A fresh page without an active pointer proves discovery from Takeoff itself.
  await page.evaluate(() => { sessionStorage.removeItem('estimate-builder-explicit-active-job-key'); localStorage.removeItem('estimate-builder-explicit-active-job-key'); });
  await page.goto(`${baseUrl}/modules/estimate-builder?page=aiPlanTakeoff`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-testid="takeoff-open-master-job"]');
  await page.click('[data-testid="takeoff-open-master-job"]');
  await page.waitForSelector(`[data-testid="master-job-option"][data-job-id="${jobId}"]`);
  const matches = await page.$$(`[data-testid="master-job-option"][data-job-id="${jobId}"]`);
  assert.equal(matches.length, 1);
  await page.screenshot({ path: path.join(out, '01-shared-job-picker.png') });
  await matches[0].click();
  await page.waitForFunction(jobId => window.__takeoff()?.memoizedProps.initialJob?.masterJobId === jobId && !document.querySelector('#ai-plan-takeoff-save-button')?.disabled, {}, jobId);
  assert.equal(await page.evaluate(() => window.__takeoff().memoizedProps.initialJob.plan?.pages?.length || 0), 0);
  pass('AI Plan Takeoff lists the Job Setup job and creates its linked empty workspace');

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1000;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1200, 1000);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(100, 100, 900, 800);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#333'; ctx.fillText('Michael and Sarah Johnson - synthetic plan', 100, 50);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const planPath = path.join(out, 'johnson-plan.png'); fs.writeFileSync(planPath, Buffer.from(png, 'base64'));
  await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(planPath);
  console.log('Plan imported; waiting for master draft publication');
  await page.waitForFunction(() => window.__takeoff()?.memoizedProps.initialJob?.plan?.pages?.length === 1);
  // Set deterministic measured geometry at the real component's editing boundary.
  // The component's effects, schedule, autosave, import and calculations remain real.
  await page.evaluate(indexes => {
    const hooks = []; let h = window.__takeoff().memoizedState; while (h) { hooks.push(h); h = h.next; }
    hooks[indexes.pixelsPerMm].queue.dispatch(0.1);
    const floor = (id, type, width, height) => ({ id, type, page: 1, level: 'Ground Floor', nodes: [{ x: 100, y: 100 }, { x: 100 + width, y: 100 }, { x: 100 + width, y: 100 + height }, { x: 100, y: 100 + height }] });
    hooks[indexes.completedFloorplans].queue.dispatch([floor('johnson-footprint', 'Footprint', 1000, 1000), floor('johnson-garage', 'Garage', 400, 500)]);
  }, indexes);
  await page.waitForFunction(() => window.__takeoff()?.memoizedProps.initialJob?.completedFloorplans?.length === 2);
  await page.waitForFunction(async jobId => (await window.__readJob(`job:${jobId}`))?.workbook.aiPlanTakeoffJob?.completedFloorplans?.length === 2, {}, jobId);
  await click('Save Progress');
  await page.waitForFunction(() => /Saved.*Revision [1-9]/.test(document.body.innerText));
  pass('Imported plan and measured results autosave and manually save to the same master job');

  await navigate('dataInput');
  await waitInput('projectName', name);
  await click('Import takeoff quantities');
  await click('Import selected quantities');
  await waitInput('lowerFloorAreaM2', '80');
  await waitInput('lowerGarageAreaM2', '20');
  await page.waitForFunction(() => window.__sheet()?.preview.quantities.lowerSlabAreaM2 === 100);
  assert.equal(await page.evaluate(() => window.__sheet().workbook.jobId), jobId);
  await page.screenshot({ path: path.join(out, '02-quantities-imported.png') });
  pass('Job Setup imports only this job’s takeoff and automatically recalculates the quotation');

  await page.evaluate(() => {
    const sheet = window.__sheet();
    const inclusions = sheet.workbook.standardInclusions || { packages: [{ id: 'johnson-standard', name: 'Johnson Standard Inclusions', active: true }] };
    const packageId = inclusions.packages[0].id;
    return sheet.updateStandardInclusions({ ...inclusions, selectedPackageId: packageId }, { persist: true });
  });
  await navigate('standardInclusions');
  await page.waitForFunction(() => document.body.innerText.includes('Standard Inclusions'));
  await navigate('quotation');
  await page.waitForFunction(() => window.__sheet()?.preview.quantities.lowerSlabAreaM2 === 100);
  await navigate('projectEstimate');
  await page.waitForFunction(() => document.body.innerText.includes('Priced using:'));
  assert.equal(await page.evaluate(() => window.__sheet().workbook.jobId), jobId);
  assert.equal(await page.evaluate(() => window.__sheet().preview.quantities.lowerSlabAreaM2), 100);
  await navigate('dataInput');
  await waitInput('lowerFloorAreaM2', '80');
  await saveComputer();
  const saved = await lastFile();
  assert.equal(saved.data.jobId, jobId);
  assert.equal(saved.data.workbook.aiPlanTakeoffJob.masterJobId, jobId);
  assert.equal(saved.data.workbook.aiPlanTakeoffJob.plan.pages.length, 1);
  assert.equal(saved.data.workbook.aiPlanTakeoffJob.completedFloorplans.length, 2);
  assert.ok(saved.data.workbook.standardInclusions.selectedPackageId);
  fs.writeFileSync(path.join(out, `${name}.gr8job`), saved.bytes);
  pass('Standard Inclusions, Quotation Builder and Project Estimate retain the same master dataset');

  await navigate('aiPlanTakeoff');
  await page.waitForFunction(jobId => window.__takeoff()?.memoizedProps.initialJob?.masterJobId === jobId && window.__takeoff()?.memoizedProps.initialJob?.completedFloorplans?.length === 2, {}, jobId);
  await page.screenshot({ path: path.join(out, '03-takeoff-reopened.png') });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(jobId => window.__takeoff()?.memoizedProps.initialJob?.masterJobId === jobId && window.__takeoff()?.memoizedProps.initialJob?.completedFloorplans?.length === 2, {}, jobId);
  pass('Takeoff reopens with its plan and measurements after module switching and a full reload');
  await click('File');
  await click('Close Job');
  await page.waitForFunction(() => document.body.innerText.includes('No job open'));
  await page.evaluate(({ name }) => {
    window.showOpenFilePicker = async options => {
      if (!JSON.stringify(options).includes('.gr8job')) throw new Error('Takeoff must open master job files');
      return [await (await navigator.storage.getDirectory()).getFileHandle(name)];
    };
  }, { name: saved.name });
  await click('File');
  await click('Open Job File from Computer');
  await page.waitForFunction(jobId => window.__takeoff()?.memoizedProps.initialJob?.masterJobId === jobId && window.__takeoff()?.memoizedProps.initialJob?.completedFloorplans?.length === 2, {}, jobId);
  pass('Takeoff opens the complete .gr8job file directly and preserves its original jobId');
  await navigate('dataInput');
  await waitInput('lowerFloorAreaM2', '80');
  assert.equal(await page.evaluate(() => window.__sheet().workbook.jobFileMeta.localFileOnly), true, 'A permanent master ID does not imply registration in a separate cloud collection');
  const keys = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('estimate-builder-template-db', 2); r.onsuccess = () => { const db = r.result; const q = db.transaction('jobs').objectStore('jobs').getAllKeys(); q.onsuccess = () => { db.close(); resolve(q.result.filter(k => String(k).startsWith('job:') && !String(k).includes(':snapshot:'))); }; }; }));
  assert.deepEqual(keys, [`job:${jobId}`], 'Only one job exists for all modules');
  const client = await page.createCDPSession();
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    await client.send('HeapProfiler.collectGarbage');
    report.samples.push({ heap: (await client.send('Runtime.getHeapUsage')).usedSize, ...(await client.send('Memory.getDOMCounters')) });
  }
  assert.ok(report.samples.at(-1).heap - report.samples[0].heap < 5 * 1024 * 1024);
  assert.equal(report.samples.at(-1).nodes, report.samples[0].nodes);
  assert.deepEqual(report.errors, []);
  pass('One persisted master job; Data Input remains responsive with stable retained heap');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  report.takeoff = await page.evaluate(() => ({ initialJob: window.__takeoff()?.memoizedProps.initialJob, platformContext: window.__takeoff()?.memoizedProps.platformContext })).catch(() => null);
  report.page = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 18000) })).catch(() => null);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
function pass(message) { report.steps.push(message); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS', message); }
async function click(label) {
  console.log('Click', label);
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === label && !b.disabled), {}, label);
  await page.evaluate(label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label && !b.disabled).click(), label);
}
async function waitInput(key, value) { await page.waitForFunction((key, value) => document.querySelector(`#data-edit-inputDataSheet-${key}`)?.value === value, {}, key, value); }
async function navigate(key) {
  const label = { dataInput: 'Job Setup', aiPlanTakeoff: 'AI Plan Takeoff', quotation: 'Quotation Builder', standardInclusions: 'Standard Inclusions', projectEstimate: 'Project Estimate' }[key];
  console.log('Navigate', key);
  await page.waitForFunction(label => [...document.querySelectorAll('button,a')].some(el => el.textContent.trim() === label), {}, label);
  await page.evaluate(label => [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === label).click(), label);
  await page.waitForFunction(key => new URL(location.href).searchParams.get('page') === key, {}, key);
}
async function saveComputer() {
  const before = await page.evaluate(() => localStorage.getItem('gr8-job-recent-files'));
  await click('File'); await click('Save Job to Computer');
  await page.waitForFunction(before => window.__masterFileName && localStorage.getItem('gr8-job-recent-files') !== before, {}, before);
  await page.waitForFunction(() => document.querySelector('[data-testid="job-persistence-status"]')?.textContent.includes('Saved at'));
  assert.equal(await page.evaluate(() => document.body.innerText.includes('Save failed:')), false);
}
async function lastFile() {
  const file = await page.evaluate(async () => {
    const handle = await (await navigator.storage.getDirectory()).getFileHandle(window.__masterFileName);
    return { name: handle.name, bytes: [...new Uint8Array(await (await handle.getFile()).arrayBuffer())] };
  });
  const bytes = Buffer.from(file.bytes);
  return { bytes, name: file.name, data: await readJob({ getFile: async () => new File([bytes], file.name) }) };
}
