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
const outDir = path.join(root, "test-results", "estimate-builder-bathroom-cabinetry");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(johnsonFile)) throw new Error(`Johnson job file was not found: ${johnsonFile}`);
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-bathroom-cabinetry-${runId}@example.test`;
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
  await openJohnsonLocalFile(page);
  await openBathroomCabinetry(page);

  await assertNoTextIn(page, ".cabinetryWorkflow", ["Lower base-unit doors", "Island bench back", "Overheads", "Kick panels"]);
  await clickRow(page, "Floor-mounted vanity");
  await clickRow(page, "Wall-mounted vanity");
  await clickRow(page, "Tall linen cupboard");
  await clickRow(page, "Mirrored shaving cabinet");
  await clickRow(page, "Bulkhead over tall cupboard");
  await screenshot(page, "01-bathroom-scope.png");

  await clickText(page, "Cabinet Schedule");
  await clickRow(page, "Base unit with 2 doors");
  await clickRow(page, "Three-drawer unit");
  await clickRow(page, "Tall linen cupboard");
  await clickRow(page, "2-door mirrored shaving cabinet");
  await setRowWidth(page, "Base unit with 2 doors", "900");
  await setRowWidth(page, "Three-drawer unit", "1200");
  await screenshot(page, "02-bathroom-schedule.png");

  await clickText(page, "Doors & Panels");
  await assertNoTextIn(page, ".cabinetryWorkflow", ["Lower base-unit doors", "Island bench back", "Overheads", "Kick panels"]);
  for (const label of ["Floor-mounted vanity doors", "Wall-mounted vanity drawer fronts", "Tall linen cupboard doors", "Tall linen cupboard end panels", "Bulkhead over tall linen cupboard"]) {
    await clickRow(page, label);
  }
  await screenshot(page, "03-bathroom-doors-panels.png");

  await clickText(page, "Colours & Finishes");
  await assertText(page, "Floor-mounted vanity doors");
  await assertText(page, "Bulkhead over tall linen cupboard");
  await clickRow(page, "Raw MDF - painted to match walls");
  await assertText(page, "Raw MDF");
  await selectAreaColour(page, "Floor-mounted vanity doors", "Laminex", "Polar White");
  await selectAreaColour(page, "Wall-mounted vanity drawer fronts", "Polytec", "Agave");
  await clickButtonNearText(page, "Tall linen cupboard end panels", "Match tall linen");
  await screenshot(page, "04-bathroom-colours-finishes.png");

  await clickText(page, "Benchtops");
  await clickRow(page, "Stone benchtop");
  await fillFirstVisibleInputAfterLabel(page, "Supplier", "Caesarstone");
  await fillFirstVisibleInputAfterLabel(page, "Colour", "Fresh Concrete");
  await clickRow(page, "Stone with mitred drop front");
  await fillLastVisibleInputAfterLabel(page, "Supplier", "Smartstone");
  await fillLastVisibleInputAfterLabel(page, "Mitred drop front", "Mitred drop front required");
  await screenshot(page, "05-bathroom-benchtops.png");

  await clickText(page, "Handles");
  await clickRow(page, "Finger Pull - Shark Fin");
  await clickRow(page, "Push-to-open");
  await clickRow(page, "Pull handle from Handle House builder range");
  await screenshot(page, "06-bathroom-handles.png");

  await clickText(page, "Review & Confirm");
  await assertText(page, "Bathroom");
  await assertText(page, "Floor-mounted vanity");
  await assertText(page, "Wall-mounted vanity");
  await assertText(page, "Mirrored shaving cabinet");
  await assertText(page, "Mitred drop front");
  await screenshot(page, "07-bathroom-review-summary.png");
  await clickText(page, "Save Draft");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  try {
    await waitForAnySelector(page, ['[data-testid="guided-cabinetry-workflow"]', '[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]', '[data-testid="cabinetry-room-landing"]']);
  } catch (error) {
    await screenshot(page, "08-after-refresh-timeout.png");
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 4000));
    throw new Error(`Client Selections did not remount after refresh. Body text starts:\n${body}\n\n${error.message}`);
  }
  await enterBathroomCabinetryFromCurrentState(page);
  await clickText(page, "Review & Confirm");
  await assertText(page, "Floor-mounted vanity");
  await assertText(page, "Wall-mounted vanity");
  await assertText(page, "Raw MDF");
  await assertText(page, "Mitred drop front");
  await screenshot(page, "08-bathroom-after-refresh.png");

  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
  console.log(`Bathroom cabinetry browser verification passed. Screenshots saved to ${outDir}`);
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Bathroom Cabinetry Tester",
    business_name: "Bathroom Cabinetry Verification",
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
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("#estimate-builder-file-menu-button") && !document.querySelector("#estimate-builder-file-menu-button").disabled, { timeout: 120000 });
  await page.click("#estimate-builder-file-menu-button");
  await page.waitForSelector("#estimate-builder-file-menu");
  await clickText(page, "Open Job File from Computer");
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(johnsonFile);
  await waitForAnyText(page, ["Johnson 07-123", "Local job file opened"], 120000);
}

async function openBathroomCabinetry(page) {
  await clickRequirementCard(page, "interior");
  await waitForAnyText(page, ["Cabinetry", "Appliances"], 120000);
  await clickRequirementCard(page, "cabinetry");
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]', { timeout: 120000 });
  await clickByTestId(page, "cabinetry-room-bathroom");
  await page.waitForSelector('[data-testid="cabinetry-location-stage"]', { timeout: 120000 });
  await assertText(page, "Bathroom Cabinetry Specification");
}

async function enterBathroomCabinetryFromCurrentState(page) {
  if (await hasSelector(page, '[data-testid="cabinetry-review-confirm"]')) return;
  if (await hasSelector(page, '[data-testid="cabinetry-room-landing"]')) {
    await clickByTestId(page, "cabinetry-room-bathroom");
    return;
  }
  if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) {
    try {
      await clickRequirementCard(page, "cabinetry");
    } catch {
      await clickText(page, "Cabinetry");
    }
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
    await clickByTestId(page, "cabinetry-room-bathroom");
    return;
  }
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    try {
      await clickRequirementCard(page, "interior");
    } catch {
      await clickText(page, "Interior");
    }
    if (!(await hasSelector(page, '[data-testid="guided-interior-categories"]'))) await clickText(page, "Interior");
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
    try {
      await clickRequirementCard(page, "cabinetry");
    } catch {
      await clickText(page, "Cabinetry");
    }
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
    await clickByTestId(page, "cabinetry-room-bathroom");
    return;
  }
  if (!(await hasSelector(page, '[data-testid="guided-cabinetry-workflow"]'))) await openBathroomCabinetry(page);
}

async function selectAreaColour(page, areaLabel, supplier, colourName) {
  await clickButtonNearText(page, areaLabel, "Select");
  await clickText(page, supplier);
  await page.waitForFunction((name) => [...document.querySelectorAll(".cabinetryColourCard")].some((card) => card.textContent.includes(name)), { timeout: 120000 }, colourName);
  await clickCardAction(page, colourName, "Select Colour");
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await clickText(page, "Apply Colour");
  await assertText(page, colourName);
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

async function clickByTestId(page, testId) {
  await page.waitForSelector(`[data-testid="${testId}"]`);
  await page.click(`[data-testid="${testId}"]`);
  await sleep(700);
}

async function clickRow(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const row = [...document.querySelectorAll(".cabinetrySelectionRow")].find((element) => normalise(element.textContent).includes(expected));
    if (!row) throw new Error(`Could not find row: ${expected}`);
    row.scrollIntoView({ block: "center", inline: "center" });
    row.click();
  }, text);
  await sleep(500);
}

async function clickText(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const element = [...document.querySelectorAll("button, a, [role='button']")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!element) throw new Error(`Could not find clickable text: ${expected}`);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  }, text);
  await sleep(700);
}

async function clickButtonNearText(page, rowText, buttonText = "") {
  await page.evaluate(({ rowText, buttonText }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const rows = [...document.querySelectorAll('[role="row"]')].filter((element) => normalise(element.textContent).includes(rowText));
    const row = rows.find((element) => [...element.querySelectorAll("button")].some((button) => !buttonText || normalise(button.textContent).includes(buttonText)))
      || [...document.querySelectorAll(".cabinetryScheduleGroup, .cabinetrySelectionRow")].find((element) => normalise(element.textContent).includes(rowText));
    if (!row) throw new Error(`Could not find area row: ${rowText}`);
    const buttons = [...row.querySelectorAll("button")];
    const button = buttonText ? buttons.find((item) => normalise(item.textContent).includes(buttonText)) : buttons[0];
    if (!button) throw new Error(`Could not find button ${buttonText} near ${rowText}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, { rowText, buttonText });
  await sleep(700);
}

async function clickCardAction(page, colourName, action) {
  await page.evaluate(({ colourName, action }) => {
    const card = [...document.querySelectorAll(".cabinetryColourCard")].find((item) => item.textContent.includes(colourName));
    if (!card) throw new Error(`Could not find colour card ${colourName}`);
    const button = [...card.querySelectorAll("button")].find((item) => item.textContent.includes(action));
    if (!button) throw new Error(`Could not find ${action} for ${colourName}`);
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  }, { colourName, action });
  await sleep(800);
}

async function setRowWidth(page, rowText, value) {
  await page.evaluate(({ rowText, value }) => {
    const row = [...document.querySelectorAll(".cabinetrySelectionRow")].find((element) => element.textContent.includes(rowText));
    const input = row?.querySelector(".cabinetrySelectionWidth input");
    if (!input) throw new Error(`No width input for ${rowText}`);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { rowText, value });
}

async function fillFirstVisibleInputAfterLabel(page, label, value) {
  await fillVisibleInputAfterLabel(page, label, value, 0);
}

async function fillLastVisibleInputAfterLabel(page, label, value) {
  await fillVisibleInputAfterLabel(page, label, value, -1);
}

async function fillVisibleInputAfterLabel(page, label, value, index) {
  await page.evaluate(({ label, value, index }) => {
    const labels = [...document.querySelectorAll(".cabinetryCustomFields label")].filter((item) => item.textContent.includes(label) && item.offsetParent);
    const target = index === -1 ? labels.at(-1) : labels[index];
    const input = target?.querySelector("input");
    if (!input) throw new Error(`Could not find visible input for ${label}`);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { label, value, index });
  await sleep(200);
}

async function assertText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 120000 }, text);
}

async function assertNoTextIn(page, selector, values) {
  const body = await page.evaluate((selector) => document.querySelector(selector)?.innerText || "", selector);
  for (const value of values) {
    if (body.includes(value)) throw new Error(`Unexpected text visible: ${value}`);
  }
}

async function waitForAnyText(page, texts, timeout = 120000) {
  await page.waitForFunction((expected) => expected.some((text) => document.body.innerText.includes(text)), { timeout }, texts);
}

async function waitForAnySelector(page, selectors) {
  await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 120000 }, selectors);
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
