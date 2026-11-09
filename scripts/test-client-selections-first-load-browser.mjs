import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const out = path.join(root, "artifacts/test-artifacts/client-selections-first-load");
fs.mkdirSync(out, { recursive: true });

const report = { passed: false, checks: [], errors: [], blockedCloudWrites: 0 };
const now = Date.now();
const fixture = (suffix) => {
  const projectId = `local-selections-first-load-${suffix}-${now}`;
  const jobName = `Client Selections first-load ${suffix}`;
  const workbook = {
    ...createEstimateBuilderWorkbookDefaults(),
    templateType: "job",
    page: "clientSelections",
    projectId,
    commercialProjectId: projectId,
    registeredJobId: projectId,
    registeredJob: { jobId: projectId, jobName, jobNumber: `FIRST-${suffix}`, clientName: "Isolated test", siteAddress: "Local test address" },
    jobFileMeta: { projectId, jobName, jobNumber: `FIRST-${suffix}`, clientName: "Isolated test", address: "Local test address", localFileOnly: true },
  };
  for (const key of ["aiPlanTakeoffJob", "takeoffEngine", "takeoffSchedule", "projectEstimateBuilder"]) delete workbook[key];
  const file = path.join(out, `job-${suffix}.json`);
  fs.writeFileSync(file, JSON.stringify({ projectId, jobName, workbook }));
  return { projectId, jobName, file };
};
const jobA = fixture("A");
const jobB = fixture("B");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(supabaseUrl && anonKey && serviceKey, "Supabase test authentication values are required.");
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (linkError) throw linkError;
const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const { data: auth, error: authError } = await authClient.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (authError) throw authError;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  protocolTimeout: 600000,
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !/404|favicon/i.test(message.text())) report.errors.push(message.text().slice(0, 500));
});
page.on("dialog", (dialog) => dialog.accept());
await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
  key: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
  session: auth.session,
});
await page.setRequestInterception(true);
page.on("request", (request) => {
  if (/\/(rest|storage)\/v1\//.test(request.url()) && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    report.blockedCloudWrites += 1;
    void request.abort();
  } else void request.continue();
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForSelections = async (label) => {
  const started = Date.now();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.innerText.trim() === "Review Schedule"), { timeout: 240000 });
  const state = await page.evaluate(() => ({
    failed: document.body.innerText.includes("Client Selections could not be opened."),
    retry: [...document.querySelectorAll("button")].some((button) => button.innerText.trim() === "Retry"),
    title: document.title,
  }));
  assert.equal(state.failed, false, `${label}: module failure panel appeared`);
  assert.equal(state.retry, false, `${label}: Retry was required`);
  report.checks.push({ label, elapsedMs: Date.now() - started, title: state.title });
};
const openFixture = async (job, label) => {
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await input.uploadFile(job.file);
  for (let attempt = 0; attempt < 40; attempt++) {
    await delay(500);
    await page.evaluate(() => {
      const labels = ["Discard Changes", "Open Job", "Keep Local"];
      [...document.querySelectorAll("button")].find((button) => !button.disabled && labels.includes(button.innerText.trim()))?.click();
    });
    const body = await page.evaluate(() => document.body.innerText);
    if (body.includes(job.jobName) && body.includes("Review Schedule")) break;
  }
  await waitForSelections(label);
  assert((await page.evaluate(() => document.body.innerText)).includes(job.jobName), `${label}: wrong job is active`);
};

try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await openFixture(jobA, "cold first open");

  await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "File")?.click());
  await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "Save Job")?.click());
  await page.waitForFunction(() => /Saved at/.test(document.body.innerText), { timeout: 240000 });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await waitForSelections("save and reopen");

  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobA.projectId)}&page=projectDashboard`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobA.projectId)}&page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await waitForSelections("dashboard round-trip");

  await openFixture(jobB, "switch to second job");
  await openFixture(jobA, "switch back to first job");
  await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(jobA.projectId)}&page=clientSelections&repeat=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await waitForSelections("repeated navigation");

  assert.equal(report.errors.length, 0, report.errors.join("\n"));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await page.screenshot({ path: path.join(out, report.passed ? "passed.png" : "failed.png"), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
