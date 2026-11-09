import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Release gate for Client Selections on a real-sized job: memory, saves, readiness and reopen.
// Opens a COPY of the job file in an isolated browser profile; cloud writes are blocked and the
// user's own browser storage is never touched.
//
// It FAILS (exit 1, passed:false) on any of:
//   - a wait that times out, a crash, an uncaught page error or a browser console error
//     (other than the cloud writes this test blocks on purpose);
//   - a Client Selections save that never ends, ends with ok:false, or a start/end count that
//     does not balance (saves report themselves through the gr8:client-selections-save event);
//   - a quantity edit that is not in the stored job after its save, or not there after a reload;
//   - the renderer's peak working set above MEMORY_PEAK_LIMIT_MB (default 1024);
//   - Client Selections taking longer than READY_LIMIT_MS (default 5000) to be ready after a reload.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/profile-client-selections-memory.mjs [--job=path.gr8job] [--idle=120] [--final-idle=240] [--label=before]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3016';
if (new URL(origin).port === '3000') { console.error('Refusing to run against port 3000 (the live development server). Use an isolated port such as 3016.'); process.exit(2); }
const jobFile = path.resolve(root, arg('job', 'recovery/quotation-changes-2026-10-03/current-job-verified-1790977156917.gr8job'));
const idleSeconds = Number(arg('idle', 120));
const finalIdleSeconds = Number(arg('final-idle', 240));
const label = arg('label', 'run');
const peakLimitMb = Number(process.env.MEMORY_PEAK_LIMIT_MB || 1024);
const readyLimitMs = Number(process.env.READY_LIMIT_MS || 5000);
// --mode=reload: open the job, then only measure the reload (readiness, network, CPU) - no editing phases.
const reloadOnly = arg('mode', 'full') === 'reload';
const out = path.join(root, 'artifacts/test-artifacts/client-selections-memory');
fs.mkdirSync(out, {recursive:true});
assert(fs.existsSync(jobFile), `job file not found: ${jobFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link, error:linkError} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
if (linkError) throw linkError;
const authClient = createClient(url, anon, {auth:{persistSession:false}});
const {data:auth, error:authError} = await authClient.auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
if (authError) throw authError;

const browser = await puppeteer.launch({
  executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless:true, protocolTimeout:600000, defaultViewport:{width:1920, height:1080},
});
const report = {label, passed:false, failures:[], job:path.basename(jobFile), jobFileMb:Math.round(fs.statSync(jobFile).size / 1048576),
  limits:{peakRendererMb:peakLimitMb, readyAfterReloadMs:readyLimitMs}, phases:[], timings:{}, quantities:{}, saves:null,
  crashed:false, runtimeErrors:[], consoleErrors:[], blockedCloudWrites:0, blockedApiWrites:[], documentLoads:0};
const fail = message => { report.failures.push(message); console.log(`FAIL ${message}`); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const mb = bytes => Math.round(bytes / 1048576);
let page, cdp, peakRendererMb = 0, sampling = true, samplingPaused = false;

// The renderer process's working set, sampled from the OS: the number Chrome's "Out of Memory" is about.
// Paused only while this test itself reads the stored job back (that copy is the test's, not the app's).
const browserPid = browser.process().pid;
function rendererWorkingSetMb() {
  return new Promise(resolve => execFile('powershell', ['-NoProfile', '-Command',
    `$all = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"; $kids = $all | Where-Object { $_.ParentProcessId -eq ${browserPid} -and $_.CommandLine -match '--type=renderer' }; ($kids | Measure-Object -Property WorkingSetSize -Maximum).Maximum`],
    {timeout:20000}, (error, stdout) => resolve(error ? 0 : mb(Number(String(stdout).trim()) || 0))));
}
let overallPeakMb = 0;
(async () => { while (sampling) { const value = await rendererWorkingSetMb(); if (!samplingPaused) { if (value > peakRendererMb) peakRendererMb = value; if (value > overallPeakMb) overallPeakMb = value; } await delay(1000); } })();

const saveState = () => page.evaluate(() => {
  const saves = window.__clientSelectionsSaves || {started:{}, ended:{}};
  const started = Object.keys(saves.started), ended = Object.keys(saves.ended);
  return {started:started.length, ended:ended.length, failed:Object.values(saves.ended).filter(entry => !entry.ok).map(entry => entry.message),
    warnings:[...new Set(Object.values(saves.ended).map(entry => entry.warning).filter(Boolean))],
    unbalanced:ended.filter(id => !saves.started[id]).length, open:started.filter(id => !saves.ended[id]).length,
    longestMs:Math.max(0, ...ended.filter(id => saves.started[id]).map(id => saves.ended[id].at - saves.started[id].at))};
});

async function measure(name) {
  await delay(1500);
  const counters = await page.evaluate(() => ({...window.__profile})).catch(() => null);
  const saves = await saveState().catch(() => null);
  let heap = null, metrics = {};
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    await delay(400);
    await cdp.send('HeapProfiler.collectGarbage');
    heap = await cdp.send('Runtime.getHeapUsage');
    metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
  } catch (error) { fail(`measure ${name}: ${error.message}`); }
  const phase = {name, heapUsedMb:heap ? mb(heap.usedSize) : null, heapTotalMb:heap ? mb(heap.totalSize) : null, rendererNowMb:await rendererWorkingSetMb(), rendererPeakMb:peakRendererMb,
    domNodes:metrics.Nodes ?? null, listeners:metrics.JSEventListeners ?? null, documents:metrics.Documents ?? null, counters, saves, url:page.url().replace(origin, '')};
  report.phases.push(phase);
  peakRendererMb = phase.rendererNowMb;
  console.log(`[${label}] ${name}: heap ${phase.heapUsedMb} MB, renderer ${phase.rendererNowMb} MB (peak ${phase.rendererPeakMb}), nodes ${phase.domNodes}, saves ${JSON.stringify(saves)}, ${JSON.stringify(counters)}`);
  fs.writeFileSync(path.join(out, `report-${label}.json`), JSON.stringify(report, null, 2));
  return phase;
}

async function measureReload() {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', {interval:1000});
  await cdp.send('Profiler.start');
  report.reloadNetwork = [];
  report.reloadNetworkStart = Date.now();
  const reloadStarted = Date.now();
  await page.reload({waitUntil:'domcontentloaded', timeout:600000});
  report.timings.reloadDomContentLoadedMs = Date.now() - reloadStarted;
  await page.waitForSelector(GUIDED, {timeout:600000});
  report.timings.readyAfterReloadMs = Date.now() - reloadStarted;
  const {profile} = await cdp.send('Profiler.stop');
  fs.writeFileSync(path.join(out, `reload-${label}.cpuprofile`), JSON.stringify(profile));
  report.reloadNetwork.sort((a, b) => b.ms - a.ms);
  await measure('9 after reload');
  if (report.timings.readyAfterReloadMs > readyLimitMs) fail(`Client Selections took ${report.timings.readyAfterReloadMs} ms to be ready after a reload (limit ${readyLimitMs} ms)`);
}

// The stored job's electrical point totals, read straight from IndexedDB (sampling paused: this
// whole-record read is the test's own copy, not the application's memory).
async function storedElectricalTotals() {
  samplingPaused = true;
  try {
    return await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try {
        const store = db.transaction('jobs', 'readonly').objectStore('jobs');
        const pointer = await new Promise(resolve => { const request = store.get('active-job'); request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null); });
        const keys = await new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').getAllKeys(); request.onsuccess = () => resolve(request.result.map(String)); });
        const pointed = [pointer?.jobKey, pointer?.targetKey, pointer?.key].find(item => typeof item === 'string' && item.startsWith('job:') && !item.includes(':snapshot:'));
        const key = pointed || keys.find(item => item.startsWith('job:') && !item.includes(':snapshot:'));
        const record = await new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null); });
        const totals = {}, schedules = [];
        (function find(value) {
          if (!value || typeof value !== 'object') return;
          if (value.electricalSchedule && Array.isArray(value.electricalSchedule.rooms)) schedules.push(value.electricalSchedule);
          for (const child of Object.values(value)) if (child && typeof child === 'object') find(child);
        })(record?.workbook?.clientSelectionsBook);
        const schedule = schedules[0];
        for (const room of schedule?.rooms || []) for (const [type, quantity] of Object.entries(room.points || {})) totals[type] = (totals[type] || 0) + (Number(quantity) || 0);
        return {key, revision:record?.revision, selectionRevision:record?.workbook?.clientSelectionsBook?.metadata?.selectionRevision || '', schedules:schedules.length, rooms:schedule?.rooms?.length || 0, totals, storedKeys:keys};
      } finally { db.close(); }
    });
  } finally { samplingPaused = false; }
}

const HOME = selector('guided-client-selections-home');
const INTERIOR = selector('guided-interior-categories');
const OVERVIEW = selector('electrical-schedule');
const EDITOR = selector('electrical-room-editor');
const GUIDED = [HOME, INTERIOR, selector('guided-exterior-categories'), OVERVIEW, EDITOR, selector('guided-kitchen-checklist'), selector('guided-cabinetry-workflow')].join(', ');
const click = sel => page.$eval(sel, element => element.click());
async function loadJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'), {timeout:180000});
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 240; attempt++) {
    await delay(1000);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim())).catch(() => []);
    const dialogs = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(text => labels.includes(text));
    for (const text of dialogs) await page.evaluate(value => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), text);
    if (!dialogs.length && attempt >= 2 && await page.$(GUIDED)) return;
  }
  await page.waitForSelector(GUIDED, {timeout:120000});
}
async function openInterior() {
  for (let guard = 0; guard < 12 && !await page.$(INTERIOR); guard++) {
    if (await page.$(HOME)) await click(`${HOME} [data-category-key="interior"]`);
    else if (await page.$(EDITOR)) await click(selector('electrical-all-rooms'));
    else if (await page.$(OVERVIEW)) await click(selector('electrical-back'));
    else if (await page.$(selector('paint-back'))) await click(selector('paint-back'));
    else if (await page.$(selector('guided-plumbing-fixture-products'))) await page.$eval('.plumbingProductsHeader > button', button => button.click());
    else if (await page.$('.categoryHubBack')) await click('.categoryHubBack');
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => /^(back|← interior)$/i.test(button.innerText.trim()))?.click());
    await delay(900);
  }
  await page.waitForSelector(INTERIOR, {timeout:60000});
}
async function openCategory(key, ready) {
  await openInterior();
  await click(`${INTERIOR} [data-category-key="${key}"]`);
  if (ready) await page.waitForSelector(ready, {timeout:60000}); else await delay(2500);
}
const openElectrical = () => openCategory('electrical-technology', OVERVIEW);
// Waits until every announced save has ended. A save still open at the deadline FAILS the run.
async function savesSettled(stage, timeoutMs = 180000) {
  const start = Date.now();
  for (;;) {
    const state = await saveState();
    if (state.open === 0) {
      await delay(2500);
      const again = await saveState();
      if (again.open === 0 && again.started === state.started) return Date.now() - start;
    }
    if (Date.now() - start > timeoutMs) { fail(`${stage}: ${state.open} Client Selections save(s) still running after ${timeoutMs / 1000}s ${JSON.stringify(state)}`); return -1; }
    await delay(500);
  }
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  page.on('pageerror', error => { report.runtimeErrors.push(error.message); fail(`page error: ${error.message}`); });
  page.on('error', error => { report.crashed = true; fail(`PAGE CRASH: ${error.message}`); });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const where = message.location()?.url || '';
    // A cloud write this test aborted on purpose is reported by the browser as a failed load.
    if (/net::ERR_FAILED/.test(message.text()) && (/\/(rest|storage)\/v1\//.test(where) || report.blockedApiWrites.some(item => where.includes(item.split(' ')[1].split('?')[0])))) return;
    // The application has no /favicon.ico anywhere (an app-wide asset, not Client Selections). Recorded, not failed.
    if (/\/favicon\.ico$/.test(where)) { report.ignoredConsoleErrors = [...(report.ignoredConsoleErrors || []), 'favicon.ico 404']; return; }
    report.consoleErrors.push(`${message.text().slice(0, 400)}${where ? ` @ ${where.replace(origin, '').slice(0, 200)}` : ''}`);
  });
  page.on('dialog', dialog => dialog.accept());
  page.on('load', () => { report.documentLoads += 1; });
  // Request timeline, kept for the reload: where the waiting time goes.
  const requestStarts = new Map();
  page.on('request', request => requestStarts.set(request, Date.now()));
  page.on('requestfinished', request => { const started = requestStarts.get(request); if (started && report.reloadNetwork) report.reloadNetwork.push({url:request.url().replace(origin, '').slice(0, 160), method:request.method(), status:request.response()?.status(), startMs:started - report.reloadNetworkStart, ms:Date.now() - started, kb:Math.round(Number(request.response()?.headers()['content-length'] || 0) / 1024)}); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); }
    // Same-origin API writes reach the production database through the server; block and list them too.
    else if (request.url().startsWith(`${origin}/api/`) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedApiWrites.push(`${request.method()} ${request.url().replace(origin, '').slice(0, 160)}`); void request.abort(); }
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => {
    localStorage.setItem(key, JSON.stringify(session));
    const profile = window.__profile = {jobPuts:0, structuredClones:0, bigStringifies:0, bigStringifyMb:0, historyChanges:0, draftWrites:0};
    // The application's own save lifecycle: one start and one end per save, matched by id.
    const saves = window.__clientSelectionsSaves = {started:{}, ended:{}};
    window.addEventListener('gr8:client-selections-save', event => {
      const detail = event.detail || {};
      if (detail.phase === 'start') saves.started[detail.saveId] = {at:Date.now()};
      if (detail.phase === 'end') saves.ended[detail.saveId] = {at:Date.now(), ok:detail.ok === true, message:detail.message || '', warning:detail.warning || ''};
    });
    const clone = window.structuredClone;
    window.structuredClone = function (value, options) { if (value && typeof value === 'object' && (value.quotation || value.clientSelectionsBook)) profile.structuredClones += 1; return clone.call(window, value, options); };
    const stringify = JSON.stringify;
    JSON.stringify = function (...args) { const result = stringify.apply(JSON, args); if (typeof result === 'string' && result.length > 5000000) { profile.bigStringifies += 1; profile.bigStringifyMb += Math.round(result.length / 1048576); } return result; };
    // Open IndexedDB write transactions (evidence for what a reload has to wait behind).
    profile.idbWritesOpen = 0; profile.idbWritesDone = 0; profile.idbLongestWriteMs = 0;
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = transaction.call(this, stores, mode, options);
      if (mode === 'readwrite') {
        const started = performance.now(); profile.idbWritesOpen += 1;
        const done = () => { profile.idbWritesOpen -= 1; profile.idbWritesDone += 1; profile.idbLongestWriteMs = Math.max(profile.idbLongestWriteMs, Math.round(performance.now() - started)); };
        tx.addEventListener('complete', done); tx.addEventListener('abort', done); tx.addEventListener('error', done);
      }
      return tx;
    };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key2) { if (value && value.workbook) profile.jobPuts += 1; return put.call(this, value, key2); };
    for (const name of ['pushState', 'replaceState']) { const original = history[name]; history[name] = function (...args) { profile.historyChanges += 1; return original.apply(history, args); }; }
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (/selection|book/i.test(name)) profile.draftWrites += 1; return setItem.call(this, name, value); };
  }, {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});

  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  await measure('app shell, no job');
  const openStarted = Date.now();
  await loadJob(jobFile);
  report.timings.openJobFileMs = Date.now() - openStarted;
  await savesSettled('job open');
  await delay(3000);
  const opened = await measure('1 Client Selections open (job loaded)');
  const loadsAfterOpen = report.documentLoads;

  if (reloadOnly) {
    report.savesBeforeReload = await saveState();
    const preReloadWait = Number(arg('pre-reload-wait', 0));
    report.preReload = [];
    for (let waited = 0; ; waited += 5) {
      const state = await page.evaluate(() => ({openWrites:window.__profile.idbWritesOpen, doneWrites:window.__profile.idbWritesDone, longestWriteMs:window.__profile.idbLongestWriteMs}));
      report.preReload.push({atSeconds:waited, ...state});
      console.log(`[${label}] before reload +${waited}s: ${JSON.stringify(state)}`);
      if (waited >= preReloadWait) break;
      await delay(5000);
    }
    await measureReload();
    throw Object.assign(new Error('reload-only run complete'), {reloadOnlyDone:true});
  }
  await openElectrical();
  const rooms = await page.$$eval(selector('electrical-room'), cards => cards.map(card => card.dataset.room));
  report.rooms = rooms.length;
  if (!rooms.length) fail('Electrical showed no rooms');
  report.quantities.atOpen = await storedElectricalTotals();
  if (!report.quantities.atOpen.schedules) fail(`the stored job ${report.quantities.atOpen.key} has no Electrical schedule to measure`);
  await measure('2 Electrical open');
  await delay(idleSeconds * 1000);
  const idle = await measure(`3 Electrical idle ${idleSeconds}s`);

  // 10 electrical room quantities (+2 double power points each), as fast as a user clicks Save / Next.
  await click(`${selector('electrical-room')} ${selector('electrical-room-edit')}`);
  await page.waitForSelector(EDITOR);
  for (let index = 0; index < 10; index++) {
    await click(selector('electrical-qty-double-gpo-plus'));
    await click(selector('electrical-qty-double-gpo-plus'));
    await click(selector('electrical-save-next'));
    await delay(350);
    if (!await page.$(EDITOR)) { await click(`${selector('electrical-room')}:nth-child(${(index % rooms.length) + 1}) ${selector('electrical-room-edit')}`); await page.waitForSelector(EDITOR); }
  }
  await measure('4 right after 10 room edits (saves in flight)');
  const settle1 = await savesSettled('10 rapid edits', 300000);
  report.timings.tenRapidEditsSettledMs = settle1;
  const edited = await measure(`5 10 room edits saved (settled in ${Math.round(settle1 / 1000)}s)`);

  // 10 more saves (+1 single power point each), one at a time: does each save leave memory behind?
  for (let index = 0; index < 10; index++) {
    if (!await page.$(EDITOR)) { await openElectrical(); await click(`${selector('electrical-room')} ${selector('electrical-room-edit')}`); await page.waitForSelector(EDITOR); }
    await click(selector('electrical-qty-single-gpo-plus'));
    await click(selector('electrical-save-next'));
    await savesSettled(`sequential save ${index + 1}`);
  }
  const sequential = await measure('6 10 further saves, one at a time');

  // Every click must be in the stored job: +20 double, +10 single.
  report.quantities.afterSaves = await storedElectricalTotals();
  const delta = type => (report.quantities.afterSaves.totals[type] || 0) - (report.quantities.atOpen.totals[type] || 0);
  report.quantities.delta = {'double-gpo':delta('double-gpo'), 'single-gpo':delta('single-gpo')};
  if (delta('double-gpo') !== 20) fail(`stored double power points changed by ${delta('double-gpo')}, expected +20 (lost or duplicated saves)`);
  if (delta('single-gpo') !== 10) fail(`stored single power points changed by ${delta('single-gpo')}, expected +10 (lost or duplicated saves)`);

  // Manage Rooms open / close, then the navigation loop.
  await openElectrical();
  await click(selector('electrical-manage-rooms'));
  await page.waitForSelector(selector('project-room-manager'));
  await click(selector('room-manager-close'));
  for (let loop = 0; loop < 3; loop++) {
    await openCategory('lighting-fans', selector('guided-category-lighting-fans'));
    await openCategory('paint-wall-finishes');
    await openCategory('flooring');
    await openCategory('cabinetry');
    await openElectrical();
  }
  const navigated = await measure('7 Electrical > Lighting > Paint > Flooring > Cabinetry > Electrical x3');
  await savesSettled('navigation');

  await delay(finalIdleSeconds * 1000);
  const final = await measure(`8 idle ${finalIdleSeconds}s at the end`);
  report.documentLoadsAfterOpen = report.documentLoads - loadsAfterOpen;
  if (report.documentLoadsAfterOpen !== 0) fail(`the page reloaded ${report.documentLoadsAfterOpen} time(s) during editing`);

  // The save record lives in the page; a reload starts a new one.
  report.savesBeforeReload = await saveState();
  // Reopen: a reload must bring the same job back, with every saved quantity, within the limit.
  // The reload is CPU-profiled so a slow one shows where its time went.
  await measureReload();
  report.quantities.afterReload = await storedElectricalTotals();
  for (const type of ['double-gpo', 'single-gpo']) {
    if ((report.quantities.afterReload.totals[type] || 0) !== (report.quantities.afterSaves.totals[type] || 0)) fail(`${type} after reload ${report.quantities.afterReload.totals[type]} != saved ${report.quantities.afterSaves.totals[type]}`);
  }
  if (report.quantities.afterReload.key !== report.quantities.afterSaves.key) fail(`reload reopened ${report.quantities.afterReload.key}, not ${report.quantities.afterSaves.key}`);
  await openElectrical();
  const reopenedRooms = await page.$$eval(selector('electrical-room'), cards => cards.length);
  if (reopenedRooms !== rooms.length) fail(`Electrical shows ${reopenedRooms} rooms after reload, ${rooms.length} before`);

  report.summary = {openedMb:opened.heapUsedMb, idleGrowthMb:idle.heapUsedMb - report.phases.find(phase => phase.name.startsWith('2 ')).heapUsedMb, afterTenEditsMb:edited.heapUsedMb, afterSequentialSavesMb:sequential.heapUsedMb, afterNavigationMb:navigated.heapUsedMb, finalMb:final.heapUsedMb,
    peakRendererMb:overallPeakMb, reloadsAfterOpen:report.documentLoadsAfterOpen};
} catch (error) {
  if (!error.reloadOnlyDone) fail(`aborted: ${error.message}`);
} finally {
  sampling = false;
  try {
    report.saves = report.savesBeforeReload || (page ? await saveState() : null);
    if (report.saves) {
      if (report.saves.open) fail(`${report.saves.open} Client Selections save(s) never ended`);
      if (report.saves.unbalanced) fail(`${report.saves.unbalanced} save end(s) without a start`);
      if (report.saves.failed.length) fail(`${report.saves.failed.length} save(s) ended with an error: ${report.saves.failed.slice(0, 3).join(' | ')}`);
      if (!report.saves.started && !reloadOnly) fail('no Client Selections save was observed');
      if (report.saves.warnings.length) fail(`saves completed without configured quote mappings: ${report.saves.warnings.join(' | ')}`);
    }
  } catch (error) { fail(`save state unreadable: ${error.message}`); }
  report.peakRendererMb = overallPeakMb;
  if (overallPeakMb > peakLimitMb) fail(`renderer peak ${overallPeakMb} MB is above the ${peakLimitMb} MB limit`);
  if (report.consoleErrors.length) fail(`${report.consoleErrors.length} browser console error(s): ${report.consoleErrors.slice(0, 3).join(' | ')}`);
  report.passed = report.failures.length === 0;
  fs.writeFileSync(path.join(out, `report-${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({label, passed:report.passed, failures:report.failures, timings:report.timings, quantities:report.quantities.delta, saves:report.saves, summary:report.summary, peakRendererMb:report.peakRendererMb}, null, 2));
  if (!report.passed) process.exitCode = 1;
  await browser.close().catch(() => {});
}
