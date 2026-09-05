import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outDir = path.join(root, "test-results", "stone-benchtops");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log("Stone benchtop browser verification skipped: authenticated local session required.");
  process.exit(0);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-stone-benchtops-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1500, height: 1000 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access|Hydration/i.test(message.text())) runtimeErrors.push(message.text());
  });

  await primeBrowserSession(page, auth.session);
  await page.evaluate(() => localStorage.removeItem("gr8:client-selections:guided-cabinetry-draft"));
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await enterStoneBenchtops(page);
  await screenshot(page, "01-supplier-selection.png");

  const supplierTexts = await page.$$eval("[data-testid='stone-supplier-buttons'] button", (buttons) => buttons.map((button) => button.innerText));
  for (const supplier of ["Neolith", "Smartstone", "Caesarstone", "Stone Ambassador"]) {
    assert.ok(supplierTexts.some((text) => text.includes(supplier)), `${supplier} supplier button must render`);
  }

  await verifySupplier(page, "Neolith", "02-neolith-catalogue.png", 10);
  await verifySupplier(page, "Smartstone", "03-smartstone-catalogue.png", 7);
  await selectInToolbar(page, "Price group/category", "Pure");
  await assertText(page, "Pure");
  await clickTextIn(page, ".stoneFilters", "Clear Filters");
  await verifySupplier(page, "Caesarstone", "04-caesarstone-catalogue.png", 10);
  await verifySupplier(page, "Stone Ambassador", "05-stone-ambassador-catalogue.png", 50);
  await selectInToolbar(page, "Price group/category", "Essential");
  await assertText(page, "Essential");
  await clickTextIn(page, ".stoneFilters", "Clear Filters");

  await clickCardAction(page, "View Details");
  await page.waitForSelector("[data-testid='stone-benchtop-inspection-modal']");
  await screenshot(page, "06-large-product-inspection.png");
  const officialHref = await page.$eval("[data-testid='stone-benchtop-inspection-modal'] a[href^='https://']", (anchor) => ({ href: anchor.href, target: anchor.target, rel: anchor.rel }));
  assert.match(officialHref.href, /^https:\/\/(www\.)?(stoneambassador|neolith|smartstone|caesarstone)\./i);
  assert.equal(officialHref.target, "_blank");
  assert.match(officialHref.rel, /noopener/);
  await page.keyboard.press("Escape");

  await compareFirstProducts(page, 3);
  await page.waitForSelector("[data-testid='stone-benchtop-comparison']");
  await screenshot(page, "07-three-product-comparison.png");
  const compared = await page.$$eval("[data-testid='stone-benchtop-comparison'] article", (items) => items.length);
  assert.equal(compared, 3, "comparison panel must show exactly three products");

  await clickCardAction(page, "Select Surface");
  await page.waitForSelector("[data-testid='stone-benchtop-configurator']");
  await fillConfigurator(page);
  await clickTextIn(page, "[data-testid='stone-benchtop-configurator']", "Apply to Kitchen");
  await page.waitForSelector("[data-testid='stone-benchtop-applied-summary']");
  await screenshot(page, "08-completed-benchtop-specification.png");
  await assertText(page, "Actual slab thickness");
  await assertText(page, "Finished edge thickness");
  await assertText(page, "Supplier quote required");

  await clickTextIn(page, ".cabinetryWorkflow", "Save Draft");
  await clickTextIn(page, ".cabinetryWorkflow", "Review & Confirm");
  await assertText(page, "Stone Ambassador");
  await screenshot(page, "09-landscape-schedule-output.png");

  await page.goto(`${baseUrl}/modules/builders/product-library?area=kitchen&category=kitchen-benchtops&family=stone-benchtops`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes("Product Library"), { timeout: 120000 });
  await assertText(page, "Stone Ambassador");
  await assertText(page, "Smartstone");
  await screenshot(page, "10-product-library-stone-catalogue.png");

  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(`Stone benchtop browser verification passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Stone Benchtop Tester",
    business_name: "Stone Benchtop Verification",
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
    const missing = `${error?.message || ""} ${error?.details || ""}`.match(/'([^']+)' column|column "([^"]+)"/i)?.slice(1).find(Boolean);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
  throw new Error(`Could not upsert ${table}.`);
}

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(({ key, sessionObject }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", "846885cd-25b9-4eca-b9f9-3fd02f5882d8");
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession });
}

async function enterStoneBenchtops(page) {
  await waitForAnySelector(page, ["[data-testid='guided-client-selections-home']", "[data-testid='guided-interior-categories']", "[data-testid='cabinetry-room-landing']"]);
  if (await hasSelector(page, "[data-testid='guided-client-selections-home']")) await clickByRequirementKey(page, "interior");
  if (await hasSelector(page, "[data-testid='guided-interior-categories']")) await clickByRequirementKey(page, "cabinetry");
  await waitForAnySelector(page, ["[data-testid='cabinetry-room-landing']", ".cabinetryWorkflow"]);
  if (!(await hasSelector(page, "[data-testid='cabinetry-room-landing']")) && await page.evaluate(() => document.body.innerText.includes("Back to Cabinetry Rooms"))) {
    await clickTextIn(page, ".cabinetryWorkflow", "Back to Cabinetry Rooms");
  }
  await page.waitForSelector("[data-testid='cabinetry-room-landing']");
  if (await hasSelector(page, "[data-testid='cabinetry-room-kitchen']")) {
    await clickByTestId(page, "cabinetry-room-kitchen");
  } else {
    await clickTextIn(page, "[data-testid='cabinetry-room-landing']", "Kitchen");
  }
  await clickTextIn(page, ".cabinetryWorkflow", "Benchtops");
  await page.waitForSelector("[data-testid='stone-material-choice']");
  await clickTextIn(page, "[data-testid='stone-material-choice']", "Stone, porcelain or sintered benchtop");
  await page.waitForSelector("[data-testid='stone-benchtop-selector']");
  await page.waitForSelector(".stoneProductCard");
}

async function verifySupplier(page, supplier, screenshotName, minimumCards) {
  await ensureStoneSelector(page);
  await clickTextIn(page, "[data-testid='stone-supplier-buttons']", supplier);
  await page.waitForFunction((expected) => [...document.querySelectorAll(".stoneProductCard")].some((card) => card.dataset.supplier === expected), { timeout: 120000 }, supplier);
  const count = await page.$$eval(".stoneProductCard", (items, expected) => items.filter((item) => item.dataset.supplier === expected).length, supplier);
  assert.ok(count >= minimumCards, `${supplier} must render at least ${minimumCards} visible cards`);
  await screenshot(page, screenshotName);
}

async function ensureStoneSelector(page) {
  if (await hasSelector(page, "[data-testid='stone-supplier-buttons']")) return;
  await enterStoneBenchtops(page);
}

async function compareFirstProducts(page, amount) {
  await page.evaluate((count) => {
    const buttons = [...document.querySelectorAll(".stoneProductCard button")].filter((button) => button.textContent.includes("Compare")).slice(0, count);
    if (buttons.length < count) throw new Error(`Only found ${buttons.length} compare buttons`);
    buttons.forEach((button) => button.click());
  }, amount);
}

async function fillConfigurator(page) {
  await typeIntoLabel(page, "[data-testid='stone-benchtop-configurator']", "Finished edge thickness", "40mm mitred");
  await typeIntoLabel(page, "[data-testid='stone-benchtop-configurator']", "Approx. area / dimensions", "Kitchen island 3200 x 1200, rear run 4600 x 650");
  await typeIntoLabel(page, "[data-testid='stone-benchtop-configurator']", "Approx. sqm", "6.85");
  await clickLabelTextIn(page, "[data-testid='stone-benchtop-configurator']", "Sink cut-out");
  await clickLabelTextIn(page, "[data-testid='stone-benchtop-configurator']", "Cooktop");
  await clickLabelTextIn(page, "[data-testid='stone-benchtop-configurator']", "Physical sample confirmed");
  await clickLabelTextIn(page, "[data-testid='stone-benchtop-configurator']", "Full slab viewed");
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function waitForAnySelector(page, selectors) {
  await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 120000 }, selectors);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
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

async function clickTextIn(page, selector, text) {
  await page.evaluate(({ selector, expected }) => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`Could not find root selector: ${selector}`);
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const element = [...root.querySelectorAll("button, a, [role='button']")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!element) throw new Error(`Could not find clickable text in ${selector}: ${expected}`);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, { selector, expected: text });
}

async function clickLabelTextIn(page, selector, text) {
  await page.evaluate(({ selector, expected }) => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`Could not find root selector: ${selector}`);
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const label = [...root.querySelectorAll("label")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!label) throw new Error(`Could not find label text in ${selector}: ${expected}`);
    label.scrollIntoView({ block: "center", inline: "center" });
    label.click();
  }, { selector, expected: text });
}

async function clickCardAction(page, actionText) {
  await page.evaluate((expected) => {
    const card = document.querySelector(".stoneProductCard");
    const button = [...(card?.querySelectorAll("button") || [])].find((item) => item.textContent.includes(expected));
    if (!button) throw new Error(`Could not find stone card action: ${expected}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, actionText);
}

async function selectInToolbar(page, labelText, value) {
  await page.evaluate(({ labelText, value }) => {
    const normalise = (text) => (text || "").replace(/\s+/g, " ").trim();
    const label = [...document.querySelectorAll(".stoneFilters label")].find((item) => normalise(item.textContent).includes(labelText));
    if (!label) throw new Error(`Could not find toolbar label: ${labelText}`);
    const select = label.querySelector("select");
    if (!select) throw new Error(`Toolbar label is not a select: ${labelText}`);
    const option = [...select.options].find((item) => item.text === value || item.value === value);
    if (!option) throw new Error(`Could not find option ${value} for ${labelText}`);
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { labelText, value });
}

async function typeIntoLabel(page, selector, labelText, value) {
  await page.evaluate(({ selector, labelText, value }) => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`Could not find root selector: ${selector}`);
    const normalise = (text) => (text || "").replace(/\s+/g, " ").trim();
    const label = [...root.querySelectorAll("label")].find((item) => normalise(item.textContent).includes(labelText));
    if (!label) throw new Error(`Could not find input label: ${labelText}`);
    const input = label.querySelector("input, textarea");
    if (!input) throw new Error(`Label has no input: ${labelText}`);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, labelText, value });
}

async function assertText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 120000 }, text);
}
