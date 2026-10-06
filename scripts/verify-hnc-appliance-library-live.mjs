import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import { createApplianceCatalogueSelectors, filterApplianceRecords } from "../lib/product-library/applianceCatalogueSelectorsCore.js";
import { applianceHncPriceLabel, applianceSpecificationEntries } from "../lib/product-library/applianceCataloguePresentation.js";

dotenv.config({ path: ".env.local", quiet: true });
const read = (name) => JSON.parse(fs.readFileSync(`data/product-library/catalogues/appliances/${name}.json`, "utf8"));
const selectors = createApplianceCatalogueSelectors({ productCatalogue: read("AU-APPLIANCE-CATALOGUE"), packCatalogue: read("AU-APPLIANCE-PACKS"), brandCatalogue: read("AU-APPLIANCE-BRANDS") });
const base = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/builders/product-library?catalogue=appliances";
const brandArg = process.argv.find((arg) => arg.startsWith("--brand="))?.split("=")[1];
const smoke = process.argv.includes("--smoke");
const brands = brandArg ? [brandArg] : ["Whirlpool", "Euromaid"];
const out = path.resolve("artifacts/test-artifacts/hnc-appliances-20260916");
fs.mkdirSync(out, { recursive: true });
const report = { url: base, checkedAt: new Date().toISOString(), brands: {}, screenshots: [], pageErrors: [], consoleErrors: [], failedRequests: [], blockedWrites: [] };
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const browserSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (linkError) throw linkError;
const auth = createClient(browserSupabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error: loginError } = await auth.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (loginError) throw loginError;
assert(login?.session?.access_token, "Authenticated browser session is required");
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"], timeout: 60000 });
const page = await browser.newPage();
page.setDefaultTimeout(60000);
await page.setViewport({ width: 1920, height: 1080 });
await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(browserSupabaseUrl).hostname.split(".")[0]}-auth-token`, session: login.session });
await page.setRequestInterception(true);
page.on("request", (request) => {
  if (!/^(GET|HEAD|OPTIONS)$/.test(request.method()) && /supabase\.(co|in)\/(rest|storage)\/v1\//.test(request.url())) {
    report.blockedWrites.push({ method: request.method(), url: request.url() });
    void request.abort();
  } else void request.continue();
});
page.on("pageerror", (error) => report.pageErrors.push({ message: error.message, stack: error.stack, url: page.url(), at: new Date().toISOString() }));
page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
page.on("requestfailed", (request) => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
const productSelector = "[data-testid='appliance-model-list'] [data-appliance-family][data-appliance-product]";
const ids = () => page.$$eval(productSelector, (cards) => cards.map((card) => card.dataset.applianceProduct).sort());
async function expectIds(records) {
  const expected = records.map((record) => record.productId).sort();
  await page.waitForFunction((selector, expectedIds) => JSON.stringify([...document.querySelectorAll(selector)].map((card) => card.dataset.applianceProduct).sort()) === JSON.stringify(expectedIds), {}, productSelector, expected);
  assert.deepEqual(await ids(), expected);
}
async function shot(name, selector) {
  if (selector) await page.$eval(selector, (node) => node.scrollIntoView({ block: "start" }));
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push(path.relative(process.cwd(), file));
}
async function landing() {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='appliance-brand-list']", { visible: true });
}
try {
  await landing();
  report.visibleBrands = await page.$$eval("[data-appliance-brand]", (nodes) => nodes.map((node) => node.dataset.applianceBrand));
  if (!smoke) assert.deepEqual(report.visibleBrands, ["Bosch", "Euromaid", "Omega", "Smeg", "Westinghouse", "Whirlpool"]);
  for (const brand of report.visibleBrands) {
    const selector = `[data-appliance-brand='${brand}']`;
    await page.waitForFunction((s) => { const image = document.querySelector(`${s} img`); return image?.complete && image.naturalWidth > 0; }, {}, selector);
  }
  await shot("01-six-brand-cards", "[data-testid='appliance-brand-list']");
  if (!smoke) for (const brand of brands) {
    if (!await page.$("[data-testid='appliance-brand-list']")) await landing();
    const records = selectors.getActiveProductLibraryApplianceRecords().filter((record) => record.brand === brand);
    const packs = selectors.getApplianceRecordsByFamily("appliance-packs").filter((record) => record.brand === brand);
    const card = `[data-appliance-brand='${brand}']`;
    const cardText = await page.$eval(card, (node) => node.innerText);
    assert(cardText.includes(`${records.length} individual product`), `${brand} count on brand card`);
    assert(cardText.includes(`${packs.length} safe package`), `${brand} package count on brand card`);
    const selectable = records.filter((record) => record.selectableStatus === "client-selectable");
    const selectableCount = selectable.length + packs.filter((record) => record.selectableStatus === "client-selectable").length;
    assert(cardText.includes(`${selectableCount} selectable`), `${brand} selectable count on brand card`);
    await page.click(`${card} .tile-actions button`);
    await page.waitForSelector("[data-testid='appliance-model-list']", { visible: true });
    await expectIds(records);
    const imageChecks = [];
    for (const record of records) {
      // Scroll each card into view so its exact-model lazy image actually loads.
      const cardSelector = `[data-appliance-product='${record.productId}']`;
      await page.$eval(cardSelector, (node) => node.scrollIntoView({ block: "center" }));
      await page.waitForFunction((s, expected) => [...document.querySelectorAll(`${s} img`)].some((img) => img.getAttribute("src") === expected && img.complete && img.naturalWidth > 1), {}, cardSelector, record.image);
      const text = await page.$eval(cardSelector, (node) => node.innerText);
      assert(text.includes(record.model), `${brand} model ${record.model}`);
      assert(text.includes(record.name), `${brand} title ${record.model}`);
      if (record.hncPrice == null && record.price == null) assert(text.includes("Quote required"), `${record.model}: unavailable HNC price shown honestly`);
      const selectDisabled = await page.$eval(cardSelector, (node) => [...node.querySelectorAll("button")].find((button) => button.textContent.includes("Select Product"))?.disabled);
      assert.equal(selectDisabled, record.selectableStatus !== "client-selectable", `${record.model}: selection button matches eligibility`);
      imageChecks.push({ model: record.model, image: record.image, loaded: true });
    }
    await shot(`${brand.toLowerCase()}-products`, `[data-appliance-product='${records[0].productId}']`);
    const searchModel = records[0].model;
    await page.type("[aria-label='Search appliances']", searchModel);
    await expectIds(filterApplianceRecords(records, { search: searchModel }));
    await page.click("[aria-label='Search appliances']", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await expectIds(records);
    const categoryChecks = [];
    for (const family of [...new Set(records.map((record) => record.familyId))]) {
      await page.select("[aria-label='Appliance category']", family);
      await expectIds(records.filter((record) => record.familyId === family));
      categoryChecks.push({ family, count: records.filter((record) => record.familyId === family).length });
    }
    await page.select("[aria-label='Appliance category']", "");
    await expectIds(records);
    await page.select("[aria-label='Appliance selectable status']", "client-selectable");
    await expectIds(selectable);
    await page.select("[aria-label='Appliance selectable status']", "not-client-selectable");
    await expectIds(records.filter((record) => record.selectableStatus !== "client-selectable"));
    await page.select("[aria-label='Appliance selectable status']", "");
    await page.select("[aria-label='Appliance eligibility']", "active-selectable");
    await expectIds(records.filter((record) => record.eligibility === "active-selectable"));
    await page.select("[aria-label='Appliance eligibility']", "");
    await expectIds(records);
    const details = [];
    for (const family of [...new Set(records.map((record) => record.familyId))]) {
      const record = records.find((row) => row.familyId === family);
      const cardSelector = `[data-appliance-product='${record.productId}']`;
      await page.$eval(cardSelector, (node) => [...node.querySelectorAll("button")].find((button) => button.textContent.includes("View Details")).click());
      await page.waitForSelector(".appliance-detail-layout", { visible: true });
      const detail = await page.$eval(".appliance-detail-layout", (node) => node.innerText);
      assert(detail.includes(record.model));
      assert(detail.replace(/\s+/g, " ").includes(record.description.replace(/\s+/g, " ").slice(0, 70)), `${record.model} full description in details`);
      assert(/Specification/i.test(detail), `${record.model} specifications in details`);
      const specificationsText = await page.$eval("[data-testid='appliance-product-specifications']", (node) => node.innerText.replace(/\s+/g, " "));
      for (const entry of applianceSpecificationEntries(record)) assert(specificationsText.includes(entry.value.replace(/\s+/g, " ")), `${record.model}: specification ${entry.label}`);
      const links = await page.$$eval(".appliance-detail-layout a", (nodes) => nodes.map((node) => node.href));
      assert(links.includes(record.productPageUrl), `${record.model} exact source link`);
      for (const source of [record.imageSourceUrl, record.manufacturerUrl].filter(Boolean)) assert(links.includes(source), `${record.model} source ${source}`);
      assert(detail.includes(record.sourceCheckedAt), `${record.model} checked date`);
      if (record.manualReviewRequired) assert(detail.includes(record.manualReviewReason), `${record.model}: source conflict visible`);
      if (Number(record.hncPrice) > 0) assert.equal(await page.$eval("[data-testid='appliance-hnc-price']", (node) => node.innerText), applianceHncPriceLabel(record), `${record.model} verified HNC price`);
      await page.waitForFunction((expected) => [...document.querySelectorAll(".appliance-detail-layout img")].some((img) => img.getAttribute("src") === expected && img.complete && img.naturalWidth > 1), {}, record.image);
      await shot(`${brand.toLowerCase()}-${family}-details`, ".appliance-detail-layout");
      details.push({ model: record.model, family, description: true, specifications: true, source: record.productPageUrl, price: record.hncPrice ?? null });
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("[data-testid='appliance-model-list']", { visible: true });
      await expectIds(records);
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("[data-testid='appliance-model-list']", { visible: true });
    await expectIds(records);
    report.brands[brand] = { products: records.length, packages: packs.length, selectable: selectableCount, images: imageChecks, search: true, categoryFilters: categoryChecks, eligibilityFilter: true, selectableFilter: true, details, refresh: true };
    console.log(`${brand}: ${records.length} products; images, search, categories, details, selectable filtering and refresh PASS`);
  }
  await landing();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='appliance-brand-list']", { visible: true });
  const refreshedBrands = await page.$$eval("[data-appliance-brand]", (nodes) => nodes.map((node) => node.dataset.applianceBrand));
  assert.deepEqual(refreshedBrands, report.visibleBrands);
  report.refreshBrands = refreshedBrands;
  assert.deepEqual(report.pageErrors, [], "No browser runtime errors");
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  report.failureUrl = page.url();
  report.failureText = await page.evaluate(() => document.body.innerText).catch(() => "");
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  throw error;
} finally {
  const name = smoke ? "smoke" : brandArg?.toLowerCase() || "both-brands";
  fs.writeFileSync(path.join(out, `${name}-browser-report.json`), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ result: report.result, visibleBrands: report.visibleBrands, output: out }, null, 2));
