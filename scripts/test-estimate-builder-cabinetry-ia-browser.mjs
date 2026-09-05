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
const outDir = path.join(root, "test-results", "estimate-builder-cabinetry-ia");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-cabinetry-ia-${runId}@example.test`;
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
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access/i.test(message.text())) runtimeErrors.push(message.text());
  });

  await primeBrowserSession(page, auth.session);
  await page.evaluate(() => localStorage.removeItem("gr8:client-selections:guided-cabinetry-draft"));
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await screenshot(page, "01-interior-dashboard.png");

  const labels = await cardLabels(page);
  assert.deepEqual(labels.slice(0, 3), ["Cabinetry", "Appliances", "Plumbing Fixtures"]);
  assert.equal(labels.includes("Kitchen"), false, "Interior dashboard must not expose Kitchen as the cabinetry category");
  await assertText(page, "Configure cabinetry separately for each applicable room.");
  await assertText(page, "Select sinks, basins, tapware, toilets, baths and other plumbing fixtures by room.");

  await clickByRequirementKey(page, "cabinetry");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await screenshot(page, "02-cabinetry-room-landing-empty.png");
  for (const room of ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite", "Powder Room", "Laundry", "Other"]) await assertText(page, room);
  await assertText(page, "Cabinetry Selections");
  await assertText(page, "Create a separate cabinetry specification for every applicable room.");
  await assertText(page, "No cabinetry rooms added");
  await assertNoText(page, "Splashback");
  await assertNoText(page, "Sink Mixer");
  await assertNoText(page, "Flooring");
  await assertNoText(page, "Lighting");
  await assertNoText(page, "Paint");

  await clickByTestId(page, "cabinetry-room-kitchen");
  await assertText(page, "CABINETRY / KITCHEN");
  await assertText(page, "Kitchen Cabinetry Specification");
  await assertText(page, "1. Scope");
  await assertText(page, "2. Cabinet Schedule");
  await assertNoText(page, "Butler's Pantry Cabinetry Specification");
  await screenshot(page, "03-kitchen-scope.png");
  await clickTextIn(page, ".cabinetryWorkflow", "Lower base-unit doors");
  await clickTextIn(page, ".cabinetryWorkflow", "Overheads");
  await clickTextIn(page, ".cabinetryWorkflow", "Cabinet Schedule");
  await clickTextIn(page, ".cabinetryWorkflow", "Standard base unit");
  await clickTextIn(page, ".cabinetryWorkflow", "Doors & Panels");
  await clickTextIn(page, ".cabinetryWorkflow", "Standard colourboard");
  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  await clickTextIn(page, ".cabinetryWorkflow", "Polytec");
  await clickTextIn(page, ".cabinetryWorkflow", "Evergreen");
  await clickTextIn(page, ".cabinetryWorkflow", "Benchtops");
  await clickTextIn(page, ".cabinetryWorkflow", "Stone, porcelain or sintered benchtop");
  await clickTextIn(page, ".cabinetryWorkflow", "Handles");
  await clickTextIn(page, ".cabinetryWorkflow", "Sharkfin");
  await clickTextIn(page, ".cabinetryWorkflow", "Features");
  await clickTextIn(page, ".cabinetryWorkflow", "Wine rack");
  await clickTextIn(page, ".cabinetryWorkflow", "Review & Confirm");
  await screenshot(page, "04-kitchen-review.png");
  await assertText(page, "Kitchen");
  await assertText(page, "Evergreen");
  await clickTextIn(page, ".cabinetryWorkflow", "Confirm Kitchen Cabinetry");

  await clickTextIn(page, ".cabinetryWorkflow", "Back to Cabinetry Rooms");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await assertRoomStatus(page, "Kitchen", "Complete");
  await assertRoomStatus(page, "Butler's Pantry", "Not added");
  await screenshot(page, "05-room-landing-kitchen-complete.png");

  await clickTextIn(page, ".cabinetryWorkflow", "Butler's Pantry");
  await assertText(page, "BUTLER'S PANTRY");
  await assertNoTextIn(page, ".cabinetryPanel", "Evergreen");
  await clickTextIn(page, ".cabinetryWorkflow", "Review & Confirm");
  await selectByLabel(page, "Copy selections from another room", "Kitchen");
  await clickTextIn(page, ".cabinetryWorkflow", "Copy selections");
  await assertText(page, "Evergreen");
  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  await clickTextIn(page, ".cabinetryWorkflow", "Tasmanian Oak");
  await clickTextIn(page, ".cabinetryWorkflow", "Review & Confirm");
  await assertText(page, "Tasmanian Oak");
  await clickTextIn(page, ".cabinetryWorkflow", "Confirm Butler's Pantry Cabinetry");
  await clickTextIn(page, ".cabinetryWorkflow", "Back to Cabinetry Rooms");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await assertRoomStatus(page, "Kitchen", "Complete");
  await assertRoomStatus(page, "Butler's Pantry", "Complete");

  await clickByTestId(page, "cabinetry-room-kitchen");
  await clickTextIn(page, ".cabinetryWorkflow", "Review & Confirm");
  await assertText(page, "Evergreen");
  await assertNoTextIn(page, ".cabinetryPanel", "Tasmanian Oak");
  await assertNoRuntimeErrors(runtimeErrors);
  await screenshot(page, "06-kitchen-unchanged-after-pantry-copy.png");

  console.log(`Cabinetry IA browser verification passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Cabinetry IA Tester",
    business_name: "Cabinetry IA Verification",
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
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function cardLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll(".guidedImageCard span")].map((element) => element.textContent.trim()).filter(Boolean));
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

async function clickByTestId(page, testId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`Could not find test id ${id}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, testId);
}

async function clickByRequirementKey(page, key) {
  await page.evaluate((requirementKey) => {
    const target = document.querySelector(`[data-requirement-key="${requirementKey}"]`);
    if (!target) throw new Error(`Could not find requirement key ${requirementKey}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, key);
}

async function selectByLabel(page, label, value) {
  await page.evaluate(({ label, value }) => {
    const labels = [...document.querySelectorAll("label")];
    const wrapper = labels.find((item) => item.textContent.includes(label));
    const select = wrapper?.querySelector("select");
    if (!select) throw new Error(`Could not find select for ${label}`);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { label, value });
}

async function assertRoomStatus(page, roomName, status) {
  const actual = await page.evaluate((name) => {
    const card = [...document.querySelectorAll(".cabinetryRoomCard")].find((item) => item.textContent.includes(name));
    return card?.innerText || "";
  }, roomName);
  assert.match(actual, new RegExp(status));
}

async function waitForAnySelector(page, selectors) {
  try {
    await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 120000 }, selectors);
  } catch {
    const state = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 2000) }));
    throw new Error(`Timed out waiting for selectors ${selectors.join(", ")}. URL=${state.url}. Body starts: ${state.body}`);
  }
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (!found) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 1500));
    throw new Error(`Expected page text: ${text}. Body starts: ${body}`);
  }
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (found) throw new Error(`Unexpected page text: ${text}`);
}

async function assertNoTextIn(page, selector, text) {
  const found = await page.evaluate(({ selector, expected }) => document.querySelector(selector)?.innerText.includes(expected), { selector, expected: text });
  if (found) throw new Error(`Unexpected text in ${selector}: ${text}`);
}

async function assertNoRuntimeErrors(runtimeErrors) {
  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
}
