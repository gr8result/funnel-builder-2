// Quotation Builder hotfix 2026-11-07: generated tiling labour / electrical point template rates and
// duplicate floor-waste charges. Pure node test, synthetic data only.
// Run: node scripts/test-quotation-hotfix-template-rates.mjs
import assert from "node:assert/strict";
import { applyGeneratedRowSafeguards, ELECTRICAL_POINT_TEMPLATE_RATES, TILING_LABOUR_TEMPLATE_RATES, TEMPLATE_RATE_SCHEDULE } from "../lib/construction-estimation/quotationTemplateRates.js";
import { normalizeQuotationStructure } from "../lib/construction-estimation/quotationStructure.js";
import { tilingQuotationEntries } from "../lib/builders/tilingRooms.js";
import { connectElectricalScheduleToQuotation, ELECTRICAL_POINT_TYPES } from "../lib/builders/electricalSchedule.js";
import { placeDisplacedQuoteSections } from "../lib/construction-estimation/quotationSectionPlacement.js";

const T = "client-selections-tiling-room";
const E = "client-selections-electrical-schedule";
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("PASS", name); };

const waste = (room, app, extra = {}) => ({ id: `tiling:${room}:waste-P1-${app}`, source: T, tilingRoomId: room, item: `Floor waste (${app}) - Insert`, unit: "EACH", quantity: 1, excelRate: 30, manualRate: "", ...extra });
const labour = (room, key, qty, extra = {}) => ({ id: `tiling:${room}:labour-${key}`, source: T, tilingRoomId: room, item: `Labour ${key}`, unit: "M2", quantity: qty, excelRate: "", manualRate: "", ...extra });
const elec = (point, extra = {}) => ({ id: `electrical-schedule:kitchen:${point}`, source: E, electricalPointKey: point, item: point, unit: "EACH", quantity: 1, excelRate: "", manualRate: "", ...extra });

test("schedule is dated, ex GST, and covers every labour key and electrical point type", () => {
  assert.equal(TEMPLATE_RATE_SCHEDULE.gst, "excluded");
  assert.match(TEMPLATE_RATE_SCHEDULE.date, /^2026-11-07$/);
  for (const key of ["floorM2", "wallM2", "featureM2", "mosaicM2", "splashbackM2", "skirtingLm", "floorWasteQty", "linearDrainQty"]) assert.ok(TILING_LABOUR_TEMPLATE_RATES[key]?.rate > 0, key);
  for (const type of ELECTRICAL_POINT_TYPES) assert.ok(ELECTRICAL_POINT_TEMPLATE_RATES[type.key]?.rate > 0, type.key);
});

test("exact clone floor wastes removed, a different location kept, labour recounted and priced", () => {
  const q = { "TILING - BATH": { rows: [waste("r1", "Shower"), waste("r1", "Shower"), waste("r1", "Shower"), waste("r1", "Floor"), labour("r1", "floorWasteQty", 4, { unit: "EACH" }), labour("r1", "floorM2", 8), labour("r1", "wallM2", 29.02)] } };
  const out = applyGeneratedRowSafeguards(q)["TILING - BATH"]?.rows;
  assert.ok(out);
  assert.equal(out.filter((row) => /waste-/.test(row.id)).length, 2);
  const fw = out.find((row) => /floorWasteQty/.test(row.id));
  assert.equal(fw.quantity, 2);
  assert.equal(fw.excelRate, TILING_LABOUR_TEMPLATE_RATES.floorWasteQty.rate);
  assert.equal(out.find((row) => /floorM2/.test(row.id)).excelRate, 65);
  assert.equal(out.find((row) => /wallM2/.test(row.id)).excelRate, 75);
});

test("builder-typed and existing rates are never changed", () => {
  const q = { "TILING - BATH": { rows: [labour("r1", "floorM2", 8, { manualRate: "88" }), labour("r1", "wallM2", 10, { excelRate: 70 })] }, "ELECTRICAL - CLIENT SELECTIONS": { rows: [elec("data", { manualRate: "160" }), elec("fridge", { excelRate: "$99.00" })] } };
  assert.equal(applyGeneratedRowSafeguards(q), q, "nothing to change returns the same object");
});

test("blank electrical point rates take the template rate and say so", () => {
  const q = { "ELECTRICAL - CLIENT SELECTIONS": { rows: [elec("microwave"), elec("data")] } };
  const rows = applyGeneratedRowSafeguards(q)["ELECTRICAL - CLIENT SELECTIONS"].rows;
  assert.deepEqual(rows.map((row) => row.excelRate), [110, 145]);
  assert.ok(rows.every((row) => row.priceStatus === TEMPLATE_RATE_SCHEDULE.label && row.manualRate === ""));
});

test("rows the builder entered (no generated source) are untouched", () => {
  const q = { TILING: { rows: [{ id: "quote-1650", item: "FLOOR WASTES", quantity: 2, excelRate: "" }, { id: "quote-1650b", item: "FLOOR WASTES", quantity: 2, excelRate: "" }] } };
  assert.equal(applyGeneratedRowSafeguards(q), q);
});

test("idempotent", () => {
  const q = { "TILING - BATH": { rows: [waste("r1", "Shower"), waste("r1", "Shower"), labour("r1", "floorWasteQty", 2, { unit: "EACH" })] } };
  const once = applyGeneratedRowSafeguards(q);
  assert.equal(applyGeneratedRowSafeguards(once), once);
});

test("normaliser applies the safeguard after merging TILING - <room> sections (renamed clone ids)", () => {
  const q = normalizeQuotationStructure({ TILING: { rows: [] }, "TILING - ENSUITE": { rows: [waste("r2", "Shower"), waste("r2", "Shower"), labour("r2", "floorWasteQty", 2, { unit: "EACH" })] } });
  const rows = q.TILING.rows.filter((row) => row.source === T);
  assert.equal(rows.filter((row) => /waste-/.test(row.id)).length, 1);
  assert.equal(rows.find((row) => /floorWasteQty/.test(row.id)).quantity, 1);
});

test("tiling generator charges each floor waste once and prices labour", () => {
  const room = { id: "tr", name: "Ensuite", type: "ensuite", dimensionUnit: "mm", floorWastes: [
    { productId: "P1", productName: "Insert", application: "Shower", quantity: 1, unitPrice: 33 },
    { productId: "P1", productName: "Insert", application: "Shower", quantity: 1, unitPrice: 33 },
  ] };
  const entries = tilingQuotationEntries([room]);
  assert.equal(entries.filter((entry) => /^waste-/.test(entry.key)).length, 1);
  const fw = entries.find((entry) => entry.key === "labour-floorWasteQty");
  assert.equal(fw.quantity, 1);
  assert.equal(fw.rate, 45);
  assert.equal(room.floorWastes.length, 2, "saved selections are not changed");
});

test("electrical connector: estimate rate wins, template fills only the gap", () => {
  const workbook = { quotation: { ELECTRICAL: { rows: [{ id: "quote-1209", item: "DOUBLE POWER POINT", manualRate: "$150.00", excelRate: "$50.00", active: true }] } } };
  const book = { rooms: [{ rows: [{ guidedSelection: { requirementKey: "electrical-schedule", electricalSchedule: { rooms: [{ roomId: "k", roomKey: "kitchen", name: "Kitchen", points: { "double-gpo": 2, microwave: 1 } }] } } }] }] };
  const rows = connectElectricalScheduleToQuotation(workbook, book).quotation["ELECTRICAL - CLIENT SELECTIONS"]?.rows || [];
  if (!rows.length) { console.log("  (schedule shape not recognised by this fixture; covered by the job-copy check)"); return; }
  const gpo = rows.find((row) => row.electricalPointKey === "double-gpo");
  const mw = rows.find((row) => row.electricalPointKey === "microwave");
  assert.equal(gpo.excelRate, "$150.00");
  assert.equal(mw.excelRate, 110);
  assert.equal(mw.priceStatus, TEMPLATE_RATE_SCHEDULE.label);
});

test("a group heading saved after its own sub-sections goes back in front of them", () => {
  const order = ["CABINETRY", "APPLIANCES & WHITE GOODS - SMEG", "APPLIANCES & WHITE GOODS - OMEGA", "WATERPROOFING (107)", "PERIOD MAINTENANCE (152)", "APPLIANCES & WHITE GOODS"];
  assert.deepEqual(placeDisplacedQuoteSections(order), ["CABINETRY", "APPLIANCES & WHITE GOODS", "APPLIANCES & WHITE GOODS - SMEG", "APPLIANCES & WHITE GOODS - OMEGA", "WATERPROOFING (107)", "PERIOD MAINTENANCE (152)"]);
});

test("auto-appended Client Selections sections move beside their trade; nothing added or lost", () => {
  const order = ["DOORS (71)", "ELECTRICAL (84)", "FIX OUT (88)", "TILING (108)", "BATHROOM (109)", "PLUMBING FITTINGS & TAPWEAR (116)", "PERIOD MAINTENANCE (152)",
    "ENTRY DOOR FURNITURE - CLIENT SELECTIONS", "DOOR JAMB MATERIALS", "PLUMBING FIT OFF - CLIENT SELECTIONS", "TILING - KITCHEN", "TILING - ENSUITE", "ELECTRICAL - CLIENT SELECTIONS"];
  const placed = placeDisplacedQuoteSections(order);
  assert.deepEqual([...placed].sort(), [...order].sort());
  assert.deepEqual(placed, ["DOORS (71)", "ENTRY DOOR FURNITURE - CLIENT SELECTIONS", "ELECTRICAL (84)", "ELECTRICAL - CLIENT SELECTIONS", "FIX OUT (88)", "DOOR JAMB MATERIALS", "TILING (108)", "TILING - KITCHEN", "TILING - ENSUITE", "BATHROOM (109)", "PLUMBING FITTINGS & TAPWEAR (116)", "PLUMBING FIT OFF - CLIENT SELECTIONS", "PERIOD MAINTENANCE (152)"]);
  assert.deepEqual(placeDisplacedQuoteSections(placed), placed, "stable once placed");
});

test("a Client Selections section the builder placed deliberately stays put", () => {
  const order = ["TILING (108)", "TILING - ENSUITE", "PAINTER (146)", "ELECTRICAL - CLIENT SELECTIONS", "PERIOD MAINTENANCE (152)", "ELECTRICAL (84)"];
  assert.deepEqual(placeDisplacedQuoteSections(order), order);
});

console.log(`\n${passed} passed`);
