import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Client Selections > Flooring in the running app: Product Library flooring (National Tiles import)
// browsed by type, one colour applied to several areas, one area changed independently, whole packs,
// then the saved job's Quotation Builder rows (existing type sections, updated not duplicated) and
// Supplier & Procurement items (whole packs). Isolated local job; cloud writes are blocked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The workbook defaults import JSON without an import attribute; supply it for this script only.
register('data:text/javascript,' + encodeURIComponent('export async function load(url, context, next) { return next(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context); }'));
const {createEstimateBuilderWorkbookDefaults} = await import('../lib/construction-estimation/estimateBuilderWorkbookDefaults.js');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/client-selections-carpet');
fs.mkdirSync(out, {recursive:true});
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'data/product-library/catalogues/flooring/AU-GODFREY-HIRST-FLOORING-CATALOGUE.json'), 'utf8'));
const variantBySku = new Map(catalogue.products.flatMap((product) => product.variants.map((variant) => [variant.sku, {variant, product}])));
const expectedTypeCounts = Object.fromEntries(['hybrid', 'vinyl', 'laminate', 'engineered-timber'].map((type) => [type, catalogue.products.filter((product) => product.attributes.flooringType === type).length]));

const projectId = `local-flooring-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local flooring regression';
const rows = {...(defaults.data?.inputDataSheet?.rows || {}), floorFinishHybridM2: {...(defaults.data?.inputDataSheet?.rows?.floorFinishHybridM2 || {}), value: '36.5'}};
const workbook = {...defaults, data:{...defaults.data, inputDataSheet:{...(defaults.data?.inputDataSheet || {}), rows}}, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-FLOORING', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-FLOORING', clientName:'Local test client', address:'Local test address'}};
const roomNames=['Master Bedroom','Bedroom 2','Bedroom 3','Bedroom 4','Walk-in Robe'];
workbook.projectRooms=roomNames.map((name,i)=>({name,areaM2:[18.4,12.6,12.4,13.1,6.2][i],flooringType:'carpet'}));
const fixture = path.join(out, 'local-carpet-job.json');
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

const report = {passed:false, projectId, steps:{}, runtimeErrors:[], blockedCloudWrites:[], failedImages:[]};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'flooring-workflow'].map((id) => `[data-testid="${id}"]`).join(', ');
const browser = await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:180000, defaultViewport:{width:1700, height:1100}});
let page;
const shot = (name) => page.screenshot({path:path.join(out, `${name}.png`)});
async function clickTestId(id) { await page.waitForSelector(`[data-testid="${id}"]`); await page.$eval(`[data-testid="${id}"]`, (element) => { element.scrollIntoView({block:'center'}); element.click(); }); await delay(250); }
async function storedJob() {
  return page.evaluate(async (key) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    const wb = record?.workbook || {};
    const quoteRows = Object.entries(wb.quotation || {}).flatMap(([section, value]) => (value.rows || []).map((row) => ({...row, section})));
    return {
      flooringRows: quoteRows.filter((row) => row.source === 'client-selections-flooring').map(({section, id, item, description, qty, unit, excelRate, flooringOrder, allowancePerUnit, allowanceTotal, variation, sku, supplier, colour}) => ({section, id, item, description, qty, unit, excelRate, flooringOrder, allowancePerUnit, allowanceTotal, variation, sku, supplier, colour})),
      allowanceRows: quoteRows.filter((row) => /^(HYBRID|LAMINATED) FLOORING/.test(row.section) && row.source !== 'client-selections-flooring').map((row) => ({section:row.section, item:row.item, excelRate:row.excelRate})),
      procurement: (wb.procurement?.items || []).filter((item) => item.source === 'client-selections-flooring').map(({id, sku, supplier, colour, qty, unit, packs, packCoverageM2, purchasedAreaM2, netAreaM2, requiredAreaM2}) => ({id, sku, supplier, colour, qty, unit, packs, packCoverageM2, purchasedAreaM2, netAreaM2, requiredAreaM2})),
      flooringSelection: (wb.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).find((row) => row?.guidedSelection?.requirementKey === 'interior-flooring')?.guidedSelection || null,
    };
  }, `job:${projectId}`);
}

try {
  page = await browser.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (error) => report.runtimeErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  page.on('response', (response) => { if (response.request().resourceType() === 'image' && response.status() >= 400 && /flooring/.test(response.url())) report.failedImages.push(response.url()); });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites.push(new URL(request.url()).pathname); void request.abort(); }
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:180000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:180000});
  await input.uploadFile(fixture);
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(600);
    const labels = await page.$$eval('button', (buttons) => buttons.filter((button) => !button.disabled).map((button) => button.innerText.trim()));
    const dialogLabels = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter((label) => labels.includes(label));
    for (const label of dialogLabels) await page.evaluate((text) => [...document.querySelectorAll('button')].find((button) => !button.disabled && button.innerText.trim() === text)?.click(), label);
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) break;
  }
  await page.waitForFunction(() => {
    const keepLocal = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Keep Local');
    if (keepLocal) keepLocal.click();
    if (document.querySelector('[data-testid="guided-interior-categories"] [data-category-key="flooring"]')) return true;
    document.querySelector('[data-testid="guided-client-selections-home"] [data-category-key="interior"]')?.click();
    return false;
  }, {timeout:180000, polling:1000});
  const cardLabel = await page.$eval('[data-category-key="flooring"] .guidedImageCardMeta', (element) => element.innerText.replace(/\s+/g, ' '));
  report.steps.cardLabel = cardLabel;
  assert.match(cardLabel, /ranges.*colours available/i);
  assert.ok(!/no products|not yet imported/i.test(cardLabel));
  await page.$eval('[data-category-key="flooring"]', (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-workflow"]');

  await clickTestId('flooring-type-carpet');
  await page.waitForSelector('[data-testid="flooring-browser"]');
  assert.equal(await page.$$eval('[data-testid^="flooring-product-"]', els => els.length), 65);
  for (const [fibre, expected] of Object.entries({ 'Solution Dyed Nylon':22, Triexta:10, Wool:17, DuraTuft:5, Polyester:3, Polypropylene:8 })) {
    await page.select('[data-testid="flooring-filter-fibre"]', fibre);
    assert.equal(await page.$$eval('[data-testid^="flooring-product-"]', els => els.length), expected);
  }
  await page.select('[data-testid="flooring-filter-fibre"]', '');
  await page.select('[data-testid="flooring-filter-collection"]', 'Inspirational');
  assert.equal(await page.$$eval('[data-testid^="flooring-product-"]', els => els.length), 1);
  const inspirational = catalogue.products.find(p => p.range === 'Inspirational');
  const cloudy = inspirational.variants.find(v => v.colour === 'Cloudy Day');
  const glacier = inspirational.variants.find(v => v.colour === 'Glacier');
  const card = `[data-testid="flooring-product-${inspirational.product_code}"]`;
  // Each real Inspirational colour selects its own matching image and code.
  for(const v of inspirational.variants) {
    await page.$eval(`[data-testid="flooring-swatch-${v.sku}"]`, el => el.click());
    assert.equal(await page.$eval(`${card} img.fl-card-image`, el => el.getAttribute('src')), v.imageUrl);
    assert.match(await page.$eval(`${card} [data-testid="flooring-card-colour"]`, el => el.innerText), new RegExp(v.colourCode));
  }
  await clickTestId(`flooring-swatch-${cloudy.sku}`);
  assert.match(await page.$eval(`${card} [data-testid="flooring-card-price"]`, el => el.innerText), /Supplier quote required/);
  await page.$eval(`${card} .fl-secondary`, el => el.click());
  await page.waitForSelector('[data-testid="carpet-specifications"]');
  assert.match(await page.$eval('[data-testid="carpet-specifications"]', el => el.innerText), /3.66m/);
  await shot('01-range-colours');
  await page.$eval(`${card} [data-testid="flooring-select"]`, el => el.click());
  await page.waitForSelector('[data-testid="flooring-apply-panel"]');
  for (const name of roomNames) await clickTestId(`flooring-apply-${name}`);
  assert.match(await page.$eval('[data-testid="flooring-apply-panel"]', el => el.innerText), /62.70m²/);
  await clickTestId('flooring-apply-confirm');
  await page.waitForSelector('[data-testid="carpet-net-area"]');
  assert.equal(await page.$eval('[data-testid="carpet-order-area"]', el => el.value), '');
  // Override one bedroom. All other rooms retain Cloudy Day.
  await page.$eval('[data-area-name="Bedroom 3"] [data-testid="flooring-area-choose"]', el => el.click());
  await page.waitForSelector('[data-testid="flooring-browser"]');
  await page.select('[data-testid="flooring-filter-collection"]', 'Inspirational');
  await clickTestId(`flooring-swatch-${glacier.sku}`);
  await page.$eval(`${card} [data-testid="flooring-select"]`, el => el.click());
  await page.waitForSelector('[data-testid="flooring-apply-panel"]');
  assert.equal(await page.$$eval('.fl-apply-item input:checked', els => els.length), 1);
  await clickTestId('flooring-apply-confirm');
  const orderSelector = `[data-testid="carpet-order-${cloudy.sku}"]`;
  await page.waitForSelector(orderSelector);
  async function fill(selector, value) { const el = await page.$(selector); assert.ok(el, selector); await el.click({clickCount:3}); await el.press('Backspace'); await el.type(String(value)); }
  await fill(`${orderSelector} [data-testid="carpet-order-area"]`, 56);
  for (const [label, value] of [['Material /m²',30],['Underlay /m²',7],['Installation /m²',12],['Other installation costs',50]]) await fill(`${orderSelector} [aria-label="Internal ${label}"]`, value);
  await page.$eval(`${orderSelector} details:last-of-type`, el => el.open = true);
  await fill(`${orderSelector} [aria-label="Carpet retailer"]`, 'Regression retailer');
  await page.$eval(`${orderSelector} [aria-label="Carpet quote date"]`, el => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,'2026-10-03'); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
  for (const [label, value] of [['Material /m²',40],['Underlay /m²',6],['Installation /m²',10],['Other installation costs',20]]) await fill(`${orderSelector} [aria-label="Quoted ${label}"]`, value);
  await page.$eval(`${orderSelector} [data-testid="carpet-record-quote"]`, el => el.click());
  await page.waitForFunction(selector => document.querySelector(`${selector} [data-testid="carpet-variation"]`)?.textContent.includes('417.01'), {}, orderSelector);
  await shot('02-room-order-quote');
  await clickTestId('flooring-save');
  async function fullSaved() { return page.evaluate(async key => { const db=await new Promise((res,rej)=>{const r=indexedDB.open('estimate-builder-template-db');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}); const record=await new Promise((res,rej)=>{const r=db.transaction('jobs').objectStore('jobs').get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();return record?.workbook;}, `job:${projectId}`); }
  let saved;
  for(let i=0;i<30;i++){await delay(500);saved=await fullSaved();if(saved?.procurement?.items?.some(r=>r.variantId===cloudy.variantId))break;}
  const floorRows = wb => Object.values(wb.quotation||{}).flatMap(s=>s.rows||[]).filter(r=>r.source==='client-selections-flooring');
  assert.equal(floorRows(saved).length,2);
  const selected=floorRows(saved).find(r=>r.variantId===cloudy.variantId);
  assert.equal(selected.flooringOrder.netAreaM2,50.3);assert.equal(selected.flooringOrder.estimatedOrderAreaM2,56);
  assert.equal(selected.carpetCosts.selectedCostExGst,3064.8);assert.equal(selected.carpetCosts.variationExGst,379.1);
  assert.equal(selected.locationSchedule.length,4);
  assert.equal(saved.procurement.items.find(r=>r.variantId===cloudy.variantId).qty,56);
  const purchased = saved.procurement.items.find(r=>r.variantId===cloudy.variantId);
  assert.equal(Math.round(purchased.qty*purchased.estimatedRate*100)/100,purchased.estimatedTotal);
  assert.equal(purchased.materialRateExGst,40);
  assert.equal(saved.procurement.items.find(r=>r.variantId===glacier.variantId).qty,null);
  // A quote revision is retained instead of overwriting history, and save does not duplicate rows.
  await page.$eval(`${orderSelector} details:last-of-type`, el => el.open = true);
  await fill(`${orderSelector} [aria-label="Carpet retailer"]`, 'Regression retailer');
  await page.$eval(`${orderSelector} [aria-label="Carpet quote date"]`, el => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,'2026-10-03'); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
  for (const [label, value] of [['Material /m²',41],['Underlay /m²',6],['Installation /m²',10],['Other installation costs',20]]) await fill(`${orderSelector} [aria-label="Quoted ${label}"]`, value);
  await page.$eval(`${orderSelector} [data-testid="carpet-record-quote"]`, el => el.click());
  await page.waitForFunction(selector => document.querySelector(`${selector} [aria-label="Carpet selected quote"]`)?.options.length === 3, {}, orderSelector);
  await clickTestId('flooring-save');
  for(let i=0;i<40;i++){await delay(500);saved=await fullSaved();if(floorRows(saved).find(r=>r.variantId===cloudy.variantId)?.productLibrarySnapshot?.supplierQuoteHistory?.length===2)break;}
  assert.equal(floorRows(saved).length,2);
  assert.equal(floorRows(saved).find(r=>r.variantId===cloudy.variantId).productLibrarySnapshot.supplierQuoteHistory.length,2);
  report.steps.saved={rows:floorRows(saved),procurement:saved.procurement.items.filter(r=>r.source==='client-selections-flooring')};
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="guided-client-selections-home"], [data-testid="flooring-workflow"], [data-testid="guided-interior-categories"]',{timeout:180000});
  if(await page.$('[data-testid="guided-client-selections-home"]'))await page.$eval('[data-testid="guided-client-selections-home"] [data-category-key="interior"]',el=>el.click());
  if(!await page.$('[data-testid="flooring-workflow"]')) {await page.waitForSelector('[data-category-key="flooring"]');await page.$eval('[data-category-key="flooring"]',el=>el.click());}
  await page.waitForSelector(orderSelector);
  assert.equal(await page.$eval(`${orderSelector} [data-testid="carpet-order-area"]`,el=>el.value),'56');
  assert.match(await page.$eval('[data-area-name="Bedroom 3"] [data-testid="flooring-area-choice"]',el=>el.innerText),/Glacier/);
  for(const [key,testId] of [['boq','carpet-project-boq'],['variations','carpet-project-variations'],['procurement','carpet-project-procurement']]) {
    await page.goto(`${origin}/modules/estimate-builder?page=${key}`,{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForSelector(`[data-testid="${testId}"]`,{timeout:180000});
    const text=await page.$eval(`[data-testid="${testId}"]`,el=>el.innerText);assert.match(text,/Cloudy Day/);assert.match(text,/Bedroom 3/);await shot(`03-${key}`);
  }
  await page.goto(`${origin}/modules/estimate-builder?page=productLibrary&catalogueSection=flooring`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForSelector('[data-testid="product-library-flooring-browser"]',{timeout:180000});
  assert.equal(await page.$$eval('[data-testid^="flooring-product-"]',els=>els.length),65);
  await page.select('[data-testid="flooring-filter-collection"]','Inspirational');
  await clickTestId(`flooring-swatch-${cloudy.sku}`);
  assert.match(await page.$eval(`${card} [data-testid="flooring-card-price"]`,el=>el.innerText),/Supplier quote required/);
  await shot('04-product-library');
  assert.deepEqual(report.runtimeErrors,[]);assert.deepEqual(report.failedImages,[]);
  report.passed=true;
  console.log('Carpet browser passed: all fibre filters, 30 colour swatches, measured rooms, multi-room apply/override, quote history, reload, quotation, procurement, BOQ, variations and Product Library.');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) await page.screenshot({path:path.join(out, 'failure.png'), fullPage:true}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
