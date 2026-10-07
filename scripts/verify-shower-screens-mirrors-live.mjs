// Live check of Client Selections > Interior > Shower Screens & Mirrors against the local app.
// Uses a disposable job (2 showers in its AI Plan Takeoff fixtures) and blocks database writes.
//   node --import ./scripts/register-json-loader.mjs scripts/verify-shower-screens-mirrors-live.mjs --origin=http://localhost:3000
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { clientSelectionCategoryProducts } from "../lib/product-library/plumbingFixtureCatalogue.js";
import { guidedRequirementByKey } from "../lib/builders/clientSelectionWorkflow.js";
import { selectionGroupsForRequirement } from "../lib/product-library/showerScreenMirrorCatalogue.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const origin = process.argv.find((arg) => arg.startsWith("--origin="))?.slice("--origin=".length) || process.env.INTERNAL_TEST_ORIGIN || "http://localhost:3000";
const out = path.resolve("artifacts/test-artifacts/shower-screens-mirrors");
fs.mkdirSync(out, { recursive: true });
const report = { passed: false, steps: [], errors: [] };
const step = (name, detail = {}) => { report.steps.push({ name, ...detail }); console.log("OK", name, JSON.stringify(detail)); };

const range = Object.fromEntries(["shower-screen", "mirror", "shaving-cabinet"].map((key) => [key, clientSelectionCategoryProducts(guidedRequirementByKey(key), {})]));
const groups = Object.fromEntries(Object.entries(range).map(([key, products]) => [key, selectionGroupsForRequirement(key, products).groups]));

const projectId = "shower-screens-mirrors-verification";
const defaults = createEstimateBuilderWorkbookDefaults();
for (const key of ["aiPlanTakeoffJob", "takeoffEngine", "takeoffSchedule", "clientSelectionsBook"]) delete defaults[key];
const fixtures = [
  { page: 1, type: "Shower", quantity: 1, room: "Main Bathroom", basis: "OBSERVED", confidence: 0.9, evidence: "Shower recess drawn in Main Bathroom" },
  { page: 1, type: "Shower", quantity: 1, room: "Ensuite", basis: "OBSERVED", confidence: 0.9, evidence: "Shower recess drawn in Ensuite" },
  { page: 1, type: "WC", quantity: 1, room: "Powder Room", basis: "OBSERVED", confidence: 0.9, evidence: "WC drawn in Powder Room" },
];
const takeoffRooms = ["Main Bathroom", "Ensuite", "Powder Room", "Kitchen"].map((name) => ({ page: 1, name, basis: "OBSERVED", confidence: 0.9, evidence: "Room label" }));
const workbook = { ...defaults, templateType: "job", page: "clientSelections", projectId, commercialProjectId: projectId, registeredJobId: projectId,
  aiPlanTakeoffJob: { aiAnalysis: { fixtures, rooms: takeoffRooms, documentedQuantities: [], review: [] } },
  registeredJob: { jobId: projectId, jobName: "Shower Screens Verification", jobNumber: "SSM-TEST", clientName: "Test client", siteAddress: "Test address" } };
const fixture = path.join(out, "verification-job.json");
fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: "Shower Screens Verification", workbook }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com" });
if (error) throw error;
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 240000, defaultViewport: { width: 1600, height: 1200 } });
const page = await browser.newPage();
page.setDefaultTimeout(240000);
page.on("pageerror", (pageError) => report.errors.push(pageError.message));
await page.setRequestInterception(true);
page.on("request", (request) => (request.url().includes("/rest/v1/") && !["GET", "HEAD", "OPTIONS"].includes(request.method()) ? request.abort() : request.continue()));
await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`, session: auth.session });

const hub = '[data-testid="guided-category-shower-screens-mirrors"]';
const modal = '[data-testid="configured-selection-modal"]';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clickText = (text) => page.evaluate((label) => {
  const button = [...document.querySelectorAll("button")].find((item) => item.offsetParent !== null && !item.disabled && item.innerText.trim() === label);
  if (button) button.click();
  return Boolean(button);
}, text);
const waitClickText = (text) => page.waitForFunction((label) => {
  const button = [...document.querySelectorAll("button")].find((item) => item.offsetParent !== null && !item.disabled && item.innerText.trim() === label);
  if (!button) return false;
  button.click();
  return true;
}, { polling: 500 }, text);
const text = (selector) => page.$eval(selector, (node) => node.innerText.replace(/\s+/g, " "));
const setValue = async (selector, value) => {
  await page.$eval(selector, (node, next) => {
    const setter = Object.getOwnPropertyDescriptor(node.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value").set;
    setter.call(node, next);
    node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, String(value));
};
const waitForHub = () => page.waitForSelector(`${hub} [data-testid="configured-category-sections"]`);
const imagesLoaded = (selector) => page.waitForFunction((scope) => {
  const images = [...document.querySelectorAll(`${scope} img`)];
  return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
}, { polling: 500 }, selector);
const openGroup = async (label, count) => {
  await page.evaluate((scope, groupLabel) => {
    const card = [...document.querySelectorAll(`${scope} .configuredGroupCard`)].find((item) => item.querySelector("h3").innerText.trim().toUpperCase() === groupLabel.toUpperCase());
    card.querySelector(".plumbingCategoryBody > button").click();
  }, hub, label);
  await page.waitForSelector('[data-testid="guided-plumbing-fixture-products"]');
  await page.waitForFunction((expected) => document.querySelectorAll(".plumbingProductCard").length === expected, { polling: 500 }, count);
};
const locationLabels = () => page.$$eval(`${modal} [data-testid="configured-locations-row"]`, (rows) => rows.map((row) => row.querySelector("label span").innerText.trim()));
const tick = (key) => page.$eval(`${modal} [data-testid="configured-locations-option-${key}"]`, (input) => input.click());
// rooms: { "<location key>": { width, height } }
const configure = async (productCode, { rooms = {}, options = {}, allowance, quoted, reference }) => {
  await page.$eval(`.plumbingProductCard[data-product-code="${productCode}"] .guidedProductActions .primary`, (button) => button.click());
  await page.waitForSelector(modal);
  for (const [key, size] of Object.entries(rooms)) {
    await tick(key);
    if (size.width) await setValue(`${modal} [data-testid="configured-width-${key}"]`, size.width);
    if (size.height) await setValue(`${modal} [data-testid="configured-height-${key}"]`, size.height);
  }
  for (const [key, value] of Object.entries(options)) await setValue(`${modal} [data-testid="configured-option-${key}"]`, value);
  if (allowance !== undefined) await setValue(`${modal} [data-testid="configured-allowance"]`, allowance);
  if (quoted) await setValue(`${modal} [data-testid="configured-quoted-price"]`, quoted);
  if (reference) await setValue(`${modal} [data-testid="configured-quote-reference"]`, reference);
  await pause(300);
};
const editRow = async (requirementKey, roomLabel) => {
  await page.evaluate((key, label) => [...document.querySelectorAll(`[data-testid="plumbing-allocation-summary-${key}"] tbody tr`)].find((row) => row.innerText.includes(label)).querySelector("button").click(), requirementKey, roomLabel);
  await page.waitForSelector(modal);
};
const summaryRows = (requirementKey) => page.$$eval(`[data-testid="plumbing-allocation-summary-${requirementKey}"] tbody tr`, (rows) => rows.map((row) => row.innerText.replace(/\s+/g, " ")));
const saveModal = async () => {
  await page.$eval(`${modal} [data-testid="configured-save"]`, (button) => button.click());
  await page.waitForFunction((selector) => !document.querySelector(selector), { polling: 300 }, modal);
};

try {
  await page.goto(`${origin}/modules/estimate-builder?page=clientSelections`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector('[data-testid="open-local-job-file-input"]');
  await (await page.$('[data-testid="open-local-job-file-input"]')).uploadFile(fixture);
  for (let i = 0; i < 6; i++) {
    await pause(1000);
    for (const label of ["Discard Changes", "Open Job", "Open Job File", "Keep Local"]) await clickText(label);
  }
  await page.waitForFunction(() => {
    if (document.querySelector('button[data-category-key="shower-screens-mirrors"]')) return true;
    document.querySelector('button[data-category-key="interior"]')?.click();
    return false;
  }, { polling: 1000 });
  await page.$eval('button[data-category-key="shower-screens-mirrors"]', (button) => button.click());
  await waitForHub();
  assert.equal(new URL(page.url()).searchParams.get("selectionCategory"), "shower-screens-mirrors");

  // 1. First level: SHOWER SCREENS / MIRRORS / SHAVING CABINETS with their Product Library groups.
  const sections = await page.$$eval(`${hub} .configuredSection`, (items) => items.map((item) => ({
    key: item.dataset.requirementKey,
    heading: item.querySelector("h2").innerText.trim(),
    groups: [...item.querySelectorAll(".configuredGroupCard")].map((card) => ({ label: card.querySelector("h3").innerText.trim(), count: Number(card.innerText.match(/(\d+) products?/)?.[1] || 0), suppliers: card.querySelector("p").innerText.trim(), image: card.querySelector("img").getAttribute("src") })),
  })));
  assert.deepEqual(sections.map((section) => section.heading), ["SHOWER SCREENS", "MIRRORS", "SHAVING CABINETS"]);
  for (const section of sections) {
    assert.deepEqual(section.groups.map((group) => [group.label.toUpperCase(), group.count]), groups[section.key].map((group) => [group.label.toUpperCase(), group.count]), `${section.key} groups`);
    for (const group of section.groups) assert(group.image.startsWith("/images/catalogues/"), `${group.label}: real catalogue image, not a placeholder (${group.image})`);
  }
  await imagesLoaded(`${hub} .configuredGroupCard`);
  const requiredText = await text(`${hub} [data-testid="configured-required-shower-screen"]`);
  assert.match(requiredText, /SHOWER SCREENS REQUIRED: 2/);
  assert.match(requiredText, /1 x Main Bathroom shower, 1 x Ensuite shower/);
  await page.screenshot({ path: path.join(out, "01-landing.png"), fullPage: true });
  step("landing groups, images and required quantity", { sections: sections.map((section) => ({ heading: section.heading, groups: section.groups.map((group) => `${group.label} (${group.count}) - ${group.suppliers}`) })), requiredText });

  // 2. Framed: the location list is the project's shower rooms, ticked together.
  const framed = groups["shower-screen"].find((group) => group.value === "Framed");
  await openGroup(framed.label, framed.count);
  assert.match(await text('.plumbingProductCard[data-product-code="SSM-BRADNAMS-ESSENTIAL-HINGED-PIVOT"]'), /Bradnam's.*Supplier Quote Required/);
  await page.$eval('.plumbingProductCard[data-product-code="SSM-BRADNAMS-ESSENTIAL-HINGED-PIVOT"] .guidedProductActions .primary', (button) => button.click());
  await page.waitForSelector(modal);
  const offered = await locationLabels();
  assert.deepEqual(offered, ["Main Bathroom", "Ensuite"], "only the rooms the takeoff shows a shower in");
  assert.equal(await page.$(`${modal} select[data-testid="configured-room"]`), null, "no single-select dropdown");
  assert.equal(await page.$eval(`${modal} [data-testid="configured-save"]`, (button) => button.disabled), true, "a location is required");
  await page.$eval(`${modal} [data-testid="configured-locations-select-all"]`, (button) => button.click());
  await pause(200);
  assert.equal(await text(`${modal} [data-testid="configured-locations-count"]`), "2 locations selected");
  await setValue(`${modal} [data-testid="configured-option-glass"]`, "Clear");
  await setValue(`${modal} [data-testid="configured-option-finish"]`, "Bright Silver");
  await setValue(`${modal} [data-testid="configured-width-main-bathroom"]`, 900);
  await setValue(`${modal} [data-testid="configured-height-main-bathroom"]`, 2000);
  await setValue(`${modal} [data-testid="configured-width-ensuite"]`, 1200);
  await setValue(`${modal} [data-testid="configured-height-ensuite"]`, 2000);
  await setValue(`${modal} [data-testid="configured-allowance"]`, 1200);
  await pause(300);
  assert.equal(await text(`${modal} [data-testid="configured-total-quantity"]`), "2");
  assert.match(await text(`${modal} [data-testid="configured-bulk-note"]`), /Creates 2 separate selections \(Main Bathroom ×1, Ensuite ×1\)/);
  // A selection category typed as a location is refused.
  await setValue(`${modal} [data-testid="configured-locations-custom"]`, "Bathroom Accessories");
  await page.evaluate((selector) => [...document.querySelectorAll(`${selector} button`)].find((button) => button.innerText.trim() === "Add location").click(), modal);
  await pause(200);
  assert.deepEqual(await locationLabels(), ["Main Bathroom", "Ensuite"]);
  await page.screenshot({ path: path.join(out, "02-framed-multi-location.png") });
  await saveModal();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="plumbing-allocation-summary-shower-screen"] tbody tr').length === 2, { polling: 300 });
  let rows = await summaryRows("shower-screen");
  assert(rows.some((row) => /Main Bathroom ×1 1 /.test(row) && /W 900mm x H 2000mm/.test(row) && /Finish: Bright Silver/.test(row)), rows.join(" || "));
  assert(rows.some((row) => /Ensuite ×1 1 /.test(row) && /W 1200mm x H 2000mm/.test(row)), rows.join(" || "));
  assert(!rows.some((row) => /Main Bathroom, Ensuite/.test(row)), "rooms are never combined into one string");
  assert.match(await text('[data-testid="plumbing-allocation-summary-shower-screen"]'), /2 of 2 allocated.*Required 2 · Complete/);
  assert.match(await text('[data-testid="plumbing-category-quantity"]'), /^2$/);
  step("bulk add to Main Bathroom + Ensuite creates two room selections", { offered, rows });

  // Edit ONLY the Ensuite: black frame, different width. Main Bathroom must not change.
  const mainBefore = rows.find((row) => row.includes("Main Bathroom"));
  await editRow("shower-screen", "Ensuite");
  assert.deepEqual(await locationLabels(), ["Main Bathroom", "Ensuite"]);
  assert.equal(await page.$eval(`${modal} [data-testid="configured-width-ensuite"]`, (input) => input.value), "1200");
  await setValue(`${modal} [data-testid="configured-option-finish"]`, "Black");
  await setValue(`${modal} [data-testid="configured-width-ensuite"]`, 1000);
  await setValue(`${modal} [data-testid="configured-quoted-price"]`, 1650);
  await setValue(`${modal} [data-testid="configured-quote-reference"]`, "BQ-1001");
  await pause(300);
  await page.screenshot({ path: path.join(out, "03-edit-ensuite-only.png") });
  await saveModal();
  await page.waitForFunction(() => /Finish: Black/.test(document.querySelector('[data-testid="plumbing-allocation-summary-shower-screen"]')?.innerText || ""), { polling: 300 });
  rows = await summaryRows("shower-screen");
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.includes("Main Bathroom")), mainBefore, "Main Bathroom unchanged");
  assert(rows.some((row) => /Ensuite ×1/.test(row) && /W 1000mm x H 2000mm/.test(row) && /Finish: Black/.test(row) && /\$1,650/.test(row)), rows.join(" || "));
  step("editing the Ensuite leaves Main Bathroom unchanged", { rows });

  // Allowance / variation: quote the Main Bathroom too -> 2 x $1,200 allowance vs $3,000 selected.
  await editRow("shower-screen", "Main Bathroom");
  await setValue(`${modal} [data-testid="configured-quoted-price"]`, 1350);
  await pause(300);
  await saveModal();
  await page.waitForFunction(() => /\$3,000/.test(document.querySelector('[data-testid="plumbing-allocation-summary-shower-screen"] tfoot')?.innerText || ""), { polling: 300 });
  const totals = await text('[data-testid="plumbing-allocation-summary-shower-screen"] tfoot');
  assert.match(totals, /2 \$3,000 \$2,400 \+\$600/);
  await page.screenshot({ path: path.join(out, "04-two-rooms-allowance-variation.png") });
  step("allowance and variation", { totals });
  await waitClickText("← All Shower Screens & Mirrors");
  await waitForHub();

  // 3. Full frameless: filters and supplier size rules.
  const frameless = groups["shower-screen"].find((group) => group.value === "Frameless");
  await openGroup(frameless.label, frameless.count);
  const facetLabels = await page.$$eval('[data-testid="plumbing-product-filters"] label span', (labels) => labels.map((label) => label.innerText.trim().toUpperCase()));
  for (const label of ["SUPPLIER", "CONFIGURATION", "FINISH", "GLASS", "SIZE"]) assert(facetLabels.includes(label), `filter ${label} in ${facetLabels}`);
  await setValue('[data-testid="plumbing-facet-supplier"] select', "Regency");
  await page.waitForFunction(() => document.querySelectorAll(".plumbingProductCard").length === 8, { polling: 300 });
  await configure("SSM-REGENCY-FRAMELESS-FRONT-AND-RETURN", { rooms: { ensuite: { width: 1200, height: 2800 } }, options: { glass: "10mm Clear Toughened", finish: "Matt Black", fixing: "Clip Fixing" } });
  assert.match(await text(`${modal} [data-testid="configured-problems"]`), /Ensuite: Height 2800mm exceeds the supplier maximum of 2700mm/);
  assert.equal(await page.$eval(`${modal} [data-testid="configured-save"]`, (button) => button.disabled), true, "over-size screen cannot be saved");
  assert.equal(await text(`${modal} [data-testid="configured-price-each"]`), "Supplier Quote Required");
  await page.screenshot({ path: path.join(out, "05-frameless-size-rule.png") });
  await waitClickText("Cancel");
  step("frameless screens: filters and supplier size rule", { facetLabels });
  await waitClickText("← All Shower Screens & Mirrors");
  await waitForHub();

  // 4. Semi-frameless: an online Stegbar screen takes its SKU and published price from the variant.
  const semi = groups["shower-screen"].find((group) => group.value === "Semi-Frameless");
  await openGroup(semi.label, semi.count);
  await configure("SSM-STEGBAR-ONLINE-FRONT-ONLY-SCREEN", { rooms: { "main-bathroom": {} }, options: { size: "H1950 X W900 (mm)", glass: "Clear", finish: "Matt Black" } });
  const variantPrice = await text(`${modal} [data-testid="configured-price-each"]`);
  assert.match(variantPrice, /^\$\d/);
  assert.match(await text(`${modal} .plumbingAllocationProduct`), /SKU E\d+/);
  assert.equal(await page.$(`${modal} [data-testid="configured-width-main-bathroom"]`), null, "fixed-size product has no dimension inputs");
  await page.screenshot({ path: path.join(out, "06-online-variant-sku-price.png") });
  await waitClickText("Cancel");
  step("semi-frameless screens: online variant SKU and price", { variantPrice });
  await waitClickText("← All Shower Screens & Mirrors");
  await waitForHub();
  const landingLines = await page.$$eval('[data-testid="configured-lines-shower-screen"] [data-testid="configured-line"]', (lines) => lines.map((line) => line.innerText.replace(/\s+/g, " ")));
  assert.equal(landingLines.length, 2);
  step("landing shows each room's own selection", { landingLines });

  // 5. Mirrors: the Powder Room is a legitimate mirror location; categories are not.
  const shaped = groups.mirror.find((group) => group.value === "Shaped Mirrors");
  await openGroup(shaped.label, shaped.count);
  await page.$eval('.plumbingProductCard[data-product-code="SSM-STEGBAR-ONLINE-ROUND"] .guidedProductActions .primary', (button) => button.click());
  await page.waitForSelector(modal);
  const mirrorLocations = await locationLabels();
  assert(mirrorLocations.includes("Powder Room") && mirrorLocations.includes("Main Bathroom") && mirrorLocations.includes("Ensuite"), mirrorLocations.join());
  assert(!mirrorLocations.some((name) => /accessories|screens|fixtures|tiles|kitchen/i.test(name)), mirrorLocations.join());
  await tick("ensuite");
  await tick("powder-room");
  await setValue(`${modal} [data-testid="configured-option-size"]`, "H800 X W800 (mm)");
  await setValue(`${modal} [data-testid="configured-allowance"]`, 200);
  await pause(300);
  assert.equal(await text(`${modal} [data-testid="configured-price-each"]`), "$245");
  assert.equal(await text(`${modal} [data-testid="configured-total-quantity"]`), "2");
  await saveModal();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="plumbing-allocation-summary-mirror"] tbody tr').length === 2, { polling: 300 });
  await page.screenshot({ path: path.join(out, "07-mirrors.png") });
  step("mirrors", { group: shaped.label, products: shaped.count, mirrorLocations });
  await waitClickText("← All Shower Screens & Mirrors");
  await waitForHub();

  // 6. Shaving cabinets: their own range, no ordinary mirrors in it.
  await openGroup("Shaving Cabinets", range["shaving-cabinet"].length);
  const cabinetNames = await page.$$eval(".plumbingProductCard > div:not(.guidedProductMoney) > strong", (items) => items.map((item) => item.innerText.trim()));
  assert(cabinetNames.every((name) => /Cabinet$/i.test(name)), cabinetNames.join());
  await configure("SSM-STEGBAR-ONLINE-GOTHIC-WITH-WHITE-CABINET", { rooms: { "main-bathroom": {} }, allowance: 500 });
  assert.equal(await text(`${modal} [data-testid="configured-price-each"]`), "$881");
  await saveModal();
  await page.waitForSelector('[data-testid="plumbing-allocation-summary-shaving-cabinet"] tbody tr');
  await page.screenshot({ path: path.join(out, "08-shaving-cabinets.png") });
  step("shaving cabinets", { cabinetNames });
  await waitClickText("← All Shower Screens & Mirrors");
  await waitForHub();
  await page.screenshot({ path: path.join(out, "09-landing-with-selections.png"), fullPage: true });

  // 7. Elsewhere: with category containers now in the book, the Bathroom Accessories location
  // list still shows rooms only.
  await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => /^← Interior$/.test(button.innerText.trim()))?.click());
  await page.waitForSelector('button[data-category-key="bathroom-accessories"]');
  await page.$eval('button[data-category-key="bathroom-accessories"]', (button) => button.click());
  await page.waitForSelector('[data-testid="guided-category-bathroom-accessories"] [data-requirement-key]');
  await page.$eval('[data-testid="guided-category-bathroom-accessories"] [data-requirement-key] .plumbingCategoryBody > button', (button) => button.click());
  await page.waitForSelector(".plumbingProductCard");
  await page.$eval(".plumbingProductCard .guidedProductActions .primary", (button) => button.click());
  await page.waitForSelector('[data-testid="plumbing-allocation-modal"]');
  await page.evaluate(() => document.querySelector('[data-testid="plumbing-allocation-modal"] .plumbingShowAll')?.click());
  await pause(300);
  const accessoryLocations = await page.$$eval('[data-testid="plumbing-allocation-modal"] .plumbingAllocationRow label span', (items) => items.map((item) => item.innerText.trim()));
  assert(accessoryLocations.length > 0);
  assert(!accessoryLocations.some((name) => /accessories|shower screens|fixtures|tiles & stone|interior|exterior/i.test(name)), accessoryLocations.join());
  await page.screenshot({ path: path.join(out, "10-accessory-locations-rooms-only.png") });
  step("other location lists contain rooms only", { accessoryLocations });

  assert.deepEqual(report.errors, []);
  report.url = page.url();
  report.passed = true;
  console.log(JSON.stringify({ passed: true, steps: report.steps.length }));
} catch (failure) {
  report.failure = failure.stack;
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  fs.writeFileSync(path.join(out, "failure.txt"), await page.evaluate(() => document.body.innerText).catch(() => ""));
  throw failure;
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
