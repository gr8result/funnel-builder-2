// Authenticated browser regression. An optional PROFILE must be an isolated copy,
// never a user's live Chrome profile. The normal run uses a fresh temporary profile.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const baseUrl = process.env.PRODUCT_LIBRARY_TEST_BASE_URL || "http://localhost:3000";
const userDataDir = process.env.PRODUCT_LIBRARY_ISOLATED_PROFILE || "";
if (userDataDir) {
  const profile = path.resolve(userDataDir);
  assert.ok(profile.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`), "Only a temporary isolated profile is allowed");
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (link.error) throw link.error;
const auth = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
if (auth.error) throw auth.error;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, ...(userDataDir ? { userDataDir } : {}),
  args: ["--no-sandbox", "--disable-gpu"], protocolTimeout: 120000,
});
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "funnel-catalogue-startup-test-"));
const errors = [];
const blockedWrites = [];
const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const checkedProducts = ["PBH6B5K90A", "EC95GLB", "EC95GLS", "EC64GB", "EC64GS"].map((model) => {
  const product = catalogue.products.find((row) => row.manufacturerModel === model);
  assert.ok(product, `Missing catalogue model ${model}`);
  return product;
});
try {
  const control = await browser.newPage();
  // Establish same-origin storage and a real cross-tab save lock without mounting
  // application code or loading any job. Only this temporary profile is changed.
  await control.setRequestInterception(true);
  control.on("request", (request) => request.respond({ status: 200, contentType: "text/html", body: "<!doctype html><title>Isolated startup test</title>" }));
  await control.goto(baseUrl);
  const before = await control.evaluate(() => {
    const storageKey = "estimate-builder-explicit-active-job-key";
    const key = localStorage.getItem(storageKey) || "job:catalogue-startup-regression";
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, key);
    return { key, activeDraft: localStorage.getItem("estimate-builder-active-draft"), registeredJob: localStorage.getItem("estimate-builder-active-registered-job") };
  });
  await control.evaluate((jobKey) => new Promise((resolve) => {
    navigator.locks.request(`estimate-builder-save:${jobKey}`, async () => {
      await new Promise((release) => { window.releaseTestSaveLock = release; resolve(); });
    });
  }), before.key);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|TypeError|UNHANDLED_REJECTION|Maximum update depth/.test(message.text())) errors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      blockedWrites.push({ method: request.method(), url: request.url().split("?")[0] });
      return request.abort("blockedbyclient");
    }
    return request.continue();
  });
  await page.evaluateOnNewDocument(({ authKey, session }) => {
    localStorage.setItem(authKey, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", "846885cd-25b9-4eca-b9f9-3fd02f5882d8");
    window.jobStorageAccesses = [];
    window.jobSaveLockRequests = [];
    for (const method of ["get", "getAll", "getAllKeys", "openCursor", "openKeyCursor", "put", "add", "delete", "clear"]) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        if (this.transaction.db.name === "estimate-builder-template-db" && this.name === "jobs") window.jobStorageAccesses.push(method);
        return original.apply(this, args);
      };
    }
    const requestLock = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = function (name, ...args) {
      if (String(name).startsWith("estimate-builder-save:")) window.jobSaveLockRequests.push(name);
      return requestLock(name, ...args);
    };
    window.addEventListener("unhandledrejection", (event) => console.error("UNHANDLED_REJECTION", String(event.reason?.stack || event.reason)));
  }, { authKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, session: auth.data.session });
  const started = Date.now();
  const url = `${baseUrl}/modules/estimate-builder?page=productLibrary&room=butlers-pantry&roomCategory=kitchen-cooktops`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="kitchen-cooktops"] [data-room-product]', { timeout: 45000 }).catch(async (error) => {
    console.error(JSON.stringify({ url: page.url(), body: await page.$eval("body", (element) => element.innerText.slice(0, 6000)), errors, blockedWrites }, null, 2));
    await page.screenshot({ path: path.join(outDir, "failed-startup.png"), fullPage: true });
    throw error;
  });
  const loadedInMs = Date.now() - started;
  const verifiedCards = [];
  for (const product of checkedProducts) {
    const selector = `[data-room-product="${product.productId}"]`;
    await page.$eval(selector, (card) => card.scrollIntoView());
    await page.waitForFunction((selector) => {
      const image = document.querySelector(selector)?.querySelector(".product-pick img");
      return image?.complete && image.naturalWidth > 0;
    }, { timeout: 30000 }, selector);
    const card = await page.$eval(selector, (card) => ({ text: card.innerText, image: card.querySelector(".product-pick img").getAttribute("src") }));
    assert.ok(card.image.includes(product.primaryImage), `${product.manufacturerModel} uses its exact model image`);
    assert.doesNotMatch(card.text, /Price pending/);
    verifiedCards.push(product.manufacturerModel);
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const state = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("[data-room-product]").length,
    loadingJob: document.body.innerText.includes("Loading complete job..."),
    saveJobButton: [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Save Job"),
    jobStorageAccesses: window.jobStorageAccesses,
    jobSaveLockRequests: window.jobSaveLockRequests,
    explicitKey: localStorage.getItem("estimate-builder-explicit-active-job-key"),
    activeDraft: localStorage.getItem("estimate-builder-active-draft"),
    registeredJob: localStorage.getItem("estimate-builder-active-registered-job"),
    models: [...document.querySelectorAll("[data-room-product]")].map((card) => card.textContent),
  }));
  assert.equal(page.url(), url);
  assert.ok(state.cardCount > 0);
  assert.equal(state.loadingJob, false);
  assert.equal(state.saveJobButton, false, "Catalogue browsing must not expose a blank job save action");
  assert.deepEqual(state.jobStorageAccesses, [], "Catalogue startup must not read or write saved estimate records");
  assert.deepEqual(state.jobSaveLockRequests, [], "Catalogue startup must not wait for or acquire a job save lock");
  assert.equal(state.explicitKey, before.key);
  assert.equal(state.activeDraft, before.activeDraft);
  assert.equal(state.registeredJob, before.registeredJob);
  assert.ok(state.models.some((text) => text.includes("EC95GLB")));
  assert.ok(state.models.some((text) => text.includes("EC95GLS")));
  assert.equal(state.models.some((text) => text.includes("PCR6A5B90A")), false);
  const cardAudit = [];
  for (const product of catalogue.products.filter((record) => ["Bosch", "Euromaid"].includes(record.brandName) && record.familyId === "cooktops" && record.active !== false && record.selectable !== false)) {
    const selector = `[data-room-product="${product.productId}"]`;
    await page.$eval(selector, (card) => card.scrollIntoView());
    await page.waitForFunction((selector) => {
      const image = document.querySelector(selector)?.querySelector(".product-pick img");
      return !image || image.complete;
    }, { timeout: 30000 }, selector);
    const rendered = await page.$eval(selector, (card) => {
      const image = card.querySelector(".product-pick img");
      return { text: card.innerText, imageSrc: image?.getAttribute("src") || "", naturalWidth: image?.naturalWidth || 0, naturalHeight: image?.naturalHeight || 0, placeholder: /Image awaiting verification|Exact product image required/i.test(card.innerText), price: card.innerText.match(/\$[\d,.]+|Price pending|Quote required/)?.[0] || "" };
    });
    cardAudit.push({ brand: product.brandName, model: product.manufacturerModel, catalogueImageStatus: product.imageStatus, sourceUrl: product.research?.sourceOrganisation === "Harvey Norman Commercial" || /harveynormancommercial/.test(product.productPageUrl || "") ? product.productPageUrl : "", imageSourceUrl: product.imageSourceUrl || "", ...rendered });
  }
  assert.equal(cardAudit.filter((card) => card.brand === "Bosch").length, 14);
  assert.equal(cardAudit.filter((card) => card.brand === "Euromaid").length, 8);
  assert.equal(state.models.some((text) => /\bBlanco\b/i.test(text)), false);
  assert.ok(cardAudit.filter((card) => card.brand === "Bosch").every((card) => card.naturalWidth > 0 && !card.placeholder && card.price !== "Price pending"));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(outDir, "loaded-cooktops.png"), fullPage: true });
  const verifiedDetails = [];
  for (const product of checkedProducts) {
    await page.goto(`${url}&roomProduct=${encodeURIComponent(product.productId)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="product-library-product-detail"]', { timeout: 30000 });
    await page.waitForFunction(() => {
      const image = document.querySelector(".product-detail-media img");
      return image?.complete && image.naturalWidth > 0;
    }, { timeout: 30000 });
    const detail = await page.$eval('[data-testid="product-library-product-detail"]', (element) => ({
      text: element.innerText,
      image: element.querySelector(".product-detail-media img")?.getAttribute("src"),
      features: [...element.querySelectorAll('[data-testid="appliance-product-features"] li')].map((item) => item.innerText),
      links: [...element.querySelectorAll("a")].map((link) => link.href),
    }));
    assert.ok(detail.image.includes(product.primaryImage));
    assert.ok(detail.features.length > 0, `${product.manufacturerModel} exposes verified HNC features`);
    assert.ok(detail.links.includes(product.productPageUrl), `${product.manufacturerModel} links to its exact HNC source`);
    assert.doesNotMatch(detail.text, /Price pending/);
    for (const value of [product.widthMm, product.depthMm, product.heightMm].filter((value) => value != null)) assert.ok(detail.text.includes(String(value)), `${product.manufacturerModel} shows dimension ${value}`);
    assert.deepEqual(await page.evaluate(() => window.jobStorageAccesses), []);
    await page.screenshot({ path: path.join(outDir, `detail-${product.manufacturerModel}.png`), fullPage: true });
    verifiedDetails.push(product.manufacturerModel);
  }
  await control.evaluate(() => window.releaseTestSaveLock());
  const report = { catalogueResult: "PASS", url, loadedInMs, cardCount: state.cardCount, blancoVisible: 0, jobStorageAccesses: state.jobStorageAccesses, jobSaveLockRequests: state.jobSaveLockRequests, activeJobPointerPreserved: true, verifiedCards, verifiedDetails, cardAudit, errors, blockedWrites, artifacts: outDir };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ catalogueResult: "PASS", cardCount: state.cardCount, auditedCards: cardAudit.length, artifacts: outDir }));
  let jobReturnVerified = false;
  let workbookStatePreserved = false;
  if (process.env.PRODUCT_LIBRARY_VERIFY_JOB_RETURN === "1") {
    assert.ok(userDataDir, "Real-job return verification requires an isolated copied profile");
    const jobName = await control.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open("estimate-builder-template-db"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try {
        return await new Promise((resolve, reject) => { const request = db.transaction("jobs", "readonly").objectStore("jobs").get("active-job"); request.onsuccess = () => resolve(request.result?.name || ""); request.onerror = () => reject(request.error); });
      } finally { db.close(); }
    });
    assert.ok(jobName, "The copied active-job pointer must identify the saved job");
    await page.goto(`${baseUrl}/modules/estimate-builder?page=quotation`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction((name) => document.body.innerText.includes(name) && !document.body.innerText.includes("Loading complete job..."), { timeout: 90000 }, jobName).catch(async (error) => {
      report.jobReturn = { result: "FAIL", message: error.message, body: await page.$eval("body", (element) => element.innerText.slice(0, 4000)), errors };
      fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
      throw error;
    });
    const returned = await page.evaluate(() => ({ key: localStorage.getItem("estimate-builder-explicit-active-job-key"), accessed: window.jobStorageAccesses, requested: window.jobSaveLockRequests }));
    assert.equal(returned.key, before.key);
    assert.ok(returned.accessed.includes("get"));
    assert.ok(returned.requested.length > 0);
    jobReturnVerified = true;
  }
  if (process.env.PRODUCT_LIBRARY_VERIFY_WORKBOOK_NAVIGATION === "1" || jobReturnVerified) {
    if (!jobReturnVerified) {
      await page.goto(`${baseUrl}/modules/estimate-builder?page=quotation`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector('input[placeholder="Search line item"]', { timeout: 30000 });
    }
    // Search is hook-local state, intentionally not saved in any job. Its survival
    // proves sidebar catalogue navigation keeps the open workbook mounted.
    await page.type('input[placeholder="Search line item"]', "catalogue-navigation-state-check");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "Product Library").click());
    await page.waitForFunction(() => new URLSearchParams(location.search).get("page") === "productLibrary");
    await page.waitForFunction(() => document.body.innerText.includes("Browse by Room"), { timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "Quotation Builder").click());
    await page.waitForSelector('input[placeholder="Search line item"]', { timeout: 30000 });
    assert.equal(await page.$eval('input[placeholder="Search line item"]', (input) => input.value), "catalogue-navigation-state-check");
    workbookStatePreserved = true;
  }
  assert.deepEqual(errors, []);
  Object.assign(report, { result: "PASS", jobReturnVerified, workbookStatePreserved });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
