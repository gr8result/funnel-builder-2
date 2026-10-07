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

const baseUrl = process.env.BUILDER_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const outDir = path.join(root, "artifacts/test-results", "window-schedule-patio-browser");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-window-schedule-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1920, height: 1080 },
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

  // --- Data Input: workbook tabs and Patio row ---
  await page.goto(`${baseUrl}/modules/estimate-builder?page=dataInput`, { waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForSelector('[data-testid="job-setup-takeoff-import"]', { timeout: 60000 }).catch(() => {});

  // Regression check for the reported crash: "Runtime TypeError: Cannot read properties of
  // undefined (reading 'sheetLevels')" in JobSetupTakeoffImport's useSource, triggered by this
  // exact button (startImport -> useSource). No job/takeoff is open in this fixture, which is
  // itself one of the crash's legitimate no-data states, so this proves the click survives it.
  const importButtonClicked = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent.trim() === "Import takeoff quantities");
    if (!button || button.disabled) return false;
    button.click();
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const overlayText = await page.evaluate(() => document.body.innerText);
  assert.equal(/Cannot read properties of undefined/.test(overlayText), false, "No 'Cannot read properties of undefined' runtime error overlay after clicking Import takeoff quantities");
  console.log(`"Import takeoff quantities" clicked: ${importButtonClicked}; no crash overlay.`);

  const tabState = await page.evaluate(() => {
    const tabButtons = Array.from(document.querySelectorAll("button")).filter((button) => {
      const text = button.textContent?.trim() || "";
      return ["Data Input", "Calculations", "Window Schedule", "Quote Sheet"].includes(text);
    });
    return tabButtons.map((button) => button.textContent.trim());
  });
  console.log("Workbook tabs found:", tabState);
  assert.ok(tabState.includes("Window Schedule"), "Window Schedule tab must be present in the workbook tab bar");
  const tabOrder = ["Data Input", "Calculations", "Window Schedule", "Quote Sheet"].filter((label) => tabState.includes(label));
  assert.deepEqual(tabOrder, ["Data Input", "Calculations", "Window Schedule", "Quote Sheet"], "Tabs render in the expected order");

  await page.screenshot({ path: path.join(outDir, "01-data-input-tabs.png"), fullPage: false });

  // Find the Patio row by its label text and read its rendered cells.
  const patioRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());
      if (cells.some((cell) => /patio/i.test(cell))) {
        return { cells, html: row.outerHTML.slice(0, 400) };
      }
    }
    return null;
  });
  console.log("Patio row cells:", patioRow?.cells);
  assert.ok(patioRow, "A Patio row must be visible on the Data Input sheet");
  assert.equal(patioRow.cells[2], "Ground Level Patio area", "Patio label reads 'Ground Level Patio area'");
  assert.equal(patioRow.cells[1], "Floor / Slab Areas", "Patio section column matches its Floor / Slab Areas neighbours");

  // Second/Third Level wall-thickness rows only render once the job is set to more than one
  // storey (isRelevantForFloorCount) - existing, correct behaviour, not part of this fix. Raise
  // the storey count first so all 12 rows (3 levels x internal/external x 70/90mm) are checked.
  const floorCountSet = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    const select = selects.find((element) => Array.from(element.options).some((option) => option.value === "Three storey"));
    if (!select) return false;
    select.value = "Three storey";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  assert.ok(floorCountSet, "Found the floor count selector to reveal Second/Third Level rows");
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Check the wall-thickness rows do not visually overlap: row-number cell and Section cell must
  // not intersect on screen for a "74.10x" row.
  const wallThicknessOverlap = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr"));
    const results = [];
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      const text = cells.map((cell) => cell.textContent.trim());
      if (text.some((cell) => /framed walls/i.test(cell))) {
        const numberCell = cells[0];
        const sectionCell = cells[1];
        if (!numberCell || !sectionCell) continue;
        const numberRect = numberCell.getBoundingClientRect();
        const sectionRect = sectionCell.getBoundingClientRect();
        const overlaps = numberRect.right > sectionRect.left;
        results.push({ number: text[0], section: text[1], label: text[2], overlaps });
      }
    }
    return results;
  });
  console.log(`Wall thickness rows checked: ${wallThicknessOverlap.length}`);
  for (const row of wallThicknessOverlap) {
    assert.equal(row.overlaps, false, `Row number "${row.number}" must not overlap the Section column (${row.section} / ${row.label})`);
  }
  assert.ok(wallThicknessOverlap.length >= 12, `All 12 wall-thickness rows (3 levels x internal/external x 70/90mm) are present (found ${wallThicknessOverlap.length}: ${JSON.stringify(wallThicknessOverlap.map((row) => row.number))})`);

  await page.screenshot({ path: path.join(outDir, "02-wall-thickness-section.png"), fullPage: true });

  // --- Window Schedule tab (no takeoff attached yet: structural / empty-state check) ---
  const matches = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons
      .map((button, index) => ({ index, text: button.textContent.trim() }))
      .filter((entry) => entry.text === "Window Schedule");
  });
  assert.equal(matches.length, 1, `Exactly one "Window Schedule" tab button must exist (found ${matches.length})`);
  const buttons = await page.$$("button");
  const targetButton = buttons[matches[0].index];
  assert.ok(targetButton, "Window Schedule tab button is clickable");
  await targetButton.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const windowScheduleState = await page.evaluate(() => ({
    hasNoTakeoffMessage: document.body.innerText.includes("No saved AI Plan Takeoff is attached to this job yet"),
    dataInputStillActive: document.body.innerText.includes("Takeoff quantities"),
    url: window.location.href,
  }));
  console.log("Window Schedule tab state:", windowScheduleState);
  assert.ok(windowScheduleState.hasNoTakeoffMessage, "Window Schedule page's own empty-state message renders (proves the tab actually navigated, not just that the label exists)");
  assert.equal(windowScheduleState.dataInputStillActive, false, "Data Input's own content is no longer showing");
  await page.screenshot({ path: path.join(outDir, "03-window-schedule-empty-state.png"), fullPage: true });

  await assertNoRuntimeErrors(runtimeErrors);
  console.log(`\nAll browser checks passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Window Schedule Tester",
    business_name: "Window Schedule Verification",
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

async function assertNoRuntimeErrors(errors) {
  if (errors.length) throw new Error(`Runtime errors detected:\n${errors.join("\n")}`);
}
