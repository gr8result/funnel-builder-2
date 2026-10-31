// The server PDF uses the approved continuous layout: cover, then Exterior Selections, Interior
// Selections and the Painting Schedule - the same pages the Selections Book shows.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-selections-schedule-pdf.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import { buildSelectionsSchedule } from "../lib/builders/selectionsScheduleDocument.js";
import { createProjectInclusionsSnapshot, renderFinalInclusionsScheduleHtml } from "../lib/builders/finalInclusionsSchedule.js";
import { renderDynamicFinalInclusionsPdf } from "../lib/builders/finalInclusionsPdfExecution.js";

let id = 0;
const guided = (requirementKey, fields = {}) => ({ id: `row-${++id}`, item: fields.requirementLabel || requirementKey, guidedRequirementKey: requirementKey, selectedProduct: fields.productName || "", guidedSelection: { requirementKey, ...fields } });
const allocation = (lines) => ({ plumbingAllocation: { lines } });
const tile = (name, room) => ({ productId: `tile-${name}`, productName: name, sku: `T-${name}`, imageUrl: "/images/catalogues/tiles/tile.jpg", netAreaM2: 12, orderAreaM2: 13, rooms: [{ roomName: room }] });
const rows = [
  guided("exterior-paint", { area: "exterior", requirementLabel: "Exterior Colours", productName: "Exterior Colour Schedule", clientColourSchedule: [
    { areaId: "main-rendered-walls", areaName: "Main rendered walls", material: "Render", finishType: "painted", colourName: "Dune", supplier: "Dulux", swatch: "#b8ad9c" }] }),
  guided("garage-door", { area: "exterior", requirementLabel: "Garage Door", productName: "Smart Doors & Gates Mediterranean", brand: "Centurion", colour: "Cottage Green", quantity: 1, unit: "each", imageReference: "/images/garage.jpg" }),
  guided("interior-paint", { area: "interior", requirementLabel: "Internal Paint Colours", productName: "Internal paint colours", paintScheme: { defaults: { walls: { manufacturer: "Dulux", colourName: "Hog Bristle", colourCode: "S14D1", hex: "#dcd0bb", finish: "Low Sheen" } } } }),
  guided("oven", { requirementLabel: "Oven", productName: "Bosch Series 4 900mm Oven", brand: "Bosch", model: "VBC5540S0", quantity: 1, unit: "EACH", imageReference: "/images/catalogues/appliances/vbc5540s0.jpg" }),
  guided("tiling-rooms", { area: "interior", requirementLabel: "Tiles & Stone", productName: "Tiles", tilingProductTotals: ["Kitchen", "Laundry", "Ensuite", "Main Bathroom", "Powder Room"].map((room, index) => tile(`Tile ${index + 1}`, room)) }),
  guided("interior-flooring", { area: "interior", requirementLabel: "Flooring", productName: "Flooring", flooringLines: [{ lineId: "carpet", productName: "Highland Park Twilight", brand: "Godfrey Hirst", flooringTypeLabel: "Carpet", netAreaM2: 86, imageUrl: "/images/catalogues/flooring/carpet.webp", rooms: [{ name: "Bedroom 1" }] }] }),
];
const schedule = buildSelectionsSchedule({ rooms: [{ name: "Book", rows }] }, { firstPageNumber: 2 });
const project = { id: "p1", project_name: "Test Job", client_name: "A Client", site_address: "1 Test St", job_number: "J1", builder_name: "Goodbuild" };
const snapshot = createProjectInclusionsSnapshot({ project, selections: [], schedulePages: schedule.pages, builderProfile: { name: "Goodbuild" }, createdAt: "2026-10-09T00:00:00.000Z" });
const html = renderFinalInclusionsScheduleHtml(snapshot);

const results = {};
const check = (name, run) => Promise.resolve().then(run).then(() => { results[name] = "PASS"; }, (error) => { results[name] = "FAIL"; console.error(`FAIL ${name}:`, JSON.stringify({ message: error.message, code: error.code, details: error.details, stack: error.stack }, null, 2).slice(0, 1800)); });

await check("ONLY THE THREE APPROVED SECTIONS ARE PRINTED, IN ORDER", () => {
  const headings = [...html.matchAll(/class="ssSection"><td colspan="8">([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(headings, ["1. Exterior Selections", "2. Interior Selections", "3. Painting Schedule"]);
  assert.doesNotMatch(html, /Document Information|Project and Financial Summary|Approval and Signing|Builder Review Items/);
  assert.doesNotMatch(html, /Indicative Rate|Quote Required|Current Price/i);
});
await check("EVERY SCHEDULE ROW IS PRINTED ONCE", () => {
  const printed = [...html.matchAll(/data-selection-id="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));
  const expected = schedule.rows.map((row) => row.id);
  assert.deepEqual([...printed].sort(), [...expected].sort());
  assert.equal(new Set(printed).size, printed.length, "no row appears twice");
});
await check("THE FIVE TILE SELECTIONS KEEP THEIR IMAGES", () => {
  const tileRows = schedule.rows.filter((row) => /^Tile \d$/.test(row.product));
  assert.equal(tileRows.length, 5);
  assert(tileRows.every((row) => row.imageUrl), "each tile row has an image");
  assert.equal((html.match(/\/images\/catalogues\/tiles\/tile\.jpg/g) || []).length, 5);
});
await check("EXTERIOR COLOURS COME BEFORE INTERIOR COLOURS IN THE PAINTING SCHEDULE; FLOORING IS LAST IN INTERIOR", () => {
  const painting = html.slice(html.indexOf('data-schedule-section="painting"'));
  assert(painting.indexOf("Exterior Painting") > -1 && painting.indexOf("Exterior Painting") < painting.indexOf("Interior Painting"));
  const interior = html.slice(html.indexOf("2. Interior Selections"), html.indexOf("3. Painting Schedule"));
  const groups = [...interior.matchAll(/class="ssGroup"><td colspan="8">([^<]+)</g)].map((match) => match[1]);
  assert.equal(groups.at(-1).replace(/ \(continued\)$/, "").replace(/&amp;/g, "&"), "Flooring & Carpet");
});
await check("NO PAGE IS MOSTLY EMPTY EXCEPT THE LAST", () => {
  assert.deepEqual(schedule.reconciliation.sparsePages, []);
});

const chrome = process.env.PUPPETEER_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (fs.existsSync(chrome)) {
  await check("THE PDF HAS THE COVER PLUS ONE PAGE PER SCHEDULE PAGE", async () => {
    const pdf = await renderDynamicFinalInclusionsPdf(snapshot, { puppeteerLaunchOptions: { executablePath: chrome } });
    const document = await PDFDocument.load(pdf.bytes);
    assert.equal(document.getPageCount(), 1 + schedule.pages.length);
    for (const page of document.getPages()) assert.deepEqual([Math.round(page.getWidth()), Math.round(page.getHeight())], [842, 595], "landscape A4");
    fs.mkdirSync("artifacts/test-artifacts/selections-schedule-pdf", { recursive: true });
    fs.writeFileSync("artifacts/test-artifacts/selections-schedule-pdf/schedule.pdf", pdf.bytes);
  });
} else results["PDF PAGE COUNT"] = "SKIPPED (no Chrome)";

console.log(results);
if (Object.values(results).includes("FAIL")) process.exit(1);
console.log("Selections schedule PDF: all checks passed");
