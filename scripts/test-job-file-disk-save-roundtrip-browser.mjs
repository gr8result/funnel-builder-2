import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { writeJob, readJob } from "../lib/jobFile.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.OPEN_LOCAL_JOB_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "test-results", "job-file-disk-save-roundtrip-browser");
const physicalFilePath = path.join(outDir, "Save Roundtrip Test.gr8job");
const physicalFileName = "Save Roundtrip Test.gr8job";
await fs.mkdir(outDir, { recursive: true });
await fs.rm(physicalFilePath, { force: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-save-roundtrip-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

const handleCalls = { openPicker: 0, savePicker: 0, createWritable: 0, write: 0, close: 0, getFile: 0 };

await writeInitialPhysicalJob();
const initialStat = await fs.stat(physicalFilePath);
const initialJob = await readPhysicalJob();
const initialRevision = Number(initialJob.masterRevision || initialJob.manifest?.revision || 0);

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
  await page.exposeFunction("__readRoundtripFileBase64", async () => {
    handleCalls.getFile += 1;
    return (await fs.readFile(physicalFilePath)).toString("base64");
  });
  await page.exposeFunction("__writeRoundtripFileBase64", async (base64) => {
    await fs.writeFile(physicalFilePath, Buffer.from(String(base64 || ""), "base64"));
  });
  await page.exposeFunction("__recordRoundtripHandleCall", async (name) => {
    if (name in handleCalls) handleCalls[name] += 1;
  });
  await page.evaluateOnNewDocument((fileName) => {
    const bytesFromBase64 = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const base64FromBytes = (bytes) => {
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      return btoa(binary);
    };
    const createHandle = () => ({
      kind: "file",
      name: fileName,
      async getFile() {
        const bytes = bytesFromBase64(await window.__readRoundtripFileBase64());
        return new File([bytes], fileName, { type: "application/zip" });
      },
      async queryPermission() { return "granted"; },
      async requestPermission() { return "granted"; },
      async createWritable() {
        await window.__recordRoundtripHandleCall("createWritable");
        const chunks = [];
        return {
          async write(value) {
            await window.__recordRoundtripHandleCall("write");
            const bytes = value instanceof Blob
              ? new Uint8Array(await value.arrayBuffer())
              : new Uint8Array(value);
            chunks.push(bytes);
          },
          async close() {
            await window.__recordRoundtripHandleCall("close");
            const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            chunks.forEach((chunk) => {
              merged.set(chunk, offset);
              offset += chunk.byteLength;
            });
            await window.__writeRoundtripFileBase64(base64FromBytes(merged));
          },
        };
      },
    });
    window.showOpenFilePicker = async () => {
      await window.__recordRoundtripHandleCall("openPicker");
      return [createHandle()];
    };
    window.showSaveFilePicker = async () => {
      await window.__recordRoundtripHandleCall("savePicker");
      return createHandle();
    };
  }, physicalFileName);

  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });

  await primeAuth(page, auth.session);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="builder-module-banner-title"]');
  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Open Job File From Computer");
  await waitForInputValue(page, "#data-edit-inputDataSheet-projectName", "Save Roundtrip Test");
  await screenshot(page, "01-before-edit.png");

  await setInputValue(page, "#data-edit-inputDataSheet-projectName", "Save Roundtrip Test Updated");
  await setInputValue(page, "#data-edit-inputDataSheet-clientName", "Disk Persistence Verified");
  await setInputValue(page, "#data-edit-inputDataSheet-expectedBuildDuration", "27 weeks");
  await waitForInputValue(page, "#data-edit-inputDataSheet-projectName", "Save Roundtrip Test Updated");
  await screenshot(page, "02-unsaved-state.png");

  await clickText(page, "Save Job");
  await waitForSaveStatus(page, "Saved to Computer File: Save Roundtrip Test.gr8job");
  await screenshot(page, "03-verified-save-status.png");

  const savedStat = await fs.stat(physicalFilePath);
  assert.ok(savedStat.size > 0, "saved file is non-zero");
  assert.ok(savedStat.mtimeMs >= initialStat.mtimeMs, "physical modified time changed or stayed monotonic");
  assert.ok(handleCalls.openPicker >= 1, "Open Job File From Computer used showOpenFilePicker");
  assert.ok(handleCalls.createWritable >= 1, "Save Job used createWritable");
  assert.ok(handleCalls.close >= 1, "Save Job closed the writable stream");

  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Close Job");
  await waitForBodyText(page, "No job open");
  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Open Job File From Computer");
  await waitForInputValue(page, "#data-edit-inputDataSheet-projectName", "Save Roundtrip Test Updated");
  await assertInputValue(page, "#data-edit-inputDataSheet-clientName", "Disk Persistence Verified");
  await assertInputValue(page, "#data-edit-inputDataSheet-expectedBuildDuration", "27 weeks");
  await screenshot(page, "04-reopened-job-setup-updated.png");

  await clickText(page, "Client Selections");
  await page.waitForFunction(() => document.querySelector('[data-testid="builder-module-banner-title"]')?.textContent?.trim() === "Client Selections");
  await waitForBodyText(page, "Save Roundtrip Test Updated");
  await screenshot(page, "05-reopened-client-selections.png");

  await clickText(page, "Job Setup");
  await waitForInputValue(page, "#data-edit-inputDataSheet-projectName", "Save Roundtrip Test Updated");
  await setInputValue(page, "#data-edit-inputDataSheet-expectedBuildDuration", "31 weeks");
  await clickText(page, "Save Job");
  await waitForSaveStatus(page, "Saved to Computer File: Save Roundtrip Test.gr8job");
  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Close Job");
  await waitForBodyText(page, "No job open");
  await page.click("#estimate-builder-file-menu-button");
  await clickText(page, "Open Job File From Computer");
  await waitForInputValue(page, "#data-edit-inputDataSheet-expectedBuildDuration", "31 weeks");

  const secondReopen = await readPhysicalJob();
  const secondRows = secondReopen.workbook?.data?.inputDataSheet?.rows || {};
  assert.equal(secondRows.projectName?.value, "Save Roundtrip Test Updated");
  assert.equal(secondRows.clientName?.value, "Disk Persistence Verified");
  assert.equal(secondRows.expectedBuildDuration?.value, "31 weeks");
  assert.equal(secondReopen.jobId, "save-roundtrip-browser-test");
  assert.ok(Number(secondReopen.masterRevision || secondReopen.manifest?.revision || 0) >= initialRevision + 2, "two save cycles increase revision twice");
  assert.equal(secondReopen.quotation?.rows?.[0]?.marker, "quotation-browser-preserved");
  assert.equal(secondReopen.assets?.plans?.[0]?.marker, "assets-browser-preserved");
  assert.deepEqual(runtimeErrors, [], `Runtime errors detected:\n${runtimeErrors.join("\n")}`);

  const secondStat = await fs.stat(physicalFilePath);
  console.log(JSON.stringify({
    filePath: physicalFilePath,
    initialSize: initialStat.size,
    savedSize: savedStat.size,
    finalSize: secondStat.size,
    initialModifiedTime: initialStat.mtime.toISOString(),
    savedModifiedTime: savedStat.mtime.toISOString(),
    finalModifiedTime: secondStat.mtime.toISOString(),
    initialRevision,
    finalRevision: secondReopen.masterRevision || secondReopen.manifest?.revision || 0,
    handleCalls,
    screenshots: outDir,
  }, null, 2));
} finally {
  await browser.close();
}

async function writeInitialPhysicalJob() {
  const handle = {
    name: physicalFileName,
    async getFile() {
      const bytes = await fs.readFile(physicalFilePath);
      return new File([bytes], physicalFileName);
    },
    async createWritable() {
      let chunks = [];
      return {
        async write(value) {
          const buffer = value instanceof Blob ? Buffer.from(await value.arrayBuffer()) : Buffer.from(value);
          chunks.push(buffer);
        },
        async close() {
          await fs.writeFile(physicalFilePath, Buffer.concat(chunks));
        },
      };
    },
  };
  await writeJob(handle, {
    jobName: "Save Roundtrip Test",
    clientName: "Disk Persistence Baseline",
    jobNumber: "SAVE-BROWSER-001",
    address: "2 Browser Roundtrip Circuit",
    "job-details": { projectId: "save-roundtrip-browser-test" },
    estimate: {
      workbook: {
        projectId: "save-roundtrip-browser-test",
        commercialProjectId: "save-roundtrip-browser-test",
        registeredJob: { jobId: "save-roundtrip-browser-test", jobName: "Save Roundtrip Test", jobNumber: "SAVE-BROWSER-001", clientName: "Disk Persistence Baseline" },
        data: {
          inputDataSheet: {
            rows: {
              projectName: { value: "Save Roundtrip Test" },
              clientName: { value: "Disk Persistence Baseline" },
              jobNumber: { value: "SAVE-BROWSER-001" },
              expectedBuildDuration: { value: "12 weeks" },
            },
          },
        },
        clientSelectionsBook: { selections: { diskPersistence: { value: "baseline browser selection" } } },
        aiPlanTakeoffJob: { plan: { pages: [{ id: "browser-plan-page", marker: "takeoff-browser-preserved" }] } },
      },
    },
    takeoff: { assets: [{ id: "takeoff-browser-asset", marker: "takeoff-section-browser-preserved" }] },
    "client-selections": { book: { rooms: [{ id: "kitchen" }], selections: { browserFixture: { value: "client-selection-browser-preserved" } } } },
    quotation: { rows: [{ id: "quote-browser-row", marker: "quotation-browser-preserved" }] },
    boq: { items: [{ id: "boq-browser-row", marker: "boq-browser-preserved" }] },
    procurement: { items: [{ id: "po-browser-row", marker: "procurement-browser-preserved" }] },
    variations: { items: [{ id: "variation-browser-row", marker: "variation-browser-preserved" }] },
    "project-documents": { documents: [{ id: "doc-browser-row", marker: "documents-browser-preserved" }] },
    assets: { plans: [{ id: "asset-browser-plan", marker: "assets-browser-preserved" }] },
  });
}

async function readPhysicalJob() {
  const bytes = await fs.readFile(physicalFilePath);
  return readJob(new File([bytes], physicalFileName));
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
    full_name: "Codex Save Roundtrip Tester",
    business_name: "Save Roundtrip Verification",
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

async function setInputValue(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.keyboard.press("A");
  await page.keyboard.up(modifier);
  await page.keyboard.type(value);
  await page.$eval(selector, (element) => {
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
  });
}

async function waitForInputValue(page, selector, expected) {
  await page.waitForFunction((targetSelector, value) => document.querySelector(targetSelector)?.value === value, { timeout: 120000 }, selector, expected);
}

async function assertInputValue(page, selector, expected) {
  const actual = await page.$eval(selector, (element) => element.value || "");
  assert.equal(actual, expected, `${selector} should be ${expected}`);
}

async function waitForBodyText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 120000 }, text);
}

async function waitForSaveStatus(page, text) {
  try {
    await waitForBodyText(page, text);
  } catch (error) {
    const stat = await fs.stat(physicalFilePath).catch(() => null);
    const body = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    throw new Error(`${error.message}\nExpected save status: ${text}\nHandle calls: ${JSON.stringify(handleCalls)}\nFile stat: ${stat ? JSON.stringify({ size: stat.size, mtime: stat.mtime.toISOString() }) : "missing"}\nBody:\n${body}`);
  }
}
