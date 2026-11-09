import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import {createClient} from '@supabase/supabase-js';

// The Quotation Builder side of Client Selections, in the real app (isolated browser profile, every
// cloud write answered locally, the Apply button is NEVER pressed):
//   open the corrected job -> Quotation -> "Reconcile Selections" preview, and check that
//   - the proposed total is the independently verified figure and the current total is unchanged;
//   - unpriced items (Bosch oven, rate-required lines) are listed and must be kept pending explicitly;
//   - no possible duplicate charge is reported;
//   - Apply stays disabled until the estimator has reviewed, decided every pending item and approved
//     the exact financial change.
//   node ... scripts/test-client-selections-quotation-approval-browser.mjs --job=<corrected.gr8job> --expect-before=836551.76 --expect-after=887949.03
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({path:path.join(root, '.env.local'), quiet:true});
dotenv.config({path:path.join(root, '.env'), quiet:true});
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3019';
if (new URL(origin).port === '3000') process.exit(2);
const jobFile = path.resolve(arg('job', 'artifacts/reconciled/live-rev14-reconciled.gr8job'));
const expectBefore = Number(arg('expect-before', '836551.76'));
const expectAfter = Number(arg('expect-after', '887949.03'));
const out = path.join(root, 'artifacts/test-artifacts/client-selections-quotation-approval');
fs.mkdirSync(out, {recursive:true});
const report = {passed:false, steps:{}, failures:[], blockedWrites:0};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data:link} = await admin.auth.admin.generateLink({type:'magiclink', email:process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com'});
const {data:auth} = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}}).auth.verifyOtp({type:'magiclink', token_hash:link.properties.hashed_token});
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, protocolTimeout:900000, defaultViewport:{width:1700, height:1100}});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on('dialog', dialog => dialog.accept());
await page.setRequestInterception(true);
page.on('request', request => {
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
  const target = request.url();
  if (write && (/\/(rest|storage)\/v1\//.test(target) || /\/api\//.test(new URL(target).pathname))) { report.blockedWrites += 1; return void request.respond({status:200, contentType:'application/json', body:'{}'}); }
  return void request.continue();
});
await page.evaluateOnNewDocument(({key, session}) => localStorage.setItem(key, JSON.stringify(session)), {key:`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session:auth.session});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, detail) => { report.steps[name] = ok ? 'PASS' : `FAIL ${detail}`; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`); if (!ok) report.failures.push(name); };
const money = text => Number(String(text || '').replace(/[^0-9.-]/g, ''));
async function clickText(text) { return page.evaluate(v => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.innerText.trim() === v); if (b) b.click(); return Boolean(b); }, text); }
try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, {waitUntil:'domcontentloaded', timeout:600000});
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', {timeout:600000});
  await input.uploadFile(jobFile);
  for (let i = 0; i < 40; i++) { await delay(1000); for (const t of ['Discard Changes', 'Open Job']) await clickText(t); }
  const quoteUrl = new URL(page.url()); quoteUrl.searchParams.set('page', 'quotation');
  await page.goto(quoteUrl.toString(), {waitUntil:'domcontentloaded', timeout:600000});
  const open = await page.waitForSelector('[data-testid="reconcile-selections-open"]', {timeout:600000});
  await delay(5000);
  await open.click();
  await page.waitForSelector('[data-testid="reconcile-financial-impact"], [data-testid="reconcile-changes"]', {timeout:600000});
  await delay(3000);
  const view = await page.evaluate(() => {
    const text = id => document.querySelector(`[data-testid="${id}"]`)?.innerText || '';
    const apply = document.querySelector('[data-testid="reconcile-apply"]');
    return {
      impact: text('reconcile-financial-impact'),
      priceProblems: text('reconcile-price-problems'),
      changes: text('reconcile-changes'),
      held: text('reconcile-held'),
      duplicates: text('reconcile-duplicate-list'),
      fixtures: text('reconcile-lighting-fans'),
      quantity: text('reconcile-quantity-checks'),
      decisionsRequired: text('reconcile-decisions-required'),
      pendingPriceBoxes: [...document.querySelectorAll('[data-testid^="pending-price-"]')].map(box => box.dataset.testid),
      applyDisabled: apply ? apply.disabled : null,
    };
  });
  fs.writeFileSync(path.join(out, 'preview.json'), JSON.stringify(view, null, 2));
  await page.screenshot({path:path.join(out, 'preview.png'), fullPage:false});
  const [, current, proposed] = view.impact.match(/Current\s+([^·]+)·\s*proposed\s+([^·]+)·/i) || [];
  check('the current quotation total is the approved $836,551.76', Math.abs(money(current) - expectBefore) < 0.005, `current=${current}`);
  check('the proposed total equals the independently calculated figure', Math.abs(money(proposed) - expectAfter) < 0.005, `proposed=${proposed}`);
  check('the Bosch oven (no supplier price) is listed as price pending, never priced silently', /oven/i.test(view.priceProblems) || /oven[^\n]*PRICE MISSING/i.test(view.changes), view.priceProblems.slice(0, 400));
  check('no possible duplicate charge is reported', !view.duplicates, view.duplicates.slice(0, 300));
  check('Apply is disabled before review and approval', view.applyDisabled === true, `disabled=${view.applyDisabled}`);
  // Review and approve the total, but leave the pending prices undecided: Apply must stay disabled.
  await page.click('[data-testid="reconcile-reviewed"]');
  const approveTotal = await page.$('[data-testid="approve-financial-change"]');
  if (approveTotal) await approveTotal.click();
  await delay(500);
  const stillDisabled = await page.$eval('[data-testid="reconcile-apply"]', b => b.disabled);
  check('Apply stays disabled while price-pending items are undecided', view.pendingPriceBoxes.length === 0 || stillDisabled === true, `pendingBoxes=${view.pendingPriceBoxes.length} disabled=${stillDisabled}`);
  report.view = view;
} catch (error) {
  report.failures.push(error.message); console.log('FAIL run', error.message);
  await page.screenshot({path:path.join(out, 'failure.png')}).catch(() => {});
} finally {
  report.passed = report.failures.length === 0;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed:report.passed, failures:report.failures, blockedWrites:report.blockedWrites}));
  if (!report.passed) process.exitCode = 1;
  await browser.close();
}
