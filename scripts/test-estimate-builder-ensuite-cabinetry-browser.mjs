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
const johnsonFile = process.env.JOHNSON_JOB_FILE || "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outDir = path.join(root, "test-results", "estimate-builder-ensuite-cabinetry");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(johnsonFile)) throw new Error(`Johnson job file was not found: ${johnsonFile}`);
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-ensuite-cabinetry-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 980 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|TypeError|Cannot read|is not defined|Hydration/i.test(message.text())) runtimeErrors.push(message.text());
  });

  await primeBrowserSession(page, auth.session);
  console.log("Primed browser session.");
  await openJohnsonLocalFile(page);
  console.log("Opened Johnson local job file.");

  await verifyWetAreaRoom(page, "Bathroom", "bathroom");
  console.log("Verified Bathroom wet-area Scope/Schedule.");
  await clickText(page, "Back");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]', { timeout: 120000 });
  await verifyWetAreaRoom(page, "Ensuite", "ensuite");
  console.log("Verified Ensuite wet-area Scope/Schedule.");

  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(`Bathroom/Ensuite cabinetry browser verification passed. Screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function verifyWetAreaRoom(page, roomName, slug) {
  await openCabinetryRoom(page, roomName, slug);
  await assertText(page, `${roomName} Cabinetry Specification`);
  await assertText(page, "Floor-mounted vanity");
  await assertText(page, "Wall-mounted vanity");
  await assertText(page, "Tall linen cupboard");
  await assertText(page, "Mirrored shaving cabinet");
  await assertText(page, "Bulkhead over tall cupboard");
  await assertNoTextIn(page, ".cabinetryWorkflow", ["Island bench back", "Kitchen overhead cabinetry", "Appliance cabinetry", "Pantry cabinetry"]);
  await ensureRowChecked(page, "Floor-mounted vanity");
  await ensureRowChecked(page, "Wall-mounted vanity");
  await ensureRowChecked(page, "Tall linen cupboard");
  await ensureRowChecked(page, "Mirrored shaving cabinet");
  await ensureRowChecked(page, "Bulkhead over tall cupboard");
  await screenshot(page, `01-${slug}-scope.png`);

  await clickText(page, "Cabinet Schedule");
  await assertText(page, "Base unit with 2 doors");
  await assertText(page, "Base unit with 1 door");
  await assertText(page, "Set of 4 drawers");
  await assertText(page, "Towel display rack");
  await assertText(page, "2-door unit");
  await assertText(page, "1-door unit");
  await assertText(page, "3-drawer unit");
  await assertText(page, "2-drawer unit");
  await assertText(page, "Tall linen cupboard");
  await assertText(page, "2-door mirrored shaving cabinet");
  await assertText(page, "1-door mirrored shaving cabinet");
  await assertText(page, "Bulkhead over tall cupboard");
  await assertNoTextIn(page, ".cabinetryWorkflow", ["Standard base unit", "Corner unit", "Pull-out bin", "Underbench oven cabinet", "Dishwasher cabinet", "Microwave cabinet", "Rangehood cabinet", "Tall pantry"]);
  await screenshot(page, `02-${slug}-schedule.png`);

  await clickText(page, "Features");
  await assertNoTextIn(page, ".cabinetryWorkflow", ["Integrated dishwasher panel", "Integrated fridge panel", "Wine rack"]);
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Ensuite Cabinetry Tester",
    business_name: "Ensuite Cabinetry Verification",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  const { error: memberError } = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner", status: "active" });
  if (memberError) throw memberError;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return;
    const missing = `${error?.message || ""} ${error?.details || ""}`.match(/'([^']+)' column|column "([^"]+)"/i)?.slice(1).find(Boolean);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
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

async function openJohnsonLocalFile(page) {
  console.log("Opening Estimate Builder.");
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  console.log("Waiting for File menu.");
  await page.waitForFunction(() => document.querySelector("#estimate-builder-file-menu-button") && !document.querySelector("#estimate-builder-file-menu-button").disabled, { timeout: 120000 });
  await page.click("#estimate-builder-file-menu-button");
  await page.waitForSelector("#estimate-builder-file-menu");
  console.log("Uploading local job file.");
  await clickText(page, "Open Job File from Computer");
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(johnsonFile);
  await waitForAnyText(page, ["Johnson 07-123", "Local job file opened"], 120000);
}

async function openCabinetryRoom(page, roomName, slug) {
  if (!(await hasSelector(page, '[data-testid="cabinetry-room-landing"]'))) {
    if (!(await hasSelector(page, '[data-testid="guided-interior-categories"]'))) {
      await clickRequirementCard(page, "interior");
      await waitForAnyText(page, ["Cabinetry", "Appliances"], 120000);
    }
    await clickRequirementCard(page, "cabinetry");
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]', { timeout: 120000 });
  }
  await clickByTestId(page, `cabinetry-room-${slug}`);
  await page.waitForSelector('[data-testid="cabinetry-location-stage"]', { timeout: 120000 });
  await clickText(page, "Scope");
}

async function clickRequirementCard(page, key) {
  const selectors = [`[data-requirement-key="${key}"]`, `[data-category-key="${key}"]`, `[data-testid*="${key}"]`];
  for (const selector of selectors) {
    const handle = await page.$(selector);
    if (handle) {
      await handle.click();
      return;
    }
  }
  await clickText(page, key);
}

async function ensureRowChecked(page, text) {
  await page.evaluate((rowText) => {
    const normalise = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const row = [...document.querySelectorAll(".cabinetrySelectionRow")].find((element) => normalise(element.textContent).includes(normalise(rowText)));
    if (!row) throw new Error(`Could not find row: ${rowText}`);
    const input = row.querySelector("input[type='checkbox']");
    if (!input) throw new Error(`Could not find checkbox for row: ${rowText}`);
    if (!input.checked) input.click();
  }, text);
}

async function clickByTestId(page, testId) {
  await page.click(`[data-testid="${testId}"]`);
}

async function clickText(page, text) {
  const clicked = await page.evaluate((needle) => {
    const normalise = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const target = normalise(needle);
    const candidates = [...document.querySelectorAll("button, a, label, [role='button']")].filter((element) => {
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none" && normalise(element.textContent).includes(target);
    });
    const element = candidates[0];
    if (!element) return false;
    element.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Unable to click visible text: ${text}`);
}

async function waitForAnyText(page, texts, timeout = 60000) {
  await page.waitForFunction((values) => values.some((text) => document.body.innerText.includes(text)), { timeout }, texts);
}

async function assertText(page, text) {
  await page.waitForFunction((value) => document.body.innerText.includes(value), { timeout: 120000 }, text);
}

async function assertNoTextIn(page, selector, texts) {
  const found = await page.$eval(selector, (element, values) => values.filter((text) => element.innerText.includes(text)), texts);
  if (found.length) throw new Error(`Unexpected text in ${selector}: ${found.join(", ")}`);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}
