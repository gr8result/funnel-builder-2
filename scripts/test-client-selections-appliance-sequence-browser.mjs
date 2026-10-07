import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import {getEffectiveApplianceCatalogue} from '../lib/product-library/catalogueService.js';

// Exercise the embedded user route with an isolated local job. Existing cloud jobs
// and catalogue data are read only; this test never provisions an auth user.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/appliance-sequence-browser');
fs.mkdirSync(out, {recursive:true});
const projectId = `local-appliance-sequence-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const jobName = 'Local appliance sequence regression';
const workbook = {...defaults, templateType:'job', page:'clientSelections', projectId,
  commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-APPLIANCE', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-APPLIANCE', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-appliance-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));
const catalogue = getEffectiveApplianceCatalogue();
const familyOrder = ['ovens', 'cooktops', 'rangehoods', 'dishwashers', 'microwaves', 'fridges', 'freestanding-cookers'];
const catalogueCounts = {};
for (const row of catalogue.records) {
  catalogueCounts[row.brand] ||= {};
  const family = row.familyId || row.familyKey;
  catalogueCounts[row.brand][family] = (catalogueCounts[row.brand][family] || 0) + 1;
}

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
  headless:true, protocolTimeout:180000, defaultViewport:{width:1500, height:1050},
});
const report = {passed:false, route:`${origin}/modules/estimate-builder?page=clientSelections`, projectId,
  isolatedLocalJob:true, catalogueCounts, sequence:[], selections:{}, screenshots:[], runtimeErrors:[], blockedCloudWrites:[]};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = testId => `[data-testid="${testId}"]`;

async function clickText(text, scope = 'body') {
  await page.waitForFunction((text, scope) => [...document.querySelectorAll(`${scope} button`)]
    .some(button => !button.disabled && button.innerText.trim() === text), {}, text, scope);
  await page.evaluate((text, scope) => {
    const button = [...document.querySelectorAll(`${scope} button`)].find(button => !button.disabled && button.innerText.trim() === text);
    button.scrollIntoView({block:'center'});
    button.click();
  }, text, scope);
}

async function clickTestId(testId) {
  await page.waitForSelector(selector(testId));
  await page.$eval(selector(testId), element => {element.scrollIntoView({block:'center'}); element.click();});
}

async function screenshot(name) {
  await page.$eval(selector('guided-appliance-catalogue-flow'), element => element.scrollIntoView({block:'start'})).catch(() => {});
  await page.screenshot({path:path.join(out, `${name}.png`)});
  report.screenshots.push(`${name}.png`);
}

async function loadLocalJob(file) {
  const input = await page.waitForSelector(selector('open-local-job-file-input'));
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 8; attempt++) {
    await delay(500);
    const labels = await page.$$eval('button', buttons => buttons.filter(button => !button.disabled).map(button => button.innerText.trim()));
    for (const label of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) {
      if (labels.includes(label)) await clickText(label);
    }
    if (await page.$(selector('guided-client-selections-home'))) return;
  }
  await page.waitForSelector(selector('guided-client-selections-home'));
}

async function enterAppliances() {
  if (await page.$(selector('guided-client-selections-home'))) {
    await page.$eval('[data-requirement-key="interior"]', element => element.click());
    await page.waitForSelector(selector('guided-interior-categories'));
  }
  if (await page.$(selector('guided-interior-categories'))) {
    await page.$eval('[data-requirement-key="appliances"]', element => element.click());
  }
  await page.waitForSelector(selector('appliance-brand-selection'));
}

async function chooseBrand(brand) {
  await page.$eval(`${selector('appliance-brand-selection')} article[data-brand="${brand}"] button`, button => button.click());
  await assertModels('ovens', brand);
  assert.equal(await page.$(selector('appliance-brand-summary')), null, 'Brand selection must bypass the brand-summary screen.');
  assert.equal(await page.$(selector('appliance-build-your-own')), null, 'Brand selection must bypass the build-your-own screen.');
}

async function assertModels(family, brand) {
  await page.waitForFunction((family, brand) => {
    const flow = document.querySelector('[data-testid="guided-appliance-catalogue-flow"]');
    return flow?.getAttribute('data-family-key') === family && flow?.getAttribute('data-brand') === brand
      && !!document.querySelector('[data-testid="appliance-model-grid"]');
  }, {}, family, brand);
  const families = await page.$$eval('article[data-product-id][data-testid^="appliance-model-"]', cards => cards.map(card => ({family:card.dataset.familyKey, brand:card.dataset.brand})));
  assert(families.every(card => card.family === family && card.brand === brand), `${family} cards must keep brand and category filtering.`);
  const active = await page.$eval(`${selector('guided-appliance-family-menu')} button.active[data-family-key]`, element => element.dataset.familyKey);
  assert.equal(active, family, 'Sidebar highlights the current category.');
}

async function selectFirst(family, {details = false, replacement = false} = {}) {
  const cards = await page.$$eval('article[data-product-id][data-testid^="appliance-model-"]', elements => elements.map(element => ({
    productId:element.dataset.productId, model:element.querySelector('strong')?.innerText, text:element.innerText,
  })));
  assert(cards.length, `${family} must have a product to select.`);
  const chosen = replacement ? cards.find(card => card.productId !== report.selections[family]?.productId) : cards[0];
  assert(chosen, `${family} requires an alternate product for the backward-edit check.`);
  const cardSelector = `article[data-product-id="${chosen.productId}"]`;
  if (details) {
    await clickText('View Details', cardSelector);
    await page.waitForSelector(selector('appliance-product-details'));
    await clickText('Select Product', selector('appliance-product-details'));
  } else {
    const label = await page.$eval(`${cardSelector} .guidedProductActions button.primary`, element => element.innerText.trim());
    await clickText(label, cardSelector);
  }
  report.selections[family] = chosen;
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
  await enterAppliances();
  await screenshot('01-brands');
  console.log('Embedded user route and isolated local job loaded.');
  if (process.argv.includes('--probe')) {
    console.log(JSON.stringify({catalogueCounts, brands:await page.$$eval('[data-testid="appliance-brand-selection"] article[data-brand]', cards => cards.map(card => card.dataset.brand))}));
    report.probeOnly = true;
  } else {
    const brand = process.env.APPLIANCE_SEQUENCE_BRAND || 'Westinghouse';
    await chooseBrand(brand);
    await screenshot('02-brand-direct-to-oven');
    const sidebarFamilies = await page.$$eval(`${selector('guided-appliance-family-menu')} button[data-family-key]`, buttons => buttons.map(button => button.dataset.familyKey));
    assert.deepEqual(sidebarFamilies, familyOrder, 'Sidebar presents the required seven categories in sequence.');
    for (let index = 0; index < familyOrder.length; index++) {
      const family = familyOrder[index];
      await assertModels(family, brand);
      const count = await page.$$eval('article[data-product-id][data-testid^="appliance-model-"]', cards => cards.length);
      if (count) await selectFirst(family, {details:index === 0});
      else {
        await page.waitForSelector(selector('appliance-empty-category'));
        await clickTestId('appliance-next');
      }
      report.sequence.push({family, action:count ? 'select' : 'skip-empty', modelCount:count});
      if (index < familyOrder.length - 1) await assertModels(familyOrder[index + 1], brand);
      else await page.waitForSelector(selector('appliance-review'));
    }
    await screenshot('03-review');
    for (const [family, chosen] of Object.entries(report.selections)) {
      const summary = await page.$eval(`${selector('appliance-selection-summary')} [data-family-key="${family}"]`, element => element.innerText);
      assert(summary.includes(chosen.model), `${family} Review summary retains the chosen model.`);
    }
    await page.$eval(`${selector('guided-appliance-family-menu')} button[data-family-key="ovens"]`, button => button.click());
    await assertModels('ovens', brand);
    const firstOven = report.selections.ovens.productId;
    await selectFirst('ovens', {replacement:true});
    await assertModels('cooktops', brand);
    assert.notEqual(report.selections.ovens.productId, firstOven, 'Backward edit chooses a different canonical oven.');
    await clickText('Review', selector('guided-appliance-family-menu'));
    await page.waitForSelector(selector('appliance-review'));
    const ovenSummary = await page.$eval(`${selector('appliance-selection-summary')} [data-family-key="ovens"]`, element => element.innerText);
    assert(ovenSummary.includes(report.selections.ovens.model), 'Review shows the replacement oven after a sidebar edit.');
    report.backwardEdit = true;
    await clickTestId('appliance-package-mode');
    await page.waitForSelector(selector('appliance-package-list'));
    await clickText('Back to Review');
    await page.waitForSelector(selector('appliance-review'));
    report.optionalPackagesFromReview = true;
    await clickTestId('appliance-finish');
    await page.waitForSelector(selector('guided-client-selections-home'));
    report.finishReturnsToMainSelections = true;
    await clickText('Save Progress');
    let saved;
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(300);
      saved = await savedLocalRecord();
      if (JSON.stringify(saved?.workbook?.clientSelectionsBook || {}).includes(report.selections.ovens.productId)) break;
    }
    assert(saved?.workbook, 'Save Progress writes the isolated job to IndexedDB.');
    assert(JSON.stringify(saved.workbook.clientSelectionsBook).includes(report.selections.ovens.productId), 'Saved local job retains the canonical oven identity.');
    const savedFile = path.join(out, 'saved-local-appliance-job.json');
    fs.writeFileSync(savedFile, JSON.stringify(saved));
    await page.reload({waitUntil:'domcontentloaded'});
    await loadLocalJob(savedFile);
    await enterAppliances();
    await chooseBrand(brand);
    const selectedOven = await page.$eval('article.applianceModelCard.selected', element => element.dataset.productId);
    assert.equal(selectedOven, report.selections.ovens.productId, 'Reloaded saved job highlights the same canonical oven.');
    await clickText('Review', selector('guided-appliance-family-menu'));
    await page.waitForSelector(selector('appliance-review'));
    const reopenedSummary = await page.$eval(`${selector('appliance-selection-summary')} [data-family-key="ovens"]`, element => element.innerText);
    assert(reopenedSummary.includes(report.selections.ovens.model), 'Reloaded Review displays the same oven model.');
    report.saveReloadIdentity = true;
    await screenshot('04-reloaded-review');
    assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
    report.passed = true;
    console.log(JSON.stringify({passed:true, sequence:report.sequence, backwardEdit:report.backwardEdit, optionalPackagesFromReview:report.optionalPackagesFromReview, finishReturnsToMainSelections:report.finishReturnsToMainSelections, saveReloadIdentity:report.saveReloadIdentity}));
  }
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
