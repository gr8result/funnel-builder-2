import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Screenshots of the Client Selections overview for a job file, in an isolated browser profile
// (cloud writes answered locally). Captures: the home screen, the Review Schedule overview with its
// attention list, the toilets and the ceiling fans, and the active selections stored after opening.
//   node ... scripts/capture-client-selections-overview-browser.mjs --job=<file.gr8job> --label=<name>
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3020';
if (new URL(origin).port === '3000') process.exit(2);
const jobFile = path.resolve(arg('job', ''));
const label = arg('label', 'job');
const out = path.join(root, 'artifacts/test-artifacts/client-selections-overview', label);
fs.mkdirSync(out, {recursive:true});
const report = {label, jobFile, shots:[], failures:[]};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1600, height:1000}});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on('dialog', dialog => dialog.accept());
await page.setRequestInterception(true);
page.on('request', request => {
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
  const target = request.url();
  if (write && (/\/(rest|storage)\/v1\//.test(target) || /\/api\//.test(new URL(target).pathname))) return void request.respond({status:200, contentType:'application/json', body:'{}'});
  return void request.continue();
});
await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickText = text => page.evaluate(v => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.innerText.trim() === v); if (b) b.click(); return Boolean(b); }, text);
async function shot(name, selector = null) {
  const file = path.join(out, `${name}.png`);
  const element = selector ? await page.$(selector) : null;
  if (element) await element.screenshot({path:file}); else await page.screenshot({path:file, fullPage:false});
  report.shots.push(file);
}
async function toHome() {
  for (let i = 0; i < 6 && !(await page.$('[data-testid="guided-client-selections-home"]')); i++) { await clickText('Back'); await clickText('Guided Selections'); await delay(1200); }
}
async function openCategory(side, key) {
  await toHome();
  await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
  await page.waitForSelector(`[data-testid="guided-${side}-categories"]`);
  await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${key}"]`, element => element.click());
  await delay(3500);
}
try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(jobFile);
  for (let i = 0; i < 40; i++) { await delay(1000); for (const t of ['Discard Changes', 'Open Job']) await clickText(t); }
  await toHome();
  await shot('01-home');
  report.active = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const record = await new Promise(resolve => { const r = db.transaction('jobs', 'readonly').objectStore('jobs').get('job:recovered-03-09-123'); r.onsuccess = () => resolve(r.result); });
    db.close();
    const rows = (record?.workbook?.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []);
    const lines = key => rows.filter(row => (row.guidedRequirementKey || row.guidedSelection?.requirementKey) === key).flatMap(row => row.guidedSelection?.plumbingAllocation?.lines || []).map(line => `${line.productName} ×${line.quantity} [${(line.allocations || []).map(a => `${a.location} ${a.quantity}`).join(', ')}]`);
    return {toilets:lines('toilet-suite'), fans:lines('ceiling-fan')};
  });
  await openCategory('interior', 'plumbing-fixtures'); await shot('02-plumbing-fixtures');
  await openCategory('interior', 'lighting-fans'); await shot('03-lighting-fans');
  await toHome();
  if (await clickText('Review Schedule')) {
    await page.waitForSelector('.contractSchedulePanel', {timeout:300000});
    await delay(3000);
    await page.$eval('.contractSchedulePanel', element => element.scrollIntoView({block:'start'}));
    await shot('04-review-overview', '.contractSchedulePanel');
    report.reviewText = await page.$eval('.contractSchedulePanel', element => element.innerText.slice(0, 4000));
  } else report.failures.push('Review Schedule button not found');
} catch (error) {
  report.failures.push(error.message);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({label, active:report.active, failures:report.failures, shots:report.shots.length}, null, 1));
  await browser.close();
}
