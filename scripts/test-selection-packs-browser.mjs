import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Bathroom Accessory Packs in the running app: required quantity from the project's rooms, select a
// pack, component quantities, change one item, Quotation + Procurement in the saved job, reload,
// remove. Uses an isolated local job; cloud writes are blocked, existing jobs are never touched.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-selection-packs-browser.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/selection-packs-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-selection-packs-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local selection packs regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-PACKS', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-PACKS', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-packs-job.json');
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
const consoleLines = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;
const GUIDED_SCREENS = ['guided-client-selections-home', 'guided-interior-categories', 'guided-exterior-categories', 'guided-category-bathroom-accessories'].map(selector).join(', ');
const money = text => Number(String(text).replace(/[^0-9.-]/g, '').replace(/^-?$/, 'NaN')) * (/−/.test(String(text)) ? -1 : 1);
const SECTION = selector('selection-packs-bathroom-accessory-pack');
const SELECTED = selector('selection-pack-selected');

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
      await page.evaluate((text) => [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(), label);
    }
    if (!dialogLabels.length && attempt >= 1 && await page.$(GUIDED_SCREENS)) return;
  }
  await page.waitForSelector(GUIDED_SCREENS);
}

async function openBathroomAccessories() {
  const hub = selector('guided-category-bathroom-accessories');
  for (let guard = 0; guard < 6 && !await page.$(hub); guard++) {
    if (await page.$(selector('guided-client-selections-home'))) {
      await page.$eval(`${selector('guided-client-selections-home')} [data-category-key="interior"]`, element => element.click());
      await page.waitForSelector(selector('guided-interior-categories'));
    } else if (await page.$(selector('guided-interior-categories'))) {
      await page.$eval(`${selector('guided-interior-categories')} [data-category-key="bathroom-accessories"]`, element => element.click());
      await page.waitForSelector(hub);
    } else {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Back')?.click());
      await delay(800);
    }
  }
  await page.waitForSelector(SECTION);
}

const selectedPack = () => page.$eval(SELECTED, element => ({
  packId:element.dataset.packId,
  name:element.querySelector('h3').innerText,
  total:element.querySelector('[data-testid="selection-pack-selected-total"]').innerText,
  allowance:element.querySelector('[data-testid="selection-pack-selected-allowance"]').innerText,
  variation:element.querySelector('[data-testid="selection-pack-selected-variation"]').innerText,
  components:[...element.querySelectorAll('tbody tr')].map(row => ({key:row.dataset.testid.replace('selection-pack-component-', ''), quantity:Number(row.dataset.quantity), product:row.querySelector('td:nth-child(2) strong').innerText, changed:Boolean(row.querySelector('td:nth-child(2) small'))})),
}));

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

async function savedWhen(predicate) {
  let saved;
  // The job write is debounced and verified, so allow it time.
  for (let attempt = 0; attempt < 200; attempt++) {
    await delay(300);
    saved = await savedLocalRecord();
    if (saved && predicate(saved)) return saved;
  }
  return saved;
}

try {
  page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleLines.push(`${new Date().toISOString()} ${message.type()} ${message.text().slice(0, 300)}`); });
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

  // A - the pack section sits above the individual accessory categories, quantity from the rooms
  await openBathroomAccessories();
  const layout = await page.evaluate((sectionSelector) => {
    const section = document.querySelector(sectionSelector);
    const grid = document.querySelector('.plumbingCategoryGrid');
    return {
      heading:section.querySelector('h2').innerText,
      required:Number(section.querySelector('[data-testid="selection-pack-required-quantity"]').innerText),
      requiredText:section.querySelector('[data-testid="selection-pack-required"]').innerText.replace(/\s+/g, ' '),
      aboveCategories:Boolean(grid) && Boolean(section.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING),
      cards:[...section.querySelectorAll('[data-testid="selection-pack-card"]')].map(card => ({packId:card.dataset.packId, text:card.innerText.replace(/\s+/g, ' ')})),
      smallText:[...section.querySelectorAll('*')].filter(element => element.children.length === 0 && element.innerText?.trim() && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => `${element.tagName} ${element.innerText.slice(0, 30)}`),
    };
  }, SECTION);
  assert.equal(layout.heading.toUpperCase(), 'BATHROOM ACCESSORY PACKS');
  assert.equal(layout.required, 2, `Bathroom + Ensuite = 2 packs (${layout.requiredText})`);
  assert(/Not counted: .*Powder Room/.test(layout.requiredText), 'Powder Room is not a full pack');
  assert(layout.aboveCategories, 'packs are shown before the individual accessory categories');
  assert(layout.cards.length >= 3, 'pack cards shown');
  assert(layout.cards.every(card => /Includes:/.test(card.text) && /per pack/.test(card.text) && /Project requires: 2 packs/.test(card.text) && /Total:/.test(card.text)), 'every card shows contents, price, packs required and total');
  assert.deepEqual(layout.smallText, [], 'no text under 16px');
  report.tests.A = {required:layout.requiredText, cards:layout.cards.length, first:layout.cards[0].text};
  await screenshot('A-pack-section');

  // B - View Pack
  await page.$eval(`${SECTION} [data-testid="selection-pack-card"]:nth-of-type(2) .packActions button:not(.primary)`, button => button.click());
  await page.waitForSelector(selector('selection-pack-view'));
  const view = await page.$eval(selector('selection-pack-view'), element => element.innerText.replace(/\s+/g, ' '));
  assert(/price per pack/i.test(view) && /2 packs/i.test(view) && /variation/i.test(view));
  await screenshot('B-view-pack');
  await page.$eval(`${selector('selection-pack-view')} footer button:not(.primary)`, button => button.click());

  // C - select the second pack: applied twice, every component x2
  const target = layout.cards[1];
  const perPack = money(target.text.match(/\$[\d,.]+ per pack/)[0]);
  await page.$eval(`${SECTION} [data-pack-id="${target.packId}"] [data-testid="selection-pack-select"]`, button => button.click());
  await page.waitForSelector(SELECTED);
  const chosen = await selectedPack();
  assert.equal(chosen.packId, target.packId);
  assert.equal(await page.$eval(selector('selection-pack-required-quantity'), element => Number(element.innerText)), 2, 'required quantity is still 2 once the selection is saved');
  assert.deepEqual(chosen.components.map(component => component.key).sort(), ['hand-towel', 'robe-hook', 'toilet-roll-holder', 'towel-rail']);
  assert(chosen.components.every(component => component.quantity === 2), '2 packs -> 2 of each component');
  assert.equal(money(chosen.total), perPack * 2, 'total = price per pack x 2');
  assert.equal(money(chosen.variation), Math.round((money(chosen.total) - money(chosen.allowance)) * 100) / 100, 'variation = selected - allowance');
  const railCard = await page.$eval(selector('plumbing-category-selection-towel-rail'), element => element.innerText.replace(/\s+/g, ' '));
  assert(/×2/.test(railCard) && /Main Bathroom ×1/.test(railCard) && /Ensuite ×1/.test(railCard), `Towel Rails category shows the component allocation: ${railCard}`);
  report.tests.C = {chosen, perPack, railCard};
  await page.$eval(SECTION, element => element.scrollIntoView());
  await screenshot('C-pack-selected');

  // D - change one item, the rest of the pack stays
  await page.$eval(`${selector('selection-pack-component-towel-rail')} button`, button => button.click());
  await page.waitForSelector(selector('selection-pack-swap'));
  await screenshot('D-change-item');
  const swappedTo = await page.evaluate((swapSelector) => {
    const option = [...document.querySelectorAll(`${swapSelector} [data-testid="selection-pack-swap-option"]`)].find(item => !item.classList.contains('current') && /\$/.test(item.querySelector('strong').innerText));
    const result = {name:option.querySelector('b').innerText, price:option.querySelector('strong').innerText, code:option.dataset.productCode};
    option.querySelector('button').click();
    return result;
  }, selector('selection-pack-swap'));
  await page.waitForFunction((sel, name) => document.querySelector(`${sel} [data-testid="selection-pack-component-towel-rail"] strong`)?.innerText === name, {}, SELECTED, swappedTo.name);
  const changed = await selectedPack();
  const rail = changed.components.find(component => component.key === 'towel-rail');
  assert(rail.changed && rail.quantity === 2, 'substituted towel rail keeps its quantity');
  assert.deepEqual(changed.components.filter(component => component.key !== 'towel-rail'), chosen.components.filter(component => component.key !== 'towel-rail'), 'other components untouched');
  assert.equal(money(changed.allowance), money(chosen.allowance), 'allowance unchanged');
  assert.equal(Math.round((money(changed.variation) - money(chosen.variation)) * 100), Math.round((money(changed.total) - money(chosen.total)) * 100), 'variation moves with the price');
  report.tests.D = {swappedTo, changed};
  await screenshot('D-item-changed');

  // E - the saved job: component quantities in the Quotation Builder and Procurement
  const saved = await savedWhen(record => (record.workbook?.procurement?.items || []).some(item => item.selectionPack && item.productCode === swappedTo.code));
  const section = saved?.workbook?.quotation?.['FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS'];
  assert(section, 'Quotation has the Bathroom Accessories client selections section');
  const quoteRows = section.rows.filter(row => row.selectionPack);
  assert.equal(quoteRows.length, 4, 'one quotation line per component');
  assert(quoteRows.every(row => Number(row.qty) === 2 && row.productCode && row.selectionPack.packQuantity === 2), 'each component x2 with its product code');
  assert(quoteRows.some(row => row.productCode === swappedTo.code && row.selectionPack.substituted), 'substituted product is what is quoted');
  const procurement = (saved.workbook.procurement?.items || []).filter(item => item.selectionPack);
  assert.equal(procurement.length, 4);
  assert(procurement.every(item => Number(item.qty) === 2 && /Main Bathroom ×1, Ensuite ×1/.test(item.notes)));
  report.tests.E = {quotation:quoteRows.map(row => `${row.qty} x ${row.productName} @ ${row.excelRate} ex GST [${row.locations}]`), procurement:procurement.map(item => `${item.qty} x ${item.itemDescription} (${item.supplier}) - ${item.notes}`)};
  const savedFile = path.join(out, 'saved-local-packs-job.json');
  fs.writeFileSync(savedFile, JSON.stringify(saved));

  // F - identical after reload
  await page.reload({waitUntil:'domcontentloaded'});
  await loadLocalJob(savedFile);
  await openBathroomAccessories();
  await page.waitForSelector(SELECTED);
  assert.deepEqual(await selectedPack(), changed, 'pack, substitution and totals survive a reload');
  report.tests.F = {identicalAfterReload:true};

  // G - remove the pack: its components go, the section offers packs again
  const removeClickedAt = new Date().toISOString();
  await page.$eval(`${SELECTED} .packSelectedActions button`, button => button.click());
  await page.waitForFunction(sel => !document.querySelector(sel), {}, SELECTED);
  assert.equal(await page.$(selector('plumbing-category-selection-towel-rail')), null, 'component selections removed with the pack');
  const cleared = await savedWhen(record => !(record.workbook?.procurement?.items || []).some(item => item.selectionPack));
  report.removeSave = {clickedAt:removeClickedAt, now:new Date().toISOString(), savedAt:cleared.workbook.savedAt, bookRevision:cleared.workbook.clientSelectionsBook?.metadata?.selectionRevision, bookHasPack:JSON.stringify(cleared.workbook.clientSelectionsBook || {}).includes('"selectionPack"'), console:consoleLines.slice(-25)};
  assert.equal((cleared.workbook.procurement?.items || []).filter(item => item.selectionPack).length, 0, 'procurement lines removed');
  report.tests.G = {removed:true};
  await screenshot('G-pack-removed');

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
