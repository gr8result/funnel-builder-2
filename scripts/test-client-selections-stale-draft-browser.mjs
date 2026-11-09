// Regression (2026-11-04): a browser draft of an OLDER saved revision, re-stamped with a newer time,
// must not replace the job's Client Selections after a job file is opened. In Chrome the draft held the
// 2 November book (obsolete O.Novo x5 under Shower Rail / Rose); opening the corrected job file would
// have shown that draft instead (155 schedule entries, 3 O.Novo conflicts).
//
// Isolated server only (refuses port 3000). Every Supabase write and /api write is answered locally.
//   CLIENT_SELECTIONS_BASE_URL=http://localhost:3121 node scripts/test-client-selections-stale-draft-browser.mjs \
//     --job=<corrected or merged .gr8job> --stale-job=<job whose book is the stale draft> [--expect-entries=154]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const arg = (name, fallback = "") => process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || fallback;
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3121";
if (new URL(origin).port === "3000") { console.error("Refusing to run against the shared port 3000 server."); process.exit(2); }
const jobFile = path.resolve(arg("job"));
const staleJobFile = path.resolve(arg("stale-job"));
const expectEntries = Number(arg("expect-entries", "154"));
assert(fs.existsSync(jobFile), "Pass --job=<corrected .gr8job>.");
assert(fs.existsSync(staleJobFile), "Pass --stale-job=<.gr8job holding the stale book>.");
const out = path.join(root, "artifacts", "test-results", "client-selections-stale-draft");
fs.mkdirSync(out, { recursive: true });

// The stale book exactly as Chrome kept it: the job's Client Selections book, written as a legacy draft.
const staleBook = JSON.parse(execFileSync("unzip", ["-p", staleJobFile, "client-selections.json"], { maxBuffer: 1 << 30 }).toString("utf8")).book;
const jobBook = JSON.parse(execFileSync("unzip", ["-p", jobFile, "client-selections.json"], { maxBuffer: 1 << 30 }).toString("utf8")).book;
assert.notEqual(staleBook.metadata?.selectionRevision, jobBook.metadata?.selectionRevision, "the stale draft must be a different saved revision");
const jobId = jobBook.metadata?.projectId || "recovered-03-09-123";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(supabaseUrl && anonKey && serviceKey, "Existing test authentication requires Supabase environment values.");
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }).auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (authError) throw authError;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, protocolTimeout: 900000, defaultViewport: { width: 1600, height: 1000 },
});
const report = { jobFile, staleJobFile, origin, steps: [], blockedWrites: 0, runtimeErrors: [], console: [] };
const page = await browser.newPage();
page.setDefaultTimeout(300000);
page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
page.on("console", (message) => { const text = message.text(); if (/book sources not used|superseded|stale client selections/i.test(text)) report.console.push(text.slice(0, 400)); });
page.on("dialog", (dialog) => dialog.accept());
await page.setRequestInterception(true);
page.on("request", (request) => {
  const write = !["GET", "HEAD", "OPTIONS"].includes(request.method());
  const target = new URL(request.url());
  if (write && (/\/(rest|storage)\/v1\//.test(target.pathname) || target.pathname.startsWith("/api/"))) {
    report.blockedWrites += 1;
    void request.respond({ status: 200, contentType: "application/json", body: "{}" });
    return;
  }
  void request.continue();
});
await page.evaluateOnNewDocument(({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)); }, {
  key: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, session: auth.session,
});
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clickButton = (label) => page.evaluate((text) => {
  const button = [...document.querySelectorAll("button")].find((candidate) => !candidate.disabled && candidate.offsetParent && candidate.innerText.trim() === text);
  button?.click();
  return Boolean(button);
}, label);

async function reviewSchedule(label) {
  // A reload may return to the schedule view itself rather than the Client Selections home.
  try {
    await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"]') || document.querySelector('[data-testid="schedule-reconciliation"]'), { timeout: 600000 });
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${label}-failed.png`) });
    report.failedAt = { label, url: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 1500) };
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
    throw error;
  }
  if (!(await page.$('[data-testid="schedule-reconciliation"]'))) assert(await clickButton("Review Schedule"), "Review Schedule button is available.");
  await page.waitForFunction(() => document.querySelector('[data-testid="schedule-reconciliation"]')?.textContent?.includes("saved selection records represented"), { timeout: 300000 });
  const state = await page.evaluate(() => {
    const strong = document.querySelector('[data-testid="schedule-reconciliation"] strong');
    const group = (key) => Number(document.querySelector(`[data-testid="attention-group"][data-group="${key}"] .sap-groupMeta b`)?.textContent || 0);
    return {
      entries: Number(strong?.dataset.scheduleSourceEntries), represented: Number(strong?.dataset.scheduleRepresentedRecords), eligible: Number(strong?.dataset.scheduleEligibleRecords),
      duplicates: group("duplicates"), decisions: group("decisions"),
      readiness: document.querySelector('[data-testid="attention-readiness"]')?.textContent || "",
      novoConflicts: [...document.querySelectorAll('[data-testid="attention-group"][data-group="duplicates"] [data-testid="attention-item"]')].filter((item) => /O\.Novo/i.test(item.textContent)).length,
      pageText: /O\.Novo Style Shower\/Bath Mixer ×5/.test(document.body.innerText),
    };
  });
  await page.screenshot({ path: path.join(out, `${label}.png`), fullPage: false });
  report.steps.push({ label, ...state });
  return state;
}

// 1. A job page in this isolated profile, with the stale draft written exactly as Chrome had it
//    (legacy payload: no draftOf, savedAt = now, i.e. newer than the job file).
await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 600000 });
const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 600000 });
const workspaceId = await page.evaluate(() => localStorage.getItem("active_workspace_id") || "");
assert(workspaceId, "an active workspace is selected");
const draftKey = `gr8:embedded-selections-book:${workspaceId}:${jobId}`;
await page.evaluate(({ draftKey, latestKey, workspaceId, jobId, book }) => {
  const savedAt = new Date().toISOString();
  localStorage.setItem(draftKey, JSON.stringify({ workspaceId, projectId: jobId, savedAt, book }));
  localStorage.setItem(latestKey, JSON.stringify({ workspaceId, projectId: jobId, savedAt, storageKey: draftKey }));
}, { draftKey, latestKey: `gr8:embedded-selections-book:${workspaceId}:latest`, workspaceId, jobId, book: staleBook });

// 2. Open the corrected job file.
await input.uploadFile(jobFile);
for (let attempt = 0; attempt < 80; attempt += 1) {
  await delay(750);
  for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) await clickButton(label);
  if (await page.$('[data-testid="guided-client-selections-home"]')) break;
}
const opened = await reviewSchedule("after-open");
assert.equal(opened.entries, expectEntries, `schedule entries after opening the job file (stale draft present): ${opened.entries}`);
assert.equal(opened.novoConflicts, 0, "no O.Novo cross-category conflict");
assert.equal(opened.duplicates, 0, "no duplicate / conflicting selections");
assert.equal(opened.represented, opened.eligible, "every saved selection record is represented");
assert.equal(opened.pageText, false, "the obsolete O.Novo x5 row is not on screen");
const superseded = await page.evaluate((key) => { try { const value = JSON.parse(localStorage.getItem(`${key}:superseded`) || "null"); return value ? { draftOf: value.draftOf, jobRevision: value.jobRevision } : null; } catch { return null; } }, draftKey);
assert(superseded, "the stale draft is kept in the superseded slot, not silently dropped");
report.superseded = superseded;
console.log("PASS opening the job file with a stale, re-stamped draft shows the job's selections", JSON.stringify(opened));

// 3. Reload: the job saved in this browser reopens with the same selections.
await page.reload({ waitUntil: "domcontentloaded", timeout: 600000 });
for (let attempt = 0; attempt < 80; attempt += 1) {
  await delay(750);
  for (const label of ["Discard Changes", "Keep Local"]) await clickButton(label);
  if (await page.$('[data-testid="guided-client-selections-home"]') || await page.$('[data-testid="schedule-reconciliation"]')) break;
}
report.reloadUrl = page.url();
const reloaded = await reviewSchedule("after-reload");
assert.equal(reloaded.entries, expectEntries, "schedule entries after reload");
assert.equal(reloaded.duplicates, 0, "no duplicates after reload");
console.log("PASS reload keeps the corrected selections", JSON.stringify(reloaded));

assert.deepEqual(report.runtimeErrors, [], "no runtime errors");
report.passed = true;
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`Stale draft browser regression: PASS (${report.blockedWrites} writes answered locally). Report: ${path.join(out, "report.json")}`);
await browser.close();
