// Browser verification of automatic room levels against an ISOLATED COPY of a .gr8job.
// The copy gets a new project id and is opened in a fresh headless Chrome profile with cloud writes blocked;
// the original file is only read (its SHA-256 is compared before and after). Needs the dev server (default :3000).
//
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-room-levels-browser.mjs "<job.gr8job>"
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const source = process.argv[2];
assert(source && fs.existsSync(source), 'Pass the .gr8job file.');
const out = path.resolve('artifacts/test-artifacts/room-levels-verification'); fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(out, 'saved-job.json'), { force: true });
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHash = sha(source);

const zip = await JSZip.loadAsync(fs.readFileSync(source));
const estimate = JSON.parse(await zip.file('estimate.json').async('string'));
const { projectEstimateBuilder, ...kept } = estimate.workbook;
const projectId = `local-room-levels-${Date.now()}`;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Room levels verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Room levels verification copy' } };
for (const job of [workbook.aiPlanTakeoffJob, workbook.takeoffEngine?.aiPlanTakeoffJob]) if (job?.plan?.pages) job.plan.pages = job.plan.pages.map(({ dataUrlAssetId, dataUrlBytes, ...page }) => page);
const bookWithoutModel = (book) => JSON.stringify(book?.rooms || []);
const beforeBook = bookWithoutModel(workbook.clientSelectionsBook);
const beforeSelections = JSON.stringify((workbook.clientSelectionsBook?.rooms || []).flatMap((room) => (room.rows || []).map((row) => [room.id, row.id, row.guidedRequirementKey || row.guidedSelection?.requirementKey || '', JSON.stringify(row.guidedSelection || null).length])));
const fixture = path.join(out, 'job-copy.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Room levels verification copy', workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Supabase environment values are required for the test account.');
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, defaultViewport: { width: 1600, height: 1200 } });

const report = { source: path.basename(source), originalSha256: originalHash, projectId, steps: {}, runtimeErrors: [], blockedCloudWrites: 0 };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const consoleLines = [];
let page;
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) }).catch(() => {});
const dismiss = async () => { for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find((b) => !b.disabled && b.innerText.trim() === text)?.click(); }); } };
const upload = async (file) => { const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(file); await dismiss(); };
const goSelections = async () => {
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  await delay(3000);
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find((el) => el.innerText.trim() === 'Client Selections')?.click());
};
const readRooms = () => page.$$eval('[data-testid="room-manager-room"]', (items) => items.map((li) => ({ name: li.dataset.room, id: li.dataset.roomId, level: li.dataset.level, levelSource: li.dataset.levelSource, group: li.closest('[data-testid="room-level-group"]')?.dataset.level, review: li.querySelector('[data-testid="room-level-review"]')?.innerText.replace(/\s+/g, ' ') || '', floor: li.querySelector('[data-testid="room-level"]')?.value || '' })));
const step = async (name, run) => { try { report.steps[name] = await run(); } catch (error) { report.steps[name] = { error: String(error.message).slice(0, 600), screen: await page.evaluate(() => ({ modalMessage: document.querySelector('[data-testid="room-manager-message"]')?.innerText || '', confirmText: document.querySelector('[data-testid="room-setup-confirm"]')?.innerText.replace(/\s+/g, ' ') || '', modalOpen: Boolean(document.querySelector('[data-testid="project-room-manager"]')), alerts: [...document.querySelectorAll('[role=alert], .error, [class*=error]')].map((el) => el.innerText.slice(0, 200)).slice(0, 4) })).catch(() => null) }; await shot(`failed-${name}`); } };
const savedRecord = () => page.evaluate(async (key) => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      if (record) return record;
    } finally { db.close(); }
  }
  return null;
}, `job:${projectId}`);
const modelOf = (record) => record?.workbook?.clientSelectionsBook?.projectRoomModel || record?.workbook?.projectRoomModel || null;
const scheduleText = () => page.evaluate(() => document.querySelector('[data-schedule-missing-records]')?.innerText.replace(/\s+/g, ' ') || '');

try {
  page = await browser.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (error) => report.runtimeErrors.push(error.message.slice(0, 300))); page.on('dialog', (dialog) => dialog.accept());
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) consoleLines.push(`${message.type()}: ${message.text().slice(0, 240)}`); });
  await page.setRequestInterception(true);
  page.on('request', (request) => { if ((/\/(rest|storage)\/v1\//.test(request.url()) || request.url().includes('/api/')) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; (report.blockedUrls ||= new Set()).add(`${request.method()} ${new URL(request.url()).pathname}`); void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: workbook.workspaceId });

  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await upload(fixture);
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  report.quotationSectionsBefore = await page.$$eval('[data-quote-section]', (items) => items.map((item) => item.dataset.quoteSection));
  await goSelections();

  // Schedule reconciliation before any room change (Review Schedule is outside the room gate).
  await step('scheduleBefore', async () => {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Review Schedule'), { timeout: 180000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Review Schedule')?.click());
    await page.waitForSelector('[data-schedule-missing-records]', { timeout: 180000 });
    return { text: await scheduleText() };
  });
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

  // Room Setup: automatic floors.
  let before = [];
  await step('roomSetupAutomatic', async () => {
    await page.waitForFunction(() => document.querySelector('[data-testid="project-room-manager"], [data-requirement-key="interior"]'), { timeout: 240000 });
    // Entering a category before the rooms are confirmed raises the Step 1 gate.
    if (!(await page.$('[data-testid="project-room-manager"]'))) await page.$eval('[data-requirement-key="interior"]', (el) => el.click());
    await page.waitForSelector('[data-testid="project-room-manager"]', { timeout: 240000 });
    await delay(1500); await shot('01-room-setup');
    before = await readRooms();
    const by = (name) => before.find((room) => room.name === name);
    const groups = await page.$$eval('[data-testid="room-level-group"] > h4', (items) => items.map((h) => h.innerText.replace(/\s+/g, ' ')));
    assert(before.length >= 20, `rooms listed: ${before.length}`);
    for (const name of ['Kitchen', 'Laundry', 'Garage', 'Entry', 'Family', 'Study', 'Alfresco']) assert.equal(by(name)?.level, 'ground', `${name} should be Ground Floor`);
    for (const name of ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Ensuite', 'Main Bathroom', 'Rumpus', 'Balcony']) assert.equal(by(name)?.level, 'upper', `${name} should be Upper Floor`);
    assert(before.filter((room) => room.level).every((room) => room.levelSource === 'takeoff-sheet' && room.group === room.level), 'automatic floors come from the plan sheet and are grouped by floor');
    const flagged = before.filter((room) => room.review);
    assert(flagged.length >= 1 && flagged.every((room) => !room.level && /sheet/i.test(room.review)), 'unresolved rooms are flagged with the sheet reason');
    const notFlagged = before.filter((room) => !room.level && !room.review);
    assert.equal(notFlagged.length, 0);
    return { total: before.length, automatic: before.filter((room) => room.levelSource === 'takeoff-sheet').length, groundCount: before.filter((room) => room.level === 'ground').length, upperCount: before.filter((room) => room.level === 'upper').length, flagged: flagged.map((room) => ({ name: room.name, reason: room.review })), groups, summary: await page.$eval('[data-testid="room-floor-summary"]', (el) => el.innerText) };
  });

  // The confirmation gate cannot be dismissed, and rooms on different floors cannot be merged.
  await step('gateAndCrossFloorMerge', async () => {
    await page.keyboard.press('Escape'); await delay(400);
    assert(await page.$('[data-testid="project-room-manager"]'), 'Escape must not dismiss the gate');
    assert.equal(await page.$('[data-testid="room-manager-close"]'), null, 'no close button before confirmation');
    await page.evaluate(() => document.querySelector('[data-room="Kitchen"] [data-testid="room-merge"]').click());
    await page.waitForSelector('[data-testid="room-merge-target"]');
    const options = await page.$$eval('[data-testid="room-merge-target"] option', (items) => items.filter((o) => o.value).map((o) => ({ text: o.textContent, disabled: o.disabled })));
    assert(options.find((o) => /^Bedroom 1/.test(o.text))?.disabled, 'an upper-floor room is not offered as a merge target for a ground-floor room');
    assert(!options.find((o) => /^Dining/.test(o.text))?.disabled, 'a same-floor room is still offered');
    await shot('02-merge-protection');
    await page.evaluate(() => [...document.querySelectorAll('[data-room="Kitchen"] button')].find((b) => b.innerText.trim() === 'Cancel')?.click());
    return { differentFloorDisabled: options.filter((o) => o.disabled).length, sameFloorEnabled: options.filter((o) => !o.disabled).length };
  });

  // Only the flagged room needs an answer. (Isolated copy: Ground Floor chosen to exercise the control.)
  await step('correctFlaggedRoom', async () => {
    const target = before.find((room) => room.review);
    await page.select(`[data-room="${target.name}"] [data-testid="room-level"]`, 'Ground Floor');
    await page.waitForFunction((name) => document.querySelector(`[data-room="${name}"]`)?.dataset.level === 'ground', { timeout: 60000 }, target.name);
    const rooms = await readRooms();
    assert.equal(rooms.filter((room) => room.review).length, 0, 'no room still needs a floor');
    return { room: target.name, now: rooms.find((room) => room.name === target.name).level, levelSource: rooms.find((room) => room.name === target.name).levelSource };
  });

  await step('confirmRooms', async () => {
    const started = Date.now();
    // The button is disabled while the previous room change is still being saved to the job.
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="room-setup-confirm-button"]'); return b && !b.disabled; }, { timeout: 420000 });
    const previousSaveSeconds = Math.round((Date.now() - started) / 1000);
    const before = await page.$eval('[data-testid="room-setup-confirm-button"]', (el, seconds) => ({ disabled: el.disabled, text: el.innerText, previousSaveSeconds: seconds }), previousSaveSeconds);
    await page.click('[data-testid="room-setup-confirm-button"]');
    await delay(20000);
    const after = await page.evaluate(() => ({ message: document.querySelector('[data-testid="room-manager-message"]')?.innerText || '', confirmed: document.querySelector('[data-testid="room-setup-confirm"]')?.dataset.confirmed, modalOpen: Boolean(document.querySelector('[data-testid="project-room-manager"]')), banner: document.body.innerText.match(/(could not be saved|Open or create a job|not saved)[^\n]{0,120}/i)?.[0] || '' }));
    // Local-only job: the job file is written by Save Job, as the other browser checks do.
    const saveClicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((el) => el.innerText.trim() === 'Save Job' && !el.disabled); b?.click(); return Boolean(b); });
    let record; const deadline = Date.now() + 200000;
    do { record = await savedRecord().catch(() => null); if (modelOf(record)?.confirmedAt) break; await delay(1000); } while (Date.now() < deadline);
    const savedSeconds = Math.round((Date.now() - started) / 1000);
    report.confirmDiagnostics = { button: before, after20s: after, saveClicked, savedToJob: Boolean(modelOf(record)?.confirmedAt), savedSeconds, console: consoleLines.slice(-12), modalStillOpen: Boolean(await page.$('[data-testid="project-room-manager"]')) };
    assert(modelOf(record)?.confirmedAt, `confirmation was not saved to the job within ${savedSeconds}s`);
    await page.waitForFunction(() => !document.querySelector('[data-testid="project-room-manager"]'), { timeout: 120000 });
    const confirmSeconds = savedSeconds;
    const model = modelOf(record);
    assert(model?.confirmedAt, 'confirmation saved to the job');
    const kitchen = model.rooms.find((entry) => entry.name === 'Kitchen');
    assert.equal(kitchen?.level, 'Ground Floor'); assert.equal(kitchen?.levelSource, 'takeoff-sheet');
    fs.writeFileSync(path.join(out, 'saved-job.json'), JSON.stringify(record));
    const saved = record.workbook;
    assert.equal(bookWithoutModel(saved.clientSelectionsBook), beforeBook, 'every selection, quantity and room-specific product is unchanged (the cover and project id are refreshed by the app on open)');
    const afterSelections = JSON.stringify((saved.clientSelectionsBook?.rooms || []).flatMap((room) => (room.rows || []).map((row) => [room.id, row.id, row.guidedRequirementKey || row.guidedSelection?.requirementKey || '', JSON.stringify(row.guidedSelection || null).length])));
    assert.equal(afterSelections, beforeSelections, 'selection rows stay attached to their original room ids');
    return { confirmSeconds, levelsRecorded: model.rooms.filter((entry) => entry.level).length, history: model.history.at(-1), selectionRowsUnchanged: true };
  });

  // Save, close and reopen.
  await step('reopen', async () => {
    assert(fs.existsSync(path.join(out, 'saved-job.json')), 'no saved job to reopen because confirmation was not saved');
    await page.setCacheEnabled(false);
    await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await upload(path.join(out, 'saved-job.json'));
    await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
    const sections = await page.$$eval('[data-quote-section]', (items) => items.map((item) => item.dataset.quoteSection));
    assert.deepEqual(sections, report.quotationSectionsBefore, 'Quotation Builder sections are unchanged');
    await goSelections();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Review Schedule'), { timeout: 240000 });
    await delay(2500);
    assert.equal(await page.$('[data-testid="project-room-manager"]'), null, 'the confirmed gate does not reappear');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Review Schedule')?.click());
    await page.waitForSelector('[data-schedule-missing-records]', { timeout: 180000 });
    const text = await scheduleText();
    assert.equal(text, report.steps.scheduleBefore.text, 'final selections schedule reconciliation is unchanged');
    await shot('03-reopened-schedule');
    return { gateReappeared: false, quotationSections: sections.length, schedule: text };
  });

  report.originalUnchanged = sha(source) === originalHash;
  assert(report.originalUnchanged, 'the original job file must be unchanged');
  report.passed = !Object.values(report.steps).some((value) => value?.error) && report.runtimeErrors.length === 0;
} catch (error) { report.error = String(error.stack).slice(0, 1500); await shot('failure'); }
finally { report.blockedUrls = [...(report.blockedUrls || [])]; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 1)); await browser.close(); }
if (!report.passed) process.exitCode = 1;
