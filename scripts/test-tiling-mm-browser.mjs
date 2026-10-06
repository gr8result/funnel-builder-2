import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Tiles & Stone in the running app: every linear dimension is entered in mm, areas are m2, and each
// Choose Tile button sits directly under the area it is for. Uses an isolated local job; cloud
// writes are blocked, existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-tiling-mm-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/tiling-mm-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-tiling-mm-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local tiling mm regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-TILING', clientName:'Local test client', address:'Local test address'}};
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
  report.tests.rooms = await page.$$eval('.tl-room-card h3', items => items.map(item => item.innerText.trim()));

  // KITCHEN - splashback 3000 x 600 mm = 1.80 m2 (TEST 2), room 3000 x 4000 mm = 12.00 m2 (TEST 1)
  await openRoom('Kitchen');
  await page.$eval(selector('tiling-floor-tiled'), button => button.click());
  const kitchenUnits = await fieldUnits();
  assert(kitchenUnits.filter(field => !/area/i.test(field.label)).every(field => field.unit === 'mm'), `Kitchen linear fields are mm: ${JSON.stringify(kitchenUnits)}`);
  assert(kitchenUnits.filter(field => /area/i.test(field.label)).every(field => field.unit === 'm²'), 'area fields stay m²');
  await enter('tiling-width', 3000);
  await enter('tiling-length', 4000);
  assert.equal(await text('tiling-floor-result'), '12.00m²', 'TEST 1');
  assert.equal(await text('tiling-perimeter-result'), '14.00 m', 'perimeter shown in metres');
  await enter('tiling-splashback-length', 3000);
  await enter('tiling-splashback-height', 600);
  assert.match(await text('tiling-splashback-result'), /3000mm × 600mm = 1\.80m²/, 'TEST 2');
  await enter('tiling-width', 3500);
  await enter('tiling-length', 4200);
  assert.equal(await text('tiling-floor-result'), '14.70m²', 'TEST 4');
  await screenshot('kitchen-dimensions-mm');
  report.tests.kitchen = {units:kitchenUnits, splashback:await text('tiling-splashback-result')};

  await gotoStep('Tiles');
  assert.equal(await text('tiling-area-splashback'), '1.80m²');
  const kitchenPlacement = await choosePlacement();
  assertPlacement(kitchenPlacement, 'Kitchen 1920px');
  assert(kitchenPlacement.every(item => item.rightGap > item.slotWidth / 2), `button is not out at the right edge: ${JSON.stringify(kitchenPlacement)}`);
  await screenshot('kitchen-tiles-1920');
  // Pick a tile through the button, then confirm the order line uses the same area.
  await page.$eval(selector('tiling-choose-splashback'), button => button.click());
  await page.waitForSelector(selector('tiling-tile-picker'));
  const tilesOffered = await page.$$eval(selector('tiling-tile-select'), buttons => buttons.length);
  if (tilesOffered) {
    await page.$eval(selector('tiling-tile-select'), button => button.click());
    await page.waitForSelector(selector('tiling-slot-splashback'));
    const order = await page.$eval(`${selector('tiling-slot-splashback')} .tl-calc`, element => element.innerText.replace(/\s+/g, ' '));
    assert.match(order, /1\.80m² \+ 10% wastage = 1\.98m²/, `order area from the mm dimensions: ${order}`);
    assert.equal(await page.$eval(selector('tiling-choose-splashback'), button => button.innerText), 'CHANGE SPLASHBACK TILE');
    report.tests.kitchenOrder = order;
  } else {
    await page.$eval(`${selector('tiling-tile-picker')} .tl-secondary`, button => button.click());
    report.tests.kitchenOrder = 'no tiles in the Product Library to pick';
  }
  await gotoStep('Review');
  const review = await text('tiling-review');
  assert.match(review, /3500 mm × 4200 mm = 14\.70m²/, `review shows mm: ${review.slice(0, 200)}`);

  // MAIN BATHROOM - standard tiling, shower + feature wall 2400 x 2400 mm = 5.76 m2 (TEST 3)
  await openRoom('Main Bathroom');
  await page.$eval(selector('tiling-spec-standard'), button => button.click());
  await enter('tiling-width', 2800);
  await enter('tiling-length', 3600);
  await enter('tiling-ceiling', 2400);
  assert.equal(await text('tiling-floor-result'), '10.08m²');
  await gotoStep('Shower, bath');
  for (const key of ['shower', 'bath', 'vanity', 'feature']) await page.$eval(selector(`tiling-component-${key}`), input => input.click());
  await enter('tiling-shower-width', 900);
  await enter('tiling-shower-length', 900);
  await enter('tiling-bath-length-0', 1700);
  await enter('tiling-vanity-width', 900);
  await enter('tiling-feature-width-0', 2400);
  await enter('tiling-feature-height-0', 2400);
  const bathroomUnits = await fieldUnits();
  assert(bathroomUnits.filter(field => !/area/i.test(field.label)).every(field => field.unit === 'mm'), `Bathroom component fields are mm: ${JSON.stringify(bathroomUnits)}`);
  assert.match(await text('tiling-feature-result'), /2400mm × 2400mm = 5\.76m²/, 'TEST 3');
  assert.match(await text('tiling-bath-result'), /1700mm × 600mm = 1\.02m²/);
  await screenshot('bathroom-components-mm');
  await gotoStep('Tiles');
  assert.equal(await text('tiling-area-floor'), '10.08m²');
  assert.equal(await text('tiling-area-feature'), '5.76m²');
  const wide = await choosePlacement();
  assertPlacement(wide, 'Bathroom 1920px');
  await screenshot('bathroom-tiles-1920');
  await page.setViewport({width:1280, height:900});
  await delay(300);
  assertPlacement(await choosePlacement(), 'Bathroom 1280px');
  await page.setViewport({width:820, height:1100});
  await delay(300);
  const tablet = await choosePlacement();
  assertPlacement(tablet, 'Bathroom 820px');
  await screenshot('bathroom-tiles-820');
  await page.setViewport({width:1920, height:1080});
  report.tests.bathroom = {units:bathroomUnits, placement:{wide, tablet}};

  // No metre unit left on any dimension input, and nothing under 16px.
  const smallText = await page.$$eval('.tl-shell *', elements => elements.filter(element => element.children.length === 0 && element.innerText?.trim() && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.innerText.slice(0, 30)));
  assert.deepEqual(smallText, [], 'no text under 16px');

  // Saved job: rooms are stored in millimetres, and the Quotation Builder gets the m2 quantities.
  await page.$eval(selector('tiling-room-save'), button => button.click());
  let saved;
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await page.evaluate(async key => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try { return await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
    }, `job:${projectId}`);
    if (saved?.workbook?.quotation?.['TILING - MAIN BATHROOM']) break;
  }
  const savedRooms = (saved.workbook.clientSelectionsBook.rooms || []).flatMap(room => room.rows || []).find(row => row.guidedSelection?.tilingRooms)?.guidedSelection.tilingRooms || [];
  const savedBathroom = savedRooms.find(room => room.name === 'Main Bathroom');
  assert.equal(savedBathroom.dimensionUnit, 'mm');
  assert.deepEqual([Number(savedBathroom.geometry.widthMm), Number(savedBathroom.geometry.lengthMm), Number(savedBathroom.geometry.ceilingHeightMm)], [2800, 3600, 2400]);
  assert(!JSON.stringify(savedRooms).match(/"(widthM|lengthM|heightM|ceilingHeightM|perimeterLm|lengthsLm)"/), 'no metre fields saved');
  const quoteRows = saved.workbook.quotation['TILING - MAIN BATHROOM'].rows;
  const quantity = (prefix) => Number(quoteRows.find(row => row.item.startsWith(prefix))?.qty);
  assert.equal(quantity('Floor tiles'), 11.09, 'floor: 10.08 m² + 10%');
  assert.equal(quantity('Feature wall tiles'), 6.34, 'feature: 5.76 m² + 10%');
  assert.equal(quantity('Labour - floor tiling'), 10.08);
  const kitchenRows = saved.workbook.quotation['TILING - KITCHEN'].rows;
  assert.equal(Number(kitchenRows.find(row => row.item.startsWith('Splashback')).qty), 1.98, 'kitchen splashback: 1.80 m² + 10%');
  report.tests.saved = {bathroomGeometry:savedBathroom.geometry, quotation:quoteRows.map(row => `${row.item} | ${row.qty} ${row.unit}`), kitchen:kitchenRows.map(row => `${row.item} | ${row.qty} ${row.unit}`)};

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
