// Real UI test of the reported failure: reorder quotation lines and sections, then prove the exact
// order survives Save -> hard refresh, close / reopen, Master Template update / reload, and
// export / re-import of the .gr8job. Compares stable row ids and the persisted sortOrder fields.
// Isolated Chrome profile, mocked sign-in, no customer account or existing file is touched.
//   node --import ./scripts/register-json-loader.mjs scripts/test-quotation-order-persistence-browser.mjs --origin=http://localhost:3000
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { readJob } from "../lib/jobFile.ts";

dotenv.config({ path: ".env.local", quiet: true });
const baseUrl = process.argv.find((arg) => arg.startsWith("--origin="))?.slice("--origin=".length) || "http://localhost:3000";
const out = path.resolve("artifacts/test-results/quotation-order-persistence");
fs.mkdirSync(out, { recursive: true });
const jobName = "Quotation Order Persistence Test";
const report = { passed: false, results: {}, steps: [], errors: [], dialogs: [] };
const pass = (name, detail = {}) => { report.steps.push({ name, ...detail }); fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2)); console.log("PASS", name, JSON.stringify(detail).slice(0, 300)); };

const browser = await puppeteer.launch({ headless: true, pipe: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", defaultViewport: { width: 1700, height: 1100 }, protocolTimeout: 240000, timeout: 90000 });
const page = await browser.newPage();
page.setDefaultTimeout(180000);
page.on("pageerror", (error) => { report.errors.push(error.message); console.error("PAGE ERROR", error.message); });
page.on("dialog", async (dialog) => { report.dialogs.push(dialog.message()); await dialog.accept(); });
const user = { id: "00000000-0000-4000-8000-000000000001", email: "quotation-order@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = new URL(request.url());
  if (!["http:", "https:"].includes(url.protocol)) return request.continue();
  if (url.origin === new URL(baseUrl).origin && !url.pathname.startsWith("/api/")) return request.continue();
  let body = {};
  if (url.pathname.includes("/auth/v1/user")) body = user;
  else if (url.pathname.includes("/rest/v1/accounts")) body = { approved: true, is_approved: true, status: "active", subscription_status: "active" };
  else if (url.pathname === "/api/workspaces") body = { workspaces: [] };
  else if (url.pathname.includes("/rest/v1/")) body = [];
  request.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS" }, body: JSON.stringify(body) });
});
const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
await page.evaluateOnNewDocument(({ authKey, user }) => {
  localStorage.setItem(authKey, JSON.stringify({ access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  localStorage.setItem("estimate-builder-permission-mode", "admin");
  window.__masterFileName = window.__masterFileName || "";
  window.showSaveFilePicker = async (options) => {
    window.__masterFileName = options.suggestedName;
    sessionStorage.setItem("__masterFileName", options.suggestedName);
    return (await navigator.storage.getDirectory()).getFileHandle(options.suggestedName, { create: true });
  };
  window.__findFiber = (predicate) => {
    let fiber = null;
    for (const element of document.querySelectorAll("#__next, input, button")) {
      fiber = element[Object.keys(element).find((key) => key.startsWith("__reactContainer$") || key.startsWith("__reactFiber$"))];
      if (fiber) break;
    }
    if (!fiber) return null;
    while (fiber.return) fiber = fiber.return;
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) {
      const current = stack.pop();
      if (predicate(current)) return current;
      if (current.sibling) stack.push(current.sibling);
      if (current.child) stack.push(current.child);
    }
    return null;
  };
  window.__sheet = () => window.__findFiber((fiber) => Boolean(fiber.memoizedProps?.sheet?.workbook))?.memoizedProps.sheet;
  // The order as the app holds it: displayed section order, row ids and the persisted order fields.
  window.__orderOf = (workbook, sections) => ({
    sections,
    rows: Object.fromEntries(Object.entries(workbook.quotation).map(([name, section]) => [name, (section.rows || []).map((row) => row.id)])),
    stampsOk: Object.entries(workbook.quotation).every(([name, section]) => (section.rows || []).every((row, index) => row.sortOrder === index + 1 && row.sortSection === name)),
    sectionStamps: sections.map((name) => workbook.quotation[name]?.sortOrder),
  });
  window.__order = () => { const sheet = window.__sheet(); return window.__orderOf(sheet.workbook, sheet.quoteSections); };
  window.__db = (storeName, run) => new Promise((resolve, reject) => {
    const open = indexedDB.open("estimate-builder-template-db", 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const request = run(db.transaction(storeName).objectStore(storeName)); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; };
  });
}, { authKey, user });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === text && !button.disabled), { polling: 300 }, label);
  await page.evaluate((text) => [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === text && !button.disabled).click(), label);
}
const status = () => page.$eval('[data-testid="job-persistence-status"]', (node) => node.textContent.trim());
const waitSaved = async () => {
  await page.waitForFunction(() => /^Saved at/.test(document.querySelector('[data-testid="job-persistence-status"]')?.textContent.trim() || ""), { polling: 300 });
  assert.equal(await page.evaluate(() => document.body.innerText.includes("Save failed")), false);
};
const order = () => page.evaluate(() => window.__order());
const waitJob = (jobId) => page.waitForFunction((id) => { const sheet = window.__sheet?.(); return sheet?.hydrated && sheet.workbook?.jobId === id && Object.keys(sheet.workbook.quotation || {}).length > 20; }, { polling: 500 }, jobId);
const storedOrder = (jobId) => page.evaluate(async (id) => {
  const record = await window.__db("jobs", (store) => store.get(`job:${id}`));
  const sections = Object.keys(record.workbook.quotation).sort((a, b) => record.workbook.quotation[a].sortOrder - record.workbook.quotation[b].sortOrder);
  return { ...window.__orderOf(record.workbook, sections), revision: record.revision };
}, jobId);
const sameOrder = (actual, expected, label) => {
  assert.deepEqual(actual.sections, expected.sections, `${label}: section order`);
  assert.deepEqual(actual.rows, expected.rows, `${label}: line order (row ids)`);
  assert.equal(actual.stampsOk, true, `${label}: every line carries its sortOrder`);
  assert.deepEqual(actual.sectionStamps, expected.sections.map((_, index) => index + 1), `${label}: every section carries its sortOrder`);
};
// Real HTML5 drag and drop on the quotation rows / section headers.
const drag = (rowId, target) => page.evaluate(({ rowId, target }) => {
  const source = document.querySelector(`tr[data-quote-row="${CSS.escape(rowId)}"]`);
  const destination = target.rowId
    ? document.querySelector(`tr[data-quote-row="${CSS.escape(target.rowId)}"]`)
    : document.querySelector(`[data-quote-section="${CSS.escape(target.section)}"] > div`);
  if (!source || !destination) throw new Error(`drag elements missing: ${rowId} -> ${JSON.stringify(target)}`);
  const dataTransfer = new DataTransfer();
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
  destination.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
  destination.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  source.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
}, { rowId, target });
const expand = (section) => page.evaluate((name) => {
  const element = document.querySelector(`[data-quote-section="${CSS.escape(name)}"]`);
  if (!element.querySelector("tr[data-quote-row]")) element.querySelector(":scope > div > button").click();
}, section);
const visibleRows = (section) => page.evaluate((name) => [...document.querySelectorAll(`[data-quote-section="${CSS.escape(name)}"] tr[data-quote-row]`)].map((row) => row.dataset.quoteRow), section);
const openQuotation = async () => {
  await page.goto(`${baseUrl}/modules/estimate-builder?page=quotation`, { waitUntil: "domcontentloaded", timeout: 240000 });
};
const lastExportedFile = async () => {
  const file = await page.evaluate(async () => {
    const name = window.__masterFileName || sessionStorage.getItem("__masterFileName");
    const handle = await (await navigator.storage.getDirectory()).getFileHandle(name);
    return { name: handle.name, bytes: [...new Uint8Array(await (await handle.getFile()).arrayBuffer())] };
  });
  const bytes = Buffer.from(file.bytes);
  return { name: file.name, bytes, data: await readJob({ getFile: async () => new File([bytes], file.name) }) };
};

try {
  // 1. Open a job.
  await openQuotation();
  await click("File");
  await click("Create New Job");
  await page.waitForSelector('[aria-label="Create new job"]');
  await page.evaluate((name) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const label of document.querySelectorAll('[aria-label="Create new job"] label')) {
      const input = label.querySelector("input");
      const value = { "Job Name": name, "Client Name": name, "Job Number": "QOP-001", Address: "1 Order Street, Brisbane" }[label.querySelector("span")?.textContent];
      if (input && value) { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }, jobName);
  await click("Create Job");
  await page.waitForFunction(() => /^[0-9a-f-]{36}$/i.test(window.__sheet?.()?.workbook?.jobId || ""), { polling: 500 });
  const jobId = await page.evaluate(() => window.__sheet().workbook.jobId);
  if (new URL(page.url()).searchParams.get("page") !== "quotation") { await openQuotation(); await waitJob(jobId); }
  await page.waitForSelector("[data-quote-section]");
  await waitSaved();

  // 2. Record the original ordering.
  const original = await order();
  assert.equal(original.stampsOk, true, "a new job already carries persisted order fields");
  pass("job opened and original order recorded", { jobId, sections: original.sections.length, lines: Object.values(original.rows).flat().length });

  // Three sections with at least six rendered lines each.
  const candidates = [];
  for (const section of original.sections) {
    if (candidates.length === 3) break;
    if ((original.rows[section] || []).length < 6) continue;
    await expand(section);
    await pause(250);
    const rows = await visibleRows(section);
    if (rows.length >= 6 && rows.every((id) => original.rows[section].includes(id))) candidates.push(section);
  }
  assert.equal(candidates.length, 3, "three sections with visible lines");
  const [first, second, third] = candidates;

  // 3 + 4. Move six lines to obviously different positions, within sections and across sections.
  const moved = [];
  const move = async (section, pick, target) => {
    const rows = await visibleRows(section);
    const rowId = pick(rows);
    const before = JSON.stringify((await order()).rows);
    await drag(rowId, target(rows, rowId));
    await page.waitForFunction((previous) => JSON.stringify(window.__order().rows) !== previous, { polling: 200 }, before);
    moved.push(rowId);
  };
  await move(first, (rows) => rows.at(-1), (rows) => ({ rowId: rows[0] }));
  const dirtyStatus = await status();
  assert.equal(dirtyStatus, "Unsaved changes", "a move shows UNSAVED before anything is persisted");
  await move(first, (rows) => rows[2], (rows) => ({ rowId: rows[5] }));
  await move(second, (rows) => rows[0], () => ({ section: second }));
  await move(second, (rows) => rows[4], (rows) => ({ rowId: rows[1] }));
  const firstRows = await visibleRows(first);
  await move(third, (rows) => rows[2], () => ({ rowId: firstRows[3] }));
  await move(third, (rows) => rows[0], (rows) => ({ rowId: rows[4] }));
  assert.equal(new Set(moved).size, 6);
  await page.screenshot({ path: path.join(out, "01-lines-moved.png") });

  // 5. Reorder sections through Manage Section Order.
  await click("Manage Section Order");
  await page.evaluate(() => {
    const items = [...document.querySelectorAll("div[draggable='true']")].filter((item) => [...item.querySelectorAll("button")].some((button) => button.textContent.trim() === "Move Down"));
    const down = (item) => [...item.querySelectorAll("button")].find((button) => button.textContent.trim() === "Move Down");
    for (let step = 0; step < 3; step += 1) down(items[1]).click();
  });
  await pause(300);
  await page.evaluate(() => {
    const items = [...document.querySelectorAll("div[draggable='true']")].filter((item) => [...item.querySelectorAll("button")].some((button) => button.textContent.trim() === "Move Up"));
    const up = [...items[8].querySelectorAll("button")].find((button) => button.textContent.trim() === "Move Up");
    for (let step = 0; step < 2; step += 1) up.click();
  });
  await pause(300);
  await click("Save Order");
  await page.waitForFunction((previous) => JSON.stringify(window.__order().sections) !== previous, { polling: 200 }, JSON.stringify(original.sections));
  const arranged = await order();
  assert.notDeepEqual(arranged.sections, original.sections);
  for (const section of candidates) assert.notDeepEqual(arranged.rows[section], original.rows[section], section);
  assert.equal(arranged.stampsOk, true, "moves are written onto the lines immediately");
  pass("6 lines moved (within and across sections) and sections reordered", { moved, firstSections: arranged.sections.slice(0, 10) });

  // 6. Save Job. SAVED must mean the order is in the stored record.
  await click("File");
  await click("Save Job");
  await waitSaved();
  sameOrder(await storedOrder(jobId), arranged, "stored job record after Save Job");
  sameOrder(await order(), arranged, "page after Save Job");
  pass("Save Job: SAVED status and the stored record holds the new order", { status: await status() });

  // 7 + 8. Hard refresh.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await waitJob(jobId);
  sameOrder(await order(), arranged, "after hard refresh");
  report.results.saveHardRefresh = "PASS";
  await page.screenshot({ path: path.join(out, "02-after-hard-refresh.png") });
  pass("Save -> hard refresh: exact order remains");

  // 9 + 10. Close and reopen the job.
  await click("File");
  await click("Close Job");
  await page.waitForFunction((id) => window.__sheet?.()?.workbook?.jobId !== id, { polling: 300 }, jobId);
  const reopened = await page.evaluate((id) => window.__sheet().openSavedJob(`job:${id}`), jobId);
  assert.equal(reopened.ok, true, reopened.message);
  await waitJob(jobId);
  sameOrder(await order(), arranged, "after close / reopen");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await waitJob(jobId);
  sameOrder(await order(), arranged, "after close / reopen / refresh");
  report.results.saveCloseReopen = "PASS";
  pass("Save -> close -> reopen: exact order remains");

  // 11 - 13. Update the Master Template, reload it, and create a job from it.
  if (new URL(page.url()).searchParams.get("page") !== "quotation") { await openQuotation(); await waitJob(jobId); }
  await click("File");
  await click("Update Master Template");
  await page.waitForFunction(async () => Boolean((await window.__db("templates", (store) => store.get("template:master-estimate-template")))?.workbook?.quotation), { polling: 500 });
  const templateOrder = await page.evaluate(async () => {
    const record = await window.__db("templates", (store) => store.get("template:master-estimate-template"));
    const sections = Object.keys(record.workbook.quotation).sort((a, b) => record.workbook.quotation[a].sortOrder - record.workbook.quotation[b].sortOrder);
    return window.__orderOf(record.workbook, sections);
  });
  sameOrder(templateOrder, arranged, "stored Master Template");
  const loadedTemplate = await page.evaluate(() => window.__sheet().loadTemplate("template:master-estimate-template"));
  assert.equal(loadedTemplate.ok, true, loadedTemplate.message);
  await page.waitForFunction(() => window.__sheet().workbook.templateType === "master_base_template" || !window.__sheet().workbook.jobId, { polling: 300 });
  sameOrder(await order(), arranged, "Master Template reloaded");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await waitJob(jobId);
  const created = await page.evaluate(() => window.__sheet().createJobFromTemplate({ jobName: "From Template", clientName: "From Template", jobNumber: "QOP-002" }));
  assert.equal(created.ok, true, created.message);
  await page.waitForFunction((id) => { const current = window.__sheet().workbook.jobId; return current && current !== id; }, { polling: 300 }, jobId);
  sameOrder(await order(), arranged, "new job created from the updated Master Template");
  report.results.masterTemplateSaveReload = "PASS";
  pass("Master Template update -> reload -> new job: exact order remains");

  // 14 - 16. Export the job to a .gr8job, change the order, then re-import the file.
  const back = await page.evaluate((id) => window.__sheet().openSavedJob(`job:${id}`), jobId);
  assert.equal(back.ok, true, back.message);
  await waitJob(jobId);
  if (new URL(page.url()).searchParams.get("page") !== "quotation") { await openQuotation(); await waitJob(jobId); }
  sameOrder(await order(), arranged, "original job reopened before export");
  await click("File");
  await click("Save Job to Computer");
  await page.waitForFunction(() => Boolean(window.__masterFileName || sessionStorage.getItem("__masterFileName")), { polling: 300 });
  await waitSaved();
  const exported = await lastExportedFile();
  const exportedWorkbook = exported.data.workbook;
  const exportedSections = Object.keys(exportedWorkbook.quotation).sort((a, b) => exportedWorkbook.quotation[a].sortOrder - exportedWorkbook.quotation[b].sortOrder);
  assert.deepEqual(exportedSections, arranged.sections, "exported file: section sortOrder");
  for (const [name, section] of Object.entries(exportedWorkbook.quotation)) {
    assert.deepEqual((section.rows || []).map((row) => row.id), arranged.rows[name], `exported file: ${name}`);
    (section.rows || []).forEach((row, index) => assert.equal(row.sortOrder, index + 1, `exported file sortOrder ${name}`));
  }
  // Disturb the stored job so the import has to restore the order from the file itself.
  await page.waitForSelector("[data-quote-section]");
  await expand(first);
  await pause(300);
  const disturbRows = await visibleRows(first);
  const beforeDisturb = JSON.stringify((await order()).rows);
  await drag(disturbRows[0], { section: first });
  await page.waitForFunction((previous) => JSON.stringify(window.__order().rows) !== previous, { polling: 200 }, beforeDisturb);
  await click("File");
  await click("Save Job");
  await waitSaved();
  assert.notDeepEqual((await storedOrder(jobId)).rows[first], arranged.rows[first]);
  const exportPath = path.join(os.tmpdir(), `quotation-order-test-${Date.now()}.gr8job`);
  fs.writeFileSync(exportPath, exported.bytes);
  await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(exportPath);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await pause(1000);
    for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) await page.evaluate((text) => [...document.querySelectorAll("button")].find((button) => button.offsetParent !== null && !button.disabled && button.innerText.trim() === text)?.click(), label);
    if (JSON.stringify((await order()).rows[first]) === JSON.stringify(arranged.rows[first])) break;
  }
  await page.waitForFunction((expected) => JSON.stringify(window.__order().rows) === expected, { polling: 500 }, JSON.stringify(arranged.rows));
  sameOrder(await order(), arranged, "after re-importing the exported .gr8job");
  await waitSaved();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await waitJob(jobId);
  sameOrder(await order(), arranged, "after re-import and hard refresh");
  fs.rmSync(exportPath, { force: true });
  report.results.exportImportJob = "PASS";
  pass("Export .gr8job -> re-import: exact order remains", { file: exported.name, bytes: exported.bytes.length });

  // Every moved line is still where it was put.
  const final = await order();
  for (const rowId of moved) {
    const section = Object.keys(arranged.rows).find((name) => arranged.rows[name].includes(rowId));
    assert.equal(final.rows[section].indexOf(rowId), arranged.rows[section].indexOf(rowId), `moved line ${rowId}`);
    assert.notEqual(Object.keys(original.rows).find((name) => original.rows[name].includes(rowId)) === section && original.rows[section].indexOf(rowId), final.rows[section].indexOf(rowId), `moved line ${rowId} did not return to its old position`);
  }
  report.results.manuallyReorderedLinesPreserved = "PASS";

  // Storage hygiene: old revisions are pruned, and persistent storage was requested.
  const storage = await page.evaluate(async (id) => {
    const keys = await window.__db("jobs", (store) => store.getAllKeys());
    const revision = (await window.__db("jobs", (store) => store.get(`job:${id}`))).revision;
    return { revision, revisionCopies: keys.filter((key) => String(key).startsWith(`job:${id}:snapshot:revision-`)).length, persisted: await navigator.storage.persisted() };
  }, jobId);
  assert(storage.revision > 3, "several saves happened");
  assert(storage.revisionCopies <= 3, `old revisions are pruned (found ${storage.revisionCopies})`);
  pass("moved lines preserved; old revisions pruned", storage);

  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, ...report.results }));
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
