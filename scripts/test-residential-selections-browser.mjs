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
const out = path.join(root, 'artifacts/test-artifacts/residential-selections-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-residential-selections-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local plumbing allocation regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PLUMBING', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-plumbing-job.json');
workbook.quotation = { ELECTRICAL: { rows: [{ id: 'res-gpo', item: 'DOUBLE POWER POINT', qty: 2, unit: 'EACH', excelRate: 90, manualRate: '', materialRate: 20, labourRate: 70 }, { id: 'res-downlights', item: 'DOWNLIGHTS', qty: 24, unit: 'EACH', excelRate: 80, manualRate: '', materialRate: 10, labourRate: 70 }] }, PAINTING: { rows: [{ id: 'res-walls', item: 'Internal wall painting', qty: 100, unit: 'M2', excelRate: 25, materialRate: 5, labourRate: 20 }, { id: 'res-ceilings', item: 'Ceiling painting', qty: 80, unit: 'M2', excelRate: 20 }] } };
workbook.aiPlanTakeoffJob = { aiAnalysis: { rooms: [{ name: 'Master Bedroom', confidence: 1 }, { name: 'Bedroom 2', confidence: 1 }, { name: 'Living', confidence: 1 }] } };
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
    await page.$$eval(`${selector(`plumbing-allocation-row-${key}`)} button`, (buttons,increase) => buttons[increase ? 1 : 0].click(), current < quantity);
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
    const records = [];
    for (const {name} of await indexedDB.databases()) {
      if (!name.includes('estimate-builder-template-db')) continue;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        if (!db.objectStoreNames.contains('jobs')) continue;
        const record = await new Promise((resolve, reject) => {
          const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        if (record) records.push(record);
      } finally { db.close(); }
    }
    return records.sort((a,b) => String(b.savedAt || b.workbook?.savedAt).localeCompare(String(a.savedAt || a.workbook?.savedAt)))[0];
  }, `job:${projectId}`);
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.stack || error.message));
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


  // Electrical is a room-by-room quantity schedule with no products: test-client-selections-electrical-browser.mjs.
  await openHomeCategory('lighting-fans', 'guided-category-lighting-fans');
  report.tests.lightingCards = await page.$$eval('article[data-requirement-key]', cards => cards.map(c => c.innerText));
  assert(!report.tests.lightingCards.some(t => /No verified products|No products have been added/.test(t)));
  await page.$eval('[data-testid="guided-requirement-ceiling-fan"] button.primary', b => b.click());
  await page.waitForSelector('article.plumbingProductCard');
  report.tests.fans = (await productCards()).length;
  assert(report.tests.fans > 50);
  const dc = '[data-testid="plumbing-facet-current"] select';
  await page.select(dc,'DC');
  assert((await productCards()).length > 0 && (await productCards()).length < report.tests.fans);
  await screenshot('fans-dc-filter');
  await openSide('interior');
  await page.$eval('[data-category-key="paint-wall-finishes"]', b => b.click());
  await page.waitForSelector('[data-testid="paint-scheme-workflow"]');
  assert(!(await page.$eval('.paintScheme', e=>e.innerText)).includes('No products have been added'));
  const choose = async (surface, productPattern, colour) => {
    await page.$$eval('.paintSummary button', (buttons,label) => buttons.find(b=>b.querySelector('strong').textContent.replace(' *','')===label).click(), surface);
    const selects = await page.$$('.paintFields select');
    const value = await selects[1].evaluate((e,pattern) => [...e.options].find(o=>new RegExp(pattern,'i').test(o.text))?.value,productPattern);
    assert(value, `paint product for ${surface}`);
    await selects[1].select(value);
    const input = await page.$('.paintFields input');
    await input.click({clickCount:3}); await input.type(colour);
    await page.waitForFunction(name=>[...document.querySelectorAll('.paintColours button')].some(b=>b.innerText.includes(name)),{},colour);
    await page.$$eval('.paintColours button',(buttons,name)=>buttons.find(b=>b.innerText.includes(name)).click(),colour);
    await clickText('Apply as house default','.paintScheme');
    await delay(800);
  };
  await choose('Walls','Wash&Wear.*Low Sheen','Natural White');
  await choose('Ceilings','Ceiling White Range','Vivid White');
  await choose('Skirting','Aquanamel.*Semi Gloss','Vivid White');
  await choose('Internal doors','Aquanamel.*Semi Gloss','Vivid White');
  await clickText('Confirm paint scheme','.paintScheme');
  await page.waitForFunction(() => document.querySelector('.paintScheme')?.innerText.includes('Paint scheme confirmed'), {timeout:90000});
  const saveDeadline = Date.now() + 90000;
  let confirmedRecord;
  while (Date.now() < saveDeadline) {
    confirmedRecord = await savedLocalRecord();
    if (confirmedRecord?.workbook?.clientSelectionsBook?.rooms?.flatMap(r=>r.rows||[]).some(r=>r.guidedSelection?.paintScheme?.confirmed)) break;
    await delay(300);
  }
  report.tests.storedRecordFound = Boolean(confirmedRecord);
  report.tests.storedRecordKey = confirmedRecord?.key;
  assert(confirmedRecord?.workbook?.clientSelectionsBook?.rooms?.flatMap(r=>r.rows||[]).some(r=>r.guidedSelection?.paintScheme?.confirmed), 'Confirmation finished saving before reload');
  await screenshot('paint-confirmed');
  assert((await page.$eval('.paintScheme', e=>e.innerText)).includes('Paint scheme confirmed'));
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="guided-interior-categories"]',{timeout:90000});
  await page.$eval('[data-category-key="paint-wall-finishes"]',b=>b.click());
  await page.waitForSelector('[data-testid="paint-scheme-workflow"]',{timeout:90000});
  assert((await page.$eval('.paintScheme', e=>e.innerText)).includes('Natural White'));
  report.tests.reload = true;
  const record = await savedLocalRecord();
  const storedBook = record?.workbook?.clientSelectionsBook;
  const storedPaint = storedBook?.rooms?.flatMap(r=>r.rows||[]).find(r=>r.guidedSelection?.paintScheme)?.guidedSelection.paintScheme;
  assert(storedPaint?.confirmed, 'Confirmed paint scheme persisted');
  const storedElectrical = record.workbook.quotation.ELECTRICAL.rows.find(r=>r.id==='res-gpo');
  assert.equal(storedElectrical.labourRate,70,'Electrical labour preserved through actual save');
  assert.equal(storedElectrical.selectedProducts?.[0]?.quantity,2,'Quotation selection metadata persisted');
  assert(record.workbook.procurement.items.some(i=>i.source==='client-paint-scheme'),'Paint procurement persisted');
  assert(record.workbook.procurement.items.some(i=>i.source==='client-selections-allocated-product'),'Electrical procurement persisted');
  report.tests.downstreamPersistence=true;
  report.passed = !report.runtimeErrors.length;
  assert(report.passed,report.runtimeErrors.join('\n'));
} catch(error) {
  report.error=error.stack;
  if(page) await screenshot('failure').catch(()=>{});
  process.exitCode=1;
} finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,tests:report.tests,error:report.error,runtimeErrors:report.runtimeErrors},null,2));
  await browser.close();
}
