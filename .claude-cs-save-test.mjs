import fs from 'node:fs';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const origin = 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'support@gr8result.com' });
const authClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: auth } = await authClient.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });

const REAL_JOB_FILE = 'C:\\Users\\grant\\Documents\\GR8 Jobs\\New Job 03-09\\New Job 03 09.gr8job';

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, defaultViewport: { width: 1500, height: 1050 } });
const page = await browser.newPage();
page.setDefaultTimeout(180000);
const consoleLines = [];
page.on('console', (msg) => consoleLines.push({ t: Date.now(), text: msg.text() }));
page.on('pageerror', (err) => consoleLines.push({ t: Date.now(), text: '[pageerror] ' + err.message }));
await page.setRequestInterception(true);
page.on('request', (request) => {
  if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) void request.abort();
  else void request.continue();
});
await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
  key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session,
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const bodyText = () => page.evaluate(() => document.body.innerText).catch(() => '__EVAL_FAILED__');
const clickText = (text, scope = 'body') => page.evaluate((text, scope) => {
  const btn = [...document.querySelectorAll(`${scope} button`)].find((b) => !b.disabled && b.innerText.trim() === text);
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
  return false;
}, text, scope);
function since(label) { console.log(`\n[${new Date().toISOString()}] ${label}`); }
function lockErrorsSince(t0) { return consoleLines.filter((l) => l.t >= t0 && /another tab is still saving|lock broken|steal/i.test(l.text)); }

try {
  since('1. Open the real job file');
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('No job open'), { timeout: 30000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(REAL_JOB_FILE);
  let opened = false;
  for (let i = 0; i < 90; i++) {
    await delay(2000);
    const labels = await page.$$eval('button', (buttons) => buttons.filter((b) => !b.disabled).map((b) => b.innerText.trim())).catch(() => []);
    for (const label of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) {
      if (labels.includes(label)) await clickText(label);
    }
    if ((await bodyText()).includes('New Job 03/09')) { opened = true; break; }
  }
  console.log('   opened =', opened);
  if (!opened) throw new Error('did not open');

  since('2. Let things settle fully (30s) before testing save, to separate import noise from the actual save test');
  await delay(30000);
  const t0 = Date.now();

  since('3. Enter guided appliance selection for an EXISTING category (ovens) and note current selection');
  // Reach the guided appliance flow the same way a user would.
  const enteredHome = await page.evaluate(() => !!document.querySelector('[data-testid="guided-client-selections-home"]'));
  console.log('   guided-client-selections-home present =', enteredHome);
  if (enteredHome) {
    await page.evaluate(() => document.querySelector('[data-requirement-key="interior"]')?.click());
    await delay(800);
    await page.evaluate(() => document.querySelector('[data-requirement-key="appliances"]')?.click());
    await delay(800);
  }
  const brandSelectionPresent = await page.evaluate(() => !!document.querySelector('[data-testid="appliance-brand-selection"]'));
  const alreadyInFamily = await page.evaluate(() => !!document.querySelector('[data-testid="guided-appliance-catalogue-flow"]'));
  console.log('   brand-selection screen present =', brandSelectionPresent, ', already inside a family/brand flow =', alreadyInFamily);

  // If a brand is already chosen for ovens (existing selections), the flow may
  // land directly on models. Otherwise pick the first brand available.
  if (brandSelectionPresent) {
    const firstBrand = await page.evaluate(() => document.querySelector('[data-testid="appliance-brand-selection"] article[data-brand] button')?.closest('article')?.dataset.brand || '');
    console.log('   choosing brand:', firstBrand);
    await page.evaluate(() => document.querySelector('[data-testid="appliance-brand-selection"] article[data-brand] button')?.click());
    await delay(1500);
  }

  const cards = await page.$$eval('article[data-product-id][data-testid^="appliance-model-"]', (els) => els.map((e) => ({
    productId: e.dataset.productId, selected: e.classList.contains('selected'), text: e.innerText.slice(0, 80),
  }))).catch(() => []);
  console.log('   model cards found:', cards.length, JSON.stringify(cards.slice(0, 5)));
  const currentlySelected = cards.find((c) => c.selected);
  const alternative = cards.find((c) => !c.selected) || cards[1] || cards[0];
  console.log('   currently selected:', currentlySelected?.productId, '-> switching to:', alternative?.productId);

  if (!alternative) throw new Error('No alternative product card available to select');
  await page.evaluate((productId) => {
    const card = document.querySelector(`article[data-product-id="${productId}"]`);
    const btn = card?.querySelector('.guidedProductActions button.primary') || card?.querySelector('button');
    btn?.click();
  }, alternative.productId);
  await delay(1500);

  since('4. Return to main Client Selections and click Save Progress');
  await clickText('Finish', '[data-testid="appliance-review"]').catch(() => {});
  const finishClicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="appliance-finish"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('   clicked appliance-finish =', finishClicked);
  await delay(1500);

  const saveClicked = await clickText('Save Progress');
  console.log('   clicked "Save Progress" =', saveClicked);

  since('5. Wait for save to confirm (watching for the lock-timeout error specifically)');
  let saveConfirmed = false;
  for (let i = 0; i < 20; i++) {
    await delay(1500);
    const text = await bodyText();
    if (/saved|save.*complete|confirmed/i.test(text) && !/save failed/i.test(text)) { saveConfirmed = true; }
    const lockErrors = lockErrorsSince(t0);
    if (lockErrors.length) { console.log('   LOCK ERROR DURING SAVE:', JSON.stringify(lockErrors.map((l) => l.text))); break; }
  }
  console.log('   saveConfirmed (heuristic text match) =', saveConfirmed);
  console.log('   lock errors during this save window:', JSON.stringify(lockErrorsSince(t0).map((l) => l.text)));

  since('6. Reload and verify the new selection persisted');
  await page.reload({ waitUntil: 'domcontentloaded' });
  let restored = false;
  for (let i = 0; i < 30; i++) {
    await delay(2000);
    if ((await bodyText()).includes('New Job 03/09')) { restored = true; break; }
  }
  console.log('   job restored after reload =', restored);
  await delay(2000);

  since('7. Re-enter Bosch ovens and directly verify the SAME product is still marked selected');
  if (await page.evaluate(() => !!document.querySelector('[data-testid="guided-client-selections-home"]'))) {
    await page.evaluate(() => document.querySelector('[data-requirement-key="interior"]')?.click());
    await delay(800);
    await page.evaluate(() => document.querySelector('[data-requirement-key="appliances"]')?.click());
    await delay(800);
  }
  if (await page.evaluate(() => !!document.querySelector('[data-testid="appliance-brand-selection"]'))) {
    await page.evaluate(() => document.querySelector('[data-testid="appliance-brand-selection"] article[data-brand="Bosch"] button')?.click());
    await delay(1500);
  }
  const selectedAfterReload = await page.evaluate(() => {
    const el = document.querySelector('article.applianceModelCard.selected[data-product-id]');
    return el ? el.dataset.productId : null;
  });
  console.log('   product selected after reload =', selectedAfterReload, ' (expected =', alternative.productId, ')');
  console.log('   SELECTION SURVIVED REFRESH =', selectedAfterReload === alternative.productId);

  fs.writeFileSync('.claude-cs-save-console.json', JSON.stringify(consoleLines, null, 2));
  console.log('\nDONE');
} catch (error) {
  console.error('SCRIPT ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
