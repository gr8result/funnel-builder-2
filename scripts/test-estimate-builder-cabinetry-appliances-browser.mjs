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
const outDir = path.join(root, "test-results", "estimate-builder-cabinetry-appliances");
fs.mkdirSync(outDir, { recursive: true });

if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-cabinetry-appliances-${runId}@example.test`;
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
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Cannot access/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });

  await primeBrowserSession(page, auth.session);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    await clickByRequirementKey(page, "interior");
  }
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await screenshot(page, "01-interior-categories.png");

  const interiorCardLabels = await cardLabels(page);
  assert.ok(interiorCardLabels.includes("Kitchen"), "Interior dashboard includes Kitchen");
  assert.ok(interiorCardLabels.includes("Appliances"), "Interior dashboard includes Appliances");
  assert.equal(interiorCardLabels.indexOf("Appliances"), interiorCardLabels.indexOf("Kitchen") + 1, "Appliances appears immediately after Kitchen");
  const applianceImage = await page.evaluate(() => document.querySelector('[data-requirement-key="appliances"] img')?.getAttribute("src") || "");
  assert.equal(applianceImage, "/images/client-selections/appliances-kitchen.jpeg", "Appliances card uses the supplied local kitchen-appliance photo");

  await clickByRequirementKey(page, "kitchen");
  await page.waitForSelector('[data-testid="guided-kitchen-checklist"]');
  await assertText(page, "Cabinetry");
  await assertNoText(page, "Oven");
  await assertNoText(page, "Cooktop");
  await assertNoText(page, "legacy");
  await screenshot(page, "02-kitchen-checklist-before.png");

  await clickByTestId(page, "guided-requirement-cabinetry");
  await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]');
  await assertAttribute(page, '[data-testid="guided-cabinetry-workflow"]', "data-workflow-type", "guided_cabinetry");
  await assertText(page, "1. Locations");
  await assertText(page, "2. Cabinet Schedule");
  await assertText(page, "3. Doors & Panels");
  await assertText(page, "4. Colours & Finishes");
  await assertText(page, "5. Benchtops");
  await assertText(page, "6. Handles");
  await assertText(page, "7. Features");
  await assertText(page, "8. Review & Confirm");
  for (const text of ["Kitchen", "Butler's Pantry", "Bathroom", "Ensuite", "Powder Room", "Other", "Add Location", "Editable custom location name", "Lower base-unit doors", "Island bench back", "End panels", "Overheads", "Kick panels", "Bulkheads"]) {
    await assertText(page, text);
  }
  await clickText(page, "Kitchen");
  await clickText(page, "Butler's Pantry");
  await assertNoRuntimeErrors(runtimeErrors);
  await screenshot(page, "03-cabinetry-locations.png");

  await clickText(page, "Cabinet Schedule");
  for (const text of ["Standard base unit", "Corner unit", "Sink cupboard", "Pull-out bin", "Underbench oven cabinet", "Dishwasher cabinet", "Microwave cabinet", "Rangehood cabinet", "Tall pantry", "Four-bank drawers", "Five-bank drawers", "Two-bank pot drawers", "Three-bank pot drawers: one small and two large", "Hidden drawers", "Quantity", "Notes", "Reset"]) {
    await assertText(page, text);
  }
  await clickText(page, "Add every listed cabinet and drawer type");
  await screenshot(page, "04-cabinetry-cabinet-schedule.png");

  await clickText(page, "Doors & Panels");
  for (const text of ["Standard colourboard", "Two-pack painted", "Shaker/profile door", "Vinyl wrap", "Other/custom", "Apply the same selection to multiple compatible areas", "Override individual areas"]) {
    await assertText(page, text);
  }
  await clickText(page, "Standard colourboard");
  await screenshot(page, "05-cabinetry-doors-panels.png");

  await clickText(page, "Colours & Finishes");
  for (const text of ["Laminex", "Polytec", "Product range", "Official colour", "Surface finish", "Swatch/product image", "Included", "Upgrade", "Premium", "Quote required"]) {
    await assertText(page, text);
  }
  await clickText(page, "Polytec");
  await clickText(page, "Laminex");
  await screenshot(page, "06-cabinetry-colours-finishes.png");

  await clickText(page, "Benchtops");
  for (const text of ["Laminated", "Stone", "20 mm", "40 mm", "Specialty", "Supplier", "Product range", "Official colour", "Finish", "Thickness", "Edge profile", "Benchtop area or dimensions", "Splashback/upstand where applicable", "Product image or swatch"]) {
    await assertText(page, text);
  }
  await clickText(page, "Stone, porcelain or sintered benchtop");
  await screenshot(page, "07-cabinetry-benchtops.png");

  await clickText(page, "Handles");
  for (const text of ["Sharkfin", "Channel pull", "Pull handle", "Handle House", "Handleless", "Product photograph", "Product code", "Finish", "Size", "Quantity", "Official product link", "Pricing or quote-required status"]) {
    await assertText(page, text);
  }
  await screenshot(page, "08-cabinetry-handles.png");

  await clickText(page, "Features");
  for (const text of ["Integrated dishwasher panel", "Integrated fridge panel", "Wine rack", "Cleated shelving", "Floating shelves", "Not required", "Enabled", "Material / colour / finish", "Notes", "Image where available", "Quote Required"]) {
    await assertText(page, text);
  }
  await clickText(page, "Integrated dishwasher panel");
  await clickText(page, "Integrated fridge panel");
  await clickText(page, "Wine rack");
  await clickText(page, "Cleated shelving");
  await clickText(page, "Floating shelves");
  await screenshot(page, "09-cabinetry-features.png");

  await clickText(page, "Review & Confirm");
  for (const text of ["Cabinet areas", "Cabinet schedule and quantities", "Drawer schedule and quantities", "Door and panel material", "Supplier", "Product range", "Colour", "Finish", "Benchtop", "Handles", "Integrated panels", "Wine racks", "Shelving", "Images/swatches", "Allowance", "$2,500", "Selected price", "Variation", "Outstanding decisions", "Previous", "Save Draft", "Confirm Cabinetry Selection"]) {
    await assertText(page, text);
  }
  await screenshot(page, "10-cabinetry-review-confirm.png");
  await clickText(page, "Save Draft");
  await page.waitForSelector('[data-testid="guided-kitchen-checklist"]');
  await assertText(page, "locations configured");
  await assertText(page, "$2,500");
  await assertNoText(page, "legacy");
  await screenshot(page, "11-kitchen-summary-updated.png");
  const cachedScheduleLength = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => key.includes("selections") || key.includes("Selections")).sort();
    let best = 0;
    for (const key of keys) {
      try {
        const payload = JSON.parse(localStorage.getItem(key) || "null");
        const rooms = payload?.book?.rooms || payload?.rooms || [];
        const kitchen = rooms.find((room) => String(room.name || "").toLowerCase() === "kitchen");
        const cabinetry = (kitchen?.rows || []).find((row) => row.guidedSelection?.cabinetrySelection);
        best = Math.max(best, cabinetry?.guidedSelection?.cabinetrySelection?.schedule?.length || 0);
      } catch {}
    }
    return best;
  });
  assert.ok(cachedScheduleLength >= 14, `cached cabinetry draft keeps every listed schedule type, got ${cachedScheduleLength}`);

  await clickByTestId(page, "guided-requirement-cabinetry");
  await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]');
  await clickText(page, "Cabinet Schedule");
  for (const text of ["Corner unit", "Hidden drawers", "Butler's Pantry"]) await assertText(page, text);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForAnySelector(page, ['[data-testid="guided-cabinetry-workflow"]', '[data-testid="guided-kitchen-checklist"]', '[data-testid="guided-interior-categories"]', '[data-testid="guided-client-selections-home"]']);
  if (!(await hasSelector(page, '[data-testid="guided-cabinetry-workflow"]'))) {
    if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) await clickByRequirementKey(page, "interior");
    if (await hasSelector(page, '[data-testid="guided-interior-categories"]')) await clickByRequirementKey(page, "kitchen");
    await page.waitForSelector('[data-testid="guided-kitchen-checklist"]');
    await clickByTestId(page, "guided-requirement-cabinetry");
    await page.waitForSelector('[data-testid="guided-cabinetry-workflow"]');
  }
  await clickText(page, "Review & Confirm");
  await assertText(page, "Butler's Pantry");
  await assertText(page, "Hidden drawers");
  await assertText(page, "$2,500");
  await assertNoRuntimeErrors(runtimeErrors);

  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForAnySelector(page, ['[data-testid="guided-client-selections-home"]', '[data-testid="guided-interior-categories"]']);
  if (await hasSelector(page, '[data-testid="guided-client-selections-home"]')) {
    await clickByRequirementKey(page, "interior");
  }
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await clickByRequirementKey(page, "appliances");
  await page.waitForSelector('[data-testid="guided-appliances-checklist"]');
  await assertText(page, "Oven");
  await assertText(page, "Cooktop");
  await assertText(page, "Rangehood");
  await assertText(page, "Dishwasher");
  await assertText(page, "Microwave");
  const applianceRows = await requirementLabels(page);
  assert.deepEqual(applianceRows, ["Oven", "Cooktop", "Rangehood", "Dishwasher", "Microwave"], "Appliances checklist owns only appliance rows");
  await screenshot(page, "04-appliances-checklist.png");

  await clickByTestId(page, "guided-requirement-oven");
  await page.waitForSelector('[data-testid="guided-product-page"]');
  const productHeader = await page.evaluate(() => document.querySelector(".guidedSectionHeader")?.innerText || document.body.innerText);
  assert.match(productHeader, /Appliances\s*\/\s*Oven|No products have been added for Oven/i, "Oven opens from Appliances into a product-selection screen");
  await assertNoRuntimeErrors(runtimeErrors);
  await screenshot(page, "05-appliances-oven-product.png");

  console.log(`Estimate Builder Cabinetry/Appliances browser test passed. Screenshots saved to ${outDir}`);
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
    full_name: "Codex Cabinetry Appliances Tester",
    business_name: "Cabinetry Appliances Verification",
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

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function cardLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll(".guidedImageCard span")].map((element) => element.textContent.trim()).filter(Boolean));
}

async function requirementLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll(".guidedRequirementRow strong")].map((element) => element.textContent.trim()).filter(Boolean));
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

async function clickByTestId(page, testId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-testid="${id}"] button`) || document.querySelector(`[data-testid="${id}"]`);
    if (!target) throw new Error(`Could not find test id ${id}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, testId);
}

async function clickByRequirementKey(page, key) {
  await page.evaluate((requirementKey) => {
    const target = document.querySelector(`[data-requirement-key="${requirementKey}"]`);
    if (!target) throw new Error(`Could not find requirement key ${requirementKey}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, key);
}

async function waitForAnySelector(page, selectors) {
  try {
    await page.waitForFunction((items) => items.some((selector) => document.querySelector(selector)), { timeout: 120000 }, selectors);
  } catch (error) {
    const state = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 2000) }));
    throw new Error(`Timed out waiting for selectors ${selectors.join(", ")}. URL=${state.url}. Body starts: ${state.body}`);
  }
}

async function hasSelector(page, selector) {
  return Boolean(await page.$(selector));
}

async function assertText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (!found) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 1500));
    throw new Error(`Expected page text: ${text}. Body starts: ${body}`);
  }
}

async function assertAttribute(page, selector, name, expected) {
  const actual = await page.evaluate(({ selector, name }) => document.querySelector(selector)?.getAttribute(name) || "", { selector, name });
  assert.equal(actual, expected, `${selector} has ${name}=${expected}`);
}

async function assertNoText(page, text) {
  const found = await page.evaluate((expected) => document.body.innerText.includes(expected), text);
  if (found) throw new Error(`Unexpected page text: ${text}`);
}

async function assertNoRuntimeErrors(runtimeErrors) {
  if (runtimeErrors.length) throw new Error(`Runtime errors:\n${runtimeErrors.join("\n")}`);
}
