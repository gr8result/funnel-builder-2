import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const source = process.env.CLIENT_SELECTIONS_JOB_FILE || "C:\\Users\\grant\\Downloads\\New Job 03 09.gr8job";
const reproduce = process.argv.includes("--reproduce");
// --prepare-copy: import under a separate job ID and export it with the app, nothing else.
// The result opens in normal Chrome as its own job, so the live job is never replaced.
const prepareCopy = process.argv.includes("--prepare-copy");
const out = path.resolve("artifacts", "test-artifacts", "cabinetry-approval");
fs.mkdirSync(out, { recursive: true });
const zip = await JSZip.loadAsync(fs.readFileSync(source));
const original = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const projectId = prepareCopy ? process.env.CLIENT_SELECTIONS_COPY_JOB_ID || "recovered-03-09-123-verify-20261107" : `isolated-cabinetry-approval-${Date.now()}`;
const jobName = prepareCopy ? "New Job 03/09 - VERIFICATION COPY 7 Nov" : "Protected cabinetry approval acceptance";
const workbook = { ...original };
Object.assign(workbook, { projectId, jobId: projectId, registeredJobId: projectId });
workbook.registeredJob = { ...workbook.registeredJob, jobId: projectId, jobName };
workbook.jobFileMeta = { ...workbook.jobFileMeta, projectId, jobName };
const fixture = path.join(out, "protected-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName, workbook }));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(supabaseUrl, "Supabase URL required for isolated HTTP fixtures");
const user = { id: "66666666-6666-4666-8666-666666666666", email: "isolated@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const session = { user, access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 7200, role: "authenticated", aud: "authenticated" })).toString("base64url")}.isolated`, refresh_token: "isolated", expires_at: Math.floor(Date.now() / 1000) + 7200, expires_in: 7200, token_type: "bearer" };
const report = { mode: reproduce ? "reproduction" : "acceptance", source: path.basename(source), steps: {}, errors: [], blockedWrites: [], console: [] };
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, protocolTimeout: 240000, defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
page.setDefaultTimeout(120000);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickText = async text => {
  await page.waitForFunction(text => [...document.querySelectorAll("button")].some(b => !b.disabled && b.textContent.trim() === text), {}, text);
  await page.evaluate(text => [...document.querySelectorAll("button")].find(b => !b.disabled && b.textContent.trim() === text).click(), text);
};
const openCabinetry = async () => {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections&jobId=${projectId}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]') || [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Retry"));
  if (await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Retry"))) {
    report.steps.coldModuleRetry = true;
    await clickText("Retry");
  }
  await page.waitForSelector('[data-testid="guided-client-selections-home"], [data-testid="guided-interior-categories"]');
  if (await page.$('[data-testid="guided-client-selections-home"]')) await page.$eval('[data-requirement-key="interior"]', b => b.click());
  await page.waitForSelector('[data-testid="guided-interior-categories"]');
  await page.$eval('[data-requirement-key="cabinetry"]', b => b.click());
  await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
};
const stored = (identityOnly = false) => page.evaluate(async ({ id, identityOnly }) => {
  for (const { name } of await indexedDB.databases()) {
    if (!name.includes("estimate-builder-template-db")) continue;
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      if (!db.objectStoreNames.contains("jobs")) continue;
      const record = await new Promise((resolve, reject) => { const r = db.transaction("jobs", "readonly").objectStore("jobs").get(`job:${id}`); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      if (record) return identityOnly ? { jobId: record.workbook.registeredJob?.jobId || record.workbook.jobId } : {
        clientSelectionsBook: record.workbook.clientSelectionsBook,
        quotation: record.workbook.quotation,
        projectRoomModel: record.workbook.projectRoomModel,
      };
    } finally { db.close(); }
  }
  return null;
}, { id: projectId, identityOnly });
const cabinetry = w => (w.clientSelectionsBook?.rooms || []).flatMap(r => r.rows || []).find(r => r.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection;
const charges = w => Object.fromEntries(Object.entries(w.quotation || {}).map(([key, section]) => [key, (section.rows || []).map(row => ({ id: row.id, item: row.item, quantity: row.quantity, manualRate: row.manualRate, unit: row.unit }))]));
const otherSelections = w => (w.clientSelectionsBook?.rooms || []).flatMap(room => (room.rows || []).filter(row => row.guidedSelection && !row.guidedSelection.cabinetrySelection).map(row => ({ id: row.id, selection: row.guidedSelection, selectedCost: row.selectedCost, upgradeCost: row.upgradeCost })));
const reviewQueue = async () => {
  await clickText("Review Schedule");
  await page.waitForSelector('[data-testid="selection-attention"]');
  return page.$$eval('[data-testid="attention-item"]', nodes => nodes.map(node => node.innerText));
};
const openKitchenReview = async () => {
  await openCabinetry();
  await page.waitForSelector('[data-testid="cabinetry-room-kitchen"]');
  await page.$eval('[data-testid="cabinetry-room-kitchen"]', button => button.click());
  await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
  await page.$eval('[data-testid="cabinetry-progress-menu"]', menu => [...menu.querySelectorAll("button")].find(b => /Review & Confirm/.test(b.textContent)).click());
  await page.waitForSelector('[data-testid="cabinetry-review-confirm"]');
};
try {
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" || /save|approval|workspace|identity/i.test(message.text())) report.console.push(message.text().slice(0, 500)); });
  await page.setRequestInterception(true);
  page.on("request", async request => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const respond = body => request.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });
    if (url.origin === new URL(supabaseUrl).origin) {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !url.pathname.startsWith("/auth/")) report.blockedWrites.push({ path: url.pathname, method: request.method() });
      if (url.pathname.startsWith("/auth/")) return respond(url.pathname.endsWith("/user") ? user : session);
      if (url.pathname.includes("/accounts")) return respond([{ user_id: user.id, approved: true, is_approved: true, status: "approved", subscription_status: "active", onboarding_completed: true }]);
      return respond([]);
    }
    if (url.origin === new URL(origin).origin && url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/workspaces") return respond({ workspaces: [{ id: workbook.workspaceId, name: "Isolated acceptance", role: "owner" }] });
      if (url.pathname === "/api/builders/selection-foundation") return respond({ workspace_id: workbook.workspaceId, requirementMappings: [], products: [] });
      return respond({ products: [], rows: [], data: [] });
    }
    if (url.origin !== new URL(origin).origin && !["GET", "HEAD", "OPTIONS"].includes(request.method())) return request.abort();
    return request.continue();
  });
  await page.evaluateOnNewDocument(({ session, supabaseUrl, workspaceId }) => {
    localStorage.setItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("active_workspace_id", workspaceId);
    // A headless browser cannot answer the native Save dialog. Chrome reports an intercepted
    // picker this way, and the app then takes its own verified-download path.
    window.showSaveFilePicker = async () => {
      throw new DOMException("Failed to execute 'showSaveFilePicker' on 'Window': Intercepted by Page.setInterceptFileChooserDialog().", "AbortError");
    };
  }, { session, supabaseUrl, workspaceId: workbook.workspaceId });
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 240000 });
  console.log("Importing protected real-job copy");
  await (await page.waitForSelector('[data-testid="open-local-job-file-input"]')).uploadFile(fixture);
  for (let n = 0; n < 12; n++) {
    await delay(500);
    await page.evaluate(() => { for (const text of ["Open Job", "Open Job File", "Keep Local"]) [...document.querySelectorAll("button")].find(b => !b.disabled && b.textContent.trim() === text)?.click(); });
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    if ((await stored(true))?.jobId === projectId) break;
    await delay(1000);
  }
  assert.equal((await stored(true))?.jobId, projectId, "protected file import must finish before navigation");
  if (prepareCopy) {
    const downloadDir = path.join(out, projectId);
    fs.rmSync(downloadDir, { recursive: true, force: true });
    fs.mkdirSync(downloadDir, { recursive: true });
    await (await page.createCDPSession()).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
    await clickText("File");
    await clickText("Download Backup Copy");
    let downloaded;
    for (let attempt = 0; attempt < 240 && !downloaded; attempt++) { await delay(1000); downloaded = fs.readdirSync(downloadDir).find(name => name.endsWith(".gr8job")); }
    assert(downloaded, "app export of the verification copy must complete");
    const copy = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(path.join(downloadDir, downloaded)))).file("estimate.json").async("string")).workbook;
    assert.equal(copy.registeredJob?.jobId || copy.jobId, projectId, "the copy has its own job ID");
    assert(!cabinetry(copy).locations.some(room => room.reviewApproval), "no approval is pre-recorded in the copy");
    assert.deepEqual(charges(copy), charges(original), "quotation charges unchanged");
    report.steps.preparedCopy = path.join(downloadDir, downloaded);
    console.log("Prepared verification copy", report.steps.preparedCopy);
    report.passed = true;
    throw Object.assign(new Error("done"), { prepared: true });
  }
  await openCabinetry();
  await delay(3000);
  if (!await page.$('[data-testid="cabinetry-room-landing"]')) {
    await page.$eval('[data-requirement-key="cabinetry"]', b => b.click());
    await page.waitForSelector('[data-testid="cabinetry-room-landing"]');
  }
  report.steps.rooms = await page.$$eval(".cabinetryRoomCard", nodes => nodes.map(n => n.innerText));
  console.log("Rooms", report.steps.rooms);
  await page.screenshot({ path: path.join(out, reproduce ? "before-rooms.png" : "after-rooms.png"), fullPage: true });
  await page.waitForSelector('[data-testid="cabinetry-room-kitchen"]');
  await page.$eval('[data-testid="cabinetry-room-kitchen"]', button => button.click());
  await page.waitForSelector('[data-testid="cabinetry-progress-menu"]');
  await page.$eval('[data-testid="cabinetry-progress-menu"]', menu => [...menu.querySelectorAll("button")].find(b => /Review & Confirm/.test(b.textContent)).click());
  await page.waitForSelector('[data-testid="cabinetry-review-confirm"]');
  report.steps.review = await page.$eval(".cabinetryWorkflow", n => n.innerText);
  await page.screenshot({ path: path.join(out, reproduce ? "before-kitchen-review.png" : "after-kitchen-review.png"), fullPage: true });
  if (reproduce) {
    assert(!report.steps.rooms.some(name => name.includes("B2 Ensuite")), "Reproduce missing B2 Ensuite");
    assert(report.steps.rooms.some(name => /^Bathroom\n/.test(name)) && report.steps.rooms.some(name => /^Main Bathroom\n/.test(name)), "Reproduce duplicate alias card");
    assert(!report.steps.review.includes("Confirm & Approve Kitchen Cabinetry"), "Reproduce absent explicit approval");
    await page.$eval('[data-testid="cabinetry-bottom-next"]', b => b.click());
    await delay(1000);
    if (await page.$('[data-testid="cabinetry-apply-colours-modal"]')) await clickText("Skip");
    report.steps.afterNext = await page.$eval(".cabinetryWorkflow", n => n.innerText);
    console.log("Reported defects reproduced");
  } else {
    assert(report.steps.rooms.some(name => name.includes("B2 Ensuite")));
    assert(!report.steps.rooms.some(name => /^Bathroom\n/.test(name)));
    assert(!report.steps.rooms.some(name => /^Other\n/.test(name)), "no phantom Other card");
    // Cards follow the cabinetry sequence: Kitchen first, wet rooms grouped, Laundry after them.
    const order = report.steps.rooms.map(name => name.split("\n")[0]);
    report.steps.roomOrder = order;
    const at = name => order.indexOf(name);
    assert.equal(order[0], "Kitchen", "Kitchen is the first cabinetry room");
    assert(at("Butler's Pantry") < at("Main Bathroom") && at("Main Bathroom") < at("Ensuite") && at("Ensuite") < at("B2 Ensuite") && at("B2 Ensuite") < at("Powder Room") && at("Powder Room") < at("Laundry"), `room order ${order.join(", ")}`);
    assert.match(report.steps.rooms.find(name => name.startsWith("Kitchen\n")), /approval required/, "Kitchen shows specification complete, approval required");
    assert(await page.$eval('[data-testid="cabinetry-review-confirm"]', node => node.textContent.includes("Explicit approval required")), "review shows approval outstanding");
    report.steps.queueBeforeApproval = await reviewQueue();
    assert(report.steps.queueBeforeApproval.some(item => /^Cabinetry — Kitchen\n/.test(item)), "Review Schedule lists Kitchen for approval before it is given");
    await openKitchenReview();
    const baseline = await stored();
    const baselineSelection = cabinetry(baseline);
    await clickText("Confirm & Approve Kitchen Cabinetry");
    await page.waitForFunction(() => document.querySelector(".cabinetryWorkflow")?.textContent.includes("Kitchen cabinetry approved"));
    const saved = await stored();
    let approved = cabinetry(saved).locations.find(l => l.location === "Kitchen");
    assert(approved.reviewApproval);
    assert.equal(approved.reviewApproval.jobId, projectId);
    assert.equal(approved.reviewApproval.roomId, original.projectRoomModel.rooms.find(room => room.name === "Kitchen").id);
    assert.deepEqual(cabinetry(saved).schedule, baselineSelection.schedule, "approval does not change quantities or add products");
    assert.deepEqual(charges(saved), charges(baseline), "approval does not change or duplicate quotation charges");
    assert.deepEqual(otherSelections(saved), otherSelections(baseline), "all other selections and corrected O.Novo work remain unchanged");
    assert(!cabinetry(saved).locations.some(room => room.location !== "Kitchen" && room.reviewApproval), "no cross-room approval leakage");
    report.steps.approved = { room: approved.location, jobId: approved.reviewApproval.jobId, roomId: approved.reviewApproval.roomId, approvedAt: approved.reviewApproval.approvedAt };
    await page.screenshot({ path: path.join(out, "kitchen-approved.png"), fullPage: true });
    await clickText("Confirm & Approve Kitchen Cabinetry");
    await delay(1500);
    await page.waitForFunction(() => !document.querySelector('[data-testid="cabinetry-bottom-next"]')?.disabled);
    const repeated = await stored();
    assert.deepEqual(cabinetry(repeated).locations.find(room => room.location === "Kitchen").reviewApproval, approved.reviewApproval);
    assert.deepEqual(charges(repeated), charges(baseline));
    assert.deepEqual(cabinetry(repeated).schedule, baselineSelection.schedule);
    report.steps.repeatedApproval = "PASS";
    report.steps.queueAfterApproval = await reviewQueue();
    assert(!report.steps.queueAfterApproval.some(item => /^Cabinetry — Kitchen\n/.test(item)), "Kitchen removed immediately from review-required queue");
    await page.screenshot({ path: path.join(out, "review-queue-after-approval.png"), fullPage: true });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
    await openCabinetry();
    await page.waitForSelector('[data-testid="cabinetry-room-kitchen"][data-approved="true"]');
    report.steps.reload = "PASS";
    await page.screenshot({ path: path.join(out, "approved-room-card-after-reload.png"), fullPage: true });

    // ---- Client Selections V1: client view, bulkhead decision, variation pricing states ----
    const stage = name => page.$eval('[data-testid="cabinetry-progress-menu"]', (menu, name) => [...menu.querySelectorAll("button")].find(b => b.textContent.includes(name)).click(), name);
    const kitchenOf = w => cabinetry(w).locations.find(room => room.location === "Kitchen");
    await openKitchenReview();
    await stage("Cabinet Schedule");
    await page.waitForSelector('[data-testid="cabinetry-bulkhead-question"]');
    assert.equal(await page.$eval('[data-testid="cabinetry-view-toggle"]', n => n.dataset.view), "client", "client view is the default");
    assert.equal(await page.$$eval('[data-testid="cabinetry-builder-schedule"] input[type="number"]', n => n.length), 0, "client view asks for no quantity or measurement");
    assert.equal(await page.$eval('[data-testid="cabinetry-bulkhead-question"] h3', n => n.textContent), "Would you like bulkheads above your overhead kitchen cabinetry?");
    await page.waitForFunction(() => { const img = document.querySelector('[data-testid="cabinetry-bulkhead-question"] img'); return img && img.complete && img.naturalWidth > 0; }, { timeout: 30000 });
    const bulkheadStandard = await page.$eval('[data-testid="cabinetry-bulkhead-question"]', n => n.dataset.standard);
    report.steps.bulkheadStandard = bulkheadStandard;
    await page.screenshot({ path: path.join(out, "v1-client-cabinet-schedule.png"), fullPage: true });
    await stage("Benchtops");
    await page.waitForSelector('[data-testid="benchtop-selection"]');
    assert.equal(await page.$('[data-testid="benchtop-edit-dimensions"]'), null, "no benchtop dimension editing for the client");
    assert.equal(await page.$('[data-testid="benchtop-area-length"]'), null);
    assert(!(await page.$eval('[data-testid="benchtop-selection"]', n => n.innerText)).includes("Length needed"), "no length demanded of the client");
    assert.equal(await page.$('[data-testid="benchtop-override-open"]'), null, "no builder range override on the client screen");
    assert(!(await page.$eval('[data-testid="benchtop-selection"]', n => n.innerText)).includes("Quotation classification"), "no quotation classification on the client screen");
    await page.screenshot({ path: path.join(out, "v1-client-benchtops.png"), fullPage: true });
    report.steps.clientViewNoMeasurements = "PASS";

    await stage("Cabinet Schedule");
    await page.waitForSelector('[data-testid="cabinetry-bulkhead-question"]');
    let bulkheadChoice = "add";
    if (bulkheadStandard === "included") {
      // Standard bulkheads: removal only when the builder permits it.
      bulkheadChoice = "remove";
      assert(await page.$eval('[data-testid="cabinetry-bulkhead-remove"]', b => b.disabled), "removal unavailable until the builder permits it");
      await page.$eval('[data-testid="cabinetry-view-toggle-button"]', b => b.click());
      await page.waitForSelector('[data-testid="cabinetry-bulkhead-permit-remove"]');
      await page.$eval('[data-testid="cabinetry-bulkhead-permit-remove"]', b => b.click());
      await page.waitForFunction(() => !document.querySelector('[data-testid="cabinetry-bulkhead-remove"]')?.disabled);
      await page.$eval('[data-testid="cabinetry-view-toggle-button"]', b => b.click());
    } else assert(await page.$eval('[data-testid="cabinetry-bulkhead-remove"]', b => b.disabled), "cannot remove bulkheads that are not included");
    const beforeBulkhead = await stored();
    await page.$eval(`[data-testid="cabinetry-bulkhead-${bulkheadChoice}"]`, b => b.click());
    await page.waitForSelector('[data-testid="cabinetry-bulkhead-review"]');
    let afterBulkhead;
    for (let attempt = 0; attempt < 90; attempt++) {
      afterBulkhead = await stored();
      if (kitchenOf(afterBulkhead)?.bulkheadChoice?.choice === bulkheadChoice) break;
      await delay(1000);
    }
    assert.equal(kitchenOf(afterBulkhead).bulkheadChoice.choice, bulkheadChoice, "bulkhead decision saved to the job");
    if (bulkheadChoice === "add") assert(cabinetry(afterBulkhead).schedule.some(line => line.location === "Kitchen" && line.clientAddedBulkhead && Array.isArray(line.runs) && line.runs.length === 0), "added bulkhead carries no invented length");
    else assert.deepEqual(cabinetry(afterBulkhead).schedule.filter(line => /^bulkhead_/.test(line.cabinetTypeId || "")), cabinetry(beforeBulkhead).schedule.filter(line => /^bulkhead_/.test(line.cabinetTypeId || "")), "estimator bulkhead runs untouched by a removal");
    await delay(4000);
    afterBulkhead = await stored();
    report.steps.bulkheadChargesUnchanged = JSON.stringify(charges(afterBulkhead)) === JSON.stringify(charges(beforeBulkhead));
    assert.deepEqual(charges(afterBulkhead), charges(beforeBulkhead), "a client bulkhead decision never changes quotation charges before builder approval");
    assert.deepEqual(otherSelections(afterBulkhead), otherSelections(beforeBulkhead), "other selections unchanged");
    report.steps.bulkheadDecision = { choice: bulkheadChoice, standard: bulkheadStandard };

    report.steps.queueAfterBulkhead = await reviewQueue();
    assert(report.steps.queueAfterBulkhead.some(item => /^Cabinetry — Kitchen\n/.test(item)), "a bulkhead decision asks for Kitchen re-approval");
    assert(!report.steps.queueAfterBulkhead.some(item => /^Cabinetry — Kitchen\n/.test(item) && /Complete the Kitchen specification/.test(item)), "the room stays complete although the bulkhead price is unresolved");
    await page.waitForSelector('[data-testid="variation-summary"]');
    const variationRow = '[data-testid="variation-row"][data-kind="cabinetry-bulkhead"][data-room="Kitchen"]';
    await page.waitForSelector(variationRow);
    assert.equal(await page.$eval(variationRow, n => n.dataset.state), "builder_review");
    const reviewText = await page.$eval(variationRow, n => n.innerText);
    assert(reviewText.includes("Builder Review Required"));
    assert(reviewText.includes("Your builder will confirm the required measurements and pricing for this selection and provide a final variation amount for your approval."));
    assert(!/\$0\.00/.test(reviewText), "an unresolved price is never shown as $0");
    assert.equal(await page.$eval('[data-testid="variation-summary"]', n => n.dataset.canIssue), "false", "summary with unresolved prices cannot be issued as final");
    report.steps.variationRowsBefore = await page.$$eval('[data-testid="variation-row"]', nodes => nodes.map(n => ({ room: n.dataset.room, kind: n.dataset.kind, state: n.dataset.state })));
    await page.screenshot({ path: path.join(out, "v1-variation-builder-review.png"), fullPage: true });

    await page.$eval('[data-testid="variation-estimator-toggle"]', b => b.click());
    await page.waitForSelector('[data-testid="builder-review-queue"]');
    const bulkheadTasks = await page.$$eval('[data-testid="builder-review-task"]', nodes => nodes.filter(n => n.innerText.startsWith("Cabinetry bulkheads — Kitchen")).map(n => n.dataset.taskId));
    assert.equal(bulkheadTasks.length, 1, "exactly one builder-review task for the Kitchen bulkheads");
    report.steps.builderReviewTasks = await page.$eval('[data-testid="builder-review-queue"]', n => Number(n.dataset.count));
    const fill = async (selector, value) => { const input = await page.$(`${variationRow} ${selector}`); await input.click({ clickCount: 3 }); await input.type(value); };
    await fill('[data-testid="variation-review-quantity"]', "4.2");
    await fill('[data-testid="variation-review-price"]', "180");
    await page.$eval(`${variationRow} [data-testid="variation-review-save"]`, b => b.click());
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.state === "calculable", {}, variationRow);
    const expected = bulkheadChoice === "add" ? "+$831.60" : "-$831.60";
    assert((await page.$eval(`${variationRow} [data-testid="variation-amount"]`, n => n.textContent)).startsWith(expected), `estimated amount ${expected}`);
    assert(!(await page.$$eval('[data-testid="builder-review-task"]', nodes => nodes.map(n => n.dataset.taskId))).includes(bulkheadTasks[0]), "resolved task leaves the queue");
    assert.equal(await page.$(`${variationRow} [data-testid="variation-accept"]`), null, "client cannot accept before builder approval");
    await page.$eval(`${variationRow} [data-testid="variation-review-approve"]`, b => b.click());
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.state === "confirmed", {}, variationRow);
    assert((await page.$eval(`${variationRow} [data-testid="variation-acceptance"]`, n => n.textContent)).includes("Awaiting your decision"), "approval and acceptance are separate");
    await page.$eval(`${variationRow} [data-testid="variation-accept"]`, b => b.click());
    await page.waitForFunction(selector => document.querySelector(selector)?.innerText.includes("Client acceptance: Accepted"), {}, variationRow);
    let reviewed;
    for (let attempt = 0; attempt < 60; attempt++) {
      reviewed = await stored();
      if (Object.values(reviewed.clientSelectionsBook?.metadata?.selectionPricingReviews || {}).some(r => r.clientDecision === "accepted")) break;
      await delay(1000);
    }
    const storedReviews = Object.values(reviewed.clientSelectionsBook.metadata.selectionPricingReviews);
    assert.equal(storedReviews.length, 1);
    assert(storedReviews[0].approvedAt && storedReviews[0].clientDecision === "accepted" && storedReviews[0].quantity === 4.2 && storedReviews[0].unitPrice === 180);
    assert.deepEqual(charges(reviewed), charges(beforeBulkhead), "approval and acceptance do not silently change the approved quotation");
    report.steps.variationPricing = { estimated: expected, confirmed: true, accepted: true };
    await page.screenshot({ path: path.join(out, "v1-variation-confirmed-accepted.png"), fullPage: true });

    // Re-approve the changed Kitchen specification.
    await openKitchenReview();
    await clickText("Confirm & Approve Kitchen Cabinetry");
    await page.waitForFunction(() => document.querySelector(".cabinetryWorkflow")?.textContent.includes("Kitchen cabinetry approved"));
    approved = kitchenOf(await stored());
    assert(approved.reviewApproval && approved.bulkheadChoice?.choice === bulkheadChoice);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
    await openCabinetry();
    await page.waitForSelector('[data-testid="cabinetry-room-kitchen"][data-approved="true"]');
    await reviewQueue();
    await page.waitForSelector(variationRow);
    assert.equal(await page.$eval(variationRow, n => n.dataset.state), "confirmed", "confirmed variation survives reload");
    assert((await page.$eval(variationRow, n => n.innerText)).includes("Client acceptance: Accepted"));
    report.steps.v1Reload = "PASS";
    const downloadDir = path.join(out, projectId);
    fs.mkdirSync(downloadDir, { recursive: true });
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
    await clickText("File");
    await clickText("Download Backup Copy");
    let downloaded;
    for (let attempt = 0; attempt < 180; attempt++) {
      downloaded = fs.readdirSync(downloadDir).find(name => name.endsWith(".gr8job"));
      if (downloaded) break;
      await delay(1000);
    }
    assert(downloaded, "actual app export must complete");
    const exportedPath = path.join(downloadDir, downloaded);
    const exportedZip = await JSZip.loadAsync(fs.readFileSync(exportedPath));
    const exportedWorkbook = JSON.parse(await exportedZip.file("estimate.json").async("string")).workbook;
    assert.deepEqual(cabinetry(exportedWorkbook).locations.find(room => room.location === "Kitchen").reviewApproval, approved.reviewApproval, "validated app export retains approval");
    assert.equal(cabinetry(exportedWorkbook).locations.find(room => room.location === "Kitchen").bulkheadChoice?.choice, report.steps.bulkheadDecision.choice, "export keeps the bulkhead decision");
    assert.equal(Object.values(exportedWorkbook.clientSelectionsBook?.metadata?.selectionPricingReviews || {}).filter(r => r.approvedAt && r.clientDecision === "accepted").length, 1, "export keeps the builder review and client acceptance");
    assert.deepEqual(charges(exportedWorkbook), charges(baseline));
    report.steps.appExport = "PASS";
    await (await page.waitForSelector('[data-testid="open-local-job-file-input"]')).uploadFile(exportedPath);
    await delay(1000);
    await page.evaluate(() => { for (const text of ["Open Job", "Open Job File", "Use File", "Replace Local"]) [...document.querySelectorAll("button")].find(b => !b.disabled && b.textContent.trim() === text)?.click(); });
    await delay(5000);
    await openKitchenReview();
    assert(await page.$eval('[data-testid="cabinetry-review-confirm"]', node => node.textContent.includes("Approved - current specification")));
    assert.deepEqual(cabinetry(await stored()).locations.find(room => room.location === "Kitchen").reviewApproval, approved.reviewApproval);
    report.steps.reopen = "PASS";
    // Editing quantities is an estimator action.
    if (await page.$eval('[data-testid="cabinetry-view-toggle"]', n => n.dataset.view) !== "estimator") await page.$eval('[data-testid="cabinetry-view-toggle-button"]', b => b.click());
    await page.$eval('[data-testid="cabinetry-progress-menu"]', menu => [...menu.querySelectorAll("button")].find(b => /Cabinet Schedule/.test(b.textContent)).click());
    const line = baselineSelection.schedule.find(line => line.cabinetTypeId === "base_unit_1200_2door");
    const input = await page.waitForSelector(`[data-cabinet-item="${line.cabinetTypeId}"] input[type="number"]`);
    await input.click({ clickCount: 3 });
    await input.type(String(line.quantity + 1));
    for (let attempt = 0; attempt < 90; attempt++) {
      const next = cabinetry(await stored());
      if (next?.schedule.find(item => item.componentId === line.componentId)?.quantity === line.quantity + 1) break;
      await delay(1000);
    }
    report.steps.queueAfterModification = await reviewQueue();
    assert(report.steps.queueAfterModification.some(item => /^Cabinetry — Kitchen\n/.test(item)), "relevant quantity change requires Kitchen reapproval");
    report.steps.modification = "PASS";
    report.steps.preservedProductsPricesAndONovo = "PASS";
    console.log("PASS approval, immediate review queue, reload, repeat, actual export/reopen, modification, unchanged charges/selections/O.Novo");
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  if (!error.prepared) {
    report.failure = error.stack;
    report.failureText = await page.$eval("body", body => body.innerText).catch(() => "");
    await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  }
} finally {
  fs.writeFileSync(path.join(out, prepareCopy ? "prepared-copy.json" : reproduce ? "reproduction.json" : "acceptance.json"), JSON.stringify(report, null, 2));
  await browser.close();
  fs.unlinkSync(fixture);
}
