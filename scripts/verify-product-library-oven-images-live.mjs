import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const root = process.cwd();
const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const productLibraryUrl = `${baseUrl}/modules/estimate-builder?page=productLibrary`;
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const johnsonJobFilePath = "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json"), "utf8"));
const outDir = path.join(root, "test-artifacts", "product-library-oven-images-live");
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (/\.png$/i.test(file)) fs.rmSync(path.join(outDir, file), { force: true });
}

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values for authenticated browser verification.");

const checkedModels = [
  "FA5834HIXAAUS",
  "FI9 891 SP IX A AUS",
  "BOSE65XM",
  "BOSE90X",
  "OBO660X",
  "OBO960X1",
  "SF64M3TVX",
  "SFPA9395X1",
];

const detailModels = ["FA5834HIXAAUS", "BOSE65XM", "OBO660X", "OBO960X1", "SF64M3TVX", "SFPA9395X1"];
const byModel = new Map((catalogue.products || []).map((item) => [normaliseModel(item.manufacturerModel), item]));

const session = await mintSession();
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1920, height: 1080 },
  timeout: 60000,
});

const consoleEntries = [];
const failedRequests = [];
const imageResponses = new Map();

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleEntries.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => consoleEntries.push({ type: "pageerror", text: error.message }));
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "" }));
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/images/catalogues/appliances/products/")) imageResponses.set(new URL(url).pathname, response.status());
  });
  await primeSession(page, session);

  const ovenUrl = `${productLibraryUrl}&room=kitchen&roomCategory=ovens`;
  await page.goto(ovenUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="ovens"]', { visible: true });
  await waitForText(page, "Ovens");
  await assertOvenGrid(page);
  await screenshot(page, "01-product-library-kitchen-ovens-grid.png", true);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="ovens"]', { visible: true });
  await assertOvenGrid(page);

  const detailShots = [];
  for (const model of detailModels) {
    const product = productByModel(model);
    await page.goto(`${productLibraryUrl}&room=kitchen&roomCategory=ovens&roomProduct=${encodeURIComponent(product.productId)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(`[data-testid="product-library-product-detail"][data-room-product="${cssEscape(product.productId)}"]`, { visible: true });
    await waitForText(page, model);
    await assertDetailImage(page, product);
    const file = `${String(detailShots.length + 2).padStart(2, "0")}-product-library-detail-${slug(model)}.png`;
    await screenshot(page, file, false);
    detailShots.push(file);
  }

  await page.goBack({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="product-library-product-detail"]', { visible: true });

  await verifyClientSelections(page);

  const severeConsole = consoleEntries.filter((entry) => /Maximum update depth|ReferenceError|TypeError|Unhandled Runtime|not defined|Cannot read/i.test(entry.text));
  assert.deepEqual(severeConsole, [], `Runtime errors were logged: ${JSON.stringify(severeConsole, null, 2)}`);
  const localFailures = failedRequests.filter((entry) => entry.url.includes("/images/catalogues/appliances/products/"));
  assert.deepEqual(localFailures, [], `Local appliance images failed: ${JSON.stringify(localFailures, null, 2)}`);
  for (const model of detailModels) {
    const imagePath = productByModel(model).primaryImage;
    assert.equal(imageResponses.get(imagePath), 200, `${model} browser image response should be 200 for ${imagePath}`);
  }

  console.log(JSON.stringify({
    result: "passed",
    productLibraryUrl: ovenUrl,
    checkedModels,
    detailModels,
    imageResponses: Object.fromEntries(imageResponses),
    consoleEntries,
    failedRequests,
    screenshots: fs.readdirSync(outDir).filter((file) => file.endsWith(".png")).map((file) => path.join("test-artifacts", "product-library-oven-images-live", file)),
  }, null, 2));
} finally {
  await browser.close();
}

async function mintSession() {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (error) throw error;
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError) throw verifyError;
  if (!data?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
  return data.session;
}

async function primeSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.goto(`${baseUrl}/modules/estimate-builder?page=productLibrary`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(({ key, value, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, value: authSession, workspaceId });
}

async function assertOvenGrid(page) {
  const body = await page.evaluate(() => document.body.innerText);
  assert.match(body, /Browse by Room/i);
  assert.match(body, /Kitchen/i);
  assert.match(body, /Ovens/i);
  for (const model of checkedModels) {
    const product = productByModel(model);
    const state = await cardState(page, product.productId);
    assert.ok(state.text.includes(model), `${model} card should be visible`);
    if (product.primaryImage) {
      assert.ok(state.imgSrc.includes(product.primaryImage), `${model} card should use canonical primaryImage`);
      assert.ok(state.naturalWidth > 0 && state.naturalHeight > 0, `${model} card image should decode`);
      assert.equal(state.hasAwaitingText, false, `${model} should not show awaiting verification`);
    } else {
      assert.equal(state.imgSrc, "", `${model} should not have a substituted image`);
      assert.equal(state.hasAwaitingText, true, `${model} should show neutral unresolved state`);
    }
  }
}

async function assertDetailImage(page, product) {
  const state = await page.$eval(".product-detail-media", (section) => {
    const image = section.querySelector("img");
    return {
      imgSrc: image?.getAttribute("src") || "",
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      text: section.innerText || "",
    };
  });
  assert.ok(state.imgSrc.includes(product.primaryImage), `${product.manufacturerModel} detail should use canonical primaryImage`);
  assert.ok(state.naturalWidth > 0 && state.naturalHeight > 0, `${product.manufacturerModel} detail image should decode`);
}

async function verifyClientSelections(page) {
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const fileInput = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 12000 }).catch(() => null);
  if (fileInput && fs.existsSync(johnsonJobFilePath)) {
    await fileInput.uploadFile(johnsonJobFilePath);
    await waitForAnyText(page, ["Discard Changes", "Johnson", "Client Selections"], 90000);
    if ((await page.evaluate(() => document.body.innerText.includes("Discard Changes")))) await clickExactButton(page, "Discard Changes");
  }
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]', '[data-testid="appliance-brand-selection"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) await clickByRequirementKey(page, "appliances");
  await page.waitForSelector('[data-testid="appliance-brand-selection"]', { visible: true });
  await clickBrand(page, "Omega");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Omega"]', { visible: true });
  await clickByTestId(page, "appliance-build-mode");
  await page.waitForSelector('[data-testid="appliance-build-your-own"][data-brand="Omega"]', { visible: true });
  await clickFamilyType(page, "ovens");
  await page.waitForSelector('[data-testid="appliance-model-grid"]', { visible: true });
  await waitForText(page, "OBO660X");
  for (const model of ["OBO660X", "OBO960X1"]) {
    const product = productByModel(model);
    const testId = `appliance-model-${slug(model)}`;
    const state = await page.$eval(`[data-testid="${testId}"]`, (card) => {
      const image = card.querySelector("img");
      return {
        src: image?.getAttribute("src") || "",
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0,
        text: card.innerText || "",
      };
    });
    assert.ok(state.src.includes(product.primaryImage), `Client Selections ${model} should inherit Product Library primaryImage`);
    assert.ok(state.naturalWidth > 0 && state.naturalHeight > 0, `Client Selections ${model} image should decode`);
  }
  await screenshot(page, "08-client-selections-omega-ovens-grid.png", true);
}

async function cardState(page, productId) {
  return page.$eval(`[data-room-product="${cssEscape(productId)}"]`, (card) => {
    const image = card.querySelector(".product-pick img");
    return {
      text: card.innerText || "",
      imgSrc: image?.getAttribute("src") || "",
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      hasAwaitingText: /Image awaiting verification/i.test(card.innerText || ""),
    };
  });
}

function productByModel(model) {
  const product = byModel.get(normaliseModel(model));
  if (!product) throw new Error(`Missing canonical appliance product ${model}`);
  return product;
}

function normaliseModel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function screenshot(page, name, fullPage) {
  await page.screenshot({ path: path.join(outDir, name), fullPage });
}

async function waitForText(page, text) {
  await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), { timeout: 90000 }, text);
}

async function waitForAnyText(page, texts, timeout = 90000) {
  await page.waitForFunction((items) => items.some((text) => (document.body?.innerText || "").includes(text)), { timeout }, texts);
}

async function waitForAnySelector(page, selectors) {
  await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 90000 }, selectors);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function clickExactButton(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = Array.from(document.querySelectorAll("button")).find((button) => normalise(button.textContent) === expected);
    if (!target) throw new Error(`Could not find button ${expected}`);
    target.click();
  }, text);
}

async function clickByRequirementKey(page, key) {
  await page.evaluate((requirementKey) => {
    const target = document.querySelector(`[data-requirement-key="${requirementKey}"]`);
    if (!target) throw new Error(`Could not find requirement key ${requirementKey}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, key);
}

async function clickByTestId(page, testId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`Could not find test id ${id}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, testId);
}

async function clickBrand(page, brand) {
  await page.evaluate((expected) => {
    const card = Array.from(document.querySelectorAll("[data-brand]")).find((item) => item.getAttribute("data-brand") === expected);
    const target = card?.querySelector("button") || card;
    if (!target) throw new Error(`Could not find brand ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, brand);
}

async function clickFamilyType(page, familyKey) {
  await page.evaluate((expected) => {
    const target = Array.from(document.querySelectorAll(".applianceTypeCard[data-family-key]")).find((item) => item.getAttribute("data-family-key") === expected && item.tagName === "BUTTON");
    if (!target) throw new Error(`Could not find appliance family ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, familyKey);
}
