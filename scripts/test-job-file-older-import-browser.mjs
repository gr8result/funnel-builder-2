import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// The 2026-10-30 scenario in the real app (isolated browser profile, every cloud write blocked):
//   1. open the corrected job (ICON ×4, SPYDA ×2);
//   2. open the OLDER job file over it -> the "older than the saved job" dialog appears;
//   3. Keep the saved job          -> nothing changes;
//   4. Open the file, keep confirmed corrections -> no Origin / STANZA / AeroFlow come back;
//   5. Open the file exactly as it is (deliberate rollback) -> the file's selections are used;
//   and a backup of the saved job exists before each replacement.
//   node ... scripts/test-job-file-older-import-browser.mjs --newer=<corrected.gr8job> --older=<older.gr8job>
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3017';
if (new URL(origin).port === '3000') process.exit(2);
const newer = path.resolve(arg('newer', 'artifacts/reconciled/live-rev14-reconciled.gr8job'));
const older = path.resolve(arg('older', 'C:/Users/grant/Downloads/New Job 03 09.gr8job'));
const out = path.join(root, 'artifacts/test-artifacts/job-file-older-import');
fs.mkdirSync(out, {recursive:true});
const report = {passed:false, steps:{}, failures:[]};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1600, height:1000}});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on('dialog', dialog => dialog.accept());
report.log = [];
page.on('console', message => { const text = message.text(); if (/rollback|carried|book sources not used|older job file|confirmed decisions/i.test(text)) report.log.push(text.slice(0, 300)); });
await page.evaluateOnNewDocument(() => { window.__gr8DebugBookLoad = true; });
await page.setRequestInterception(true);
page.on('request', request => {
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
  const target = request.url();
  if (write && (/\/(rest|storage)\/v1\//.test(target) || /\/api\//.test(new URL(target).pathname))) return void request.respond({status:200, contentType:'application/json', body:'{}'});
  return void request.continue();
});
await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const buttons = () => page.$$eval('button', items => items.filter(b => !b.disabled && b.offsetParent).map(b => b.innerText.trim()));
async function stored() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      const keys = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').getAllKeys(); r.onsuccess = () => resolve(r.result.map(String)); });
      const record = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get('job:recovered-03-09-123'); r.onsuccess = () => resolve(r.result); });
      const book = record?.workbook?.clientSelectionsBook || {};
      const lines = key => (book.rooms || []).flatMap(room => room.rows || []).filter(row => (row.guidedRequirementKey || row.guidedSelection?.requirementKey) === key).flatMap(row => row.guidedSelection?.plumbingAllocation?.lines || []).map(line => `${line.productName.split(' ').slice(0, 2).join(' ')}×${line.quantity}`).sort();
      return {revision:record?.revision, toilets:lines('toilet-suite'), fans:lines('ceiling-fan'), ledger:Boolean(book.clientSelectionCorrections), backups:keys.filter(key => key.startsWith('job-backup:')).length};
    } finally { db.close(); }
  });
}
async function openFile(file) {
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(file);
}
async function settle(seconds = 25) {
  for (let i = 0; i < seconds; i++) {
    await delay(1000);
    const labels = await buttons().catch(() => []);
    for (const text of ['Discard Changes', 'Open Job']) if (labels.includes(text)) await page.evaluate(v => [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === v)?.click(), text);
  }
}
const check = (name, ok, detail) => { report.steps[name] = ok ? 'PASS' : `FAIL ${detail}`; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`); if (!ok) report.failures.push(name); };
try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  await openFile(newer); await settle(40);
  const start = await stored();
  check('the corrected job is saved: ICON ×4, SPYDA ×2', JSON.stringify(start.toilets) === '["ICON Close×4"]' && start.fans.length === 1 && start.fans[0].startsWith('Ventair -×2'), JSON.stringify(start));

  for (const [choice, testId] of [['keep', 'older-job-file-keep'], ['carry', 'older-job-file-carry'], ['as-is', 'older-job-file-as-is']]) {
    const before = await stored();
    await openFile(older);
    const dialog = await page.waitForSelector('[data-testid="older-job-file-dialog"]', {timeout:300000}).catch(() => null);
    check(`${choice}: the older file raises the choice instead of opening`, Boolean(dialog), 'no dialog');
    if (!dialog) break;
    const text = await page.$eval('[data-testid="older-job-file-dialog"]', element => element.innerText);
    if (choice === 'keep') check('the dialog names the corrections the file lacks', /ICON/.test(text) && /STANZA/.test(text), text.slice(0, 300));
    await page.click(`[data-testid="${testId}"]`);
    await settle(choice === 'keep' ? 5 : 45);
    const after = await stored();
    report[choice] = {before, after};
    if (choice === 'keep') check('keep: the saved job is unchanged', after.revision === before.revision && JSON.stringify(after.toilets) === JSON.stringify(before.toilets), JSON.stringify(after));
    if (choice === 'carry') check('keep corrections: no Origin, STANZA or AeroFlow return; the corrections stay', !after.toilets.some(t => /Origin/.test(t)) && !after.fans.some(t => /STANZA|AeroFlow/.test(t)) && after.ledger && after.backups > before.backups, JSON.stringify(after));
    if (choice === 'as-is') check('as it is: the deliberate rollback is honoured and the saved job is backed up first', after.toilets.some(t => /Origin/.test(t)) && after.backups > before.backups, JSON.stringify(after));
  }
} catch (error) {
  report.failures.push(error.message); console.log('FAIL run', error.message);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  report.passed = report.failures.length === 0;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed:report.passed, failures:report.failures}));
  if (!report.passed) process.exitCode = 1;
  await browser.close();
}
