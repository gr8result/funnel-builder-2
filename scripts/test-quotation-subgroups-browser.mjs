// Browser check: collapsible room / finish groups in the CABINETRY quotation section.
// Isolated headless profile and its own local job; cloud writes blocked. Needs the dev server.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-subgroups-browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { FINAL_CABINETRY as source } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { cabinetryScheduleCatalogue, cabinetryCatalogueRow } from '../lib/construction-estimation/cabinetryRequirements.js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-artifacts/quotation-subgroups'); fs.mkdirSync(out, { recursive: true });
const owner = source.workspaceId;
const projectId = `local-quote-subgroups-${Date.now()}`;
const WANT = { '2 door base unit - 1200mm': 1, 'Sink base cabinet': 1, 'Corner base cabinet': 2 };
const items = cabinetryScheduleCatalogue('Kitchen').flatMap(group => group.items);
const keyOf = (label, finish) => cabinetryCatalogueRow('kitchen', items.find(entry => entry.label === label).id, finish).importKey;
const workbook = { selectionQuoteEngineVersion: 1, workspaceId: owner, templateType: 'job', page: 'quotation', projectId, registeredJobId: projectId, jobId: projectId,
  registeredJob: { jobId: projectId, jobName: 'Isolated quote subgroup test', jobNumber: 'SUBGROUPS' }, jobFileMeta: { projectId, jobName: 'Isolated quote subgroup test' },
  quotationSectionOrder: ['ELECTRICAL'], quotation: { ELECTRICAL: { collapsed: true, rows: [{ id: 'unrelated-electric', item: 'Electrical labour', quantity: 2, unit: 'HOUR', manualRate: 100 }] } } };
const fixture = path.join(out, 'job.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Isolated quote subgroup test', workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const { data: link, error: linkError } = await createClient(url, service, { auth: { persistSession: false } }).auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, defaultViewport: { width: 1920, height: 1400 } });

const report = { passed: false, checks: {}, notes: {}, runtimeErrors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
const pass = name => { report.checks[name] = 'PASS'; };
const openPage = async name => { await page.goto(`${origin}/modules/estimate-builder?page=${name}`, { waitUntil: 'domcontentloaded', timeout: 240000 }); };
const waitForQuote = () => page.waitForFunction(() => document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label]').length > 5, { timeout: 240000 });
const dismiss = async () => { for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); } };
// The CABINETRY section as drawn: headings in order (with the room each finish belongs to) and product rows.
const drawn = () => page.evaluate(() => {
  const section = document.querySelector('[data-quote-section="CABINETRY"]');
  let room = '';
  const headings = [], products = {};
  for (const row of section.querySelectorAll('tr')) {
    if (row.dataset.subgroupLabel) {
      const level = Number(row.dataset.cabinetryHeadingLevel);
      if (level === 1) room = row.dataset.subgroupLabel;
      headings.push({ label: row.dataset.subgroupLabel, level, room: level === 1 ? '' : room, open: row.dataset.subgroupOpen === 'true', summary: row.querySelector('[data-subgroup-summary]')?.innerText.replace(/\s+/g, ' ').trim() || '' });
    } else if (row.dataset.cabinetryImportKey) products[row.dataset.cabinetryImportKey] = [...row.querySelectorAll('input')].map(input => input.value).join(' | ') + ' || ' + (row.innerText.match(/\$[\d,]+\.\d\d/) || [''])[0];
  }
  return { headings, products, productCount: Object.keys(products).length };
});
const heading = (view, label, room = '') => view.headings.find(item => item.label === label && item.room === room);
const clickHeading = (label, room = '') => page.evaluate(({ label, room }) => {
  let current = '';
  for (const row of document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label]')) {
    const level = Number(row.dataset.cabinetryHeadingLevel);
    if (level === 1) current = row.dataset.subgroupLabel;
    if (row.dataset.subgroupLabel === label && (level === 1 ? room === '' : current === room)) { row.scrollIntoView({ block: 'center' }); row.click(); return true; }
  }
  throw new Error(`Heading not drawn: ${room} / ${label}`);
}, { label, room });
const quoteTotal = () => page.evaluate(() => { const node = [...document.querySelectorAll('*')].find(element => element.children.length <= 2 && /^Final quote total/i.test(element.innerText || '')); return (node?.innerText.match(/\$[\d,]+\.\d\d/) || [''])[0]; });
const clickControl = label => page.evaluate(label => [...document.querySelectorAll('[data-testid="quotation-subgroup-controls"] button')].find(button => button.innerText.trim() === label).click(), label);
const stored = () => page.evaluate(async key => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record) continue;
      const selection = (record.workbook.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).map(row => row.guidedSelection?.cabinetrySelection).find(Boolean);
      return { revision: record.revision, keys: Object.keys(record.workbook).filter(key => /subgroup|collapse/i.test(key)), material: (selection?.locations || []).map(location => `${location.location}:${location.doorMaterialGroup}:${location.confirmedAt ? 'confirmed' : 'open'}`),
        quoted: (record.workbook.quotation?.CABINETRY?.rows || []).filter(row => row.quantity !== '' && row.quantity != null).map(row => `${row.range} / ${row.item} = ${row.quantity}`) };
    } finally { db.close(); }
  }
  return null;
}, `job:${projectId}`);
const untilStored = async (what, test) => { const started = Date.now(); let value; do { value = await stored().catch(() => null); if (value && test(value)) return value; await delay(500); } while (Date.now() - started < 150000); throw new Error(`Save did not land: ${what}\n${JSON.stringify(value)}`); };
const scheduleRow = label => `(() => [...document.querySelectorAll('.cabinetrySelectionRow')].find(row => row.querySelector('strong')?.textContent.trim() === ${JSON.stringify(label)}))()`;
const openKitchenCabinetry = async () => {
  await openPage('clientSelections');
  await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]'), { timeout: 240000 });
  if (await page.$('[data-testid="guided-client-selections-home"]')) await page.$eval('[data-requirement-key="interior"]', element => element.click());
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await page.$eval('[data-requirement-key="cabinetry"]', element => element.click());
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await page.evaluate(() => (document.querySelector('[data-testid="cabinetry-room-kitchen"] button') || document.querySelector('[data-testid="cabinetry-room-kitchen"]')).click());
  await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
};
const openStage = async name => { await page.evaluate(name => [...document.querySelectorAll('[data-testid="cabinetry-progress-menu"] button')].find(button => button.innerText.includes(name)).click(), name); await delay(600); };
const clickInWorkflow = text => page.evaluate(text => { const normalise = value => (value || '').replace(/\s+/g, ' ').trim(); const target = [...document.querySelectorAll('.cabinetryWorkflow button, .cabinetryWorkflow a, .cabinetryWorkflow [role="button"], .cabinetryWorkflow label')].find(element => normalise(element.textContent).includes(text)); if (!target) throw new Error(`Not found in cabinetry workflow: ${text}`); target.scrollIntoView({ block: 'center' }); target.click(); }, text);
const quoteAfterReturn = async () => { await openPage('quotation'); await waitForQuote(); await delay(1500); return drawn(); };

try {
  page = await browser.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort(); else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: owner });

  // Set up: open the job and schedule three Kitchen cabinets through Client Selections.
  await openPage('quotation');
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  await dismiss(); await waitForQuote();
  await openKitchenCabinetry(); await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
  for (const [label, quantity] of Object.entries(WANT)) { const field = await page.evaluateHandle(`${scheduleRow(label)}.querySelector('input[type="number"]')`); await field.click({ clickCount: 3 }); await field.type(String(quantity)); await delay(250); }
  await untilStored('three scheduled quantities', value => value.quoted.length === 3);

  // 1. Open CABINETRY. Defaults: Kitchen (in progress) open with only its selected finish open; untouched areas closed.
  let view = await quoteAfterReturn();
  const total = await quoteTotal(); assert.match(total, /^\$[\d,]+\.\d\d$/); report.notes.quoteTotal = total;
  const K = 'KITCHEN CABINETRY';
  assert.equal(heading(view, K).open, true); assert.equal(heading(view, 'STANDARD COLOURBOARD', K).open, true);
  for (const label of ['PREMIUM LAMINATE', '2 PACK', 'SHAKER STYLE', 'VINYL WRAP']) assert.equal(heading(view, label, K).open, false, `${label} starts collapsed`);
  for (const label of ["BUTLER'S PANTRY CABINETRY", 'LAUNDRY CABINETRY', 'WARDROBES', "BUTLER'S PANTRY BENCHTOPS", 'LAUNDRY BENCHTOPS']) assert.equal(heading(view, label).open, false, `${label} starts collapsed`);
  report.notes.defaultRowsDrawn = `${view.productCount} of 657 product rows`;
  assert(view.productCount < 80, 'the default view is short');
  const standardKeys = Object.keys(view.products).filter(key => source.rows.some(row => (row.key || `final-cabinetry:${row.sourceRow}`) === key && row.room === K && row.range === 'STANDARD COLOURBOARD'));
  assert.equal(standardKeys.length, 31);
  for (const [label, quantity] of Object.entries(WANT)) assert(view.products[keyOf(label, 'standard_colourboard')].startsWith(`${label} | ${quantity} |`), label);
  await page.screenshot({ path: path.join(out, '1-default.png'), fullPage: true });
  // Collapsed-heading summary: active rows only.
  const expectedCost = Object.entries(WANT).reduce((sum, [label, quantity]) => sum + quantity * cabinetryCatalogueRow('kitchen', items.find(entry => entry.label === label).id, 'standard_colourboard').price, 0);
  const money = value => `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  assert.equal(heading(view, 'STANDARD COLOURBOARD', K).summary, `3 ITEMS ${money(expectedCost)}`);
  assert.equal(heading(view, K).summary, `STANDARD COLOURBOARD 3 ITEMS ${money(expectedCost)}`);
  assert.equal(heading(view, 'PREMIUM LAMINATE', K).summary, '');
  report.notes.kitchenSummary = heading(view, K).summary; pass('COLLAPSED SUMMARY');

  // 2-3. Collapse STANDARD COLOURBOARD: only its rows go. Reopen: identical Qty / Price / Cost / Selection.
  const before = view;
  await clickHeading('STANDARD COLOURBOARD', K); await delay(500); view = await drawn();
  assert.equal(heading(view, 'STANDARD COLOURBOARD', K).open, false);
  assert.deepEqual(Object.keys(before.products).filter(key => !(key in view.products)).sort(), [...standardKeys].sort(), 'only Standard Colourboard rows disappear');
  assert.equal(await quoteTotal(), total);
  await clickHeading('STANDARD COLOURBOARD', K); await delay(500); view = await drawn();
  assert.deepEqual(view.products, before.products, 'rows return unchanged');
  pass('FINISH COLLAPSE');

  // 4-5. Collapse KITCHEN CABINETRY: every finish group under it goes. Reopen: everything back.
  await clickHeading(K); await delay(500); view = await drawn();
  assert.equal(heading(view, K).open, false); assert.equal(view.headings.filter(item => item.room === K).length, 0, 'no Kitchen finish heading is drawn');
  assert.equal(Object.keys(view.products).filter(key => standardKeys.includes(key)).length, 0);
  assert.equal(heading(view, K).summary, `STANDARD COLOURBOARD 3 ITEMS ${money(expectedCost)}`, 'the collapsed room still shows its summary');
  assert.equal(await quoteTotal(), total);
  await page.screenshot({ path: path.join(out, '2-kitchen-collapsed.png'), fullPage: true });
  await clickHeading(K); await delay(500); view = await drawn();
  assert.deepEqual(view.products, before.products); assert.deepEqual(view.headings, before.headings);
  pass('ROOM COLLAPSE');

  // Benchtop groups collapse the same way.
  const B = 'KITCHEN BENCHTOPS';
  await clickHeading(B); await delay(400); view = await drawn();
  assert.equal(heading(view, B).open, true); assert.equal(view.headings.filter(item => item.room === B).length, 13, 'twelve ranges and Benchtop Extras');
  await clickHeading('MID RANGE STONE - 20MM', B); await delay(400); const midOpen = await drawn();
  assert.equal(midOpen.productCount, view.productCount + 3, 'only the three Mid Range Stone widths appear');
  await clickHeading('MID RANGE STONE - 20MM', B); await delay(400); assert.equal((await drawn()).productCount, view.productCount);
  await clickHeading(B); await delay(400); assert.deepEqual((await drawn()).products, before.products);
  pass('BENCHTOP GROUP COLLAPSE');

  // Expand all / Collapse all, CABINETRY only.
  await clickControl('Expand all'); await delay(1200); view = await drawn();
  assert.equal(view.productCount, 657); assert(view.headings.every(item => item.open)); assert.equal(await quoteTotal(), total);
  pass('EXPAND ALL');
  await clickControl('Collapse all'); await delay(800); view = await drawn();
  assert.equal(view.productCount, 0); assert(view.headings.every(item => item.level === 1 && !item.open));
  assert.equal(await quoteTotal(), total);
  assert.equal(await page.$$eval('[data-quote-section]', sections => sections.length > 1), true, 'other quotation sections are still there');
  await page.screenshot({ path: path.join(out, '3-collapse-all.png'), fullPage: true });
  pass('COLLAPSE ALL');

  // 9. Navigate away and back: the state is kept (everything collapsed; then Wardrobes opened by hand).
  await clickHeading('WARDROBES'); await delay(400);
  view = await quoteAfterReturn();
  assert.equal(heading(view, K).open, false); assert.equal(heading(view, 'WARDROBES').open, true);
  assert.equal(await quoteTotal(), total);
  pass('COLLAPSE STATE PERSISTENCE');

  // Client Selections sync still works while Kitchen is collapsed in the quote.
  await openKitchenCabinetry(); await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
  const corner = await page.evaluateHandle(`${scheduleRow('Corner base cabinet')}.querySelector('input[type="number"]')`); await corner.click({ clickCount: 3 }); await corner.type('3');
  await untilStored('quantity change', value => value.quoted.includes('STANDARD COLOURBOARD / Corner base cabinet = 3'));
  // 6. Select Premium Laminate: its group opens, the alternatives stay collapsed.
  await openStage('Doors & Panels'); await page.waitForSelector('[data-testid="cabinetry-material-stage"]');
  await page.evaluate(`${scheduleRow('Premium laminate')}.querySelector('input[type="checkbox"]').click()`);
  await untilStored('finish change', value => value.material.includes('Kitchen:Premium laminate:open') && value.quoted.every(line => line.startsWith('PREMIUM LAMINATE')));
  view = await quoteAfterReturn();
  assert.equal(heading(view, K).open, true, 'choosing a finish brings the room back to its working default');
  assert.equal(heading(view, 'PREMIUM LAMINATE', K).open, true);
  for (const label of ['STANDARD COLOURBOARD', '2 PACK', 'SHAKER STYLE', 'VINYL WRAP']) assert.equal(heading(view, label, K).open, false, `${label} collapsed`);
  assert(view.products[keyOf('Corner base cabinet', 'premium_laminate')].startsWith('Corner base cabinet | 3 |'));
  assert.equal(heading(view, K).summary.startsWith('PREMIUM LAMINATE 3 ITEMS'), true);
  pass('SELECTED FINISH BEHAVIOUR'); pass('CLIENT SELECTION SYNC UNAFFECTED');
  await page.screenshot({ path: path.join(out, '4-premium-selected.png'), fullPage: true });
  const totalPremium = await quoteTotal();

  // Save, hard refresh: quantities, total and collapse state as they were. Nothing about collapse is in the job.
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Save Job' && !button.disabled)?.click());
  await delay(10000);
  const saved = await stored(); assert.deepEqual(saved.keys, [], 'collapse state is not written into the job');
  await page.setCacheEnabled(false); await page.reload({ waitUntil: 'domcontentloaded', timeout: 240000 }); await waitForQuote(); await delay(1500);
  const reloaded = await drawn();
  assert.deepEqual(reloaded.headings, view.headings); assert.deepEqual(reloaded.products, view.products); assert.equal(await quoteTotal(), totalPremium);
  pass('SAVE/RELOAD'); pass('QUOTE TOTAL UNCHANGED');

  // 7-8. Kitchen becomes confirmed: the room collapses by itself, shows Confirmed, and reopens with its data.
  //      The confirmed state is put into this job's saved Client Selections (the same fields Confirm
  //      writes: confirmedAt + status) and the job is reopened; the seven-step confirmation screens
  //      themselves are not clicked through here.
  await clickHeading(K); await delay(300); await clickHeading(K); await delay(300);
  assert.equal(heading(await drawn(), K).open, true, 'the user has Kitchen open before it is confirmed');
  const record = await page.evaluate(async key => {
    for (const { name } of await indexedDB.databases()) {
      if (!name.includes('estimate-builder-template-db')) continue;
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try { if (!db.objectStoreNames.contains('jobs')) continue;
        const found = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        if (found) return found; } finally { db.close(); }
    }
    return null;
  }, `job:${projectId}`);
  let confirmedLocations = 0;
  for (const key of ['clientSelectionsBook', 'selectionsBook', 'selectionSchedule', 'selectionSchedules']) for (const room of record.workbook[key]?.rooms || []) for (const row of room.rows || []) {
    for (const selection of [row.guidedSelection?.cabinetrySelection, row.guidedSelection?.selected_details?.cabinetrySelection].filter(Boolean)) for (const location of selection.locations || []) {
      if (location.location === 'Kitchen') { location.confirmedAt = '2026-10-05T09:00:00.000Z'; location.status = 'complete'; confirmedLocations += 1; }
    }
  }
  assert(confirmedLocations > 0, 'the saved job has a Kitchen cabinetry room to confirm');
  const confirmedFile = path.join(out, 'job-kitchen-confirmed.json'); fs.writeFileSync(confirmedFile, JSON.stringify({ projectId, jobName: 'Isolated quote subgroup test', workbook: record.workbook }));
  const reopen = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await reopen.uploadFile(confirmedFile);
  await dismiss(); await waitForQuote(); await delay(2000);
  view = await drawn();
  assert.equal(heading(view, K).open, false, 'the confirmed Kitchen collapses by itself, although the user had it open');
  assert.match(heading(view, K).summary, /3 ITEMS .*✓ CONFIRMED$/);
  assert.equal(view.headings.filter(item => item.room === K).length, 0);
  assert.equal(await quoteTotal(), totalPremium, 'confirming changes no total');
  await page.screenshot({ path: path.join(out, '5-kitchen-confirmed.png'), fullPage: true });
  await clickHeading(K); await delay(500); view = await drawn();
  assert.equal(heading(view, K).open, true);
  assert(view.products[keyOf('Corner base cabinet', 'premium_laminate')].startsWith('Corner base cabinet | 3 |'), 'all data is still present when the confirmed room is reopened');
  for (const [label, quantity] of Object.entries({ ...WANT, 'Corner base cabinet': 3 })) assert(view.products[keyOf(label, 'premium_laminate')].startsWith(`${label} | ${quantity} |`), label);
  pass('AUTO COLLAPSE ON CONFIRM');
  report.notes.confirmedSummary = heading(view, K).summary;
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
