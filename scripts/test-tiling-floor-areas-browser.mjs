import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Tiles & Stone in the running app: Additional Floor Tiling. Floor-only areas are rows (area m2,
// tile, wastage, confirm), imported from the job's Job Setup areas, with the tile copied between rows. Uses an isolated local job; cloud
// writes are blocked, existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-floor-areas-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/tiling-floor-areas-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-tiling-floor-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local floor tiling regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', address:'Local test address'}};
// This job has an alfresco and a patio in Job Setup - and no balcony or porch.
workbook.data = {...(workbook.data || {}), inputDataSheet:{...(workbook.data?.inputDataSheet || {}), rows:{...(workbook.data?.inputDataSheet?.rows || {})}}};
for (const [key, value] of Object.entries({lowerAlfrescoAreaM2:15.3, lowerPatioAreaM2:22})) workbook.data.inputDataSheet.rows[key] = {...(workbook.data.inputDataSheet.rows[key] || {}), value};
const fixture = path.join(out, 'local-tiling-job.json');
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
const report = {passed:false, projectId, tests:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'tiling-rooms-workflow'].map(selector).join(', ');
const text = testId => page.$eval(selector(testId), element => element.innerText.replace(/\s+/g, ' ').trim());

async function screenshot(name) {
  await page.screenshot({path:path.join(out, `${name}.png`)});
  report.screenshots.push(`${name}.png`);
}

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter(label => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate((value) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === value)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

async function openTiling() {
  const rooms = selector('tiling-rooms-workflow');
  for (let guard = 0; guard < 6 && !await page.$(rooms); guard++) {
    if (await page.$(selector('guided-client-selections-home'))) {
      await page.$eval(`${selector('guided-client-selections-home')} [data-category-key="interior"]`, element => element.click());
      await page.waitForSelector(selector('guided-interior-categories'));
    } else if (await page.$(selector('guided-interior-categories'))) {
      await page.$eval(`${selector('guided-interior-categories')} [data-category-key="tiles-stone"]`, element => element.click());
      await page.waitForSelector(rooms);
    } else {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await delay(800);
    }
  }
  await page.waitForSelector(rooms);
}

async function openRoom(name) {
  if (await page.$(selector('tiling-room-editor'))) await page.$eval(`${selector('tiling-room-editor')} .tl-link`, button => button.click());
  await page.waitForSelector(selector('tiling-rooms-workflow'));
  await page.evaluate((roomName) => {
    const card = [...document.querySelectorAll('.tl-room-card')].find(item => item.querySelector('h3').innerText.trim().toLowerCase() === roomName.toLowerCase());
    card.querySelector('.tl-primary').click();
  }, name);
  await page.waitForSelector(selector('tiling-room-editor'));
}

async function enter(testId, value) {
  await page.click(selector(testId), {clickCount:3});
  await page.keyboard.press('Backspace');
  await page.type(selector(testId), String(value));
}

async function gotoStep(label) {
  await page.evaluate((value) => [...document.querySelectorAll('.tl-steps button')].find(button => button.innerText.includes(value)).click(), label);
  await delay(150);
}

// Every dimension field on screen: its label and unit.
const fieldUnits = () => page.$$eval('.tl-main .tl-field', fields => fields.map(field => ({label:field.childNodes[0].textContent.trim(), unit:field.querySelector('em')?.innerText || ''})).filter(field => field.unit));

// Where each Choose Tile button sits relative to the area above it.
const choosePlacement = () => page.$$eval('.tl-slot', slots => slots.map(slot => {
  const area = slot.querySelector('.tl-slot-areas').getBoundingClientRect();
  const button = slot.querySelector('.tl-choose').getBoundingClientRect();
  const box = slot.getBoundingClientRect();
  return {slot:slot.dataset.testid, label:slot.querySelector('.tl-choose').innerText, leftOffset:Math.round(button.left - area.left), gapBelowArea:Math.round(button.top - area.bottom), rightGap:Math.round(box.right - button.right), slotWidth:Math.round(box.width)};
}));

function assertPlacement(placement, label) {
  assert(placement.length, `${label}: tile slots shown`);
  for (const item of placement) {
    assert(Math.abs(item.leftOffset) <= 4, `${label} ${item.slot}: button starts under its area (offset ${item.leftOffset}px)`);
    assert(item.gapBelowArea >= 0 && item.gapBelowArea <= 40, `${label} ${item.slot}: button is directly below the area (${item.gapBelowArea}px)`);
    assert(/^(CHOOSE|CHANGE) (FLOOR|WALL|SPLASHBACK|FEATURE) TILE$|^(CHOOSE|CHANGE) MOSAIC$/.test(item.label), `${label}: specific label (${item.label})`);
  }
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites.push({method:request.method(), path:new URL(request.url()).pathname});
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {
    key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session,
  });
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  await openTiling();
  const rowIds = () => page.$$eval('.tl-floor-row', rows => Object.fromEntries(rows.map(row => [row.dataset.areaName, row.dataset.testid])));
  const rowSel = async (name) => selector((await rowIds())[name]);
  const row = async (name) => page.$eval(await rowSel(name), element => ({
    status:element.dataset.status,
    label:element.querySelector('[data-testid="tiling-floor-status"]').innerText.trim(),
    area:element.querySelector('[data-testid="tiling-floor-area"]').innerText.trim(),
    tile:element.querySelector('.tl-product-line strong')?.innerText.trim() || '',
    required:element.querySelector('[data-testid="tiling-floor-required"]')?.innerText.replace(/\s+/g, ' ').trim() || '',
    missing:[...element.querySelectorAll('.tl-missing li')].map(item => item.innerText.trim()),
    button:element.querySelector('[data-testid="tiling-floor-choose"]').innerText.trim(),
    fields:[...element.querySelectorAll('.tl-field')].map(field => field.childNodes[0].textContent.trim()),
    external:element.querySelector('[data-testid="tiling-floor-external"]').checked,
    text:element.innerText,
  }));
  const inRow = async (name, testId) => `${await rowSel(name)} ${selector(testId)}`;
  const typeIn = async (target, value) => { await page.click(target, {clickCount:3}); await page.keyboard.press('Backspace'); await page.type(target, String(value)); };
  async function chooseRowTile(name, position = 0) {
    await page.$eval(await inRow(name, 'tiling-floor-choose'), button => button.click());
    await page.waitForSelector(selector('tiling-tile-picker'));
    const picker = await page.evaluate((pickerSel, position) => {
      const element = document.querySelector(pickerSel);
      const cards = [...element.querySelectorAll('.tl-tile')];
      const info = {heading:element.querySelector('h3').innerText.replace(/\s+/g, ' '), filter:Boolean(element.querySelector('[data-testid="tiling-external-filter"]')), cards:cards.length, externalRated:cards.filter(card => /External rated/.test(card.innerText)).length};
      cards[position].querySelector('[data-testid="tiling-tile-select"]').click();
      return info;
    }, selector('tiling-tile-picker'), position);
    await page.waitForSelector(selector('tiling-floor-areas'));
    return picker;
  }
  const waitRow = async (name, predicate) => { for (let attempt = 0; attempt < 100; attempt++) { const value = await row(name); if (predicate(value)) return value; await delay(200); } return row(name); };

  // 1. Project areas are rows under Additional Floor Tiling, not room cards.
  const roomCards = await page.$$eval('.tl-room-card h3', items => items.map(item => item.innerText.trim()));
  assert(!roomCards.some(name => /ALFRESCO|PATIO|BALCONY|ENTRY/.test(name)), `floor-only areas are not room cards: ${roomCards}`);
  assert.deepEqual(Object.keys(await rowIds()), ['Alfresco', 'Patio'], 'the job\'s Alfresco and Patio are imported; nothing it does not have');
  assert.equal(await text('tiling-floor-count'), '0 of 2 areas complete');
  assert.equal(await text('tiling-complete-count'), `0 of ${roomCards.length} rooms complete`);
  let alfresco = await row('Alfresco');
  assert.equal(alfresco.area, '15.30m²', 'Alfresco area imported from Job Setup');
  assert.deepEqual(alfresco.fields, ['Area / location', 'Area', 'Wastage'], 'a name, an area and a wastage - no width/length, no bathroom fields');
  assert(!/shower|bath|vanity|splashback|ceiling|perimeter|door|window|floor to ceiling|floor waste/i.test(alfresco.text), `no bathroom workflow on a floor area: ${alfresco.text}`);
  assert.deepEqual(alfresco.missing, ['External floor tile not selected']);
  assert.equal(alfresco.button, 'CHOOSE TILE');
  // The Choose Tile button sits directly under the area, at the left of the row.
  const placement = await page.evaluate((sel) => { const element = document.querySelector(sel); const area = element.querySelector('.tl-slot-areas').getBoundingClientRect(); const button = element.querySelector('[data-testid="tiling-floor-choose"]').getBoundingClientRect(); const box = element.getBoundingClientRect(); return {leftOffset:Math.round(button.left - area.left), below:Math.round(button.top - area.bottom), rightGap:Math.round(box.right - button.right), width:Math.round(box.width)}; }, await rowSel('Alfresco'));
  assert(Math.abs(placement.leftOffset) <= 4 && placement.below >= 0 && placement.below <= 40 && placement.rightGap > placement.width / 2, `Choose Tile is under the area: ${JSON.stringify(placement)}`);

  // 2-4. External tile, wastage and required quantity, confirm.
  const picker = await chooseRowTile('Alfresco');
  assert(picker.filter && /external-rated floor tiles/.test(picker.heading) && picker.externalRated === picker.cards, `external tiles offered: ${JSON.stringify(picker)}`);
  alfresco = await row('Alfresco');
  assert(alfresco.tile, 'tile shown on the row');
  assert.match(alfresco.required, /Required: 15\.30m² \+ 10% wastage = 16\.83m²/);
  assert.equal(alfresco.button, 'CHANGE TILE');
  assert.equal(alfresco.label, 'IN PROGRESS', 'not complete until confirmed');
  await page.$eval(await inRow('Alfresco', 'tiling-floor-confirm'), button => button.click());
  alfresco = await waitRow('Alfresco', value => value.status === 'complete');
  assert.equal(alfresco.label, '✓ COMPLETE');
  assert.equal(await text('tiling-floor-count'), '1 of 2 areas complete');

  // 5-7. Add a Balcony row by hand: name, area in m², its own tile.
  await page.$eval(selector('tiling-add-floor-area'), button => button.click());
  await page.waitForFunction(() => document.querySelectorAll('.tl-floor-row').length === 3);
  await typeIn(await inRow('Floor area 3', 'tiling-floor-name'), 'Balcony');
  await typeIn(await inRow('Balcony', 'tiling-floor-area-input'), '8.4');
  let balcony = await row('Balcony');
  assert.equal(balcony.area, '8.40m²');
  assert.equal(balcony.external, true, 'a balcony is external');
  await chooseRowTile('Balcony', 3);
  balcony = await row('Balcony');
  assert.notEqual(balcony.tile, alfresco.tile);
  assert.match(balcony.required, /8\.40m² \+ 10% wastage = 9\.24m²/);

  // 8-9. Apply the Alfresco tile to the Balcony: the tile changes, the area does not.
  await page.$eval(await inRow('Alfresco', 'tiling-floor-apply-open'), button => button.click());
  await page.waitForSelector(selector('tiling-floor-apply-panel'));
  const offered = await page.$$eval(`${selector('tiling-floor-apply-panel')} .tl-scheme-rooms label`, labels => labels.map(label => label.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(offered, ['Patio', 'Balcony has a tile - will be replaced'], 'other floor areas only - never bathrooms');
  await page.evaluate((panel) => [...document.querySelectorAll(`${panel} .tl-scheme-rooms label`)].find(label => label.innerText.includes('Balcony')).querySelector('input').click(), selector('tiling-floor-apply-panel'));
  await screenshot('floor-apply-tile');
  await page.$eval(selector('tiling-floor-apply'), button => button.click());
  balcony = await waitRow('Balcony', value => value.tile === alfresco.tile);
  assert.equal(balcony.tile, alfresco.tile, '8: Balcony now uses the Alfresco tile');
  assert.equal(balcony.area, '8.40m²', '9: Balcony keeps its own area');
  assert.match(balcony.required, /8\.40m² \+ 10% wastage = 9\.24m²/, '9: and its own quantity');
  assert.equal((await row('Patio')).tile, '', 'an unticked area is untouched');
  assert.equal((await row('Alfresco')).area, '15.30m²');
  await page.$eval(await inRow('Balcony', 'tiling-floor-confirm'), button => button.click());
  await waitRow('Balcony', value => value.status === 'complete');

  // Optional dimensions in mm, and re-importing the measured area.
  await page.$eval(await inRow('Patio', 'tiling-floor-from-dimensions'), button => button.click());
  await typeIn(await inRow('Patio', 'tiling-floor-width'), 3400);
  await typeIn(await inRow('Patio', 'tiling-floor-length'), 4500);
  assert.equal((await row('Patio')).area, '15.30m²', '3400 x 4500 mm = 15.30 m²');
  await page.$eval(await inRow('Patio', 'tiling-floor-import'), button => button.click());
  assert.equal((await row('Patio')).area, '22.00m²', 'measured area re-imported');
  assert.equal(await text('tiling-floor-count'), '2 of 3 areas complete');
  await page.$eval(selector('tiling-floor-areas'), element => element.scrollIntoView({block:'start'}));
  await screenshot('additional-floor-tiling');

  // The full room workflow is still there for rooms that need it (Kitchen splashback).
  await openRoom('Kitchen');
  await enter('tiling-splashback-length', 3000);
  await enter('tiling-splashback-height', 600);
  await gotoStep('Tiles');
  await page.$eval(selector('tiling-choose-splashback'), button => button.click());
  await page.waitForSelector(selector('tiling-tile-picker'));
  await page.$eval(selector('tiling-tile-select'), button => button.click());
  await gotoStep('Review');
  await page.$eval(selector('tiling-confirm'), button => button.click());
  await page.waitForSelector(selector('tiling-rooms-workflow'));
  assert.equal(await text('tiling-complete-count'), `1 of ${roomCards.length} rooms complete`);
  assert.equal(await text('tiling-floor-count'), '2 of 3 areas complete', 'areas are counted separately from rooms');

  // 10. Saved job: location kept, identical tile consolidated with its breakdown.
  let saved;
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await page.evaluate(async key => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try { return await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
    }, `job:${projectId}`);
    if (saved?.workbook?.quotation?.['TILING - KITCHEN']?.rows?.some(item => /Splashback - National/.test(item.item))) break;
  }
  const selection = (saved.workbook.clientSelectionsBook.rooms || []).flatMap(item => item.rows || []).find(item => item.guidedSelection?.tilingRooms).guidedSelection;
  assert.deepEqual([selection.tilingFloorAreas, selection.tilingCompleteFloorAreas], [3, 2], JSON.stringify(selection.tilingRoomStatuses));
  const quotation = saved.workbook.quotation;
  const lines = (section) => quotation[section].rows.map(item => `${item.item.split(' - ')[0]} ${item.qty} ${item.unit}`);
  assert.deepEqual(lines('TILING - ALFRESCO'), ['External floor tiles 16.83 M2', 'Labour 15.3 M2'], 'Alfresco: a floor tile line and floor labour, nothing else');
  assert.deepEqual(lines('TILING - BALCONY'), ['External floor tiles 9.24 M2', 'Labour 8.4 M2']);
  const shared = selection.tilingProductTotals.find(entry => entry.rooms.length === 2);
  assert.deepEqual(shared.rooms.map(item => `${item.roomName} ${item.orderAreaM2}`), ['Alfresco 16.83', 'Balcony 9.24']);
  assert.equal(shared.orderAreaM2, 26.07, 'consolidated total');
  const procurement = (saved.workbook.procurement.items || []).filter(item => item.productId === shared.productId);
  assert.deepEqual(procurement.map(item => `${item.location} total ${item.productTotalOrderAreaM2}`), ['Alfresco total 26.07', 'Balcony total 26.07']);
  const summary = await text('tiling-order-summary');
  assert.match(summary, /Alfresco: 16\.83m² Balcony: 9\.24m² 26\.07m²/, `order summary: ${summary}`);
  report.tests = {rooms:roomCards, alfresco, balcony, picker, placement, saved:{quotation:Object.keys(quotation).filter(name => name.startsWith('TILING - ')), consolidated:`${shared.productName}: ${shared.rooms.map(item => `${item.roomName} ${item.orderAreaM2} m²`).join(' + ')} = ${shared.orderAreaM2} m²`}};

  await page.$eval(`${selector('tiling-rooms-workflow')} .tl-link`, button => button.click());
  await page.waitForSelector(selector('guided-interior-categories'));
  const card = await page.$eval(`${selector('guided-interior-categories')} [data-category-key="tiles-stone"]`, element => element.innerText.replace(/\s+/g, ' '));
  assert.match(card, new RegExp(`3 of ${roomCards.length + 3} rooms & areas complete`, 'i'), `Tiles & Stone card: ${card}`);
  report.tests.card = card;

  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
  console.log(JSON.stringify({passed:true, tests:report.tests, blockedCloudWrites:report.blockedCloudWrites.length}, null, 2));
} catch (error) {
  report.error = error.message;
  if (page) {
    await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
    fs.writeFileSync(path.join(out, 'failure.txt'), await page.evaluate(() => document.body.innerText).catch(() => ''));
  }
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
