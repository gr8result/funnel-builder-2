import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.OPEN_JOB_VERIFY_BASE_URL || "http://localhost:3000";
const projectId = "c4404954-6310-4aaa-bf47-3a988330274f";
const jobNumber = "05/07";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const outDir = path.join(root, "test-results", "estimate-builder-open-job");
fs.mkdirSync(outDir, { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-open-job-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const user = await ensureWorkspaceUser();
const auth = await signIn();
const beforeCounts = await recordCounts();

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  defaultViewport: { width: 1520, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const evidence = { projectId, jobNumber, workspaceId, userId: user.id, beforeCounts, screenshots: {} };

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (error) => fs.appendFileSync(path.join(outDir, "console.log"), `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(path.join(outDir, "console.log"), `${message.type()} ${message.text()}\n`);
  });
  page.on("response", async (response) => {
    if (response.status() < 400) return;
    fs.appendFileSync(path.join(outDir, "network-errors.log"), `${response.status()} ${response.url()}\n`);
  });

  await primeBrowserSession(page, auth.session);
  await goto(page, `${baseUrl}/modules/estimate-builder?page=clientSelections`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Client Selections", 120000);
  evidence.initialHeader = await openHeaderText(page);
  evidence.screenshots.initialClientSelections = await screenshot(page, "01-client-selections-no-job.png");

  await clickText(page, "button", "File");
  await clickText(page, "button", "Open Job");
  await page.waitForSelector('[aria-label="Open project job"]');
  await typeIntoPlaceholder(page, "Search jobs", jobNumber);
  await waitForBodyText(page, projectId, 120000);
  evidence.searchText = await textFor(page, '[aria-label="Open project job"]');
  if (!/TEST JOB 05\/07/i.test(evidence.searchText) || !new RegExp(projectId, "i").test(evidence.searchText)) {
    throw new Error("Open Job search did not show the exact test project.");
  }
  evidence.screenshots.openJobModal = await screenshot(page, "02-open-job-modal-found.png");

  await clickText(page, '[aria-label="Open project job"] button', projectId);
  await page.waitForFunction(() => !document.querySelector('[aria-label="Open project job"]'), { timeout: 120000 });
  await waitForHeaderJob(page);
  evidence.headerAfterOpen = await openHeaderText(page);
  evidence.screenshots.afterOpen = await screenshot(page, "03-after-open-client-selections.png");
  assertHeader(evidence.headerAfterOpen);

  for (const label of ["Job Details", "AI Plan Takeoff", "Project Estimate", "Client Selections", "Quotation Builder", "BOQ", "Supplier & Procurement"]) {
    await clickText(page, "button", label);
    await waitForHeaderJob(page);
    const header = await openHeaderText(page);
    assertHeader(header, label);
    evidence[`headerOn${label.replace(/[^a-z0-9]+/gi, "")}`] = header;
  }

  await page.reload({ waitUntil: "networkidle2", timeout: 120000 });
  await waitForHeaderJob(page);
  evidence.headerAfterRefresh = await openHeaderText(page);
  evidence.screenshots.afterRefresh = await screenshot(page, "04-after-refresh-client-selections.png");
  assertHeader(evidence.headerAfterRefresh, "refresh");

  await waitForBodyText(page, "Current saved file", 120000);
  evidence.clientSelectionsTextAfterRefresh = await bodyText(page);
  if (!/TEST JOB 05 07\.gr8job/i.test(evidence.clientSelectionsTextAfterRefresh)) {
    throw new Error("Current saved file did not remain attached after refresh.");
  }

  evidence.afterCounts = await recordCounts();
  if (evidence.afterCounts.projects !== beforeCounts.projects) throw new Error("Opening the job created a duplicate commercial project.");
  if (evidence.afterCounts.snapshots !== beforeCounts.snapshots) throw new Error("Opening the job created a duplicate estimate snapshot.");
  if (beforeCounts.selectionBooks > 0 && evidence.afterCounts.selectionBooks !== beforeCounts.selectionBooks) {
    throw new Error("Opening the job created a duplicate Client Selections book.");
  }
  if (beforeCounts.selectionBooks === 0 && evidence.afterCounts.selectionBooks !== 1) {
    throw new Error(`Expected one project-scoped Client Selections book after open, saw ${evidence.afterCounts.selectionBooks}.`);
  }

  fs.writeFileSync(path.join(outDir, "open-project-job-result.json"), JSON.stringify(evidence, null, 2));
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
    full_name: "Codex Open Job Tester",
    business_name: "Open Job Regression",
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

async function recordCounts() {
  const [projects, snapshots, selectionBooks] = await Promise.all([
    admin.from("builder_commercial_projects").select("id", { count: "exact", head: true }).eq("id", projectId),
    admin.from("builder_estimate_snapshots").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    admin.from("builder_selection_books").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);
  for (const result of [projects, snapshots, selectionBooks]) {
    if (result.error) throw result.error;
  }
  return { projects: projects.count || 0, snapshots: snapshots.count || 0, selectionBooks: selectionBooks.count || 0 };
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

async function goto(page, url, options = {}) {
  const response = await page.goto(url, options);
  if (!response || response.status() >= 400) throw new Error(`Navigation failed ${response?.status()} ${url}`);
  return response;
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = [...document.querySelectorAll(query)].find((element) => normalise(element.textContent).includes(expected));
    if (!target) throw new Error(`Could not find ${query} containing ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, text });
  await sleep(900);
}

async function typeIntoPlaceholder(page, placeholderText, value) {
  const selector = `input[placeholder*="${placeholderText}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
  await sleep(900);
}

async function waitForHeaderJob(page) {
  await page.waitForFunction((projectId, jobNumber) => {
    const text = document.body.innerText;
    return text.includes(projectId) && text.includes(jobNumber) && /TEST JOB 05\/07/i.test(text) && /2 ASTREET/i.test(text);
  }, { timeout: 120000 }, projectId, jobNumber);
}

async function waitForBodyText(page, text, timeout = 60000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function openHeaderText(page) {
  return bodyText(page);
}

async function textFor(page, selector) {
  return page.$eval(selector, (node) => node.innerText.replace(/\s+/g, " ").trim());
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
}

async function screenshot(page, name) {
  const target = path.join(outDir, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

function assertHeader(text, label = "open") {
  if (!text.includes(projectId)) throw new Error(`Header missing project ID after ${label}: ${text}`);
  if (!text.includes(jobNumber)) throw new Error(`Header missing job number after ${label}: ${text}`);
  if (!/TEST JOB 05\/07/i.test(text)) throw new Error(`Header missing client/job name after ${label}: ${text}`);
  if (!/2 ASTREET/i.test(text)) throw new Error(`Header missing address after ${label}: ${text}`);
  if (!/TEST JOB 05 07\.gr8job/i.test(text)) throw new Error(`Header missing saved workbook file after ${label}: ${text}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
