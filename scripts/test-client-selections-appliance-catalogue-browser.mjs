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
const outDir = path.join(root, "test-results", "client-selections-appliance-catalogue");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");
if (!fs.existsSync(johnsonJobFilePath)) throw new Error(`Missing Johnson job file: ${johnsonJobFilePath}`);

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-appliance-flow-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1440, height: 1000 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });

  await primeBrowserSession(page, auth.session);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 15000 }).catch(() => null);
  if (input) {
    await input.uploadFile(johnsonJobFilePath);
    await waitForAnyText(page, ["Discard Changes", "Johnson", "Client Selections"], 120000);
    if ((await page.evaluate(() => document.body.innerText.includes("Discard Changes")))) {
      await clickExactButton(page, "Discard Changes");
      await waitForAnyText(page, ["Johnson", "Client Selections"], 120000);
    }
    if (!(await page.evaluate(() => document.body.innerText.includes("Client Selections")))) {
      await clickText(page, "Client Selections");
    }
  }
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]', '[data-testid="appliance-brand-selection"]']);

  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    await clickByRequirementKey(page, "interior");
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
  }
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) {
    await clickByRequirementKey(page, "appliances");
  }
  await waitForAnySelector(page, ['[data-testid="appliance-brand-selection"]']);
  await screenshot(page, "01-appliance-brand-selection.png");
  await assertText(page, "Client Selections");
  await assertText(page, "Which appliance brand would you like to view?");
  await assertNoSelector(page, '[data-testid="guided-appliances-checklist"]');

  const brandCards = await page.$$eval("[data-brand]", (items) => items.map((item) => item.getAttribute("data-brand")).filter(Boolean));
  assert.deepEqual(
    Array.from(new Set(brandCards)).sort((left, right) => left.localeCompare(right)),
    ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"],
    "all six Product Library appliance brands render in Client Selections",
  );

  await clickBrand(page, "Westinghouse");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Westinghouse"]');
  await screenshot(page, "02-westinghouse-brand-summary.png");
  await assertText(page, "Select an Appliance Package");
  await assertText(page, "Build Your Own Appliance Package");

  await clickByTestId(page, "appliance-package-mode");
  await page.waitForSelector('[data-testid="appliance-package-list"][data-brand="Westinghouse"]');
  await screenshot(page, "03-westinghouse-packages.png");
  const packageBrands = await page.$$eval(".appliancePackageCard", (items) => items.map((item) => item.getAttribute("data-brand")));
  assert.ok(packageBrands.every((item) => item === "Westinghouse"), "Package list is filtered to Westinghouse");

  await clickText(page, "Back to Westinghouse");
  await page.waitForSelector('[data-testid="appliance-brand-summary"][data-brand="Westinghouse"]');
  await clickByTestId(page, "appliance-build-mode");
  await page.waitForSelector('[data-testid="appliance-build-your-own"][data-brand="Westinghouse"]');
  await screenshot(page, "04-westinghouse-build-your-own.png");
  await assertText(page, "Oven");

  await clickFamilyType(page, "ovens");
  await page.waitForSelector('[data-testid="appliance-model-grid"]');
  await screenshot(page, "05-westinghouse-oven-models.png");
  const modelState = await page.$$eval("article[data-testid^='appliance-model-']", (items) => items.map((item) => ({
    family: item.getAttribute("data-family-key"),
    brand: item.getAttribute("data-brand"),
  })));
  const modelFamilies = modelState.map((item) => item.family);
  assert.ok(modelFamilies.length > 0, "Oven models render");
  assert.ok(modelFamilies.every((family) => family === "ovens"), "Oven model cards are filtered to ovens");
  assert.ok(modelState.every((item) => item.brand === "Westinghouse"), "Oven model cards are filtered to Westinghouse");

  await clickText(page, "View Details");
  await page.waitForSelector('[data-testid="appliance-product-details"]');
  await screenshot(page, "06-westinghouse-oven-details.png");
  await assertText(page, "Select Product");
  await assertText(page, "Back to Models");
  await assertNoText(page, "sourceCostPrice");
  await assertNoText(page, "Rice");

  await clickText(page, "Select Product");
  await page.waitForSelector('[data-testid="appliance-build-your-own"][data-brand="Westinghouse"]');
  await screenshot(page, "07-westinghouse-summary-selected.png");
  await assertText(page, "Westinghouse Appliance Selection");
  await assertNoText(page, "Rice");
  await assertNoRuntimeErrors(runtimeErrors);

  console.log(`Client Selections appliance browser screenshots saved to ${outDir}`);
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
    full_name: "Codex Appliance Flow Tester",
    business_name: "Appliance Flow Verification",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner", status: "active" });
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
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
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
    const card = [...document.querySelectorAll("[data-brand]")].find((item) => item.getAttribute("data-brand") === expected);
    const target = card?.querySelector("button") || card;
    if (!target) throw new Error(`Could not find brand ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, brand);
}

async function clickFamilyType(page, familyKey) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll(".applianceTypeCard[data-family-key]")].find((item) => item.getAttribute("data-family-key") === expected && item.tagName === "BUTTON");
    if (!target) throw new Error(`Could not find appliance family ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, familyKey);
}

async function clickByRequirementKey(page, key) {
  await page.evaluate((requirementKey) => {
    const target = document.querySelector(`[data-requirement-key="${requirementKey}"]`);
    if (!target) throw new Error(`Could not find requirement key ${requirementKey}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, key);
}

async function waitForAnySelector(page, selectors) {
  try {
    await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 120000 }, selectors);
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 2000),
    })).catch(() => ({ url: page.url(), text: "" }));
    await screenshot(page, "failure-timeout.png").catch(() => null);
    throw new Error(`Timed out waiting for ${selectors.join(", ")}. URL=${state.url}. Body=${state.text}`);
  }
}

async function waitForAnyText(page, texts, timeout = 120000) {
  await page.waitForFunction((expectedTexts) => {
    const text = document.body?.innerText || "";
    return expectedTexts.some((expected) => text.includes(expected));
  }, { timeout }, texts);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.ok(found, `Expected visible text: ${text}`);
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.equal(found, false, `Unexpected visible text: ${text}`);
}

async function assertNoSelector(page, selector) {
  const found = await page.$(selector);
  assert.equal(found, null, `Unexpected selector: ${selector}`);
}

async function assertNoRuntimeErrors(errors) {
  assert.deepEqual(errors, [], `Runtime errors detected:\n${errors.join("\n")}`);
}

async function waitForBodyText(page, text, timeout = 45000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}
