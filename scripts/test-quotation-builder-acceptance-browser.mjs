// Signed-in Quotation Builder V1 browser acceptance, against an ISOLATED stack only.
//
// Needs: a local Supabase stack (QB_SUPABASE_URL on localhost, QB_ANON_KEY, QB_SERVICE_ROLE_KEY)
// and the app on a non-3000 port (QB_ACCEPT_URL) pointed at that stack. The isolated database
// must have an `accounts` table (legacy base schema; see docs/quotation-builder-v1-release.md).
// Creates its own disposable users/workspaces (@example.test). Every browser request to port
// 3000 or *.supabase.co is blocked.
//
// Covers: real sign-in for three users in parallel browser contexts, create job, Quote Sheet
// totals with GST, save + full reload/reopen, issue (commercial sync) with server-side
// missing-price check, same-workspace estimator sees the issued project, other builder does
// not, and the Premier Inclusions PDF download.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`${k} is required. Refusing to run.`); process.exit(2); } return v; };
const origin = need("QB_ACCEPT_URL");
const supabaseUrl = need("QB_SUPABASE_URL");
const anonKey = need("QB_ANON_KEY");
const serviceKey = need("QB_SERVICE_ROLE_KEY");
if (["3000", ""].includes(new URL(origin).port)) { console.error("QB_ACCEPT_URL must use an explicit non-3000 port."); process.exit(2); }
for (const u of [origin, supabaseUrl]) if (!["127.0.0.1", "localhost"].includes(new URL(u).hostname)) { console.error(`${u} is not local. Refusing.`); process.exit(2); }
void anonKey;

const run = `ui${Date.now().toString(36)}`;
const report = { startedAt: new Date().toISOString(), origin, supabaseUrl, run, steps: [], pageErrors: [] };
let failures = 0;
async function step(name, fn) {
  try { const detail = await fn(); report.steps.push({ name, result: "PASS", detail }); console.log("PASS", name, detail ? JSON.stringify(detail).slice(0, 200) : ""); return detail; }
  catch (error) {
    failures += 1;
    let screen = null;
    if (activePage) {
      const shot = `artifacts/test-artifacts/quotation-acceptance/browser-${run}-step${report.steps.length + 1}.png`;
      await activePage.screenshot({ path: shot }).catch(() => {});
      const buttons = await activePage.$$eval("button", (b) => b.filter((x) => x.getClientRects().length > 0).map((x) => x.innerText.trim().slice(0, 40)).filter(Boolean)).catch(() => []);
      screen = { url: activePage.url(), shot, buttons };
    }
    report.steps.push({ name, result: "FAIL", error: error.message, screen });
    console.log("FAIL", name, "-", error.message, screen ? `| at ${screen.url} | buttons: ${screen.buttons.join(" | ").slice(0, 600)}` : "");
    return undefined;
  }
}
let activePage = null;
const admin = (p, init = {}) => fetch(`${supabaseUrl}${p}`, { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } })
  .then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(b)}`); return b; });

async function makeUser(label) {
  const email = `qb-${label}-${run}@example.test`, password = `Qb-${run}-${label}-Pw!9`;
  const u = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
  const id = u.id || u.user?.id;
  // Upsert: a signup trigger may already have created the row.
  await admin("/rest/v1/accounts?on_conflict=user_id", { method: "POST", headers: { Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify({ user_id: id, email, full_name: label, business_name: `Acceptance ${label}`, approved: true, is_approved: true, status: "active", subscription_status: "active", onboarding_completed: true, phone_verified: true, email_verified: true }) });
  return { id, email, password, label };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
async function contextPage() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1500, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (r) => { const u = new URL(r.url()); if (u.port === "3000" || /supabase\.co$/.test(u.hostname)) return r.abort("blockedbyclient"); return r.continue(); });
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") (report.consoleErrors ||= []).push(m.text().slice(0, 500)); });
  return { ctx, page };
}
async function signIn(page, user) {
  await page.goto(`${origin}/login`, { waitUntil: "networkidle2" });
  await page.type('input[type="email"]', user.email);
  await page.type('input[type="password"]', user.password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click('button[type="submit"]')]);
  await page.waitForFunction(() => !location.pathname.startsWith("/login"));
}
const text = (page) => page.evaluate(() => document.body.innerText);
async function clickButton(page, label) {
  const handle = await page.waitForFunction((l) => [...document.querySelectorAll("button")].find((b) => b.getClientRects().length > 0 && b.innerText.trim() === l && !b.disabled) || null, {}, label);
  await handle.asElement().click();
}

try {
  const [a1, a2, b] = [await makeUser("ui-a1"), await makeUser("ui-a2"), await makeUser("ui-b")];
  const [wsA] = await admin("/rest/v1/workspaces", { method: "POST", body: JSON.stringify({ name: `QB UI A ${run}`, slug: `qb-ui-a-${run}`, owner_id: a1.id }) });
  const [wsB] = await admin("/rest/v1/workspaces", { method: "POST", body: JSON.stringify({ name: `QB UI B ${run}`, slug: `qb-ui-b-${run}`, owner_id: b.id }) });
  await admin("/rest/v1/workspace_members", { method: "POST", body: JSON.stringify([
    { workspace_id: wsA.id, user_id: a1.id, role: "owner", status: "active" },
    { workspace_id: wsA.id, user_id: a2.id, role: "estimator", status: "active" },
    { workspace_id: wsB.id, user_id: b.id, role: "owner", status: "active" },
  ]) });
  report.setup = { workspaceA: wsA.id, workspaceB: wsB.id };
  const jobName = `Acceptance Job ${run}`;

  const A1 = await contextPage(), A2 = await contextPage(), B = await contextPage();
  activePage = A1.page;
  await step("1. Three users sign in through the real login page at the same time", async () => {
    await Promise.all([signIn(A1.page, a1), signIn(A2.page, a2), signIn(B.page, b)]);
    return { a1: A1.page.url(), a2: A2.page.url(), b: B.page.url() };
  });

  let jobUrl;
  await step("2. Builder A creates a job from the File menu", async () => {
    await A1.page.goto(`${origin}/modules/estimate-builder`, { waitUntil: "networkidle2" });
    await A1.page.click("#estimate-builder-file-menu-button");
    await clickButton(A1.page, "Create New Job");
    const dialog = await A1.page.waitForSelector('[role="dialog"][aria-label="Create new job"]');
    const inputs = await dialog.$$("input");
    await inputs[0].type(jobName); await inputs[1].type("Acceptance Client"); await inputs[2].type(`QB-${run}`);
    await clickButton(A1.page, "Create Job");
    await A1.page.waitForFunction((n) => document.body.innerText.includes(n), {}, jobName);
    await sleep(2000);
    jobUrl = A1.page.url();
    return { jobUrl };
  });

  let totals;
  await step("3. Quote Sheet opens with final total and GST", async () => {
    const url = new URL(jobUrl); url.searchParams.set("page", "quotation");
    await A1.page.goto(url.toString(), { waitUntil: "networkidle2" });
    await A1.page.waitForFunction(() => /Final quote total/i.test(document.body.innerText));
    const t = await text(A1.page);
    assert(/\bGST\b/.test(t), "GST not shown on the quotation page");
    totals = t.match(/Final quote total\s*\n?\s*(\$[\d,]+\.\d{2})/i)?.[1] || null;
    return { finalQuoteTotal: totals };
  });

  await step("4. Save Job, full reload and reopen keeps the job", async () => {
    await clickButton(A1.page, "Save Job");
    await A1.page.waitForFunction(() => /saved/i.test(document.querySelector('[data-testid="job-persistence-status"]')?.innerText || ""), { timeout: 120000 });
    await A1.page.reload({ waitUntil: "networkidle2" });
    await A1.page.waitForFunction((n) => document.body.innerText.includes(n), {}, jobName);
    if (totals) await A1.page.waitForFunction((m) => document.body.innerText.includes(m), {}, totals);
    return { reopened: A1.page.url(), totals };
  });

  let issued = null;
  await step("5. Issue to Project Commercials obeys the server missing-price check", async () => {
    // The flag is stored per workspace (lib/builders/browserTenantStorage.js).
    await A1.page.evaluate(() => {
      const ws = localStorage.getItem("active_workspace_id") || "";
      localStorage.setItem(ws ? `estimate-builder-show-developer-controls:workspace:${encodeURIComponent(ws)}` : "estimate-builder-show-developer-controls", "true");
    });
    await A1.page.reload({ waitUntil: "networkidle2" });
    await clickButton(A1.page, "Sync to Project Commercials");
    const outcome = await A1.page.waitForFunction(() => {
      const t = document.body.innerText;
      if (/Commercial snapshot synced/i.test(t)) return "synced";
      if (/cannot be issued/i.test(t)) return "refused";
      // A new job with no quotation rows is refused by the server (nothing to issue).
      if (/quotation is required/i.test(t)) return "refused-empty";
      if (/sync failed|could not sync/i.test(t)) return "error";
      return null;
    }, { timeout: 120000 }).then((h) => h.jsonValue());
    const snaps = await admin(`/rest/v1/builder_estimate_snapshots?workspace_id=eq.${wsA.id}&select=id,final_quote_total,gst_total`, { method: "GET" });
    const message = await A1.page.evaluate(() => document.body.innerText.match(/Sync failed[^\n]*\n?[^\n]*|Commercial snapshot synced[^\n]*/i)?.[0] || "");
    assert.notEqual(outcome, "error", `sync returned an unexpected error: ${message}`);
    if (outcome === "synced") assert.equal(snaps.length, 1, "UI said synced but no snapshot stored");
    else assert.equal(snaps.length, 0, "refused issue still stored a snapshot");
    issued = outcome === "synced";
    return { outcome, message, snapshots: snaps };
  });

  await step("6. Estimator A2 (same workspace) and builder B open Quote Approvals at the same time", async () => {
    const qa = (p) => p.goto(`${origin}/modules/estimate-builder?page=quoteApprovals`, { waitUntil: "networkidle2" });
    await Promise.all([qa(A2.page), qa(B.page)]);
    await sleep(6000);
    const [tA2, tB] = await Promise.all([text(A2.page), text(B.page)]);
    assert(!tB.includes(jobName), "builder B can see builder A's project");
    if (issued) assert(tA2.includes(jobName), "estimator A2 cannot see the issued project in its own workspace");
    return { a2SeesProject: tA2.includes(jobName), bSeesProject: tB.includes(jobName) };
  });

  await step("7. Builder B's own Estimate Builder does not contain builder A's job", async () => {
    await B.page.goto(`${origin}/modules/estimate-builder`, { waitUntil: "networkidle2" });
    await sleep(3000);
    assert(!(await text(B.page)).includes(jobName));
    return {};
  });

  await step("8. Project Estimate (client quote) PDF downloads as a real PDF", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qb-pdf-"));
    const cdp = await A1.page.createCDPSession();
    await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
    // 8a. The Project Estimate PDF needs an active inclusions schedule: upload and save one.
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i += 1) doc.addPage([595.28, 841.89]).drawText(`Premier Inclusions acceptance page ${i}`, { x: 60, y: 760, size: 18, font });
    const schedulePdf = path.join(dir, "acceptance-inclusions-source.pdf.upload");
    fs.writeFileSync(schedulePdf, await doc.save());
    const uploadable = schedulePdf.replace(/\.upload$/, "");
    fs.renameSync(schedulePdf, uploadable);
    const inclusionsUrl = new URL(jobUrl); inclusionsUrl.searchParams.set("page", "standardInclusions");
    await A1.page.goto(inclusionsUrl.toString(), { waitUntil: "networkidle2" });
    await A1.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Upload First Schedule|Add Inclusions Schedule/.test(b.innerText)));
    const fileInputs = await A1.page.$$('input[type="file"]');
    await fileInputs[fileInputs.length - 1].uploadFile(uploadable);
    await clickButton(A1.page, "Save Schedule");
    await A1.page.waitForFunction(() => !/Save Schedule/.test([...document.querySelectorAll("button")].map((b) => b.innerText).join("|")), { timeout: 120000 });
    fs.unlinkSync(uploadable);
    // 8b. Project Estimate > File > Download PDF.
    const estimateUrl = new URL(jobUrl); estimateUrl.searchParams.set("page", "projectEstimate");
    await A1.page.goto(estimateUrl.toString(), { waitUntil: "networkidle2" });
    await A1.page.waitForSelector("#project-estimate-file-menu-button");
    await A1.page.click("#project-estimate-file-menu-button");
    await clickButton(A1.page, "Download PDF");
    const file = await (async () => { for (let i = 0; i < 180; i += 1) { const f = fs.readdirSync(dir).find((n) => !n.endsWith(".crdownload") && !n.startsWith("acceptance-inclusions-source")); if (f) return path.join(dir, f); await sleep(1000); } return null; })();
    const status = await A1.page.evaluate(() => document.body.innerText.match(/PDF (downloaded|export could not be completed)[^\n]*|[^\n]*inclusions[^\n]*(missing|required|remove)[^\n]*/i)?.[0] || "");
    assert(file, `no PDF downloaded (status: ${status})`);
    assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), "%PDF-");
    const pages = (await PDFDocument.load(fs.readFileSync(file))).getPageCount();
    return { file: path.basename(file), bytes: fs.statSync(file).size, pages, status };
  });

  report.pageErrorCount = report.pageErrors.length;
} catch (error) {
  failures += 1; report.setupError = error.message; console.log("FAIL setup -", error.message);
} finally {
  await browser.close();
  report.passed = failures === 0;
  fs.mkdirSync("artifacts/test-artifacts/quotation-acceptance", { recursive: true });
  fs.writeFileSync(`artifacts/test-artifacts/quotation-acceptance/browser-${run}.json`, JSON.stringify(report, null, 2));
  console.log(`\n${report.steps.filter((s) => s.result === "PASS").length}/${report.steps.length} steps passed; page errors: ${report.pageErrors.length}`);
  process.exitCode = failures ? 1 : 0;
}
