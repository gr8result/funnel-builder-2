import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.ESTIMATE_BUILDER_MENU_BASE_URL || "http://localhost:3000";
const johnsonFile = process.env.JOHNSON_JOB_FILE || "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const stabilityHoldMs = Number(process.env.JOHNSON_VERIFY_HOLD_MS || 60000);
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!fs.existsSync(johnsonFile)) throw new Error(`Johnson job file was not found: ${johnsonFile}`);
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-johnson-local-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 920 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read/i.test(text)) runtimeErrors.push(text);
  });

  await primeBrowserSession(page, auth.session);
  console.log("Opening Client Selections");
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForText(page, "Client Selections");
  console.log("Opening File menu");
  await page.waitForFunction(() => {
    const button = document.querySelector("#estimate-builder-file-menu-button");
    return button && !button.disabled;
  }, { timeout: 120000 });
  await page.click("#estimate-builder-file-menu-button");
  await page.waitForSelector("#estimate-builder-file-menu");
  console.log("Choosing Open Job File from Computer");
  await clickButton(page, "Open Job File from Computer");
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(johnsonFile);
  console.log("Waiting for Johnson local file to load");
  try {
    await waitForAnyText(page, ["Local job file opened", "Johnson 07-123"], 120000);
  } catch (error) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 3000));
    throw new Error(`Johnson local file did not show the opened confirmation. Runtime errors: ${runtimeErrors.join(" | ") || "none"}. Body text starts:\n${body}`);
  }
  await waitForText(page, "2 Anotherstreet, Somplace, QLD 4557");

  console.log("Holding Client Selections open for 60 seconds");
  await sleep(stabilityHoldMs);
  await waitForNoRuntimeErrors(runtimeErrors);
  console.log("Opening Interior Cabinetry");
  await clickRequirementCard(page, "interior");
  await waitForText(page, "Cabinetry");
  await clickRequirementCard(page, "cabinetry");
  await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]', { timeout: 120000 });
  await waitForNoRuntimeErrors(runtimeErrors);
  await page.screenshot({ path: path.join(root, "test-results", "johnson-cabinetry-open-after-fix.png"), fullPage: true });
  console.log("Johnson Cabinetry opened without runtime errors");
  await clickButton(page, "Back");
  if (await hasVisibleRequirementCard(page, "cabinetry")) await clickButton(page, "Back");
  await waitForText(page, "Client Selections");
  console.log("Opening Exterior");
  await clickText(page, "Exterior");
  await waitForText(page, "Exterior");
  console.log("Opening Driveway");
  await clickText(page, "Driveway");
  await waitForText(page, "Choose the driveway finish");
  console.log("Returning to Client Selections home");
  await clickButton(page, "Back");
  await waitForText(page, "Client Selections");
  console.log("Refreshing");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForText(page, "Client Selections");
  try {
    await waitForAnyText(page, ["Johnson 07-123", "Johnson 123.gr8job"], 30000);
    await waitForText(page, "2 Anotherstreet, Somplace, QLD 4557", 30000);
  } catch (error) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 3000));
    throw new Error(`Johnson filename was not visible after refresh. Body text starts:\n${body}`);
  }
  await waitForNoRuntimeErrors(runtimeErrors);

  console.log(`Johnson local job file opened and Client Selections remained stable: ${johnsonFile}`);
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
    full_name: "Codex Johnson Local Tester",
    business_name: "Johnson Local File Verification",
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

async function clickButton(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((candidate) => normalise(candidate.textContent) === expected)
      || buttons.find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!button) throw new Error(`Could not find button: ${expected}`);
    button.click();
  }, text);
  await sleep(600);
}

async function clickText(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const element = [...document.querySelectorAll("button, a, [role='button']")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!element) {
      const labels = [...document.querySelectorAll("button, a, [role='button']")]
        .map((candidate) => normalise(candidate.textContent))
        .filter(Boolean)
        .slice(0, 80)
        .join(" | ");
      throw new Error(`Could not find clickable text: ${expected}. Available: ${labels}`);
    }
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, text);
  await sleep(900);
}

async function clickRequirementCard(page, requirementKey) {
  const box = await page.evaluate((key) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
    };
    const target = [...document.querySelectorAll(`[data-requirement-key="${key}"]`)].find(visible);
    if (!target) throw new Error(`Could not find visible requirement card: ${key}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, requirementKey);
  await page.mouse.click(box.x, box.y);
  await sleep(900);
}

async function hasVisibleRequirementCard(page, requirementKey) {
  return page.evaluate((key) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
    };
    return [...document.querySelectorAll(`[data-requirement-key="${key}"]`)].some(visible);
  }, requirementKey);
}

async function waitForText(page, text, timeout = 120000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function waitForAnyText(page, texts, timeout = 120000) {
  await page.waitForFunction((expected) => expected.some((text) => document.body.innerText.includes(text)), { timeout }, texts);
}

async function waitForNoRuntimeErrors(runtimeErrors) {
  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
