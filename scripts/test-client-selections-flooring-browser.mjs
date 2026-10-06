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
const out = path.join(root, 'artifacts/test-artifacts/client-selections-flooring');
fs.mkdirSync(out, {recursive:true});
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'data/product-library/catalogues/flooring/AU-NATIONAL-TILES-FLOORING-CATALOGUE.json'), 'utf8'));
const flooringDir = path.join(root, 'data/product-library/catalogues/flooring');
const allFlooringProducts = fs.readdirSync(flooringDir).filter(name => name.endsWith('-CATALOGUE.json')).flatMap(name => JSON.parse(fs.readFileSync(path.join(flooringDir, name), 'utf8')).products || []).filter(p => p.active !== false);
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
const fixture = path.join(out, 'local-flooring-job.json');
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
const shot = (name) => page.screenshot({path:path.join(out, `${name}.png`), fullPage:true});
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
  page = await browser.newPage();
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
  assert.match(cardLabel, new RegExp(`${allFlooringProducts.length} ranges · ${allFlooringProducts.reduce((n, p) => n + p.variants.filter(v => !v.discontinued).length, 0)} colours available`, "i"), "Flooring card shows live Product Library counts");
  assert.ok(!/no products|not yet imported/i.test(cardLabel));
  await page.$eval('[data-category-key="flooring"]', (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-workflow"]');

  // live type counts from Product Library records
  for (const [type, count] of Object.entries(expectedTypeCounts)) {
    const text = await page.$eval(`[data-testid="flooring-type-count-${type}"]`, (element) => element.innerText);
    assert.match(text, new RegExp(`^${count} range`), `${type} count`);
  }
  // Takeoff floor-finish total offered as an area, marked as imported
  const takeoffArea = await page.$$eval('[data-testid^="flooring-area-"][data-area-name]', (cards) => cards.map((card) => ({name:card.dataset.areaName, m2:card.querySelector('[data-testid="flooring-area-m2"]').value, takeoff:/Imported from Takeoff/.test(card.innerText)})));
  report.steps.initialAreas = takeoffArea;
  assert.deepEqual(takeoffArea.find((area) => /Takeoff/.test(area.name)), {name:'Hybrid floor finish (Takeoff)', m2:'36.5', takeoff:true});

  // non-room selections-book names are never suggested as floor areas
  assert.ok(!takeoffArea.some((area) => /^(Roof|Windows|Electrical|Lighting|Paint)$/.test(area.name)), 'no category names as floor areas');
  // enter m2 for the suggested Kitchen and Living, add the other areas; a duplicate name is refused
  for (const [name, m2] of [['Kitchen', 14.2], ['Living', 31.6]]) {
    const field = await page.$(`[data-area-name="${name}"] [data-testid="flooring-area-m2"]`);
    assert.ok(field, `suggested ${name} area`);
    await field.click({clickCount:3}); await field.type(String(m2));
  }
  for (const [name, m2] of [['Entry', 8.4], ['Hallway', 9.6], ['Dining', 16.8], ['Study', 10]]) {
    await page.type('[data-testid="flooring-add-name"]', name);
    await page.type('[data-testid="flooring-add-m2"]', String(m2));
    await clickTestId('flooring-add-area');
  }
  await page.type('[data-testid="flooring-add-name"]', 'kitchen');
  await clickTestId('flooring-add-area');
  assert.match(await page.$eval('[data-testid="flooring-add-error"]', (element) => element.innerText), /already listed/, 'duplicate area refused');
  await page.$eval('[data-testid="flooring-add-name"]', (element) => { element.value = ''; element.dispatchEvent(new Event('input', {bubbles:true})); });
  await shot('01-areas');

  // browse Hybrid, choose Camino Atlas, apply to five areas (not Study, not the Takeoff total)
  await clickTestId('flooring-type-hybrid');
  await page.waitForSelector('[data-testid="flooring-browser"]');
  const cards = await page.$$eval('[data-testid^="flooring-product-"]', (items) => items.length);
  assert.equal(cards, expectedTypeCounts.hybrid, 'all hybrid ranges listed');
  const caminoCode = catalogue.products.find((product) => product.range === 'Camino').product_code;
  await page.$eval(`[data-testid="flooring-product-${caminoCode}"] [data-testid="flooring-swatch-NT25-3418HB"]`, (element) => element.click());
  await delay(200);
  assert.equal(await page.$eval(`[data-testid="flooring-product-${caminoCode}"] [data-testid="flooring-card-colour"]`, (element) => element.innerText), 'Atlas', 'swatch switches the colour');
  const cardImage = await page.$eval(`[data-testid="flooring-product-${caminoCode}"] img.fl-card-image`, (element) => element.getAttribute('src'));
  assert.equal(cardImage, variantBySku.get('NT25-3418HB').variant.imageUrl, 'card shows that colour\'s own image');
  await shot('02-hybrid-browser');
  await page.$eval(`[data-testid="flooring-product-${caminoCode}"] [data-testid="flooring-select"]`, (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-apply-panel"]');
  assert.equal(await page.$$eval('.fl-apply-item input:checked', (inputs) => inputs.length), 0, 'nothing pre-ticked');
  for (const name of ['Entry', 'Hallway', 'Kitchen', 'Living', 'Dining']) await page.$eval(`[data-testid="flooring-apply-${name}"]`, (element) => element.click());
  await clickTestId('flooring-apply-confirm');
  await page.waitForSelector('[data-testid="flooring-workflow"]');

  // change ONLY the Study: laminate Chalet first colour
  const studyId = await page.$eval('[data-area-name="Study"]', (element) => element.dataset.testid.replace('flooring-area-', ''));
  await page.$eval('[data-area-name="Study"] [data-testid="flooring-area-choose"]', (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-browser"]');
  await page.evaluate(() => [...document.querySelectorAll('.fl-tabs button')].find((button) => /^Laminate/.test(button.innerText))?.click());
  await delay(300);
  const chalet = catalogue.products.find((product) => product.range === 'Chalet');
  await page.$eval(`[data-testid="flooring-product-${chalet.product_code}"] [data-testid="flooring-select"]`, (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-apply-panel"]');
  const preselected = await page.$$eval('.fl-apply-item input:checked', (inputs) => inputs.length);
  assert.equal(preselected, 1, 'changing one area preselects only that area');
  await clickTestId('flooring-apply-confirm');
  await page.waitForSelector('[data-testid="flooring-order-summary"]');
  await shot('03-order-summary');

  // whole packs on the summed area
  const atlas = variantBySku.get('NT25-3418HB').variant;
  const net = 8.4 + 9.6 + 14.2 + 31.6 + 16.8;
  const required = Math.round(net * 1.1 * 100) / 100;
  const packs = Math.ceil(net * 1.1 / atlas.packCoverageM2 - 1e-9);
  const line = await page.$eval('[data-testid="flooring-line-NT25-3418HB"]', (element) => ({net:element.querySelector('[data-testid="flooring-line-net"]').innerText, required:element.querySelector('[data-testid="flooring-line-required"]').innerText, packs:element.querySelector('[data-testid="flooring-line-packs"]').innerText, purchased:element.querySelector('[data-testid="flooring-line-purchased"]').innerText, cost:element.querySelector('[data-testid="flooring-line-cost"]').innerText, variation:element.querySelector('[data-testid="flooring-line-variation"]').innerText, text:element.innerText}));
  report.steps.atlasLine = line;
  assert.equal(line.net, `${net.toFixed(2)}m²`);
  assert.equal(line.required, `${required.toFixed(2)}m²`);
  assert.equal(line.packs, String(packs));
  assert.equal(line.purchased, `${(packs * atlas.packCoverageM2).toFixed(2)}m²`);
  for (const room of ['Entry 8.40m²', 'Hallway 9.60m²', 'Kitchen 14.20m²', 'Living 31.60m²', 'Dining 16.80m²']) assert.ok(line.text.includes(room), `location ${room}`);
  // builder material allowance $45/m2 ex GST replaces the (all-in) estimate rate for the comparison
  await page.type('[data-testid="flooring-allowance-hybrid"]', '45');
  await delay(300);
  const variation = await page.$eval('[data-testid="flooring-line-NT25-3418HB"] [data-testid="flooring-line-variation"]', (element) => element.innerText);
  const cost = Math.round(packs * atlas.regularPricePerPack * 100) / 100;
  const expectedVariation = Math.round((cost - Math.round(45 * 1.1 * 100) / 100 * net) * 100) / 100;
  report.steps.variation = {variation, cost, expectedVariation};
  assert.equal(Number(variation.replace(/[^0-9.-]/g, '')), expectedVariation, 'variation = whole-pack cost - net area x allowance');
  assert.ok(!/Study/.test(line.text), 'Study changed independently');
  const studyLine = await page.$eval(`[data-testid="flooring-line-${chalet.variants[0].sku}"]`, (element) => element.innerText);
  assert.match(studyLine, /Study 10\.00m²/);

  // save -> quotation + procurement in the saved job
  await clickTestId('flooring-save');
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-testid="flooring-save"]')?.innerText || ''), {timeout:60000});
  let saved = null;
  for (let attempt = 0; attempt < 30 && !(saved?.flooringRows?.length); attempt++) { await delay(500); saved = await storedJob(); }
  report.steps.saved = saved;
  assert.equal(saved.flooringRows.length, 2, 'one quotation row per selected colour');
  const atlasRow = saved.flooringRows.find((row) => row.sku === 'NT25-3418HB');
  assert.match(atlasRow.section, /^HYBRID FLOORING/, 'row placed in the existing Hybrid Flooring section');
  assert.match(saved.flooringRows.find((row) => row.sku === chalet.variants[0].sku).section, /^LAMINATED FLOORING/);
  assert.equal(atlasRow.flooringOrder.packs, packs);
  assert.equal(atlasRow.qty, atlasRow.flooringOrder.purchasedAreaM2, 'quoted on purchased whole-pack coverage');
  assert.equal(atlasRow.supplier, 'National Tiles');
  assert.match(atlasRow.description, /Locations: .*Entry 8\.40m².*Net 80\.60m², wastage 10%, required 88\.66m², \d+ packs x [\d.]+m² = [\d.]+m² purchased/);
  assert.ok(saved.allowanceRows.some((row) => /Hybrid Standard/.test(row.item)), 'original estimate allowance row kept');
  assert.equal(atlasRow.allowancePerUnit, 45, 'quotation row carries the builder material allowance');
  assert.equal(atlasRow.allowanceTotal, Math.round(45 * net * 100) / 100);
  const atlasItem = saved.procurement.find((item) => item.sku === 'NT25-3418HB');
  assert.deepEqual([atlasItem.qty, atlasItem.unit, atlasItem.packs], [packs, 'PACK', packs], 'procurement orders whole packs');
  assert.equal(saved.flooringSelection.flooringAreas.filter((area) => area.variantId).length, 6, 'each area saved separately');

  // change a selection: Study -> Atlas as well; the rows update, never duplicate
  await page.$eval('[data-area-name="Study"] [data-testid="flooring-area-choose"]', (element) => element.click());
  await page.waitForSelector('[data-testid="flooring-browser"]');
  await page.evaluate(() => [...document.querySelectorAll('.fl-tabs button')].find((button) => /^Hybrid/.test(button.innerText))?.click());
  await delay(300);
  await page.$eval(`[data-testid="flooring-product-${caminoCode}"] [data-testid="flooring-swatch-NT25-3418HB"]`, (element) => element.click());
  await page.$eval(`[data-testid="flooring-product-${caminoCode}"] [data-testid="flooring-select"]`, (element) => element.click());
  await clickTestId('flooring-apply-confirm');
  await clickTestId('flooring-save');
  let resaved = null;
  for (let attempt = 0; attempt < 30; attempt++) { await delay(500); resaved = await storedJob(); if (resaved.flooringRows.length === 1) break; }
  report.steps.resaved = resaved;
  assert.equal(resaved.flooringRows.length, 1, 'changing the Study updates the rows instead of duplicating');
  assert.equal(resaved.flooringRows[0].flooringOrder.netAreaM2, Math.round((net + 10) * 100) / 100);
  assert.equal(resaved.procurement.length, 1);
  assert.equal(resaved.flooringRows[0].id, atlasRow.id, 'stable row identity');
  await shot('04-after-change');

  assert.deepEqual(report.failedImages, [], 'no failed flooring images');
  assert.deepEqual(report.runtimeErrors, [], 'no runtime errors');
  report.passed = true;
  console.log(`Client Selections flooring passed: live counts ${JSON.stringify(expectedTypeCounts)}, apply to 5 areas + independent Study, ${packs} whole packs, quotation rows in existing sections, procurement in packs, change updates without duplicates.`);
} catch (error) {
  report.error = error.stack || String(error);
  if (page) await page.screenshot({path:path.join(out, 'failure.png'), fullPage:true}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
