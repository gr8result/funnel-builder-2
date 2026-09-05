import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const workbookPath = path.join(root, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const source = fs.readFileSync(workbookPath, "utf8");
const baseUrl = process.env.ESTIMATE_BUILDER_MENU_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assertCsvExportsAreDistinct();

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("Missing Supabase environment values for authenticated browser regression.");
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-quote-header-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
await ensureWorkspaceUser();
const auth = await signIn();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 920 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /ReferenceError|is not defined|Cannot read/i.test(text)) errors.push(text);
  });

  await primeBrowserSession(page, auth.session);
  await page.goto(`${baseUrl}/modules/estimate-builder?page=quotation`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="builder-module-banner"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="builder-module-banner-title"]')?.textContent?.trim() === "Quotation Builder");

  const screenshotDir = path.join(root, "test-artifacts", "quotation-builder-header");
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, "quotation-builder-header.png");

  const header = await page.evaluate(() => {
    const title = document.querySelector('[data-testid="builder-module-banner-title"]');
    const banner = document.querySelector('[data-testid="builder-module-banner"]');
    const styles = window.getComputedStyle(title);
    const titleRect = title.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const templateButton = [...document.querySelectorAll("button")].find((button) => button.textContent.trim().includes("Template File"));
    const search = [...document.querySelectorAll("input")].find((input) => input.getAttribute("placeholder") === "Search line item");
    return {
      text: title.textContent.trim(),
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      oneLine: titleRect.height <= 54,
      titleWidth: titleRect.width,
      bannerWidth: bannerRect.width,
      hasTemplateButton: Boolean(templateButton),
      hasSearchInput: Boolean(search),
    };
  });

  if (header.text !== "Quotation Builder") throw new Error(`Wrong title: ${header.text}`);
  if (header.fontSize !== "48px") throw new Error(`Quotation title should be 48px, saw ${header.fontSize}`);
  if (Number(header.fontWeight) !== 600) throw new Error(`Quotation title should be weight 600, saw ${header.fontWeight}`);
  if (!header.oneLine) throw new Error(`Quotation title is not one line: ${JSON.stringify(header)}`);
  if (header.hasTemplateButton) throw new Error("Template File controls are still visible outside the File dropdown.");
  if (!header.hasSearchInput) throw new Error("Quotation search controls are not visible in the stacked header area.");

  await clickButton(page, "File");
  await page.waitForSelector("#estimate-builder-file-menu");
  const menu = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("#estimate-builder-file-menu [role='menuitem']")].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    const sections = [...document.querySelectorAll("#estimate-builder-file-menu div")].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    return { labels, sections };
  });
  for (const label of [
    "Create New Job From Master Template",
    "Save As Base Template",
    "Update Master Template",
    "Export to Selections CSV",
    "Download Quote Sheet CSV",
  ]) {
    if (!menu.labels.some((text) => text.includes(label))) throw new Error(`File menu missing ${label}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n")}`);
  console.log(JSON.stringify({ ok: true, screenshot: path.relative(root, screenshotPath), header }, null, 2));
} finally {
  await browser.close();
}

function assertCsvExportsAreDistinct() {
  const selectionsMatch = source.match(/function quoteSelectionsCsvRows[\s\S]*?function quoteSheetCsvRows/);
  const quoteSheetMatch = source.match(/function quoteSheetCsvRows[\s\S]*?function quoteSheetExportSections/);
  if (!selectionsMatch || !quoteSheetMatch) throw new Error("Could not inspect CSV export functions.");
  const selectionHeaders = [...selectionsMatch[0].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const quoteHeaders = [...quoteSheetMatch[0].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (selectionHeaders.join("|") === quoteHeaders.join("|")) {
    throw new Error("CSV exports appear to use the same header set.");
  }
  for (const field of ["selected_product", "upgrade_downgrade", "selection_status"]) {
    if (!selectionHeaders.includes(field)) throw new Error(`Selections CSV missing ${field}`);
    if (quoteHeaders.includes(field)) throw new Error(`Quote Sheet CSV unexpectedly includes selections-only field ${field}`);
  }
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Quote Header Tester",
    business_name: "Quotation Header Regression",
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

async function primeBrowserSession(page, session) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(({ key, sessionObject, workspaceIdValue }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceIdValue);
  }, { key: `sb-${ref}-auth-token`, sessionObject: session, workspaceIdValue: workspaceId });
}

async function clickButton(page, label) {
  await page.evaluate((buttonLabel) => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === buttonLabel);
    if (!button) throw new Error(`Button not found: ${buttonLabel}`);
    button.click();
  }, label);
}
