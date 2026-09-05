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

assertSourceContract();

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("Missing Supabase environment values for authenticated browser regression.");
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-menu-${runId}@example.test`;
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
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "File"));
  await clickButton(page, "File");
  await page.waitForSelector("#estimate-builder-file-menu");

  const result = await page.evaluate(() => {
    const menu = document.querySelector("#estimate-builder-file-menu");
    const summary = document.querySelector('[data-estimate-builder-live-summary="true"]');
    const stickyBar = [...document.querySelectorAll("button")]
      .find((button) => /Save Progress/i.test(button.textContent || ""))
      ?.closest("section, div");
    const requiredLabels = [
      "Create New Job",
      "Open Platform Job",
      "Open Job File from Computer",
      "Create New Job From Master Template",
      "Save As Base Template",
      "Update Master Template",
      "Download Quote Sheet CSV",
    ];
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent.replace(/\s+/g, " ").trim());
    const missingLabels = requiredLabels.filter((label) => !labels.some((text) => text.includes(label)));
    const menuRect = menu.getBoundingClientRect();
    const summaryRect = summary?.getBoundingClientRect?.() || null;
    const stickyRect = stickyBar?.getBoundingClientRect?.() || null;
    const zIndex = Number.parseInt(window.getComputedStyle(menu).zIndex, 10);
    const pointerFailures = [...menu.querySelectorAll('button[role="menuitem"]:not(:disabled)')].map((button) => {
      const rect = button.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + Math.min(24, rect.width / 2), 1), window.innerWidth - 2);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 2);
      const top = document.elementFromPoint(x, y);
      return button.contains(top) ? "" : button.textContent.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
    const overlapsSticky = stickyRect
      ? !(menuRect.right < stickyRect.left || menuRect.left > stickyRect.right || menuRect.bottom < stickyRect.top || menuRect.top > stickyRect.bottom)
      : false;
    const menuCenterTopElement = document.elementFromPoint(
      Math.min(Math.max(menuRect.left + menuRect.width / 2, 1), window.innerWidth - 2),
      Math.min(Math.max(menuRect.top + Math.min(34, menuRect.height / 2), 1), window.innerHeight - 2),
    );
    const menuWinsStacking = menu.contains(menuCenterTopElement);
    const avoidsSummary = summaryRect && summaryRect.width > 80 && summaryRect.left > menuRect.left
      ? menuRect.right <= summaryRect.left + 1
      : true;
    return {
      bodyPortal: menu.parentElement === document.body,
      zIndex,
      missingLabels,
      pointerFailures,
      overlapsSticky,
      menuWinsStacking,
      avoidsSummary,
      rect: { left: menuRect.left, top: menuRect.top, right: menuRect.right, bottom: menuRect.bottom },
    };
  });

  if (!result.bodyPortal) throw new Error("File menu is not mounted in document.body.");
  if (result.zIndex !== 1000) throw new Error(`File menu z-index should be 1000, saw ${result.zIndex}.`);
  if (result.missingLabels.length) throw new Error(`File menu missing labels: ${result.missingLabels.join(", ")}`);
  if (result.pointerFailures.length) throw new Error(`Menu items do not receive pointer events: ${result.pointerFailures.join(", ")}`);
  if (result.overlapsSticky && !result.menuWinsStacking) throw new Error(`File menu is behind the sticky action bar: ${JSON.stringify(result.rect)}`);
  if (!result.avoidsSummary) throw new Error(`File menu sits under the Live Summary rail: ${JSON.stringify(result.rect)}`);

  const openMenuCount = await page.$$eval('[role="menu"]', (menus) => menus.length);
  if (openMenuCount !== 1) throw new Error(`Expected one top-level menu to remain open, saw ${openMenuCount}.`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'));
  if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n")}`);

  console.log("Estimate Builder header menu portal regression passed.");
} finally {
  await browser.close();
}

function assertSourceContract() {
  const requiredSnippets = [
    "const APP_LAYERS = Object.freeze",
    "dropdown: 1000",
    "createPortal(",
    "document.body",
    "function OverlayMenuPortal",
    "RECENT JOBS",
    "Open Job File from Computer",
    "Create New Job From Master Template",
    "Save As Base Template",
    "Update Master Template",
    "recentLocalJobFiles={isAiPlanTakeoffPage ? [] : jobFile.recentJobs}",
    "onOpenRecentLocalJobFile={(id) => jobFile.openRecent(id)}",
    "data-estimate-builder-live-summary",
  ];
  const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
  if (missing.length) throw new Error(`Header menu source contract failed: ${missing.join(", ")}`);
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Menu Tester",
    business_name: "Header Menu Regression",
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
  await page.goto(`${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(({ key, sessionObject, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, workspaceId });
}

async function clickButton(page, text) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const button = [...document.querySelectorAll("button")].find((candidate) => normalise(candidate.textContent).includes(expected));
    if (!button) throw new Error(`Could not find button: ${expected}`);
    button.click();
  }, text);
}
