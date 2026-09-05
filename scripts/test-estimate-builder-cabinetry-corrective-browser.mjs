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
const outDir = path.join(root, "test-results", "estimate-builder-cabinetry-corrective");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log("Cabinetry corrective browser verification skipped: authenticated local session required.");
  process.exit(0);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-cabinetry-corrective-${runId}@example.test`;
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
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    await screenshot(page, "01-area-cards-after.png");
    await assertCompactImageCards(page);
    await clickByRequirementKey(page, "interior");
  }

  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await screenshot(page, "02-interior-cards-after.png");
  await assertCompactImageCards(page);
  await clickByRequirementKey(page, "cabinetry");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  await clickByTestId(page, "cabinetry-room-kitchen");
  await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]');
  await assertText(page, "CABINETRY / KITCHEN");
  await assertText(page, "Kitchen Cabinetry Specification");

  await clickTextIn(page, ".cabinetryWorkflow", "Back");
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await clickByRequirementKey(page, "cabinetry");
  await clickByTestId(page, "cabinetry-room-kitchen");
  await clickTextIn(page, ".cabinetryWorkflow", "Doors & Panels");
  await page.waitForSelector('[data-testid="cabinetry-material-stage"]');
  await clickTextIn(page, ".standardActions", "Back");
  await page.waitForSelector('[data-testid="cabinetry-location-stage"]');
  await clickTextIn(page, ".cabinetryWorkflow", "Doors & Panels");
  await clickTextIn(page, ".cabinetryWorkflow", "Standard colourboard");
  await clickTextIn(page, ".cabinetryWorkflow", "Lower base-unit doors");
  await clickTextIn(page, ".cabinetryWorkflow", "Island bench back");
  await clickTextIn(page, ".cabinetryWorkflow", "End panels");
  await clickTextIn(page, ".cabinetryWorkflow", "Kick panels");
  await clickTextIn(page, ".cabinetryWorkflow", "Bulkheads");
  await assertLargeCheckboxes(page);
  await screenshot(page, "03-doors-panels-large-checkbox-lists.png");

  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  await page.waitForSelector('[data-testid="cabinetry-colour-selector"]');
  await page.waitForSelector('[data-testid="cabinetry-apply-colour-to"]');
  await screenshot(page, "04-apply-colour-to-area-selector.png");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Laminex");
  await page.waitForFunction(() => document.querySelectorAll(".cabinetryColourCard[data-supplier='Laminex']").length > 0);
  await clickCardAction(page, "Polar White", "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await chooseFirstColourCombination(page);
  await setOnlyModalArea(page, "Lower base-unit doors");
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Apply Colour");
  await assertAreaSummary(page, "Lower base-unit doors", "Polar White");
  await screenshot(page, "05-laminex-selected-lower-doors.png");
  await clickTextIn(page, '[data-testid="cabinetry-apply-colour-to"]', "Island bench back");
  await clickTextIn(page, '[data-testid="cabinetry-apply-colour-to"]', "End panels");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Polytec");
  await page.waitForFunction(() => document.querySelectorAll(".cabinetryColourCard[data-supplier='Polytec']").length > 0);
  await screenshot(page, "06-polytec-grid-before-selection.png");
  await clickCardAction(page, "Angora Oak", "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Decorative 16mm doors and panels / Woodmatt");
  await setModalAreas(page, ["Island bench back", "End panels"]);
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Apply Colour");
  await assertAreaSummary(page, "Island bench back", "Angora Oak");
  await assertAreaSummary(page, "End panels", "Angora Oak");
  await clickSummaryAction(page, "Overheads", "Select");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Laminex");
  await page.waitForFunction(() => document.querySelectorAll(".cabinetryColourCard[data-supplier='Laminex']").length > 0);
  await clickCardAction(page, "Polar White", "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await assertModalAreaState(page, { checked: ["Overheads"], unchecked: ["Lower base-unit doors", "Island bench back", "End panels"] });
  await chooseFirstColourCombination(page);
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Apply Colour");
  await assertAreaSummary(page, "Overheads", "Polar White");
  await clickTextIn(page, '[data-testid="cabinetry-kick-panel-finish-options"]', "Brushed aluminium");
  await assertAreaSummary(page, "Kick panels", "Brushed aluminium");
  await clickTextIn(page, '[data-testid="cabinetry-bulkhead-finish-options"]', "Raw MDF - painted to match walls");
  await assertAreaSummary(page, "Bulkheads", "Raw MDF");
  await screenshot(page, "07-different-colours-by-area-summary.png");
  await clickTextIn(page, '[data-testid="cabinetry-apply-colour-to"]', "Overheads");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Polytec");
  await clickCardAction(page, "Adriatic", "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Decorative 18mm doors and panels / Venette");
  await setOnlyModalArea(page, "Overheads");
  await clickTextIn(page, '[data-testid="cabinetry-colour-selection-modal"]', "Apply Colour");
  await assertAreaSummary(page, "Overheads", "Adriatic");
  await assertAreaSummary(page, "Lower base-unit doors", "Polar White");
  await assertAreaSummary(page, "Island bench back", "Angora Oak");
  await assertAreaSummary(page, "End panels", "Angora Oak");
  await assertAreaSummary(page, "Kick panels", "Brushed aluminium");
  await assertAreaSummary(page, "Bulkheads", "Raw MDF");
  await assertText(page, "Visit Polytec Website");
  await screenshot(page, "08-overheads-changed-only.png");

  await clickTextIn(page, ".cabinetryWorkflow", "Save Draft");
  await clickTextIn(page, ".standardActions", "Back");
  await page.waitForSelector('[data-testid="cabinetry-material-stage"]');
  await clickTextIn(page, ".standardActions", "Back");
  await page.waitForSelector('[data-testid="cabinetry-location-stage"]');
  await page.reload({ waitUntil: "networkidle0", timeout: 120000 });
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]', '[data-testid="guided-cabinetry-workflow"]']);
  await enterCabinetryKitchen(page);
  await clickTextIn(page, ".cabinetryWorkflow", "Colours & Finishes");
  await assertAreaSummary(page, "Lower base-unit doors", "Polar White");
  await assertAreaSummary(page, "Island bench back", "Angora Oak");
  await assertAreaSummary(page, "End panels", "Angora Oak");
  await assertText(page, "Adriatic");
  await assertAreaSummary(page, "Kick panels", "Brushed aluminium");
  await assertAreaSummary(page, "Bulkheads", "Raw MDF");
  await clickTextIn(page, '[data-testid="cabinetry-apply-colour-to"]', "Overheads");
  await assertText(page, "Visit Polytec Website");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Laminex");
  await assertText(page, "Polar White");
  await clickTextIn(page, ".cabinetrySupplierButtons", "Polytec");
  await assertText(page, "Adriatic");
  await screenshot(page, "09-area-selections-after-refresh.png");

  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(`Cabinetry corrective browser verification passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Cabinetry Corrective Tester",
    business_name: "Cabinetry Corrective Verification",
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

async function assertCompactImageCards(page) {
  const cards = await page.$$eval(".guidedImageCard", (items) => items.map((card) => {
    const title = card.querySelector(".guidedImageCardTitle");
    const cardRect = card.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const titleStyle = title ? getComputedStyle(title) : null;
    return {
      label: title?.textContent?.trim() || "",
      text: card.innerText,
      ariaLabel: card.getAttribute("aria-label") || "",
      cardHeight: cardRect.height,
      titleHeight: titleRect?.height || 0,
      titleWidth: titleRect?.width || 0,
      cardWidth: cardRect.width,
      titleBackground: titleStyle?.backgroundColor || "",
    };
  }));
  assert.ok(cards.length >= 2, "Expected guided image cards");
  for (const card of cards) {
    assert.ok(card.titleHeight > 28 && card.titleHeight < 72, "Title strip must be compact");
    assert.ok(card.titleWidth < card.cardWidth * 0.74, "Title strip must not stretch across the card");
    assert.match(card.titleBackground, /rgba\(15, 118, 110, 0\.(7|76|8)/, "Title strip must be translucent teal");
    assert.equal(card.text.trim(), card.label, "Image card must render only the category title");
    assert.equal(card.ariaLabel, `Open ${card.label} selections`, "Image card must expose an accessible open label");
    assert.doesNotMatch(card.text, /Open|Not started|Selected:|complete|Choose|Configure/i, "Image card must not show footer/status/progress copy");
  }
}

async function assertLargeCheckboxes(page) {
  const boxes = await page.$$eval('[data-testid="cabinetry-material-stage"] .cabinetrySelectionRow > input[type="checkbox"]', (items) => items.map((input) => {
    const rect = input.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assert.ok(boxes.length >= 8, "Expected material and application-area checkbox rows");
  boxes.forEach((box) => {
    assert.ok(box.width >= 28 && box.height >= 28, "Checkbox control must be at least 28px square");
  });
}

async function enterCabinetryKitchen(page) {
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) await clickByRequirementKey(page, "cabinetry");
  if (await hasSelector(page, '[data-testid="cabinetry-room-landing"]')) await clickByTestId(page, "cabinetry-room-kitchen");
  await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]');
}

async function clickByRequirementKey(page, key) {
  await page.evaluate((requirementKey) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
    };
    const target = [...document.querySelectorAll(`[data-requirement-key="${requirementKey}"]`)].find(visible);
    if (!target) throw new Error(`Could not find requirement key ${requirementKey}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, key);
}

async function clickByTestId(page, testId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"]`);
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
    const element = [...root.querySelectorAll("button, a, label, [role='button']")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!element) throw new Error(`Could not find clickable text in ${selector}: ${expected}`);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, { selector, expected: text });
}

async function clickCardAction(page, colourName, actionText) {
  await page.evaluate(({ colourName, actionText }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const card = [...document.querySelectorAll(".cabinetryColourCard")].find((item) => normalise(item.querySelector(".cabinetryColourCardBody strong")?.textContent) === colourName)
      || [...document.querySelectorAll(".cabinetryColourCard")].find((item) => normalise(item.textContent).includes(colourName));
    if (!card) throw new Error(`Could not find colour card ${colourName}`);
    const button = [...card.querySelectorAll("button")].find((item) => normalise(item.textContent).includes(actionText));
    if (!button) throw new Error(`Could not find ${actionText} on ${colourName}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, { colourName, actionText });
}

async function clickSummaryAction(page, areaName, actionText) {
  await page.evaluate(({ areaName, actionText }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const table = document.querySelector('[data-testid="cabinetry-area-colour-summary"]');
    if (!table) throw new Error("Could not find cabinetry area summary");
    const row = [...table.querySelectorAll('[role="row"]')].find((item) => normalise(item.textContent).includes(areaName));
    if (!row) throw new Error(`Could not find summary row ${areaName}`);
    const button = [...row.querySelectorAll("button")].find((item) => normalise(item.textContent).includes(actionText));
    if (!button) throw new Error(`Could not find ${actionText} button for ${areaName}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, { areaName, actionText });
}

async function chooseFirstColourCombination(page) {
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="cabinetry-colour-selection-modal"]');
    if (!modal) throw new Error("Colour selection modal is not open");
    const first = modal.querySelector(".cabinetrySelectionRow");
    if (!first) throw new Error("No colour range/finish rows are available");
    first.scrollIntoView({ block: "center", inline: "center" });
    const input = first.querySelector('input[type="checkbox"]');
    (input || first).click();
  });
}

async function assertModalAreaState(page, { checked = [], unchecked = [] }) {
  const result = await page.evaluate(({ checked, unchecked }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const modal = document.querySelector('[data-testid="cabinetry-colour-selection-modal"]');
    if (!modal) return { ok: false, message: "Colour selection modal is not open" };
    const rows = [...modal.querySelectorAll(".cabinetryModalAreaList .cabinetrySelectionRow")].map((row) => ({
      label: normalise(row.querySelector(".cabinetrySelectionMain strong")?.textContent || ""),
      checked: Boolean(row.querySelector('input[type="checkbox"]')?.checked),
    }));
    const missing = checked.filter((name) => !rows.some((row) => row.label === name));
    if (missing.length) return { ok: false, message: `Missing checked rows: ${missing.join(", ")}. Rows: ${rows.map((row) => `${row.label}:${row.checked}`).join(" | ")}` };
    const badChecked = checked.filter((name) => !rows.find((row) => row.label === name)?.checked);
    if (badChecked.length) return { ok: false, message: `Expected checked: ${badChecked.join(", ")}. Rows: ${rows.map((row) => `${row.label}:${row.checked}`).join(" | ")}` };
    const badUnchecked = unchecked.filter((name) => rows.find((row) => row.label === name)?.checked);
    if (badUnchecked.length) return { ok: false, message: `Expected unchecked: ${badUnchecked.join(", ")}. Rows: ${rows.map((row) => `${row.label}:${row.checked}`).join(" | ")}` };
    return { ok: true, message: "ok" };
  }, { checked, unchecked });
  assert.ok(result.ok, result.message);
}

async function setOnlyModalArea(page, areaName) {
  await setModalAreas(page, [areaName]);
}

async function setModalAreas(page, areaNames) {
  await page.evaluate((expected) => {
    const modal = document.querySelector('[data-testid="cabinetry-colour-selection-modal"]');
    if (!modal) throw new Error("Colour selection modal is not open");
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const expectedSet = new Set(expected.map(normalise));
    const rows = [...modal.querySelectorAll(".cabinetryModalAreaList .cabinetrySelectionRow")];
    rows.forEach((row) => {
      const label = normalise(row.querySelector(".cabinetrySelectionMain strong")?.textContent || "");
      const isTarget = expectedSet.has(label);
      const input = row.querySelector('input[type="checkbox"]');
      if (input && input.checked !== isTarget) input.click();
    });
  }, areaNames);
}

async function assertAreaSummary(page, areaName, expectedText) {
  const result = await page.evaluate(({ areaName, expectedText }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const table = document.querySelector('[data-testid="cabinetry-area-colour-summary"]');
    if (!table) return { matched: false, rowText: "summary table missing" };
    const row = [...table.querySelectorAll('[role="row"]')].find((item) => normalise(item.textContent).includes(areaName));
    const rowText = row ? normalise(row.textContent) : "summary row missing";
    return { matched: Boolean(row && rowText.includes(expectedText)), rowText };
  }, { areaName, expectedText });
  assert.ok(result.matched, `Expected ${areaName} summary to include ${expectedText}. Row text: ${result.rowText}`);
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  assert.ok(found, `Expected text: ${text}`);
}
