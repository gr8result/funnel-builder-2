import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { readyCabinetrySelection } from "./cabinetry-room-fixture.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(supabaseUrl && anonKey && serviceKey, "Supabase environment values are required.");

const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const runId = crypto.randomUUID();
const jobId = `cabinet-variant-browser-${runId}`;
const email = `cabinet-variant-${runId}@example.test`;
const password = `${crypto.randomBytes(24).toString("base64url")}Aa1!`;
const outputDir = path.resolve("artifacts/test-results/cabinetry-variant-browser");
fs.mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `${jobId}.json`);
const report = { jobId, workspaceId, passed: false, protectedJobsTouched: false };
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = "";
let browser;
let page;
let stage = "create temporary user";

function isolatedWorkbook() {
  const jobName = "Cabinet variant browser acceptance";
  const defaults = createEstimateBuilderWorkbookDefaults({}, { workspaceId });
  const selection = readyCabinetrySelection(["Kitchen", "Butler's Pantry", "Laundry"]);
  const book = {
    documentType: "luxury_selections_book",
    rooms: [{
      id: "room-kitchen",
      name: "Kitchen",
      rows: [{
        id: "row-cabinetry",
        item: "Cabinetry",
        guidedRequirementKey: "cabinetry",
        selectedProduct: "Cabinetry specification",
        guidedSelection: { requirementKey: "cabinetry", requirementLabel: "Cabinetry", cabinetrySelection: selection },
      }],
    }],
  };
  return {
    ...defaults,
    templateType: "job",
    page: "clientSelections",
    id: jobId,
    jobId,
    projectId: jobId,
    commercialProjectId: jobId,
    registeredJobId: jobId,
    workspaceId,
    registeredJob: { jobId, jobName, jobNumber: "CAB-VARIANT-TEST" },
    jobFileMeta: { projectId: jobId, jobName, jobNumber: "CAB-VARIANT-TEST" },
    clientSelectionsBook: book,
    selectionsBook: book,
  };
}

try {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const account = {
    user_id: userId,
    email,
    full_name: "Cabinet Variant Test",
    business_name: "Cabinet Variant Test",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
  };
  let fields = { ...account };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await admin.from("accounts").upsert(fields, { onConflict: "user_id" });
    if (!result.error) break;
    const missing = result.error.message.match(/'([^']+)' column|column "([^"]+)"/i);
    const field = missing?.[1] || missing?.[2];
    if (!field || !(field in fields)) throw result.error;
    delete fields[field];
  }
  const membership = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner", status: "active" });
  if (membership.error) throw membership.error;

  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    protocolTimeout: 180000,
    defaultViewport: { width: 1920, height: 1080 },
  });
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (error) => { report.pageError ||= error.message; });
  page.on("console", (message) => {
    if (message.type() === "error") (report.consoleErrors ||= []).push(message.text());
  });
  await page.evaluateOnNewDocument((id) => {
    localStorage.setItem("active_workspace_id", id);
    localStorage.setItem("estimate-builder-show-developer-controls", "true");
    window.__auditSheet = () => window.__estimateBuilderSheet || null;
  }, workspaceId);

  stage = "normal application login";
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Sign In")?.click());
  await page.waitForFunction(() => location.pathname !== "/login");

  stage = "seed isolated local job";
  const workbook = isolatedWorkbook();
  await page.goto(`${origin}/__cabinet_variant_seed__`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
  await page.evaluate(({ jobId, workbook }) => new Promise((resolve, reject) => {
    const open = indexedDB.open("estimate-builder-template-db", 2);
    open.onupgradeneeded = () => { for (const name of ["jobs", "templates"]) if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("jobs", "readwrite");
      transaction.objectStore("jobs").put({ key: `job:${jobId}`, type: "job", jobId, name: workbook.registeredJob.jobName, workbook, revision: 1, schemaVersion: 3, jobSchemaVersion: 3, savedAt: new Date().toISOString() }, `job:${jobId}`);
      transaction.oncomplete = () => { sessionStorage.setItem("estimate-builder-explicit-active-job-key", `job:${jobId}`); db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), { jobId, workbook });

  stage = "open Client Selections cabinetry";
  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobId)}&page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  async function waitForClientSelections() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.waitForFunction(() => document.body.innerText.includes("CHOOSE AN AREA") || document.body.innerText.includes("Client Selections could not be opened."), { timeout: 120000 });
      if (await page.evaluate(() => document.body.innerText.includes("CHOOSE AN AREA"))) return;
      await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Retry")?.click());
    }
    throw new Error("Client Selections did not mount after the application Retry action.");
  }
  await waitForClientSelections();
  const readStoredWorkbook = () => page.evaluate((id) => new Promise((resolve, reject) => {
    const open = indexedDB.open("estimate-builder-template-db", 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("jobs", "readonly");
      const request = transaction.objectStore("jobs").get(`job:${id}`);
      request.onsuccess = () => resolve(request.result?.workbook || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    };
  }), jobId);
  const persistedVariantLines = (storedWorkbook) => {
    const selection = storedWorkbook?.clientSelectionsBook?.rooms
      ?.flatMap((room) => room.rows || [])
      .map((row) => row.guidedSelection?.cabinetrySelection)
      .find(Boolean);
    return (selection?.schedule || []).filter((line) => /^(base_unit|tall_pantry)/.test(line.cabinetTypeId));
  };
  async function waitForPersistedVariantCount(expectedCount) {
    const deadline = Date.now() + 120000;
    let lines = [];
    while (Date.now() < deadline) {
      lines = persistedVariantLines(await readStoredWorkbook());
      if (lines.length === expectedCount) return lines;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for ${expectedCount} persisted cabinet variants; found ${lines.length}: ${lines.map((line) => `${line.location}:${line.cabinetTypeId}`).join(", ")}`);
  }
  const click = (selector) => page.$eval(selector, (element) => element.click());
  const summary = '[data-testid="guided-kitchen-checklist"]';
  const landing = '[data-testid="cabinetry-room-landing"]';
  async function openCabinetryLanding() {
    for (let guard = 0; guard < 30 && !(await page.$(landing)); guard += 1) {
      if (await page.evaluate(() => document.body.innerText.includes("We couldn't verify your account access right now."))) {
        await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Retry")?.click());
      } else if (await page.$('[data-testid="project-room-manager"]')) await click('[data-testid="room-setup-confirm-button"]');
      else if (await page.$(summary)) await click(`${summary} [data-testid="guided-requirement-cabinetry"]`);
      else if (await page.$('[data-testid="guided-client-selections-home"]')) await click('[data-testid="guided-client-selections-home"] [data-category-key="interior"]');
      else if (await page.$('[data-testid="guided-interior-categories"]')) await click('[data-testid="guided-interior-categories"] [data-category-key="cabinetry"]');
      else if (await page.$('[data-testid="guided-requirement-cabinetry"]')) await click('[data-testid="guided-requirement-cabinetry"]');
      else await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => ["Back", "Change"].includes(button.textContent?.trim()))?.click());
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await page.waitForSelector(landing);
  }
  await openCabinetryLanding();

  async function selectVariants(roomTestId, roomName, variantIds, expectedPersistedCount) {
    await click(`[data-testid="${roomTestId}"]`);
    await page.waitForFunction((expected) => document.querySelector(".cabinetryBanner strong")?.textContent?.includes(expected), {}, roomName);
    await page.waitForSelector('[data-testid="cabinet-schedule-base"]');
    for (const variantId of variantIds) {
      const selector = `[data-cabinet-item="${variantId}"]`;
      await page.waitForSelector(selector);
      const selected = await page.$eval(selector, (row) => row.classList.contains("selected"));
      if (!selected) await click(`${selector} input[type="checkbox"]`);
    }
    await page.evaluate(() => {
      const actions = document.querySelector('[data-testid="cabinetry-bottom-workflow-actions"]');
      [...(actions?.querySelectorAll("button") || [])].find((button) => button.textContent?.trim() === "Save Draft")?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await click(".cabinetryBanner button");
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Change"));
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Change")?.click());
    await page.waitForSelector(landing);
    await waitForPersistedVariantCount(expectedPersistedCount);
  }

  stage = "select 600 and 1200 variants through UI";
  await selectVariants("cabinetry-room-kitchen", "Kitchen", ["base_unit_600_1door", "tall_pantry_1200"], 2);
  await selectVariants("cabinetry-room-butler-s-pantry", "Butler's Pantry", ["base_unit_1200_2door", "tall_pantry_600"], 4);
  await selectVariants("cabinetry-room-laundry", "Laundry", ["base_unit_600_1door"], 5);

  const storedBeforeSave = await readStoredWorkbook();
  const selectedBeforeSave = (() => {
    return persistedVariantLines(storedBeforeSave).map((line) => ({
      componentId: line.componentId,
      room: line.location,
      cabinetTypeId: line.cabinetTypeId,
      selectedVariantId: line.selectedVariantId,
      cabinetProductId: line.cabinetProductId,
      pricingCategoryId: line.pricingCategoryId,
      pricingWidthMm: line.pricingWidthMm,
      doorCount: line.doorCount,
      selectedFinishKey: line.selectedFinishKey,
      quantity: line.quantity,
    }));
  })();
  assert.equal(selectedBeforeSave.length, 5);
  assert(selectedBeforeSave.every((line) => line.selectedVariantId === line.cabinetTypeId && line.cabinetProductId && line.selectedFinishKey === "standard_colourboard"));

  stage = "hard refresh and reopen";
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForClientSelections();
  const reopenedWorkbook = await readStoredWorkbook();
  const reopened = (() => {
    const selection = reopenedWorkbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).map((row) => row.guidedSelection?.cabinetrySelection).find(Boolean);
    const lines = selection.schedule.filter((line) => /^(base_unit|tall_pantry)/.test(line.cabinetTypeId)).map((line) => ({
      componentId: line.componentId,
      room: line.location,
      cabinetTypeId: line.cabinetTypeId,
      selectedVariantId: line.selectedVariantId,
      cabinetProductId: line.cabinetProductId,
      pricingCategoryId: line.pricingCategoryId,
      pricingWidthMm: line.pricingWidthMm,
      doorCount: line.doorCount,
      selectedFinishKey: line.selectedFinishKey,
      quantity: line.quantity,
    }));
    const requirementIds = new Set(lines.map((line) => `selection:${line.componentId}`));
    const entries = reopenedWorkbook.cabinetryReconciliation.entries.filter((entry) => requirementIds.has(entry.requirementId));
    const rows = entries.map((entry) => {
      const row = reopenedWorkbook.quotation.CABINETRY.rows.find((item) => item.importKey === entry.matchedImportKey);
      return { room: entry.room, type: entry.type, outcome: entry.outcome, quantity: entry.quantity, rate: row?.finalRateUsed ?? row?.excelRate, rowId: row?.id || "" };
    });
    return { lines, rows, quotationRowIds: reopenedWorkbook.quotation.CABINETRY.rows.map((row) => row.id) };
  })();
  assert.deepEqual(reopened.lines, selectedBeforeSave);
  assert.deepEqual(reopened.rows.map(({ room, type, outcome, quantity, rate }) => ({ room, type, outcome, quantity, rate })), [
    { room: "Kitchen", type: "base_unit_600_1door", outcome: "MATCHED", quantity: 1, rate: 850 },
    { room: "Kitchen", type: "tall_pantry_1200", outcome: "MATCHED", quantity: 1, rate: 2300 },
    { room: "Butler's Pantry", type: "base_unit_1200_2door", outcome: "MATCHED", quantity: 1, rate: 1150 },
    { room: "Butler's Pantry", type: "tall_pantry_600", outcome: "MATCHED", quantity: 1, rate: 1800 },
    { room: "Laundry", type: "base_unit_600_1door", outcome: "MATCHED", quantity: 1, rate: 850 },
  ]);
  assert.equal(new Set(reopened.quotationRowIds).size, reopened.quotationRowIds.length);

  await page.screenshot({ path: path.join(outputDir, `${jobId}-reopen.png`), fullPage: true });
  report.passed = true;
  report.selectedBeforeSave = selectedBeforeSave;
  report.reopened = reopened.rows;
  report.screenshot = path.join(outputDir, `${jobId}-reopen.png`);
} catch (error) {
  report.failedStage = stage;
  report.error = error?.stack || error?.message || String(error);
  if (page && !page.isClosed()) {
    report.browserState = await page.evaluate(() => ({
      url: location.href,
      body: document.body.innerText.slice(-2000),
      activeJobKey: sessionStorage.getItem("estimate-builder-explicit-active-job-key"),
      sheetAvailable: Boolean(window.__auditSheet?.()),
      hydrated: window.__auditSheet?.()?.hydrated === true,
      sheetJobId: window.__auditSheet?.()?.workbook?.jobId || "",
      hydrationTrace: window.__estimateBuilderHydrationTrace || [],
      developerError: document.querySelector("details pre")?.textContent || "",
    })).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));
  }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (userId) {
    await admin.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await admin.from("accounts").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
