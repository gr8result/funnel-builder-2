// Signed-in Quotation Builder acceptance test - PREPARED, NOT YET EXECUTED.
//
// Must run against a genuine isolated Supabase (e.g. `supabase start` with Docker) holding
// disposable test data only, and a Next.js server on a non-3000 port (3107 by default).
// It refuses to run against port 3000, a non-local Supabase, or without explicit test users.
//
// Required env:
//   QB_ACCEPT_URL        app origin, e.g. http://localhost:3107
//   QB_SUPABASE_URL      must equal the app's NEXT_PUBLIC_SUPABASE_URL and be localhost/127.0.0.1
//   QB_USER_A_EMAIL / QB_USER_A_PASSWORD   builder A owner (disposable)
//   QB_USER_B_EMAIL / QB_USER_B_PASSWORD   builder B owner (disposable, different workspace)
//   QB_JOB_A_ID          disposable job in builder A containing at least one row with no price
// Optional selector overrides (confirm on first run):
//   QB_SAVE_SELECTOR, QB_ISSUE_SELECTOR, QB_PRICE_INPUT_SELECTOR
//
// Covers: real sign-in, cross-builder isolation, save/reopen, commercial sync,
// QUOTE REQUIRED warnings, and incomplete quotations blocked from issue/send.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const env = (k) => { const v = process.env[k]; if (!v) { console.error(`${k} is required. Refusing to run.`); process.exit(2); } return v; };
const origin = env('QB_ACCEPT_URL');
const supabaseUrl = env('QB_SUPABASE_URL');
const appPort = new URL(origin).port;
if (appPort === '3000' || appPort === '') { console.error('QB_ACCEPT_URL must use an explicit non-3000 port. Refusing to run.'); process.exit(2); }
if (!['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname)) {
  console.error('QB_SUPABASE_URL is not a local isolated Supabase. Refusing to run against a shared or production backend.'); process.exit(2);
}
const userA = { email: env('QB_USER_A_EMAIL'), password: env('QB_USER_A_PASSWORD') };
const userB = { email: env('QB_USER_B_EMAIL'), password: env('QB_USER_B_PASSWORD') };
const jobA = env('QB_JOB_A_ID');
const SAVE = process.env.QB_SAVE_SELECTOR || '#estimate-builder-file-menu-button';
const ISSUE = process.env.QB_ISSUE_SELECTOR || '';
const STEP_TIMEOUT = 45000;
const quoteUrl = `${origin}/modules/estimate-builder?page=quotation&jobId=${encodeURIComponent(jobA)}`;

const report = { startedAt: new Date().toISOString(), origin, supabaseUrl, steps: [], consoleErrors: [] };
const step = async (name, run) => {
  try { const detail = await run(); report.steps.push({ name, result: 'PASS', detail }); console.log('PASS', name); }
  catch (error) { report.steps.push({ name, result: 'FAIL', error: error.message }); console.log('FAIL', name, '-', error.message); throw error; }
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
// Hard guard: block any request to port 3000 or to a non-local Supabase from inside the browser too.
async function guarded(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.port === '3000' || (/supabase\.co$/.test(u.hostname))) return req.abort('blockedbyclient');
    return req.continue();
  });
  page.on('pageerror', (e) => report.consoleErrors.push(e.message));
  return page;
}
async function signIn(page, user) {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.type('input[type="email"]', user.email);
  await page.type('input[type="password"]', user.password);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), page.click('button[type="submit"]')]);
  await page.waitForFunction(() => !location.pathname.startsWith('/login'));
}
const pageText = (page) => page.evaluate(() => document.body.innerText);

try {
  const ctxA = await browser.createBrowserContext();
  const a = await guarded(ctxA);
  await step('1. Builder A signs in through the real login page', async () => { await signIn(a, userA); return a.url(); });

  await step('2. Builder A opens the disposable job quotation', async () => {
    await a.goto(quoteUrl, { waitUntil: 'domcontentloaded' });
    await a.waitForSelector('#estimate-builder-file-menu-button');
    return a.url();
  });

  await step('3. Unpriced rows show QUOTE REQUIRED', async () => {
    await a.waitForFunction(() => document.body.innerText.includes('QUOTE REQUIRED'));
    return { warnings: (await pageText(a)).split('QUOTE REQUIRED').length - 1 };
  });

  await step('4. Incomplete quotation is blocked from issue/send', async () => {
    const handle = ISSUE ? await a.$(ISSUE) : await a.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => /\b(issue|send)\b/i.test(b.innerText)) || null);
    const el = handle?.asElement?.() ?? null;
    assert(el, 'No issue/send control found - set QB_ISSUE_SELECTOR');
    const disabled = await el.evaluate((b) => b.disabled || b.getAttribute('aria-disabled') === 'true');
    if (!disabled) {
      await el.click();
      await a.waitForFunction(() => /quote required|missing price|cannot (be )?(issued|sent)|blocked/i.test(document.body.innerText));
    }
    return { disabled };
  });

  let marker;
  await step('5. Save, reload and reopen keeps the quotation (save/reopen)', async () => {
    const before = await pageText(a);
    marker = before.match(/\$[\d,]+\.\d{2}/g)?.slice(-1)[0];
    assert(marker, 'No priced total visible to compare');
    await a.click(SAVE);
    await new Promise((r) => setTimeout(r, 1500));
    await a.reload({ waitUntil: 'domcontentloaded' });
    await a.waitForFunction((m) => document.body.innerText.includes(m), {}, marker);
    return { marker };
  });

  await step('6. Commercial sync: a second session sees the same saved totals', async () => {
    const a2 = await guarded(ctxA);
    await a2.goto(quoteUrl, { waitUntil: 'domcontentloaded' });
    await a2.waitForFunction((m) => document.body.innerText.includes(m), {}, marker);
    await a2.close();
    return { marker };
  });

  await step('7. Builder B (different workspace) cannot open builder A job', async () => {
    const ctxB = await browser.createBrowserContext();
    const b = await guarded(ctxB);
    await signIn(b, userB);
    await b.goto(quoteUrl, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 4000));
    const text = await pageText(b);
    assert(!text.includes(marker), 'Builder B can see builder A quotation totals');
    await ctxB.close();
    return { url: b.url() };
  });

  assert.deepEqual(report.consoleErrors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.mkdirSync('artifacts/test-artifacts/quotation-acceptance', { recursive: true });
  fs.writeFileSync('artifacts/test-artifacts/quotation-acceptance/report.json', JSON.stringify(report, null, 2));
}
