// Uses an isolated local job and browser; does not save to cloud or touch the active user job.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const out = path.resolve('artifacts/test-artifacts/door-labour-formula');
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const projectId = `local-door-formula-${Date.now()}`;
const jobName = 'Door labour formula regression';
const workbook = { ...JSON.parse(fs.readFileSync(path.join(out, 'fixture.json'), 'utf8')),
  templateType: 'job', page: 'quotation', projectId, commercialProjectId: projectId, registeredJobId: projectId,
  registeredJob: { jobId: projectId, jobName, jobNumber: 'LOCAL-DOORS' },
  jobFileMeta: { projectId, jobName, jobNumber: 'LOCAL-DOORS', localFileOnly: true } };
const file = path.join(out, 'browser-job.json');
fs.writeFileSync(file, JSON.stringify({ projectId, jobName, workbook }));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (error) throw error;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 180000, defaultViewport: { width: 1920, height: 1080 } });
const report = { passed: false, checks: {}, errors: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && (/\/(rest|storage)\/v1\//.test(request.url()) || /\/api\/builders\//.test(request.url()))) void request.abort();
    else void request.continue();
  });
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session });
  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  async function load(file) {
    const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
    await input.uploadFile(file);
    for (let i = 0; i < 12; i++) {
      await pause(700);
      await page.evaluate(() => {
        for (const label of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === label)?.click();
      });
    }
    await page.waitForFunction(() => document.body.innerText.includes('FIX-OUT STAGE LABOUR'));
    if (!await page.$('#quote-edit-quote-152')) await page.evaluate(() => [...document.querySelectorAll('span,strong,div,button')].find(el => !el.children.length && el.innerText.trim() === 'FIX-OUT STAGE LABOUR')?.click());
    await page.waitForSelector('#quote-edit-quote-152');
  }
  const formulaSelector = 'input[aria-label="Quantity formula for HANG SINGLE DOOR INC. JAMB/ARCH/FURNITURE"]';
  const read = () => page.$eval('#quote-edit-quote-152', el => {
    const tr = el.closest('tr');
    const inputs = [...tr.querySelectorAll('input')];
    return { qty: inputs[inputs.indexOf(el) + 1].value, formula: tr.querySelector('[aria-label^="Quantity formula"]')?.value, text: tr.innerText };
  });
  async function edit(formula) {
    await page.click(formulaSelector, { clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type(formula);
    await page.keyboard.press('Tab');
  }
  await load(file);
  report.checks.initial = await read();
  assert.equal(report.checks.initial.qty, '16');
  assert.equal(report.checks.initial.formula, '=internalDoors-cavityDoorQty');
  assert(report.checks.initial.text.includes('Internal Doors (20) - Cavity Sliding Doors (4) = 16'));
  await edit('=internalDoors-cavityDoorQty+2');
  await page.waitForFunction(() => { const el = document.querySelector('#quote-edit-quote-152'); const inputs = [...el.closest('tr').querySelectorAll('input')]; return inputs[inputs.indexOf(el) + 1].value === '18'; });
  report.checks.edited = await read();
  await pause(3000);
  // Read the actual IndexedDB autosave and reopen its saved workbook as a local job.
  const saved = await page.evaluate(async projectId => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open('estimate-builder-template-db'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const records = await new Promise((resolve, reject) => { const req = db.transaction('jobs', 'readonly').objectStore('jobs').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close();
    return records.find(r => r.projectId === projectId || r.workbook?.projectId === projectId || r.key === `job:${projectId}`);
  }, projectId);
  assert(saved, 'edited local job autosaved');
  const savedWorkbook = saved.workbook || saved;
  const reopenedFile = path.join(out, 'reopened-job.json');
  fs.writeFileSync(reopenedFile, JSON.stringify({ projectId, jobName, workbook: savedWorkbook }));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await load(reopenedFile);
  report.checks.reopened = await read();
  assert.equal(report.checks.reopened.qty, '18');
  assert.equal(report.checks.reopened.formula, '=internalDoors-cavityDoorQty+2');
  await edit('=internalDoors-cavityDoorQty');
  await pause(1000);
  assert.equal((await read()).qty, '16');
  await page.$eval('#quote-edit-quote-152', el => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(out, 'verified.png') });
  report.passed = true;
  console.log('PASS: browser Selection editing recalculates Qty; actual autosave/reopen preserves formula and Qty; restored example 20 - 4 = 16.');
} finally {
  fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
