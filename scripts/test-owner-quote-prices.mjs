// 10-11 Nov 2026: Quotation Builder prices for rows the Product Library cannot price. Supplier retail
// prices (data/pricing/supplier-prices.json, GST included, divided by 1.1), owner allowances and
// tiling labour rates (ex GST), and the builder's own TILE LAYER / ELECTRICAL rates. Run:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-owner-quote-prices.mjs
import assert from "node:assert/strict";
import { ownerQuotePrice, ownerQuoteRateContext } from "../lib/construction-estimation/ownerQuotePrices.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log("PASS", name); };
const quiet = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };

const savoy28 = { id: "quote-entry-door-product-master-ENTRY-HUME-SAVOY-1200-XS28-1200", entryDoorLibraryRow: true, canonicalProductId: "master-ENTRY-HUME-SAVOY-1200-XS28-1200", item: "Hume Savoy 1200 XS28-1200 entrance door", quantity: "1", excelRate: 2750, supplierCatalogueRate: 2750, sourceOfRate: "Product Library", quoteRequired: false };
const jamb = { id: "takeoff-jamb90x19StockLengthsEach", item: "90 x 19 door jamb — 5.4m stock length", quantityKey: "jamb90x19StockLengthsEach", quantity: "", lineType: "Quote required", quoteRequired: true, excelRate: "" };
const trilock = { id: "entry-door-furniture:door-1:primary", source: "client-selections-entry-door-furniture", productCode: "EDF-GAINSBOROUGH-8951CONSC", item: "Trilock Contour", quantity: 1, excelRate: "", quoteRequired: true, lineType: "Quote required" };

check("supplier prices are the retail price ex GST", () => {
  assert.equal(ownerQuotePrice(savoy28).rate, 1395.33, "Bretts $1,534.86 / 1.1");
  assert.equal(ownerQuotePrice({ canonicalProductId: "master-ENTRY-HUME-SAVOY-1200-XS45-1200" }).rate, 1508.79, "Bretts $1,659.67 / 1.1");
  assert.equal(ownerQuotePrice(jamb).rate, 20.63, "Bretts 92 x 18 x 5.4m $22.69 / 1.1");
  assert.equal(ownerQuotePrice({ quantityKey: "jamb110x19StockLengthsEach" }).rate, 26.52, "Bretts 112 x 18 x 5.4m $29.17 / 1.1");
  assert.equal(ownerQuotePrice(trilock).rate, 272.05, "Bunnings $299.25 / 1.1");
  assert.equal(ownerQuotePrice({ id: "quote-921", item: "DOOR JAMB (PAINT GRADE)" }).rate, 272.73, "Bunnings assembled entry frame $300 / 1.1");
  assert.equal(ownerQuotePrice({ id: "takeoff-door-quotation:cavity-cage:820x2040:230" }).rate, 218.55, "Bretts Evolution 820 x 90mm $240.41 / 1.1, whatever wall the takeoff measured");
  assert.match(ownerQuotePrice({ id: "takeoff-door-quotation:cavity-cage:820x2040:90" }).source, /2040 x 820 x 90mm/);
  assert.match(ownerQuotePrice(savoy28).source, /^Bretts Timber & Hardware .*ex GST/);
});

check("owner allowances are ex GST", () => {
  assert.equal(ownerQuotePrice({ id: "quote-908", item: "DOOR JAMB (PAINT GRADE)" }).rate, 320, "double entry door frame");
  assert.equal(ownerQuotePrice({ id: "takeoff-door-quotation:cavity-cage:1020x2040:90" }).rate, 150, "1020 cavity unit");
  assert.equal(ownerQuotePrice({ id: "electrical-schedule:study:data", excelRate: "" }).rate, 120, "data point");
  assert.match(ownerQuotePrice({ id: "quote-908" }).source, /^Owner allowance/);
});

check("only the matched rows are priced", () => {
  assert.equal(ownerQuotePrice({ id: "quote-932", item: "DOUBLE FRONT DOOR JAMB" }), null);
  assert.equal(ownerQuotePrice({ ...trilock, productCode: "EDF-GAINSBOROUGH-895TRIBC" }), null, "another Trilock model is not given this price");
  assert.equal(ownerQuotePrice({ id: "electrical-schedule:study:data-extra" }), null);
});

check("a door the Product Library prices from a verified source keeps that price", () => {
  assert.equal(ownerQuotePrice({ ...savoy28, priceSource: "catalogue_rrp", supplierCatalogueRate: 900 }), null);
});

const quotation = {
  "ELECTRICAL (84)": { rows: [{ id: "quote-1208", item: "SINGLE POWER POINT", excelRate: "$45.00", manualRate: "$75.00" }, { id: "quote-1211", item: "RANGE HOOD INC FITTING OF SLIDE OUT UNIT", excelRate: "$95.00" }] },
  "TILE LAYER (115)": { rows: [{ id: "quote-1646", item: "LAY NORMAL TILES", excelRate: "$50.00" }, { id: "quote-1647", item: "LAY PORCELAIN TILES", excelRate: "$70.00" }, { id: "quote-1650", item: "FLOOR WASTES", excelRate: "$45.00" }, { id: "quote-1653", item: "MITRE CUTS", excelRate: "$40.00" }] },
  CABINETRY: { rows: [{ id: "c1", item: "Rangehood cabinet", quantity: 1 }] },
  "TILING - ENSUITE": { rows: [
    { id: "tiling:ensuite:floor", source: "client-selections-tiling-room", section: "TILING - ENSUITE", productId: "master-TIL-NT-NT12-325FL" },
    { id: "tiling:ensuite:labour-floorM2", source: "client-selections-tiling-room", section: "TILING - ENSUITE", excelRate: "" },
    { id: "tiling:ensuite:labour-floorWasteQty", source: "client-selections-tiling-room", section: "TILING - ENSUITE", excelRate: "" },
    { id: "tiling:ensuite:labour-skirtingLm", source: "client-selections-tiling-room", section: "TILING - ENSUITE", excelRate: "" },
    { id: "tiling:ensuite:walls", source: "client-selections-tiling-room", section: "TILING - ENSUITE", productId: "master-TIL-NT-BELWP311" },
    { id: "tiling:ensuite:labour-wallM2", source: "client-selections-tiling-room", section: "TILING - ENSUITE", excelRate: "$50.00" },
  ] },
  "TILING - LAUNDRY": { rows: [
    { id: "tiling:laundry:floor", source: "client-selections-tiling-room", section: "TILING - LAUNDRY", productId: "master-TIL-NT-NT13-4010FL" },
    { id: "tiling:laundry:labour-floorM2", source: "client-selections-tiling-room", section: "TILING - LAUNDRY", excelRate: "" },
  ] },
};

check("tiling labour uses the owner's rates; other labour uses the builder's TILE LAYER and ELECTRICAL rates", () => {
  const context = ownerQuoteRateContext(quotation);
  const rows = quotation["TILING - ENSUITE"].rows;
  assert.equal(ownerQuotePrice(rows[1], context).rate, 80, "450 x 450 floor tile -> standard $80/m2");
  assert.equal(ownerQuotePrice(rows[5], context).rate, 80, "100 x 300 wall tile -> $80/m2, replacing the TILE LAYER rate copied onto the row");
  assert.equal(ownerQuotePrice(quotation["TILING - LAUNDRY"].rows[1], context).rate, 110, "600 x 600 floor tile -> $110/m2");
  assert.equal(ownerQuotePrice(rows[3], context).rate, 0, "skirting $0 per LM");
  assert.equal(ownerQuotePrice(rows[2], context).rate, 45, "FLOOR WASTES from TILE LAYER");
  assert.equal(ownerQuotePrice({ id: "electrical-schedule:kitchen:fridge", excelRate: "" }, context).rate, 75, "SINGLE POWER POINT (manual rate)");
  assert.equal(ownerQuotePrice({ id: "electrical-schedule:kitchen:rangehood", excelRate: "" }, context).rate, 95, "rangehood cabinet -> slide-out fitting");
  assert.equal(ownerQuotePrice({ ...rows[2], excelRate: "60" }, context), null, "a non-tiling-rate row with its own rate keeps it");
});

check("the quote uses them, and a builder's own rate on the row still wins", () => {
  const workbook = (doors, hardware) => ({ quotation: { "DOORS (71)": { rows: doors }, "ENTRY DOOR FURNITURE - CLIENT SELECTIONS": { rows: hardware } } });
  const cost = (calc, section, id) => calc.quotation[section].rows.find((row) => row.id === id).cost;
  let calc = quiet(() => calculateEstimateBuilderWorkbook(workbook([savoy28], [trilock])));
  assert.equal(cost(calc, "DOORS (71)", savoy28.id), 1395.33);
  assert.equal(cost(calc, "ENTRY DOOR FURNITURE - CLIENT SELECTIONS", trilock.id), 272.05);
  calc = quiet(() => calculateEstimateBuilderWorkbook(workbook([{ ...savoy28, manualRate: "1400" }], [{ ...trilock, supplierQuote: "210" }])));
  assert.equal(cost(calc, "DOORS (71)", savoy28.id), 1400);
  assert.equal(cost(calc, "ENTRY DOOR FURNITURE - CLIENT SELECTIONS", trilock.id), 210);
  const skirting = { id: "tiling:p:labour-skirtingLm", source: "client-selections-tiling-room", section: "TILING - P", quantity: "5", lineType: "Quote required", quoteRequired: true, excelRate: "" };
  calc = quiet(() => calculateEstimateBuilderWorkbook({ quotation: { "TILING - P": { rows: [skirting] } } }));
  const row = calc.quotation["TILING - P"].rows[0];
  assert.equal(row.cost, 0);
  assert.equal(row.finalRateUsed, 0, "a $0 skirting rate is a price, not a missing rate");
});

// 12 Nov 2026: issue gate integration.
const { quotationIssueCheck } = await import("../lib/construction-estimation/quotationIssueGate.js");
check("a $0 owner rate is a no-charge item and a sourced price clears quote-required; neither blocks issue", () => {
  const skirting = { id: "tiling:p:labour-skirtingLm", source: "client-selections-tiling-room", section: "TILING - P", quantity: "5", lineType: "Quote required", quoteRequired: true, excelRate: "" };
  const calc = quiet(() => calculateEstimateBuilderWorkbook({ quotation: { "TILING - P": { rows: [skirting] }, "DOOR JAMB MATERIALS": { rows: [{ ...jamb, quantity: "19", quantityManualOverride: true }] } } }));
  const skirt = calc.quotation["TILING - P"].rows[0];
  const jambRow = calc.quotation["DOOR JAMB MATERIALS"].rows[0];
  assert.equal(skirt.noCharge, true);
  assert.equal(jambRow.quoteRequired, false);
  assert.equal(jambRow.priceStatus, "Supplier price");
  assert.equal(quotationIssueCheck(calc.quotation).ok, true);
});

check("an allowance saved as a made-to-measure supplier quote is not a price: screens block, mirrors take the builder's LM rate", () => {
  const placeholder = (id, productName, widthMm) => ({ id, source: "client-selections-allocated-product", item: productName, productName, quantity: 1, excelRate: 545.4545, priceStatus: "Supplier quote", quoteReference: "", allowancePerUnit: 600, configuration: { madeToMeasure: true, type: /Mirror/.test(productName) ? "Framed Mirrors" : "Essential (Framed)", configuration: /Mirror/.test(productName) ? "Essential Mirror Frame" : "Hinged / Pivot", widthMm, heightMm: /Mirror/.test(productName) ? 900 : 2000 } });
  const calc = quiet(() => calculateEstimateBuilderWorkbook({ quotation: {
    "MIRRORS (150)": { rows: [{ id: "m1", item: "FRAMED 900 HIGH", unit: "LM", excelRate: "$85.00" }] },
    "SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS": { rows: [placeholder("screen", "Essential Framed Shower Screen", 1000), { ...placeholder("mirror", "Essential Mirror", 2000), excelRate: 272.7273, allowancePerUnit: 300 }] },
  } }));
  const rows = calc.quotation["SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS"].rows;
  assert.equal(rows[0].cost, 0);
  assert.equal(rows[0].quoteRequired, true);
  assert.equal(rows[1].cost, 170, "FRAMED 900 HIGH $85/LM x 2 m");
  const gate = quotationIssueCheck(calc.quotation);
  assert.deepEqual(gate.blockers.map((b) => b.rowId), ["screen"]);
});

check("tiling labour finds its tile by room, so merged or renamed sections keep the right rate", () => {
  const merged = { TILING: { rows: [...quotation["TILING - ENSUITE"].rows, ...quotation["TILING - LAUNDRY"].rows] } };
  const context = ownerQuoteRateContext(merged);
  assert.equal(ownerQuotePrice(quotation["TILING - ENSUITE"].rows[1], context).rate, 80);
  assert.equal(ownerQuotePrice(quotation["TILING - LAUNDRY"].rows[1], context).rate, 110);
});

console.log(`\n${passed} checks passed`);
