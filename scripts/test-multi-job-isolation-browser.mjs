import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Multi-job isolation in the running app, with several tabs of one browser (shared storage):
//   1. two jobs open in two tabs, each tab's URL naming its own job;
//   2. an edit / autosave in Job A's tab writes Job A only; Job B is not altered, and vice versa;
//   3. opening Job B elsewhere does not move Job A's tab; a reload reopens each tab's own job;
//   4. the same job open in two tabs: the stale tab's save is rejected, nothing is overwritten;
//   5. a link naming a job this browser does not hold opens no other job in its place;
//   6. draft caches are keyed per job.
// Isolated local jobs; cloud writes are blocked and existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-multi-job-isolation-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/multi-job-isolation-browser');
fs.mkdirSync(out, {recursive:true});
const stamp = Date.now();
function fixtureFor(letter, rooms) {
  const projectId = `local-isolation-${letter.toLowerCase()}-${stamp}`;
  const defaults = createEstimateBuilderWorkbookDefaults();
  for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
  const jobName = `Isolation Job ${letter}`;
  const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
    registeredJob:{jobId:projectId, jobName, jobNumber:`ISO-${letter}`, clientName:`Client ${letter}`, siteAddress:`${letter} Street`},
    jobFileMeta:{projectId, jobName, jobNumber:`ISO-${letter}`, clientName:`Client ${letter}`, address:`${letter} Street`},
    aiPlanTakeoffJob:{placedOpenings:rooms.map(([roomKey, roomLabel], index) => ({id:`opening-${index}`, openingType:'window', roomKey, roomLabel, location:roomLabel}))}};
  const file = path.join(out, `job-${letter}.json`);
  fs.writeFileSync(file, JSON.stringify({projectId, jobName, workbook}));
  return {letter, projectId, jobName, file, key:`job:${projectId}`};
}
const A = fixtureFor('A', [['kitchen', 'Kitchen'], ['bed-1', 'Bed 1'], ['family', 'Family']]);
const B = fixtureFor('B', [['kitchen', 'Kitchen'], ['other', 'Study'], ['garage', 'Garage']]);

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
  headless:true, protocolTimeout:180000, defaultViewport:{width:1600, height:1000},
});
const route = `${origin}/modules/estimate-builder?page=clientSelections`;
const report = {passed:false, steps:{}, runtimeErrors:[]};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const HOME = selector('guided-client-selections-home');
const INTERIOR = selector('guided-interior-categories');
const OVERVIEW = selector('electrical-schedule');
const EDITOR = selector('electrical-room-editor');
const GUIDED = [HOME, INTERIOR, selector('guided-exterior-categories'), OVERVIEW, EDITOR].join(', ');

async function newTab(address = route) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('console', message => { if (/job save was not completed|JobConflict|saved somewhere else/i.test(message.text())) (report.saveWarnings ||= []).push(message.text().slice(0, 300)); });
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort();
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
  await page.goto(address, {waitUntil:'domcontentloaded', timeout:180000});
  return page;
}
async function loadJob(page, file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogs = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(text => labels.includes(text));
    for (const text of dialogs) await page.evaluate(value => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), text);
    if (!dialogs.length && attempt >= 1 && await page.$(GUIDED)) return;
  }
  await page.waitForSelector(GUIDED);
}
const click = (page, sel) => page.$eval(sel, element => element.click());
async function openElectrical(page) {
  await page.bringToFront();   // a user only ever works in the tab in front; background tabs are throttled by the browser
  for (let guard = 0; guard < 10 && !await page.$(OVERVIEW); guard++) {
    if (await page.$(EDITOR)) await click(page, selector('electrical-all-rooms'));
    else if (await page.$(INTERIOR)) await click(page, `${INTERIOR} [data-category-key="electrical-technology"]`);
    else if (await page.$(HOME)) await click(page, `${HOME} [data-category-key="interior"]`);
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
    await delay(800);
  }
  await page.waitForSelector(OVERVIEW);
}
// Sets a room's Double Powerpoints to `quantity` and saves it. Returns the save state shown ("saved" | "failed").
async function setRoom(page, room, quantity) {
  await openElectrical(page);
  await click(page, `${selector('electrical-room')}[data-room="${room}"] ${selector('electrical-room-edit')}`);
  await page.waitForFunction((sel, name) => document.querySelector(sel)?.dataset.room === name, {}, EDITOR, room);
  const value = () => page.$eval(selector('electrical-qty-double-gpo'), input => Number(input.value));
  for (let guard = 0; guard < 60 && await value() !== quantity; guard++) await click(page, selector(`electrical-qty-double-gpo-${await value() < quantity ? 'plus' : 'minus'}`));
  await click(page, selector('electrical-save-next'));
  await page.waitForFunction(() => /saved|failed/.test(document.querySelector('[data-testid="electrical-save-state"]')?.className || ''), {timeout:120000});
  return page.$eval(selector('electrical-save-state'), element => (element.classList.contains('saved') ? 'saved' : 'failed'));
}
const jobInUrl = page => new URL(page.url()).searchParams.get('jobId') || '';
const shownJob = page => page.evaluate(() => document.body.innerText.match(/Isolation Job [A-Z]/)?.[0] || '');
async function stored(page, key) {
  return page.evaluate(async jobKey => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(jobKey); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record?.workbook) return null;
      const row = (record.workbook.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.electricalSchedule);
      const points = Object.fromEntries((row?.guidedSelection.electricalSchedule.rooms || []).filter(room => room.points?.['double-gpo']).map(room => [room.room, room.points['double-gpo']]));
      return {revision:record.revision, jobName:record.workbook.registeredJob?.jobName || '', updatedBy:record.updatedBy?.tabId || '', updatedAt:record.updatedAt || '', points,
        quoteRows:Object.values(record.workbook.quotation || {}).flatMap(section => section.rows || []).filter(item => item.source === 'client-selections-electrical-schedule').map(item => `${item.location}:${item.quantity}`)};
    } finally { db.close(); }
  }, key);
}
async function storedWhen(page, key, predicate) {
  let record;
  for (let attempt = 0; attempt < 120; attempt++) { record = await stored(page, key); if (record && predicate(record)) return record; await delay(500); }
  return record;
}
// The job writes have stopped: the revision is unchanged for 6 seconds.
async function settled(page, key) {
  let last = -1, since = Date.now();
  for (;;) { const revision = (await stored(page, key))?.revision ?? 0; if (revision !== last) { last = revision; since = Date.now(); } if (Date.now() - since > 6000) return last; await delay(750); }
}

try {
  // 1 - two jobs in two tabs; each tab's URL names its own job
  const tabA = await newTab();
  await loadJob(tabA, A.file);
  await tabA.waitForFunction(id => new URL(location.href).searchParams.get('jobId') === id, {timeout:60000}, A.projectId);
  const tabB = await newTab();
  await loadJob(tabB, B.file);
  await tabB.waitForFunction(id => new URL(location.href).searchParams.get('jobId') === id, {timeout:60000}, B.projectId);
  assert.deepEqual([jobInUrl(tabA), jobInUrl(tabB)], [A.projectId, B.projectId], 'each tab names its own job; opening Job B did not move Job A\’s tab');
  assert.deepEqual([await shownJob(tabA), await shownJob(tabB)], ['Isolation Job A', 'Isolation Job B']);
  report.steps.twoTabs = {tabA:jobInUrl(tabA), tabB:jobInUrl(tabB)};

  // 2 - an edit in Job A's tab is saved to Job A only
  await settled(tabA, A.key); await settled(tabB, B.key);
  const beforeB = await stored(tabB, B.key);
  assert.equal(await setRoom(tabA, 'Kitchen', 6), 'saved');
  const afterA = await storedWhen(tabA, A.key, record => record.points.Kitchen === 6);
  assert.deepEqual([afterA.jobName, afterA.points, afterA.quoteRows], ['Isolation Job A', {Kitchen:6}, ['Kitchen:6']]);
  await settled(tabA, A.key);
  const untouchedB = await stored(tabA, B.key);
  assert.deepEqual([untouchedB.revision, untouchedB.points, untouchedB.quoteRows, untouchedB.jobName], [beforeB.revision, {}, [], 'Isolation Job B'], 'Job B was not written by Job A\’s save or autosave');
  // ... and the other way round, while the browser-wide "last job" pointer is Job A.
  const revisionA = (await stored(tabA, A.key)).revision;
  assert.equal(await setRoom(tabB, 'Study', 3), 'saved');
  const afterB = await storedWhen(tabB, B.key, record => record.points.Study === 3);
  assert.deepEqual([afterB.jobName, afterB.points, afterB.quoteRows], ['Isolation Job B', {Study:3}, ['Study:3']]);
  await settled(tabB, B.key);
  const untouchedA = await stored(tabB, A.key);
  assert.deepEqual([untouchedA.revision, untouchedA.points], [revisionA, {Kitchen:6}], 'Job A was not written by Job B\’s save or autosave');
  assert.notEqual(afterA.updatedBy, afterB.updatedBy, 'each tab stamps its own writes'); assert(afterA.updatedBy && afterA.updatedAt);
  report.steps.isolatedSaves = {A:afterA.points, B:afterB.points};

  // 3 - reload: each tab reopens its own job (the shared pointer now says Job B)
  await tabA.bringToFront();
  await tabA.reload({waitUntil:'domcontentloaded'});
  await tabA.waitForSelector(GUIDED, {timeout:120000});
  assert.deepEqual([jobInUrl(tabA), await shownJob(tabA)], [A.projectId, 'Isolation Job A'], 'reload restores Job A in Job A\’s tab');
  await openElectrical(tabA);
  assert(/6 powerpoints/.test(await tabA.$eval(`${selector('electrical-room')}[data-room="Kitchen"]`, card => card.innerText)), 'and its saved selection');
  assert.equal(await tabA.$(`${selector('electrical-room')}[data-room="Study"]`), null, 'no room of Job B appears in Job A');
  report.steps.reload = {tabA:await shownJob(tabA)};

  // 4 - the same job in two tabs: the stale tab cannot overwrite the newer save
  const tabA2 = await newTab(`${route}&jobId=${A.projectId}`);
  await tabA2.bringToFront();
  await tabA2.waitForSelector(GUIDED, {timeout:120000});
  assert.equal(await shownJob(tabA2), 'Isolation Job A', 'a link naming Job A opens Job A');
  await openElectrical(tabA);   // Job A's first tab has the job loaded at the current revision
  await settled(tabA, A.key);
  assert.equal(await setRoom(tabA2, 'Family', 4), 'saved');
  const newer = await storedWhen(tabA2, A.key, record => record.points.Family === 4);
  await settled(tabA2, A.key);
  const newerRevision = (await stored(tabA2, A.key)).revision;
  assert.equal(await setRoom(tabA, 'Kitchen', 9), 'failed', 'the stale tab is told its save did not go through');
  await delay(6000);
  const kept = await stored(tabA, A.key);
  assert.deepEqual([kept.points, kept.revision, kept.updatedBy], [{Kitchen:6, Family:4}, newerRevision, newer.updatedBy], 'the newer save is intact: nothing was silently overwritten');
  report.steps.sameJobConflict = {storedAfterStaleSave:kept.points, revision:kept.revision};

  // 5 - a link to a job this browser does not hold opens nothing else
  const tabMissing = await newTab(`${route}&jobId=not-a-job-${stamp}`);
  await delay(12000);
  assert.equal(await shownJob(tabMissing), '', 'no other job was opened in place of the missing one');
  assert.deepEqual([(await stored(tabMissing, A.key)).revision, (await stored(tabMissing, B.key)).revision], [newerRevision, (await stored(tabB, B.key)).revision], 'and no job was written');
  report.steps.missingJob = {opened:await shownJob(tabMissing) || 'none'};

  // 6 - draft caches are per job
  const draftKeys = await tabA.evaluate(() => Object.keys(localStorage).filter(key => /embedded-selections-book/.test(key) && !key.endsWith(':latest')));
  assert(draftKeys.some(key => key.endsWith(`:${A.projectId}`)) && draftKeys.some(key => key.endsWith(`:${B.projectId}`)), `selection drafts are keyed by job: ${draftKeys.join(', ')}`);
  const draftJobs = await tabA.evaluate(keys => keys.map(key => [key.split(':').pop(), JSON.parse(localStorage.getItem(key)).projectId]), draftKeys.filter(key => key.endsWith(A.projectId) || key.endsWith(B.projectId)));
  assert(draftJobs.every(([suffix, projectId]) => suffix === projectId), 'each draft holds its own job');
  report.steps.draftKeys = draftKeys.length;

  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
