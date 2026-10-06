// Browser check: Client Selections cabinetry -> Quotation Builder, in the running app.
// Uses an isolated headless browser profile and its own local job; no existing job is opened and
// cloud writes are blocked. Needs the dev server (default http://localhost:3000).
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-selection-quote-sync-browser.mjs
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
const out = path.resolve('artifacts/test-artifacts/cabinetry-selection-quote-sync'); fs.mkdirSync(out, { recursive: true });
const owner = source.workspaceId;
const projectId = `local-cabinetry-sync-${Date.now()}`;
const WANT = { '2 door base unit - 1200mm': 1, 'Sink base cabinet': 1, 'Underbench oven cabinet': 1, 'Corner base cabinet': 2, 'Dishwasher cabinet': 1, 'Microwave cabinet': 1, 'Pull-out bin cabinet': 1,
  '3 drawer pot drawer base - 1 small + 2 large': 2, '4 drawer base unit': 1 };
const items = cabinetryScheduleCatalogue('Kitchen').flatMap(group => group.items);
const typeOf = label => items.find(entry => entry.label === label).id;
const keyOf = (label, finish) => cabinetryCatalogueRow('kitchen', typeOf(label), finish).importKey;
const workbook = { selectionQuoteEngineVersion: 1, workspaceId: owner, templateType: 'job', page: 'quotation', projectId, registeredJobId: projectId, jobId: projectId,
  registeredJob: { jobId: projectId, jobName: 'Isolated cabinetry sync test', jobNumber: 'CAB-SYNC' }, jobFileMeta: { projectId, jobName: 'Isolated cabinetry sync test' },
  quotationSectionOrder: ['ELECTRICAL'], quotation: { ELECTRICAL: { collapsed: true, rows: [{ id: 'unrelated-electric', item: 'Electrical labour', quantity: 2, unit: 'HOUR', manualRate: 100 }] } }, };
const fixture = path.join(out, 'job.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Isolated cabinetry sync test', workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, defaultViewport: { width: 1920, height: 1200 } });

const report = { passed: false, steps: {}, runtimeErrors: [], blockedCloudWrites: 0, console: [] };
// Waits for the automatic save to land in the job store (no Save Progress is ever pressed).
const untilStored = async (what, test) => {
  const started = Date.now(); let stored;
  do { stored = await storedCabinetry().catch(() => null); if (stored && test(stored)) { report.steps[`saved: ${what}`] = `${Math.round((Date.now() - started) / 100) / 10}s`; return stored; } await delay(500); } while (Date.now() - started < 150000);
  throw new Error(`The automatic save did not reach the job store: ${what}\n${JSON.stringify(stored)}`);
};
const kitchenSchedule = stored => stored.clientSelectionsBook[0]?.schedule || [];
// What the job store actually holds for cabinetry (diagnostic for a failed step).
const storedCabinetry = () => page.evaluate(async key => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record) continue;
      const describe = book => (book?.rooms || []).flatMap(room => (room.rows || []).map(row => ({ room: room.name, rowId: row.id, key: row.guidedRequirementKey, selection: row.guidedSelection?.cabinetrySelection || row.guidedSelection?.selected_details?.cabinetrySelection })))
        .filter(item => item.selection).map(item => ({ room: item.room, rowId: item.rowId, key: item.key, material: (item.selection.locations || []).map(location => location.location + ':' + location.doorMaterialGroup), schedule: (item.selection.schedule || []).map(line => line.unitType + '=' + line.quantity) }));
      return { revision: record.revision, savedAt: record.savedAt, clientSelectionsBook: describe(record.workbook.clientSelectionsBook), selectionsBook: describe(record.workbook.selectionsBook),
        reconciliation: record.workbook.cabinetryReconciliation?.summary, quoted: (record.workbook.quotation?.CABINETRY?.rows || []).filter(row => row.quantity !== '' && row.quantity != null).map(row => row.range + ' / ' + row.item + ' = ' + row.quantity) };
    } finally { db.close(); }
  }
  return null;
}, `job:${projectId}`);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
const quoteRows = () => page.$$eval('[data-quote-section="CABINETRY"] tr[data-cabinetry-import-key]', rows => Object.fromEntries(rows.map(row => { const inputs = [...row.querySelectorAll('input')]; return [row.dataset.cabinetryImportKey, { qty: inputs[1]?.value ?? '', text: inputs.map(input => input.value).join(' | ') }]; })));
const finishQuantities = async finish => { const rows = await quoteRows(); return Object.fromEntries(Object.keys(WANT).map(label => [label, rows[keyOf(label, finish)]?.qty ?? 'ROW MISSING'])); };
const populatedCount = async () => Object.values(await quoteRows()).filter(row => row.qty !== '' && Number(row.qty) !== 0).length;
const waitForQuote = () => page.waitForFunction(() => document.querySelectorAll('tr[data-cabinetry-import-key]').length === 657, { timeout: 240000 });
const dismiss = async () => { for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); } };
const openPage = async name => { await page.goto(`${origin}/modules/estimate-builder?page=${name}`, { waitUntil: 'domcontentloaded', timeout: 240000 }); };
const untilQuote = async (finish, expected, what) => {
  const deadline = Date.now() + 90000; let actual;
  do { actual = await finishQuantities(finish); if (JSON.stringify(actual) === JSON.stringify(expected)) return actual; await delay(500); } while (Date.now() < deadline);
  assert.deepEqual(actual, expected, what); return actual;
};
const text = quantities => Object.fromEntries(Object.entries(quantities).map(([label, quantity]) => [label, quantity === '' ? '' : String(quantity)]));
// The schedule row for a cabinet item, by its visible name.
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

try {
  page = await browser.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('response', response => { if (response.status() >= 400) report.console.push(`http ${response.status()}: ${response.url().replace(origin, '').slice(0, 140)}`); });
  page.on('console', message => { const line = message.text(); if (message.type() === 'error' || /cabinetry|selection|save/i.test(line)) report.console.push(`${message.type()}: ${line.slice(0, 300)}`); });
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: owner });

  // 1. Open a job with no cabinetry selected: the quote's cabinetry quantities are blank.
  await openPage('quotation');
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  await dismiss(); await waitForQuote();
  assert.equal(await populatedCount(), 0, 'no cabinetry quantity before anything is scheduled');
  assert.equal(await page.$$eval('[data-quote-section]', sections => sections.map(section => section.dataset.quoteSection).filter(name => /CABINET|BENCHTOP|WARDROB/i.test(name)).join(',')), 'CABINETRY');

  // 2. Client Selections: Kitchen opens on Cabinet Schedule, canonical items only. Enter the
  //    quantities exactly as a user does - no Save Progress, no confirm, finish left on its default.
  await openKitchenCabinetry();
  const menu = await page.$eval('[data-testid="cabinetry-progress-menu"]', element => [...element.querySelectorAll('button')].map(button => button.innerText.trim()));
  assert.deepEqual(menu, ['1. Cabinet Schedule', '2. Doors & Panels', '3. Colours & Finishes', '4. Benchtops', '5. Handles', '6. Features', '7. Review & Confirm']);
  await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
  const body = await page.$eval('.cabinetryWorkflow', element => element.innerText);
  assert(!/Previously scheduled|Requires classification|Scope/i.test(body), 'no legacy section, migration text or Scope step');
  for (const group of ['cabinet-schedule-base', 'cabinet-schedule-overhead', 'cabinet-schedule-tall']) assert(await page.$(`[data-testid="${group}"]`), group);
  for (const [label, quantity] of Object.entries(WANT)) {
    const field = await page.evaluateHandle(`${scheduleRow(label)}.querySelector('input[type="number"]')`);
    await field.click({ clickCount: 3 }); await field.type(String(quantity)); await delay(250);
  }
  const shown = async () => page.evaluate(labels => Object.fromEntries(labels.map(label => { const row = [...document.querySelectorAll('.cabinetrySelectionRow')].find(item => item.querySelector('strong')?.textContent.trim() === label); return [label, row?.querySelector('input[type="number"]')?.value ?? 'ROW MISSING']; })), Object.keys(WANT));
  assert.deepEqual(await shown(), text(WANT), 'the schedule holds the entered quantities');
  await untilStored('nine scheduled quantities', stored => kitchenSchedule(stored).length === 9 && stored.quoted.length === 9);
  assert(await page.$('[data-testid="cabinet-schedule-base"]'), 'the automatic save leaves the user on the Cabinet Schedule');
  await page.screenshot({ path: path.join(out, '1-cabinet-schedule.png'), fullPage: true });

  // The Quotation Builder now carries them on the matching Standard Colourboard rows.
  await openPage('quotation'); await waitForQuote();
  report.steps.currentJob = await untilQuote('standard_colourboard', text(WANT), 'scheduled quantities reach the quote');
  assert.equal(await populatedCount(), 9, 'only the nine scheduled rows carry a quantity');
  for (const finish of ['premium_laminate', 'two_pack', 'shaker_style', 'vinyl_wrap']) assert.deepEqual(await finishQuantities(finish), text(Object.fromEntries(Object.keys(WANT).map(label => [label, '']))), `${finish} rows stay blank`);
  report.steps.selectionColumn = (await quoteRows())[keyOf('Corner base cabinet', 'standard_colourboard')].text;
  assert.match(report.steps.selectionColumn, /Kitchen · Standard Colourboard · From Client Selections/);
  await page.screenshot({ path: path.join(out, '2-quote-after-schedule.png') });

  // Revisit Client Selections: the schedule is as entered.
  await openKitchenCabinetry(); await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
  assert.deepEqual(await shown(), text(WANT), 'the schedule shows the saved quantities on return');

  // 3. Change a quantity (Corner base 2 -> 3) and untick an item (Microwave). No Save Progress.
  const quantityInput = await page.evaluateHandle(`${scheduleRow('Corner base cabinet')}.querySelector('input[type="number"]')`);
  await quantityInput.click({ clickCount: 3 }); await quantityInput.type('3');
  await page.evaluate(`${scheduleRow('Microwave cabinet')}.querySelector('input[type="checkbox"]').click()`);
  await untilStored('quantity change and untick', stored => kitchenSchedule(stored).includes('Corner base cabinet=3') && !kitchenSchedule(stored).some(line => line.startsWith('Microwave')));
  assert(await page.$('[data-testid="cabinet-schedule-base"]'), 'still on the Cabinet Schedule after the automatic save');
  // 4. Change the room finish to 2 Pack in Doors & Panels.
  await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-progress-menu"] button')].find(button => /Doors & Panels/.test(button.innerText)).click());
  await page.waitForSelector('[data-testid="cabinetry-material-stage"]');
  await page.evaluate(`${scheduleRow('Two-pack painted')}.querySelector('input[type="checkbox"]').click()`);
  report.steps.storedAfterEdits = await untilStored('finish change', stored => (stored.clientSelectionsBook[0]?.material || []).includes('Kitchen:Two-pack painted') && stored.quoted.every(line => line.startsWith('2 PACK')));
  assert(await page.$('[data-testid="cabinetry-material-stage"]'), 'still on Doors & Panels after the automatic save');
  await page.screenshot({ path: path.join(out, '3-doors-and-panels.png'), fullPage: true });

  // 5. Back in the Quotation Builder: quantities are on the 2 Pack rows, Standard Colourboard is clear.
  await openPage('quotation'); await waitForQuote();
  const after = { ...WANT, 'Corner base cabinet': 3, 'Microwave cabinet': '' };
  report.steps.afterEdits = await untilQuote('two_pack', text(after), 'quantity change, untick and finish change reach the quote');
  assert.deepEqual(await finishQuantities('standard_colourboard'), text(Object.fromEntries(Object.keys(WANT).map(label => [label, '']))), 'old finish rows are cleared');
  assert.equal(await populatedCount(), 8);
  await page.screenshot({ path: path.join(out, '4-quote-after-edits.png') });

  // 6. Save, hard refresh, reopen the quote.
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Save Job' && !button.disabled)?.click());
  await delay(10000);
  await page.setCacheEnabled(false);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 240000 }); await waitForQuote();
  report.steps.afterReload = await untilQuote('two_pack', text(after), 'quantities survive save and hard refresh');
  assert.equal(await populatedCount(), 8);
  assert.equal(await page.$$eval('tr[data-cabinetry-import-key]', rows => new Set(rows.map(row => row.dataset.cabinetryImportKey)).size), 657, 'no duplicate rows');
  // 7. Revisit Client Selections: the schedule still agrees with the quote.
  await openKitchenCabinetry(); await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
  assert.equal(await page.evaluate(`${scheduleRow('Corner base cabinet')}.querySelector('input[type="number"]').value`), '3');
  assert.equal(await page.evaluate(`${scheduleRow('Microwave cabinet')}.querySelector('input[type="checkbox"]').checked`), false);
  assert.equal(report.runtimeErrors.length, 0, report.runtimeErrors.join('\n'));
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); report.stored = await storedCabinetry().catch(failure => String(failure)); } }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); report.console = report.console.slice(-40); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
