import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {SIX_CABINETRY_ROOMS, readyCabinetrySelection} from './cabinetry-room-fixture.mjs';

// Cabinetry as one continuous multi-room workflow in the running app: Next from a room's Review &
// Confirm opens the next configured room, Previous from a room's first step opens the room before
// it, the summary appears only before the first room and after the last, and a save never moves
// the user. Uses an isolated local job with six ready cabinetry rooms; cloud writes are blocked.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-cabinetry-room-navigation-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/cabinetry-room-navigation-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-cabinetry-rooms-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local cabinetry room navigation regression';
const cabinetrySelection = readyCabinetrySelection();
const book = {documentType:'luxury_selections_book', rooms:[{id:'room-kitchen', name:'Kitchen', rows:[{id:'row-cabinetry', item:'Cabinetry', guidedRequirementKey:'cabinetry', selectedProduct:'Cabinetry specification',
  guidedSelection:{requirementKey:'cabinetry', requirementLabel:'Cabinetry', cabinetrySelection}}]}]};
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-CAB', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-CAB', clientName:'Local test client', address:'Local test address'},
  clientSelectionsBook:book, selectionsBook:book};
const fixture = path.join(out, 'local-cabinetry-job.json');
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
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, configured:[], forward:[], backward:[], summaryShownBetweenRooms:[], documentLoads:0, runtimeErrors:[], blockedCloudWrites:0};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const SUMMARY = selector('guided-kitchen-checklist');
const WORKFLOW = selector('guided-cabinetry-workflow');
const LANDING = selector('cabinetry-room-landing');
const NEXT = selector('cabinetry-bottom-next');
const PREVIOUS = selector('cabinetry-bottom-previous');
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-kitchen-checklist', 'guided-cabinetry-workflow'].map(selector).join(', ');
const click = sel => page.$eval(sel, element => element.click());
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function screenshot(name) { await page.screenshot({path:path.join(out, `${name}.png`)}); }

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

// Opens the cabinetry room list from wherever Client Selections currently is.
async function openCabinetryRooms() {
  for (let guard = 0; guard < 10 && !await page.$(LANDING); guard++) {
    if (await page.$(SUMMARY)) await page.$eval(`${SUMMARY} ${selector('guided-requirement-cabinetry')}`, card => (card.querySelector('button') || card).click());
    else if (await page.$(selector('guided-client-selections-home'))) await click(`${selector('guided-client-selections-home')} [data-category-key="interior"]`);
    else if (await page.$(selector('guided-interior-categories'))) await click(`${selector('guided-interior-categories')} [data-category-key="cabinetry"]`);
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
    await delay(900);
  }
  await page.waitForSelector(LANDING);
}
// { room, stage, stageNumber } while inside a room; nulls on the summary or the room list.
const where = () => page.evaluate((workflow, summary) => {
  const menu = document.querySelector(`${workflow} [data-testid="cabinetry-progress-menu"]`);
  const active = menu?.querySelector('.guidedProgressItem.active')?.innerText.trim().match(/\d+\..*$/)?.[0] || '';
  return {summary:Boolean(document.querySelector(summary)), room:menu?.querySelector('h2')?.innerText.trim() || '', stage:active.replace(/^\d+\.\s*/, ''), stageNumber:Number(active.match(/^(\d+)\./)?.[1] || 0),
    progress:document.querySelector('[data-testid="cabinetry-room-progress"]')?.innerText.trim() || ''};
}, WORKFLOW, SUMMARY);
const button = sel => page.$eval(sel, element => ({label:element.innerText.trim(), destination:element.dataset.destination, disabled:element.disabled}));
// Waits for the screen to settle on `predicate`, recording whether the summary was shown on the way.
async function arrive(predicate, description) {
  let sawSummary = false, at;
  for (let attempt = 0; attempt < 400; attempt++) {
    at = await where();
    if (predicate(at)) return {...at, sawSummary};
    if (at.summary) sawSummary = true;
    if (await page.$(selector('cabinetry-apply-colours-modal'))) await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-apply-colours-modal"] button')].find(item => item.innerText.trim() === 'Skip')?.click());
    await delay(150);
  }
  throw new Error(`Did not arrive at ${description}; last screen ${JSON.stringify(at)}`);
}
async function storedCabinetry() {
  return page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const stored = record?.workbook?.clientSelectionsBook;
      const row = (stored?.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.cabinetrySelection);
      return row ? {revision:stored.metadata?.selectionRevision || '', locations:row.guidedSelection.cabinetrySelection.locations} : null;
    } finally { db.close(); }
  }, `job:${projectId}`);
}
async function storedWhen(predicate) {
  let record;
  for (let attempt = 0; attempt < 250; attempt++) { await delay(300); record = await storedCabinetry(); if (record && predicate(record)) return record; }
  return record;
}
const done = record => record.locations.filter(location => location.status === 'complete' || location.confirmedAt).map(location => location.location);

try {
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('load', () => { report.documentLoads += 1; });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); }
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  await openCabinetryRooms();
  const loadsAtStart = report.documentLoads;

  // The configured locations, as the room list shows them.
  const rooms = await page.$$eval(`${LANDING} button`, cards => cards.map(card => ({name:card.querySelector('strong').innerText.trim(), status:card.querySelector('span').innerText.trim()})));
  report.configured = rooms.filter(item => item.status !== 'Not added').map(item => item.name);
  assert.deepEqual(report.configured, SIX_CABINETRY_ROOMS, 'the six configured cabinetry locations, in order');
  assert(/0 \/ 6/.test(await page.$eval(WORKFLOW, element => element.innerText)), 'room list shows 0 / 6 locations complete');

  // A save is not navigation: Save Draft in Kitchen leaves the user in Kitchen after the job save lands.
  await click(selector(`cabinetry-room-${slug('Kitchen')}`));
  await arrive(at => at.room === 'Kitchen' && at.stageNumber === 1, 'Kitchen step 1');
  await click(NEXT);
  await arrive(at => at.room === 'Kitchen' && at.stageNumber === 2, 'Kitchen step 2');
  await page.evaluate((workflow) => [...document.querySelectorAll(`${workflow} [data-testid="cabinetry-bottom-workflow-actions"] button`)].find(item => item.innerText.trim() === 'Save Draft').click(), WORKFLOW);
  assert(await storedWhen(record => record.revision), 'the draft reached the stored job');
  await delay(3000);
  const afterSave = await where();
  assert(afterSave.room === 'Kitchen' && afterSave.stageNumber === 2 && !afterSave.summary, `Save Draft left the user on Kitchen step 2, not ${JSON.stringify(afterSave)}`);
  report.saveDraftStayed = true;
  await click(PREVIOUS);
  await arrive(at => at.room === 'Kitchen' && at.stageNumber === 1, 'Kitchen step 1 via Previous');
  assert.deepEqual(await button(PREVIOUS), {label:'← Cabinetry Summary', destination:'summary', disabled:false});

  // Forward: every room, every step, straight into the next room.
  for (const [index, room] of SIX_CABINETRY_ROOMS.entries()) {
    const stages = [];
    for (let at = await where(); ; at = await where()) {
      assert.equal(at.room, room);
      stages.push(at.stage);
      const next = await button(NEXT);
      if (next.destination !== 'step') break;
      assert.equal(next.label, 'Next →');
      await click(NEXT);
      await arrive(now => now.room === room && now.stageNumber === at.stageNumber + 1, `${room} step ${at.stageNumber + 1}`);
    }
    assert.equal(stages.length, 7, `${room}: ${stages.join(' > ')}`);
    assert.equal(stages.at(-1), 'Review & Confirm');
    const following = SIX_CABINETRY_ROOMS[index + 1];
    const next = await button(NEXT);
    assert.equal(next.label, following ? `Next: ${following} →` : 'Finish Cabinetry');
    assert.equal(next.destination, following || 'summary');
    await click(NEXT);
    if (following) {
      const arrived = await arrive(at => at.room === following && at.stageNumber === 1, `${following} step 1 after ${room}`);
      if (arrived.sawSummary) report.summaryShownBetweenRooms.push(`${room} > ${following}`);
      assert.equal(arrived.stage, stages[0], `${following} opens at its first step`);
      assert(arrived.progress.includes(`Location ${index + 2} of 6`) && arrived.progress.includes(`${index + 1} of 6 locations complete`), arrived.progress);
      report.forward.push(`${room} / Review & Confirm -> [${next.label}] -> ${following} / ${arrived.stage} (${index + 1} of 6 locations complete)`);
    } else {
      await arrive(at => at.summary, 'the Cabinetry summary after the last room');
      report.forward.push(`${room} / Review & Confirm -> [${next.label}] -> Cabinetry summary`);
    }
  }
  assert.deepEqual(report.summaryShownBetweenRooms, [], 'the summary is never shown between rooms');
  assert.equal(await page.$eval(selector('checklist-progress'), element => element.innerText.trim()), '6 of 6 locations complete');
  await screenshot('01-summary-after-finish');
  const finished = await storedWhen(record => done(record).length === 6);
  assert.deepEqual(done(finished), SIX_CABINETRY_ROOMS, 'every room is stored complete');
  const kitchen = finished.locations.find(location => location.location === 'Kitchen');
  assert.equal(kitchen.areaSelections.lowerDoorsDrawers.colourName, 'Test White'); assert.equal(kitchen.handles.base.productName, 'Test handle'); assert.equal(kitchen.benchtop.range, 'Test laminate');

  // Backward: from the last room's first step, Previous walks to the first room's first step.
  await openCabinetryRooms();
  assert(/6 \/ 6/.test(await page.$eval(WORKFLOW, element => element.innerText)));
  await click(selector(`cabinetry-room-${slug('Laundry')}`));
  await arrive(at => at.room === 'Laundry' && at.stageNumber === 1, 'Laundry step 1');
  for (let index = SIX_CABINETRY_ROOMS.length - 1; index >= 0; index--) {
    const room = SIX_CABINETRY_ROOMS[index], preceding = SIX_CABINETRY_ROOMS[index - 1];
    for (let at = await where(); at.stageNumber > 1; at = await where()) {
      assert.equal(at.room, room);
      assert.deepEqual(await button(PREVIOUS), {label:'← Previous', destination:'step', disabled:false});
      await click(PREVIOUS);
      await arrive(now => now.room === room && now.stageNumber === at.stageNumber - 1, `${room} step ${at.stageNumber - 1}`);
    }
    const previous = await button(PREVIOUS);
    assert.equal(previous.label, preceding ? `← Previous: ${preceding}` : '← Cabinetry Summary');
    await click(PREVIOUS);
    if (preceding) {
      const arrived = await arrive(at => at.room === preceding && at.stageNumber === 7, `${preceding} Review & Confirm before ${room}`);
      if (arrived.sawSummary) report.summaryShownBetweenRooms.push(`${room} < ${preceding}`);
      assert.equal(arrived.stage, 'Review & Confirm');
      report.backward.push(`${room} / step 1 -> [${previous.label}] -> ${preceding} / Review & Confirm`);
    } else {
      await arrive(at => at.summary, 'the Cabinetry summary before the first room');
      report.backward.push(`${room} / step 1 -> [${previous.label}] -> Cabinetry summary`);
    }
  }
  assert.deepEqual(report.summaryShownBetweenRooms, [], 'the summary is never shown between rooms going backwards');
  assert.equal(await page.$eval(selector('checklist-progress'), element => element.innerText.trim()), '6 of 6 locations complete', 'going back does not undo a completed room');
  await delay(2500);
  assert.deepEqual(done(await storedCabinetry()), SIX_CABINETRY_ROOMS, 'the stored rooms are still complete');
  assert.equal(report.documentLoads, loadsAtStart, 'the page was never reloaded');
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  if (page) await screenshot('failed').catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
