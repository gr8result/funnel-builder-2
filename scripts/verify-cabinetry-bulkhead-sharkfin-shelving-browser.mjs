// Browser verification of MDF bulkhead LM, Sharkfin handle upgrade quantities and open shelving
// sizes against a COPY of a saved job. The copy is opened in an isolated headless browser profile
// under a new job id; the original job is never opened and cloud writes are blocked.
// Needs the dev server (default http://localhost:3000).
//
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-cabinetry-bulkhead-sharkfin-shelving-browser.mjs <job.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-artifacts/cabinetry-bulkhead-sharkfin-shelving'); fs.mkdirSync(out, { recursive: true });
const jobFile = process.argv[2];
assert(jobFile && fs.existsSync(jobFile), 'Pass the saved job JSON to verify.');
const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const projectId = `local-cabinetry-extras-${Date.now()}`;
const { projectEstimateBuilder, ...kept } = saved.workbook;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Cabinetry extras verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Cabinetry extras verification copy' } };
const fixture = path.join(out, 'job-copy.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Cabinetry extras verification copy', workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, defaultViewport: { width: 1920, height: 1300 } });

const report = { job: saved.name || saved.workbook.jobName, revision: saved.revision, steps: {}, runtimeErrors: [], blockedCloudWrites: 0 };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
const shot = name => page.screenshot({ path: path.join(out, `${name}.png`) }).catch(() => {});
const step = async (name, run) => { try { report.steps[name] = await run(); } catch (error) { report.steps[name] = { error: String(error.message).slice(0, 500) }; await shot(`failed-${name}`); } };
const dismiss = async () => { for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); } };
const stored = () => page.evaluate(async key => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record) continue;
      const w = record.workbook;
      const selection = (w.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).map(row => row.guidedSelection?.cabinetrySelection).find(Boolean) || {};
      const pick = /bulkhead|Sharkfin|shelving|shelf/i;
      return { revision: record.revision,
        quote: (w.quotation?.CABINETRY?.rows || []).filter(row => pick.test(row.item || '') && row.quantity !== '' && row.quantity != null).map(row => ({ room: row.room, range: row.range, item: row.item, unit: row.unit, quantity: row.quantity, rate: row.clientRate ?? row.rate ?? row.price ?? null, spec: row.selectionSpec || '' })),
        review: (w.cabinetryReconciliation?.entries || []).filter(entry => /bulkhead|sharkfin|open_shelf/.test(entry.type)).map(entry => ({ room: entry.room, label: entry.label, quantity: entry.quantity, outcome: entry.outcome, flag: entry.flag, reason: entry.reason, basis: entry.basis || '' })),
        schedule: (selection.schedule || []).filter(line => /bulkhead|sharkfin|open_shelf/.test(line.cabinetTypeId || '')).map(line => ({ location: line.location, type: line.cabinetTypeId, quantity: line.quantity, runs: line.runs, shelfUnit: line.shelfUnit, quantityOverride: line.quantityOverride })),
        boq: (selection.boqLines || []).filter(line => /bulkhead|sharkfin|open_shelf/.test(line.cabinetTypeId || '')).map(line => ({ item: line.itemName, quantity: line.quantity, unit: line.unit })) };
    } finally { db.close(); }
  }
  return null;
}, `job:${projectId}`);
const untilStored = async (what, test) => { const started = Date.now(); let value; do { value = await stored().catch(() => null); if (value && test(value)) return value; await delay(800); } while (Date.now() - started < 120000); throw new Error(`The automatic save did not reach the job: ${what}. Last: ${JSON.stringify(value?.quote || null).slice(0, 300)}`); };
const rowOf = id => `label.cabinetrySelectionRow[data-cabinet-item="${id}"]`;
const type = async (selector, value) => { await page.$eval(selector, (el, next) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(next)); el.dispatchEvent(new Event('input', { bubbles: true })); }, value); await delay(350); };
const openCabinetryRoom = async slug => {
  if (!(await page.$('[data-testid="cabinetry-room-landing"]'))) {
    await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]'), { timeout: 300000 });
    if (await page.$('[data-testid="guided-client-selections-home"]')) await page.$eval('[data-requirement-key="interior"]', element => element.click());
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
    await page.$eval('[data-requirement-key="cabinetry"]', element => element.click());
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  }
  await page.evaluate(id => (document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`)).click(), `cabinetry-room-${slug}`);
  await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
  await page.evaluate(() => [...document.querySelectorAll('[data-testid="cabinetry-progress-menu"] button')].find(button => /Cabinet Schedule/.test(button.innerText))?.click());
  await page.waitForSelector('.cabinetrySelectionRow');
  await delay(800);
};

try {
  page = await browser.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message.slice(0, 300))); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: workbook.workspaceId });

  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  await dismiss();
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  await delay(5000);

  // -- 1. The job as saved, after the automatic recalculation -------------------------------------
  await step('asOpened', async () => { const value = await untilStored('the job copy', found => found.review.length > 0); return { quote: value.quote, review: value.review, schedule: value.schedule }; });

  // -- 2. Kitchen Cabinet Schedule -------------------------------------------------------------------
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find(element => element.innerText.trim() === 'Client Selections')?.click());
  const ready = await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"], [data-testid="cabinetry-room-landing"]'), { timeout: 120000 }).then(() => true, () => false);
  if (!ready) await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(projectId)}&page=clientSelections`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await openCabinetryRoom('kitchen');
  await step('kitchenScreen', async () => {
    await page.$eval(rowOf('bulkhead_300'), el => el.scrollIntoView({ block: 'center' })); await delay(400); await shot('1-kitchen-extras-as-saved');
    return page.evaluate(() => ({ bulkheadRow: document.querySelector('label[data-cabinet-item="bulkhead_300"]')?.innerText.replace(/\s+/g, ' ').trim(), countNotice: document.querySelector('[data-testid="bulkhead-count-notice"]')?.innerText.trim() || '',
      bulkheadTotal: document.querySelector('[data-testid="bulkhead-total"]')?.innerText.trim(), sharkfinRow: document.querySelector('label[data-cabinet-item="handle_upgrade_sharkfin"]')?.innerText.replace(/\s+/g, ' ').trim(),
      sharkfinQuantity: document.querySelector('[data-testid="sharkfin-quantity"]')?.innerText.trim(), counted: [...document.querySelectorAll('[data-testid="sharkfin-counted"] li')].map(li => li.innerText.trim()), excluded: document.querySelector('[data-testid="sharkfin-excluded"]')?.innerText.trim() || '',
      plainQtyInputs: ['bulkhead_300', 'handle_upgrade_sharkfin', 'open_shelf'].filter(id => document.querySelector(`label[data-cabinet-item="${id}"] .cabinetrySelectionQuantity`)), fontPx: parseFloat(getComputedStyle(document.querySelector('[data-testid="bulkhead-runs"] p, [data-testid="bulkhead-runs"] span')).fontSize) }));
  });
  await step('bulkheadRuns', async () => {
    // Two runs typed in mm: 2400 above the overheads and 1250 above the fridge = 3.65 LM.
    await type('[data-testid="bulkhead-runs"] [data-testid="bulkhead-run"]:nth-of-type(1) input[type=number]', 2400);
    await page.click('[data-testid="bulkhead-add-run"]'); await delay(600);
    const lengths = await page.$$('[data-testid="bulkhead-run-length"]');
    await lengths[lengths.length - 1].evaluate(el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '1250'); el.dispatchEvent(new Event('input', { bubbles: true })); }); await delay(700);
    await shot('2-kitchen-bulkhead-runs');
    return page.evaluate(() => ({ total: document.querySelector('[data-testid="bulkhead-total"]')?.innerText.trim(), row: document.querySelector('label[data-cabinet-item="bulkhead_300"]')?.innerText.replace(/\s+/g, ' ').trim(), runs: document.querySelectorAll('[data-testid="bulkhead-run"]').length }));
  });
  await step('openShelving', async () => {
    await page.$eval(rowOf('open_shelf'), el => { el.scrollIntoView({ block: 'center' }); el.querySelector('input[type=checkbox]').click(); }); await delay(900);
    await page.click('[data-testid="open-shelf-add-low_wide"]'); await delay(900);
    const units = await page.$$('[data-testid="open-shelf-unit"]');
    await units[units.length - 1].$eval('[data-testid="open-shelf-shelves"]', el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2'); el.dispatchEvent(new Event('input', { bubbles: true })); }); await delay(700);
    await shot('3-kitchen-open-shelving');
    return page.evaluate(() => ({ row: document.querySelector('label[data-cabinet-item="open_shelf"]')?.innerText.replace(/\s+/g, ' ').trim(), units: [...document.querySelectorAll('[data-testid="open-shelf-unit"] > strong')].map(el => el.innerText.trim()), sizes: [...document.querySelectorAll('[data-testid="open-shelf-size"]')][0] ? [...document.querySelectorAll('[data-testid="open-shelf-size"]')[0].options].map(option => option.textContent.trim()) : [] }));
  });
  // -- 3. The quotation follows, in the saved job --------------------------------------------------
  await step('afterEdits', async () => {
    const value = await untilStored('the bulkhead runs', found => found.quote.some(row => /bulkhead/i.test(row.item) && row.room === 'KITCHEN CABINETRY' && Number(row.quantity) === 3.65));
    return { quote: value.quote, review: value.review, schedule: value.schedule, boq: value.boq };
  });
  // -- 4. Manual Sharkfin quantity, then back to calculated ---------------------------------------
  await step('sharkfinOverride', async () => {
    await page.$eval(rowOf('handle_upgrade_sharkfin'), el => el.scrollIntoView({ block: 'center' }));
    await type('[data-testid="sharkfin-override"]', 22);
    const manualText = await page.$eval('[data-testid="sharkfin-quantity"]', el => el.innerText.trim());
    const manual = await untilStored('the manual Sharkfin quantity', found => found.quote.some(row => /Sharkfin/.test(row.item) && row.room === 'KITCHEN CABINETRY' && Number(row.quantity) === 22));
    await page.click('[data-testid="sharkfin-automatic"]'); await delay(600);
    const automatic = await untilStored('the calculated Sharkfin quantity', found => found.quote.some(row => /Sharkfin/.test(row.item) && row.room === 'KITCHEN CABINETRY' && Number(row.quantity) !== 22));
    return { manualText, manualQuote: manual.quote.filter(row => /Sharkfin/.test(row.item)).map(row => `${row.room} ${row.quantity}`), automaticQuote: automatic.quote.filter(row => /Sharkfin/.test(row.item)).map(row => `${row.room} ${row.quantity}`) };
  });
  // -- 5. Quotation Builder: what is drawn -------------------------------------------------------
  await step('quotation', async () => {
    await page.evaluate(() => [...document.querySelectorAll('button, a')].find(element => /^(Quotation|Quotation Builder|Quote)$/.test(element.innerText.trim()))?.click());
    const shown = await page.waitForFunction(() => document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label]').length > 5, { timeout: 60000 }).then(() => true, () => false);
    if (!shown) { await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(projectId)}&page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 }); await page.waitForFunction(() => document.querySelectorAll('[data-quote-section="CABINETRY"] tr[data-subgroup-label]').length > 5, { timeout: 300000 }); }
    await delay(3000);
    await page.$eval('[data-testid="cabinetry-review-toggle"]', el => { el.scrollIntoView({ block: 'center' }); el.click(); }); await delay(900);
    await shot('4-quotation-cabinetry-review');
    return page.evaluate(() => ({ summary: (document.querySelector('[data-testid="cabinetry-reconciliation"]')?.firstElementChild?.innerText || '').replace(/\s+/g, ' ').trim(),
      review: [...document.querySelectorAll('[data-testid="cabinetry-review-panel"] tbody tr')].map(row => row.innerText.replace(/\s+/g, ' ').trim()).filter(text => /bulkhead|sharkfin|shelving/i.test(text)).map(text => text.slice(0, 260)) }));
  });
  report.passed = !Object.values(report.steps).some(value => value?.error) && report.runtimeErrors.length === 0;
} catch (error) { report.error = String(error.stack).slice(0, 1500); if (page) await shot('failure'); }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 1)); await browser.close(); }
if (!report.passed) process.exitCode = 1;
