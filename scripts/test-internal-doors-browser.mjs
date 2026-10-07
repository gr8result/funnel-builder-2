import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Internal Doors in the running app: the hub card image, Flush Panel first on page 1 with no
// supplier step, suppliers as a filter, search, and every other door type still available. Uses an isolated local job; cloud
// writes are blocked, existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-internal-doors-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/internal-doors-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-internal-doors-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local internal doors regression';
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
  const PICKER = selector('internal-catalogue-picker');
  const cards = () => page.$$eval(`${PICKER} [data-testid="internal-product-card"]`, items => items.map(item => ({type:item.dataset.doorType, brand:item.dataset.brand, name:item.querySelector('h3').innerText.trim(), text:item.innerText.replace(/\s+/g, ' ')})));
  const heading = () => text('internal-door-heading');
  const pageLabel = () => text('internal-page-label');
  const typeButtons = () => page.$$eval(`${selector('internal-door-types')} button`, buttons => buttons.map(button => ({label:button.innerText.trim(), active:button.getAttribute('aria-pressed') === 'true'})));
  const setSearch = async (value) => { await page.click(selector('internal-door-search'), {clickCount:3}); await page.keyboard.press('Backspace'); if (value) await page.type(selector('internal-door-search'), value); await delay(250); };

  // 1-2. The Internal Doors card shows a complete door in a room.
  await page.$eval(`${selector('tiling-rooms-workflow')} .tl-link`, button => button.click());
  await page.waitForSelector(selector('guided-interior-categories'));
  await page.$eval(`${selector('guided-interior-categories')} [data-category-key="internal-doors"]`, element => element.click());
  await page.waitForSelector(selector('guided-category-internal-doors'));
  const cardSel = `${selector('guided-requirement-internal-doors')} img`;
  await page.waitForFunction(sel => document.querySelector(sel)?.complete, {}, cardSel);
  const image = await page.$eval(cardSel, img => ({src:new URL(img.src).pathname, naturalWidth:img.naturalWidth, naturalHeight:img.naturalHeight, width:Math.round(img.getBoundingClientRect().width), height:Math.round(img.getBoundingClientRect().height)}));
  assert.equal(image.src, '/images/client-selections/internal-doors.webp', 'local optimised asset');
  assert(image.naturalWidth === 1760 && image.naturalHeight === 800, `image loads: ${JSON.stringify(image)}`);
  // The card and the photo have nearly the same shape, so the cover crop keeps the whole door.
  const cropped = 1 - Math.min(image.width / image.height, 2.2) / Math.max(image.width / image.height, 2.2);
  assert(cropped < 0.25, `the card crops little of the photo: ${JSON.stringify(image)}`);
  await page.$eval(selector('guided-requirement-internal-doors'), element => element.scrollIntoView({block:'center'}));
  await screenshot('internal-doors-card');

  // 3-5. View Internal Doors: Flush Panel is the first thing shown, on page 1, with no supplier step.
  await page.$eval(`${selector('guided-requirement-internal-doors')} button.primary`, button => button.click());
  await page.waitForSelector(`${PICKER} [data-testid="internal-product-card"]`);
  assert.equal(await page.$(selector('internal-door-manufacturer-hume')), null, 'no "choose a manufacturer" step');
  const types = await typeButtons();
  assert.equal(types[0].label.replace(/\s*\(\d+\)$/, ''), 'Flush Panel · Standard', `Flush Panel is the first type: ${JSON.stringify(types)}`);
  assert.equal(types[0].active, true, 'and it is selected by default');
  assert.deepEqual(types.map(type => type.label.replace(/\s*·.*$|\s*\(\d+\)$/g, '').replace(/\s*\(\d+\)$/, '')), ['Flush Panel', 'Moulded Panel', 'Routed / Feature', 'Glass / Glazed', 'Barn / Sliding', 'Other Internal Doors', 'All doors']);
  assert.match(await heading(), /Flush Panel doors — standard \/ most common \(7 products, all suppliers\)/i);
  assert.equal(await pageLabel(), 'Page 1 of 1');
  let shown = await cards();
  assert.equal(shown.length, 7);
  assert(shown.every(card => card.type === 'flush' && /Flush/.test(card.name) && /Flush Panel · Standard/.test(card.text)), `only flush doors: ${shown.map(card => card.name)}`);
  assert.match(shown[0].text, /Hollow core/, 'the standard hollow core flush door is first');
  assert(shown.every(card => /From \$\d/.test(card.text)), 'each door shows its from-price');
  await screenshot('internal-doors-flush-first');
  report.tests.flush = {types:types.map(type => type.label), doors:shown.map(card => `${card.brand} ${card.name}`)};

  // 6-7. Suppliers together within a type; supplier is a filter.
  await page.$eval(selector('internal-door-type-moulded'), button => button.click());
  await delay(250);
  shown = await cards();
  assert.deepEqual([...new Set(shown.map(card => card.brand))].sort(), ['Corinthian Doors', 'Hume Doors'], 'both suppliers listed together under Moulded Panel');
  await page.$eval(selector('internal-door-supplier-hume-doors'), input => input.click());
  await delay(250);
  shown = await cards();
  assert(shown.length > 0 && shown.every(card => card.brand === 'Hume Doors' && card.type === 'moulded'), 'supplier filter works');
  const withHumeOnly = await typeButtons();
  assert(!withHumeOnly.some(type => type.label.startsWith('Flush Panel')), 'Hume has no flush doors in the library, so the type is not offered for Hume alone');
  await page.$eval(selector('internal-door-supplier-hume-doors'), input => input.click());
  await delay(250);

  // 8. Search in builders' words.
  const searches = {};
  for (const term of ['flush', 'flush panel', 'flush door', 'internal flush', 'hollow core', 'solid core']) {
    await setSearch(term);
    await page.$eval(selector('internal-door-type-all'), button => button.click());
    await delay(250);
    shown = await cards();
    searches[term] = `${await heading()} | first: ${shown[0]?.name}`;
    if (term.includes('flush')) assert(shown.length === 7 && shown.every(card => card.type === 'flush'), `"${term}" finds the flush doors: ${searches[term]}`);
    else assert(shown.length > 0 && shown.every(card => new RegExp(term, 'i').test(card.text)) && shown[0].type === 'flush', `"${term}": ${searches[term]}`);
  }
  await setSearch('');
  report.tests.searches = searches;

  // 9. Decorative and glazed doors are all still there; filter first, then paginate.
  await page.$eval(selector('internal-door-type-all'), button => button.click());
  await delay(250);
  assert.match(await heading(), /All internal doors \(586 products/);
  assert.equal(await pageLabel(), 'Page 1 of 25');
  shown = await cards();
  assert(shown.slice(0, 7).every(card => card.type === 'flush'), 'even in All doors, the flush doors lead page 1');
  await page.$eval(selector('internal-door-type-routed'), button => button.click());
  await delay(250);
  assert.match(await heading(), /Routed \/ Feature doors \(175 products/);
  assert.equal(await pageLabel(), 'Page 1 of 8');
  await page.$eval(selector('internal-page-next'), button => button.click());
  await delay(250);
  assert.equal(await pageLabel(), 'Page 2 of 8');
  assert((await cards()).every(card => card.type === 'routed'));
  await page.$eval(selector('internal-door-type-glazed'), button => button.click());
  await delay(250);
  assert.equal(await pageLabel(), 'Page 1 of 16', 'changing type returns to page 1');

  // 10. Selecting a door still works and the selection is kept.
  await page.$eval(selector('internal-door-type-flush'), button => button.click());
  await delay(250);
  await page.$eval(`${PICKER} [data-testid="select-internal-product"]`, button => button.click());
  await page.waitForSelector(selector('internal-product-options'));
  await page.evaluate((sel) => [...document.querySelectorAll(`${sel} button`)].find(button => button.innerText.trim() === 'Confirm Selection').click(), selector('internal-product-options'));
  let saved;
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await page.evaluate(async key => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try { return await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
    }, `job:${projectId}`);
    if (JSON.stringify(saved?.workbook?.clientSelectionsBook || {}).includes('Flush Interior')) break;
  }
  const doorRow = (saved.workbook.clientSelectionsBook.rooms || []).flatMap(room => room.rows || []).find(row => row.guidedSelection?.requirementKey === 'internal-doors');
  assert.match(doorRow.guidedSelection.productName, /Flush Interior/, 'the selected flush door is saved on the job');
  assert(doorRow.guidedSelection.productCode.startsWith('INT-CORINTHIAN-DOORS-'), 'as its real Product Library record');
  report.tests.selected = `${doorRow.guidedSelection.brand} ${doorRow.guidedSelection.productName} (${doorRow.guidedSelection.productCode})`;

  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
  console.log(JSON.stringify({passed:true, image, tests:report.tests, blockedCloudWrites:report.blockedCloudWrites.length}, null, 2));
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
