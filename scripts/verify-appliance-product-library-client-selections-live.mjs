import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const johnsonJobFilePath = "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "test-results", "appliance-product-library-client-selections-live");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");
if (!fs.existsSync(johnsonJobFilePath)) throw new Error(`Missing Johnson job file: ${johnsonJobFilePath}`);

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-appliance-live-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1440, height: 1000 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const runtimeErrors = [];
const failedRequests = [];
const consoleWarnings = [];
const result = {
  screenshots: [],
  productLibraryOmegaOvens: [],
  clientSelectionsByBrand: {},
  omegaPackageCount: 0,
  omegaPackageComponentsWithImages: 0,
  selectedProduct: null,
  reloadedSelectionVisible: false,
};

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access|Maximum update depth|Minified React error/i.test(text)) runtimeErrors.push(text);
    if (message.type() === "warning") consoleWarnings.push(text);
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.failure()?.errorText || "failed"} ${request.url()}`));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes("/api/usage/check-limits")) failedRequests.push(`${response.status()} ${url}`);
  });

  await primeBrowserSession(page, auth.session);

  await page.goto(`${baseUrl}/modules/estimate-builder?room=kitchen&roomCategory=kitchen-ovens&page=productLibrary`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="product-library-category-page"][data-room-category="kitchen-ovens"]');
  await waitForText(page, "Ovens");
  await waitStable(page);
  result.productLibraryOmegaOvens = await page.$$eval("[data-room-product]", (cards) => cards
    .map((card) => ({ id: card.getAttribute("data-room-product") || "", text: card.textContent || "" }))
    .filter((card) => /Omega|OBO660X|OBO960X1/i.test(card.text)));
  assert.ok(result.productLibraryOmegaOvens.length >= 2, "Product Library renders Omega oven cards");
  await screenshot(page, "01-product-library-kitchen-ovens.png");

  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded" });
  await openLocalJobIfRequired(page);
  await enterApplianceFlow(page);
  await screenshot(page, "02-client-selections-brand-landing.png");

  await clickBrand(page, "Omega");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Omega"]');
  await clickByTestId(page, "appliance-package-mode");
  await page.waitForSelector('[data-testid="appliance-package-list"][data-brand="Omega"]');
  result.omegaPackageCount = await page.$$eval(".appliancePackageCard", (cards) => cards.length);
  assert.equal(result.omegaPackageCount, 6, "Omega package list renders all six packages");
  result.omegaPackageComponentsWithImages = await page.$$eval(".appliancePackageComponents [data-product-id]", (items) => items.filter((item) => item.querySelector("img") || item.textContent.includes("Exact product image required")).length);
  assert.ok(result.omegaPackageComponentsWithImages > 0, "Omega package component cards render image or deliberate missing-image state");
  await clickFirstButtonIn(page, ".appliancePackageCard", "View Package Details");
  await page.waitForSelector('[data-testid="appliance-package-details"]');
  await screenshot(page, "03-client-selections-omega-packages.png");

  await clickText(page, "Back to Omega");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Omega"]');
  await clickByTestId(page, "appliance-build-mode");
  await page.waitForSelector('[data-testid="appliance-build-your-own"][data-brand="Omega"]');
  await clickFamilyType(page, "ovens");
  await page.waitForSelector('[data-testid="appliance-model-grid"][data-brand="Omega"]');
  const omegaOvenCards = await modelCards(page);
  assert.ok(omegaOvenCards.length >= 2, "Omega oven visual cards render");
  assert.ok(omegaOvenCards.every((card) => card.brand === "Omega" && card.family === "ovens" && card.productId), "Omega cards keep canonical IDs and family metadata");
  await screenshot(page, "04-client-selections-omega-ovens.png");

  await clickFirstButtonIn(page, "article[data-testid^='appliance-model-']", "View Details");
  await page.waitForSelector('[data-testid="appliance-product-details"]');
  await screenshot(page, "05-client-selections-omega-detail.png");
  await clickText(page, "Select Product");
  await page.waitForSelector('[data-testid="appliance-build-your-own"][data-brand="Omega"]');
  result.selectedProduct = await page.$eval('.applianceSummaryRows [data-family-key="ovens"]', (row) => row.textContent.replace(/\s+/g, " ").trim());
  assert.match(result.selectedProduct, /Omega|OBO/i, "Selected Omega oven updates the oven summary row");
  await screenshot(page, "06-client-selections-omega-selected.png");
  await clickText(page, "Save Progress").catch(() => null);
  await sleep(1500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForText(page, "Client Selections");
  await openLocalJobIfRequired(page);
  await enterApplianceFlow(page);
  await clickBrand(page, "Omega");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Omega"]');
  result.reloadedSelectionVisible = await page.$eval('.applianceSummaryRows [data-family-key="ovens"]', (row) => /OBO660X|OBO960X1|Omega/i.test(row.textContent || ""));
  assert.equal(result.reloadedSelectionVisible, true, "Selected Omega oven remains visible after reload and reopening the job");

  for (const brand of ["Ariston", "Blanco", "Euromaid", "Smeg", "Westinghouse"]) {
    await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded" });
    await openLocalJobIfRequired(page);
    await enterApplianceFlow(page);
    await clickBrand(page, brand);
    await page.waitForSelector(`[data-testid="appliance-brand-summary"][data-brand="${brand}"]`);
    await clickByTestId(page, "appliance-build-mode");
    await page.waitForSelector(`[data-testid="appliance-build-your-own"][data-brand="${brand}"]`);
    await clickFirstAvailableFamily(page);
    await page.waitForSelector(`[data-testid="appliance-model-grid"][data-brand="${brand}"]`);
    const cards = await modelCards(page);
    result.clientSelectionsByBrand[brand] = cards.map((card) => card.productId);
    assert.ok(cards.length > 0, `${brand} visual product cards render`);
    assert.ok(cards.every((card) => card.brand === brand && card.productId), `${brand} cards carry canonical IDs`);
  }
  result.clientSelectionsByBrand.Omega = omegaOvenCards.map((card) => card.productId);

  await assertNoBadImages(page);
  assert.deepEqual(runtimeErrors, [], `Runtime errors detected:\n${runtimeErrors.join("\n")}`);
  assert.deepEqual(failedRequests.filter((line) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(line)), [], `Image requests failed:\n${failedRequests.join("\n")}`);
  console.log(JSON.stringify({ ...result, runtimeErrors, failedRequests, consoleWarnings: consoleWarnings.slice(0, 12) }, null, 2));
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Appliance Live Tester",
    business_name: "Appliance Live Verification",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  const { error: memberError } = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner", status: "active" });
  if (memberError) throw memberError;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return data;
    const missing = missingColumn(error);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
  throw new Error(`Could not upsert ${table}.`);
}

function missingColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  const match = message.match(/'([^']+)' column|column "([^"]+)"/i);
  return match?.[1] || match?.[2] || "";
}

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function enterApplianceFlow(page) {
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]', '[data-testid="appliance-brand-selection"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    await clickByRequirementKey(page, "interior");
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
  }
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) {
    await clickByRequirementKey(page, "appliances");
  }
  await page.waitForSelector('[data-testid="appliance-brand-selection"]');
}

async function openLocalJobIfRequired(page) {
  await page.waitForFunction(() => (
    document.body.innerText.includes("No job open")
    || document.querySelector('[data-testid="guided-client-selections-home"]')
    || document.querySelector('[data-testid="guided-interior-categories"]')
    || document.querySelector('[data-testid="appliance-brand-selection"]')
  ), { timeout: 90000 });
  if (!(await page.evaluate(() => document.body.innerText.includes("No job open")).catch(() => false))) return;
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 15000 }).catch(() => null);
  if (!input) throw new Error("Client Selections requires a job, but the local job file input was not available.");
  await input.uploadFile(johnsonJobFilePath);
  await waitForAnyText(page, ["Discard Changes", "Johnson", "Client Selections"], 90000);
  if (await page.evaluate(() => document.body.innerText.includes("Discard Changes"))) {
    await clickExactButton(page, "Discard Changes");
    await waitForAnyText(page, ["Johnson", "Client Selections"], 90000);
  }
  if (!(await page.evaluate(() => document.body.innerText.includes("Client Selections")))) {
    await clickText(page, "Client Selections");
  }
}

async function screenshot(page, name) {
  const screenshotPath = path.join(outDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  result.screenshots.push(screenshotPath);
}

async function modelCards(page) {
  return page.$$eval("article[data-testid^='appliance-model-']", (cards) => cards.map((card) => ({
    productId: card.getAttribute("data-product-id") || "",
    brand: card.getAttribute("data-brand") || "",
    family: card.getAttribute("data-family-key") || "",
    price: card.getAttribute("data-price") || "",
    imageUrl: card.getAttribute("data-image-url") || "",
  })));
}

async function clickBrand(page, brand) {
  await page.evaluate((expected) => {
    const card = [...document.querySelectorAll("[data-brand]")].find((item) => item.getAttribute("data-brand") === expected);
    const target = card?.querySelector("button") || card;
    if (!target) throw new Error(`Could not find brand ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, brand);
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
    const target = document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`Could not find test id ${id}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, testId);
}

async function clickFamilyType(page, familyKey) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll(".applianceTypeCard[data-family-key]")].find((item) => item.getAttribute("data-family-key") === expected && item.tagName === "BUTTON");
    if (!target) throw new Error(`Could not find appliance family ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, familyKey);
}

async function clickFirstAvailableFamily(page) {
  await page.evaluate(() => {
    const target = document.querySelector(".applianceTypeCard[data-family-key]:not(.disabled)");
    if (!target) throw new Error("Could not find an available appliance family");
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  });
}

async function clickFirstButtonIn(page, selector, label) {
  await page.evaluate(({ selector, label }) => {
    const container = document.querySelector(selector);
    const target = [...(container?.querySelectorAll("button") || [])].find((button) => button.textContent.includes(label));
    if (!target) throw new Error(`Could not find ${label} inside ${selector}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, label });
}

async function clickText(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const element = [...document.querySelectorAll("button, a, [role='button']")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!element) throw new Error(`Could not find clickable text: ${expected}`);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, text);
}

async function clickExactButton(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const element = [...document.querySelectorAll("button")].find((candidate) => normalise(candidate.textContent) === expected);
    if (!element) throw new Error(`Could not find exact button text: ${expected}`);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, text);
}

async function waitForText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), {}, text);
}

async function waitForAnyText(page, texts, timeout = 90000) {
  await page.waitForFunction((expectedTexts) => {
    const text = document.body?.innerText || "";
    return expectedTexts.some((expected) => text.includes(expected));
  }, { timeout }, texts);
}

async function waitStable(page) {
  const first = page.url();
  await sleep(3000);
  const second = page.url();
  assert.equal(second, first, "URL remained stable");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAnySelector(page, selectors) {
  try {
    await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), {}, selectors);
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2000),
    })).catch(() => ({ url: page.url(), text: "" }));
    await screenshot(page, "failure-enter-appliance-flow.png").catch(() => null);
    throw new Error(`Timed out waiting for ${selectors.join(", ")}. URL=${state.url}. Body=${state.text}`);
  }
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function assertNoBadImages(page) {
  const bad = await page.$$eval("img", (images) => images
    .filter((image) => image.complete && (image.naturalWidth === 0 || image.naturalHeight === 0))
    .map((image) => image.getAttribute("src") || ""));
  assert.deepEqual(bad, [], `Broken decoded images: ${bad.join(", ")}`);
  const body = await page.evaluate(() => document.body.innerText);
  assert.equal(/\brice\b|hand cream/i.test(body), false, "No unrelated rice or hand cream text appears in appliance flow");
}
