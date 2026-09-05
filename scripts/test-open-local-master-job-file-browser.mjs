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

const baseUrl = process.env.OPEN_LOCAL_JOB_BASE_URL || "http://localhost:3000";
const fixturePath = process.env.OPEN_LOCAL_JOB_FIXTURE || "C:/Users/grant/Downloads/New Job 03 09.gr8job";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "test-results", "open-local-master-job-file");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(fixturePath)) throw new Error(`Missing fixture: ${fixturePath}`);
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-open-local-job-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1600, height: 1000 },
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

  await primeAuth(page, auth.session);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput&guided=appliances`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="builder-module-banner-title"]');
  await waitForBodyText(page, "No job open");
  await assertNoText(page, "The current job has unsaved changes");
  await assertNoText(page, "Save Current Job");
  await screenshot(page, "01-job-setup-no-job-open.png");

  await page.click("#estimate-builder-file-menu-button");
  await assertText(page, "Open Job File From Computer");
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(fixturePath);

  await page.waitForFunction(() => {
    const bannerJob = document.querySelector('[data-testid="builder-module-banner-job"]')?.textContent || "";
    const projectName = document.querySelector("#data-edit-inputDataSheet-projectName")?.value || "";
    return bannerJob.includes("New Job 03/09") && projectName === "New Job 03/09";
  });

  await assertInputValue(page, "#data-edit-inputDataSheet-projectName", "New Job 03/09");
  await assertInputValue(page, "#data-edit-inputDataSheet-projectAddress", "2 ASTREET, SOMPLACE, QLD, 4557");
  await assertInputValue(page, "#data-edit-inputDataSheet-clientName", "Bill and Mary New");
  await assertInputValue(page, "#data-edit-inputDataSheet-jobNumber", "03-09/123");
  await assertInputValue(page, "#data-edit-inputDataSheet-builderName", "Goodbuild Quality Builders");
  await assertInputValue(page, "#data-edit-inputDataSheet-quoteDate", "03-09");
  await assertSelectValue(page, "#data-edit-inputDataSheet-projectStatus", "Pricing");
  await assertSelectValue(page, "#data-edit-inputDataSheet-floorCount", "Two storey");
  await assertInputValue(page, "#data-edit-inputDataSheet-engineeringRequirements", "Morgan Engineering");
  await assertInputValue(page, "#data-edit-inputDataSheet-facadeType", "Contemporary");
  await assertInputValue(page, "#data-edit-inputDataSheet-frameMethod", "prefabricated wall frames and roof trusses");
  await assertNoText(page, "No job open");
  await assertNoText(page, "The current job has unsaved changes");
  await assertNoText(page, "Save Current Job");
  await assertNoText(page, "Johnson 123");
  const activeKey = await page.evaluate(() => sessionStorage.getItem("estimate-builder-explicit-active-job-key") || "");
  assert.ok(activeKey, "opening the selected local file records an explicit active job for this browser session");
  await screenshot(page, "02-job-setup-opened-local-file.png");

  await clickText(page, "Client Selections");
  await page.waitForFunction(() => document.querySelector('[data-testid="builder-module-banner-title"]')?.textContent?.trim() === "Client Selections");
  await page.waitForFunction(() => document.body.innerText.includes("New Job 03/09"));
  await assertText(page, "Client Selections");
  await assertText(page, "New Job 03/09");
  await assertText(page, "2 ASTREET, SOMPLACE, QLD, 4557");
  await screenshot(page, "03-client-selections-same-job.png");

  await clickText(page, "Job Setup");
  await page.waitForFunction(() => document.querySelector('[data-testid="builder-module-banner-title"]')?.textContent?.trim() === "Job Setup");
  await page.waitForSelector("#data-edit-inputDataSheet-projectName");
  await page.waitForFunction(() => document.querySelector("#data-edit-inputDataSheet-projectName")?.value === "New Job 03/09");
  await assertInputValue(page, "#data-edit-inputDataSheet-projectName", "New Job 03/09");
  await assertInputValue(page, "#data-edit-inputDataSheet-clientName", "Bill and Mary New");
  await screenshot(page, "04-job-setup-return-still-open.png");

  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Close Job");
  await waitForBodyText(page, "No job open");
  await assertNoText(page, "New Job 03/09");
  await screenshot(page, "05-job-setup-closed.png");

  await assertNoRuntimeErrors(runtimeErrors);
  console.log(`Open local master job-file screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function primeAuth(page, sessionObject) {
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject, workspaceId });
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Open Local Job Tester",
    business_name: "Open Local Job Verification",
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

async function assertInputValue(page, selector, expected) {
  const actual = await page.$eval(selector, (element) => element.value || "");
  assert.equal(actual, expected, `${selector} should be ${expected}`);
}

async function assertSelectValue(page, selector, expected) {
  const actual = await page.$eval(selector, (element) => element.value || "");
  assert.equal(actual, expected, `${selector} should be ${expected}`);
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  const details = found ? "" : await page.evaluate(async () => {
    const sessionKey = sessionStorage.getItem("estimate-builder-explicit-active-job-key") || "";
    const activeStoredKey = await new Promise((resolve) => {
      const request = indexedDB.open("estimate-builder-template-db", 2);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("jobs", "readonly");
        const get = tx.objectStore("jobs").get("active-job");
        get.onsuccess = () => {
          const result = get.result || {};
          db.close();
          resolve(result.jobKey || result.key || "");
        };
        get.onerror = () => {
          db.close();
          resolve("");
        };
      };
      request.onerror = () => resolve("");
    });
    const explicitRecord = sessionKey ? await new Promise((resolve) => {
      const request = indexedDB.open("estimate-builder-template-db", 2);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("jobs", "readonly");
        const get = tx.objectStore("jobs").get(sessionKey);
        get.onsuccess = () => {
          const result = get.result || {};
          db.close();
          resolve({
            type: result.type || "",
            key: result.key || "",
            hasWorkbook: Boolean(result.workbook),
            projectName: result.workbook?.data?.inputDataSheet?.rows?.projectName?.value || result.workbook?.jobFileMeta?.jobName || "",
            projectId: result.workbook?.registeredJob?.jobId || result.workbook?.projectId || result.workbook?.jobFileMeta?.projectId || "",
          });
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      request.onerror = () => resolve(null);
    }) : null;
    return {
      body: document.body.innerText.slice(0, 2500),
      url: location.href,
      sessionKey,
      activeStoredKey,
      explicitRecord,
    };
  });
  assert.ok(found, `Expected visible text: ${text}\nDetails:\n${JSON.stringify(details, null, 2)}`);
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.equal(found, false, `Unexpected visible text: ${text}`);
}

async function waitForBodyText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 120000 }, text);
}

async function assertNoRuntimeErrors(errors) {
  assert.deepEqual(errors, [], `Runtime errors detected:\n${errors.join("\n")}`);
}
