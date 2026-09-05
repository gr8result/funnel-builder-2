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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "test-results", "client-selections-no-auto-job-open");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-no-auto-job-${runId}@example.test`;
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

  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
    localStorage.setItem("estimate-builder-active-registered-job", JSON.stringify({
      jobId: "johnson-123-stale-pointer",
      jobName: "Johnson 123",
      jobNumber: "Johnson 07-123",
      clientName: "Wrong Tenant",
      siteAddress: "2 Anotherstreet, Somplace, QLD 4557",
    }));
  }, { key: `sb-${ref}-auth-token`, sessionObject: auth.session, workspaceId });

  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("body");
  await waitForBodyText(page, "No job open");
  await screenshot(page, "01-no-job-open.png");
  await assertText(page, "Client Selections");
  await assertText(page, "Create New Job");
  await assertText(page, "Open Job File From Computer");
  await assertNoText(page, "Johnson 123");
  await assertNoText(page, "2 Anotherstreet");
  await assertNoText(page, "The current job has unsaved changes");
  await assertNoText(page, "Save Current Job");
  await assertNoSelector(page, '[data-testid="guided-client-selections-home"]');
  await assertNoSelector(page, '[data-testid="appliance-brand-selection"]');

  await clickText(page, "Create New Job");
  await waitForBodyText(page, "Create New Job");
  await screenshot(page, "02-create-new-job.png");
  await assertNoRuntimeErrors(runtimeErrors);

  console.log(`Client Selections no-auto-job-open screenshots saved to ${outDir}`);
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
    full_name: "Codex No Auto Job Tester",
    business_name: "No Auto Job Verification",
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

async function waitForBodyText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 120000 }, text);
}
