// Live check: Client Selections -> Interior -> Stairs & Balustrades landing page.
// Two large equal feature cards, real stair / balustrade photos, identical image viewports,
// readable text (>= 16px computed), Balustrade LM selection at "Internal Stair" shown on the card
// after save + reload, Stairs wizard opens and returns to the hub, single column on mobile.
// Writes to Supabase are blocked; the job lives in the browser's local job store only.
//
// Usage (dev server running): node scripts/verify-stairs-balustrades-landing-live.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { CS_TYPE } from "../lib/builders/clientSelectionsTypography.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const origin = process.env.INTERNAL_TEST_ORIGIN || "http://localhost:3000";
const out = path.resolve("test-artifacts/stairs-balustrades-landing-live");
fs.mkdirSync(out, { recursive: true });

const projectId = "stairs-balustrades-landing-20260930";
const defaults = createEstimateBuilderWorkbookDefaults();
delete defaults.aiPlanTakeoffJob;
delete defaults.takeoffEngine;
delete defaults.takeoffSchedule;
delete defaults.clientSelectionsBook;
const workbook = { ...defaults, templateType: "job", page: "clientSelections", projectId, commercialProjectId: projectId, registeredJobId: projectId, registeredJob: { jobId: projectId, jobName: "Stairs & Balustrades Landing Verification", jobNumber: "SB-TEST", clientName: "Test client", siteAddress: "Test address" } };
const fixture = path.join(out, "stairs-balustrades-test-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: "Stairs & Balustrades Landing Verification", workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (error) throw error;
const authClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: auth, error: authError } = await authClient.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (authError) throw authError;

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 300000, defaultViewport: { width: 1920, height: 1080 } });
const errors = [];
const report = { steps: [] };
let page;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  page = await browser.newPage();
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.url().includes("/rest/v1/") && !["GET", "HEAD", "OPTIONS"].includes(r.method()) ? r.abort() : r.continue()));
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`, session: auth.session });

  const click = async (text, exact = true, scope = "button") => {
    await page.waitForFunction((text, exact, scope) => {
      const b = [...document.querySelectorAll(scope)].find((b) => !b.disabled && b.offsetParent !== null && (exact ? b.innerText.trim() === text : b.innerText.includes(text)));
      if (!b) return false;
      b.click();
      return true;
    }, {}, text, exact, scope);
    await sleep(700);
  };
  const shot = async (name, selector) => {
    const file = path.join(out, `${name}.png`);
    if (selector) await (await page.$(selector)).screenshot({ path: file });
    else await page.screenshot({ path: file });
    report.steps.push(name);
    console.log("shot", name);
  };
  // Every visible element that directly renders text, with its computed font size.
  const tinyText = (rootSelector) => page.$eval(rootSelector, (root, min) => {
    const found = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest(".guidedStatusDot") || ["OPTION", "SCRIPT", "STYLE"].includes(el.tagName)) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
      if (!text) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < min) found.push(`${el.tagName.toLowerCase()}.${el.className || ""} ${size}px "${text.slice(0, 50)}"`);
    }
    return found;
  }, CS_TYPE.minimum);
  const load = async (file) => {
    await page.waitForSelector('[data-testid="open-local-job-file-input"]');
    await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(file);
    for (let i = 0; i < 4; i += 1) {
      await sleep(1300);
      const labels = await page.$$eval("button", (bs) => bs.map((b) => b.innerText.trim()));
      for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) if (labels.includes(label)) await click(label);
    }
  };
  const hub = '[data-testid="guided-category-stairs-balustrades"]';
  const cabinetryCardText = () => page.evaluate(() => ([...document.querySelectorAll("button")].find((b) => /^Cabinetry/.test(b.innerText.trim()))?.innerText || "").replace(/s+/g, " "));
  const openHub = async () => {
    const openKey = async (key) => {
      await page.waitForSelector(`button[data-category-key="${key}"]`);
      await page.$eval(`button[data-category-key="${key}"]`, (b) => b.click());
      await sleep(900);
    };
    // The area tiles can re-render while the job file finishes loading; retry the Interior click.
    for (let attempt = 0; attempt < 10 && !(await page.$('button[data-category-key="stairs-balustrades"]')); attempt += 1) {
      await page.$eval('button[data-category-key="interior"]', (b) => b.click()).catch(() => {});
      await sleep(1500);
    }
    await page.waitForSelector('button[data-category-key="stairs-balustrades"]');
    report.cabinetryCardSeen = report.cabinetryCardSeen || [];
    report.cabinetryCardSeen.push(await cabinetryCardText());
    await openKey("stairs-balustrades");
    await page.waitForSelector(`${hub} [data-testid="feature-category-grid"]`);
    await page.waitForFunction((hub) => [...document.querySelectorAll(`${hub} .featureCategoryImage img`)].every((i) => i.complete && i.naturalWidth > 0), {}, hub);
  };
  const measureHub = () => page.$eval(hub, (root) => {
    const cards = [...root.querySelectorAll(".featureCategoryCard")];
    return {
      keys: cards.map((c) => c.dataset.requirementKey),
      widths: cards.map((c) => Math.round(c.getBoundingClientRect().width)),
      lefts: cards.map((c) => Math.round(c.getBoundingClientRect().left)),
      tops: cards.map((c) => Math.round(c.getBoundingClientRect().top)),
      imageBoxes: cards.map((c) => { const r = c.querySelector(".featureCategoryImage").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
      images: cards.map((c) => { const i = c.querySelector(".featureCategoryImage img"); return { src: i.getAttribute("src"), natural: [i.naturalWidth, i.naturalHeight], fit: getComputedStyle(i).objectFit }; }),
      titleSizes: cards.map((c) => parseFloat(getComputedStyle(c.querySelector("h3")).fontSize)),
      buttonSizes: cards.map((c) => parseFloat(getComputedStyle(c.querySelector(".featureCategoryBody > button")).fontSize)),
      buttonLabels: cards.map((c) => c.querySelector(".featureCategoryBody > button").innerText.trim()),
      gridWidth: Math.round(root.querySelector(".featureCategoryGrid").getBoundingClientRect().width),
      shellWidth: Math.round(root.getBoundingClientRect().width),
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  });

  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await load(fixture);
  await sleep(5000);

  // 1. Landing page: exactly two large equal cards, identical image viewports, real photos.
  await openHub();
  const desktop = await measureHub();
  report.desktop = desktop;
  assert.deepEqual(desktop.keys, ["stairs", "balustrades"]);
  assert.equal(desktop.widths[0], desktop.widths[1], "cards equal width");
  assert.ok(desktop.gridWidth >= desktop.shellWidth - 4, `feature grid uses the full content width (${desktop.gridWidth} of ${desktop.shellWidth})`);
  assert.ok(desktop.widths[0] * 2 >= desktop.gridWidth - 40, `two cards fill the row (${desktop.widths[0]}px each)`);
  assert.ok(desktop.widths[0] >= 520, `cards substantially larger at 1920 (${desktop.widths[0]}px)`);
  assert.equal(desktop.tops[0], desktop.tops[1], "side by side on desktop");
  assert.deepEqual(desktop.imageBoxes[0], desktop.imageBoxes[1], "identical image viewports");
  assert.ok(desktop.imageBoxes[0][1] >= 280 && desktop.imageBoxes[0][1] <= 340, `image viewport height ${desktop.imageBoxes[0][1]}`);
  assert.match(desktop.images[0].src, /internal-areas\/systems\/d687852e34b46b7abb0e013c\.jpg$/, "stairs card uses the Product Library staircase photo");
  assert.match(desktop.images[1].src, /\/images\/catalogues\/exterior\/balustrades\//, "balustrades card uses a balustrade photo");
  desktop.images.forEach((image) => { assert.ok(image.natural[0] > 0); assert.equal(image.fit, "cover"); });
  desktop.titleSizes.forEach((size) => assert.ok(size > CS_TYPE.minimum));
  desktop.buttonSizes.forEach((size) => assert.ok(size >= CS_TYPE.minimum));
  assert.deepEqual(desktop.buttonLabels, ["View Stairs", "View Balustrades"]);
  assert.deepEqual(await tinyText(hub), [], "hub text >= 16px");
  await shot("01-desktop-landing-empty");

  // 2. Balustrades: pick a frameless channel top-mount system, allocate LM to Internal Stair + Void.
  await click("View Balustrades");
  await page.waitForSelector('[data-testid="guided-balustrade-workflow"]');
  await page.waitForSelector('[data-testid="balustrade-system-card"]');
  report.balustradeTinyText = await tinyText('[data-testid="guided-balustrade-workflow"]');
  assert.deepEqual(report.balustradeTinyText, [], "balustrade workflow text >= 16px");
  await shot("02-balustrade-range");
  const channelIndex = await page.$$eval('[data-testid="balustrade-system-card"]', (cards) => cards.findIndex((c) => /Channel Top/i.test(c.innerText)));
  assert.ok(channelIndex >= 0, "frameless channel top-mount system listed");
  await page.$$eval('[data-testid="balustrade-select"]', (buttons, i) => buttons[i].click(), channelIndex);
  await page.waitForSelector('[data-testid="balustrade-configurator"]');
  const locationKeys = await page.$$eval('[data-testid^="balustrade-lm-"]', (inputs) => inputs.map((i) => i.dataset.testid));
  report.locationInputs = locationKeys;
  const internalStair = locationKeys.find((key) => /internal-stair/i.test(key));
  assert.ok(internalStair, `Internal Stair location offered (${locationKeys.join(", ")})`);
  const voidKey = locationKeys.find((key) => /void/i.test(key));
  const setValue = (selector, value) => page.$eval(selector, (i, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, value); i.dispatchEvent(new Event("input", { bubbles: true })); }, value);
  await setValue(`[data-testid="${internalStair}"]`, "4.6");
  await setValue(`[data-testid="${voidKey}"]`, "3.2");
  await sleep(400);
  report.configuratorTinyText = await tinyText('[data-testid="balustrade-configurator"]');
  assert.deepEqual(report.configuratorTinyText, [], "configurator text >= 16px");
  await shot("03-balustrade-configurator", '[data-testid="balustrade-configurator"]');
  await page.$eval('[data-testid="balustrade-save"]', (b) => b.click());
  await page.waitForSelector('[data-testid="balustrade-selected-line"]');
  const lineText = await page.$eval('[data-testid="balustrade-selected-line"]', (e) => e.innerText);
  assert.match(lineText, /Internal Stair 4\.6 LM/);
  assert.match(lineText, /7\.8/);
  await shot("04-balustrade-selected-line");

  // 3. Back on the landing page: concise readable selected summary + Edit button.
  await click("← Stairs & Balustrades", false);
  await page.waitForSelector(`${hub} [data-testid="feature-category-selection"]`);
  const summary = await page.$eval(`${hub} [data-requirement-key="balustrades"] [data-testid="feature-category-selection"]`, (e) => e.innerText);
  report.balustradeSummary = summary;
  assert.match(summary, /SELECTED/i);
  assert.match(summary, /Channel/i);
  assert.match(summary, /7\.8 LM/);
  assert.equal((await measureHub()).buttonLabels[1], "Edit Balustrade Selections");
  assert.deepEqual(await tinyText(hub), [], "hub text with selection >= 16px");
  await shot("05-desktop-landing-balustrade-selected");

  // 4. Persistence: save, reload, the selection is still on the card.
  await click("Save Progress", false).catch(() => {});
  await sleep(2500);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await sleep(6000);
  report.savedRows = await page.evaluate(async (key) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open("estimate-builder-template-db"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      const record = await new Promise((resolve, reject) => { const r = db.transaction("jobs", "readonly").objectStore("jobs").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const book = record?.workbook?.clientSelectionsBook || {};
      return (book.rooms || []).flatMap((room) => (room.rows || []).filter((row) => row.guidedSelection || row.guidedRequirementKey).map((row) => ({ room: room.name, item: row.item, key: row.guidedRequirementKey, owner: row.guidedSelection?.requirementKey })));
    } finally { db.close(); }
  }, "job:" + projectId);
  if (!(await page.$(hub))) await openHub();
  await page.waitForSelector(`${hub} [data-requirement-key="balustrades"] [data-testid="feature-category-selection"]`);
  assert.match(await page.$eval(`${hub} [data-requirement-key="balustrades"] [data-testid="feature-category-selection"]`, (e) => e.innerText), /7\.8 LM/);
  report.persistedAfterReload = true;

  // 5. Edit Balustrade Selections reopens the workflow with the saved line.
  await click("Edit Balustrade Selections");
  await page.waitForSelector('[data-testid="balustrade-selected-line"]');
  await click("← Stairs & Balustrades", false);
  await page.waitForSelector(hub);

  // 6. View Stairs opens the stair workflow; its Back returns to this hub.
  await click("View Stairs");
  await page.waitForSelector('[data-testid="stair-selection-wizard"]');
  await page.waitForSelector('[data-testid="stair-type-card"]');
  report.stairTypes = await page.$$eval('[data-testid="stair-type-card"] strong', (e) => e.map((x) => x.innerText));
  await page.$eval('[data-testid="stair-type-card"]', (b) => b.click());
  await page.waitForSelector('[data-testid="stair-plan-card"]');
  report.stairPlans = await page.$$eval('[data-testid="stair-plan-card"] strong', (e) => e.map((x) => x.innerText));
  report.stairTinyText = await tinyText('[data-testid="stair-selection-wizard"]');
  assert.deepEqual(report.stairTinyText, [], "stair wizard text >= 16px");
  await shot("06-stairs-wizard");
  await page.$eval('[data-testid="stair-back"]', (b) => b.click());
  await page.waitForSelector(`${hub} [data-testid="feature-category-grid"]`);

  // 7. Tablet / mobile: one column, no horizontal page scroll.
  for (const [name, width] of [["tablet", 900], ["mobile", 390]]) {
    await page.setViewport({ width, height: 1000 });
    await sleep(800);
    const m = await measureHub();
    report[name] = m;
    assert.equal(m.lefts[0], m.lefts[1], `${name}: single column`);
    assert.ok(m.pageWidth <= m.viewport, `${name}: no horizontal scroll (${m.pageWidth} > ${m.viewport})`);
    assert.deepEqual(m.imageBoxes[0], m.imageBoxes[1], `${name}: identical image viewports`);
    await page.$eval(hub, (e) => e.scrollIntoView());
    await shot(`07-${name}-landing`);
  }

  report.errors = errors.filter((e) => !/Failed to load resource|net::ERR_FAILED|status of 4\d\d/.test(e));
  assert.deepEqual(report.errors, [], "no page errors");
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.passed = false;
  report.error = e.message;
  report.errors = errors;
  if (page) await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
