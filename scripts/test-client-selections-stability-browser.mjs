import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Client Selections must stay a stable workspace: editing, autosave, quotation sync and job
// persistence may not reload the document, remount the page, reset the screen or drop an edit made
// while a save is in flight. Uses an isolated local job; cloud writes are blocked.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-stability-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});

// Fast Refresh keeps an open page only while these hold. Each one, when broken, made every source
// edit unmount Client Selections and rebuild it from the stored job.
const hostSource = fs.readFileSync(path.join(root, 'components/estimate-builder/EstimateBuilderWorkbook.js'), 'utf8');
assert.deepEqual(hostSource.match(/^export (?!default function |function [A-Z]).*/gm) || [], [],'EstimateBuilderWorkbook.js may only export components, or it is not a Fast Refresh boundary');
assert(!/class \w+ extends (React\.)?(Pure)?Component/.test(hostSource), 'class components are remounted by Fast Refresh and belong in their own module');
assert(!hostSource.includes('setLoadedClientSelectionsPage(null)'), 'the loaded Client Selections page must never be cleared');

const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const idleMs = Number(process.env.CLIENT_SELECTIONS_IDLE_MS || 20000);
const out = path.join(root, 'artifacts/test-artifacts/client-selections-stability-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-selection-stability-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local selection stability regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-STABLE', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-STABLE', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-stability-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));

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
  headless:true, protocolTimeout:180000, defaultViewport:{width:1920, height:1080},
});
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, documentLoads:0, fastRefresh:[], runtimeErrors:[], diagnostics:[], blockedCloudWrites:0, checkpoints:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const HUB = selector('guided-category-bathroom-accessories');
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-category-bathroom-accessories'].map(selector).join(', ');
const SECTION = selector('selection-packs-bathroom-accessory-pack');
const SELECTED = selector('selection-pack-selected');
const railName = () => page.$eval(`${SELECTED} [data-testid="selection-pack-component-towel-rail"] strong`, element => element.innerText);

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) {
      await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    }
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

async function openBathroomAccessories() {
  for (let guard = 0; guard < 6 && !await page.$(HUB); guard++) {
    if (await page.$(selector('guided-client-selections-home'))) {
      await page.$eval(`${selector('guided-client-selections-home')} [data-category-key="interior"]`, element => element.click());
      await page.waitForSelector(selector('guided-interior-categories'));
    } else if (await page.$(selector('guided-interior-categories'))) {
      await page.$eval(`${selector('guided-interior-categories')} [data-category-key="bathroom-accessories"]`, element => element.click());
      await page.waitForSelector(HUB);
    } else {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await delay(800);
    }
  }
  await page.waitForSelector(SECTION);
}

async function savedLocalRecord() {
  return page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('estimate-builder-template-db');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    } finally {db.close();}
  }, `job:${projectId}`);
}

async function savedWhen(predicate) {
  let saved;
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await savedLocalRecord();
    if (saved && predicate(saved)) return saved;
  }
  return saved;
}

// The page instance is identified by a property set on its live DOM node and a value held in
// window: a remount replaces the node, a document reload clears window.
const stamp = () => page.evaluate((hub) => {
  window.__stabilityWindow = window.__stabilityWindow || `w${Date.now()}`;
  const node = document.querySelector(hub);
  if (node && !node.__stabilityNode) node.__stabilityNode = `n${Date.now()}`;
  return {window:window.__stabilityWindow, node:node?.__stabilityNode || '', onHub:Boolean(node), scrollY:Math.round(document.scrollingElement.scrollTop), inner:[...document.querySelectorAll('*')].filter(element => element.scrollTop > 0).map(element => Math.round(element.scrollTop)).join(',')};
}, HUB);
async function checkpoint(name, baseline) {
  const now = await stamp();
  report.checkpoints.push({name, ...now});
  if (!baseline) return now;
  assert.equal(now.window, baseline.window, `${name}: the document was reloaded`);
  assert(now.onHub, `${name}: the client was moved off the category they were working in`);
  assert.equal(now.node, baseline.node, `${name}: Client Selections was remounted`);
  return now;
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('load', () => { report.documentLoads += 1; });
  page.on('console', message => { if (message.type() === 'error') report.diagnostics.push(`console: ${message.text().slice(0, 300)}`); });
  page.on('requestfailed', request => { if (/\/api\//.test(request.url())) report.diagnostics.push(`request failed: ${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText}`); });
  page.on('response', response => { if (/\/api\//.test(response.url()) && response.status() >= 400) report.diagnostics.push(`api ${response.status()}: ${new URL(response.url()).pathname}`); });
  page.on('console', message => { if (/Fast Refresh|\[HMR\]/.test(message.text())) report.fastRefresh.push(`${new Date().toISOString()} ${message.text().slice(0, 160)}`); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites += 1;
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  await openBathroomAccessories();
  await delay(3000);
  const loadsAtStart = report.documentLoads;
  const baseline = await checkpoint('opened category');

  // Select a pack, then change one of its items while that selection's save is still in flight.
  const packId = await page.$eval(`${SECTION} [data-testid="selection-pack-card"]:nth-of-type(2)`, card => card.dataset.packId);
  await page.$eval(`${SECTION} [data-pack-id="${packId}"] [data-testid="selection-pack-select"]`, button => button.click());
  await page.waitForSelector(SELECTED);
  const originalRail = await railName();
  await page.$eval(`${selector('selection-pack-component-towel-rail')} button`, button => button.click());
  await page.waitForSelector(selector('selection-pack-swap'));
  const swappedTo = await page.evaluate((swapSelector, currentName) => {
    const option = [...document.querySelectorAll(`${swapSelector} [data-testid="selection-pack-swap-option"]`)].find(item => !item.classList.contains('current') && item.querySelector('b').innerText !== currentName && /\$/.test(item.querySelector('strong').innerText));
    const result = {name:option.querySelector('b').innerText, code:option.dataset.productCode};
    option.querySelector('button').click();
    return result;
  }, selector('selection-pack-swap'), originalRail);
  await page.waitForFunction((sel, name) => document.querySelector(`${sel} [data-testid="selection-pack-component-towel-rail"] strong`)?.innerText === name, {}, SELECTED, swappedTo.name);
  assert.notEqual(swappedTo.name, originalRail);
  await checkpoint('edited during save', baseline);

  // Scroll down inside the category and keep working while autosave and quotation sync run.
  await page.$eval(SELECTED, element => element.scrollIntoView({block:'start'}));
  const scrolled = await checkpoint('scrolled', baseline);
  const saved = await savedWhen(record => JSON.stringify(record.workbook?.clientSelectionsBook || {}).includes(swappedTo.code));
  assert(JSON.stringify(saved?.workbook?.clientSelectionsBook || {}).includes(swappedTo.code), 'the edit made during the save reached the stored job');
  const {clientSelectionsBook, selectionsBook, selectionSchedule, selectionSchedules, ...rest} = saved.workbook;
  report.stored = {revision:clientSelectionsBook?.metadata?.selectionRevision, swappedTo,
    quoteRowsWithEdit:Object.entries(rest.quotation || {}).flatMap(([name, section]) => (section.rows || []).filter(row => JSON.stringify(row).includes(swappedTo.code)).map(row => `${name}: ${row.item || row.description || row.productName} qty ${row.qty}`)),
    sectionsOutsideBookWithEdit:Object.keys(rest).filter(key => JSON.stringify(rest[key] ?? null).includes(swappedTo.code))};
  const afterSave = await checkpoint('after autosave + quotation sync', baseline);
  assert.equal(await railName(), swappedTo.name, 'the edit made while saving was reverted by the save');
  assert.equal(`${afterSave.scrollY}|${afterSave.inner}`, `${scrolled.scrollY}|${scrolled.inner}`, 'the scroll position jumped when the save completed');

  // Nothing may happen to an idle screen.
  await delay(idleMs);
  const afterIdle = await checkpoint(`idle ${idleMs} ms`, baseline);
  assert.equal(await railName(), swappedTo.name, 'the selection changed while idle');
  assert.equal(`${afterIdle.scrollY}|${afterIdle.inner}`, `${scrolled.scrollY}|${scrolled.inner}`, 'the scroll position jumped while idle');
  assert.equal(report.documentLoads, loadsAtStart, 'the browser document was reloaded');

  // A manual reload restores what was saved.
  const savedFile = path.join(out, 'saved-local-stability-job.json');
  fs.writeFileSync(savedFile, JSON.stringify(saved));
  await page.reload({waitUntil:'domcontentloaded'});
  await loadLocalJob(savedFile);
  await openBathroomAccessories();
  await page.waitForSelector(SELECTED);
  assert.equal(await railName(), swappedTo.name, 'saved selection restored after a manual reload');

  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (page) {
    report.trace = await page.evaluate(() => window.__csTrace || null).catch(() => null);
    await page.screenshot({path:path.join(out, report.passed ? 'passed.png' : 'failed.png')}).catch(() => {});
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const {trace, diagnostics, ...summary} = report;
  console.log(JSON.stringify(summary, null, 2));
  if (trace) console.log(trace.map(entry => `${String(entry.t).padStart(7)} ms  ${entry.event}  ${JSON.stringify({...entry, t:undefined, event:undefined})}`).join('\n'));
  await browser.close();
}
