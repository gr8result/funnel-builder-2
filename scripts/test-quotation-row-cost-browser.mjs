// Quotation Builder, running app: clearing a row's Qty makes its Cost $0.00 and reduces the
// section and quote totals - checked on Section 83 (INSULATION) and several other sections.
//
//   node --import ./scripts/register-json-loader.mjs scripts/test-quotation-row-cost-browser.mjs [--explore]
//
// Isolated local job; cloud writes are blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';
import {createEstimateBuilderWorkbookDefaults} from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.join(root, 'artifacts/test-artifacts/quotation-row-cost-browser');
fs.mkdirSync(out, {recursive:true});
const EXPLORE = process.argv.includes('--explore');
const projectId = `local-quote-cost-${Date.now()}`;
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ['aiPlanTakeoffJob', 'takeoffEngine', 'takeoffSchedule', 'clientSelectionsBook']) delete defaults[key];
const setData = (section, key, value) => {
  defaults.data[section] = defaults.data[section] || {rows:{}};
  defaults.data[section].rows = defaults.data[section].rows || {};
  defaults.data[section].rows[key] = {...(defaults.data[section].rows[key] || {}), value};
};
// Two storeys so the Second Level sialation row carries a real Takeoff-linked wall area.
setData('inputDataSheet', 'floorCount', 'Double storey');
setData('walls', 'lowerExternalWallsLm', 60);
setData('walls', 'upperExternalWallsLm', 52);
setData('walls', 'lowerCeilingHeight', 2.7);
setData('walls', 'upperCeilingHeight', 2.7);
setData('walls', 'lowerWallSystem', 'Timber/Steel Framed with lightweight cladding');
setData('walls', 'upperWallSystem', 'Timber/Steel Framed with lightweight cladding');
// The rate from the reported case.
const SIALATION = 'quote-30026';
defaults.quotation['INSULATION (82)'].rows = defaults.quotation['INSULATION (82)'].rows.map((row) => row.id === SIALATION ? {...row, manualRate:'10.50'} : row);
const jobName = 'Local quotation cost regression';
const workbook = {...defaults, templateType:'job', page:'quotation', projectId, commercialProjectId:projectId, registeredJobId:projectId,
  registeredJob:{jobId:projectId, jobName, jobNumber:'LOCAL-QCOST', clientName:'Local test client', siteAddress:'Local test address'},
  jobFileMeta:{projectId, jobName, jobNumber:'LOCAL-QCOST', clientName:'Local test client', address:'Local test address'}};
const fixture = path.join(out, 'local-quote-cost-job.json');
fs.writeFileSync(fixture, JSON.stringify({projectId, jobName, workbook}));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, {auth:{persistSession:false}});
const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, anon, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:180000, defaultViewport:{width:1920, height:1080}});
const report = {passed:false, projectId, checks:{}, runtimeErrors:[], blockedCloudWrites:[]};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let page;

async function loadLocalJob(file) {
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:120000});
  await input.uploadFile(file);
  for (let attempt = 0; attempt < 12; attempt++) {
    await delay(700);
    const labels = await page.$$eval('button', (buttons) => buttons.filter((b) => !b.disabled).map((b) => b.innerText.trim()));
    const dialog = ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local'].filter((label) => labels.includes(label));
    for (const label of dialog) await page.evaluate((text) => [...document.querySelectorAll('button')].find((b) => !b.disabled && b.innerText.trim() === text)?.click(), label);
    if (!dialog.length && attempt >= 1 && await page.evaluate(() => document.body.innerText.includes('PRELIMINARIES'))) return;
  }
  await page.waitForFunction(() => document.body.innerText.includes('PRELIMINARIES'), {timeout:60000});
}

// Sections start collapsed: click the section's header title to open it.
async function expandSection(name) {
  const opened = await page.evaluate((name) => {
    const title = [...document.querySelectorAll('span, strong, div, button')].find((el) => el.children.length === 0 && el.innerText.trim().toUpperCase() === name);
    if (!title) return false;
    title.scrollIntoView({block:'center'});
    title.click();
    return true;
  }, name);
  assert(opened, `section ${name} found`);
  await delay(900);
}

async function finalQuoteTotal() {
  return page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && (el.textContent || '').trim() === 'Final quote total');
    return label?.parentElement?.innerText.match(/\$[\d,]+\.\d\d/)?.[0] || '';
  });
}

// Everything the user sees for one quotation row (identified by its description input).
async function readRow(rowId) {
  return page.$eval(`#quote-edit-${rowId}`, (description) => {
    const tr = description.closest('tr');
    const inputs = [...tr.querySelectorAll('input')];
    const index = inputs.indexOf(description);
    const cells = [...tr.children].map((td) => td.innerText.trim());
    const money = cells.filter((text) => /^\$[\d,]+\.\d\d$/.test(text));
    return {item:description.value, qty:inputs[index + 1]?.value ?? null, unit:inputs[index + 2]?.value ?? null, rate:inputs[index + 3]?.value ?? null, cells, cost:money.at(-1) ?? ''};
  });
}

async function setQty(rowId, next) {
  await page.$eval(`#quote-edit-${rowId}`, (description, next) => {
    const inputs = [...description.closest('tr').querySelectorAll('input')];
    const qty = inputs[inputs.indexOf(description) + 1];
    qty.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(qty, next);
    qty.dispatchEvent(new Event('input', {bubbles:true}));
    qty.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    qty.blur();
  }, next);
  await delay(1200);
}

// The section's own total, as shown in its header row.
async function sectionTotal(sectionName) {
  return page.evaluate((name) => {
    const header = [...document.querySelectorAll('tr, div, button, h3, h4')].filter((el) => el.innerText && el.innerText.toUpperCase().includes(name) && /\$[\d,]+\.\d\d/.test(el.innerText) && el.innerText.length < 400).sort((a, b) => a.innerText.length - b.innerText.length)[0];
    const values = header ? header.innerText.match(/\$[\d,]+\.\d\d/g) : [];
    return {text:header?.innerText.replace(/\s+/g, ' ').slice(0, 200) || '', total:values?.at(-1) || ''};
  }, sectionName);
}

const money = (text) => Number(String(text || '0').replace(/[$,]/g, '')) || 0;

try {
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (error) => report.runtimeErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites.push(new URL(request.url()).pathname);
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, {waitUntil:'domcontentloaded', timeout:180000});
  await loadLocalJob(fixture);
  await expandSection('INSULATION');
  await page.waitForSelector(`#quote-edit-${SIALATION}`);
  await page.$eval(`#quote-edit-${SIALATION}`, (el) => el.scrollIntoView({block:'center'}));

  if (EXPLORE) {
    console.log(JSON.stringify({row:await readRow(SIALATION), section:await sectionTotal('INSULATION')}, null, 1));
    await page.screenshot({path:path.join(out, 'explore.png')});
  } else {
    // SECTION 83 - INSULATION: Sialation Installed price - Second Level
    const before = await readRow(SIALATION);
    const sectionBefore = await sectionTotal('INSULATION');
    const quoteBefore = await finalQuoteTotal();
    await page.screenshot({path:path.join(out, '83-before.png')});
    assert(money(before.cost) > 0, `row has a cost before clearing (${before.cost})`);
    await setQty(SIALATION, '');
    const after = await readRow(SIALATION);
    const sectionAfter = await sectionTotal('INSULATION');
    const quoteAfter = await finalQuoteTotal();
    await page.$eval(`#quote-edit-${SIALATION}`, (el) => el.scrollIntoView({block:'center'}));
    await page.screenshot({path:path.join(out, '83-after-clear.png')});
    assert.equal(after.qty, '', 'Qty is blank');
    assert.equal(after.cost, '$0.00', `Cost shows $0.00 (was ${before.cost})`);
    assert.equal(Math.round((money(sectionBefore.total) - money(sectionAfter.total)) * 100) / 100, money(before.cost), 'Section 83 total falls by the cleared cost');
    assert(money(quoteAfter) < money(quoteBefore), `Final quote total falls (${quoteBefore} -> ${quoteAfter})`);
    await setQty(SIALATION, '40');
    const reentered = await readRow(SIALATION);
    assert.equal(reentered.cost, '$420.00', 'Re-entered Qty 40 × $10.50');
    await setQty(SIALATION, '0');
    const zero = await readRow(SIALATION);
    assert.equal(zero.cost, '$0.00', 'Qty 0 → $0.00');
    report.checks.section83 = {before, sectionBefore, after, sectionAfter, quoteBefore, quoteAfter, reentered:reentered.cost, zero:zero.cost};

    for (const name of ['FRAME STAGE LABOUR', 'LOCK-UP STAGE LABOUR', 'FIX-OUT STAGE LABOUR', 'EXTERNAL CLADDING', 'ROOF FRAMING']) {
      try { await expandSection(name); } catch { /* section may not exist in this job */ }
    }

    // OTHER SECTIONS - the first priced, quantity-bearing row in several other sections.
    const candidates = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('input[id^="quote-edit-quote-"]')].map((input) => {
        const tr = input.closest('tr');
        const cells = [...tr.children].map((td) => td.innerText.trim());
        const cost = cells.filter((text) => /^\$[\d,]+\.\d\d$/.test(text)).at(-1) || '';
        const inputs = [...tr.querySelectorAll('input')];
        const qty = inputs[inputs.indexOf(input) + 1];
        return {id:input.id.replace('quote-edit-', ''), item:input.value, cost, editableQty:Boolean(qty) && qty.tagName === 'INPUT' && qty.value !== ''};
      });
      return rows.filter((row) => row.editableQty && Number(row.cost.replace(/[$,]/g, '')) > 0);
    });
    const others = candidates.filter((row) => row.id !== SIALATION).filter((row, index, all) => all.findIndex((item) => item.item === row.item) === index).slice(0, 5);
    assert(others.length >= 3, `found other priced rows to check (${others.length})`);
    report.checks.otherSections = [];
    for (const target of others) {
      const beforeRow = await readRow(target.id);
      await setQty(target.id, '');
      const afterRow = await readRow(target.id);
      report.checks.otherSections.push({item:target.item, before:beforeRow.cost, after:afterRow.cost, qtyAfter:afterRow.qty});
      assert.equal(afterRow.cost, '$0.00', `${target.item}: cleared Qty → $0.00 (was ${beforeRow.cost})`);
    }
    await page.screenshot({path:path.join(out, 'other-sections.png')});
    assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
    report.passed = true;
    console.log(JSON.stringify({passed:true, checks:report.checks}, null, 1));
  }
} catch (error) {
  report.error = error.message;
  if (page) await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
