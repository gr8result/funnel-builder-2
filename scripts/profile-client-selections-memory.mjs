import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Memory / save / navigation profile of Client Selections in the running app, on a real-sized job.
// Measures (it does not assert a fix): JS heap after forced GC at each phase, the renderer
// process's peak working set, DOM nodes and listeners, and how many job saves, whole-job clones,
// IndexedDB writes, history changes and page loads each phase caused.
// Opens a COPY of the job file in an isolated browser profile; cloud writes are blocked and the
// user's own browser storage is never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/profile-client-selections-memory.mjs [--job=path.gr8job] [--idle=120] [--final-idle=240] [--label=before]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const jobFile = path.resolve(root, arg('job', 'recovery/quotation-changes-2026-10-03/current-job-verified-1790977156917.gr8job'));
const idleSeconds = Number(arg('idle', 120));
const finalIdleSeconds = Number(arg('final-idle', 240));
const label = arg('label', 'run');
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
const report = {label, passed:false, job:path.basename(jobFile), jobFileMb:Math.round(fs.statSync(jobFile).size / 1048576), phases:[], crashed:false, runtimeErrors:[], documentLoads:0, unexpectedNavigations:[]};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const mb = bytes => Math.round(bytes / 1048576);
let page, cdp, peakRendererMb = 0, sampling = true;

// The renderer process's working set, sampled from the OS: the number Chrome's "Out of Memory" is about.
const browserPid = browser.process().pid;
function rendererWorkingSetMb() {
  return new Promise(resolve => execFile('powershell', ['-NoProfile', '-Command',
    `$all = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"; $kids = $all | Where-Object { $_.ParentProcessId -eq ${browserPid} -and $_.CommandLine -match '--type=renderer' }; ($kids | Measure-Object -Property WorkingSetSize -Maximum).Maximum`],
    {timeout:20000}, (error, stdout) => resolve(error ? 0 : mb(Number(String(stdout).trim()) || 0))));
}
(async () => { while (sampling) { const value = await rendererWorkingSetMb(); if (value > peakRendererMb) peakRendererMb = value; await delay(1500); } })();

async function measure(name) {
  await delay(1500);
  const counters = await page.evaluate(() => ({...window.__profile})).catch(() => null);
  let heap = null, metrics = {};
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    await delay(400);
    await cdp.send('HeapProfiler.collectGarbage');
    heap = await cdp.send('Runtime.getHeapUsage');
    metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
  } catch (error) { report.runtimeErrors.push(`measure ${name}: ${error.message}`); }
  const phase = {name, heapUsedMb:heap ? mb(heap.usedSize) : null, heapTotalMb:heap ? mb(heap.totalSize) : null, rendererNowMb:await rendererWorkingSetMb(), rendererPeakMb:peakRendererMb,
    domNodes:metrics.Nodes ?? null, listeners:metrics.JSEventListeners ?? null, documents:metrics.Documents ?? null, counters, url:page.url().replace(origin, '')};
  report.phases.push(phase);
  peakRendererMb = phase.rendererNowMb;
  console.log(`[${label}] ${name}: heap ${phase.heapUsedMb} MB, renderer ${phase.rendererNowMb} MB (peak ${phase.rendererPeakMb}), nodes ${phase.domNodes}, listeners ${phase.listeners}, ${JSON.stringify(counters)}`);
  fs.writeFileSync(path.join(out, `report-${label}.json`), JSON.stringify(report, null, 2));
  return phase;
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
const savesSettled = async (label2, timeoutMs = 600000) => {
  const start = Date.now();
  for (;;) {
    const state = await page.evaluate(() => ({...window.__profile})).catch(() => null);
    if (state && state.savesStarted === state.savesFinished) { await delay(4000); const again = await page.evaluate(() => ({...window.__profile})); if (again.savesStarted === again.savesFinished && again.savesStarted === state.savesStarted) return Math.round((Date.now() - start) / 1000); }
    if (Date.now() - start > timeoutMs) { report.runtimeErrors.push(`${label2}: saves still running after ${timeoutMs / 1000}s ${JSON.stringify(state)}`); return -1; }
    await delay(1000);
  }
};

try {
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('error', error => { report.crashed = true; report.runtimeErrors.push(`PAGE CRASH: ${error.message}`); });
  page.on('dialog', dialog => dialog.accept());
  page.on('load', () => { report.documentLoads += 1; });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort();
    else void request.continue();
  });
  // Counters, installed before any app code: job saves (the Client Selections save announces itself
  // through the selection-foundation request), whole-value clones, IndexedDB writes, history changes.
  await page.evaluateOnNewDocument(({key, session}) => {
    localStorage.setItem(key, JSON.stringify(session));
    const profile = window.__profile = {savesStarted:0, savesFinished:0, jobPuts:0, structuredClones:0, bigStringifies:0, bigStringifyMb:0, historyChanges:0, draftWrites:0};
    const clone = window.structuredClone;
    window.structuredClone = function (value, options) { if (value && typeof value === 'object' && (value.quotation || value.clientSelectionsBook)) profile.structuredClones += 1; return clone.call(window, value, options); };
    const stringify = JSON.stringify;
    JSON.stringify = function (...args) { const result = stringify.apply(JSON, args); if (typeof result === 'string' && result.length > 5000000) { profile.bigStringifies += 1; profile.bigStringifyMb += Math.round(result.length / 1048576); } return result; };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key2) { if (value && value.workbook) profile.jobPuts += 1; return put.call(this, value, key2); };
    for (const name of ['pushState', 'replaceState']) { const original = history[name]; history[name] = function (...args) { profile.historyChanges += 1; return original.apply(history, args); }; }
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (/selection|book/i.test(name)) profile.draftWrites += 1; return setItem.call(this, name, value); };
    const fetch0 = window.fetch;
    window.fetch = function (input, init) {
      const address = typeof input === 'string' ? input : input?.url || '';
      if (!/selection-foundation/.test(address)) return fetch0.call(window, input, init);
      profile.savesStarted += 1;
      return fetch0.call(window, input, init);
    };
    // A Client Selections save ends when its revision reaches the stored job: observed as the job put.
    const origPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key2) { const request = origPut.call(this, value, key2); if (value && value.type === 'job' && typeof key2 === 'string' && !key2.includes(':snapshot:') && /^client-selections:/.test(value.workbook?.clientSelectionsBook?.metadata?.selectionRevision || '')) { try { this.transaction.addEventListener('complete', () => { profile.savesFinished += 1; }); this.transaction.addEventListener('abort', () => { profile.savesFinished += 1; }); } catch {} } return request; };
  }, {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});

  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  await measure('app shell, no job');
  await loadJob(jobFile);
  await delay(8000);
  report.workbook = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const keys = await new Promise(resolve => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').getAllKeys(); request.onsuccess = () => resolve(request.result); });
      return {storedKeys:keys.map(String)};
    } finally { db.close(); }
  }).catch(error => ({error:error.message}));
  const opened = await measure('1 Client Selections open (job loaded)');
  const loadsAfterOpen = report.documentLoads;

  await openElectrical();
  const rooms = await page.$$eval(selector('electrical-room'), cards => cards.map(card => card.dataset.room));
  report.rooms = rooms.length;
  await measure('2 Electrical open');
  await delay(idleSeconds * 1000);
  const idle = await measure(`3 Electrical idle ${idleSeconds}s`);

  // 10 electrical room quantities, as fast as a user clicks Save / Next.
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
  const settle1 = await savesSettled('10 edits');
  const edited = await measure(`5 10 room edits saved (settled in ${settle1}s)`);

  // 10 more saves, one at a time (each allowed to finish): does each save leave memory behind?
  for (let index = 0; index < 10; index++) {
    if (!await page.$(EDITOR)) { await openElectrical(); await click(`${selector('electrical-room')} ${selector('electrical-room-edit')}`); await page.waitForSelector(EDITOR); }
    await click(selector('electrical-qty-single-gpo-plus'));
    await click(selector('electrical-save-next'));
    await savesSettled(`sequential save ${index + 1}`, 180000);
  }
  const sequential = await measure('6 10 further saves, one at a time');

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
  report.summary = {openedMb:opened.heapUsedMb, idleGrowthMb:idle.heapUsedMb - report.phases.find(phase => phase.name.startsWith('2 ')).heapUsedMb, afterTenEditsMb:edited.heapUsedMb, afterSequentialSavesMb:sequential.heapUsedMb, afterNavigationMb:navigated.heapUsedMb, finalMb:final.heapUsedMb,
    peakRendererMb:Math.max(...report.phases.map(phase => phase.rendererPeakMb || 0)), saves:final.counters?.savesStarted, reloadsAfterOpen:report.documentLoadsAfterOpen};
  report.passed = !report.crashed;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  sampling = false;
  report.peakRendererMb = Math.max(peakRendererMb, ...report.phases.map(phase => phase.rendererPeakMb || 0));
  fs.writeFileSync(path.join(out, `report-${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({label, passed:report.passed, crashed:report.crashed, error:report.error, summary:report.summary, peakRendererMb:report.peakRendererMb, runtimeErrors:report.runtimeErrors.slice(0, 5)}, null, 2));
  await browser.close().catch(() => {});
}
