import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// Every Client Selections category of the REAL job, in the real app (isolated browser profile, cloud
// writes answered locally): open the job, open every Interior and Exterior category, and check what
// the client sees — no raw values, no obsolete products, no phantom levels, no duplicated project
// rooms, no crash or console error — then go back each time.
//   node ... scripts/test-client-selections-real-job-walkthrough-browser.mjs --job=<corrected.gr8job>
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3020';
if (new URL(origin).port === '3000') process.exit(2);
const jobFile = path.resolve(arg('job', 'artifacts/reconciled/live-rev14-reconciled.gr8job'));
const out = path.join(root, 'artifacts/test-artifacts/client-selections-real-job-walkthrough');
fs.mkdirSync(out, {recursive:true});
const report = {passed:false, categories:{}, failures:[], consoleErrors:[], pageErrors:[], blockedWrites:0};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1600, height:1000}});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on('dialog', dialog => dialog.accept());
page.on('pageerror', error => report.pageErrors.push(String(error.message || error).slice(0, 300)));
page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|net::ERR|status of 4\d\d|blocked/i.test(message.text())) report.consoleErrors.push(message.text().slice(0, 300)); });
await page.setRequestInterception(true);
page.on('request', request => {
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
  const target = request.url();
  if (write && (/\/(rest|storage)\/v1\//.test(target) || /\/api\//.test(new URL(target).pathname))) { report.blockedWrites += 1; return void request.respond({status:200, contentType:'application/json', body:'{}'}); }
  return void request.continue();
});
await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = (name, detail) => { report.failures.push(`${name}: ${detail}`); console.log(`FAIL ${name}: ${detail}`); };
const clickText = text => page.evaluate(v => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.innerText.trim() === v); if (b) b.click(); return Boolean(b); }, text);
const BAD = [
  // Infinity only as a number ("$Infinity", "-Infinity"): Rinnai's "Infinity 32" is a product name.
  [/\[object Object\]|\bundefined\b|\bNaN\b|[$-]\s?Infinity\b|Infinity\s?(%|m²|m2)/, 'raw value on screen'],
  [/\b(UPSTAIRS|DOWNSTAIRS)\b/, 'phantom level used as a room'],
  [/Origin Back to Wall|\bSTANZA\b|AeroFlow/i, 'obsolete product'],
  [/Something went wrong|Application error|Unhandled Runtime Error/i, 'crash screen'],
];
async function screenText() {
  return page.evaluate(() => (document.querySelector('[data-testid="guided-product-page"], .guidedShell')?.innerText || document.body.innerText));
}
async function toHome() {
  for (let i = 0; i < 6 && !(await page.$('[data-testid="guided-client-selections-home"]')); i++) { await clickText('Back'); await delay(1200); }
  return Boolean(await page.$('[data-testid="guided-client-selections-home"]'));
}
try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(jobFile);
  for (let i = 0; i < 40; i++) { await delay(1000); for (const t of ['Discard Changes', 'Open Job']) await clickText(t); }
  await page.waitForSelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"], [data-testid="guided-exterior-categories"], [data-testid="guided-product-page"]', {timeout:600000});
  if (!(await toHome())) throw new Error('Client Selections home did not appear');
  const homeText = await screenText();
  report.budgetDock = await page.evaluate(() => document.querySelector('[class*="BudgetDock"], [data-testid="guided-running-budget"]')?.innerText || '');
  report.projectRooms = (homeText.match(/Project rooms?[\s\S]{0,1200}/i) || [''])[0].slice(0, 1200);
  for (const side of ['interior', 'exterior']) {
    if (!(await toHome())) throw new Error('could not return to the home screen');
    await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
    await page.waitForSelector(`[data-testid="guided-${side}-categories"]`);
    await delay(1000);
    const cards = await page.$$eval(`[data-testid="guided-${side}-categories"] [data-category-key]`, items => items.map(item => ({key:item.dataset.categoryKey, text:item.innerText.replace(/\s+/g, ' ').trim().slice(0, 160)})));
    report[`${side}Cards`] = cards;
    for (const card of cards) {
      const name = `${side}/${card.key}`;
      if (!(await page.$(`[data-testid="guided-${side}-categories"]`))) {
        await toHome();
        await page.$eval(`[data-testid="guided-client-selections-home"] [data-category-key="${side}"]`, element => element.click());
        await page.waitForSelector(`[data-testid="guided-${side}-categories"]`);
      }
      const errorsBefore = report.pageErrors.length + report.consoleErrors.length;
      await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${card.key}"]`, element => element.click());
      await delay(3500);
      const text = await screenText();
      const problems = BAD.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
      const newErrors = [...report.pageErrors, ...report.consoleErrors].slice(errorsBefore);
      report.categories[name] = {card:card.text, chars:text.length, problems, errors:newErrors, sample:text.replace(/\s+/g, ' ').slice(0, 300), rawContext:problems.length ? [...text.matchAll(/.{0,120}(\[object Object\]|undefined|NaN|Infinity).{0,80}/g)].map(match => match[0]).slice(0, 5) : []};
      if (text.trim().length < 40) fail(name, 'the category page is empty');
      for (const problem of problems) fail(name, problem);
      for (const error of newErrors) fail(name, `error: ${error}`);
      console.log(`${problems.length || newErrors.length ? 'FAIL' : 'PASS'} ${name} (${card.text.slice(0, 80)})`);
      await clickText('Back'); await delay(1500);
    }
  }
} catch (error) {
  fail('run', error.message);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  report.passed = report.failures.length === 0;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed:report.passed, categories:Object.keys(report.categories).length, failures:report.failures.slice(0, 20), blockedWrites:report.blockedWrites}));
  if (!report.passed) process.exitCode = 1;
  await browser.close();
}
