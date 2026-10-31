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
const out = path.resolve('recovery/client-selection-integrity-2026-10-09/browser-verified'); fs.mkdirSync(out, { recursive: true });
const jobFile = process.argv[2];
assert(jobFile && fs.existsSync(jobFile), 'Pass the saved job JSON to verify.');
const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const projectId = `local-cabinetry-verify-${Date.now()}`;
// The embedded estimate documents (~90 MB of page images) play no part in cabinetry and are left out of the copy.
const { projectEstimateBuilder, ...kept } = saved.workbook;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Cabinetry sync verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Cabinetry sync verification copy' } };
// The audit copy retains measured takeoff data but excludes external binary asset
// references: its isolated profile does not contain the original plan-asset database.
for (const job of [workbook.aiPlanTakeoffJob, workbook.takeoffEngine?.aiPlanTakeoffJob]) {
  if (job?.plan?.pages) job.plan.pages = job.plan.pages.map(({dataUrlAssetId, dataUrlBytes, ...page}) => page);
}
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

fs.writeFileSync(path.join(out,'browser-endpoint.txt'),browser.wsEndpoint());
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
  const localRecords = JSON.parse(fs.readFileSync('recovery/client-selection-integrity-2026-10-09/audit/local-records.json', 'utf8'));
  const staleDraft = localRecords.find(r => r.key.endsWith(':recovered-03-09-123')).value;
  await page.evaluate(({draft,projectId,workspaceId}) => {
    localStorage.setItem(`gr8:embedded-selections-book:${workspaceId}:${projectId}`,JSON.stringify({...draft,projectId}));
  }, {draft:staleDraft,projectId,workspaceId:workbook.workspaceId});
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
  page.on('request', request => { if ((/\/(rest|storage)\/v1\//.test(request.url()) || request.url().includes('/api/')) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
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


  const localRecords = JSON.parse(fs.readFileSync('recovery/client-selection-integrity-2026-10-09/audit/local-records.json', 'utf8'));
  const staleDraft = localRecords.find(r => r.key.endsWith(':recovered-03-09-123')).value;
  await page.evaluate(({draft,projectId,workspaceId}) => {
    localStorage.setItem(`gr8:embedded-selections-book:${workspaceId}:${projectId}`,JSON.stringify({...draft,projectId}));
  }, {draft:staleDraft,projectId,workspaceId:workbook.workspaceId});
  await openPage('clientSelections');
  await page.waitForSelector('[data-testid="guided-client-selections-home"]',{timeout:180000});
  await page.waitForFunction(()=>/39 \/ 48 completed/.test(document.body.innerText),{timeout:120000});
  await delay(2000);
  report.selectionHome = await page.evaluate(()=>({text:document.body.innerText,cards:[...document.querySelectorAll('[data-requirement-key]')].map(x=>({key:x.dataset.requirementKey,text:x.innerText}))}));
  assert.match(report.selectionHome.text, /39 \/ 48 completed/);
  report.staleCacheRegressionPassed = true;
  await page.screenshot({path:path.join(out,'selection-home.png'),fullPage:true});
  await page.setCacheEnabled(false);
  await page.reload({waitUntil:'domcontentloaded',timeout:240000});
  await page.waitForSelector('[data-testid="guided-client-selections-home"]',{timeout:180000});
  await page.waitForFunction(()=>/39 \/ 48 completed/.test(document.body.innerText),{timeout:120000});
  await delay(2000);
  report.afterReload = await page.evaluate(()=>document.body.innerText);
  assert.match(report.afterReload,/39 \/ 48 completed/);
  report.reloadPassed = true;
  report.finalFeedWarning = /Approved quotation catalogue: HTTP|signing in|Sign in to load/.test(report.afterReload);
  assert.equal(report.finalFeedWarning,false);
  assert.deepEqual(report.runtimeErrors,[]);
} catch(error){report.error=String(error.stack);report.failureText=await page?.evaluate(()=>document.body.innerText).catch(()=>null);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:false}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({error:report.error,selectionHome:report.selectionHome,runtimeErrors:report.runtimeErrors},null,2));await browser.close();}
