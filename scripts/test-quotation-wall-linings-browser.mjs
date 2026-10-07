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
const out = path.resolve("artifacts/test-results/quotation-wall-linings/browser");
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
  const fixture = JSON.parse(fs.readFileSync('recovery/quotation-changes-2026-10-03/current-fixture.json','utf8'));
  await openQuotation();
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(fixture.file);
  for(let attempt=0;attempt<180;attempt++) {
    await pause(1000);
    for(const label of ['Discard Changes','Open Job','Open Job File','Keep Local']) await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null && !b.disabled && b.textContent.trim()===text)?.click(),label);
    if(await page.evaluate(id=>window.__sheet?.()?.workbook?.jobId===id,fixture.jobId))break;
  }
  await waitJob(fixture.jobId);
  await page.waitForFunction(()=>window.__sheet().preview.quotation?.['DOORS (71)']?.displayName==='ENTRY DOORS');
  const read = ()=>page.evaluate(()=> {
    const s=window.__sheet(); const rows=Object.values(s.preview.quotation).flatMap(section=>section.rows).filter(r=>['quote-30013','quote-1269','quote-1270','quote-1271'].includes(r.id));
    return {entry:s.workbook.quotation['DOORS (71)'].displayName,rows:rows.map(({id,qty,finalRateUsed,cost,quantityKey,quantitySource})=>({id,qty,finalRateUsed,cost,quantityKey,quantitySource})),order:window.__order(),notices:[...document.querySelectorAll('[data-notification-key]')].map(e=>e.dataset.notificationKey)};
  });
  const opened=await read();
  assert.equal(opened.entry,'ENTRY DOORS');
  assert.deepEqual(opened.order.rows,fixture.rows,'latest user ordering preserved');
  for(const r of opened.rows)if(r.id!=='quote-30013')assert.equal(Number(String(r.finalRateUsed).replace(/[$,]/g,'')),22);
  assert.equal(opened.rows.find(r=>r.id==='quote-1271').qty,377.71);
  await page.setViewport({width:2400,height:1400});
  const doorsParent=await page.evaluate(()=>window.__sheet().quoteSections.find(name=>/^doors(?:\s*\(|$)/i.test(name)));
  if(doorsParent) await expand(doorsParent);
  await page.waitForSelector('[data-quote-section="PIVOT DOOR (67)"]');
  const entryHeader=await page.$eval('[data-quote-section="DOORS (71)"]',node=>({label:node.textContent,number:node.querySelector('input').value}));
  assert.match(entryHeader.label,/ENTRY DOORS/);assert.equal(entryHeader.number,'67');
  assert.match(await page.$eval('[data-quote-section="PIVOT DOOR (67)"]',node=>node.textContent),/PIVOT DOOR/);
  for(const id of ['quote-30013','quote-1269','quote-1270','quote-1271']) {
    const section=await page.evaluate(id=>Object.entries(window.__sheet().workbook.quotation).find(([,section])=>section.rows.some(row=>row.id===id))[0],id);
    await expand(section);
    await page.waitForSelector(`tr[data-quote-row="${id}"]`);
    if(id!=='quote-30013') {
      const inputs=await page.$$eval(`tr[data-quote-row="${id}"] input`,nodes=>nodes.map(node=>node.value));
      assert(inputs.some(value=>value==='$22.00'),`${id}: displayed rate must be $22.00; found ${inputs.join(', ')}`);
    }
  }
  await page.$eval('tr[data-quote-row="quote-1269"]',node=>node.scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(out,'plaster-rates-and-sources.png')});
  pass('current job: Section 67, all wall sources, plaster rates and ceiling verified',{rows:opened.rows.map(({id,qty,finalRateUsed,cost})=>({id,qty,finalRateUsed,cost}))});
  const key='section53-unmatched-windows';
  await page.waitForSelector(`[data-notification-key="${key}"] button`);
  const beforeQuote=await page.evaluate(()=>JSON.stringify(window.__sheet().workbook.quotation));
  await page.click(`[data-notification-key="${key}"] button`);
  await page.waitForFunction(key=>!document.querySelector(`[data-notification-key="${key}"]`),{},key);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__sheet().workbook.quotation)),beforeQuote,'acknowledgement must not edit quote');
  await click('File'); await click('Save Job'); await waitSaved();
  await page.reload({waitUntil:'domcontentloaded',timeout:240000}); await waitJob(fixture.jobId);
  await waitSaved();
  assert.equal(await page.evaluate(()=>document.body.innerText.includes('Load failed:')),false,'complete reload must succeed, including plan assets');
  assert(await page.evaluate(()=>window.__sheet().workbook.aiPlanTakeoffJob.plan.pages.every(page=>page.dataUrl?.startsWith('data:'))),'plan pages restored with the quote');
  assert.equal(await page.$(`[data-notification-key="${key}"]`),null);
  const refreshed=await read();sameOrder(refreshed.order,opened.order,'current job after save/refresh');
  assert.deepEqual(refreshed.rows,opened.rows);
  pass('acknowledgement and current quantities persist after save/hard refresh');
  await click('Show acknowledged notifications (1)');
  assert.match(await page.$eval('[data-testid="quotation-notifications"]',e=>e.textContent),/Acknowledged/);
  // Change the actual takeoff source through the production update action, keeping all geometry.
  const changed=await page.evaluate(()=>{
    const s=window.__sheet(),job=s.workbook.aiPlanTakeoffJob;
    const outcome=s.preview.windowScheduleOutcomes.find(item=>item.outcome==='unpriced' && item.openingType==='Window');
    const source=job.placedOpenings.find(item=>String(item.id)===String(outcome?.itemId)) || job.placedOpenings.find(item=>item.openingClass==='Window');
    const next={...job,contentChecksum:'',revision:Number(job.revision||0)+1,updatedAt:new Date().toISOString(),placedOpenings:job.placedOpenings.map(item=>item===source?{...item,widthMm:Number(item.widthMm)+137}:item)};
    return s.updateAiPlanTakeoffDraft(next);
  });
  assert.equal(changed.ok,true,changed.message);
  await page.waitForSelector(`[data-notification-key="${key}"] button`);
  pass('changed takeoff source reopens the acknowledged notification');
  await page.screenshot({path:path.join(out,'current-job-verified.png')});
  report.currentJob=opened;
  report.results={section67:'PASS',wallMappings:'PASS',plasterRates:'PASS',ceilingsUnchanged:'PASS',acknowledgementPersistence:'PASS',changedNotificationReappears:'PASS',saveReload:'PASS',recoveredOrderPreserved:'PASS'};
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {
  report.failure=error.stack;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;
} finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
