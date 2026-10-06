import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Plumbing Fixtures: product -> room allocations -> quantity -> totals, in the running app.
// Uses an isolated local job; cloud writes are blocked, existing jobs are never touched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/plumbing-allocation-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-plumbing-allocation-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local plumbing allocation regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-plumbing-job.json');
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
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, tests:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-plumbing-fixtures-checklist', 'guided-plumbing-fixture-products'].map(id => `[data-testid="${id}"]`).join(', ');
const money = text => Number(String(text).replace(/[^0-9.-]/g, ''));

async function clickText(text, scope = 'body') {
  await page.waitForFunction((text, scope) => [...document.querySelectorAll(`${scope} button`)]
    .some(button => !button.disabled && button.innerText.trim() === text), {}, text, scope);
  await page.evaluate((text, scope) => {
    const button = [...document.querySelectorAll(`${scope} button`)].find(button => !button.disabled && button.innerText.trim() === text);
    button.scrollIntoView({block:'center'});
    button.click();
  }, text, scope);
}

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
    for (const label of dialogLabels) {
      // A load dialog can close between listing and clicking; click only if still present.
      await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    }
    // Done only once no load dialog is left and the loaded job is showing Client Selections.
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

// Deterministic in-app navigation back to the Interior / Exterior home: product screen -> category
// hub -> Interior/Exterior page -> home, waiting for each screen before the next step.
async function goHome() {
  const home = selector('guided-client-selections-home');
  const sidePage = '[data-testid="guided-interior-categories"], [data-testid="guided-exterior-categories"]';
  for (let guard = 0; guard < 5; guard++) {
    if (await page.$(home)) return;
    if (await page.$(selector('guided-plumbing-fixture-products'))) {
      await page.$eval('.plumbingProductsHeader > button', button => button.click());
      await page.waitForSelector('.categoryHubBack');
    } else if (await page.$('.categoryHubBack')) {
      await page.$eval('.categoryHubBack', button => button.click());
      await page.waitForSelector(sidePage);
    } else if (await page.$(sidePage)) {
      await clickText('Back');
      await page.waitForSelector(home);
    } else {
      await clickText('Back');
      await delay(800);
    }
  }
  await page.waitForSelector(home);
}

async function openSide(side) {
  await goHome();
  await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
  await page.waitForSelector(selector(`guided-${side}-categories`));
}

async function openHomeCategory(key, hubTestId, side = 'interior') {
  await openSide(side);
  await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${key}"]`, element => element.click());
  await page.waitForSelector(selector(hubTestId || `guided-category-${key}`));
}

async function enterPlumbing() {
  if (await page.$(selector('guided-plumbing-fixtures-checklist'))) return;
  await openHomeCategory('plumbing-fixtures', 'guided-plumbing-fixtures-checklist');
}

async function openCategory(key) {
  if (await page.$(selector('guided-plumbing-fixture-products'))) await page.$eval('.plumbingProductsHeader > button', button => button.click());
  await page.waitForSelector(selector('guided-plumbing-fixtures-checklist'));
  await page.$eval(`${selector(`guided-requirement-${key}`)} button.primary`, button => button.click());
  await page.waitForSelector(selector(`plumbing-allocation-summary-${key}`));
  await page.waitForSelector('article.plumbingProductCard');
}

async function productCards() {
  return page.$$eval('article.plumbingProductCard', cards => cards.map(card => ({testId:card.dataset.testid, name:card.querySelector('strong')?.innerText || '', quantity:Number(card.dataset.selectedQuantity || 0)})));
}

async function openProduct(testId) {
  const scope = `article[data-testid="${testId}"]`;
  const label = await page.$eval(`${scope} .guidedProductActions button.primary`, element => element.innerText.trim());
  await clickText(label, scope);
  await page.waitForSelector(selector('plumbing-allocation-modal'));
}

async function rowQuantity(key) {
  const input = `${selector(`plumbing-allocation-row-${key}`)} input[type="number"]`;
  if (!await page.$(input)) return null;
  return page.$eval(input, element => Number(element.value));
}

async function setQuantity(key, label, quantity) {
  if (await rowQuantity(key) === null) {
    // Not an existing project room: add it as a location (e.g. Butler's Pantry, Ensuite 2).
    await page.$eval('.plumbingAddLocation input', element => element.focus());
    await page.keyboard.type(label);
    await clickText('Add location', selector('plumbing-allocation-modal'));
    await page.waitForSelector(selector(`plumbing-allocation-row-${key}`));
  }
  for (let guard = 0; guard < 20; guard++) {
    const current = await rowQuantity(key);
    if (current === quantity) return;
    const button = current < quantity ? `Increase ${label}` : `Decrease ${label}`;
    await page.$eval(`${selector(`plumbing-allocation-row-${key}`)} button[aria-label="${button}"]`, element => element.click());
    await delay(50);
  }
  throw new Error(`Could not set ${label} to ${quantity}`);
}

async function modalTotals() {
  return page.$eval(selector('plumbing-allocation-totals'), element => Object.fromEntries([...element.querySelectorAll('div')].map(row => [row.querySelector('dt').innerText.trim().toLowerCase(), row.querySelector('dd').innerText.trim()])));
}

async function saveModal() {
  await page.$eval(selector('plumbing-allocation-save'), element => element.click());
  await page.waitForFunction(sel => !document.querySelector(sel), {}, selector('plumbing-allocation-modal'));
  await delay(300);
}

async function categoryQuantity() {
  return page.$eval(selector('plumbing-category-quantity'), element => Number(element.innerText)).catch(() => 0);
}

async function categorySummaryText(key) {
  return page.$eval(selector(`plumbing-allocation-summary-${key}`), element => element.innerText);
}

// Allocate one product; returns what the modal showed + what the category shows afterwards.
async function allocate(key, cardTestId, allocations) {
  await openProduct(cardTestId);
  for (const [roomKey, label, quantity] of allocations) await setQuantity(roomKey, label, quantity);
  const totals = await modalTotals();
  await page.$eval('.plumbingAllocationModal', element => element.scrollIntoView({block:'center'}));
  await screenshot(`modal-${key}-${allocations.length}`);
  await saveModal();
  return totals;
}

function assertLineMaths(totals, quantity, label) {
  assert.equal(Number(totals['total quantity']), quantity, `${label}: total quantity = sum of rooms`);
  const each = money(totals['price each']);
  const allowanceEach = money(totals['unit allowance']);
  if (Number.isFinite(each) && each > 0) {
    assert.equal(money(totals['product total']), Math.round(each * quantity * 100) / 100, `${label}: product total = price x qty`);
    const variation = money(totals.credit ?? totals.variation);
    assert.equal(variation, Math.round((each - allowanceEach) * quantity * 100) / 100, `${label}: variation = (price - allowance) x qty`);
  }
  assert.equal(money(totals['allowance total']), Math.round(allowanceEach * quantity * 100) / 100, `${label}: allowance total = unit allowance x qty`);
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
  await page.goto(report.route, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);

  // STRUCTURE - Client Selections -> Interior | Exterior -> large product / trade category cards
  await goHome();
  const areaCards = await page.$$eval('[data-testid="guided-client-selections-home"] .guidedImageCard', cards => cards.map(card => card.querySelector('.guidedImageCardTitle')?.innerText.trim()));
  assert.deepEqual([...areaCards].sort(), ['Exterior', 'Interior'], 'Home offers Interior and Exterior');
  await screenshot('00-home-interior-exterior');
  const roomLabels = ['Kitchen', 'Bathroom', 'Ensuite', 'Laundry', 'Bedrooms', 'Bedroom', 'Living', 'Garage Interior'];
  const sideCards = {};
  for (const side of ['interior', 'exterior']) {
    await openSide(side);
    sideCards[side] = await page.$$eval(`[data-testid="guided-${side}-categories"] .guidedImageCard`, cards => cards.map(card => ({
      key:card.dataset.categoryKey,
      label:card.querySelector('.guidedImageCardTitle')?.innerText.trim(),
      caption:card.querySelector('.guidedImageCardMeta')?.innerText.replace(/\s+/g, ' ').trim(),
      height:Math.round(card.getBoundingClientRect().height),
      width:Math.round(card.getBoundingClientRect().width),
    })));
    assert(sideCards[side].length >= 10, `${side} shows its category cards`);
    assert(!sideCards[side].some(card => roomLabels.includes(card.label)), `${side}: no room cards`);
    assert(sideCards[side].every(card => card.height >= 280), `${side}: large cards (min height ${Math.min(...sideCards[side].map(card => card.height))}px)`);
    await screenshot(`00-${side}-categories`);
  }
  report.tests.structure = sideCards;

  await enterPlumbing();
  assert.equal(await page.$(selector('guided-requirement-laundry-mixer')), null, 'Laundry Mixer is not a separate requirement');
  const plumbingCounts = await page.$$eval('[data-testid="guided-plumbing-fixtures-checklist"] article[data-requirement-key]', cards => Object.fromEntries(cards.map(card => [card.dataset.requirementKey, card.querySelector('small')?.innerText || ''])));
  report.tests.plumbingRange = plumbingCounts;
  assert(/\d+ products? available/.test(plumbingCounts['bath-spout'] || ''), 'Bath spouts have a verified range');
  await screenshot('00-plumbing-categories');

  // TEST A - one sink, Kitchen x1 + Butler's Pantry x1 = 2
  await openCategory('sink');
  const sinks = await productCards();
  let totals = await allocate('sink', sinks[0].testId, [['kitchen', 'Kitchen', 1], ['butlers-pantry', "Butler's Pantry", 1]]);
  assertLineMaths(totals, 2, 'A sink');
  assert.equal(await categoryQuantity(), 2, 'A: sink category qty 2');
  report.tests.A = {product:sinks[0].name, totals, categoryQuantity:2};
  await screenshot('A-sinks');

  // TEST B - one sink mixer, Kitchen, Butler's Pantry, Laundry = 3
  await openCategory('sink-mixer');
  const mixers = await productCards();
  await openProduct(mixers[0].testId);
  const laundryOffered = await rowQuantity('laundry');
  assert.notEqual(laundryOffered, null, 'B: Laundry is offered for a Sink Mixer');
  await page.$eval('.plumbingAllocationModal footer button', element => element.click());
  totals = await allocate('sink-mixer', mixers[0].testId, [['kitchen', 'Kitchen', 1], ['butlers-pantry', "Butler's Pantry", 1], ['laundry', 'Laundry', 1]]);
  assertLineMaths(totals, 3, 'B sink mixer');
  assert.equal(await categoryQuantity(), 3, 'B: sink mixer qty 3');
  const mixerCard = await page.$eval(`article[data-testid="${mixers[0].testId}"]`, element => element.innerText);
  assert(/SELECTED — QTY 3/.test(mixerCard), 'B: card shows SELECTED — QTY 3');
  report.tests.B = {product:mixers[0].name, totals, card:mixerCard.split('\n').slice(0, 2)};
  await screenshot('B-sink-mixers');

  // TEST C - one basin, Bathroom 1, Ensuite 2, Ensuite 2 1, Powder Room 1 = 5
  const basinRooms = [['main-bathroom', 'Main Bathroom', 1], ['ensuite', 'Ensuite', 2], ['ensuite-2', 'Ensuite 2', 1], ['powder-room', 'Powder Room', 1]];
  await openCategory('bathroom-basin');
  const basins = await productCards();
  assert(basins.length >= 2, 'Need two basins for the multi-product test');
  totals = await allocate('bathroom-basin', basins[0].testId, basinRooms);
  assertLineMaths(totals, 5, 'C basin');
  assert.equal(await categoryQuantity(), 5, 'C: basin qty 5');
  report.tests.C = {product:basins[0].name, totals};

  // TEST D - basin mixer, same allocations = 5
  await openCategory('basin-mixer');
  const basinMixers = await productCards();
  totals = await allocate('basin-mixer', basinMixers[0].testId, basinRooms);
  assertLineMaths(totals, 5, 'D basin mixer');
  assert.equal(await categoryQuantity(), 5, 'D: basin mixer qty 5');
  report.tests.D = {product:basinMixers[0].name, totals};

  // TEST E - Powder Room basin changes to a second product: 4 + 1 = 5
  await openCategory('bathroom-basin');
  await allocate('bathroom-basin', basins[0].testId, [['powder-room', 'Powder Room', 0]]);
  await allocate('bathroom-basin', basins[1].testId, [['powder-room', 'Powder Room', 1]]);
  let cards = await productCards();
  assert.equal(cards.find(card => card.testId === basins[0].testId).quantity, 4, 'E: original basin qty 4');
  assert.equal(cards.find(card => card.testId === basins[1].testId).quantity, 1, 'E: second basin qty 1');
  assert.equal(await categoryQuantity(), 5, 'E: total basins 5');
  report.tests.E = {summary:await categorySummaryText('bathroom-basin')};
  await screenshot('E-two-basins');

  // TEST F - Ensuite basin 2 -> 1 updates everything immediately
  totals = await allocate('bathroom-basin', basins[0].testId, [['ensuite', 'Ensuite', 1]]);
  assertLineMaths(totals, 3, 'F basin edit');
  cards = await productCards();
  assert.equal(cards.find(card => card.testId === basins[0].testId).quantity, 3, 'F: basin qty 3');
  assert.equal(await categoryQuantity(), 4, 'F: total basins 4');
  report.tests.F = {totals, summary:await categorySummaryText('bathroom-basin')};
  await screenshot('F-edited');

  // BATHROOM ACCESSORIES - towel rail allocated to three bathrooms
  await openHomeCategory('bathroom-accessories');
  await page.$eval(`${selector('guided-requirement-towel-rail')} button.primary`, button => button.click());
  await page.waitForSelector(selector('plumbing-allocation-summary-towel-rail'));
  const rails = await productCards();
  assert(rails.length > 0, 'Towel rails come from the Product Library');
  totals = await allocate('towel-rail', rails[0].testId, [['main-bathroom', 'Main Bathroom', 1], ['ensuite', 'Ensuite', 1], ['ensuite-2', 'Ensuite 2', 1]]);
  assertLineMaths(totals, 3, 'Towel rail');
  assert.equal(await categoryQuantity(), 3, 'Towel rail qty 3');
  report.tests.accessories = {product:rails[0].name, totals, available:rails.length};
  await screenshot('accessories');

  // TILES & STONE -> FLOOR WASTES & DRAINS
  await openHomeCategory('tiles-stone');
  const tileSubcategories = await page.$$eval('[data-testid="guided-category-tiles-stone"] article[data-requirement-key]', cards => cards.map(card => card.dataset.requirementKey));
  for (const key of ['floor-tiles', 'wall-tiles', 'feature-tiles', 'external-tiles', 'mosaics', 'floor-waste']) assert(tileSubcategories.includes(key), `Tiles & Stone offers ${key}`);
  await screenshot('tiles-stone-hub');
  await page.$eval(`${selector('guided-requirement-floor-waste')} button.primary`, button => button.click());
  await page.waitForSelector(selector('plumbing-allocation-summary-floor-waste'));
  const facetLabels = await page.$$eval('[data-testid^="plumbing-facet-"] span', spans => spans.map(span => span.innerText.trim()));
  for (const facet of ['TYPE', 'SHAPE']) assert(facetLabels.map(label => label.toUpperCase()).includes(facet), `Floor wastes filter by ${facet}`);
  await screenshot('floor-wastes-products');
  const allWastes = await productCards();
  const setFacet = async (facet, value) => {
    await page.$eval(`${selector(`plumbing-facet-${facet.toLowerCase()}`)} select`, (select, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, value);
      select.dispatchEvent(new Event('change', {bubbles:true}));
    }, value);
    await delay(300);
  };
  await setFacet('Shape', 'Square');
  const squareWastes = await productCards();
  assert(squareWastes.length > 0 && squareWastes.length < allWastes.length, 'Shape filter narrows the range');
  totals = await allocate('floor-waste', squareWastes[0].testId, [['main-bathroom-floor', 'Main Bathroom Floor', 1], ['ensuite-floor', 'Ensuite Floor', 1], ['laundry', 'Laundry', 1]]);
  assertLineMaths(totals, 3, 'Square floor waste');
  await setFacet('Shape', '');
  await setFacet('Type', 'Linear / Strip');
  const linearDrains = await productCards();
  assert(linearDrains.length > 0, 'Linear / strip drains available');
  totals = await allocate('floor-waste', linearDrains[0].testId, [['main-bathroom-shower', 'Main Bathroom Shower', 1], ['ensuite-shower', 'Ensuite Shower', 1]]);
  assertLineMaths(totals, 2, 'Linear drain');
  assert.equal(await categoryQuantity(), 5, 'Floor wastes: 3 + 2 = 5, two different products');
  report.tests.floorWastes = {available:allWastes.length, square:squareWastes[0].name, linear:linearDrains[0].name, facets:facetLabels, summary:await categorySummaryText('floor-waste')};
  await screenshot('floor-wastes-allocated');

  // HOT WATER - verified range present
  await openHomeCategory('hot-water');
  report.tests.hotWater = await page.$eval(selector('guided-requirement-hot-water-system'), element => element.innerText.split('\n').slice(0, 6));
  await screenshot('hot-water-hub');
  await openHomeCategory('plumbing-fixtures', 'guided-plumbing-fixtures-checklist');

  // Category landing + review schedule
  await page.waitForSelector(selector('guided-plumbing-fixtures-checklist'));
  const landing = await page.$eval(selector('guided-plumbing-fixtures-checklist'), element => element.innerText);
  report.landing = landing.slice(0, 1500);
  await screenshot('landing');

  // TEST G - persistence: save, reload, reopen, compare every figure
  const before = {};
  for (const key of ['sink', 'sink-mixer', 'bathroom-basin', 'basin-mixer']) {
    await openCategory(key);
    before[key] = await categorySummaryText(key);
  }
  await enterPlumbing();
  await clickText('Save Progress').catch(() => {});
  let saved;
  for (let attempt = 0; attempt < 40; attempt++) {
    await delay(300);
    saved = await savedLocalRecord();
    if (JSON.stringify(saved?.workbook?.clientSelectionsBook || {}).includes('plumbing-allocation.v1')) break;
  }
  const bookText = JSON.stringify(saved?.workbook?.clientSelectionsBook || {});
  assert(bookText.includes('plumbing-allocation.v1'), 'G: allocations saved to the job');
  // Quotation Builder + Procurement: one line per product in its own category section
  const quotation = saved.workbook.quotation || {};
  const plumbingSection = quotation['PLUMBING FIT OFF - CLIENT SELECTIONS'];
  assert(plumbingSection?.rows?.length, 'Plumbing selections reach the Quotation Builder');
  const mixerRow = plumbingSection.rows.find(row => row.productName === report.tests.B.product);
  assert.equal(Number(mixerRow?.qty), 3, 'Sink mixer quotation qty 3');
  assert(/Laundry ×1/.test(mixerRow?.locations || ''), 'Quotation line keeps the location breakdown');
  const accessorySection = quotation['FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS'];
  assert.equal(Number(accessorySection?.rows?.[0]?.qty), 3, 'Towel rail quotation qty 3 in its own section');
  const floorWasteSection = quotation['PLUMBING - FLOOR WASTES & DRAINS - CLIENT SELECTIONS'];
  assert.equal(floorWasteSection?.rows?.length, 2, 'Floor wastes reach the Quotation Builder as two product lines');
  assert.deepEqual(floorWasteSection.rows.map(row => Number(row.qty)).sort(), [2, 3], 'Floor waste quotation quantities 3 and 2');
  const procurementRows = (saved.workbook.procurement?.items || []).filter(item => item.source === 'client-selections-allocated-product');
  report.tests.quotation = {
    sections:Object.keys(quotation).filter(name => name.endsWith('- CLIENT SELECTIONS')),
    mixer:{qty:mixerRow.qty, unit:mixerRow.unit, rateExGst:mixerRow.excelRate, locations:mixerRow.locations, productId:mixerRow.productId},
    procurementLines:procurementRows.map(item => `${item.itemDescription} x${item.qty} (${item.notes})`),
  };
  const savedFile = path.join(out, 'saved-local-plumbing-job.json');
  fs.writeFileSync(savedFile, JSON.stringify(saved));
  await page.reload({waitUntil:'domcontentloaded'});
  await loadLocalJob(savedFile);
  await enterPlumbing();
  const after = {};
  for (const key of ['sink', 'sink-mixer', 'bathroom-basin', 'basin-mixer']) {
    await openCategory(key);
    after[key] = await categorySummaryText(key);
    assert.equal(after[key], before[key], `G: ${key} identical after reload`);
  }
  report.tests.G = {identicalAfterReload:true, after};
  await screenshot('G-after-reload');

  // Review schedule shows quantity + locations
  await enterPlumbing();
  const reviewButton = await page.$$eval('button', buttons => buttons.some(button => /review schedule/i.test(button.innerText)));
  if (reviewButton) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => /review schedule/i.test(button.innerText)).click());
    await delay(1500);
    const reviewText = await page.evaluate(() => document.body.innerText);
    report.reviewExcerpt = reviewText.split('\n').filter(line => /Qty|×/.test(line)).slice(0, 40);
    await screenshot('review');
  }
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
  console.log(JSON.stringify({passed:true, tests:report.tests, reviewExcerpt:report.reviewExcerpt}, null, 2));
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
