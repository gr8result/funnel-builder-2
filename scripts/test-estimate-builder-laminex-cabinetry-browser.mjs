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
const outDir = path.join(root, "test-results", "laminex-cabinetry");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log("Laminex cabinetry browser verification skipped: authenticated local session required.");
  process.exit(0);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-laminex-cabinetry-${runId}@example.test`;
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
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
  await clickByRequirementKey(page, "cabinetry");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await clickByTestId(page, "cabinetry-room-kitchen");
  await clickTextIn(page, ".cabinetryWorkflow", "Lower base-unit doors");
  await clickTextIn(page, ".cabinetryWorkflow", "Overheads");
  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");

  await page.waitForSelector('[data-testid="cabinetry-supplier-buttons"]');
  await screenshot(page, "01-visible-supplier-buttons.png");
  const supplierStyles = await page.evaluate(() => [...document.querySelectorAll(".cabinetrySupplierButtons button")].map((button) => {
    const style = getComputedStyle(button);
    return { text: button.innerText, color: style.color, background: style.backgroundColor, border: style.borderColor };
  }));
  assert.ok(supplierStyles.some((style) => /Laminex/.test(style.text) && style.color !== style.background), "Laminex button must be visible");
  assert.ok(supplierStyles.some((style) => /Polytec/.test(style.text) && style.color !== style.background), "Polytec button must be visible");

  await clickTextIn(page, ".cabinetrySupplierButtons", "Laminex");
  await page.waitForFunction(() => document.querySelectorAll(".cabinetryColourCard[data-supplier='Laminex']").length > 20);
  await screenshot(page, "02-full-laminex-swatch-grid.png");
  const laminexCount = await page.$$eval(".cabinetryColourCard[data-supplier='Laminex']", (items) => items.length);
  assert.ok(laminexCount >= 30, "Laminex must render grouped swatch colour cards");
  const imgCount = await page.$$eval(".cabinetryColourCard[data-supplier='Laminex'] img", (items) => items.filter((img) => img.complete && img.naturalWidth > 20).length);
  assert.ok(imgCount >= 20, "Laminex cards must render usable local swatches");

  await clickTextIn(page, ".cabinetrySupplierButtons", "Polytec");
  await page.waitForFunction(() => document.querySelectorAll(".cabinetryColourCard[data-supplier='Polytec']").length > 0);
  const leakedLaminex = await page.$$eval(".cabinetryColourCard", (items) => items.some((item) => item.dataset.supplier === "Laminex"));
  assert.equal(leakedLaminex, false, "Polytec supplier view must not leak Laminex cards");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Laminex");

  await typeInto(page, '[data-testid="cabinetry-colour-filters"] input', "Polar");
  await page.waitForFunction(() => document.body.innerText.includes("Polar White"));
  await clickTextIn(page, ".cabinetryCatalogueToolbar", "Clear Filters");
  await selectInToolbar(page, "Colour family", "Woodgrains");
  await screenshot(page, "03-filtered-colour-family.png");
  assert.ok(await page.evaluate(() => document.body.innerText.includes("Woodgrains")), "family filter must show Woodgrains results");
  await clickTextIn(page, ".cabinetryCatalogueToolbar", "Clear Filters");
  await selectInToolbar(page, "Product range", "Laminex AbsoluteMatte Panels");
  await selectInToolbar(page, "Finish", "AbsoluteMatte");
  await page.waitForFunction(() => document.body.innerText.includes("Polar White"));

  await clickCardAction(page, "Polar White", "View Details");
  await page.waitForSelector('[data-testid="cabinetry-inspection-modal"]');
  await screenshot(page, "04-inspection-modal.png");
  const officialHref = await page.$eval('[data-testid="cabinetry-inspection-modal"] a', (anchor) => ({ href: anchor.href, target: anchor.target, rel: anchor.rel }));
  assert.match(officialHref.href, /^https:\/\/www\.laminex\.com\.au\//);
  assert.equal(officialHref.target, "_blank");
  assert.match(officialHref.rel, /noopener/);
  await page.keyboard.press("Escape");

  await clickCardAction(page, "Polar White", "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-finish-selector"]');
  await clickTextIn(page, '[data-testid="cabinetry-finish-selector"]', "AbsoluteMatte");
  await clickLabelTextIn(page, '[data-testid="cabinetry-finish-selector"]', "Overheads");
  await clickTextIn(page, '[data-testid="cabinetry-finish-selector"]', "Apply selection");
  await page.waitForSelector('[data-testid="cabinetry-applied-summary"]');
  await screenshot(page, "05-applied-selection-summary.png");
  await assertText(page, "Supplier");
  await assertText(page, "Polar White");
  await assertText(page, "AbsoluteMatte");
  await clickTextIn(page, ".cabinetryWorkflow", "Save Draft");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForSelector("body");
  await enterCabinetryFromCurrentPage(page);
  if (!(await hasSelector(page, '[data-testid="cabinetry-applied-summary"]'))) {
    await clickByTestId(page, "cabinetry-room-kitchen");
    await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  }
  await assertText(page, "Polar White");
  await assertText(page, "AbsoluteMatte");

  await clickTextIn(page, ".cabinetryWorkflow", "Back to Cabinetry Rooms");
  await clickByTestId(page, "cabinetry-room-laundry");
  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  await assertNoTextIn(page, ".cabinetryAppliedSummary", "Polar White");
  await page.goto(`${baseUrl}/modules/builders/product-library?area=kitchen&category=kitchen-cabinet-finish&family=cabinet-finish`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes("Product Library") && document.body.innerText.includes("Cabinet Finish"), { timeout: 120000 });
  await assertText(page, "Laminex");
  await screenshot(page, "06-product-library-laminex-catalogue.png");

  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(`Laminex cabinetry browser verification passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Laminex Cabinetry Tester",
    business_name: "Laminex Cabinetry Verification",
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
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
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

async function enterCabinetryFromCurrentPage(page) {
  if (await hasSelector(page, '[data-testid="cabinetry-room-landing"]') || await hasSelector(page, '[data-testid="cabinetry-applied-summary"]')) return;
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) await clickByRequirementKey(page, "cabinetry");
  if (!(await hasSelector(page, '[data-testid="cabinetry-room-landing"]')) && !(await hasSelector(page, '[data-testid="cabinetry-applied-summary"]'))) {
    await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]']);
    if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
    await clickByRequirementKey(page, "cabinetry");
  }
  await waitForAnySelector(page, ['[data-testid="cabinetry-room-landing"]', '[data-testid="cabinetry-applied-summary"]']);
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

async function clickCardAction(page, colourName, actionText) {
  await page.evaluate(({ colourName, actionText }) => {
    const card = [...document.querySelectorAll(".cabinetryColourCard")].find((item) => item.dataset.colourName === colourName);
    const button = [...(card?.querySelectorAll("button") || [])].find((item) => item.textContent.includes(actionText));
    if (!button) throw new Error(`Could not find ${actionText} on ${colourName}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, { colourName, actionText });
}

async function typeInto(page, selector, value) {
  await page.waitForSelector(selector);
  await page.$eval(selector, (element) => {
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, value);
}

async function selectInToolbar(page, labelText, value) {
  await page.evaluate(({ labelText, value }) => {
    const label = [...document.querySelectorAll('[data-testid="cabinetry-colour-filters"] label')].find((item) => item.textContent.includes(labelText));
    const select = label?.querySelector("select");
    if (!select) throw new Error(`Could not find toolbar select ${labelText}`);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { labelText, value });
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (!found) throw new Error(`Expected page text: ${text}`);
}

async function assertNoTextIn(page, selector, text) {
  const found = await page.evaluate(({ selector, expected }) => document.querySelector(selector)?.innerText.includes(expected) || false, { selector, expected: text });
  if (found) throw new Error(`Unexpected text in ${selector}: ${text}`);
}
