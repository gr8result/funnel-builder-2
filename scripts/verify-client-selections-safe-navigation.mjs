import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.resolve('test-artifacts/client-selections-safe-navigation');
fs.mkdirSync(outDir, { recursive: true });
async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated runtime verification requires Supabase URL, service role key and anon key.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  if (!data?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
  return { session: data.session, supabaseUrl };
}

const { session, supabaseUrl } = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl).hostname.split(".")[0]}-auth-token`;

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 300000, defaultViewport: { width: 1500, height: 1000 } });
const errors = [], steps = [], requests = [];
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Invariant|hard navigate|Maximum update depth|Unhandled Runtime Error|ReferenceError|TypeError/.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) requests.push(request.url()); });
  await page.evaluateOnNewDocument(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    window.__navigationAudit = [];
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method].bind(history);
      history[method] = (state, title, url) => {
        const before = location.href;
        window.__navigationAudit.push({ method, before, after: url ? new URL(url, before).href : before, nextState: Boolean(state?.__N) });
        return original(state, title, url);
      };
    }
  }, { key: storageKey, session });
  async function stable(label, expectedPage, expectedRoom = null) {
    await page.waitForFunction(expected => new URL(location.href).searchParams.get('page') === expected, {}, expectedPage);
    if (expectedPage === 'clientSelections') {
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('room') && !new URL(location.href).searchParams.has('roomCategory'));
      await page.waitForFunction(() => document.body.innerText.includes('Client Selections') && document.querySelectorAll('.project-workspace-nav-button').length > 0);
    }
    const urls = [], texts = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      urls.push(page.url());
      texts.push(await page.evaluate(() => document.body.innerText));
    }
    assert.equal(new Set(urls).size, 1, label + ': URL loop');
    assert(!texts.some(text => /^Loading[.\s]*$/.test(text) || /Unhandled Runtime Error|attempted to hard navigate/.test(text)), label + ': flashing/error');
    if (expectedRoom) assert.equal(new URL(page.url()).searchParams.get('roomCategory'), expectedRoom);
    assert.equal(errors.length, 0, errors.join('\n'));
    steps.push({ label, url: page.url(), history: await page.evaluate(() => window.__navigationAudit) });
    await page.screenshot({ path: path.join(outDir, label + '.png'), fullPage: false });
    console.log(label, page.url());
  }
  async function leftNav(title) {
    await page.waitForSelector('.project-workspace-nav-button');
    await page.evaluate(title => {
      const button = [...document.querySelectorAll('.project-workspace-nav-button')].find(button => button.innerText.trim() === title);
      if (!button) throw new Error('Left navigation missing: ' + title);
      button.click();
    }, title);
  }
  const exactFailingUrl = 'http://localhost:3000/modules/estimate-builder?page=clientSelections&room=kitchen&roomCategory=kitchen-ovens';
  await page.goto(exactFailingUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await stable('01-exact-failing-url', 'clientSelections');
  await leftNav('Product Library');
  await page.waitForSelector('[data-testid="product-library-room-landing"]');
  await leftNav('Client Selections');
  await stable('02-left-navigation', 'clientSelections');
  await leftNav('Product Library');
  await page.waitForSelector('[data-testid="product-library-room-landing"]');
  await page.click('button[data-room-key="kitchen"]');
  await page.waitForSelector('button[data-room-category="kitchen-ovens"]');
  await page.click('button[data-room-category="kitchen-ovens"]');
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="kitchen-ovens"]');
  await stable('03-kitchen-ovens', 'productLibrary', 'kitchen-ovens');
  await leftNav('Client Selections');
  await stable('04-back-to-client-selections', 'clientSelections');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await stable('05-refresh', 'clientSelections');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="kitchen-ovens"]');
  await stable('06-browser-back', 'productLibrary', 'kitchen-ovens');
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await stable('07-browser-forward', 'clientSelections');
  const beforeRepeat = await page.evaluate(() => window.__navigationAudit.length);
  await leftNav('Client Selections');
  await stable('08-repeat-current-navigation', 'clientSelections');
  const afterRepeat = await page.evaluate(() => window.__navigationAudit.length);
  assert.equal(afterRepeat, beforeRepeat, 'Same-page left navigation must not write history.');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ exactFailingUrl, passed: true, steps, errors, requests }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ passed: false, message: error.message, steps, errors, requests }, null, 2));
  throw error;
} finally { await browser.close(); }
