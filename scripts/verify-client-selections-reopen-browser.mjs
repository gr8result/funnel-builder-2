// Reopen an already edited Client Selections verification copy after a dev-server restart.
// The supplied JSON must be the isolated browser snapshot, never the real job package.
// Run against a server started on an isolated port:
//   CLIENT_SELECTIONS_BASE_URL=http://localhost:3101 PUPPETEER_EXECUTABLE_PATH=... node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-client-selections-reopen-browser.mjs <copy.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3101';
const fixturePath = path.resolve(process.argv[2] || '');
assert(fixturePath && fs.existsSync(fixturePath), 'Pass the persisted isolated job-copy JSON.');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const jobId = String(fixture.jobId || fixture.workbook?.jobId || '');
assert(jobId.startsWith('local-repair-verify-'), 'Refusing to open anything except the dedicated isolated verification job.');
assert.equal(fixture.workbook?.jobId, jobId, 'The copy package and workbook must keep the same isolated job ID.');

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
const report = { jobId, runtimeErrors: [], blockedCloudWrites: 0 };
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const readStoredJob = () => page.evaluate(async key => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes('estimate-builder-template-db')) continue;
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      if (!db.objectStoreNames.contains('jobs')) continue;
      const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      if (!record?.workbook) continue;
      const workbook = record.workbook;
      const book = workbook.clientSelectionsBook || {};
      const rooms = book.rooms || [];
      const rows = rooms.flatMap(room => room.rows || []);
      const roomHistory = book.projectRoomModel?.history || [];
      const fanLines = rows.flatMap(row => row.guidedSelection?.plumbingAllocation?.lines || []).filter(line => /fan/i.test(line.productName || ''));
      return { jobId: workbook.jobId, roomCount: rooms.length, selectionRows: rows.length,
        guidedRecords: rows.filter(row => row.guidedRequirementKey || row.guidedSelection).length,
        hasRoomMerge: roomHistory.some(item => item.action === 'merge' && /2nd bedroom ensuite/i.test(item.from || '')),
        fanLocations: fanLines.flatMap(line => (line.allocations || []).map(item => item.location)),
        quotationRowCount: Object.values(workbook.quotation || {}).reduce((count, section) => count + (section.rows || []).length, 0) };
    } finally { db.close(); }
  }
  return null;
}, `job:${jobId}`);

try {
  page = await browser.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message.slice(0, 400)));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      report.blockedCloudWrites += 1;
      void request.abort();
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: fixture.workbook.workspaceId });

  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(fixturePath);
  for (let n = 0; n < 8; n += 1) {
    await delay(350);
    await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(button => !button.disabled && button.innerText.trim() === text)?.click(); });
  }
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  await delay(2500);
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find(element => element.innerText.trim() === 'Client Selections')?.click());
  await page.waitForSelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]', { timeout: 180000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Review Schedule')?.click());
  await page.waitForSelector('[data-testid="schedule-reconciliation"] [data-schedule-represented-records]', { timeout: 180000 });
  report.afterReopen = await readStoredJob();
  assert(report.afterReopen, 'The same isolated job ID is present in local job storage after reopen.');
  assert.equal(report.afterReopen.jobId, jobId);
  assert.equal(report.afterReopen.roomCount, fixture.workbook.clientSelectionsBook.rooms.length);
  assert.equal(report.afterReopen.selectionRows, fixture.workbook.clientSelectionsBook.rooms.reduce((count, room) => count + (room.rows || []).length, 0));
  assert.equal(report.afterReopen.guidedRecords, fixture.workbook.clientSelectionsBook.rooms.flatMap(room => room.rows || []).filter(row => row.guidedRequirementKey || row.guidedSelection).length);
  assert.equal(report.afterReopen.hasRoomMerge, true, 'The explicit room-merge decision survived the process restart and reopen.');
  assert(report.afterReopen.fanLocations.some(location => /^study$/i.test(location)), 'The saved fan assignment survived reopen.');
  report.scheduleLedger = await page.$eval('[data-testid="schedule-reconciliation"]', element => ({ saved: Number(element.querySelector('[data-schedule-saved-records]')?.dataset.scheduleSavedRecords || 0), represented: Number(element.querySelector('[data-schedule-represented-records]')?.dataset.scheduleRepresentedRecords || 0), missing: Number(element.querySelector('[data-schedule-missing-records]')?.dataset.scheduleMissingRecords || 0) }));
  assert.equal(report.scheduleLedger.missing, 0);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 240000 });
  report.afterReload = await readStoredJob();
  report.reloadUi = await page.evaluate(() => ({
    noJobOpen: document.body.innerText.includes('No job open'),
    missingPlanAsset: document.body.innerText.match(/Load failed: Missing plan asset[^\\n]*/)?.[0] || '',
  }));
  assert.deepEqual(report.afterReload, report.afterReopen, 'A browser reload after the server restart does not alter the saved IndexedDB job record.');
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error).slice(0, 2000);
  if (page) await page.screenshot({ path: path.resolve('artifacts/test-artifacts/client-selections-repair-verification/reopen-failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.blockedCloudWrites = report.blockedCloudWrites || 0;
  const out = path.resolve('artifacts/test-artifacts/client-selections-repair-verification/reopen-after-server-restart.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
if (!report.passed) process.exitCode = 1;
