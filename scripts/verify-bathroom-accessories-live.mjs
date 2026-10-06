// Run against the local app. Uses a disposable browser/job and blocks database writes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { discoverBathroomAccessoryTypes } from "../lib/product-library/bathroomAccessoryDiscovery.js";
import { plumbingSubcategoryForProduct } from "../lib/product-library/catalogueSectionRules.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const origin = process.argv.find((arg) => arg.startsWith("--origin="))?.slice("--origin=".length) || process.env.INTERNAL_TEST_ORIGIN || "http://localhost:3000";
const out = path.resolve("artifacts/test-artifacts/bathroom-accessories");
fs.mkdirSync(out, { recursive: true });
const report = { passed: false, cards: [], errors: [] };
const catalogueProducts = getEffectiveProductCatalogue().products;
const expected = discoverBathroomAccessoryTypes(catalogueProducts);
const imported = catalogueProducts.filter(p => p.attributes?.accessoryImportBatch === "hnc-bathroom-five-brands-v1");
const projectId = "bathroom-accessory-discovery-verification";
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ["aiPlanTakeoffJob", "takeoffEngine", "takeoffSchedule", "clientSelectionsBook"]) delete defaults[key];
const workbook = { ...defaults, templateType: "job", page: "clientSelections", projectId, commercialProjectId: projectId, registeredJobId: projectId,
  registeredJob: { jobId: projectId, jobName: "Bathroom Accessories Verification", jobNumber: "BA-TEST", clientName: "Test client", siteAddress: "Test address" } };
const fixture = path.join(out, "verification-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: "Bathroom Accessories Verification", workbook }));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (error) throw error;
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 180000, defaultViewport: { width: 1600, height: 1100 } });
fs.writeFileSync(path.join(out, "browser-endpoint.txt"), browser.wsEndpoint());
const page = await browser.newPage();
page.setDefaultTimeout(180000);
page.on("pageerror", (error) => report.errors.push(error.message));
await page.setRequestInterception(true);
page.on("request", (r) => r.url().includes("/rest/v1/") && !["GET", "HEAD", "OPTIONS"].includes(r.method()) ? r.abort() : r.continue());
await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`, session: auth.session });
const hub = '[data-testid="guided-category-bathroom-accessories"]';
const waitForHub = async () => {
  await page.waitForFunction((hub, count) => document.querySelectorAll(`${hub} [data-requirement-key]`).length === count, {}, hub, expected.length);
  await page.waitForFunction(() => new URL(location.href).searchParams.get("selectionCategory") === "bathroom-accessories" && !new URL(location.href).searchParams.has("selectionRequirement"));
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clickText = async (text) => page.evaluate((text) => {
  const b = [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && !b.disabled && b.innerText.trim() === text);
  if (b) b.click();
  return Boolean(b);
}, text);
const waitClickText = async (text) => page.waitForFunction((text) => {
  const b = [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && !b.disabled && b.innerText.trim() === text);
  if (!b) return false;
  b.click();
  return true;
}, {}, text);
try {
  console.log("Opening local app");
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 180000 });
  console.log("Local app loaded");
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(fixture);
  for (let i = 0; i < 6; i++) {
    await pause(1000);
    for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) await clickText(label);
  }
  await page.waitForFunction(() => {
    if (document.querySelector('button[data-category-key="bathroom-accessories"]')) return true;
    document.querySelector('button[data-category-key="interior"]')?.click();
    return false;
  }, { polling: 1000 });
  await page.waitForSelector('button[data-category-key="bathroom-accessories"]');
  await page.$eval('button[data-category-key="bathroom-accessories"]', (b) => b.click());
  await waitForHub();
  console.log("Bathroom Accessories open");
  const cards = await page.$$eval(`${hub} [data-requirement-key]`, (cards) => cards.map((card) => ({ key: card.dataset.requirementKey, label: card.querySelector("h3").innerText, count: Number(card.innerText.match(/(\d+) products? available/)?.[1] || 0) })));
  assert.deepEqual(cards.map((c) => c.key), expected.map((g) => g.key));
  await (await page.$(hub)).screenshot({ path: path.join(out, "01-expanded-accessory-cards.png") });
  for (const card of cards) {
    const group = expected.find((g) => g.key === card.key);
    assert.equal(card.count, group.products.length, card.key + " count");
    await page.$eval(`${hub} [data-requirement-key="${card.key}"] .plumbingCategoryBody > button`, (b) => b.click());
    console.log("Opening", card.key);
    await page.waitForSelector('[data-testid="guided-plumbing-fixture-products"]');
    await page.waitForFunction((key) => new URL(location.href).searchParams.get("selectionRequirement") === key, {}, card.key);
    await page.waitForFunction((count) => document.querySelectorAll(".plumbingProductCard").length === count, {}, card.count);
    const codes = await page.$$eval(".plumbingProductCard", (cards) => cards.map((card) => card.dataset.productCode));
    assert.deepEqual(new Set(codes), new Set(group.products.map((p) => p.productCode)), card.key + " exact Product Library items");
    assert.equal(codes.length, new Set(codes).size, card.key + " no duplicates");
    for (const product of group.products.filter(p => p.attributes?.accessoryImportBatch === "hnc-bathroom-five-brands-v1")) {
      const selector = `.plumbingProductCard[data-product-code="${product.productCode}"]`;
      const text = await page.$eval(selector, node => node.innerText);
      assert(text.includes(product.brand) && text.includes(product.model), `${product.productCode}: brand and SKU`);
      const price = await page.$eval(`${selector} .guidedProductMoney .guidedMiniTotal strong`, node => Number(node.innerText.replace(/[^0-9.]/g, "")));
      assert.equal(price, product.clientPrice, `${product.productCode}: real price`);
      await page.$eval(selector, node => node.scrollIntoView());
      await page.waitForFunction(selector => { const image = document.querySelector(`${selector} img`); return image?.complete && image.naturalWidth > 0; }, {}, selector);
    }
    await page.screenshot({ path: path.join(out, `${card.key}.png`) });
    report.cards.push({ ...card, verifiedProductCodes: codes });
    console.log(`Verified ${card.label}: ${codes.length} products`);
    // The existing product-selection dialog still opens for new types.
    if (card.key === "soap-dispenser") {
      await page.$eval(".plumbingProductCard .guidedProductActions .primary", (b) => b.click());
      await page.waitForSelector('[data-testid="plumbing-allocation-modal"]');
      report.allocationDialog = true;
      await waitClickText("Cancel");
    }
    await waitClickText("← All Bathroom Accessories");
    await waitForHub();
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await waitForHub();
  assert.equal(await page.$$eval(`${hub} [data-requirement-key]`, (cards) => cards.length), expected.length);
  report.reload = true;
  report.url = page.url();
  if (imported.length) {
    console.log("Verifying Product Library Bathroom Accessories");
    await page.goto(`${origin}/modules/estimate-builder?page=productLibrary&catalogueSection=plumbing-fixtures-tapware&catalogueSubcategory=bathroom-accessories`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector('[data-testid="plumbing-catalogue-category"][data-plumbing-category="bathroom-accessories"]');
    const libraryProducts = catalogueProducts.filter(p => plumbingSubcategoryForProduct(p) === "bathroom-accessories" && p.active !== false && !p.archived);
    await page.waitForFunction(count => document.querySelectorAll("[data-plumbing-product]").length === count, {}, libraryProducts.length);
    const libraryCodes = await page.$$eval("[data-plumbing-product]", cards => cards.map(card => card.dataset.plumbingProduct));
    assert.deepEqual(new Set(libraryCodes), new Set(libraryProducts.map(p => p.productId || p.productCode)));
    report.productLibrary = { count: libraryCodes.length, checkedDetails: [] };
    const samples = [...new Map(imported.map(p => [p.brand, p])).values()];
    for (const product of samples) {
      const selector = `[data-plumbing-product="${product.productId || product.productCode}"]`;
      await page.$eval(selector, node => node.scrollIntoView());
      await page.waitForFunction(selector => { const image = document.querySelector(`${selector} img`); return image?.complete && image.naturalWidth > 0; }, {}, selector);
      await page.$eval(`${selector} button`, button => button.click());
      await page.waitForSelector(".plumbing-detail-overlay");
      const detail = await page.$eval(".plumbing-detail-overlay", node => node.innerText.replace(/\s+/g, " "));
      assert(detail.includes(product.brand) && detail.includes(product.model), `${product.productCode}: library details`);
      assert(detail.includes(product.description.replace(/\s+/g, " ")), `${product.productCode}: real description`);
      const detailPrice = await page.$eval('.plumbing-detail-price', node => Number(node.innerText.replace(/[^0-9.]/g, "")));
      assert.equal(detailPrice, product.clientPrice, `${product.productCode}: detail price`);
      await page.waitForFunction(() => { const image = document.querySelector(".plumbing-detail-image img"); return image?.complete && image.naturalWidth > 0; });
      await page.screenshot({ path: path.join(out, `library-${product.brand.toLowerCase()}.png`) });
      report.productLibrary.checkedDetails.push({ code: product.productCode, brand: product.brand, description: true, price: product.clientPrice, image: true });
      await page.click('.plumbing-detail-close');
    }
    await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await waitForHub();
  }
  assert.deepEqual(report.errors, []);
  report.totalProducts = report.cards.reduce((sum, card) => sum + card.count, 0);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, cards: report.cards.length, products: report.totalProducts, reload: true }));
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  fs.writeFileSync(path.join(out, "failure.txt"), await page.evaluate(() => document.body.innerText).catch(() => ""));
  throw error;
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
