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

const baseUrl = process.env.EXTERIOR_COLOURS_VERIFY_BASE_URL || "http://localhost:3000";
const projectId = "c4404954-6310-4aaa-bf47-3a988330274f";
const jobNumber = "05/07";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const outDir = path.join(root, "test-results", "estimate-builder-exterior-colours");
fs.mkdirSync(outDir, { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-exterior-colours-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const user = await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("dialog", async (dialog) => dialog.accept());
  page.on("pageerror", (error) => fs.appendFileSync(path.join(outDir, "console.log"), `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(path.join(outDir, "console.log"), `${message.type()} ${message.text()}\n`);
  });

  logStep("Open embedded Client Selections route");
  await primeBrowserSession(page, auth.session);
  await goto(page, `${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Client Selections");
  logStep("Open exact saved demo job");
  await openExactJob(page);
  logStep("Open Exterior Colours workflow");
  await ensureExteriorColourWorkflow(page);
  await page.waitForSelector('[data-testid="guided-exterior-colour-workflow"]');
  await page.waitForSelector('[data-testid="exterior-colour-area-schedule"]');
  await screenshot(page, "01-exterior-colour-area-schedule.png");

  const initialText = await bodyText(page);
  assert.match(initialText, /Exterior Colours/);
  assert.match(initialText, /Exterior Colour Schedule/i);
  assert.match(initialText, /Status: In Progress|Status: Confirmed/i);
  assert.match(initialText, /LINKED TO ROOFING/i);
  assert.match(initialText, /Apply one colour to several areas/i);
  assert.match(initialText, /Tick the areas/i);
  assert.match(initialText, /Select areas/i);
  assert.doesNotMatch(initialText, /Dulux Weathershield Low Sheen\s+Dulux Weathershield Semi Gloss/i);

  logStep("Apply and override exterior colours");
  await selectOption(page, 'select[aria-label="Apply colour scheme"]', "light-contemporary");
  await waitForBodyText(page, "Lexicon Quarter");
  await clickArea(page, "Main rendered walls");
  await clickSwatch(page, "Dieskau");
  await clickButtonContaining(page, "Apply to this area");
  await clickButtonContaining(page, "Apply Colour");
  await clickArea(page, "Secondary/accent rendered walls");
  await clickSwatch(page, "Colorbond Monument");
  await clickButtonContaining(page, "Apply to this area");
  await clickButtonContaining(page, "Apply Colour");
  await clickArea(page, "Eaves/soffits");
  await toggleAreaForApply(page, "Window surrounds");
  await waitForBodyText(page, "1 area selected");
  await clickSwatch(page, "Lexicon Quarter");
  await waitForBodyText(page, "Selected colour: Lexicon Quarter");
  await waitForBodyText(page, "Apply Lexicon Quarter to 1 selected area");
  await clickButtonContaining(page, "Apply to selected areas");
  await clickButtonContaining(page, "Apply Colour");
  await clickArea(page, "Timber posts");
  await clickSwatch(page, "Natural stain");
  await clickButtonContaining(page, "Apply to this area");
  await clickButtonContaining(page, "Apply Colour");
  if ((await bodyText(page)).includes("Custom exterior area 2")) {
    await clickArea(page, "Custom exterior area 2");
    await clickButtonContaining(page, "Mark Not Painted");
  }
  await clickArea(page, "Main rendered walls");
  await page.click('[data-testid="exterior-colour-technical-spec"] summary');
  await waitForBodyText(page, "Dulux Weathershield Low Sheen");
  await screenshot(page, "02-exterior-colour-selector.png");

  const selectedText = await bodyText(page);
  assert.match(selectedText, /Dieskau/);
  assert.match(selectedText, /Colorbond Monument/);
  assert.match(selectedText, /Lexicon Quarter/);
  assert.match(selectedText, /Natural stain/);
  assert.match(selectedText, /Dulux Weathershield Low Sheen or builder-approved equivalent|Low Sheen/i);

  logStep("Save, refresh, and reopen saved exterior schedule");
  await clickButtonContaining(page, "Save Progress");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForBodyText(page, "Client Selections");
  await ensureExteriorColourWorkflow(page);
  await waitForBodyPatternOrDump(page, /Exterior Colour Schedule/i, "post-refresh-exterior-colours", 30000);
  await waitForBodyTextOrDump(page, "Lexicon Quarter", "post-refresh-saved-colours", 30000);
  await screenshot(page, "03-exterior-colour-after-refresh.png");

  logStep("Confirm schedule and verify persisted project-scoped state");
  await clickButtonContaining(page, "Confirm Exterior Colour Schedule");
  await waitForBodyText(page, "Choose a selection category.");
  await screenshot(page, "04-exterior-colour-confirmed-dashboard.png");

  const persisted = await persistedExteriorColourState();
  assert.ok(persisted.bookId, "Selection book should be persisted.");
  assert.equal(persisted.summary.incompleteAreas, 0);
  assert.ok(persisted.areas.length >= 10, "Persisted schedule should include applicable exterior areas.");
  assert.ok(persisted.painterTradeSchedule.some((row) => /Low Sheen|Semi Gloss/i.test(`${row.technicalPaintProduct} ${row.sheen}`)), "Painter schedule must retain technical paint system.");

  fs.writeFileSync(path.join(outDir, "exterior-colours-browser-result.json"), JSON.stringify({ projectId, jobNumber, workspaceId, userId: user.id, persisted }, null, 2));
  console.log("Exterior Colours embedded browser workflow passed.", { projectId, jobNumber, bookId: persisted.bookId, summary: persisted.summary, outDir });
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", { user_id: data.user.id, email, full_name: "Codex Exterior Colours Tester", business_name: "Exterior Colours Regression", approved: true, is_approved: true, status: "approved", subscription_status: "active", onboarding_completed: true, phone_verified: true, email_verified: true }, "user_id");
  const { error: memberError } = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner", status: "active" });
  if (memberError) throw memberError;
  return data.user;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return data;
    const missing = `${error?.message || ""} ${error?.details || ""}`.match(/'([^']+)' column|column "([^"]+)"/i);
    const key = missing?.[1] || missing?.[2] || "";
    if (!key || !(key in next)) throw error;
    delete next[key];
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
  await goto(page, `${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
    localStorage.removeItem("builder-active-workspace-project");
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function openExactJob(page) {
  const header = await bodyText(page);
  if (header.includes(jobNumber) && !/No job open/i.test(header)) return;
  await clickExactButton(page, "File");
  await clickExactButton(page, "Open Platform Job");
  await page.waitForSelector('[aria-label="Open project job"]');
  await typeIntoPlaceholder(page, "Search jobs", jobNumber);
  await waitForBodyText(page, projectId);
  await clickText(page, '[aria-label="Open project job"] button', projectId);
  await page.waitForFunction(() => !document.querySelector('[aria-label="Open project job"]'), { timeout: 120000 });
  await waitForBodyText(page, jobNumber);
}

async function ensureExteriorColourWorkflow(page) {
  await page.waitForFunction((key) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    return Boolean(document.querySelector('[data-testid="guided-exterior-colour-workflow"]'))
      || [...document.querySelectorAll(`[data-requirement-key="${key}"]`)].some(visible)
      || /Choose an area/i.test(document.body.innerText || "");
  }, { timeout: 120000 }, "exterior-paint");
  const alreadyOpen = await page.$('[data-testid="guided-exterior-colour-workflow"]');
  if (alreadyOpen) return;
  const hasExteriorCard = await visibleRequirementCardExists(page, "exterior-paint");
  if (!hasExteriorCard) await clickSelectionArea(page, "Exterior");
  await clickCardByRequirement(page, "exterior-paint");
}

async function visibleRequirementCardExists(page, requirementKey) {
  return page.evaluate((key) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    return [...document.querySelectorAll(`[data-requirement-key="${key}"]`)].some(visible);
  }, requirementKey);
}

async function clickSelectionArea(page, areaName) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.waitForSelector(".guidedAreaGrid button", { visible: true, timeout: 120000 });
    const buttons = await page.$$(".guidedAreaGrid button");
    for (const button of buttons) {
      const text = await button.evaluate((element) => (element.textContent || "").replace(/\s+/g, " ").trim()).catch(() => "");
      if (text === areaName || text.startsWith(`${areaName} `) || /External envelope/i.test(text)) {
        const box = await button.boundingBox().catch(() => null);
        if (!box) break;
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(650);
        return;
      }
    }
    await sleep(500);
  }
  throw new Error(`Could not find selection area ${areaName}`);
}

async function persistedExteriorColourState() {
  const { data, error } = await admin.from("builder_selection_books").select("id, updated_at, book_data").eq("workspace_id", workspaceId).eq("project_id", projectId).is("inclusion_template_id", null).order("updated_at", { ascending: false }).limit(1).single();
  if (error) throw error;
  const rows = data.book_data?.rooms?.flatMap((room) => room.rows || []) || [];
  const row = rows.find((item) => item.guidedRequirementKey === "exterior-paint");
  const schedule = row?.guidedSelection?.exteriorColourSelection || {};
  return { bookId: data.id, updatedAt: data.updated_at, summary: schedule.summary || {}, areas: schedule.areas || [], painterTradeSchedule: row?.guidedSelection?.painterTradeSchedule || schedule.painterTradeSchedule || [] };
}

async function goto(page, url, options = {}) {
  const response = await page.goto(url, options);
  if (!response || response.status() >= 400) throw new Error(`Navigation failed ${response?.status()} ${url}`);
  return response;
}

async function waitForBodyText(page, text, timeout = 120000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function waitForBodyTextOrDump(page, text, name, timeout = 30000) {
  try {
    await waitForBodyText(page, text, timeout);
  } catch (error) {
    fs.writeFileSync(path.join(outDir, `${name}-body.txt`), await bodyText(page));
    await screenshot(page, `${name}.png`);
    throw error;
  }
}

async function waitForBodyPatternOrDump(page, pattern, name, timeout = 30000) {
  try {
    await page.waitForFunction((source, flags) => new RegExp(source, flags).test(document.body.innerText || ""), { timeout }, pattern.source, pattern.flags);
  } catch (error) {
    fs.writeFileSync(path.join(outDir, `${name}-body.txt`), await bodyText(page));
    await screenshot(page, `${name}.png`);
    throw error;
  }
}

async function clickButtonContaining(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const target = [...document.querySelectorAll("button")].find((button) => visible(button) && normalise(button.textContent).includes(expected));
    if (!target) throw new Error(`Could not find button containing ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, text);
  await sleep(650);
}

async function clickExactButton(page, text) {
  await page.evaluate((expected) => {
    const target = [...document.querySelectorAll("button")].find((button) => (button.textContent || "").replace(/\s+/g, " ").trim() === expected);
    if (!target) throw new Error(`Could not find exact button ${expected}`);
    target.click();
  }, text);
  await sleep(650);
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const target = [...document.querySelectorAll(selector)].find((element) => (element.textContent || "").includes(text));
    if (!target) throw new Error(`Could not find ${selector} containing ${text}`);
    target.click();
  }, { selector, text });
  await sleep(650);
}

async function clickCardByRequirement(page, requirementKey) {
  try {
    await page.waitForFunction((key) => {
      const target = document.querySelector(`[data-requirement-key="${key}"]`);
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      const style = window.getComputedStyle(target);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }, { timeout: 30000 }, requirementKey);
  } catch (error) {
    fs.writeFileSync(path.join(outDir, `missing-${requirementKey}-card-body.txt`), await bodyText(page));
    await screenshot(page, `missing-${requirementKey}-card.png`);
    throw error;
  }
  await page.evaluate((key) => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const target = [...document.querySelectorAll(`[data-requirement-key="${key}"]`)].find(visible);
    if (!target) throw new Error(`Could not find requirement card ${key}`);
    target.scrollIntoView({ block: "center", inline: "center" });
  }, requirementKey);
  const card = await page.$(`[data-requirement-key="${requirementKey}"]`);
  await card.click();
  await sleep(650);
}

async function clickArea(page, areaName) {
  await page.evaluate((name) => {
    const target = [...document.querySelectorAll(".exteriorColourAreaRow button")].find((button) => (button.textContent || "").includes(name));
    if (!target) throw new Error(`Could not find area ${name}`);
    target.click();
  }, areaName);
  await sleep(650);
}

async function toggleAreaForApply(page, areaName) {
  await page.evaluate((name) => {
    const row = [...document.querySelectorAll(".exteriorColourAreaRow")].find((element) => (element.textContent || "").includes(name));
    const input = row?.querySelector('input[type="checkbox"]');
    if (!input) throw new Error(`Could not find apply checkbox for ${name}`);
    input.click();
  }, areaName);
  await sleep(400);
}

async function clickSwatch(page, colourName) {
  await page.evaluate((name) => {
    const target = [...document.querySelectorAll(".exteriorColourSwatch")].find((button) => (button.textContent || "").includes(name));
    if (!target) throw new Error(`Could not find colour swatch ${name}`);
    target.click();
  }, colourName);
  await sleep(700);
}

async function selectOption(page, selector, value) {
  await page.select(selector, value);
  await sleep(900);
}

async function typeIntoPlaceholder(page, placeholderText, value) {
  const selector = `input[placeholder*="${placeholderText}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
  await sleep(650);
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

function logStep(message) {
  console.log(`[exterior-colours-browser] ${message}`);
}
