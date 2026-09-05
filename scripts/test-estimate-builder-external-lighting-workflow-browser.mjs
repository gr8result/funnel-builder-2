import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.EXTERNAL_LIGHTING_VERIFY_BASE_URL || "http://localhost:3000";
const projectId = "c4404954-6310-4aaa-bf47-3a988330274f";
const jobNumber = "05/07";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const outDir = path.join(root, "test-results", "estimate-builder-external-lighting");
fs.mkdirSync(outDir, { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-lighting-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const user = await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const evidence = { projectId, jobNumber, workspaceId, userId: user.id, screenshots: {} };

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("dialog", async (dialog) => dialog.accept("2"));
  page.on("pageerror", (error) => fs.appendFileSync(path.join(outDir, "console.log"), `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(path.join(outDir, "console.log"), `${message.type()} ${message.text()}\n`);
  });
  page.on("response", async (response) => {
    if (response.status() >= 400) fs.appendFileSync(path.join(outDir, "network-errors.log"), `${response.status()} ${response.url()}\n`);
  });

  await primeBrowserSession(page, auth.session);
  await goto(page, `${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Client Selections", 120000);
  await openExactJob(page);
  evidence.screenshots.afterOpen = await screenshot(page, "01-after-open-client-selections.png");

  await clickButtonContaining(page, "Exterior");
  await clickCardByRequirement(page, "external-lighting");
  await page.waitForSelector('[data-testid="guided-external-lighting-workflow"]');
  await page.waitForSelector('[data-testid="external-lighting-catalogue"]');
  await ensureProductImagesLoaded(page);
  evidence.screenshots.catalogue = await screenshot(page, "02-external-lighting-catalogue.png");

  await searchCurrentCategory(page, "2303181");
  await waitForBodyText(page, "Sentinel 2 Light Wall Bracket", 120000);
  assert.equal(await productCardCount(page), 1, "Searching SKU 2303181 should show exactly one wall light.");
  await clickFirstProductAction(page, "Add to Schedule");
  await page.waitForSelector('[data-testid="external-lighting-add-panel"]');
  await clickWithin(page, '[data-testid="external-lighting-quantity"]', "+");
  await clickButtonContaining(page, "Add Light and Continue Shopping");
  await waitForBodyText(page, "1 products | 2 fittings | 2 locations", 120000);

  await clickButtonContaining(page, "Security & Sensor");
  await searchCurrentCategory(page, "2409230");
  await waitForBodyText(page, "Ledlux Field 20w LED Exterior Flood Light With Sensor", 120000);
  assert.equal(await productCardCount(page), 1, "Searching SKU 2409230 should show exactly one sensor light.");
  await clickFirstProductAction(page, "Add to Schedule");
  await page.waitForSelector('[data-testid="external-lighting-add-panel"]');
  await clickButtonContaining(page, "Add Light and Review Schedule");
  await page.waitForSelector('[data-testid="external-lighting-review-schedule"]');
  await waitForBodyText(page, "2 products / 3 fittings", 120000);
  evidence.screenshots.review = await screenshot(page, "03-two-line-review-schedule.png");

  const reviewState = await scheduleState(page);
  assert.equal(reviewState.lines, 2, "Schedule must keep the wall light and sensor light as separate lines.");
  assert.match(reviewState.text, /Sentinel 2 Light Wall Bracket/i);
  assert.match(reviewState.text, /Ledlux Field 20w LED Exterior Flood Light With Sensor/i);
  assert.match(reviewState.points, /EL01 Front entry, left side/i);
  assert.match(reviewState.points, /EL02 Front entry, right side/i);
  assert.match(reviewState.points, /EL03 Garage exterior/i);

  await clickFirstScheduleQuantity(page, "+");
  await waitForBodyText(page, "2 products / 4 fittings", 120000);
  await clickFirstScheduleQuantity(page, "-");
  await waitForBodyText(page, "2 products / 3 fittings", 120000);
  const editedState = await scheduleState(page);
  assert.equal(editedState.quantities[0], "2", "Editing first line quantity should return to two fittings.");
  assert.equal(editedState.quantities[1], "1", "Editing first line must not change the second line quantity.");

  await clickButtonContaining(page, "Save and Return to Dashboard");
  await waitForBodyText(page, "Choose a selection category.", 120000);
  await clickCardByRequirement(page, "external-lighting");
  await page.waitForSelector('[data-testid="external-lighting-review-schedule"]');
  await waitForBodyText(page, "2 products / 3 fittings", 120000);

  await page.reload({ waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Client Selections", 120000);
  await clickButtonContaining(page, "Exterior");
  await clickCardByRequirement(page, "external-lighting");
  await page.waitForSelector('[data-testid="external-lighting-review-schedule"]');
  await waitForBodyText(page, "2 products / 3 fittings", 120000);
  evidence.screenshots.afterRefresh = await screenshot(page, "04-after-refresh-two-line-schedule.png");

  await clickButtonContaining(page, "Confirm External Lighting");
  await waitForBodyText(page, "Choose a selection category.", 120000);
  const dashboardState = await page.evaluate(() => ({
    text: document.body.innerText,
    cardText: document.querySelector('[data-requirement-key="external-lighting"]')?.textContent?.replace(/\s+/g, " ").trim() || "",
  }));
  assert.match(dashboardState.cardText, /3 fittings selected/i);
  evidence.screenshots.dashboard = await screenshot(page, "05-confirmed-dashboard-card.png");

  evidence.persisted = await persistedLightingState();
  assert.equal(evidence.persisted.lines.length, 2, "Persisted selections book must contain two external lighting lines.");
  assert.equal(evidence.persisted.summary.totalFittings, 3, "Persisted summary must contain three fittings.");
  assert.ok(new Set(evidence.persisted.lines.map((line) => line.lineId)).size === 2, "Persisted line IDs must be stable and unique.");

  fs.writeFileSync(path.join(outDir, "external-lighting-workflow-result.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
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
    full_name: "Codex External Lighting Tester",
    business_name: "External Lighting Regression",
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
  return data.user;
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
  return message.match(/'([^']+)' column|column "([^"]+)"/i)?.[1] || message.match(/'([^']+)' column|column "([^"]+)"/i)?.[2] || "";
}

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await goto(page, `${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
    localStorage.removeItem("builder-active-workspace-project");
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function openExactJob(page) {
  const header = await bodyText(page);
  if (header.includes(projectId) && header.includes(jobNumber)) return;
  await clickExactButton(page, "File");
  await clickExactButton(page, "Open Platform Job");
  try {
    await page.waitForSelector('[aria-label="Open project job"]');
  } catch (error) {
    await screenshot(page, "00-open-job-modal-missing.png");
    throw error;
  }
  await typeIntoPlaceholder(page, "Search jobs", jobNumber);
  await waitForBodyText(page, projectId, 120000);
  await clickText(page, '[aria-label="Open project job"] button', projectId);
  await page.waitForFunction(() => !document.querySelector('[aria-label="Open project job"]'), { timeout: 120000 });
  await waitForBodyText(page, jobNumber, 120000);
  await page.waitForFunction(() => !/No job open/i.test(document.body.innerText), { timeout: 120000 });
}

async function persistedLightingState() {
  const { data, error } = await admin
    .from("builder_selection_books")
    .select("id, updated_at, book_data")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .is("inclusion_template_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const rows = data.book_data?.rooms?.flatMap((room) => room.rows || []) || [];
  const row = rows.find((item) => item.guidedRequirementKey === "external-lighting");
  const lighting = row?.guidedSelection?.externalLightingSelection || row?.externalLightingSelection || {};
  return {
    bookId: data.id,
    updatedAt: data.updated_at,
    summary: lighting.summary || {},
    lines: lighting.lines || lighting.scheduleLines || [],
  };
}

async function goto(page, url, options = {}) {
  const response = await page.goto(url, options);
  if (!response || response.status() >= 400) throw new Error(`Navigation failed ${response?.status()} ${url}`);
  return response;
}

async function waitForBodyText(page, text, timeout = 60000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function clickButtonContaining(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = [...document.querySelectorAll("button")]
      .find((button) => normalise(button.textContent).includes(expected));
    if (!target) throw new Error(`Could not find button containing ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, text);
  await sleep(750);
}

async function clickExactButton(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = [...document.querySelectorAll("button")]
      .find((button) => normalise(button.textContent) === expected);
    if (!target) throw new Error(`Could not find exact button ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, text);
  await sleep(750);
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = [...document.querySelectorAll(query)].find((element) => normalise(element.textContent).includes(expected));
    if (!target) throw new Error(`Could not find ${query} containing ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, text });
  await sleep(750);
}

async function clickWithin(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const root = document.querySelector(selector);
    const target = [...(root?.querySelectorAll("button") || [])].find((button) => normalise(button.textContent).includes(text));
    if (!target) throw new Error(`Could not find ${text} within ${selector}`);
    target.click();
  }, { selector, text });
  await sleep(750);
}

async function clickCardByRequirement(page, requirementKey) {
  await page.evaluate((key) => {
    const target = document.querySelector(`[data-requirement-key="${key}"]`);
    if (!target) throw new Error(`Could not find requirement card ${key}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, requirementKey);
  await sleep(900);
}

async function clickFirstProductAction(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const card = document.querySelector(".lightingProductCard");
    const target = [...(card?.querySelectorAll("button") || [])].find((button) => normalise(button.textContent).includes(expected));
    if (!target) throw new Error(`Could not find product action containing ${expected}`);
    target.click();
  }, text);
  await sleep(750);
}

async function clickFirstScheduleQuantity(page, sign) {
  await page.evaluate((sign) => {
    const line = document.querySelector(".lightingScheduleLine");
    const target = [...(line?.querySelectorAll(".lightingQuantityPanel button") || [])].find((button) => button.textContent?.trim() === sign);
    if (!target) throw new Error(`Could not find first schedule quantity ${sign} button`);
    target.click();
  }, sign);
  await sleep(750);
}

async function typeIntoPlaceholder(page, placeholderText, value) {
  const selector = `input[placeholder*="${placeholderText}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
  await sleep(900);
}

async function searchCurrentCategory(page, term) {
  await page.click(".lightingFilters input");
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type(term);
  await sleep(750);
}

async function ensureProductImagesLoaded(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".lightingProductCard img")].slice(0, 3).every((image) => image.complete && image.naturalWidth > 0));
}

async function productCardCount(page) {
  return page.evaluate(() => document.querySelectorAll(".lightingProductCard").length);
}

async function scheduleState(page) {
  return page.evaluate(() => ({
    text: document.body.innerText,
    lines: document.querySelectorAll(".lightingScheduleLine").length,
    points: [...document.querySelectorAll(".lightingScheduleLine small")].map((node) => node.textContent || "").join(" "),
    quantities: [...document.querySelectorAll(".lightingScheduleLine .lightingQuantityPanel input")].map((input) => input.value),
  }));
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
}

async function screenshot(page, name) {
  const target = path.join(outDir, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
