import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {FINAL_CABINETRY as source} from '../lib/construction-estimation/finalCabinetryQuotation.js';
import {cabinetryCatalogueRow} from '../lib/construction-estimation/cabinetryRequirements.js';
import {normaliseCabinetrySelection} from '../lib/builders/cabinetryWorkflow.js';
import {STONE_BENCHTOP_CATALOGUE} from '../lib/builders/stoneBenchtopWorkflow.js';
import {benchtopPriceGroupKey} from '../lib/builders/benchtopRangeMapping.js';
import {readyCabinetryLocation} from './cabinetry-room-fixture.mjs';

// Client Selections > Cabinetry > Benchtops in the running app. Kitchen: setup first; the main run
// and the island the cabinetry scope shows are listed by the project; client-only questions; the
// quotation range comes from the builder's supplier price group setting (nothing pre-mapped);
// Eclipse on the main bench and a second surface on the island; the Quotation Builder quantity on
// each surface's range; saves that never leave the screen. Ensuite: the vanity benchtop, setup
// first, with vanity-only options. Uses an isolated local job; cloud writes are blocked.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-benchtops-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/benchtop-selection-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-benchtops-${Date.now()}`;
const owner = source.workspaceId;
const defaults = createEstimateBuilderWorkbookDefaults({}, {workspaceId:owner});
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local benchtop selection regression';
// The Kitchen's cabinetry scope includes an Island bench back: the project says there is an island.
const readyKitchen = readyCabinetryLocation('Kitchen');
const kitchen = {...readyKitchen, benchtop:null, benchtops:null, enabledAreaKeys:['lowerDoorsDrawers', 'islandBenchBack'], scope:['lowerDoorsDrawers', 'islandBenchBack'], areaSelections:{...readyKitchen.areaSelections, islandBenchBack:readyKitchen.defaultColour}};
const ensuite = {...readyCabinetryLocation('Ensuite'), bathroomScopeKeys:['wallMountedVanity'], bathroomScope:['wallMountedVanity']};
const line = (id, cabinetTypeId, quantity, width = '', location = 'Kitchen') => ({componentId:`CAB-${location.toLowerCase()}-${id}`, location, cabinetTypeId, quantity, width});
const eclipse = STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.colourName === 'Eclipse');
const signature = STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.priceGroup === 'Signature');
const prestige = STONE_BENCHTOP_CATALOGUE.find(product => product.supplier === 'Stone Ambassador' && product.priceGroup === 'Prestige');
const GROUPS = {eclipse:benchtopPriceGroupKey(eclipse), signature:benchtopPriceGroupKey(signature), prestige:benchtopPriceGroupKey(prestige)};
// 2 x 1200 + 1 x 600 + a 900 sink base + a 600 dishwasher opening = a 4.50 m bench run.
const cabinetrySelection = normaliseCabinetrySelection({locations:[kitchen, ensuite], scheduleApproved:true, confirmed:false,
  schedule:[line(1, 'base_unit_1200_2door', 2), line(2, 'base_unit_600_1door', 1), line(3, 'sink_base', 1, 900), line(4, 'dishwasher_opening', 1, 600), line(5, 'overhead_2door_standard', 3),
    // A vanity line as the bathroom Cabinet Schedule stores it: its own type, with the vanity width.
    {componentId:'CAB-ensuite-bath-wall-three-drawer', location:'Ensuite', type:'bath-wall-three-drawer', unitType:'3-drawer unit', quantity:1, width:1200}]});
const book = {documentType:'luxury_selections_book', rooms:[{id:'room-kitchen', name:'Kitchen', rows:[{id:'row-cabinetry', item:'Cabinetry', guidedRequirementKey:'cabinetry', selectedProduct:'Cabinetry specification',
  guidedSelection:{requirementKey:'cabinetry', requirementLabel:'Cabinetry', cabinetrySelection}}]}]};
const workbook = {...defaults, selectionQuoteEngineVersion:1, workspaceId:owner, templateType:'job', page:'clientSelections', projectId, commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-BENCH', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-BENCH', clientName:'Local test client', address:'Local test address'},
  clientSelectionsBook:book, selectionsBook:book};
const fixture = path.join(out, 'local-benchtop-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));
const importKey = (type, range) => cabinetryCatalogueRow('kitchen', type, range).importKey;
const KEYS = {mid600:importKey('benchtop_600', 'mid_range_stone'), mid900:importKey('benchtop_900', 'mid_range_stone'), high600:importKey('benchtop_600', 'high_end_stone'), high900:importKey('benchtop_900', 'high_end_stone'),
  sink:importKey('benchtop_sink_cutout'), cooktop:importKey('benchtop_cooktop_cutout'), tap:importKey('benchtop_tap_hole'), upstand:importKey('benchtop_upstand'),
  vanityMid:cabinetryCatalogueRow('bathroom', 'benchtop_600', 'mid_range_stone').importKey, vanityBasin:cabinetryCatalogueRow('bathroom', 'benchtop_sink_cutout').importKey, vanityTap:cabinetryCatalogueRow('bathroom', 'benchtop_tap_hole').importKey, vanityUpstand:cabinetryCatalogueRow('bathroom', 'benchtop_upstand').importKey};

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
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId, steps:{}, screenshots:[], documentLoads:0, runtimeErrors:[], blockedCloudWrites:0};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const SUMMARY = selector('guided-kitchen-checklist');
const WORKFLOW = selector('guided-cabinetry-workflow');
const LANDING = selector('cabinetry-room-landing');
const NEXT = selector('cabinetry-bottom-next');
const BENCH = selector('benchtop-selection');
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-kitchen-checklist', 'guided-cabinetry-workflow'].map(selector).join(', ');
const click = sel => page.$eval(sel, element => element.click());
async function screenshot(name) { await page.screenshot({path:path.join(out, `${name}.png`)}); report.screenshots.push(`${name}.png`); }
async function shoot(name, sel) { await (await page.$(sel)).screenshot({path:path.join(out, `${name}.png`)}); report.screenshots.push(`${name}.png`); }

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
async function openBenchtops(room) {
  const inRoom = () => page.evaluate((workflow) => document.querySelector(`${workflow} [data-testid="cabinetry-progress-menu"] h2`)?.innerText.trim() || '', WORKFLOW);
  for (let guard = 0; guard < 14 && await inRoom() !== room; guard++) {
    if (await page.$(LANDING)) await click(selector(`cabinetry-room-${room.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`));
    else if (await inRoom()) await page.$eval(`${WORKFLOW} .cabinetryBanner button`, button => button.click());
    else if (await page.$(SUMMARY)) await page.$eval(`${SUMMARY} ${selector('guided-requirement-cabinetry')}`, card => (card.querySelector('button') || card).click());
    else if (await page.$(selector('guided-client-selections-home'))) await click(`${selector('guided-client-selections-home')} [data-category-key="interior"]`);
    else if (await page.$(selector('guided-interior-categories'))) await click(`${selector('guided-interior-categories')} [data-category-key="cabinetry"]`);
    else await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
    await delay(900);
  }
  assert.equal(await inRoom(), room);
  for (let guard = 0; guard < 6 && !await page.$(`${BENCH}[data-room="${room}"]`); guard++) {
    if (await page.$(selector('cabinetry-apply-colours-modal'))) await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-apply-colours-modal"] button')].find(item => /not now|skip|no/i.test(item.innerText))?.click());
    else await page.evaluate((workflow) => [...document.querySelectorAll(`${workflow} [data-testid="cabinetry-progress-menu"] .guidedProgressItem`)].find(item => /benchtop/i.test(item.innerText))?.click(), WORKFLOW);
    await delay(700);
  }
  await page.waitForSelector(`${BENCH}[data-room="${room}"]`);
}
// Builder setting: set the quotation range of supplier price groups ({ groupKey: rangeKey }).
async function setPriceGroups(ranges) {
  await click(selector('benchtop-range-settings'));
  await page.waitForSelector(selector('benchtop-price-group-settings'));
  const before = await page.$$eval(`${selector('price-group')} ${selector('price-group-range')}`, selects => ({total:selects.length, set:selects.filter(select => select.value).length}));
  for (const [key, range] of Object.entries(ranges)) await page.select(`${selector('price-group')}[data-group-key="${key}"] ${selector('price-group-range')}`, range);
  await click(selector('price-groups-save'));
  await page.waitForSelector(selector('price-groups-message'));
  await click(selector('price-groups-close'));
  await page.waitForFunction(sel => !document.querySelector(sel), {}, selector('benchtop-price-group-settings'));
  return before;
}
const setValue = async (sel, value) => { await page.$eval(sel, input => input.select?.()); await page.focus(sel); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(sel, String(value)); };
const summaries = () => page.$$eval(selector('benchtop-summary'), cards => cards.map(card => ({area:card.dataset.area, product:card.dataset.productName, rangeKey:card.dataset.rangeKey, rangeSource:card.dataset.rangeSource, text:card.innerText.replace(/\s+/g, ' '), asksRange:Boolean(card.querySelector('[data-testid="benchtop-classification-select"]'))})));
const where = () => page.evaluate((workflow, summary, bench) => ({summary:Boolean(document.querySelector(summary)), onBenchtops:Boolean(document.querySelector(bench)), room:document.querySelector(`${workflow} [data-testid="cabinetry-progress-menu"] h2`)?.innerText.trim() || ''}), WORKFLOW, SUMMARY, BENCH);

async function storedJob() {
  return page.evaluate(async (key, keys) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('estimate-builder-template-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record?.workbook) return null;
      const stored = record.workbook.clientSelectionsBook;
      const selection = (stored?.rooms || []).flatMap(room => room.rows || []).find(item => item.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection;
      const location = selection?.locations?.find(item => item.location === 'Kitchen') || null;
      const vanity = selection?.locations?.find(item => item.location === 'Ensuite') || null;
      const rows = record.workbook.quotation?.CABINETRY?.rows || [];
      const quantity = importKey => { const row = rows.find(item => item.importKey === importKey); return !row || row.quantity === '' || row.quantity == null ? null : Number(row.quantity); };
      return {revision:stored?.metadata?.selectionRevision || '', hasCabinetrySection:rows.length > 0, setup:location?.benchtopSetup || null, classifications:selection?.benchtopClassifications || {},
        areas:(location?.benchtopAreas || []).map(area => ({label:area.label, lengthMm:area.lengthMm, depthMm:area.depthMm, product:area.surface?.colourName || '', supplier:area.surface?.supplier || '', collection:area.surface?.collection || '', rangeKey:area.surface?.rangeKey || '', rangeSource:area.surface?.rangeSource || '', supplierPriceGroup:area.surface?.supplierPriceGroup || '',
          supplierConfirmationStatus:area.surface?.supplierConfirmationStatus || '', edge:area.surface?.edgeProfile || '', upstand:area.surface?.upstand || '', cutouts:area.surface?.cutouts || []})),
        vanity:{setup:vanity?.benchtopSetup || null, areas:(vanity?.benchtopAreas || []).map(area => ({id:area.id, label:area.label, lengthMm:area.lengthMm, product:area.surface?.colourName || '', rangeKey:area.surface?.rangeKey || '', supplierPriceGroup:area.surface?.supplierPriceGroup || '', edge:area.surface?.edgeProfile || '', waterfall:area.surface?.waterfallEnds || ''})), record:vanity?.bathroomBenchtops?.wallMountedVanity?.colourName || ''},
        quote:Object.fromEntries(Object.entries(keys).map(([name, importKey]) => [name, quantity(importKey)])),
        benchLm:rows.filter(row => / wide - LM$/.test(row.item || '')).reduce((total, row) => total + (Number(row.quantity) || 0), 0)};
    } finally { db.close(); }
  }, `job:${projectId}`, KEYS);
}
async function storedWhen(predicate) {
  let record;
  for (let attempt = 0; attempt < 250; attempt++) { await delay(300); record = await storedJob(); if (record && predicate(record)) return record; }
  return record;
}

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
  await openBenchtops('Kitchen');
  const loadsAtStart = report.documentLoads;

  // 1 - the page opens on the setup; the product cards are not there yet
  const landing = await page.$eval(BENCH, element => ({text:element.innerText, order:[...element.querySelectorAll(':scope > section')].map(section => section.dataset.testid), locked:element.querySelector('[data-testid="benchtop-chooser"]').dataset.locked,
    cards:element.querySelectorAll('[data-testid="benchtop-product"]').length,
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  assert.deepEqual(landing.order, ['benchtop-setup', 'benchtop-areas', 'benchtop-chooser'], 'setup, then areas, then the surface chooser');
  assert.equal(landing.locked, 'true'); assert.equal(landing.cards, 0, 'no surface can be chosen before the setup is confirmed');
  assert(!/slab thickness|finished edge|template required|supplier quote|physical sample confirmed|full slab|approx|confirm with stone ambassador|selected finish/i.test(landing.text), 'no fabricator / supplier questions on the client page');
  assert.deepEqual(landing.smallText, [], 'no text under 16px');
  // What the project already knows: the sink cabinet ticks the sink and tap; the bench run is measured.
  const prefilled = await page.evaluate(() => Object.fromEntries(['sink', 'cooktop', 'tap', 'other'].map(name => [name, document.querySelector(`[data-testid="benchtop-cutout-${name}"]`).checked])));
  assert.deepEqual(prefilled, {sink:true, cooktop:false, tap:true, other:false});
  const listed = await page.$$eval(selector('benchtop-area'), rows => rows.map(row => row.innerText.replace(/\s+/g, ' ')));
  assert.equal(listed.length, 2, 'the main run and the island are both listed without adding anything');
  assert(/Main benchtop 4\.50 lm 600 mm wide From the cabinet schedule/.test(listed[0]), listed[0]);
  assert(/Island benchtop Length needed 900 mm wide From the project - Cabinetry scope: Island bench back/.test(listed[1]), listed[1]);
  assert(/enter the length of Island benchtop/i.test(await page.$eval(selector('benchtop-length-needed'), note => note.innerText)), 'the island length is asked for, not invented');
  await screenshot('01-setup-first');
  report.steps.open = {order:landing.order, prefilledCutouts:prefilled, areas:listed};

  // 2 - setup: square arris, no waterfall, 100mm upstand, sink + cooktop
  assert.equal(await page.$eval(selector('benchtop-edge'), select => select.value), 'Square arris');
  assert.equal(await page.$eval(selector('benchtop-waterfall'), select => select.value), 'None');
  await page.select(selector('benchtop-upstand'), '100mm');
  await click(selector('benchtop-cutout-cooktop'));
  await click(selector('benchtop-cutout-tap'));
  await page.waitForFunction(() => !document.querySelector('[data-testid="benchtop-cutout-tap"]').checked && document.querySelector('[data-testid="benchtop-cutout-cooktop"]').checked);
  await click(selector('benchtop-setup-confirm'));
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.setupComplete === 'true', {}, BENCH);

  // 3 - areas: main bench 4.80 m, island 3.20 m x 900 - structured, never free text
  await click(selector('benchtop-edit-dimensions'));
  await setValue(`${selector('benchtop-area')}[data-area="Main benchtop"] ${selector('benchtop-area-length')}`, 4800);
  assert(!(await page.$$eval(`${selector('benchtop-add-area')} option`, options => options.map(option => option.value))).includes('Island'), 'the island is already there: it is not offered again');
  await setValue(`${selector('benchtop-area')}[data-area="Island benchtop"] ${selector('benchtop-area-length')}`, 3200);
  assert.equal(await page.$eval(`${selector('benchtop-area')}[data-area="Island benchtop"] ${selector('benchtop-area-depth')}`, select => select.value), '900');
  await click(selector('benchtop-edit-dimensions'));
  await page.waitForFunction(() => document.querySelector('[data-testid="benchtop-total-lm"]')?.innerText.trim() === '8.00 lm');
  assert.equal(await page.$(selector('benchtop-length-needed')), null);
  await shoot('02-setup-and-areas', BENCH);
  let stored = await storedWhen(record => record.setup?.confirmedAt && record.areas.length === 2 && record.areas[1].lengthMm === 3200);
  assert.deepEqual([stored.setup.edgeProfile, stored.setup.waterfallEnds, stored.setup.upstand, stored.setup.cutouts.slice().sort()], ['Square arris', 'None', '100mm', ['Cooktop', 'Sink']]);
  assert.deepEqual(stored.areas.map(area => [area.label, area.lengthMm, area.depthMm, area.product]), [['Main benchtop', 4800, 600, ''], ['Island benchtop', 3200, 900, '']], 'the configuration is stored before any surface is chosen');
  report.steps.setup = {setup:stored.setup, areas:stored.areas.map(area => `${area.label} ${area.lengthMm}mm x ${area.depthMm}`)};

  // 4 - choose Stone Ambassador Eclipse for the main bench
  await page.waitForSelector(selector('benchtop-product'));
  await page.select(selector('benchtop-filter-brand'), 'Stone Ambassador');
  await page.type(selector('benchtop-search'), 'Eclipse');
  await page.waitForFunction(() => { const cards = [...document.querySelectorAll('[data-testid="benchtop-product"]')]; return cards.length > 0 && cards.every(card => /eclipse/i.test(card.dataset.productName)); });
  await page.$eval(`${selector('benchtop-product')}[data-product-name="Eclipse"] ${selector('benchtop-select')}`, button => button.click());
  await page.waitForSelector(`${selector('benchtop-summary')}[data-area="Main benchtop"]`);
  let cards = await summaries();
  assert.deepEqual(cards.map(card => [card.area, card.product]), [['Main benchtop', 'Eclipse']], 'only the main bench has a surface so far');
  assert(/Stone Ambassador Eclipse/.test(cards[0].text) && /Range Kaya Surfaces/.test(cards[0].text) && /Edge Square arris/.test(cards[0].text) && /Waterfall ends None/.test(cards[0].text) && /Upstand 100mm/.test(cards[0].text) && /4\.80 lm/.test(cards[0].text), cards[0].text);
  assert(/Final colour should be confirmed from a current physical sample/.test(cards[0].text));
  // The client is not asked for the quotation range, and nothing was pre-mapped.
  assert.deepEqual([cards[0].rangeKey, cards[0].asksRange], ['', false], 'no range is guessed and none is asked of the client');
  assert(/Not set for Stone Ambassador Kaya Surfaces/.test(cards[0].text), cards[0].text);
  // Builder setting: Supplier -> supplier price group -> quotation range.
  const priceGroupsBefore = await setPriceGroups({[GROUPS.eclipse]:'mid_range_stone'});
  assert(priceGroupsBefore.total > 10 && priceGroupsBefore.set === 0, `no supplier price group is mapped until the builder maps it: ${JSON.stringify(priceGroupsBefore)}`);
  await page.waitForFunction(() => document.querySelector('[data-testid="benchtop-summary"][data-area="Main benchtop"]')?.dataset.rangeKey === 'mid_range_stone');
  assert.equal((await summaries())[0].rangeSource, 'supplier-price-group');
  report.steps.priceGroups = {groups:priceGroupsBefore.total, mappedByDefault:priceGroupsBefore.set};
  // The same surface everywhere: one click.
  await click(`${selector('benchtop-summary')}[data-area="Main benchtop"] ${selector('benchtop-apply-all')}`);
  await page.waitForSelector(`${selector('benchtop-summary')}[data-area="Island benchtop"]`);
  stored = await storedWhen(record => record.areas.length === 2 && record.areas.every(area => area.product === 'Eclipse' && area.rangeKey === 'mid_range_stone'));
  assert.deepEqual(stored.areas.map(area => [area.label, area.supplier, area.product, area.collection, area.rangeKey, area.lengthMm, area.supplierConfirmationStatus, area.edge, area.upstand]),
    [['Main benchtop', 'Stone Ambassador', 'Eclipse', 'Kaya Surfaces', 'mid_range_stone', 4800, 'required', 'Square arris', '100 mm'], ['Island benchtop', 'Stone Ambassador', 'Eclipse', 'Kaya Surfaces', 'mid_range_stone', 3200, 'required', 'Square arris', '100 mm']]);
  assert(stored.hasCabinetrySection, 'the job has the CABINETRY quotation section');
  assert.deepEqual([stored.quote.mid600, stored.quote.mid900, stored.quote.high600, stored.quote.high900, stored.quote.sink, stored.quote.cooktop, stored.quote.tap, stored.quote.upstand], [4.8, 3.2, null, null, 1, 1, null, 4.8], 'Kitchen 8.00 lm on Mid Range Stone, with the cut-outs and upstand');
  await shoot('03-eclipse-selected', BENCH);
  report.steps.eclipse = {summary:cards[0].text, quote:stored.quote};
  // Saving did not move or reload the screen.
  await delay(2500);
  assert.deepEqual(await where(), {summary:false, onBenchtops:true, room:'Kitchen'}, 'autosave leaves the client on Kitchen > Benchtops');
  assert.equal(report.documentLoads, loadsAtStart, 'no page reload');

  // 5 - the island takes a Stone Ambassador Signature surface; the two stay independent
  await page.$eval(`${selector('benchtop-target')}[data-area="Island benchtop"]`, tab => tab.click());
  await setValue(selector('benchtop-search'), signature.colourName);
  await page.waitForSelector(`${selector('benchtop-product')}[data-product-name="${signature.colourName}"]`);
  await page.$eval(`${selector('benchtop-product')}[data-product-name="${signature.colourName}"] ${selector('benchtop-select')}`, button => button.click());
  await page.waitForFunction(name => document.querySelector('[data-testid="benchtop-summary"][data-area="Island benchtop"]')?.dataset.productName === name, {}, signature.colourName);
  cards = await summaries();
  assert.deepEqual(cards.map(card => [card.area, card.product, card.rangeKey]), [['Main benchtop', 'Eclipse', 'mid_range_stone'], ['Island benchtop', signature.colourName, '']], 'Signature is not mapped yet, so the island has no range');
  stored = await storedWhen(record => record.areas[1]?.product === signature.colourName && record.quote.mid900 === null);
  assert.deepEqual([stored.quote.mid600, stored.quote.mid900, stored.benchLm], [4.8, null, 4.8], 'an unmapped surface is not priced on a guessed row');
  await setPriceGroups({[GROUPS.signature]:'high_end_stone', [GROUPS.prestige]:'mid_range_stone'});
  await page.waitForFunction(() => document.querySelector('[data-testid="benchtop-summary"][data-area="Island benchtop"]')?.dataset.rangeKey === 'high_end_stone');
  stored = await storedWhen(record => record.areas[1]?.rangeKey === 'high_end_stone' && record.quote.high900 === 3.2);
  assert.deepEqual(stored.areas.map(area => [area.label, area.product, area.rangeKey, area.rangeSource, area.supplierPriceGroup]), [['Main benchtop', 'Eclipse', 'mid_range_stone', 'supplier-price-group', ''], ['Island benchtop', signature.colourName, 'high_end_stone', 'supplier-price-group', 'Signature']]);
  assert.deepEqual([stored.quote.mid600, stored.quote.mid900, stored.quote.high900, stored.benchLm], [4.8, null, 3.2, 8], 'the island sits on High End Stone; nothing is duplicated');
  await shoot('04-two-surfaces', BENCH);
  report.steps.island = {product:signature.colourName, quote:stored.quote};
  const islandProduct = signature.colourName, islandRange = 'high_end_stone';

  // 6 - reload: everything is retained
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector(`${GUIDED_SCREENS}, ${selector('open-local-job-file-input')}`);
  await delay(4000);
  if (!await page.$(GUIDED_SCREENS)) await loadLocalJob(fixture);
  await openBenchtops('Kitchen');
  await page.waitForSelector(`${selector('benchtop-summary')}[data-area="Island benchtop"]`);
  cards = await summaries();
  assert.deepEqual(cards.map(card => [card.area, card.product, card.rangeKey]), [['Main benchtop', 'Eclipse', 'mid_range_stone'], ['Island benchtop', islandProduct, islandRange]]);
  assert.equal(await page.$eval(selector('benchtop-total-lm'), cell => cell.innerText.trim()), '8.00 lm');
  assert.equal(await page.$eval(selector('benchtop-upstand'), select => select.value), '100mm');
  assert.equal(await page.$eval(BENCH, element => element.dataset.setupComplete), 'true');
  report.steps.reload = {persisted:true};

  // 7 - Ensuite vanity benchtop: the same setup-first flow, with vanity-only options
  await openBenchtops('Ensuite');
  const vanity = await page.$eval(BENCH, element => ({variant:element.dataset.variant, text:element.innerText, order:[...element.querySelectorAll(':scope > section')].map(section => section.dataset.testid), locked:element.querySelector('[data-testid="benchtop-chooser"]').dataset.locked,
    cutouts:[...element.querySelectorAll('[data-testid^="benchtop-cutout-"]')].map(input => input.closest('label').innerText.trim()), waterfall:Boolean(element.querySelector('[data-testid="benchtop-waterfall"]')),
    edges:[...element.querySelectorAll('[data-testid="benchtop-edge"] option')].map(option => option.value), areas:[...element.querySelectorAll('[data-testid="benchtop-area"]')].map(row => row.innerText.replace(/\s+/g, ' ')),
    smallText:[...element.querySelectorAll('*')].filter(node => node.children.length === 0 && node.innerText?.trim() && parseFloat(getComputedStyle(node).fontSize) < 16).map(node => `${node.tagName} ${node.innerText.slice(0, 30)}`)}));
  assert.equal(vanity.variant, 'vanity');
  assert.deepEqual(vanity.order, ['benchtop-setup', 'benchtop-areas', 'benchtop-chooser']); assert.equal(vanity.locked, 'true');
  assert.deepEqual(vanity.cutouts, ['Basin', 'Tap / Mixer'], 'basin and tap only: no cooktop, no kitchen sink');
  assert.equal(vanity.waterfall, false, 'no waterfall ends on a vanity');
  assert(vanity.edges.includes('Mitred drop front') && !vanity.edges.includes('Shark nose'), vanity.edges.join(', '));
  assert.deepEqual(vanity.areas, ['Wall-mounted vanity benchtop 1.20 lm 600 mm wide From the cabinet schedule'], 'the vanity top and its length come from the cabinet schedule');
  assert(!/island|cooktop|waterfall|slab thickness|finished edge|template required|supplier quote|physical sample confirmed|full slab|approx/i.test(vanity.text), 'no kitchen-only or fabricator questions');
  assert.deepEqual(vanity.smallText, [], 'no text under 16px');
  await page.select(selector('benchtop-edge'), 'Mitred drop front');
  await click(selector('benchtop-cutout-sink'));
  await click(selector('benchtop-cutout-tap'));
  await page.select(selector('benchtop-upstand'), '100mm');
  await click(selector('benchtop-setup-confirm'));
  await page.waitForFunction(sel => document.querySelector(sel)?.dataset.setupComplete === 'true', {}, BENCH);
  await page.waitForSelector(selector('benchtop-product'));
  await page.type(selector('benchtop-search'), prestige.colourName);
  await page.waitForSelector(`${selector('benchtop-product')}[data-product-name="${prestige.colourName}"]`);
  await page.$eval(`${selector('benchtop-product')}[data-product-name="${prestige.colourName}"] ${selector('benchtop-select')}`, button => button.click());
  await page.waitForSelector(selector('benchtop-summary'));
  const vanityCard = (await summaries())[0];
  assert.deepEqual([vanityCard.area, vanityCard.product, vanityCard.rangeKey, vanityCard.rangeSource, vanityCard.asksRange], ['Wall-mounted vanity benchtop', prestige.colourName, 'mid_range_stone', 'supplier-price-group', false], 'the Prestige group set earlier applies here automatically');
  assert(/Edge Mitred drop front/.test(vanityCard.text) && /Cut-outs Basin, Tap \/ Mixer/.test(vanityCard.text) && !/Waterfall/.test(vanityCard.text), vanityCard.text);
  stored = await storedWhen(record => record.vanity.areas[0]?.product === prestige.colourName && record.quote.vanityMid === 1.2);
  assert.deepEqual(stored.vanity.areas, [{id:'wallMountedVanity', label:'Wall-mounted vanity benchtop', lengthMm:1200, product:prestige.colourName, rangeKey:'mid_range_stone', supplierPriceGroup:'Prestige', edge:'Mitred drop front', waterfall:'None'}]);
  assert.equal(stored.vanity.record, prestige.colourName, 'the vanity record the rest of Cabinetry reads is kept in step');
  assert.deepEqual([stored.quote.vanityMid, stored.quote.vanityBasin, stored.quote.vanityTap, stored.quote.vanityUpstand], [1.2, 1, 1, 1.2], 'vanity top, basin cut-out, tap hole and upstand on the bathroom rows');
  assert.deepEqual([stored.quote.mid600, stored.quote.high900], [4.8, 3.2], 'the Kitchen quantities are untouched');
  await shoot('05-vanity-benchtop', BENCH);
  // reload: the vanity benchtop is retained
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector(`${GUIDED_SCREENS}, ${selector('open-local-job-file-input')}`);
  await delay(4000);
  if (!await page.$(GUIDED_SCREENS)) await loadLocalJob(fixture);
  await openBenchtops('Ensuite');
  await page.waitForSelector(selector('benchtop-summary'));
  assert.deepEqual((await summaries()).map(card => [card.area, card.product, card.rangeKey]), [['Wall-mounted vanity benchtop', prestige.colourName, 'mid_range_stone']]);
  assert.equal(await page.$eval(selector('benchtop-edge'), select => select.value), 'Mitred drop front');
  report.steps.vanity = {cutouts:vanity.cutouts, areas:vanity.areas, selected:vanityCard.text, quote:{top:stored.quote.vanityMid, basin:stored.quote.vanityBasin, tap:stored.quote.vanityTap, upstand:stored.quote.vanityUpstand}, persisted:true};

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
