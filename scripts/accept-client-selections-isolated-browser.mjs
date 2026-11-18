// Client Selections real-job browser acceptance, fully isolated (15 Nov 2026).
// A protected copy of the real job is opened in a local production build (never port 3000) under a
// fresh stand-in job id. Every Supabase and /api request is answered locally: nothing reaches
// production, no real account signs in. Phases (each PASS/FAIL on its own):
//   walkthrough  every Interior and Exterior category opens with no crash / raw value / phantom room
//   navigation   browser Back / Forward and reload keep the client where they were
//   hvac         choose a split system for a room, Save and Continue, reload: still saved
//   doorHardware choose different internal door furniture, confirm, reload: still saved
//   review       Review Schedule renders the variation summary
//   CLIENT_SELECTIONS_BASE_URL=http://localhost:3101 CLIENT_SELECTIONS_JOB_FILE=<job.gr8job> node scripts/accept-client-selections-isolated-browser.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createContractLock, postContractVariationUuid, CLIENT_APPROVED_SOURCE } from "../lib/builders/contractLock.js";

dotenv.config({ path: ".env.local", quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3101";
assert.notEqual(new URL(origin).port, "3000", "the shared port-3000 server is never used");
const source = process.env.CLIENT_SELECTIONS_JOB_FILE;
assert(source && fs.existsSync(source), "CLIENT_SELECTIONS_JOB_FILE must point at a protected job copy");
const only = (process.env.PHASES || "walkthrough,navigation,inAppBack,hvac,doorHardware,externalAccessories,review").split(",");
const out = path.resolve("artifacts", "test-artifacts", "client-selections-isolated-acceptance");
fs.mkdirSync(out, { recursive: true });

const buffer = fs.readFileSync(source);
const original = buffer[0] === 0x7b ? JSON.parse(buffer.toString("utf8")).workbook : JSON.parse(await (await JSZip.loadAsync(buffer)).file("estimate.json").async("string")).workbook;
const projectId = crypto.randomUUID();
const jobName = "Isolated Client Selections acceptance";
const workbook = JSON.parse(JSON.stringify(original));
Object.assign(workbook, { projectId, jobId: projectId, registeredJobId: projectId, commercialProjectId: projectId });
workbook.registeredJob = { ...workbook.registeredJob, jobId: projectId, jobName };
workbook.jobFileMeta = { ...workbook.jobFileMeta, projectId, jobName, commercialProjectUuid: projectId };
// KEEP_APPROVALS=1: the copy keeps the real job's cabinetry approvals. Approvals are bound to the job
// identity, so the ones made under the real job id are re-bound to the stand-in id (as on the real job).
if (process.env.KEEP_APPROVALS === "1") {
  const realIds = new Set([original.projectId, original.jobId, original.registeredJobId].filter(Boolean));
  for (const row of (workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || [])) {
    for (const location of row.guidedSelection?.cabinetrySelection?.locations || []) {
      if (location.reviewApproval && realIds.has(location.reviewApproval.jobId)) location.reviewApproval = { ...location.reviewApproval, jobId: projectId };
    }
  }
}
// CONTRACT_LOCK=1: the copy is under contract (Final Contract Schedule issued), for the rejection phase.
if (process.env.CONTRACT_LOCK === "1") workbook.clientSelectionsBook.metadata = { ...(workbook.clientSelectionsBook.metadata || {}), contractLock: createContractLock({ lockedAt: "2026-11-15T00:00:00.000Z", lockedBy: "isolated-test" }) };
// BLANK_CABINETRY=1: scenario A of the 17 Nov 2026 brief - a brand-new job. Every cabinetry room keeps
// the builder's schedule but has no client finishes, approvals, copy history or copied lines.
if (process.env.BLANK_CABINETRY === "1") {
  const row = workbook.clientSelectionsBook.rooms.flatMap((room) => room.rows || []).find((r) => r.guidedSelection?.cabinetrySelection);
  const selection = row.guidedSelection.cabinetrySelection;
  const blank = { doorMaterialGroup: "Standard colourboard", doorAndPanelSelections: { material: "Standard colourboard" }, supplier: "Polytec", productRange: "", finish: "", customSupplier: "", customRange: "", customColour: "", customFinish: "", customMaterial: "", customDescription: "", areaSelections: {}, defaultColour: null, handles: {}, bathroomHandles: {}, bathroomBenchtops: {}, benchtop: null, benchtops: null, coloursAndFinishes: {}, bulkheadFinishMode: "", kickPanelFinishMode: "", customProfile: "", reviewApproval: null, status: "in_progress", confirmedAt: "", source: "", copiedFromLocation: "", copiedItemsReviewedAt: "", builderConfirmItems: [], featureOptions: [], features: [], notes: "" };
  const ids = new Map();
  for (const l of selection.locations) if (l.projectRoomId) ids.set(l.projectRoomId, (ids.get(l.projectRoomId) || 0) + 1);
  selection.locations = selection.locations.map((l) => ({ ...l, ...blank,
    projectRoomId: l.location === "Kitchen" && ids.get(l.projectRoomId) > 1 ? "" : l.projectRoomId,
    // A new job has no saved benchtop areas or setup: the app lists each room's own areas from the project.
    benchtopAreas: null, benchtopSetup: null, benchtopEdge: "", benchtopUpstand: "" }));
  selection.schedule = (selection.schedule || []).filter((line) => !/copied from/i.test(line.notes || ""));
  selection.audit = [];
  delete selection.activeLocation;
}
// A builder-rejected selection variation served from builder_variations (set by the rejection phase).
let rejected = null;
const variationWrites = [];
const fixture = path.join(out, "protected-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName, workbook }));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(supabaseUrl, "Supabase URL required (only its origin is used, to answer requests locally)");
const user = { id: "66666666-6666-4666-8666-666666666666", email: "isolated@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const session = { user, access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 7200, role: "authenticated", aud: "authenticated" })).toString("base64url")}.isolated`, refresh_token: "isolated", expires_at: Math.floor(Date.now() / 1000) + 7200, expires_in: 7200, token_type: "bearer" };
const report = { source: path.basename(source), projectId, phases: {}, categories: {}, pageErrors: [], consoleErrors: [], answeredLocally: 0, productionRequests: [] };
const BAD = [
  [/\[object Object\]|\bundefined\b|\bNaN\b|[$-]\s?Infinity\b|Infinity\s?(%|m²|m2)/, "raw value on screen"],
  [/\b(UPSTAIRS|DOWNSTAIRS)\b/, "phantom level used as a room"],
  [/Something went wrong|Application error|Unhandled Runtime Error/i, "crash screen"],
];

const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, protocolTimeout: 300000, defaultViewport: { width: 1600, height: 1000 }, args: ["--js-flags=--max-old-space-size=3072"] });
const page = await browser.newPage();
page.setDefaultTimeout(120000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const buttonWithText = (text) => page.evaluate((text) => { const b = [...document.querySelectorAll("button")].find((x) => !x.disabled && x.offsetParent && x.textContent.trim() === text); if (b) b.click(); return Boolean(b); }, text);
const screenText = () => page.evaluate(() => document.body.innerText);
const home = '[data-testid="guided-client-selections-home"]';
const anyGuided = `${home}, [data-testid="guided-interior-categories"], [data-testid="guided-exterior-categories"], [data-testid="guided-product-page"], [data-testid^="builder-standard-range-"], .guidedShell:not([data-testid="client-selections-loading-book"])`;
async function toHome() {
  for (let i = 0; i < 8 && !(await page.$(home)); i++) { await buttonWithText("Back") || await buttonWithText("← Back"); await delay(1200); }
  return Boolean(await page.$(home));
}
async function waitForApp() {
  await page.waitForFunction((sel) => document.querySelector(sel) || [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Retry"), { timeout: 240000 }, anyGuided);
  if (await buttonWithText("Retry")) await page.waitForSelector(anyGuided, { timeout: 240000 });
  await delay(1500);
}
async function savedRecord() {
  return page.evaluate(async (projectId) => {
    const records = [];
    for (const { name } of await indexedDB.databases()) {
      if (!name.includes("estimate-builder-template-db")) continue;
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      try {
        if (!db.objectStoreNames.contains("jobs")) continue;
        const all = await new Promise((resolve, reject) => { const r = db.transaction("jobs", "readonly").objectStore("jobs").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        records.push(...all.filter((r) => r.workbook?.jobId === projectId || r.workbook?.projectId === projectId));
      } finally { db.close(); }
    }
    const latest = records.sort((a, b) => String(b.savedAt || b.workbook?.savedAt).localeCompare(String(a.savedAt || a.workbook?.savedAt)))[0];
    if (!latest) return null;
    const rows = (latest.workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []);
    const guided = (key) => rows.map((row) => row.guidedSelection).find((g) => g?.requirementKey === key) || null;
    const quoteRows = Object.entries(latest.workbook.quotation || {}).flatMap(([section, value]) => (value.rows || []).map(row => ({ ...row, section })));
    return { savedAt: latest.savedAt || latest.workbook.savedAt, revision: latest.workbook.clientSelectionsBook?.metadata?.selectionRevision, pending: latest.workbook.selectionReconciliationPending || null, cabinetry: guided("cabinetry")?.cabinetrySelection, hvac: guided("air-conditioning"), doorHardware: guided("door-hardware"), accessories: { clothesline: guided("clothesline"), letterbox: guided("letterbox") }, quoteRows,
      acQuote: quoteRows.filter(row => /air condition/i.test(row.section)).map(r => ({ id: r.id, productName: r.productName || r.item, products: (r.selectedProducts || []).map(p => `${p.productName}@${(p.allocations || []).map(a => a.location).join("+")}`) })) };
  }, projectId);
}
async function phase(name, run) {
  if (!only.includes(name)) return;
  const errorsBefore = report.pageErrors.length;
  try {
    const detail = await run();
    const errors = report.pageErrors.slice(errorsBefore);
    report.phases[name] = errors.length ? { status: "FAIL", detail, errors } : { status: "PASS", detail };
  } catch (error) {
    const screen = await page.evaluate(() => ({ url: location.href, testids: [...new Set([...document.querySelectorAll("[data-testid]")].filter((e) => e.offsetParent).map((e) => e.dataset.testid))].slice(0, 40), buttons: [...document.querySelectorAll("button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 40), text: document.body.innerText.replace(/\s+/g, " ").slice(0, 600) })).catch(() => null);
    report.phases[name] = { status: "FAIL", error: String(error.message || error).slice(0, 600), errors: report.pageErrors.slice(errorsBefore), screen };
    await page.screenshot({ path: path.join(out, `fail-${name}.png`) }).catch(() => {});
  }
  console.log(`${report.phases[name].status} ${name}${report.phases[name].error ? `: ${report.phases[name].error}` : ""}`);
}
// category: the deep link an allocated requirement needs (?selectionCategory=...); internal pickers need none.
// Cabinetry: the deep link can stop on the category card; open the workflow from it.
const openCabinetry = async () => {
  await openRequirement("interior", "cabinetry", "cabinetry");
  if (!(await page.$('[data-testid="cabinetry-room-kitchen"], [data-testid="cabinetry-room-nav"]'))) {
    await page.$eval('[data-testid="guided-requirement-cabinetry"]', (card) => (card.querySelector("button") || card).click());
  }
  await page.waitForSelector('[data-testid="cabinetry-room-kitchen"], [data-testid="cabinetry-room-nav"]', { timeout: 120000 });
  if (!(await page.$('[data-testid="cabinetry-room-nav"]'))) await page.$eval('[data-testid="cabinetry-room-kitchen"]', (b) => b.click());
  await page.waitForSelector('[data-testid="cabinetry-room-nav"]');
};
const openRequirement = async (side, key, category = "") => {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}&selectionArea=${side}${category ? `&selectionCategory=${category}` : ""}&selectionRequirement=${key}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await waitForApp();
};
// The builder-only cabinetry setup (18 Nov 2026): Client Selections has no builder / client switch; the
// Quotation Builder opens the setup with ?cabinetryBuilder=1&cabinetryRoom=<room>.
const openBuilderSetup = async (roomSlug) => {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}&cabinetryBuilder=1&cabinetryRoom=${roomSlug}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await waitForApp();
  await page.waitForSelector('[data-testid="cabinetry-builder-setup"]', { timeout: 120000 });
  await page.waitForSelector('[data-testid="cabinetry-room-nav"]', { timeout: 120000 });
  await delay(1500);
};
// Room helpers shared by the cabinetry phases (newJob, benchtops): drive the real screens.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const navStatus = () => page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons) => Object.fromEntries(buttons.map((b) => [b.innerText.replace(/^\d+\s*/, "").split("\n")[0].trim(), b.dataset.locked === "true" ? "locked" : b.className.includes("approved") ? "approved" : b.className.includes("complete") ? "complete" : "in_progress"])));
const stageTo = async (stage) => { await page.$eval('[data-testid="cabinetry-progress-menu"]', (menu, stage) => [...menu.querySelectorAll("button")].find((b) => b.textContent.includes(stage)).click(), stage); await delay(1300); };
const openRoom = async (name) => { await page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons, name) => { const b = buttons.find((x) => x.innerText.replace(/^\d+\s*/, "").split("\n")[0].trim() === name); if (b && !b.className.includes("current")) b.click(); }, name); await delay(1500); };
const currentRoom = () => page.$eval('[data-testid="cabinetry-progress-menu"] h2', (e) => e.innerText.trim());
const missing = async () => { await stageTo("Review & Confirm"); return page.$eval('[data-testid="cabinetry-missing-requirements"]', (e) => e.innerText).catch(() => ""); };
const clickText = (selector, re) => page.evaluate((selector, source) => { const re = new RegExp(source); const b = [...document.querySelectorAll(selector)].find((x) => x.offsetParent && !x.disabled && re.test(x.textContent.trim())); if (b) b.click(); return Boolean(b); }, selector, re.source);
const pickColours = async () => {
  await stageTo("Colours & Finishes");
  await page.$$eval('[data-testid="cabinetry-apply-colour-to"] button', (buttons) => buttons.filter((b) => b.offsetParent && b.textContent.trim() === "Select").forEach((b) => b.click()));
  await page.$$eval('[data-testid="cabinetry-apply-colour-to"] > .cabinetrySelectionList input[type=checkbox]', (inputs) => inputs.filter((i) => !i.checked && !i.disabled).forEach((i) => i.click()));
  await delay(600);
  if (!(await clickText('[data-testid="cabinetry-swatch-grid"] button', /^Select Colour$/))) {
    const panel = await page.$eval('[data-testid="cabinetry-colour-selector"]', (e) => e.innerText.replace(/\s+/g, " ").slice(0, 900)).catch(() => "");
    const areaButtons = await page.$$eval('[data-testid="cabinetry-apply-colour-to"] button', (bs) => bs.map((b) => b.textContent.trim()));
    throw new Error(`no catalogue colour to select in ${await currentRoom()}; area buttons ${JSON.stringify(areaButtons)}; panel: ${panel}`);
  }
  await page.waitForSelector('[data-testid="cabinetry-colour-selection-modal"]');
  await page.$eval('[data-testid="cabinetry-colour-selection-modal"]', (modal) => {
    const apply = [...modal.querySelectorAll("button")].find((b) => b.textContent.trim() === "Apply Colour");
    if (apply.disabled) modal.querySelector(".cabinetrySelectionList input[type=checkbox]")?.click();
  });
  await delay(400);
  await page.$$eval('[data-testid="cabinetry-colour-selection-modal"] .cabinetryModalAreaList input[type=checkbox]', (inputs) => inputs.filter((i) => !i.checked && !i.disabled).forEach((i) => i.click()));
  await delay(400);
  assert(await clickText('[data-testid="cabinetry-colour-selection-modal"] button', /^Apply Colour$/), "Apply Colour");
  await delay(1200);
};
const pickBenchtops = async () => {
  await stageTo("Benchtops");
  if (await page.$('[data-testid="benchtop-setup-confirm"]')) { await page.$eval('[data-testid="benchtop-setup-confirm"]', (b) => b.click()); await delay(1200); }
  const areas = (await page.$$('[data-testid="benchtop-area"]')).length || 1;
  for (let i = 0; i < areas; i++) {
    await page.$$eval('[data-testid="benchtop-area"]', (els, i) => els[i]?.click(), i).catch(() => {});
    await delay(500);
    await clickText('[data-testid="benchtop-product-grid"] button, button', /^Select surface$/);
    await delay(900);
  }
};
const pickHandles = async () => {
  await stageTo("Handles");
  if (await page.$('[data-testid="cabinetry-bathroom-handles"]')) {
    await page.$$eval('[data-testid="cabinetry-bathroom-handles"] section', (sections) => sections.forEach((s) => { if (!s.querySelector("input[type=checkbox]:checked")) s.querySelector(".cabinetrySelectionRow input[type=checkbox]")?.click(); }));
  } else {
    for (const re of [/^Base units: Channel pull/, /^Overheads: Handleless/, /^Tall/]) {
      await page.evaluate((source) => { const re = new RegExp(source); const row = [...document.querySelectorAll(".cabinetryPanel .cabinetrySelectionRow")].find((r) => r.offsetParent && re.test(r.querySelector("strong")?.textContent.trim() || "")); const input = row?.querySelector("input[type=checkbox]"); if (input && !input.checked) input.click(); }, re.source);
      await delay(500);
    }
  }
  await delay(800);
};
const completeRoom = async (name) => {
  let need = "";
  for (let i = 0; i < 5; i++) {
    need = await missing();
    if (!need) return [];
    if (/colour/i.test(need)) await pickColours();
    else if (/benchtop/i.test(need)) await pickBenchtops();
    else if (/handle/i.test(need)) await pickHandles();
    else break;
  }
  need = await missing();
  assert(!need, `${name} still needs: ${need.replace(/\s+/g, " ").slice(0, 200)}`);
  return [];
};
const approve = async (name) => {
  await stageTo("Review & Confirm");
  assert(await clickText("button", /^Confirm & Approve/), `${name}: Confirm & Approve`);
  await delay(6000);
};


try {
  page.on("pageerror", (error) => report.pageErrors.push(String(error.message || error).slice(0, 400)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|status of 4\d\d/i.test(m.text())) report.consoleErrors.push(m.text().slice(0, 300)); });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const respond = (body, status = 200) => request.respond({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" }, body: JSON.stringify(body) });
    if (url.origin === new URL(supabaseUrl).origin) {
      report.answeredLocally += 1;
      const single = /vnd\.pgrst\.object/.test(request.headers().accept || "");
      if (request.method() === "OPTIONS") return respond({});
      if (url.pathname.startsWith("/auth/")) return respond(url.pathname.endsWith("/user") ? user : session);
      if (url.pathname.includes("/accounts")) return respond([{ user_id: user.id, approved: true, is_approved: true, status: "approved", subscription_status: "active", onboarding_completed: true }]);
      if (url.pathname.includes("/builder_variations")) {
        if (request.method() === "GET") { const rows = rejected ? [rejected] : []; return single ? (rows.length ? respond(rows[0]) : request.respond({ status: 406, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: "PGRST116", message: "no rows" }) })) : respond(rows); }
        if (["POST", "PATCH", "PUT"].includes(request.method())) {
          let body = {}; try { body = JSON.parse(request.postData() || "{}"); } catch { body = {}; }
          variationWrites.push({ method: request.method(), body });
          const row = { ...(rejected || {}), ...(Array.isArray(body) ? body[0] : body), updated_at: new Date().toISOString() };
          if (rejected) rejected = row;
          return respond(single ? row : [row]);
        }
      }
      if (url.pathname.includes("/builder_commercial_projects")) { const rows = [{ id: projectId, workspace_id: workbook.workspaceId, project_name: jobName, client_name: "Client", site_address: "Site", job_number: "ISO-1" }]; return respond(single ? rows[0] : rows); }
      if (["POST", "PATCH", "PUT"].includes(request.method())) {
        let body = []; try { body = JSON.parse(request.postData() || "[]"); } catch { body = []; }
        const rows = (Array.isArray(body) ? body : [body]).map((row, i) => ({ id: row?.id || crypto.randomUUID(), ...row }));
        return respond(single ? rows[0] : rows);
      }
      return single ? request.respond({ status: 406, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: "PGRST116", message: "no rows" }) }) : respond([]);
    }
    if (url.origin === new URL(origin).origin && url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/workspaces") return respond({ workspaces: [{ id: workbook.workspaceId, name: "Isolated acceptance", role: "owner" }] });
      if (url.pathname === "/api/builders/selection-foundation") return respond({ workspace_id: workbook.workspaceId, requirementMappings: [], products: [] });
      return respond({ ok: true, products: [], rows: [], data: [] });
    }
    if (url.origin !== new URL(origin).origin && !["GET", "HEAD", "OPTIONS"].includes(request.method())) { report.productionRequests.push(url.href); return request.abort(); }
    return request.continue();
  });
  await page.evaluateOnNewDocument(({ session, supabaseUrl, workspaceId }) => {
    localStorage.setItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", workspaceId);
  }, { session, supabaseUrl, workspaceId: workbook.workspaceId });

  // Open the protected job copy through the app's own "Open Job File" input.
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await (await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 300000 })).uploadFile(fixture);
  for (let n = 0; n < 16; n++) { await delay(500); for (const t of ["Open Job", "Open Job File", "Keep Local", "Discard Changes"]) await buttonWithText(t); }
  await delay(4000);
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await waitForApp();
  report.opened = Boolean(await savedRecord());

  await phase("walkthrough", async () => {
    assert(await toHome(), "Client Selections home did not appear");
    const failures = [];
    for (const side of ["interior", "exterior"]) {
      assert(await toHome(), "could not return home");
      await page.$eval(`${home} [data-category-key="${side}"]`, (el) => el.click());
      await page.waitForSelector(`[data-testid="guided-${side}-categories"]`);
      await delay(800);
      const cards = await page.$$eval(`[data-testid="guided-${side}-categories"] [data-category-key]`, (items) => items.map((i) => ({ key: i.dataset.categoryKey, text: i.innerText.replace(/\s+/g, " ").trim().slice(0, 100) })));
      for (const card of cards) {
        if (!(await page.$(`[data-testid="guided-${side}-categories"]`))) { await toHome(); await page.$eval(`${home} [data-category-key="${side}"]`, (el) => el.click()); await page.waitForSelector(`[data-testid="guided-${side}-categories"]`); }
        const before = report.pageErrors.length;
        await page.$eval(`[data-testid="guided-${side}-categories"] [data-category-key="${card.key}"]`, (el) => el.click());
        await delay(3000);
        const text = await screenText();
        const problems = BAD.filter(([re]) => re.test(text)).map(([, label]) => label);
        const errors = report.pageErrors.slice(before);
        report.categories[`${side}/${card.key}`] = { card: card.text, problems, errors, context: problems.length ? [...text.matchAll(/.{0,100}(\[object Object\]|undefined|NaN|Infinity|UPSTAIRS|DOWNSTAIRS).{0,60}/g)].map((m) => m[0]).slice(0, 3) : [] };
        if (problems.length || errors.length || text.trim().length < 40) failures.push(`${side}/${card.key}: ${[...problems, ...errors].join("; ") || "empty page"}`);
        await buttonWithText("Back") || await buttonWithText("← Back"); await delay(1200);
      }
    }
    assert(!failures.length, failures.join(" | "));
    return { categories: Object.keys(report.categories).length };
  });

  await phase("navigation", async () => {
    assert(await toHome(), "home");
    await page.$eval(`${home} [data-category-key="interior"]`, (el) => el.click());
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
    const interiorUrl = page.url();
    await page.goBack({ waitUntil: "domcontentloaded" }); await delay(2500);
    const afterBack = await page.$(home) ? "home" : await page.$('[data-testid="guided-interior-categories"]') ? "interior" : "other";
    await page.goForward({ waitUntil: "domcontentloaded" }); await delay(2500);
    const afterForward = await page.$('[data-testid="guided-interior-categories"]') ? "interior" : await page.$(home) ? "home" : "other";
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    const afterReload = await page.$('[data-testid="guided-interior-categories"]') ? "interior" : await page.$(home) ? "home" : "other";
    const detail = { interiorUrl: interiorUrl.replace(origin, ""), afterBack, afterForward, afterReload };
    assert.equal(afterBack, "home", `Back from Interior: ${JSON.stringify(detail)}`);
    assert.equal(afterForward, "interior", `Forward to Interior: ${JSON.stringify(detail)}`);
    assert.equal(afterReload, "interior", `Reload on Interior: ${JSON.stringify(detail)}`);
    return detail;
  });

  // In-app Back to the home screen must leave a URL that reopens the home screen (reload / history).
  await phase("inAppBack", async () => {
    assert(await toHome(), "home");
    await page.$eval(`${home} [data-category-key="interior"]`, (el) => el.click());
    await page.waitForSelector('[data-testid="guided-interior-categories"]');
    const interiorUrl = page.url();
    assert(await buttonWithText("Back"), "in-app Back button");
    await page.waitForSelector(home, { timeout: 30000 });
    await delay(1500);
    const homeUrl = page.url();
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    const afterReload = await page.$(home) ? "home" : await page.$('[data-testid="guided-interior-categories"]') ? "interior" : "other";
    const detail = { interiorUrl: interiorUrl.replace(origin, ""), homeUrl: homeUrl.replace(origin, ""), afterReload };
    assert(!/selectionArea=interior/.test(homeUrl), `home screen URL still names Interior: ${JSON.stringify(detail)}`);
    assert.equal(afterReload, "home", `reload after in-app Back: ${JSON.stringify(detail)}`);
    return detail;
  });

  await phase("hvac", async () => {
    await openRequirement("interior", "air-conditioning", "hvac");
    await page.waitForSelector('[data-testid="builder-standard-range-air-conditioning"]');
    const chosen = await page.evaluate(() => {
      const card = [...document.querySelectorAll(".standardRange .products article")].find((a) => /Split/i.test(a.innerText));
      if (!card) return "";
      [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Choose option").click();
      return card.querySelector("h3")?.textContent || "";
    });
    assert(chosen, "a split system is offered");
    await page.waitForSelector(".standardRange .dialog");
    // Existing quotation item (if asked) and the room.
    await page.evaluate(() => {
      for (const select of document.querySelectorAll(".standardRange .dialog select")) {
        if (select.value) continue;
        const options = [...select.options].map((o) => o.value).filter(Boolean);
        const value = options.includes("Living") ? "Living" : options[0];
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await delay(300);
    await page.evaluate(() => [...document.querySelectorAll(".standardRange .dialog button")].find((b) => b.textContent.trim() === "Save selection").click());
    await page.waitForFunction(() => !document.querySelector(".standardRange .dialog") || document.querySelector('.standardRange .dialog [role="alert"]'), { timeout: 30000 });
    const dialogError = await page.evaluate(() => document.querySelector('.standardRange .dialog [role="alert"]')?.textContent || "");
    assert(!dialogError, `AC dialog refused: ${dialogError}`);
    await page.waitForSelector('[data-testid="standard-range-save-continue-air-conditioning"]', { timeout: 30000 });
    await page.$eval('[data-testid="standard-range-save-continue-air-conditioning"]', (b) => b.click());
    await page.waitForFunction(() => !document.querySelector('[data-testid="builder-standard-range-air-conditioning"]') || document.querySelector('.continueBar [role="alert"]'), { timeout: 90000 });
    const continueError = await page.evaluate(() => document.querySelector('.continueBar [role="alert"]')?.textContent || "");
    assert(!continueError, `Save and Continue: ${continueError}`);
    const after = await savedRecord();
    assert(after?.hvac, "air-conditioning saved to the job");
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    const reopened = await savedRecord();
    const lines = reopened?.hvac?.plumbingAllocation?.lines || reopened?.hvac?.plumbingAllocationLines || [];
    assert(lines.some((l) => l.productName === chosen.trim() || JSON.stringify(l).includes(chosen.trim())), `split system kept after reload (${chosen})`);
    // A save that changes the quotation total is held for builder approval (deferUnapprovedQuotationChanges):
    // the AC change must then be inside the held change set, linked to the builder's AC section.
    // The AC line names the builder AC row it replaces; the row change is applied with the held quotation on approval.
    const acLinked = lines.find((l) => (l.productName === chosen.trim() || JSON.stringify(l).includes(chosen.trim())) && /AIR CONDITION|HVAC|MECHANICAL/i.test(l.quotationSection || "") && l.quotationRowId);
    const acHeld = reopened.pending?.status === "FINANCIAL_APPROVAL_REQUIRED" && Boolean(acLinked);
    assert(JSON.stringify(reopened.acQuote).includes(chosen.trim()) || acHeld, `saved AC product reaches its quotation section or the held approval (pending: ${JSON.stringify(reopened.pending)?.slice(0, 300)}; acQuote: ${JSON.stringify(reopened.acQuote).slice(0, 300)})`);
    return { chosen, lines: lines.map((l) => `${l.productName} x${l.quantity} @ ${(l.allocations || []).map((a) => a.location).join("+")} -> ${l.quotationSection || "-"}/${l.quotationRowId || "-"}`), acQuote: reopened.acQuote, heldForApproval: acHeld ? reopened.pending.status : null };
  });

  await phase("doorHardware", async () => {
    await openRequirement("interior", "door-hardware");
    await page.waitForSelector('[data-testid="internal-catalogue-picker"]');
    const before = await page.$eval('[data-testid="internal-saved-selection"]', (e) => e.innerText).catch(() => "");
    const picked = await page.evaluate(() => {
      const card = [...document.querySelectorAll('[data-testid="internal-product-card"]')].find((c) => c.querySelector('[data-testid="select-internal-product"]')?.textContent.trim() === "Select");
      if (!card) return "";
      card.querySelector('[data-testid="select-internal-product"]').click();
      return card.querySelector("h3")?.textContent.trim() || "";
    });
    assert(picked, "another door furniture product is offered");
    await page.waitForSelector('[data-testid="internal-product-options"]');
    assert(await buttonWithText("Confirm Selection"), "Confirm Selection button");
    await page.waitForFunction((picked) => document.querySelector('[data-testid="internal-saved-selection"]')?.innerText.includes(picked), { timeout: 60000 }, picked);
    let saved = null;
    for (let i = 0; i < 40 && !(saved?.doorHardware?.productName === picked); i++) { await delay(500); saved = await savedRecord(); }
    assert.equal(saved?.doorHardware?.productName, picked, "confirmed door furniture saved to the job");
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await page.waitForSelector('[data-testid="internal-catalogue-picker"]');
    const shown = await page.$eval('[data-testid="internal-saved-selection"]', (e) => e.innerText).catch(() => "");
    assert(shown.includes(picked), `after reload the picker shows ${picked} (got: ${shown})`);
    return { before, picked, shownAfterReload: shown };
  });

  // Clothesline / letterbox / house numbers: can the client actually choose one?
  await phase("externalAccessories", async () => {
    await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}&selectionArea=exterior&selectionCategory=external-accessories`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await waitForApp();
    const text = await screenText();
    const offered = await page.$$eval('[data-testid^="guided-requirement-"]', (n) => n.map((e) => e.dataset.testid.replace("guided-requirement-", "")));
    const chooseButtons = await page.$$eval('[data-testid^="guided-requirement-"] button', (n) => n.map((b) => b.textContent.trim()));
    const selections = [];
    for (const key of ["clothesline", "letterbox"]) {
      await openRequirement("exterior", key, "external-accessories");
      await page.waitForSelector('article.plumbingProductCard');
      const productName = await page.$eval('article.plumbingProductCard', card => { const name = card.querySelector('strong').textContent.trim(); card.querySelector('.guidedProductActions button.primary').click(); return name; });
      await page.waitForSelector('[data-testid="plumbing-allocation-modal"]');
      await page.$eval('[data-testid="plumbing-allocation-modal"] button[aria-label^="Increase "]', button => button.click());
      await page.$eval('[data-testid="plumbing-allocation-save"]', button => button.click());
      await page.waitForFunction(() => !document.querySelector('[data-testid="plumbing-allocation-modal"]'));
      let saved;
      for (let attempt = 0; attempt < 40; attempt++) { saved = await savedRecord(); if (saved?.accessories?.[key]?.plumbingAllocation?.lines?.length) break; await delay(500); }
      const line = saved?.accessories?.[key]?.plumbingAllocation?.lines?.find(line => line.quantity > 0);
      assert(line?.productId, `${key}: saved actual product identity`);
      const heldForApproval = saved.pending?.status === "FINANCIAL_APPROVAL_REQUIRED" && (saved.pending.approvalSignature || "").includes(`allocated-selection:${key}:`);
      assert(saved.quoteRows.some(row => row.productId === line.productId) || heldForApproval, `${key}: quotation product identity or held approval (pending: ${JSON.stringify(saved.pending)?.slice(0, 300)}; line: ${line.productId} x${line.quantity})`);
      await page.reload({ waitUntil: 'domcontentloaded' }); await waitForApp();
      const reopened = await savedRecord();
      assert(reopened.accessories[key].plumbingAllocation.lines.some(row => row.productId === line.productId && row.quantity === line.quantity), `${key}: reload preserves product and quantity`);
      selections.push({ key, productName, productId: line.productId, quantity: line.quantity });
    }
    return { offered, chooseButtons, selections, sample: text.replace(/\s+/g, " ").slice(0, 400) };
  });

  // Builder rejected a client-approved variation: the client sees the reason, the box is clear again,
  // and ticking it resubmits the same record to the builder (status back to submitted).
  await phase("rejection", async () => {
    assert(process.env.CONTRACT_LOCK === "1", "run with CONTRACT_LOCK=1");
    const openReview = async () => {
      await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      await waitForApp();
      assert(await buttonWithText("Review Schedule"), "Review Schedule button");
      await page.waitForSelector('[data-testid="variation-summary"]');
      await delay(1500);
    };
    await openReview();
    const target = await page.evaluate(() => [...document.querySelectorAll('[data-testid="variation-row"]')].find((row) => row.querySelector('[data-testid="variation-client-approval"]'))?.dataset.variationId || "");
    assert(target, "a variation row the client can approve");
    const reason = "Supplier has discontinued this product - please choose another";
    rejected = { id: postContractVariationUuid(`client-approval:${projectId}:${target}`), workspace_id: workbook.workspaceId, project_id: projectId, variation_number: "CS-ISO001", total: 100, status: "rejected", client_status: "approved", updated_at: "2026-11-15T01:00:00.000Z",
      metadata: { source: CLIENT_APPROVED_SOURCE, selectionTaskId: target, builderReviewStatus: "rejected", builderRejection: { reason, by: "builder", at: "2026-11-15T01:00:00.000Z" } } };
    await openReview();
    const sel = `[data-testid="variation-row"][data-variation-id="${target.replace(/"/g, '\\"')}"]`;
    const notice = await page.$eval(`${sel} [data-testid="variation-builder-rejected"]`, (e) => e.innerText).catch(() => "");
    assert(notice.includes(reason), `client sees the builder's reason (got: ${notice})`);
    const checkedBefore = await page.$eval(`${sel} [data-testid="variation-approve-checkbox"]`, (e) => e.checked);
    assert.equal(checkedBefore, false, "the approval box is clear again after a rejection");
    await page.$eval(`${sel} [data-testid="variation-approve-checkbox"]`, (e) => e.click());
    for (let i = 0; i < 40 && !variationWrites.length; i++) await delay(500);
    const write = variationWrites.at(-1);
    assert(write, "resubmission written to builder_variations");
    const body = Array.isArray(write.body) ? write.body[0] : write.body;
    assert.equal(body.status, "submitted", "resubmitted to the builder");
    assert.equal(body.metadata?.rejectionHistory?.[0]?.reason, reason, "rejection kept in history");
    return { target, notice: notice.slice(0, 160), write: { method: write.method, status: body.status, history: body.metadata?.rejectionHistory?.length } };
  });

  await phase("cabinetry", async () => {
    await openRequirement('interior', 'cabinetry', 'cabinetry');
    await page.waitForSelector('[data-testid="cabinetry-room-kitchen"]');
    await page.$eval('[data-testid="cabinetry-room-kitchen"]', button => button.click());
    const openBench = async room => {
      await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
      await page.$eval('[data-testid="cabinetry-progress-menu"]', menu => [...menu.querySelectorAll('button')].find(button => /Benchtops/i.test(button.textContent)).click());
      await page.waitForSelector(`[data-testid="benchtop-selection"][data-room="${room}"]`);
    };
    await openBench('Kitchen');
    const before = (await savedRecord()).cabinetry;
    const pantryBefore = before.locations.find(room => room.location === "Butler's Pantry");
    if (await page.$('[data-testid="benchtop-setup-confirm"]')) await page.$eval('[data-testid="benchtop-setup-confirm"]', button => button.click());
    await page.waitForSelector('[data-testid="benchtop-product"]');
    await page.select('[data-testid="benchtop-filter-brand"]', 'Stone Ambassador');
    await page.type('[data-testid="benchtop-search"]', 'Eclipse');
    await page.waitForSelector('[data-testid="benchtop-product"][data-product-name="Eclipse"]');
    await page.$eval('[data-testid="benchtop-product"][data-product-name="Eclipse"] [data-testid="benchtop-select"]', button => button.click());
    await page.waitForSelector('[data-testid="benchtop-summary"][data-product-name="Eclipse"]');
    await page.$eval('[data-testid="cabinetry-room-nav-butler-s-pantry"]', button => button.click());
    await openBench("Butler's Pantry");
    assert.equal(await page.$('[data-testid="benchtop-summary"][data-product-name="Eclipse"]'), null, 'Kitchen product must not leak into Pantry');
    await page.$eval('[data-testid="cabinetry-room-nav-kitchen"]', button => button.click());
    await openBench('Kitchen');
    await page.waitForSelector('[data-testid="benchtop-summary"][data-product-name="Eclipse"]');
    await page.reload({ waitUntil: 'domcontentloaded' }); await waitForApp();
    const after = (await savedRecord()).cabinetry;
    assert(after.locations.find(room => room.location === 'Kitchen').benchtopAreas.some(area => area.surface?.colourName === 'Eclipse'), 'single benchtop pick survives navigation and reload');
    assert.deepEqual(after.schedule, before.schedule, 'finish edits preserve cabinet schedule quantities');
    assert.deepEqual(after.locations.find(room => room.location === "Butler's Pantry").benchtopAreas, pantryBefore.benchtopAreas, 'Pantry surfaces and area measurements remain independent');
    return { selected: 'Stone Ambassador Eclipse', selectedOnce: true, independentRooms: ['Kitchen', "Butler's Pantry"], schedulePreserved: true };
  });

  // Owner brief 17 Nov 2026: Kitchen first and master, finishes copy, no copy notes, no client
  // measurements or Sharkfin arithmetic, duplicate bulkhead question gone, builder notes in the quote.
  await phase("cabinetryCorrections", async () => {
    const panelText = () => page.$eval('[data-testid="cabinetry-builder-schedule"], .cabinetryPanel', (e) => e.innerText).catch(() => "");
    const stage = async (label) => {
      await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
      await page.$eval('[data-testid="cabinetry-progress-menu"]', (menu, label) => [...menu.querySelectorAll("button")].find((b) => b.textContent.includes(label)).click(), label);
      await delay(1200);
    };
    // Copy provenance must not appear as line notes; the copied-items review (an explicit keep /
    // remove notice) is the only place a copy is named.
    const textWithoutReview = () => page.evaluate(() => { const clone = document.body.cloneNode(true); clone.querySelectorAll('[data-testid="cabinetry-copied-items"]').forEach((e) => e.remove()); return clone.innerText + " " + [...document.querySelectorAll("input")].map((i) => i.value).join(" "); });
    const numberInputs = () => page.$$eval(".cabinetryPanel input[type=number]", (inputs) => inputs.filter((i) => i.offsetParent).length);
    await page.evaluateOnNewDocument(() => localStorage.setItem("gr8.clientSelections.estimatorView", "false"));
    const before = (await savedRecord()).cabinetry;
    await openCabinetry();
    await page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons) => { const b = buttons.find((x) => /Kitchen/.test(x.innerText)); if (b && !b.className.includes("current")) b.click(); });
    await delay(1200);
    const order = await page.$$eval('[data-testid="cabinetry-room-nav"] ol li', (items) => items.map((li) => li.innerText.replace(/^\d+\s*/, "").split("\n")[0].trim()));
    assert.equal(order[0], "Kitchen", `Kitchen is the first cabinetry room (${order.join(" > ")})`);
    // 1, 3, 5: client view of the Kitchen schedule.
    await stage("Cabinet Schedule");
    assert.equal(await page.$('[data-testid="cabinetry-view-toggle-button"], [data-testid="cabinetry-builder-setup"]'), null, "no builder / client switch in Client Selections");
    const view = "client";
    assert.equal(await page.$('[data-testid="cabinetry-bulkhead-question"]'), null, "no duplicate bulkhead question");
    assert.equal(await page.$('img[src*="kitchen-bulkhead-reference"]'), null, "no kitchen bulkhead photograph");
    let text = await panelText();
    assert(!/Would you like bulkheads above/i.test(text), "no bulkhead question text");
    assert(!/copied from butler/i.test(await textWithoutReview()), "the Kitchen does not show 'Copied from Butler's Pantry' on its items");
    assert(await page.$('[data-testid="cabinetry-client-sharkfin"]'), "Sharkfin upgrade is a simple client choice");
    const sharkfinText = await page.$eval('[data-testid="cabinetry-client-sharkfin"]', (e) => e.innerText);
    assert(!/\d+\s*x\s*\d+\s*=|front count|Manual quantity|calculated from/i.test(sharkfinText), `no Sharkfin arithmetic (${sharkfinText.slice(0, 120)})`);
    assert.equal(await numberInputs(), 0, "no measurement or quantity input in the client cabinet schedule");
    // Benchtops: no length entry.
    await stage("Benchtops");
    await page.waitForSelector('[data-testid="benchtop-selection"]').catch(() => {});
    assert.equal(await page.$('[data-testid="benchtop-area-length"]'), null, "no benchtop length input");
    assert.equal(await numberInputs(), 0, "no number input on the client benchtop step");
    // Builder view of the schedule: bulkhead and Sharkfin carry no lengths or arithmetic.
    await openBuilderSetup("kitchen");
    await stage("Cabinet Schedule");
    text = await panelText();
    // 18 Nov 2026: the schedule shows the bulkhead type only; the measurement is handled in the Quotation Builder.
    assert(/MDF bulkhead — (300|450) mm/.test(text), "bulkhead shown by type (MDF bulkhead — 300 mm)");
    assert(!/BUILDER MEASUREMENT REQUIRED|LM measured by the builder/.test(text), "no bulkhead measurement wording in Client Selections");
    assert(!/enter the length of each run|Manual quantity|calculated from this room/i.test(text), "no bulkhead run entry or Sharkfin calculation in builder view either");
    assert(!/copied from/i.test(await textWithoutReview()), "no copy provenance notes on Kitchen lines");
    await openCabinetry();
    await openRoom("Kitchen");
    // 2: Apply Kitchen finishes to chosen rooms.
    await stage("Review & Confirm");
    await page.waitForSelector('[data-testid="cabinetry-apply-finishes-open"]');
    await page.$eval('[data-testid="cabinetry-apply-finishes-open"]', (b) => b.click());
    await page.waitForSelector('[data-testid="cabinetry-apply-colours-modal"]');
    const modal = await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e) => e.innerText);
    assert(/Apply Kitchen finishes to other rooms/.test(modal) && /Main Bathroom/.test(modal) && /Butler's Pantry/.test(modal), "Kitchen finishes can go to any cabinetry room, bathrooms included");
    for (const room of ["Butler's Pantry", "Main Bathroom"]) {
      await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e, room) => { const row = [...e.querySelectorAll(".cabinetrySelectionRow, label, button, li")].find((x) => x.innerText.trim().startsWith(room)); const target = row?.querySelector("input,button") || row; target.click(); }, room);
      await delay(300);
    }
    assert(await buttonWithText("Apply Kitchen finishes"), "apply button");
    let message = "";
    for (let i = 0; i < 30 && (!message || /^Saving/.test(message)); i++) { await delay(500); message = await page.$eval(".cabinetrySelectionMessage", (e) => e.innerText).catch(() => ""); }
    // Applied and saved (with what was left alone), or nothing applied because the rooms have their own.
    assert(/applied and saved[\s\S]*were not changed|^No finishes were applied/.test(message), `apply message (${message.slice(0, 300)})`);
    assert(await buttonWithText("Save Draft"), "Save Draft");
    await delay(5000);
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    const after = (await savedRecord()).cabinetry;
    const room = (selection, name) => selection.locations.find((l) => l.location === name);
    assert.deepEqual(after.schedule, before.schedule, "cabinet schedule, quantities and bulkheads unchanged by the finishes copy");
    assert.deepEqual(room(after, "Kitchen").areaSelections, room(before, "Kitchen").areaSelections, "the Kitchen is unchanged");
    const applied = ["Butler's Pantry", "Main Bathroom"].map((name) => [name, room(after, name)?.coloursAndFinishes?.kitchenFinishSource || "", (room(after, name)?.coloursAndFinishes?.kitchenFinishApplied || []).length]);
    assert(applied.some(([, source]) => source === "Kitchen") || applied.every(([, , n]) => n === 0), `finishes copy saved (${JSON.stringify(applied)})`);
    assert.deepEqual((room(after, "Main Bathroom").benchtopAreas || []).map((a) => a.lengthMm), (room(before, "Main Bathroom").benchtopAreas || []).map((a) => a.lengthMm), "vanity benchtop lengths untouched");
    // 6, 7: Quotation Builder shows the builder measurement / review notes.
    await page.goto(`${origin}/modules/estimate-builder?page=quotation&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForSelector('[data-testid="cabinetry-room-briefs"]', { timeout: 240000 });
    const briefs = await page.$eval('[data-testid="cabinetry-room-briefs"]', (e) => e.innerText);
    // Whatever the job still needs measured is named with room, item and unit (never a bare count).
    assert(/BUILDER MEASUREMENT REQUIRED: Kitchen · [^·]+ · (LM|EACH)/.test(briefs), "a Kitchen measurement still needed: BUILDER MEASUREMENT REQUIRED with room, item and unit");
    // The bulkhead type selected in Client Selections still reaches the Quotation Builder (on this job the
    // Kitchen run is already measured at 3.2 LM, so no measurement is outstanding for it).
    assert(/bulkhead/i.test(briefs), `the selected bulkhead reaches the Quotation Builder brief (${briefs.replace(/\s+/g, " ").slice(0, 600)})`);
    assert(/BUILDER REVIEW — KITCHEN · SHARKFIN HANDLE UPGRADE/i.test(briefs), "Sharkfin builder review note");
    const sectionNotes = await page.$eval('[data-quote-section="CABINETRY"] [data-testid="cabinetry-section-builder-notes"]', (e) => e.innerText).catch(() => "");
    return { order, view, applied, quoteNotes: (briefs.match(/BUILDER (MEASUREMENT REQUIRED|REVIEW)[^\n]*/g) || []).slice(0, 8), sectionNotes: sectionNotes ? sectionNotes.split("\n").length - 1 : "section collapsed" };
  });

  // Scenario A of "CORRECT THE CABINETRY WORKFLOW" (17 Nov 2026), run with BLANK_CABINETRY=1: a brand-new
  // job. Kitchen first (other rooms locked), complete and approve the Kitchen through the UI, apply its
  // finishes to chosen rooms (finishes only), complete and approve every other room, reload and reopen.
  await phase("newJob", async () => {
    assert.equal(process.env.BLANK_CABINETRY, "1", "run with BLANK_CABINETRY=1");
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    // 1. Kitchen first: landing notice, every other room locked, Butler's Pantry not complete.
    await openRequirement("interior", "cabinetry", "cabinetry");
    if (!(await page.$('[data-testid="cabinetry-room-landing"], [data-testid="cabinetry-room-nav"]'))) await page.$eval('[data-testid="guided-requirement-cabinetry"]', (card) => (card.querySelector("button") || card).click());
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
    assert(await page.$('[data-testid="cabinetry-kitchen-first"]'), "Kitchen-first notice on a new job");
    const cards = await page.$$eval("button.cabinetryRoomCard", (cs) => cs.map((c) => ({ name: c.querySelector("strong").innerText.trim(), locked: c.dataset.locked === "true", disabled: c.disabled, cls: c.className })));
    assert.deepEqual(cards.filter((c) => c.name !== "Kitchen" && !c.locked).map((c) => c.name), [], "every other room is locked");
    assert(!cards.find((c) => c.name === "Kitchen").locked, "Kitchen open");
    assert(!/complete/.test(cards.find((c) => c.name === "Butler's Pantry").cls), "Butler's Pantry has no completed specification");
    await page.$eval('[data-testid="cabinetry-room-butler-s-pantry"]', (b) => b.click());
    await delay(800);
    assert.equal(await page.$('[data-testid="cabinetry-room-nav"]'), null, "a locked Butler's Pantry card does not open");
    await page.$eval('[data-testid="cabinetry-room-kitchen"]', (b) => b.click());
    await page.waitForSelector('[data-testid="cabinetry-room-nav"]');
    const order = Object.keys(await navStatus());
    assert.equal(order[0], "Kitchen", `Kitchen is room 1 (${order.join(" > ")})`);
    await openRoom("Butler's Pantry");
    assert.equal(await currentRoom(), "Kitchen", "the Butler's Pantry room tab is locked too");
    assert(!/copied from/i.test(await page.$eval(".cabinetryPanel", (e) => e.innerText)), "no copy warnings on a new Kitchen");
    const initial = (await savedRecord())?.cabinetry || null;

    // 2. Complete and approve the Kitchen in the UI; the finishes offer opens straight away.
    await completeRoom("Kitchen");
    await approve("Kitchen");
    const afterKitchen = await navStatus();
    assert.equal(afterKitchen.Kitchen, "approved", "Kitchen shows Approved at once");
    assert.deepEqual(Object.entries(afterKitchen).filter(([, s]) => s === "locked").map(([n]) => n), [], "the other rooms open once the Kitchen is approved");
    await page.waitForSelector('[data-testid="cabinetry-apply-colours-modal"]', { timeout: 15000 });
    const offer = await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e) => e.innerText);
    assert(/Apply Kitchen finishes to other rooms/.test(offer), "Apply Kitchen finishes offered after the Kitchen is approved");
    const beforeApply = (await savedRecord()).cabinetry;
    // Individual room selection: Butler's Pantry, Laundry and Main Bathroom only.
    const chosen = ["Butler's Pantry", "Laundry", "Main Bathroom"];
    for (const room of chosen) {
      await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e, room) => { const row = [...e.querySelectorAll("label, .cabinetrySelectionRow, li")].find((x) => x.innerText.trim().startsWith(room)); const input = row?.querySelector("input[type=checkbox]"); if (input && !input.checked) input.click(); else if (!input) row?.click(); }, room);
      await delay(300);
    }
    assert(await clickText('[data-testid="cabinetry-apply-colours-modal"] button', /^Apply Kitchen finishes/), "Apply Kitchen finishes button");
    await delay(1200);
    await clickText("button", /^Save Draft$/);
    await delay(5000);
    const afterApply = (await savedRecord()).cabinetry;
    const room = (s, n) => s.locations.find((l) => l.location === n);
    const lines = (s, n) => JSON.stringify(s.schedule.filter((l) => l.location === n).map(({ componentId, cabinetTypeId, quantity, runs }) => ({ componentId, cabinetTypeId, quantity, runs })));
    for (const n of order) assert.equal(lines(afterApply, n), lines(beforeApply, n), `${n}: cabinets, quantities and bulkhead runs not copied`);
    for (const n of order) assert.deepEqual((room(afterApply, n).benchtopAreas || []).map((a) => [a.label, a.lengthMm]), (room(beforeApply, n).benchtopAreas || []).map((a) => [a.label, a.lengthMm]), `${n}: benchtop areas and measurements unchanged`);
    const kitchenColour = room(afterApply, "Kitchen").areaSelections.lowerDoorsDrawers?.colourName;
    assert.equal(room(afterApply, "Butler's Pantry").areaSelections.lowerDoorsDrawers?.colourName, kitchenColour, "Butler's Pantry took the Kitchen door colour");
    assert.equal(room(afterApply, "Butler's Pantry").coloursAndFinishes?.kitchenFinishSource, "Kitchen");
    for (const n of order.filter((n) => n !== "Kitchen" && !chosen.includes(n))) assert.equal(Object.values(room(afterApply, n).areaSelections || {}).filter((r) => r?.colourName).length, 0, `${n} was not ticked and received nothing`);
    assert.equal(JSON.stringify(room(afterApply, "Kitchen").areaSelections), JSON.stringify(room(beforeApply, "Kitchen").areaSelections), "the Kitchen is unchanged");
    assert.equal((await navStatus()).Kitchen, "approved", "applying finishes did not withdraw the Kitchen approval");

    // 3. Every other room, in order: complete what is left in the UI, approve, Approved at once.
    const log = [{ room: "Kitchen", result: "approved" }];
    for (const name of order.slice(1)) {
      await openRoom(name);
      assert.equal(await currentRoom(), name, `${name} opens`);
      await completeRoom(name);
      await approve(name);
      const status = await page.$('[data-testid="cabinetry-room-nav"]') ? await navStatus() : null;
      const saved = (await savedRecord()).cabinetry;
      const approvedNow = saved.locations.filter((l) => l.reviewApproval?.approvedAt).map((l) => l.location);
      assert(approvedNow.includes(name), `${name} approval saved`);
      if (status) for (const done of [...log.map((e) => e.room), name]) assert.equal(status[done], "approved", `${done} still Approved after approving ${name}`);
      log.push({ room: name, result: "approved", tookKitchenFinishes: chosen.includes(name) });
    }

    // 4. Save, reload and reopen: all approved, no reverse-copy warnings, no duplicate room identities.
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await openCabinetry();
    const status = await navStatus();
    for (const n of order) assert.equal(status[n], "approved", `${n} approved after reload`);
    const finalSaved = (await savedRecord()).cabinetry;
    const ids = finalSaved.locations.map((l) => l.projectRoomId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `distinct room identities (${ids.join(", ")})`);
    await openRoom("Kitchen"); await stageTo("Cabinet Schedule");
    assert.equal(await page.$('[data-testid="cabinetry-copied-items"]'), null, "no copied-items review on a new job");
    assert(!/copied from/i.test(await page.$eval(".cabinetryPanel", (e) => e.innerText)), "no reverse-copy text");
    if (initial) for (const n of order) assert.equal(lines(finalSaved, n), lines(initial, n), `${n} schedule as the builder set it`);
    assert.equal(finalSaved.audit.filter((a) => a.action === "copy_location_selections").length, 0, "no full-room copies happened");
    return { order, lockedAtStart: cards.filter((c) => c.locked).map((c) => c.name), kitchenColour, chosen, log, afterReload: status, ids };
  });

  // "COMPLETE BENCHTOP SELECTIONS" (17 Nov 2026), new job (BLANK_CABINETRY=1): browser checks 1 and 3-11.
  await phase("benchtops", async () => {
    assert.equal(process.env.BLANK_CABINETRY, "1", "run with BLANK_CABINETRY=1");
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    const { activeStoneBenchtopProducts } = await import("../lib/builders/stoneBenchtopWorkflow.js");
    const stones = activeStoneBenchtopProducts();
    const known = stones.find((p) => p.supplier === "Caesarstone" && JSON.stringify(p.thicknessOptions) === '["20mm"]');
    const unknown = stones.find((p) => p.supplier === "Stone Ambassador");
    const areaLabels = () => page.$$eval('[data-testid="benchtop-area"]', (rows) => rows.map((r) => r.dataset.area));
    const fab = (label, testid) => `[data-testid="benchtop-fabrication"][data-area="${label}"] [data-testid="${testid}"]`;
    const options = (label, testid) => page.$$eval(`${fab(label, testid)} option`, (os) => os.map((o) => `${o.value}|${o.textContent.trim()}`));
    const value = (label, testid) => page.$eval(fab(label, testid), (e) => e.value).catch(() => null);
    const choose = async (label, testid, v) => { await page.waitForSelector(fab(label, testid)); await page.select(fab(label, testid), String(v)); await delay(1200); };
    const confirmSetup = async () => { if (await page.$('[data-testid="benchtop-setup-confirm"]')) { await page.$eval('[data-testid="benchtop-setup-confirm"]', (b) => b.click()); await delay(1200); } };
    const selectStone = async (areaLabel, product) => {
      await page.$$eval('[data-testid="benchtop-target"]', (tabs, label) => tabs.find((t) => t.dataset.area === label)?.click(), areaLabel).catch(() => {});
      await delay(500);
      await page.$eval('[data-testid="benchtop-search"]', (e) => { e.focus(); e.select?.(); });
      await page.type('[data-testid="benchtop-search"]', product.colourName);
      await delay(800);
      const clicked = await page.$$eval('[data-testid="benchtop-product"]', (cards, { name, brand }) => { const card = cards.find((c) => c.dataset.productName === name && c.dataset.brand === brand); card?.querySelector('[data-testid="benchtop-select"]').click(); return Boolean(card); }, { name: product.colourName, brand: product.supplier });
      assert(clicked, `${product.supplier} ${product.colourName} card`);
      await delay(1500);
      await page.$eval('[data-testid="benchtop-search"]', (e) => { e.value = ""; });
    };
    const evidence = {};

    // 1. New Kitchen: its own areas only.
    await openRequirement("interior", "cabinetry", "cabinetry");
    if (!(await page.$('[data-testid="cabinetry-room-landing"], [data-testid="cabinetry-room-nav"]'))) await page.$eval('[data-testid="guided-requirement-cabinetry"]', (card) => (card.querySelector("button") || card).click());
    await page.waitForSelector('[data-testid="cabinetry-room-kitchen"]');
    await page.$eval('[data-testid="cabinetry-room-kitchen"]', (b) => b.click());
    await page.waitForSelector('[data-testid="cabinetry-room-nav"]');
    await stageTo("Benchtops");
    evidence.kitchenAreas = await areaLabels();
    assert(!evidence.kitchenAreas.some((l) => /butler/i.test(l)), `new Kitchen has no Butler's Pantry benchtop (${evidence.kitchenAreas})`);
    assert(evidence.kitchenAreas.includes("Main benchtop"), "Kitchen Main benchtop");
    assert.equal(await page.$('[data-testid="cabinetry-copied-items"]'), null, "no contamination review on a new job");

    // 3, 4. Kitchen main 40 mm, island 60 mm, independently.
    await confirmSetup();
    // This job's Kitchen has no island in its scope: the builder adds one (builder view), as on site.
    if (!evidence.kitchenAreas.some((l) => /island/i.test(l))) {
      await openBuilderSetup("kitchen");
      await stageTo("Benchtops");
      await page.$eval('[data-testid="benchtop-edit-dimensions"]', (b) => b.click()); await delay(800);
      await page.select('[data-testid="benchtop-add-area"]', "Island"); await delay(1200);
      await page.$eval('[data-testid="benchtop-edit-dimensions"]', (b) => b.click()); await delay(1000);
      await clickText("button", /^Save Draft$/); await delay(3000);
      await openRequirement("interior", "cabinetry", "cabinetry");
      if (!(await page.$('[data-testid="cabinetry-room-landing"], [data-testid="cabinetry-room-nav"]'))) await page.$eval('[data-testid="guided-requirement-cabinetry"]', (card) => (card.querySelector("button") || card).click());
      if (!(await page.$('[data-testid="cabinetry-room-nav"]'))) { await page.waitForSelector('[data-testid="cabinetry-room-kitchen"]'); await page.$eval('[data-testid="cabinetry-room-kitchen"]', (b) => b.click()); }
      await page.waitForSelector('[data-testid="cabinetry-room-nav"]');
      await openRoom("Kitchen");
      await stageTo("Benchtops");
      evidence.islandAddedByBuilder = true;
    }
    await selectStone("Main benchtop", known);
    const islandLabel = (await areaLabels()).find((l) => /island/i.test(l)) || "";
    assert(islandLabel, "Kitchen island benchtop");
    await choose("Main benchtop", "benchtop-thickness", 40);
    // The client chooses the finished thickness only; edge construction is the builder's (18 Nov 2026).
    assert.equal(await page.$(fab("Main benchtop", "benchtop-edge-construction")), null, "no edge-construction control in the client view");
    evidence.mainThicknessOptions = await options("Main benchtop", "benchtop-thickness");
    assert(!evidence.mainThicknessOptions.some((o) => /confirm/i.test(o)), `no builder wording on the thickness choices (${evidence.mainThicknessOptions})`);
    await clickText("button", /^Save Draft$/); await delay(3000);
    const mainFab = (await savedRecord()).cabinetry.locations.find((l) => l.location === "Kitchen").benchtopAreas.find((a) => a.label === "Main benchtop").fabrication;
    evidence.mainFabrication = mainFab;
    assert.equal(mainFab.edgeConstruction, "mitred", "40 mm on a 20 mm-only product saved as a mitred edge (no full 40 mm slab invented)");
    if (islandLabel) {
      await page.waitForSelector(fab(islandLabel, "benchtop-thickness"));
      await choose(islandLabel, "benchtop-thickness", 60);
      assert.equal(await value("Main benchtop", "benchtop-thickness"), "40", "Main stays 40 mm when the island is set to 60 mm");
      assert.equal(await value(islandLabel, "benchtop-thickness"), "60", "island 60 mm");
    }

    // Kitchen approved (Kitchen first), finishes applied to Laundry only.
    await completeRoom("Kitchen");
    await approve("Kitchen");
    await page.waitForSelector('[data-testid="cabinetry-apply-colours-modal"]', { timeout: 15000 });
    await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e) => { const row = [...e.querySelectorAll("label, .cabinetrySelectionRow, li")].find((x) => x.innerText.trim().startsWith("Laundry")); const input = row?.querySelector("input[type=checkbox]"); if (input && !input.checked) input.click(); });
    await delay(300);
    assert(await clickText('[data-testid="cabinetry-apply-colours-modal"] button', /^Apply Kitchen finishes/), "Apply Kitchen finishes");
    await delay(1200);
    await clickText("button", /^Save Draft$/); await delay(4000);

    // 5, 6, 7. Main Bathroom wall-hung vanity: 20 mm, 350 mm deep, semi-recessed basin, drop-front 100/150/200.
    await openRoom("Main Bathroom");
    await stageTo("Benchtops");
    const vanityAreas = await areaLabels();
    const wall = vanityAreas.find((l) => /wall/i.test(l));
    assert(wall, `Main Bathroom wall-hung vanity benchtop (${vanityAreas})`);
    await confirmSetup();
    // Thickness chosen at the Benchtop Areas step BEFORE the stone; it is kept when the stone is chosen.
    await choose(wall, "benchtop-thickness", 20);
    await selectStone(wall, known);
    assert.equal(await value(wall, "benchtop-thickness"), "20", "vanity 20 mm");
    evidence.depths = await options(wall, "benchtop-vanity-depth");
    assert(evidence.depths.some((o) => /^350\|350 mm \(narrow wall-hung\)/.test(o)), `350 mm depth offered (${evidence.depths})`);
    await choose(wall, "benchtop-vanity-depth", 350);
    evidence.basins = await options(wall, "benchtop-basin");
    assert(["Undermount", "Inset", "Semi-recessed", "Above-counter"].every((b) => evidence.basins.some((o) => o.startsWith(`${b}|`))), `basin choices (${evidence.basins})`);
    await choose(wall, "benchtop-basin", "Semi-recessed");
    evidence.dropFronts = await options(wall, "benchtop-drop-front");
    assert.deepEqual(evidence.dropFronts.map((o) => o.split("|")[0]), ["", "100", "150", "200"], "drop-front none / 100 / 150 / 200 mm");
    await choose(wall, "benchtop-drop-front", 150);
    // Fabricator checks are not shown to the client; they reach the Quotation Builder (checked in 10).
    assert.equal(await page.$(`[data-testid="benchtop-fabrication"][data-area="${wall}"] [data-testid="benchtop-fabrication-review"]`), null, "no fabricator review box in the client view");

    // Butler's Pantry: a product with no thickness data -> builder confirmation; 40 mm full slab chosen.
    await openRoom("Butler's Pantry");
    await stageTo("Benchtops");
    const bpAreas = await areaLabels();
    evidence.bpAreas = bpAreas;
    await confirmSetup();
    await selectStone(bpAreas[0], unknown);
    const bpThickness = await options(bpAreas[0], "benchtop-thickness");
    assert(bpThickness.some((o) => o === "40|40 mm"), `40 mm offered plainly to the client (${bpThickness})`);
    await choose(bpAreas[0], "benchtop-thickness", 40);
    await clickText("button", /^Save Draft$/);
    // A thickness choice followed by Save Draft must be in the saved job (no second change needed).
    let bpSaved = null;
    for (let i = 0; i < 20 && !bpSaved; i++) {
      await delay(500);
      const area = ((await savedRecord()).cabinetry.locations.find((l) => l.location === "Butler's Pantry").benchtopAreas || []).find((a) => a.label === bpAreas[0]);
      if (area?.fabrication?.thicknessMm === 40) bpSaved = { afterMs: (i + 1) * 500, fabrication: area.fabrication };
    }
    evidence.bpSavedAfterSaveDraft = bpSaved;
    assert(bpSaved, `Butler's Pantry 40 mm saved by Save Draft (screen shows ${await value(bpAreas[0], "benchtop-thickness")})`);
    const beforeCopy = (await savedRecord()).cabinetry;

    // 8. Kitchen finishes applied again, to Butler's Pantry and Main Bathroom: their thickness and fabrication stay.
    await openRoom("Kitchen");
    await stageTo("Review & Confirm");
    await page.$eval('[data-testid="cabinetry-apply-finishes-open"]', (b) => b.click());
    await page.waitForSelector('[data-testid="cabinetry-apply-colours-modal"]');
    for (const target of ["Butler's Pantry", "Main Bathroom"]) {
      await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e, target) => { const row = [...e.querySelectorAll("label, .cabinetrySelectionRow, li")].find((x) => x.innerText.trim().startsWith(target)); const input = row?.querySelector("input[type=checkbox]"); if (input && !input.checked) input.click(); }, target);
      await delay(300);
    }
    assert(await clickText('[data-testid="cabinetry-apply-colours-modal"] button', /^Apply Kitchen finishes/), "Apply Kitchen finishes again");
    await delay(1200);
    await clickText("button", /^Save Draft$/); await delay(5000);
    const afterCopy = (await savedRecord()).cabinetry;
    const roomOf = (s, n) => s.locations.find((l) => l.location === n);
    const fabs = (s, n) => (roomOf(s, n).benchtopAreas || []).map((a) => [a.label, a.fabrication || null, a.surface?.colourName || ""]);
    assert.deepEqual(fabs(afterCopy, "Butler's Pantry"), fabs(beforeCopy, "Butler's Pantry"), `Butler's Pantry thickness, construction and stone unchanged (before ${JSON.stringify(fabs(beforeCopy, "Butler's Pantry"))} after ${JSON.stringify(fabs(afterCopy, "Butler's Pantry"))})`);
    assert.deepEqual(fabs(afterCopy, "Main Bathroom"), fabs(beforeCopy, "Main Bathroom"), "Main Bathroom vanity fabrication unchanged");
    const laundry = roomOf(afterCopy, "Laundry");
    const laundryTop = (laundry.benchtopAreas || [])[0] || null;
    evidence.laundry = { benchtop: laundry.benchtop?.colourName || laundryTop?.surface?.colourName || "", thickness: laundryTop?.fabrication?.thicknessMm || laundry.benchtop?.thickness || "" };
    assert.equal(evidence.laundry.benchtop, known.colourName, "Laundry took the Kitchen stone");
    assert(!evidence.laundry.thickness, `Laundry did not take the Kitchen's 40 mm (${evidence.laundry.thickness})`);

    // 9. Save, reload, reopen: every choice is back on screen.
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await openCabinetry();
    await openRoom("Kitchen"); await stageTo("Benchtops");
    assert.equal(await value("Main benchtop", "benchtop-thickness"), "40", "Kitchen main 40 mm after reload");
    if (islandLabel) assert.equal(await value(islandLabel, "benchtop-thickness"), "60", "island 60 mm after reload");
    assert(!(await areaLabels()).some((l) => /butler/i.test(l)), "still no Butler's Pantry benchtop in the Kitchen");
    await openRoom("Main Bathroom"); await stageTo("Benchtops");
    evidence.vanityAfterReload = { thickness: await value(wall, "benchtop-thickness"), depth: await value(wall, "benchtop-vanity-depth"), basin: await value(wall, "benchtop-basin"), drop: await value(wall, "benchtop-drop-front") };
    assert.deepEqual(evidence.vanityAfterReload, { thickness: "20", depth: "350", basin: "Semi-recessed", drop: "150" });
    await openRoom("Butler's Pantry"); await stageTo("Benchtops");
    const bpFab = (await savedRecord()).cabinetry.locations.find((l) => l.location === "Butler's Pantry").benchtopAreas.find((a) => a.label === bpAreas[0]).fabrication;
    assert.deepEqual([await value(bpAreas[0], "benchtop-thickness"), bpFab.edgeConstruction], ["40", "full"], "Butler's Pantry 40 mm (full slab, builder to confirm) after reload");

    // 10. Quotation Builder receives the specifications and the builder actions.
    await page.goto(`${origin}/modules/estimate-builder?page=quotation&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForSelector('[data-testid="cabinetry-room-briefs"]', { timeout: 240000 });
    await delay(1500);
    const briefs = await page.$eval('[data-testid="cabinetry-room-briefs"]', (e) => e.innerText);
    const quoteText = await screenText();
    // The brief lists each selection as label / value (two lines in innerText).
    assert(/Main benchtop\s*\n?[^\n]*40 mm · Mitred \/ built-up edge from 20 mm slab/.test(briefs), `Kitchen main benchtop specification in the quotation brief: ${briefs.replace(/\s+/g, " ").slice(0, 1500)}`);
    if (islandLabel) assert(new RegExp(`${islandLabel}\\s*\\n?[^\\n]*60 mm · Mitred`).test(briefs), "island specification in the quotation brief");
    assert(/BUILDER MEASUREMENT REQUIRED: Kitchen · Main benchtop - mitred edge 40 mm · LM/.test(briefs), "mitred edge length is a builder measurement");
    assert(/Wall-hung vanity · 350 mm deep · Semi-recessed basin · 150 mm stone drop-front/.test(briefs), "vanity specification in the quotation brief");
    assert(/BUILDER REVIEW — MAIN BATHROOM[\s\S]*semi-recessed basin projects beyond the vanity front/.test(briefs), "fabricator review in the quotation");
    assert(/confirm .*made as 40 mm \(Full-thickness slab\) - the Product Library has no thickness data/i.test(briefs), "Butler's Pantry thickness needs builder confirmation");
    assert(/150 mm stone drop-front \(No approved quotation row for a stone drop-front/.test(quoteText), "drop-front sent for the builder to price (no invented rate)");
    assert(/Price the 150 mm stone drop-front for Main Bathroom/.test(quoteText), "the quotation tells the builder to price the drop-front with the fabricator");
    evidence.quote = (briefs.match(/(BUILDER (MEASUREMENT REQUIRED|REVIEW)[^\n]*|[^\n]*(mm · )[^\n]*)/g) || []).slice(0, 14);

    // 11. Client PDF: the schedule pages the PDF route prints (buildSelectionsSchedule ->
    // renderSelectionsSchedulePagesHtml, as lib/builders/finalInclusionsSchedule.js), built from the job
    // exactly as this browser saved it and printed to PDF by headless Chrome. The server route itself is
    // not called: it would reach the live Supabase, which this isolated run never touches.
    const savedBook = await page.evaluate(async (projectId) => {
      for (const { name } of await indexedDB.databases()) {
        if (!name.includes("estimate-builder-template-db")) continue;
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        try {
          if (!db.objectStoreNames.contains("jobs")) continue;
          const all = await new Promise((resolve, reject) => { const r = db.transaction("jobs", "readonly").objectStore("jobs").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
          const latest = all.filter((r) => r.workbook?.jobId === projectId || r.workbook?.projectId === projectId).sort((a, b) => String(b.savedAt || b.workbook?.savedAt).localeCompare(String(a.savedAt || a.workbook?.savedAt)))[0];
          if (latest) return latest.workbook.clientSelectionsBook;
        } finally { db.close(); }
      }
      return null;
    }, projectId);
    assert(savedBook, "saved Client Selections book");
    const { buildSelectionsSchedule } = await import("../lib/builders/selectionsScheduleDocument.js");
    const { renderSelectionsSchedulePagesHtml, selectionsScheduleCss } = await import("../lib/builders/selectionsScheduleHtml.js");
    const scheduleDoc = buildSelectionsSchedule(savedBook);
    const pdfPage = await browser.newPage();
    await pdfPage.setRequestInterception(true);
    pdfPage.on("request", (request) => (request.url().startsWith("data:") || request.url() === "about:blank" ? request.continue() : request.respond({ status: 204, body: "" })));
    await pdfPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${selectionsScheduleCss}</style></head><body>${renderSelectionsSchedulePagesHtml(scheduleDoc.pages, { builderName: "Isolated test", summary: true })}</body></html>`, { waitUntil: "domcontentloaded" });
    const pdfPath = path.join(out, "client-schedule-benchtops.pdf");
    await pdfPage.pdf({ path: pdfPath, format: "A4", printBackground: true });
    const schedule = await pdfPage.evaluate(() => document.body.innerText);
    await pdfPage.close();
    const benchtopLines = schedule.split("\n").map((l) => l.trim()).filter((l) => /benchtop:/i.test(l));
    evidence.schedule = { pdf: path.basename(pdfPath), pdfBytes: fs.statSync(pdfPath).size, benchtopLines: benchtopLines.slice(0, 8) };
    // 18 Nov 2026: the client PDF shows the finished thickness only; the construction stays in the quotation.
    assert(!/Mitred|built-up edge|Full-thickness slab/i.test(benchtopLines.join(" ")), `client PDF has no construction wording (${benchtopLines.join(" || ").slice(0, 400)})`);
    assert(benchtopLines.some((l) => /Main benchtop: .*40 mm/.test(l)), `client PDF shows the Kitchen main benchtop specification (${schedule.split("\n").filter((l) => /benchtop/i.test(l)).slice(0, 8).join(" || ").slice(0, 1200)})`);
    if (islandLabel) assert(benchtopLines.some((l) => new RegExp(`${islandLabel}: .*60 mm`).test(l)), "client PDF shows the island at 60 mm");
    assert(benchtopLines.some((l) => /20 mm · Wall-hung vanity · 350 mm deep · Semi-recessed basin · 150 mm stone drop-front/.test(l)), "client PDF shows the vanity specification");
    assert(!benchtopLines.some((l) => /\d+(\.\d+)?\s?(lm|LM)\b|\blength\b|mitred edge length|MEASUREMENT REQUIRED|BUILDER REVIEW/i.test(l)), "no builder lengths or builder-only notes on the client PDF");
    return evidence;
  });

  // Existing job (New Job 03/09 copy): the Kitchen benchtop named after Butler's Pantry, reviewed from the
  // Benchtops step. Renamed to the Kitchen's own, surface kept, Butler's Pantry untouched (browser check 2).
  await phase("benchtopContamination", async () => {
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    await openCabinetry();
    await clickText("button", /^Save Draft$/); await delay(5000);
    const before = (await savedRecord()).cabinetry;
    await openRoom("Kitchen");
    await stageTo("Benchtops");
    await page.waitForSelector('[data-testid="cabinetry-copied-items"]', { timeout: 30000 });
    const listed = await page.$eval('[data-testid="cabinetry-copied-items"]', (e) => e.innerText);
    assert(/Benchtop area named "Butler's Pantry benchtop" - becomes "Main benchtop", keeping its surface/.test(listed), listed.slice(0, 300));
    const labelsBefore = await page.$$eval('[data-testid="benchtop-area"]', (rows) => rows.map((r) => r.dataset.area));
    await page.$eval('[data-testid="cabinetry-copied-items-remove"]', (b) => b.click());
    await delay(5000);
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await openCabinetry(); await openRoom("Kitchen"); await stageTo("Benchtops");
    const labelsAfter = await page.$$eval('[data-testid="benchtop-area"]', (rows) => rows.map((r) => r.dataset.area));
    assert(!labelsAfter.some((l) => /butler/i.test(l)), `Kitchen shows only its own benchtops (${labelsAfter})`);
    assert.equal(await page.$('[data-testid="cabinetry-copied-items"]'), null, "the review does not come back");
    const after = (await savedRecord()).cabinetry;
    const roomOf = (s, n) => s.locations.find((l) => l.location === n);
    const kBefore = roomOf(before, "Kitchen").benchtopAreas.find((a) => a.id === "benchtop-main");
    const kAfter = roomOf(after, "Kitchen").benchtopAreas.find((a) => a.id === "benchtop-main");
    assert.equal(kAfter.label, "Main benchtop");
    assert.equal(kAfter.surface?.colourName, kBefore.surface?.colourName, "the Kitchen keeps its chosen stone");
    assert.equal(JSON.stringify(roomOf(after, "Butler's Pantry").benchtopAreas), JSON.stringify(roomOf(before, "Butler's Pantry").benchtopAreas), "Butler's Pantry benchtops unchanged");
    return { labelsBefore, labelsAfter, kitchenStone: kAfter.surface?.colourName, listed: listed.split("\n").slice(0, 10) };
  });

  // Items a full room copy left in the Kitchen are listed for keep / remove (live job: five Butler's
  // Pantry lines and Butler's Pantry's benchtop area). Remove, reload: gone from the Kitchen only.
  await phase("copiedItems", async () => {
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    await openCabinetry();
    // Scenario B: this runs first on the job copy, so save once to have a stored "before".
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.offsetParent && b.textContent.trim() === "Save Draft")?.click());
    await delay(5000);
    const before = (await savedRecord()).cabinetry;
    await page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons) => { const b = buttons.find((x) => /^\s*\d*\s*Kitchen/.test(x.innerText)); if (b && !b.className.includes("current")) b.click(); });
    await delay(1200);
    await page.$eval('[data-testid="cabinetry-progress-menu"]', (menu) => [...menu.querySelectorAll("button")].find((b) => b.textContent.includes("Cabinet Schedule")).click());
    await page.waitForSelector('[data-testid="cabinetry-copied-items"]', { timeout: 30000 });
    const listed = await page.$eval('[data-testid="cabinetry-copied-items"]', (e) => e.innerText);
    assert(/Kitchen contains items copied from Butler's Pantry/.test(listed), listed.slice(0, 200));
    await page.$eval('[data-testid="cabinetry-copied-items-remove"]', (b) => b.click());
    await delay(5000);
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    const after = (await savedRecord()).cabinetry;
    const copiedLines = (selection) => selection.schedule.filter((l) => l.location === "Kitchen" && /copied from butler/i.test(l.notes || ""));
    assert(copiedLines(before).length > 0, "the job copy had copied lines in the Kitchen");
    assert.equal(copiedLines(after).length, 0, "the copied Butler's Pantry lines left the Kitchen");
    assert.deepEqual(after.schedule.filter((l) => l.location === "Butler's Pantry"), before.schedule.filter((l) => l.location === "Butler's Pantry"), "Butler's Pantry unchanged");
    assert.equal(after.schedule.filter((l) => l.location === "Kitchen").length, before.schedule.filter((l) => l.location === "Kitchen").length - copiedLines(before).length, "the Kitchen's own lines are kept");
    const room = (selection, name) => selection.locations.find((l) => l.location === name);
    const finishes = (l) => JSON.stringify({ a: l.areaSelections, h: l.handles, b: l.benchtopAreas, bh: l.bulkheadFinishMode, k: l.kickPanelFinishMode, id: l.projectRoomId, approval: l.reviewApproval });
    assert.equal(finishes(room(after, "Butler's Pantry")), finishes(room(before, "Butler's Pantry")), "Butler's Pantry finishes, benchtops, identity and approval unchanged");
    assert(!(room(after, "Kitchen").benchtopAreas || []).some((a) => /butler/i.test(a.label || "")), "no Butler's Pantry benchtop left in the Kitchen");
    const ids = after.locations.map((l) => l.projectRoomId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `distinct room identities (${ids.join(", ")})`);
    await openCabinetry();
    assert.equal(await page.$('[data-testid="cabinetry-copied-items"]'), null, "the review does not reappear after reload");
    assert(!/copied from/i.test(await page.$eval(".cabinetryPanel", (e) => e.innerText)), "no copy warnings left in the Kitchen");
    const lockedNav = await page.$$eval('[data-testid="cabinetry-room-nav"] ol li button[data-locked="true"]', (bs) => bs.length);
    assert.equal(lockedNav, 0, "an existing job is not locked behind the Kitchen while it is re-approved");
    return { listed: listed.split("\n").slice(0, 9), removedLines: copiedLines(before).length, kitchenLinesAfter: after.schedule.filter((l) => l.location === "Kitchen").map((l) => l.unitType) };
  });

  // 17 Nov 2026 defect: "Butler's Pantry cabinetry approved and saved" was shown while the room stayed
  // "Ready to approve". Every room, in order: approve, Approved in the navigation at once, still Approved
  // after leaving and returning and after a reload. A room with missing requirements must be refused.
  await phase("approvalSequence", async () => {
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    // The room navigation inside a room; the room overview cards once every room is approved.
    const navStatus = async () => (await page.$('[data-testid="cabinetry-room-nav"]'))
      ? page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons) => Object.fromEntries(buttons.map((b) => [b.innerText.replace(/^\d+\s*/, "").split("\n")[0].trim(), b.className.includes("approved") ? "approved" : b.className.includes("complete") ? "complete" : "in_progress"])))
      : page.$$eval('button.cabinetryRoomCard', (cards) => Object.fromEntries(cards.map((c) => [c.querySelector("strong")?.innerText.trim() || "", c.querySelector("span")?.innerText.trim() === "Approved" ? "approved" : c.className.includes("complete") ? "complete" : "in_progress"])));
    const openRoom = async (name) => {
      await page.$$eval('[data-testid="cabinetry-room-nav"] ol li button', (buttons, name) => { const b = buttons.find((x) => x.innerText.replace(/^\d+\s*/, "").split("\n")[0].trim() === name); if (b && !b.className.includes("current")) b.click(); }, name);
      await delay(1500);
    };
    const toReview = async () => {
      await page.$eval('[data-testid="cabinetry-progress-menu"]', (menu) => [...menu.querySelectorAll("button")].find((b) => b.textContent.includes("Review & Confirm")).click());
      await delay(1500);
    };
    await openCabinetry();
    const order = Object.keys(await navStatus());
    const log = [];
    for (const name of order) {
      await openRoom(name);
      const before = (await navStatus())[name];
      if (before === "approved") { log.push({ room: name, result: "already approved" }); continue; }
      await toReview();
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.offsetParent && !x.disabled && /^Confirm & Approve/.test(x.textContent.trim())); if (b) b.click(); return Boolean(b); });
      assert(clicked, `${name}: Confirm & Approve button`);
      await delay(6000);
      const notice = await page.$eval('[data-testid="cabinetry-room-notice"]', (e) => e.innerText).catch(() => "");
      const message = await page.$eval(".cabinetrySelectionMessage", (e) => e.innerText).catch(() => "");
      const status = await navStatus();
      const claimedSuccess = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} cabinetry approved and saved`).test(notice);
      // The defect: success reported while the room is not Approved.
      assert(!(claimedSuccess && status[name] !== "approved"), `${name}: success was reported but the navigation shows ${status[name]}`);
      if (status[name] !== "approved") {
        await page.screenshot({ path: path.join(out, `refused-${name.replace(/\W+/g, "-")}.png`), fullPage: false }).catch(() => {});
        const screen = await page.evaluate(() => ({ alerts: [...document.querySelectorAll('[role=alert],[role=status],.cabinetrySelectionMessage')].filter((e) => e.offsetParent).map((e) => e.innerText.slice(0, 200)), stage: document.querySelector(".cabinetryStepMenu .active")?.innerText, buttons: [...document.querySelectorAll("button")].filter((b) => b.offsetParent && /Approve|Confirm/.test(b.textContent)).map((b) => `${b.textContent.trim()}${b.disabled ? " (disabled)" : ""}`) }));
        log.push({ room: name, result: "refused", message: message.slice(0, 160), screen }); assert(!claimedSuccess, `${name}: refused without a success notice`); continue; }
      log.push({ room: name, result: "approved", notice: notice.slice(0, 120) });
      // Every room approved so far stays approved.
      for (const done of log.filter((entry) => /approved/.test(entry.result))) assert.equal(status[done.room], "approved", `${done.room} still approved after approving ${name}`);
    }
    const approved = log.filter((entry) => /approved/.test(entry.result)).map((entry) => entry.room);
    console.log("approval log", JSON.stringify(log));
    // Leave and come back (approving the last room returns to the overview), then reload and reopen.
    if (!(await page.$('[data-testid="cabinetry-room-nav"]'))) {
      await page.$eval('[data-testid="cabinetry-room-kitchen"]', (b) => b.click());
      await page.waitForSelector('[data-testid="cabinetry-room-nav"]');
    }
    await openRoom(order[0]); await openRoom(approved.at(-1) || order[0]);
    let status = await navStatus();
    for (const name of approved) assert.equal(status[name], "approved", `${name} approved after returning to it`);
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await openCabinetry();
    status = await navStatus();
    for (const name of approved) assert.equal(status[name], "approved", `${name} approved after reload`);
    const saved = (await savedRecord()).cabinetry;
    const ids = saved.locations.map((l) => l.projectRoomId).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `saved rooms have distinct identities (${ids.join(", ")})`);
    assert(approved.includes("Butler's Pantry"), "Butler's Pantry was approved (the reported defect)");
    // A room is refused only with its missing requirements named (e.g. a stone never chosen); every
    // other room is approved.
    const refused = log.filter((entry) => entry.result === "refused");
    for (const entry of refused) assert((entry.screen?.alerts || []).some((a) => /cannot be completed yet[\s\S]*Still required/.test(a)), `${entry.room}: refused with its missing requirements named`);
    assert.deepEqual(approved, order.filter((name) => !refused.some((entry) => entry.room === name)), "every cabinetry room with its requirements met is approved");
    return { order, log, afterReload: status };
  });

  // screens: every cabinetry room x every step in the client view, screenshotted, with no builder
  // measurement / quotation / pricing wording, no LM totals, thickness only at the benchtop areas
  // (18 Nov 2026 "FINAL CABINETRY UI CLEANUP"). SCREENS_TAG names the screenshot folder.
  await phase("screens", async () => {
    const dir = path.join(out, `screens-${process.env.SCREENS_TAG || "run"}`);
    fs.mkdirSync(dir, { recursive: true });
    const BANNED = [
      [/BUILDER MEASUREMENT REQUIRED|measurement required/i, "builder measurement warning"],
      [/\b\d+(\.\d+)?\s?(lm|LM)\b|Total\s+0\.00|\bLM\b/, "LM figure"],
      [/Quoted on|quotation rate|quotation range|quotation classification|Builder Review Required|price status|not priced|price group/i, "quotation / pricing wording"],
      [/stone fabricator|Builder \/ stone|builder will confirm the (measurements|price)|measured by (your|the) builder|builder confirms the number/i, "builder verification wording"],
      [/colour not yet selected|Awaiting (wall|ceiling) colour/i, "paint warning"],
      [/Switch to client view|Builder: edit quantities|Builder \/ estimator view|Builder cabinetry setup/i, "builder / client switch"],
      [/Edge construction|Full-thickness slab|\bMitred\b|built-up edge|builder to confirm|confirm with (the )?(fabricator|supplier)|supplier thickness|slab thickness/i, "fabrication / supplier technical wording"],
      [/has no island cabinets|copied into [^.]* from the Kitchen colours/i, "misleading island warning"],
    ];
    await openCabinetry();
    const rooms = Object.keys(await navStatus());
    const stages = await page.$$eval('[data-testid="cabinetry-progress-menu"] button', (bs) => bs.map((b) => b.innerText.replace(/^\d+\.?\s*/, "").split("\n")[0].trim()).filter(Boolean));
    const findings = [];
    const headings = {};
    for (const room of rooms) {
      await openRoom(room);
      for (const stage of stages) {
        await stageTo(stage);
        if (stage === "Benchtops" && (await page.$('[data-testid="benchtop-setup-confirm"]'))) { await page.$eval('[data-testid="benchtop-setup-confirm"]', (b) => b.click()); await delay(1200); }
        const info = await page.evaluate(() => {
          const root = document.querySelector(".cabinetryPanel") || document.body;
          const size = (sel) => { const e = [...root.querySelectorAll(sel)].find((x) => x.offsetParent && x.innerText.trim()); if (!e) return null; const s = getComputedStyle(e); return `${s.fontSize}/${s.fontWeight}`; };
          return {
            text: root.innerText,
            h2: size("h2"), h3: size("h3"), h4: size("h4"),
            builderControls: root.querySelectorAll('[data-testid="cabinetry-view-toggle-button"], [data-testid="benchtop-edge-construction"], [data-testid="benchtop-fabrication-review"], [data-testid="benchtop-edit-dimensions"], [data-testid="cabinetry-builder-confirm-item"]').length,
            cardThickness: root.querySelectorAll('[data-testid="benchtop-summary"] [data-testid="benchtop-thickness"], [data-testid="benchtop-product"] [data-testid="benchtop-thickness"]').length,
            areaThickness: root.querySelectorAll('[data-testid="benchtop-area"] [data-testid="benchtop-thickness"], [data-testid="benchtop-area"] [data-testid="benchtop-thickness-na"]').length,
            stageHeading: root.querySelector('[data-testid="cabinetry-stage-heading"] h2')?.innerText.trim() || "",
          };
        });
        const file = `${room.replace(/\W+/g, "-")}--${stage.replace(/\W+/g, "-")}.png`;
        const shot = await page.$(".cabinetryPanel");
        await (shot ? shot.screenshot({ path: path.join(dir, file) }) : page.screenshot({ path: path.join(dir, file), fullPage: true })).catch(() => {});
        if (process.env.SCREENS_TAG !== "before") {
          if (info.stageHeading !== stage) findings.push(`${room} / ${stage}: step heading reads "${info.stageHeading}"`);
          if (stage === "Benchtops" && !/no vanity in its cabinet schedule/i.test(info.text) && !info.areaThickness) findings.push(`${room} / Benchtops: no thickness control at the benchtop areas`);
        }
        for (const [re, label] of BANNED) {
          const m = info.text.match(new RegExp(`.{0,60}(${re.source}).{0,40}`, re.flags.replace("g", "")));
          if (m) findings.push(`${room} / ${stage}: ${label} - "${m[0].replace(/\s+/g, " ").trim()}"`);
        }
        if (info.builderControls) findings.push(`${room} / ${stage}: ${info.builderControls} builder-only control(s) on a client screen`);
        if (info.cardThickness) findings.push(`${room} / ${stage}: ${info.cardThickness} thickness control(s) on product cards`);
        headings[`${room} / ${stage}`] = { h2: info.h2, h3: info.h3, h4: info.h4, areaThickness: info.areaThickness };
      }
    }
    fs.writeFileSync(path.join(dir, "findings.json"), JSON.stringify({ rooms, stages, findings, headings }, null, 2));
    assert(!findings.length, `${findings.length} finding(s): ${findings.slice(0, 12).join(" | ")}`);
    return { rooms, stages, screenshots: rooms.length * stages.length, dir: path.relative(process.cwd(), dir) };
  });

  // defects1118: "CORRECT THE REMAINING CABINETRY DEFECTS" (18 Nov 2026) on a copy of the real job.
  await phase("defects1118", async () => {
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    const ev = {};
    const room = (selection, name) => selection.locations.find((l) => l.location === name);
    const before = await savedRecord();
    const cabRows = (record) => record.quoteRows.filter((r) => r.section === "CABINETRY" && Number(r.quantity) > 0).map((r) => `${r.importKey || r.id}=${r.quantity}`).sort();
    await openCabinetry();
    // 4. No builder / client switch.
    assert.equal(await page.$('[data-testid="cabinetry-view-toggle-button"], [data-testid="cabinetry-builder-setup"]'), null, "no builder / client switch");
    assert(!/Switch to client view|Builder: edit quantities/.test(await screenText()), "no switch wording");
    // 1-3. Kitchen island: no misleading warning, island benchtop intact.
    await openRoom("Kitchen");
    await stageTo("Cabinet Schedule");
    assert.equal(await page.$('[data-testid="cabinetry-copied-island"]'), null, "no 'island bench back was copied' warning in the Kitchen");
    await stageTo("Benchtops");
    ev.kitchenAreas = await page.$$eval('[data-testid="benchtop-area"]', (els) => els.map((e) => e.querySelector("h4")?.innerText.trim() || e.dataset.area));
    assert(ev.kitchenAreas.some((l) => /island/i.test(l)), `Kitchen island benchtop intact (${ev.kitchenAreas})`);
    // 5-6. Main Bathroom stone choices without technical messages.
    await openRoom("Main Bathroom");
    await stageTo("Benchtops");
    const mb = await page.evaluate(() => { const root = document.querySelector(".cabinetryPanel"); return { text: root.innerText, controls: [...root.querySelectorAll('[data-testid="benchtop-area"] select')].map((s) => `${s.dataset.testid || s.getAttribute("aria-label")}=${[...s.options].map((o) => o.textContent.trim()).join("/")}`), technical: root.querySelectorAll('[data-testid="benchtop-edge-construction"], [data-testid="benchtop-fabrication-review"], .bts-note.warn').length }; });
    ev.mainBathroomControls = mb.controls;
    assert.equal(mb.technical, 0, "no edge construction control or orange fabricator warning on the Main Bathroom vanity");
    assert(!/fabricator|Full-thickness|\bMitred\b|built-up edge|supplier/i.test(mb.text), `no technical wording (${(mb.text.match(/.{0,50}(fabricator|Full-thickness|Mitred|built-up edge|supplier).{0,40}/i) || [""])[0]})`);
    for (const re of [/20 mm/, /40 mm/, /60 mm/, /Semi-recessed|Undermount/, /150 mm/]) assert(mb.controls.join(" ").match(re), `Main Bathroom offers ${re} (${mb.controls.join(" | ")})`);
    // 7. Ensuite after the wall -> floor change: only the stone it never had is missing; no self-matching shortcut.
    await openRoom("Ensuite");
    ev.ensuiteMissingBefore = (await missing()).replace(/\s+/g, " ").trim();
    assert(/benchtop/i.test(ev.ensuiteMissingBefore) && !/colour|handle/i.test(ev.ensuiteMissingBefore), `Ensuite needs only its vanity stone (${ev.ensuiteMissingBefore})`);
    await stageTo("Colours & Finishes");
    ev.ensuiteColoursBefore = await page.$eval('[data-testid="cabinetry-area-colour-summary"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => "");
    assert(!/Match floor vanity/.test(await page.$eval('[data-testid="cabinetry-area-colour-summary"]', (e) => [...e.querySelectorAll("button")].map((b) => b.textContent).join("|")).catch(() => "")), "the floor vanity is never offered 'Match floor vanity' for itself");
    // 8. Main Bathroom finishes -> Ensuite.
    await openRoom("Main Bathroom");
    await stageTo("Review & Confirm");
    await page.waitForSelector('[data-testid="cabinetry-apply-finishes-open"]');
    await page.$eval('[data-testid="cabinetry-apply-finishes-open"]', (b) => b.click());
    await page.waitForSelector('[data-testid="cabinetry-apply-colours-modal"]');
    await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e) => { const row = [...e.querySelectorAll(".cabinetrySelectionRow")].find((x) => x.innerText.trim().startsWith("Ensuite")); const box = row?.querySelector("input[type=checkbox]"); if (box && !box.checked) box.click(); });
    await delay(800);
    ev.modal = await page.$eval('[data-testid="cabinetry-apply-colours-modal"]', (e) => e.innerText.replace(/\s+/g, " "));
    assert(/Kitchen/.test(ev.modal) === false, `the Kitchen is not offered as a target (${ev.modal.slice(0, 200)})`);
    if (await page.$('[data-testid="cabinetry-apply-replace"] input')) { ev.replaceOffered = await page.$eval('[data-testid="cabinetry-apply-replace"]', (e) => e.innerText.replace(/\s+/g, " ")); await page.$eval('[data-testid="cabinetry-apply-replace"] input', (i) => { if (!i.checked) i.click(); }); await delay(400); }
    assert(await buttonWithText("Apply Main Bathroom finishes"), "Apply Main Bathroom finishes");
    let message = "";
    for (let i = 0; i < 40 && (!message || /^Saving/.test(message)); i++) { await delay(500); message = await page.$eval(".cabinetrySelectionMessage", (e) => e.innerText).catch(() => ""); }
    ev.copyMessage = message;
    assert(/Main Bathroom finishes applied and saved for Ensuite/.test(message), `copy reported as applied and saved (${message.slice(0, 300)})`);
    // 9. Ensuite approves.
    await openRoom("Ensuite");
    ev.ensuiteMissingAfter = (await missing()).replace(/\s+/g, " ").trim();
    assert(!ev.ensuiteMissingAfter, `Ensuite complete after the copy (${ev.ensuiteMissingAfter})`);
    await approve("Ensuite");
    // The approval is saved before the room shows Approved ("Saving approval..."): wait for it.
    const approvalStarted = Date.now();
    for (let i = 0; i < 90 && (await navStatus()).Ensuite !== "approved"; i++) await delay(1000);
    ev.approvalSeconds = Math.round((Date.now() - approvalStarted) / 1000) + 6;
    ev.approvalButton = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent && /approv/i.test(b.textContent)).map((b) => b.textContent.trim()));
    ev.navAfterApprove = await navStatus();
    assert.equal(ev.navAfterApprove.Ensuite, "approved", `Ensuite approved (${JSON.stringify(ev.navAfterApprove)})`);
    await page.screenshot({ path: path.join(out, "defects1118-ensuite-approved.png"), fullPage: false }).catch(() => {});
    // All six rooms: Powder Room and Laundry are approved too, so every room's approval must survive the reload.
    for (const name of ["Powder Room", "Laundry"]) {
      await openRoom(name);
      ev[`missing ${name}`] = (await missing()).replace(/\s+/g, " ").trim();
      assert(!ev[`missing ${name}`], `${name} complete (${ev[`missing ${name}`]})`);
      await approve(name);
      // After the last room is approved the app returns to the cabinetry overview (room cards).
      const anyStatus = async () => (await page.$('[data-testid="cabinetry-room-nav"]')) ? navStatus()
        : page.$$eval("button.cabinetryRoomCard", (cards) => Object.fromEntries(cards.map((c) => [c.querySelector("strong")?.innerText.trim() || "", /Approved/.test(c.innerText) ? "approved" : "other"])));
      for (let i = 0; i < 90 && (await anyStatus())[name] !== "approved"; i++) await delay(1000);
      ev[`status ${name}`] = await anyStatus();
      assert.equal(ev[`status ${name}`][name], "approved", `${name} approved (${JSON.stringify(ev[`status ${name}`])})`);
    }
    if (!(await clickText("button", /^Save Draft$/))) await clickText("button", /^Save Progress$/);
    await delay(4000);
    // 10. Save, reload and reopen.
    await page.reload({ waitUntil: "domcontentloaded" }); await waitForApp();
    await openCabinetry();
    ev.navAfterReload = await navStatus();
    for (const name of ["Kitchen", "Butler's Pantry", "Main Bathroom", "Ensuite", "Powder Room", "Laundry"]) assert.equal(ev.navAfterReload[name], "approved", `${name} approved after reload (${JSON.stringify(ev.navAfterReload)})`);
    for (const name of ["Kitchen", "Butler's Pantry", "Main Bathroom", "Ensuite", "Powder Room", "Laundry"]) {
      await openRoom(name); await stageTo("Review & Confirm");
      const shot = await page.$(".cabinetryPanel");
      await (shot || page).screenshot({ path: path.join(out, `defects1118-review-${name.replace(/\W+/g, "-")}.png`) }).catch(() => {});
    }
    const after = await savedRecord();
    const e = room(after.cabinetry, "Ensuite"), m = room(after.cabinetry, "Main Bathroom");
    ev.ensuiteSaved = { doors: e.areaSelections?.floorVanityDoors?.colourName, drawers: e.areaSelections?.floorVanityDrawers?.colourName, material: e.doorMaterialGroup, handle: e.bathroomHandles?.floorMountedVanity?.productName, benchtops: (e.benchtopAreas || []).map((a) => ({ id: a.id, stone: a.surface?.colourName, thickness: a.fabrication?.thicknessMm, depth: a.fabrication?.vanityDepthMm, basin: a.fabrication?.basinType, lengthMm: a.lengthMm })) };
    assert.equal(ev.ensuiteSaved.doors, m.areaSelections.wallVanityDoors.colourName, "Ensuite vanity doors carry the Main Bathroom colour");
    assert.equal(ev.ensuiteSaved.handle, m.bathroomHandles.wallMountedVanity.productName, "Ensuite handle = the Main Bathroom's actual (wall-hung) vanity handle");
    assert(/Door material \(Premium laminate to Standard colourboard\)/.test(ev.copyMessage), "the material change is named in the copy message");
    assert(/Door material \(Premium laminate\)/.test(ev.replaceOffered || ""), "Replace names the material it would change");
    assert.equal(ev.ensuiteSaved.benchtops.length, 1, "one Ensuite vanity benchtop");
    assert.equal(ev.ensuiteSaved.benchtops[0].stone, (m.benchtopAreas || []).find((a) => a.surface)?.surface?.colourName, "Ensuite stone = Main Bathroom stone");
    assert.deepEqual([ev.ensuiteSaved.benchtops[0].thickness, ev.ensuiteSaved.benchtops[0].basin, ev.ensuiteSaved.benchtops[0].lengthMm], [20, "Above-counter", 3000], "Ensuite thickness, basin and size are its own");
    assert.deepEqual(after.cabinetry.schedule.map((l) => `${l.location}|${l.cabinetTypeId}|${l.quantity}`).sort(), before.cabinetry.schedule.map((l) => `${l.location}|${l.cabinetTypeId}|${l.quantity}`).sort(), "no cabinet, vanity configuration or quantity changed");
    // Builder setup (from the Quotation Builder): the builder still has the schedule and the edge construction.
    await openBuilderSetup("kitchen");
    await stageTo("Benchtops");
    ev.builderSetup = { banner: await page.$eval('[data-testid="cabinetry-builder-setup"]', (x) => x.innerText.replace(/\s+/g, " ")), edgeControls: (await page.$$('[data-testid="benchtop-edge-construction"]')).length };
    assert(ev.builderSetup.edgeControls > 0, "edge construction is in the builder setup");
    // 11-12. Quotation Builder: island configuration, constructions, specifications; no duplicate rows.
    await page.goto(`${origin}/modules/estimate-builder?page=quotation&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForSelector('[data-testid="cabinetry-room-briefs"]', { timeout: 240000 });
    await delay(2000);
    const kitchenCard = '[data-testid="cabinetry-room-brief"][data-room="Kitchen"]';
    ev.islandBefore = await page.$eval(`${kitchenCard} [data-testid="cabinetry-island-configuration"]`, (x) => ({ identified: x.dataset.identified, text: x.innerText.replace(/\s+/g, " ").slice(0, 300) }));
    assert.equal(ev.islandBefore.identified, "no");
    const rowsBefore = cabRows(await savedRecord());
    const firstLine = await page.$eval(`${kitchenCard} [data-island-line]`, (li) => li.dataset.islandLine);
    const input = await page.$(`${kitchenCard} [data-island-line="${firstLine}"] input`);
    await input.click({ clickCount: 3 }); await input.type("1");
    await page.$eval(`${kitchenCard} [data-island-line="${firstLine}"] button`, (b) => b.click());
    await delay(4000);
    ev.islandAfter = await page.$eval(`${kitchenCard} [data-testid="cabinetry-island-configuration"]`, (x) => x.dataset.identified);
    assert.equal(ev.islandAfter, "yes", "island cabinets identified in the Quotation Builder");
    ev.constructions = await page.$eval(`${kitchenCard} [data-testid="cabinetry-benchtop-constructions"]`, (x) => x.innerText.replace(/\s+/g, " ").slice(0, 300)).catch(() => "");
    assert(/Main benchtop · 40 mm/.test(ev.constructions), `Kitchen benchtop construction is set here (${ev.constructions})`);
    const ensuiteBrief = await page.$eval('[data-testid="cabinetry-room-brief"][data-room="Ensuite"]', (x) => x.innerText.replace(/\s+/g, " "));
    ev.ensuiteBrief = ensuiteBrief.slice(0, 500);
    assert(/Eclipse/.test(ensuiteBrief) && /20 mm/.test(ensuiteBrief) && /Above-counter basin/.test(ensuiteBrief) && /Client approved/.test(ensuiteBrief), "Ensuite specification reaches the Quotation Builder");
    await delay(3000);
    const rowsAfter = cabRows(await savedRecord());
    const keys = rowsAfter.map((r) => r.split("=")[0]);
    assert.equal(new Set(keys).size, keys.length, "no duplicate cabinetry quote rows");
    ev.rowsChangedByIsland = rowsAfter.filter((r) => !rowsBefore.includes(r));
    assert.deepEqual(ev.rowsChangedByIsland, [], "marking an island cabinet changes no quote row");
    await page.screenshot({ path: path.join(out, "defects1118-quotation.png"), fullPage: false }).catch(() => {});
    // The Kitchen approval stands after the island was marked.
    await openCabinetry();
    ev.navEnd = await navStatus();
    assert.equal(ev.navEnd.Kitchen, "approved", "Kitchen approval kept after the builder marked island cabinets");
    return ev;
  });

  await phase("review", async () => {
    await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await waitForApp();
    assert(await buttonWithText("Review Schedule"), "Review Schedule button");
    await page.waitForSelector('[data-testid="variation-summary"]');
    const rows = await page.$$eval('[data-testid="variation-row"]', (n) => n.length);
    const text = await page.$eval('[data-testid="variation-summary"]', (e) => e.innerText);
    const problems = BAD.filter(([re]) => re.test(text)).map(([, label]) => label);
    assert(!problems.length, problems.join(", "));
    return { variationRows: rows };
  });
} finally {
  await page.screenshot({ path: path.join(out, "last-screen.png") }).catch(() => {});
  await browser.close();
  fs.rmSync(fixture, { force: true });
  report.missingPhases = only.filter((name) => !report.phases[name]);
  report.passed = Boolean(report.opened) && only.length > 0 && !report.missingPhases.length && Object.values(report.phases).every((p) => p.status === "PASS") && !report.productionRequests.length;
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, opened: report.opened, phases: Object.fromEntries(Object.entries(report.phases).map(([k, v]) => [k, v.status])), productionRequests: report.productionRequests.length, answeredLocally: report.answeredLocally }));
  if (!report.passed) process.exitCode = 1;
}
