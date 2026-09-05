import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "cabinetry-products-categorisation", String(Date.now()));
fs.mkdirSync(outDir, { recursive: true });

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated Product Library verification requires Supabase URL, service role key and anon key.");
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

function url(query = "") {
  return `${baseUrl}${query ? `&${query}` : ""}`;
}

async function waitForSettledPage(page, selector, text = "") {
  await page.waitForSelector(selector, { visible: true, timeout: 90000 });
  if (text) {
    await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), { timeout: 90000 }, text);
  }
  await page.waitForFunction(() => {
    const textContent = (document.body?.innerText || "").trim();
    return textContent && !/^Loading\s*\.\.\.$/i.test(textContent);
  }, { timeout: 90000 });
  await new Promise((resolve) => setTimeout(resolve, 750));
}

async function assertStable(page, label, runtimeErrors, durationMs = 15000) {
  const firstUrl = page.url();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText || "",
    }));
    if (state.url !== firstUrl) throw new Error(`${label}: URL changed from ${firstUrl} to ${state.url}`);
    if (/^Loading\s*\.\.\.$/i.test(state.text.trim())) throw new Error(`${label}: page returned to loading-only state`);
    if (runtimeErrors.length) throw new Error(`${label}: runtime errors captured: ${runtimeErrors.join("\n")}`);
  }
}

function imageUrlFromCss(value = "") {
  return String(value || "").replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

const { session, supabaseUrl } = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl).hostname.split(".")[0]}-auth-token`;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1920, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
const runtimeErrors = [];
const consoleWarnings = [];
const failedRequests = [];
const urlSamples = [];

page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error" && /Maximum update depth|ReferenceError|is not defined|Cannot read|Cannot access|Unhandled Runtime Error/i.test(text)) {
    runtimeErrors.push(text);
  }
  if (message.type() === "warning") consoleWarnings.push(text);
});
page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) urlSamples.push(page.url());
});

await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

try {
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(outDir) });
  await page.goto(url('catalogueSection=cabinetry-joinery'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-catalogue-subcategory="cabinetry-products"]', {timeout: 90000});
  await page.click('[data-catalogue-subcategory="cabinetry-products"]');
  await page.waitForFunction(() => document.querySelector('[data-catalogue-subcategory="cabinetry-products"]')?.classList.contains('selected'));
  await page.waitForFunction(() => document.querySelector('.cabinetry-items-table')?.innerText.includes('Wardrobe hanging rail'));
  const rows = await page.$$eval('.cabinetry-items-table .catalogue-items-row', els => els.map(e=>e.getAttribute('data-catalogue-product-id')));
  const table = await page.$eval('.cabinetry-items-table', e=>e.innerText);
  if (!table.includes('Standard base unit') || !table.includes('Wardrobe hanging rail')) throw Error('Missing schedule endpoints');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.innerText.includes('Download Current Subcategory CSV')).click());
  const csvPath = path.join(outDir,'cabinetry-products.csv');
  for (let i=0; i<100 && !fs.existsSync(csvPath); i++) await new Promise(r=>setTimeout(r,100));
  const csv = fs.readFileSync(csvPath,'utf8');
  const { rowsFromCsv } = await import('../lib/product-library/productLibraryExchange.js');
  const { getMasterProducts, getEffectiveCabinetryCatalogue } = await import('../lib/product-library/catalogueService.js');
  const records = rowsFromCsv(csv);
  const expected = getMasterProducts().filter(p=>p.categoryKey === 'Cabinetry Products');
  const assert = (await import('node:assert/strict')).default;
  assert.equal(records.length, expected.length);
  assert.deepEqual(new Set(rows), new Set(expected.map(p=>p.productId || p.productCode)));
  assert.deepEqual(new Set(records.map(r=>r.product_id)),new Set(expected.map(p=>p.productId)));
  assert.ok(records.every(r=>r.category_name === 'Cabinetry Products' && r.section_name === 'Cabinetry'));
  const effective = getEffectiveCabinetryCatalogue({organisationId:'cabinetry-category-verification'});
  for (const product of expected) {
    const contract = effective.canonicalProducts.find(p=>p.stableProductId === product.productId);
    assert.equal(contract.categoryKey,'Cabinetry Products');
    assert.equal(contract.quotationSection,'Cabinetry');
  }
  await page.screenshot({path:path.join(outDir,'corrected-cabinetry-products.png'),fullPage:true});
  assert.deepEqual(runtimeErrors,[]);
  console.log(JSON.stringify({csv:csvPath,products:records.length,canonicalConsumerContracts:expected.length,first:expected[0].productName,last:expected.at(-1).productName}));
} finally { await browser.close(); }
