// Client Selections V1 real-job PDF acceptance, fully isolated: a protected copy of the real job is
// imported into a local build (CLIENT_SELECTIONS_BASE_URL, never port 3000) under its own job id with a
// stand-in cloud project id. Every Supabase request is answered locally (nothing reaches production),
// the app's own "Generate draft PDF" request is captured, and the PDF is rendered with the server's
// PDF code (render-captured-selections-schedule.mjs). The PDF itself is then inspected.
//   CLIENT_SELECTIONS_BASE_URL=http://localhost:3125 CLIENT_SELECTIONS_JOB_FILE=<job.gr8job> node scripts/accept-client-selections-v1-pdf.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import JSZip from "jszip";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { builderReviewTaskId } from "../lib/builders/selectionVariationPricing.js";

dotenv.config({ path: ".env.local", quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3125";
assert.notEqual(new URL(origin).port, "3000", "the shared port-3000 server is never used");
const source = process.env.CLIENT_SELECTIONS_JOB_FILE;
assert(source && fs.existsSync(source), "CLIENT_SELECTIONS_JOB_FILE must point at a protected job copy");
const out = path.resolve("artifacts", "test-artifacts", "client-selections-v1-pdf");
fs.mkdirSync(out, { recursive: true });
const zip = await JSZip.loadAsync(fs.readFileSync(source));
const original = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
// A stand-in cloud project id (a fresh uuid each run), so the app takes its normal cloud path; every
// Supabase request is still answered locally below.
const cloudId = crypto.randomUUID();
const projectId = cloudId;
const workbook = JSON.parse(JSON.stringify(original));
Object.assign(workbook, { projectId, jobId: projectId, registeredJobId: projectId, commercialProjectId: cloudId });
workbook.registeredJob = { ...workbook.registeredJob, jobId: projectId, jobName: "Protected V1 PDF acceptance" };
workbook.jobFileMeta = { ...workbook.jobFileMeta, projectId, jobName: "Protected V1 PDF acceptance", commercialProjectUuid: cloudId };

// V1 state on the copy: the Kitchen bulkheads removed (builder permitted), priced and confirmed by the
// builder and accepted by the client; every other change keeps its own state.
const cabinetryRow = (workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.cabinetrySelection);
const kitchen = cabinetryRow.guidedSelection.cabinetrySelection.locations.find((room) => room.location === "Kitchen");
const bulkheadLines = cabinetryRow.guidedSelection.cabinetrySelection.schedule.filter((line) => line.location === "Kitchen" && /^bulkhead_/.test(line.cabinetTypeId || ""));
assert(bulkheadLines.length, "the real job includes Kitchen bulkheads as standard");
Object.assign(kitchen, { bulkheadRemovalPermitted: true, bulkheadChoice: { choice: "remove", standardIncluded: true, at: "2026-11-08T10:00:00.000Z" } });
const bulkheadItem = { jobId: projectId, room: "Kitchen", selectionKey: "cabinetry-bulkheads", productId: "bulkheads-remove" };
workbook.clientSelectionsBook.metadata = { ...(workbook.clientSelectionsBook.metadata || {}), selectionPricingReviews: {
  [builderReviewTaskId(bulkheadItem)]: { selectionKey: "cabinetry-bulkhead|bulkheads-remove|remove", quantity: 4.2, unitPrice: 180, priceIncludesGst: false, approvedAt: "2026-11-08T10:05:00.000Z", approvedBy: "builder", approvedAmountIncGst: -831.6, clientDecision: "accepted", clientDecidedAt: "2026-11-08T10:10:00.000Z" },
} };
const fixture = path.join(out, "protected-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: "Protected V1 PDF acceptance", workbook }));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(supabaseUrl, "Supabase URL required for isolated HTTP fixtures");
const user = { id: "66666666-6666-4666-8666-666666666666", email: "isolated@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const session = { user, access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 7200, role: "authenticated", aud: "authenticated" })).toString("base64url")}.isolated`, refresh_token: "isolated", expires_at: Math.floor(Date.now() / 1000) + 7200, expires_in: 7200, token_type: "bearer" };
const report = { source: path.basename(source), steps: {}, errors: [], answeredLocally: 0, productionRequests: [] };
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, protocolTimeout: 240000, defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
page.setDefaultTimeout(180000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clickText = async (text) => {
  await page.waitForFunction((text) => [...document.querySelectorAll("button")].some((b) => !b.disabled && b.textContent.trim() === text), {}, text);
  await page.evaluate((text) => [...document.querySelectorAll("button")].find((b) => !b.disabled && b.textContent.trim() === text).click(), text);
};
let captured = null;
let rowId = 0;
try {
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const respond = (body, status = 200) => request.respond({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" }, body: JSON.stringify(body) });
    if (url.origin === new URL(supabaseUrl).origin) {
      report.answeredLocally += 1;
      // .single() / .maybeSingle() ask PostgREST for one object, not a list.
      const single = /vnd\.pgrst\.object/.test(request.headers().accept || "");
      if (request.method() === "OPTIONS") return respond({});
      if (url.pathname.startsWith("/auth/")) return respond(url.pathname.endsWith("/user") ? user : session);
      if (url.pathname.includes("/accounts")) return respond([{ user_id: user.id, approved: true, is_approved: true, status: "approved", subscription_status: "active", onboarding_completed: true }]);
      if (url.pathname.includes("/builder_commercial_projects")) return respond((single ? (rows) => rows[0] : (rows) => rows)([{ id: cloudId, workspace_id: workbook.workspaceId, project_name: "Protected V1 PDF acceptance", client_name: original.clientName || "Client", site_address: original.siteAddress || "Site", job_number: "V1-PDF" }]));
      if (["POST", "PATCH", "PUT"].includes(request.method())) {
        // Echo the written rows back with ids, as PostgREST does with return=representation.
        let body = [];
        try { body = JSON.parse(request.postData() || "[]"); } catch { body = []; }
        const rows = (Array.isArray(body) ? body : [body]).map((row) => ({ id: row?.id || `00000000-0000-4000-8000-${String(++rowId).padStart(12, "0")}`, ...row }));
        return respond(single ? rows[0] : rows);
      }
      return single ? request.respond({ status: 406, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }) }) : respond([]);
    }
    if (url.origin === new URL(origin).origin && url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/workspaces") return respond({ workspaces: [{ id: workbook.workspaceId, name: "Isolated acceptance", role: "owner" }] });
      if (url.pathname === "/api/builders/selection-foundation") return respond({ workspace_id: workbook.workspaceId, requirementMappings: [], products: [] });
      if (url.pathname === "/api/builders/final-inclusions-schedule/generate") {
        captured = JSON.parse(request.postData() || "{}");
        fs.writeFileSync(path.join(out, "captured-generate-request.json"), JSON.stringify(captured));
        return respond({ ok: true, document: { id: "local", public_url: "", publicUrl: "" }, snapshot: { id: "local" } });
      }
      return respond({ ok: true, products: [], rows: [], data: [] });
    }
    if (url.origin !== new URL(origin).origin && !["GET", "HEAD", "OPTIONS"].includes(request.method())) { report.productionRequests.push(url.href); return request.abort(); }
    return request.continue();
  });
  await page.evaluateOnNewDocument(({ session, supabaseUrl, workspaceId }) => {
    localStorage.setItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { session, supabaseUrl, workspaceId: workbook.workspaceId });
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await (await page.waitForSelector('[data-testid="open-local-job-file-input"]')).uploadFile(fixture);
  for (let n = 0; n < 12; n++) {
    await delay(500);
    await page.evaluate(() => { for (const text of ["Open Job", "Open Job File", "Keep Local"]) [...document.querySelectorAll("button")].find((b) => !b.disabled && b.textContent.trim() === text)?.click(); });
  }
  await delay(5000);
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]') || [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Retry"));
  if (await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Retry"))) await clickText("Retry");
  await clickText("Review Schedule");
  await page.waitForSelector('[data-testid="variation-summary"]');
  report.steps.variationRowsOnScreen = await page.$$eval('[data-testid="variation-row"]', (nodes) => nodes.map((n) => ({ room: n.dataset.room, kind: n.dataset.kind, state: n.dataset.state })));
  await page.$eval('[aria-label="Generate draft inclusions and selections PDF"]', (b) => b.click());
  for (let attempt = 0; attempt < 180 && !captured; attempt++) await delay(1000);
  if (!captured) { const text = await page.$eval("body", (body) => body.innerText); fs.writeFileSync(path.join(out, "screen-text.txt"), text); report.steps.alerts = await page.$$eval('[role="alert"], [role="status"], .error, .success', (nodes) => nodes.map((n) => n.innerText).filter(Boolean).slice(0, 10)); }
  assert(captured, "the app sent its Generate PDF request");
} finally {
  await page.screenshot({ path: path.join(out, "last-screen.png"), fullPage: false }).catch(() => {});
  await browser.close();
  fs.unlinkSync(fixture);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}

// Render with the server's PDF code, then inspect the PDF itself.
const pdfPath = path.join(out, "client-selections-v1-draft.pdf");
const render = spawnSync(process.execPath, ["--import", "./scripts/register-extensionless-loader.mjs", "--import", "./scripts/register-json-loader.mjs", "scripts/render-captured-selections-schedule.mjs", path.join(out, "captured-generate-request.json"), pdfPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(render.status, 0, `PDF render: ${render.stderr.slice(-2000)}`);
report.steps.render = render.stdout.trim().split("\n").pop();
console.log("Rendered", pdfPath, report.steps.render);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
