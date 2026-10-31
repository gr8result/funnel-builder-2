// Isolated end-to-end acceptance for Standard Inclusions.
// Mock Supabase (PGlite) on :54415 + `next dev` on :3115 with its own build folder. Never touches
// port 3000, the live database or live job data.
// Run: node --import ./scripts/register-json-import.mjs scripts/test-standard-inclusions-e2e.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { startMockSupabase } from "./lib/mock-supabase-server.mjs";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { normalizeCatalogueProduct } from "../lib/standard-inclusions/productProposal.mjs";
import { catalogueCandidatesForMasterRequirement, masterInclusionRequirements } from "../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { buildInclusionsBrochureDocument } from "../lib/standard-inclusions/brochureDesignPrototype.mjs";
import { applyStandardInclusionsToWorkbook, JOB_APPLICATION_STATUS, planJobInclusionApplication } from "../lib/standard-inclusions/jobBaseline.mjs";

const APP_PORT = Number(process.env.SI_E2E_PORT || 3115);
const MOCK_PORT = Number(process.env.SI_E2E_MOCK_PORT || 54415);
assert.notEqual(APP_PORT, 3000, "port 3000 is reserved for the shared development server");
const APP = `http://127.0.0.1:${APP_PORT}`;
const OUT = process.env.SI_E2E_OUT || `artifacts/test-results/standard-inclusions-e2e/${new Date().toISOString().replace(/[:.]/g, "-")}`;
fs.mkdirSync(OUT, { recursive: true });

const UA = { id: "a0000000-0000-4000-8000-0000000051a1", email: "owner@builder-a.test", password: "e2e" };
const UB = { id: "b0000000-0000-4000-8000-0000000051b2", email: "owner@builder-b.test", password: "e2e" };
const WA = "aaaaaaaa-0000-4000-8000-0000000051a1";
const WB = "bbbbbbbb-0000-4000-8000-0000000051b2";
const PA = "cccccccc-0000-4000-8000-0000000051a1";
const PB = "dddddddd-0000-4000-8000-0000000051b2";
const migrations = ["20260812000000_standard_inclusions_pdf_library.sql", "20260813091500_estimate_builder_commercial_backbone_stage1.sql", "20261017000100_standard_inclusions_project_assignment_unique.sql"];
const seedSql = `${migrations.map((file) => fs.readFileSync(`supabase/migrations/${file}`, "utf8")).join("\n;\n").replace(/create extension[^;]*;/gi, "").replace(/notify pgrst[^;]*;/gi, "")};
  insert into auth.users values ('${UA.id}','${UA.email}','${UA.password}'),('${UB.id}','${UB.email}','${UB.password}');
  insert into accounts (user_id, email, business_name, full_name, is_approved, approved, status, subscription_status, onboarding_completed, phone_verified) values
    ('${UA.id}','${UA.email}','Builder A Homes','Alex A',true,true,'active','active',true,true),('${UB.id}','${UB.email}','Builder B Homes','Sam B',true,true,'active','active',true,true);
  insert into workspaces (id, name, slug, owner_id) values ('${WA}','Builder A Homes','builder-a','${UA.id}'),('${WB}','Builder B Homes','builder-b','${UB.id}');
  insert into workspace_members (workspace_id, user_id, role, status) values ('${WA}','${UA.id}','owner','active'),('${WB}','${UB.id}','owner','active');
  insert into builder_commercial_projects (id, workspace_id, project_name, client_name, site_address, status) values
    ('${PA}','${WA}','E2E Disposable Job A','Test Client A','1 Test St','active'),('${PB}','${WB}','E2E Disposable Job B','Test Client B','2 Test St','active');
`;

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mock, next, browser;
async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, seconds: Math.round((Date.now() - started) / 1000) });
    console.log(`PASS ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    for (const [index, page] of (await browser?.pages().catch(() => []) || []).entries()) {
      try { await page.screenshot({ path: path.join(OUT, `failure-${index}.png`) }); console.log(`  page ${index}: ${(await page.evaluate(() => document.body.innerText.slice(0, 700))).replace(/\s*\n\s*/g, " | ")}`); } catch { /* diagnostics only */ }
    }
    throw error;
  }
}
async function cleanup() {
  try { await browser?.close(); } catch { /* ignore */ }
  try { if (next && !next.killed) { if (process.platform === "win32") spawn("taskkill", ["/pid", String(next.pid), "/T", "/F"]); else next.kill("SIGTERM"); } } catch { /* ignore */ }
  try { await mock?.close(); } catch { /* ignore */ }
}
async function waitForHttp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const response = await fetch(url); if (response.status < 500) return; } catch { /* starting */ }
    await sleep(1500);
  }
  throw new Error(`timed out waiting for ${url}`);
}
const token = (user) => mock.session(user).access_token;
async function api(user, workspaceId, method, url, body, { form } = {}) {
  const headers = { Authorization: `Bearer ${token(user)}`, "x-workspace-id": workspaceId };
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  const response = await fetch(`${APP}${url}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(420_000) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ...payload };
}
async function clickText(page, selector, label, timeout = 60_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const handle of await page.$$(selector)) {
      const [text, disabled] = await handle.evaluate((element) => [element.innerText.trim(), element.disabled]);
      if (text === label && !disabled) { await handle.click(); return; }
    }
    await sleep(300);
  }
  throw new Error(`no enabled ${selector} "${label}"`);
}
async function waitForDownload(dir, before, timeout = 120_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".pdf") && !before.includes(file));
    if (files.length && !fs.readdirSync(dir).some((file) => file.endsWith(".crdownload"))) return path.join(dir, files[0]);
    await sleep(500);
  }
  throw new Error("PDF download did not complete");
}

const catalogue = getEffectiveProductCatalogue({ organisationId: WA }).products.map(normalizeCatalogueProduct);
const catalogueById = new Map(catalogue.map((product) => [product.productId, product]));
let scheduleId, schedule, pdfPath, pdfPages = 0;

try {
  for (const port of [APP_PORT, MOCK_PORT]) {
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once("error", () => reject(new Error(`port ${port} is in use`))); probe.listen(port, () => probe.close(resolve)); });
  }
  mock = await startMockSupabase({ port: MOCK_PORT, seedSql });
  // SI_E2E_SERVER=start serves an existing production build (CI); default is an isolated `next dev`.
  const serverMode = process.env.SI_E2E_SERVER === "start" ? "start" : "dev";
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", serverMode, "-p", String(APP_PORT)], {
    env: {
      ...process.env, NEXT_DIST_DIR: process.env.SI_E2E_DIST_DIR || (serverMode === "start" ? ".next" : ".next-standard-inclusions-e2e"), PORT: String(APP_PORT), NODE_ENV: serverMode === "start" ? "production" : "development", NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: mock.url, SUPABASE_URL: mock.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-e2e", SUPABASE_SERVICE_ROLE_KEY: "service-e2e", SUPABASE_SERVICE_KEY: "service-e2e",
      OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", SENDGRID_API_KEY: "", RESEND_API_KEY: "",
      NODE_OPTIONS: "--max-old-space-size=8192",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverLog = fs.createWriteStream(path.join(OUT, "next-dev.log"));
  next.stdout.pipe(serverLog); next.stderr.pipe(serverLog);
  next.on("exit", (code, signal) => console.log(`  next dev exited (code ${code}, signal ${signal})`));
  await waitForHttp(`${APP}/api/ping`, 300_000);

  // Compile the editor route and its APIs once before the browser waits on them (slow on the external drive).
  for (const route of ["/modules/builders/standard-inclusions/warmup", "/api/standard-inclusions/pdf-library", "/api/standard-inclusions/branding", "/api/standard-inclusions/product-catalogue", "/api/standard-inclusions/generate-schedule", "/api/builders/product-catalogue", "/api/standard-inclusions/product-image"]) {
    const started = Date.now();
    await fetch(`${APP}${route}`, { signal: AbortSignal.timeout(900_000) }).catch(() => null);
    console.log(`  warmed ${route} (${Math.round((Date.now() - started) / 1000)}s)`);
  }
  browser = await puppeteer.launch({ headless: true, protocolTimeout: 900_000, args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,960"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(240_000);
  page.setDefaultNavigationTimeout(300_000);
  await page.setViewport({ width: 1440, height: 960 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", async (response) => {
    if (response.url().includes("/api/standard-inclusions") && response.status() >= 400) console.log(`  API ${response.request().method()} ${response.url().replace(APP, "")} -> ${response.status()} ${(await response.text().catch(() => "")).slice(0, 240)}`);
  });
  const downloads = path.resolve(OUT, "downloads");
  fs.mkdirSync(downloads, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await page.evaluateOnNewDocument((session, workspaceId) => {
    try { localStorage.setItem("sb-127-auth-token", session); localStorage.setItem("gr8:activeWorkspaceId", workspaceId); localStorage.setItem("activeWorkspaceId", workspaceId); } catch { /* ignore */ }
  }, JSON.stringify(mock.session(UA)), WA);

  await step("A. create a Premier schedule with AI from the editor", async () => {
    const created = await api(UA, WA, "POST", "/api/standard-inclusions/pdf-library", { name: "E2E Premier Inclusions", tierKey: "Premier" });
    assert.equal(created.status, 200, created.error);
    scheduleId = created.schedule.id;
    await page.goto(`${APP}/modules/builders/standard-inclusions/${scheduleId}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /Continue|Create with AI/.test(document.body.innerText), { timeout: 300_000 });
    for (let index = 0; index < 5 && !(await page.evaluate(() => document.body.innerText.includes("Create with AI"))); index += 1) await clickText(page, "button", "Continue");
    await clickText(page, "button", "Create with AI", 180_000);
    await page.waitForFunction(() => /Brochure created and saved/.test(document.body.innerText) || document.querySelector(".alert.error"), { timeout: 420_000 });
    const error = await page.$eval(".alert.error", (element) => element.innerText).catch(() => "");
    assert.equal(error, "", error);
    await page.screenshot({ path: path.join(OUT, "a-generated-editor.png") });
  });

  await step("B/C. products, preferences and premium brochure are correct", async () => {
    const reopened = await api(UA, WA, "GET", `/api/standard-inclusions/pdf-library?id=${scheduleId}`);
    schedule = reopened.schedules?.[0];
    const items = schedule.metadata.inclusionsDraft.items;
    const required = items.filter((item) => item.productRequired);
    assert.equal(items.length, 200, "200 structured inclusions");
    assert.equal(required.length, 92, "92 product requirements");
    const matched = required.filter((item) => item.product);
    assert.ok(matched.length >= 89, `matched ${matched.length}/92`);
    for (const item of matched) {
      const product = catalogueById.get(item.product.productId);
      assert.ok(product, `${item.requirementTitle}: product ${item.product.productId} exists in the Product Library`);
      assert.equal(item.product.name, product.name, `${item.requirementTitle}: product identity unchanged`);
      if (item.product.image) assert.equal(item.product.image, product.image, `${item.requirementTitle}: approved catalogue image`);
    }
    const brochure = schedule.metadata.brochureDocument;
    assert.equal(brochure.metadata.brochureDesignSystem, "gr8-editorial-v1", "premium editorial brochure");
    assert.equal(brochure.pages.length, 25, "25-page brochure");
    const imageSources = brochure.pages.flatMap((entry) => entry.objects).filter((object) => object.type === "image" && object.data?.productId).map((object) => [object.data.productId, object.data.src || object.data.url || ""]);
    for (const [productId] of imageSources) assert.ok(catalogueById.has(productId), `brochure image product ${productId} exists`);
    fs.writeFileSync(path.join(OUT, "generated-items.json"), JSON.stringify(required.map((item) => ({ requirement: item.requirementTitle, product: item.product?.name || null, productId: item.product?.productId || null, image: Boolean(item.product?.image) })), null, 1));
  });

  let editedText, replacementOven;
  await step("D/E. edit text, product and design; save, close, reopen", async () => {
    const items = schedule.metadata.inclusionsDraft.items.map((item) => ({ ...item }));
    const oven = items.find((item) => item.requirementTitle === "Oven" && item.product);
    const requirement = masterInclusionRequirements().find((entry) => entry.key === oven.requirementKey) || { category: oven.requirementCategory, title: "Oven" };
    replacementOven = catalogueCandidatesForMasterRequirement(catalogue, requirement).find((product) => product.productId !== oven.product.productId && product.image);
    assert.ok(replacementOven, "a compatible replacement oven exists");
    Object.assign(oven, { product: { ...replacementOven }, description: replacementOven.name, reason: "Builder-selected exact product from this workspace Product Library." });
    editedText = `E2E edited specification ${Date.now()}`;
    const textItem = items.find((item) => !item.productRequired && item.specification !== undefined);
    textItem.specification = editedText;
    for (const item of items) {
      item.reviewStatus = "approved";
      if (item.productRequired && !item.product) Object.assign(item, { reviewResolution: "builder_specification", specification: item.specification || `${item.requirementTitle} to builder-verified specification.`, description: item.description || item.requirementTitle });
    }
    const draft = { ...schedule.metadata.inclusionsDraft, items, gaps: [], gapDetails: [], status: "Approved" };
    const branding = schedule.metadata.brochureBranding?.snapshot || {};
    const brochure = buildInclusionsBrochureDocument({ items, branding, name: schedule.name, packageChoice: "Mid-range", designStyle: "Classic" });
    const metadata = { ...schedule.metadata, workflowStatus: "Approved", inclusionsDraft: draft, brochureDocument: brochure, brochureBuilder: { ...(schedule.metadata.brochureBuilder || {}), currentStep: 5, designStyle: "Classic" } };
    const saved = await api(UA, WA, "PATCH", "/api/standard-inclusions/pdf-library", { action: "update", scheduleId, name: schedule.name, description: schedule.description, tierKey: "Premier", metadata });
    assert.equal(saved.status, 200, saved.error);
    const reopened = (await api(UA, WA, "GET", `/api/standard-inclusions/pdf-library?id=${scheduleId}`)).schedules[0];
    const reopenedItems = reopened.metadata.inclusionsDraft.items;
    assert.equal(reopenedItems.find((item) => item.requirementTitle === "Oven").product.productId, replacementOven.productId, "replacement product persisted");
    assert.ok(reopenedItems.some((item) => item.specification === editedText), "edited text persisted");
    assert.equal(reopened.metadata.brochureBuilder.designStyle, "Classic", "design persisted");
    assert.equal(reopened.metadata.brochureDocument.pages.length, brochure.pages.length);
    assert.ok(JSON.stringify(reopened.metadata.brochureDocument).includes(replacementOven.name), "brochure shows the replacement product");
    schedule = reopened;
  });

  await step("F. reopen in the editor and export the complete brochure PDF", async () => {
    await page.goto(`${APP}/modules/builders/standard-inclusions/${scheduleId}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.innerText.trim() === "Export PDF"), { timeout: 300_000 });
    const before = fs.readdirSync(downloads);
    await clickText(page, "button", "Export PDF");
    await page.waitForFunction(() => /PDF generated from the current brochure layout/.test(document.body.innerText) || document.querySelector(".alert.error"), { timeout: 420_000 });
    await clickText(page, "button", "Download PDF");
    pdfPath = await waitForDownload(downloads, before);
    assert.ok(fs.statSync(pdfPath).size > 50_000, "PDF has content");
  });

  await step("G. render and inspect every PDF page", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise;
    pdfPages = pdf.numPages;
    assert.equal(pdfPages, schedule.metadata.brochureDocument.pages.length, "every brochure page exported");
    const pagesDir = path.join(OUT, "pdf-pages");
    fs.mkdirSync(pagesDir, { recursive: true });
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const pdfPage = await pdf.getPage(number);
      const viewport = pdfPage.getViewport({ scale: 0.75 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
      const png = canvas.toBuffer("image/png");
      fs.writeFileSync(path.join(pagesDir, `page-${String(number).padStart(2, "0")}.png`), png);
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhite = 0;
      for (let index = 0; index < pixels.length; index += 16) if (pixels[index] < 235 || pixels[index + 1] < 235 || pixels[index + 2] < 235) nonWhite += 1;
      assert.ok(nonWhite / (pixels.length / 16) > 0.02, `page ${number} is not blank`);
    }
  });

  await step("Publish the approved PDF version", async () => {
    const form = new FormData();
    form.append("action", "replace");
    form.append("scheduleId", scheduleId);
    form.append("file", new Blob([fs.readFileSync(pdfPath)], { type: "application/pdf" }), path.basename(pdfPath));
    const uploaded = await api(UA, WA, "POST", "/api/standard-inclusions/pdf-library", undefined, { form });
    assert.ok([200, 201].includes(uploaded.status), uploaded.error);
    const version = uploaded.schedule.currentVersion;
    const items = schedule.metadata.inclusionsDraft.items;
    const metadata = { ...schedule.metadata, workflowStatus: "Published", quotationDefault: true, inclusionsDraft: { ...schedule.metadata.inclusionsDraft, status: "Published" }, publishedSnapshots: [{ publishedAt: new Date().toISOString(), versionId: version.id, versionNumber: version.versionNumber, branding: schedule.metadata.brochureBranding?.snapshot || {}, includedFields: {}, items: items.filter((item) => item.reviewStatus === "approved"), reviewRequirementIds: schedule.metadata.reviewRequirementIds || [], brochureDocument: schedule.metadata.brochureDocument }] };
    const saved = await api(UA, WA, "PATCH", "/api/standard-inclusions/pdf-library", { action: "update", scheduleId, name: schedule.name, description: schedule.description, tierKey: "Premier", metadata });
    assert.equal(saved.status, 200, saved.error);
    schedule = saved.schedule;
  });

  let jobSnapshot;
  await step("H/I. apply Premier to a disposable quotation; products, quantities, prices", async () => {
    const applied = await api(UA, WA, "POST", "/api/standard-inclusions/apply-to-project", { scheduleId, projectId: PA });
    assert.equal(applied.status, 201, applied.error);
    const linked = await api(UA, WA, "GET", `/api/builders/project-inclusions?projectId=${PA}`);
    assert.equal(linked.status, 200, linked.error);
    jobSnapshot = linked.document?.metadata?.standardScheduleSnapshot?.jobInclusionSnapshot || applied.scheduleSnapshot.jobInclusionSnapshot;
    assert.ok(jobSnapshot?.items?.length > 0, "slotted quotation baseline items");
    assert.equal(applied.quotationSeed.lines.length, schedule.metadata.inclusionsDraft.items.filter((item) => item.reviewStatus === "approved").length, "one seed line per approved inclusion");
    assert.equal(new Set(applied.quotationSeed.lines.map((line) => line.lineId)).size, applied.quotationSeed.lines.length, "unique seed lines");
    const slots = [...new Set(jobSnapshot.items.map((item) => item.selection_slot_id))];
    const workbook = { jobId: "e2e-job", workspaceId: WA, templateKey: "e2e", quotation: { INCLUSIONS: { id: "inclusions", rows: slots.map((slot, index) => ({ id: `row-${slot}`, item: slot, qty: index + 1, selectionSlotId: slot })) } } };
    const foundation = { workspace_id: WA, configurations: slots.map((slot) => ({ workspace_id: WA, selection_slot_id: slot, enabled: true })), mappings: [] };
    const first = applyStandardInclusionsToWorkbook(workbook, jobSnapshot, foundation);
    assert.equal(first.applied, true);
    const rows = first.workbook.quotation.INCLUSIONS.rows;
    assert.equal(rows.length, slots.length, "no rows created");
    for (const [index, row] of rows.entries()) {
      const baseline = jobSnapshot.items.find((item) => item.selection_slot_id === row.selectionSlotId);
      assert.equal(row.qty, index + 1, `${row.selectionSlotId}: quantity unchanged`);
      assert.equal(row.baselineProductId, baseline.metadata.productSnapshot.productId, `${row.selectionSlotId}: product`);
      assert.equal(row.baselineUnitPrice, baseline.baselineUnitPrice, `${row.selectionSlotId}: price`);
      assert.ok(catalogueById.has(row.baselineProductId), `${row.selectionSlotId}: real catalogue product`);
    }
    const ovenRow = rows.find((row) => row.selectionSlotId === "oven");
    if (ovenRow) assert.equal(ovenRow.baselineProductId, replacementOven.productId, "builder's replacement oven reaches the quotation");
    fs.writeFileSync(path.join(OUT, "quotation-rows.json"), JSON.stringify(rows.map((row) => ({ slot: row.selectionSlotId, qty: row.qty, product: row.baselineProductName, unitPriceExGst: row.baselineUnitPrice })), null, 1));
    globalThis.firstWorkbook = first.workbook; globalThis.foundation = foundation;
  });

  await step("J. reapply the schedule: no duplicate quotation rows or documents", async () => {
    const again = await api(UA, WA, "POST", "/api/standard-inclusions/apply-to-project", { scheduleId, projectId: PA });
    assert.equal(again.status, 200, again.error);
    assert.equal(again.alreadyApplied, true);
    const { rows: documents } = await mock.pg.query(`select id from builder_project_documents where project_id = $1 and status = 'active'`, [PA]);
    assert.equal(documents.length, 1, "one project inclusions document");
    assert.equal(planJobInclusionApplication(globalThis.firstWorkbook, jobSnapshot).status, JOB_APPLICATION_STATUS.ALREADY_APPLIED);
    const second = applyStandardInclusionsToWorkbook(globalThis.firstWorkbook, JSON.parse(JSON.stringify(jobSnapshot)), globalThis.foundation);
    assert.equal(second.applied, false);
    assert.equal(second.workbook.quotation.INCLUSIONS.rows.length, globalThis.firstWorkbook.quotation.INCLUSIONS.rows.length, "no duplicate rows");
  });

  await step("K. builder B cannot read, edit, regenerate or apply builder A's schedule", async () => {
    const list = await api(UB, WB, "GET", "/api/standard-inclusions/pdf-library");
    assert.equal(list.status, 200, list.error);
    assert.ok(!(list.schedules || []).some((entry) => entry.id === scheduleId), "not listed for builder B");
    const read = await api(UB, WB, "GET", `/api/standard-inclusions/pdf-library?id=${scheduleId}`);
    assert.ok(read.status === 404 || !(read.schedules || []).length, "not readable by builder B");
    const edit = await api(UB, WB, "PATCH", "/api/standard-inclusions/pdf-library", { action: "update", scheduleId, name: "Hijacked", metadata: {} });
    assert.ok(edit.status >= 400, `edit refused (${edit.status})`);
    const regenerate = await api(UB, WB, "POST", "/api/standard-inclusions/generate-schedule", { scheduleId, tier: "Premier", priceLevel: "mid-range" });
    assert.equal(regenerate.status, 404, "regeneration refused");
    const apply = await api(UB, WB, "POST", "/api/standard-inclusions/apply-to-project", { scheduleId, projectId: PB });
    assert.equal(apply.status, 404, "apply refused");
    const crossWorkspace = await api(UB, WA, "GET", `/api/standard-inclusions/pdf-library?id=${scheduleId}`);
    assert.equal(crossWorkspace.status, 403, "builder B cannot select builder A's workspace");
    const projectRead = await api(UB, WB, "GET", `/api/builders/project-inclusions?projectId=${PA}`);
    assert.ok(projectRead.status >= 400 || !projectRead.document, "builder A's project inclusions not visible to builder B");
    const { rows } = await mock.pg.query(`select name from standard_inclusions_schedules where id = $1`, [scheduleId]);
    assert.equal(rows[0].name, "E2E Premier Inclusions", "builder A's schedule unchanged");
  });

  assert.deepEqual(pageErrors.filter((message) => !/ResizeObserver/.test(message)), [], "no page errors");
} catch (error) {
  process.exitCode = 1;
  if (!results.some((result) => !result.ok)) console.log(`FAIL setup: ${error.stack || error.message}`);
} finally {
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, pdfPath, pdfPages }, null, 2));
  console.log(`Evidence: ${OUT}`);
  await cleanup();
  setTimeout(() => process.exit(process.exitCode || 0), 2000);
}
