// Browser verification of the cabinetry sync against a COPY of a saved job.
// The copy is opened in an isolated headless browser profile under a new job id; the original job
// is never opened and cloud writes are blocked. Needs the dev server (default http://localhost:3000).
//
//   1. AS SAVED   - every source requirement vs the Qty actually drawn in the Quotation Builder.
//   2. EXTENDED   - on the copy only: Laundry and two more bathroom rooms are scheduled in Client
//                   Selections and wardrobes are entered by room, then compared with the quote.
//   3. SAVE / HARD REFRESH / REOPEN - the drawn quantities are unchanged.
//
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-cabinetry-sync-job-browser.mjs <job.json>
// <job.json> is a saved job record ({ workbook }) or .gr8job-style file ({ projectId, workbook }).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { FINAL_CABINETRY as source } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { planCabinetryQuotation, migrateWorkbookCabinetSchedules, CABINETRY_MATCHED } from '../lib/construction-estimation/cabinetryRequirements.js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-artifacts/cabinetry-sync-job-verification'); fs.mkdirSync(out, { recursive: true });
const jobFile = process.argv[2];
assert(jobFile && fs.existsSync(jobFile), 'Pass the saved job JSON to verify.');
const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const projectId = `local-cabinetry-verify-${Date.now()}`;
// The embedded estimate documents (~90 MB of page images) play no part in cabinetry and are left out of the copy.
const { projectEstimateBuilder, ...kept } = saved.workbook;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Cabinetry sync verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Cabinetry sync verification copy' } };
const fixture = path.join(out, 'job-copy.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Cabinetry sync verification copy', workbook }));

const catalogue = new Map(source.rows.filter(row => row.type === 'product').map(row => [row.key || `final-cabinetry:${row.sourceRow}`, row]));
const describeRow = key => { const row = catalogue.get(key); return row ? `${row.room} / ${row.range} / ${row.description}` : key; };
const expectedFrom = book => { const { entries, rows } = planCabinetryQuotation(book); return { entries, rows: Object.fromEntries([...rows.values()].map(row => [row.importKey, { quantity: row.quantity, rooms: row.roomQuantities }])) }; };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, defaultViewport: { width: 1920, height: 1200 } });

const report = { job: saved.name || saved.workbook.jobName, revision: saved.revision, savedAt: saved.savedAt, phases: {}, runtimeErrors: [], blockedCloudWrites: 0 };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
const openPage = async name => { await page.goto(`${origin}/modules/estimate-builder?page=${name}`, { waitUntil: 'domcontentloaded', timeout: 240000 }); };
const waitForQuote = () => page.waitForFunction(() => document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label]').length > 5, { timeout: 300000 });
const dismiss = async () => { for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); } };
// Opens every CABINETRY area and finish group that is closed, then reads the Qty actually drawn.
const drawnQuantities = async () => {
  for (let pass = 0; pass < 4; pass += 1) {
    const clicked = await page.evaluate(() => { let n = 0; for (const row of document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label][data-subgroup-open="false"]')) { row.click(); n += 1; } return n; });
    if (!clicked) break; await delay(1500);
  }
  return page.evaluate(() => {
    const section = document.querySelector('[data-quote-section="CABINETRY"]');
    const headings = [...section.querySelectorAll('tr[data-subgroup-label]')].filter(row => Number(row.dataset.cabinetryHeadingLevel) === 1).map(row => ({ label: row.dataset.subgroupLabel, summary: row.querySelector('[data-subgroup-summary]')?.innerText.replace(/\s+/g, ' ').trim() || '' }));
    const rows = {}; let drawn = 0;
    for (const row of section.querySelectorAll('tr[data-cabinetry-import-key]')) { drawn += 1; const inputs = [...row.querySelectorAll('input')]; const qty = inputs[1]?.value ?? ''; if (qty !== '' && Number(qty) !== 0) rows[row.dataset.cabinetryImportKey] = { quantity: Number(qty), selection: inputs.map(input => input.value).find(value => /Client Selections|Inclusions|MANUAL|Fixed catalogue/.test(value)) || '' }; }
    const panel = document.querySelector('[data-testid="cabinetry-reconciliation"]');
    return { headings, rows, drawn, summary: (panel?.firstElementChild?.innerText || '').replace(/\s+/g, ' ').trim(), attention: Number(panel?.dataset.cabinetryAttention || 0),
      debugBox: Boolean(document.querySelector('[data-testid="cabinetry-unmatched"]')), internalWording: /previous cabinet list|ambiguous: more than one/i.test(document.body.innerText), picker: Boolean(document.querySelector('[data-testid="cabinetry-replacement-picker"]')) };
  });
};
const compare = (expected, drawn) => {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(drawn)])];
  return keys.map(key => ({ row: describeRow(key), source: expected[key]?.quantity ?? '', quote: drawn[key]?.quantity ?? '', rooms: expected[key]?.rooms || {}, selection: drawn[key]?.selection || '', ok: (expected[key]?.quantity ?? '') === (drawn[key]?.quantity ?? '') }));
};
const storedBook = () => page.evaluate(async key => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record) continue;
      const w = record.workbook;
      return { revision: record.revision, workbook: { workspaceId: w.workspaceId, clientSelectionsBook: w.clientSelectionsBook, cabinetryRequirements: w.cabinetryRequirements, jobInclusionSnapshot: w.jobInclusionSnapshot, jobInclusionScheduleName: w.jobInclusionScheduleName, data: { cabinetryRequirements: w.data?.cabinetryRequirements } },
        quoted: Object.fromEntries((w.quotation?.CABINETRY?.rows || []).filter(row => row.quantity !== '' && row.quantity != null).map(row => [row.importKey, row.quantity])) };
    } finally { db.close(); }
  }
  return null;
}, `job:${projectId}`);
const scheduleOf = stored => (stored?.workbook.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).map(row => row.guidedSelection?.cabinetrySelection).find(Boolean)?.schedule || [];
const untilStored = async (what, test) => { const started = Date.now(); let value; do { value = await storedBook().catch(() => null); if (value && test(value)) return value; await delay(700); } while (Date.now() - started < 180000); throw new Error(`The automatic save did not reach the job: ${what}`); };
const scheduleRow = label => `(() => [...document.querySelectorAll('.cabinetrySelectionRow')].find(row => row.querySelector('strong')?.textContent.trim() === ${JSON.stringify(label)}))()`;
const openCabinetryRoom = async slug => {
  await openPage('clientSelections');
  await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]'), { timeout: 300000 });
  if (await page.$('[data-testid="guided-client-selections-home"]')) await page.$eval('[data-requirement-key="interior"]', element => element.click());
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await page.$eval('[data-requirement-key="cabinetry"]', element => element.click());
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await page.evaluate(id => (document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`)).click(), `cabinetry-room-${slug}`);
  await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
  await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-progress-menu"] button')].find(button => /Cabinet Schedule/.test(button.innerText))?.click());
  await page.waitForSelector('.cabinetrySelectionRow');
};

try {
  page = await browser.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: workbook.workspaceId });

  // ---- 1. The job as saved ------------------------------------------------------------------
  await openPage('quotation');
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  await dismiss(); await waitForQuote(); await delay(4000);
  const expected = expectedFrom(migrateWorkbookCabinetSchedules(workbook));
  const asSaved = await drawnQuantities();
  await page.screenshot({ path: path.join(out, '1-as-saved.png'), fullPage: false });
  // The Review panel lists what needs attention, each with its action.
  await page.$eval('[data-testid="cabinetry-review-toggle"]', element => element.click()); await delay(800);
  const review = await page.$$eval('[data-testid="cabinetry-review-panel"] tbody tr', rows => rows.map(row => ({ outcome: row.dataset.cabinetryOutcome, cells: [...row.querySelectorAll('td')].map(cell => cell.innerText.replace(/\s+/g, ' ').trim()) })));
  await page.screenshot({ path: path.join(out, '1b-review-panel.png'), fullPage: false });
  report.phases.asSaved = { areas: asSaved.headings, rowsDrawn: asSaved.drawn, reconciliation: asSaved.summary, review, debugBox: asSaved.debugBox, internalWording: asSaved.internalWording, picker: asSaved.picker, comparison: compare(expected.rows, asSaved.rows),
    requirements: expected.entries.map(entry => ({ room: entry.room, type: entry.type || entry.label, size: entry.dimensions, qty: entry.quantity, finish: entry.selectedFinish, matchedRow: entry.matchedQuoteRow, quoteQty: entry.matchedImportKey ? asSaved.rows[entry.matchedImportKey]?.quantity ?? '' : '', status: entry.status === CABINETRY_MATCHED ? 'MATCHED' : 'UNMATCHED', reason: entry.reason })) };
  report.phases.asSaved.pass = report.phases.asSaved.comparison.every(item => item.ok);
  report.phases.asSaved.attentionShown = asSaved.attention === expected.entries.filter(entry => entry.status !== CABINETRY_MATCHED).length && review.length === asSaved.attention && review.every(row => row.cells[6] && row.cells[7]);
  report.phases.asSaved.compactUi = !asSaved.debugBox && !asSaved.internalWording && !asSaved.picker;

  // ---- 2. Live edits on the copy -------------------------------------------------------------
  // One-time classification of a cabinet saved before it had an exact item (Laundry).
  await page.select('select[aria-label="Choose the cabinet for Standard base unit in Laundry"]', 'base_unit_1200_2door');
  await page.evaluate(() => [...document.querySelector('select[aria-label="Choose the cabinet for Standard base unit in Laundry"]').parentElement.querySelectorAll('button')].find(button => button.innerText.trim() === 'Apply').click());
  await delay(1500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Save Job' && !button.disabled)?.click());
  await untilStored('Laundry classification', stored => scheduleOf(stored).some(line => line.location === 'Laundry' && line.cabinetTypeId === 'base_unit_1200_2door'));
  // Kitchen: a quantity change and a finish change.
  await openCabinetryRoom('kitchen');
  const corner = await page.evaluateHandle(`${scheduleRow('Corner base cabinet')}.querySelector('input[type="number"]')`);
  await corner.click({ clickCount: 3 }); await corner.type('3');
  await untilStored('Kitchen quantity', stored => scheduleOf(stored).some(line => line.location === 'Kitchen' && line.cabinetTypeId === 'corner_base' && line.quantity === 3));
  await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-progress-menu"] button')].find(button => /Doors & Panels/.test(button.innerText)).click());
  await page.waitForSelector('[data-testid="cabinetry-material-stage"]');
  await page.evaluate(`${scheduleRow('Two-pack painted')}.querySelector('input[type="checkbox"]').click()`);
  await untilStored('Kitchen finish', stored => Object.keys(stored.quoted).some(key => /KITCHEN CABINETRY \/ 2 PACK/.test(describeRow(key))));
  // Laundry items.
  await openCabinetryRoom('laundry');
  for (const [label, quantity] of [['Laundry sink cabinet', 1], ['Overhead cabinet - 2 door - standard height', 2]]) {
    const field = await page.evaluateHandle(`${scheduleRow(label)}.querySelector('input[type="number"]')`);
    await field.click({ clickCount: 3 }); await field.type(String(quantity)); await delay(300);
  }
  await untilStored('Laundry schedule', stored => {
    const laundry = scheduleOf(stored).filter(line => line.location === 'Laundry');
    return laundry.some(line => line.cabinetTypeId === 'sink_base' && line.quantity === 1)
      && laundry.some(line => line.cabinetTypeId === 'overhead_2door_standard' && line.quantity === 2);
  });
  await page.screenshot({ path: path.join(out, '2-laundry-schedule.png'), fullPage: true });
  // Bathroom rooms: each schedules its own vanity from the same canonical list; the tick alone saves.
  report.phases.bathroomScheduleOffered = {};
  for (const [slug, room, label] of [['ensuite', 'Ensuite', 'Wall hung vanity - 2 door - 1200mm'], ['powder-room', 'Powder Room', 'Wall hung vanity - 2 door - 1200mm']]) {
    await openCabinetryRoom(slug);
    report.phases.bathroomScheduleOffered[room] = await page.$$eval('.cabinetrySelectionRow strong', items => items.map(item => item.textContent.trim()));
    await page.evaluate(`${scheduleRow(label)}.querySelector('input[type="checkbox"]').click()`);
    await untilStored(`${room} vanity`, stored => scheduleOf(stored).some(line => line.location === room && line.cabinetTypeId === 'vanity_wallhung_2door_1200' && line.quantity > 0));
  }
  await page.screenshot({ path: path.join(out, '3-bathroom-schedule.png'), fullPage: true });

  await openPage('quotation'); await waitForQuote(); await delay(3000);
  // Wardrobes are entered by room in the Review panel.
  await page.$eval('[data-testid="cabinetry-review-toggle"]', element => element.click()); await delay(800);
  const rooms = await page.$$eval('select[aria-label="Cabinetry requirement room"] option', options => options.map(option => option.value));
  report.phases.wardrobeRoomsOffered = rooms;
  const wardrobeRooms = [rooms.find(name => /bed(room)? ?1/i.test(name)), rooms.find(name => /bed(room)? ?2/i.test(name))].filter(Boolean);
  assert(wardrobeRooms.length === 2, `Bedroom rooms are offered for wardrobes: ${rooms.join(', ')}`);
  for (const [room, type, quantity] of [[wardrobeRooms[0], 'wardrobe_hanging_double_900_1200', 2], [wardrobeRooms[1], 'wardrobe_hanging_double_900_1200', 1], [wardrobeRooms[0], 'wardrobe_drawers_4', 1]]) {
    await page.select('select[aria-label="Cabinetry requirement room"]', room);
    await page.select('select[aria-label="Cabinetry requirement type"]', type);
    const field = await page.$('input[aria-label="Cabinetry requirement quantity"]'); await field.click({ clickCount: 3 }); await field.type(String(quantity));
    await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-review-panel"] button')].find(button => button.innerText.trim() === 'Add requirement').click());
    await delay(1500);
  }
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Save Job' && !button.disabled)?.click());
  const stored = await untilStored('wardrobe requirements', value => (value.workbook.cabinetryRequirements?.items || []).length === 3);
  const extendedExpected = expectedFrom(stored.workbook);
  // The saved job and the screen are checked separately, so a stale screen cannot hide behind a good save.
  report.phases.extendedSaved = { comparison: compare(extendedExpected.rows, Object.fromEntries(Object.entries(stored.quoted).map(([key, quantity]) => [key, { quantity: Number(quantity) }]))) };
  report.phases.extendedSaved.pass = report.phases.extendedSaved.comparison.every(item => item.ok);
  let extended = await drawnQuantities();
  for (let attempt = 0; attempt < 10 && !compare(extendedExpected.rows, extended.rows).every(item => item.ok); attempt += 1) { await delay(2000); extended = await drawnQuantities(); report.phases.screenSettledAfterSeconds = (attempt + 1) * 2; }
  await page.screenshot({ path: path.join(out, '4-quote-extended.png'), fullPage: false });
  report.phases.extended = { areas: extended.headings, reconciliation: extended.summary, attention: extended.attention, comparison: compare(extendedExpected.rows, extended.rows),
    remaining: extendedExpected.entries.filter(entry => entry.status !== CABINETRY_MATCHED).map(entry => `${entry.room} | ${entry.label} | ${entry.reason}`) };
  report.phases.extended.pass = report.phases.extended.comparison.every(item => item.ok);

  // ---- 3. Save, hard refresh, reopen --------------------------------------------------------
  await delay(8000);
  await page.setCacheEnabled(false);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 300000 }); await waitForQuote(); await delay(5000);
  const reloaded = await drawnQuantities();
  await page.screenshot({ path: path.join(out, '5-after-reload.png'), fullPage: false });
  report.phases.reload = { comparison: compare(extendedExpected.rows, reloaded.rows), sameAsBefore: JSON.stringify(Object.fromEntries(Object.entries(reloaded.rows).map(([key, row]) => [key, row.quantity]))) === JSON.stringify(Object.fromEntries(Object.entries(extended.rows).map(([key, row]) => [key, row.quantity]))) };
  report.phases.reload.pass = report.phases.reload.sameAsBefore && report.phases.reload.comparison.every(item => item.ok);
  // Navigate away (Client Selections) and return.
  await openPage('clientSelections'); await delay(6000);
  await openPage('quotation'); await waitForQuote(); await delay(5000);
  const returned = await drawnQuantities();
  report.phases.navigateAwayAndBack = { comparison: compare(extendedExpected.rows, returned.rows) };
  report.phases.navigateAwayAndBack.pass = report.phases.navigateAwayAndBack.comparison.every(item => item.ok);
  report.passed = report.phases.asSaved.pass && report.phases.asSaved.attentionShown && report.phases.asSaved.compactUi && report.phases.extendedSaved.pass && report.phases.extended.pass && report.phases.reload.pass && report.phases.navigateAwayAndBack.pass && report.runtimeErrors.length === 0;
} catch (error) { report.error = String(error.stack).slice(0, 1500); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 1)); await browser.close(); }
if (!report.passed) process.exitCode = 1;
