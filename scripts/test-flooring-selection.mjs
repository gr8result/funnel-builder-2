import assert from "node:assert/strict";
import { DEFAULT_FLOORING_WASTAGE_PCT, flooringCountsByType, flooringOrder, flooringTypeFromText, flooringVariantPricing, mergeFlooringCatalogue } from "../lib/product-library/flooringCatalogue.js";
import { DEFAULT_TILE_WASTAGE_PCT } from "../lib/builders/tilingCalculations.js";
import { applyFlooringChoice, connectFlooringSelectionsToQuotation, FLOORING_SELECTION_SOURCE, flooringAllowanceFromQuotation, flooringAllowanceResolver, flooringLines, flooringSelectionPatch, flooringTakeoffData, newFlooringArea, refreshTakeoffAreas, suggestedFlooringAreas } from "../lib/builders/flooringSelection.js";

// Flooring: pack maths, multi-area totals, apply + independent override, allowance / variation,
// quotation + procurement sync (update, never duplicate), re-import merge with price history.

// --- whole packs (the brief's worked example) ---
const order = flooringOrder(100.6, { wastagePct: 10, packCoverageM2: 2.2 });
assert.deepEqual(order, { netAreaM2: 100.6, wastagePct: 10, requiredAreaM2: 110.66, packCoverageM2: 2.2, packs: 51, purchasedAreaM2: 112.2 });
assert.equal(flooringOrder(10, { wastagePct: 0, packCoverageM2: 2.5 }).packs, 4, "exact multiple is not over-ordered");
assert.equal(flooringOrder(10.01, { wastagePct: 0, packCoverageM2: 2.5 }).packs, 5, "never rounds down");
assert.equal(DEFAULT_FLOORING_WASTAGE_PCT, DEFAULT_TILE_WASTAGE_PCT, "one shared wastage rule");

// --- type taxonomy never takes tiles ---
assert.equal(flooringTypeFromText("Hybrid"), "hybrid");
assert.equal(flooringTypeFromText("Engineered Timber"), "engineered-timber");
assert.equal(flooringTypeFromText("Porcelain floor tile"), "");

// --- pricing: regular is the estimating price, sale kept separate, derivations via real coverage ---
assert.deepEqual(flooringVariantPricing({ regularPricePerM2: 39.95, regularPricePerPack: 76.51, packCoverageM2: 1.9152 }).regularPricePerPack, 76.51);
const sale = flooringVariantPricing({ regularPricePerM2: 49.95, salePricePerM2: 39.96, packCoverageM2: 2 });
assert.equal(sale.regularPricePerM2, 49.95);
assert.equal(sale.salePricePerM2, 39.96);
assert.equal(sale.regularPricePerPack, 99.9);
assert.equal(sale.perPackDerived, true);
assert.equal(flooringVariantPricing({ regularPricePerPack: 100, packCoverageM2: 2 }).regularPricePerM2, 50);
assert.equal(flooringVariantPricing({ packCoverageM2: 2 }).priced, false, "no price is never invented");

// --- a small Product Library ---
const variant = (sku, colour, extra = {}) => ({ variantId: `national-tiles:${sku}`, sku, colour, productName: `Camino ${colour} Uniclic Hybrid Flooring`, regularPricePerM2: 39.95, regularPricePerPack: 76.51, packCoverageM2: 1.9152, widthMm: 180, lengthMm: 1520, thicknessMm: 6, priceBasis: "National Tiles online price, inc GST", ...extra });
const hybrid = { productId: "p-hybrid", productCode: "FLR-NATIONAL-TILES-CAMINO", familyKey: "flooring", supplier: "National Tiles", brand: "National Tiles", range: "Camino", attributes: { flooringType: "hybrid" }, variants: [variant("NT25-3418HB", "Atlas"), variant("NT25-3419HB", "Cotswold")] };
const laminate = { productId: "p-lam", productCode: "FLR-NATIONAL-TILES-CHALET", familyKey: "flooring", supplier: "National Tiles", brand: "National Tiles", range: "Chalet", attributes: { flooringType: "laminate" }, variants: [{ variantId: "national-tiles:NT26-8090LM", sku: "NT26-8090LM", colour: "Nordic Hickory", regularPricePerM2: 49.95, packCoverageM2: 2.184, priceBasis: "inc GST" }] };
const byId = new Map([hybrid, laminate].map((product) => [product.productId, product]));
const productById = (id) => byId.get(id) || null;
const counts = flooringCountsByType([hybrid, laminate, { familyKey: "tiles", attributes: {} }]);
assert.deepEqual([counts.hybrid, counts.laminate, counts.vinyl], [{ products: 1, colours: 2 }, { products: 1, colours: 1 }, { products: 0, colours: 0 }], "live counts from records");

// --- areas: Takeoff totals + project rooms (wet / external rooms not suggested, areas never guessed) ---
const workbook = { data: { inputDataSheet: { rows: { floorFinishHybridM2: { value: "36.5" }, floorFinishCarpetsM2: { value: "" } } } }, quotation: {
  "HYBRID FLOORING (151)": { rows: [{ id: "q-hybrid-std", item: "Hybrid Standard", excelRate: "$45.00" }, { id: "q-hybrid-prem", item: "Hybrid Premium", excelRate: "$125.00" }] },
  "LAMINATED FLOORING (152)": { rows: [{ id: "q-lam", item: "Entry Level Laminate", excelRate: "$75.00" }] },
} };
const takeoff = flooringTakeoffData(workbook);
assert.deepEqual(takeoff.finishes.map((finish) => [finish.key, finish.areaM2]), [["floorFinishHybridM2", 36.5]]);
const suggested = suggestedFlooringAreas(["Entry", "Kitchen", "Living", "Bathroom", "Ensuite", "Garage", "Alfresco", "Bed 2"], takeoff);
assert.deepEqual(suggested.map((area) => area.name), ["Hybrid floor finish (Takeoff)", "Entry", "Kitchen", "Living", "Bed 2"]);
assert.equal(suggested[0].areaM2, 36.5);
assert.equal(suggested[1].areaM2, "", "a room's area is never guessed");
assert.deepEqual(refreshTakeoffAreas(suggested, { finishes: [{ key: "floorFinishHybridM2", areaM2: 40 }] })[0].areaM2, 40, "Takeoff change flows into Takeoff-sourced areas");

// --- apply one colour to many areas, then override one independently ---
let areas = ["Entry", "Hallway", "Kitchen", "Living", "Dining", "Study"].map((name, index) => ({ ...newFlooringArea({ name }), areaM2: [8.4, 9.6, 14.2, 31.6, 16.8, 10][index] }));
areas = applyFlooringChoice(areas, areas.map((area) => area.id), { productId: "p-hybrid", variantId: "national-tiles:NT25-3418HB" });
areas = applyFlooringChoice(areas, [areas[5].id], { productId: "p-lam", variantId: "national-tiles:NT26-8090LM", wastagePct: 8 });
assert.equal(areas[4].variantId, "national-tiles:NT25-3418HB", "other areas keep their colour");
assert.equal(areas[5].areaM2, 10, "apply never copies an area");
const allowanceFor = (type) => flooringAllowanceFromQuotation(workbook.quotation, type);
assert.deepEqual(allowanceFor("hybrid"), { allowancePerM2ExGst: 45, source: "HYBRID FLOORING (151): Hybrid Standard" });
const lines = flooringLines(areas, { productById, allowanceFor });
assert.equal(lines.length, 2);
const atlas = lines.find((line) => line.sku === "NT25-3418HB");
assert.equal(atlas.netAreaM2, 80.6, "Entry+Hallway+Kitchen+Living+Dining");
assert.equal(atlas.requiredAreaM2, 88.66);
assert.equal(atlas.packs, Math.ceil(88.66 / 1.9152), "packs on the summed required area");
assert.equal(atlas.packs, 47);
assert.equal(atlas.purchasedAreaM2, 47 * 1.9152);
assert.equal(atlas.materialCost, Math.round(47 * 76.51 * 100) / 100, "whole packs x pack price");
assert.equal(atlas.allowanceTotal, Math.round(45 * 1.1 * 80.6 * 100) / 100, "allowance on NET area");
assert.equal(atlas.variation, Math.round((atlas.materialCost - atlas.allowanceTotal) * 100) / 100);
const study = lines.find((line) => line.sku === "NT26-8090LM");
assert.deepEqual([study.netAreaM2, study.wastagePct, study.packs], [10, 8, Math.ceil(10.8 / 2.184)]);

// --- Client Selections record ---
const patch = flooringSelectionPatch({ requirementKey: "interior-flooring", label: "Flooring", areaKey: "interior", areaLabel: "Interior" }, areas, { productById, allowanceFor });
assert.equal(patch.guidedSelection.flooringAreas.length, 6, "each area saved as its own record");
assert.equal(patch.guidedSelection.flooringAreas[0].variantSnapshot.sku, "NT25-3418HB");
assert.equal(patch.selectedCost, Math.round((atlas.materialCost + study.materialCost) * 100) / 100);
assert.equal(patch.upgradeCost, Math.round((patch.selectedCost - patch.allowanceAmount) * 100) / 100);

// --- quotation + procurement: rows in the EXISTING type sections, updated not duplicated ---
const book = { rooms: [{ id: "guided-interior", rows: [{ id: "row-flooring", guidedSelection: patch.guidedSelection }] }] };
const synced = connectFlooringSelectionsToQuotation(workbook, book, { productById });
const hybridRows = synced.quotation["HYBRID FLOORING (151)"].rows;
assert.equal(hybridRows.filter((row) => row.source === FLOORING_SELECTION_SOURCE).length, 1);
assert.equal(hybridRows.length, 3, "estimate allowance rows kept");
const row = hybridRows.find((item) => item.source === FLOORING_SELECTION_SOURCE);
assert.equal(row.qty, atlas.purchasedAreaM2, "quoted on purchased whole-pack coverage");
assert.equal(row.excelRate, Math.round((39.95 / 1.1) * 10000) / 10000, "ex GST base rate");
assert.match(row.description, /Entry 8\.40m², Hallway 9\.60m².*Net 80\.60m², wastage 10%, required 88\.66m², 47 packs x 1\.9152m²/);
assert.deepEqual(row.flooringOrder.packs, 47);
assert.equal(synced.quotation["LAMINATED FLOORING (152)"].rows.filter((item) => item.source === FLOORING_SELECTION_SOURCE).length, 1);
const items = synced.procurement.items.filter((item) => item.source === FLOORING_SELECTION_SOURCE);
assert.deepEqual(items.map((item) => [item.sku, item.qty, item.unit]), [["NT25-3418HB", 47, "PACK"], ["NT26-8090LM", study.packs, "PACK"]], "procurement orders whole packs");
assert.equal(items[0].supplier, "National Tiles");

// BOQ is built from the quotation rows: the flooring rows are included with their order detail
const { quotationSectionsForFinalBoq } = await import("../lib/construction-estimation/finalQuotationBoq.js");
const boqRows = quotationSectionsForFinalBoq(synced.quotation).flatMap((entry) => entry.rows).filter((item) => item.source === FLOORING_SELECTION_SOURCE);
assert.equal(boqRows.length, 2, "flooring rows reach the BOQ");
assert.match(boqRows[0].description, /National Tiles - Camino Atlas Hybrid \(NT25-3418HB\)\..*Locations: Entry.*Net 80\.60m², wastage 10%, required 88\.66m², 47 packs x 1\.9152m² = 90\.01m² purchased/);

// change the Study to the same colour as the rest: one row, recalculated - never a duplicate
const changed = applyFlooringChoice(areas, [areas[5].id], { productId: "p-hybrid", variantId: "national-tiles:NT25-3418HB", wastagePct: 10 });
const patch2 = flooringSelectionPatch({ requirementKey: "interior-flooring" }, changed, { productById, allowanceFor });
const resynced = connectFlooringSelectionsToQuotation({ ...synced, quotation: { ...synced.quotation, "HYBRID FLOORING (151)": { rows: synced.quotation["HYBRID FLOORING (151)"].rows.map((item) => (item.source === FLOORING_SELECTION_SOURCE ? { ...item, manualRate: "33" } : item)) } } }, { rooms: [{ rows: [{ guidedSelection: patch2.guidedSelection }] }] }, { productById });
const rows2 = resynced.quotation["HYBRID FLOORING (151)"].rows.filter((item) => item.source === FLOORING_SELECTION_SOURCE);
assert.equal(rows2.length, 1);
assert.equal(rows2[0].flooringOrder.netAreaM2, 90.6);
assert.equal(rows2[0].manualRate, "33", "builder rate on the same product is kept");
assert.equal(resynced.quotation["LAMINATED FLOORING (152)"].rows.filter((item) => item.source === FLOORING_SELECTION_SOURCE).length, 0, "deselected colour removed");
assert.equal(resynced.procurement.items.filter((item) => item.source === FLOORING_SELECTION_SOURCE).length, 1);
// a type with no estimate section gets its own section (only then)
const vinylOnly = connectFlooringSelectionsToQuotation({ quotation: {} }, book, { productById });
assert.ok(vinylOnly.quotation["HYBRID FLOORING"] && vinylOnly.quotation["LAMINATED FLOORING"]);

// --- builder material allowance overrides the (possibly all-in) estimate rate, saved and synced ---
const resolver = flooringAllowanceResolver(workbook.quotation, { hybrid: 30 });
assert.deepEqual(resolver("hybrid"), { allowancePerM2ExGst: 30, source: "Builder material allowance (ex GST)" });
assert.equal(resolver("laminate").allowancePerM2ExGst, 75, "other types keep the estimate rate");
const overridePatch = flooringSelectionPatch({ requirementKey: "interior-flooring" }, areas, { productById, allowanceFor: resolver, allowanceOverrides: { hybrid: 30 } });
assert.deepEqual(overridePatch.guidedSelection.flooringAllowanceOverrides, { hybrid: 30 });
const overrideSync = connectFlooringSelectionsToQuotation(workbook, { rooms: [{ rows: [{ guidedSelection: overridePatch.guidedSelection }] }] }, { productById });
const overrideRow = overrideSync.quotation["HYBRID FLOORING (151)"].rows.find((item) => item.source === FLOORING_SELECTION_SOURCE);
assert.equal(overrideRow.allowancePerUnit, 30);
assert.equal(overrideRow.allowanceSource, "Builder material allowance (ex GST)");

// --- re-import: stable ids, price history appended, missing SKU kept as discontinued ---
const first = { products: [{ product_code: "FLR-A", variants: [{ variantId: "nt:1", regularPricePerM2: 39.95, packCoverageM2: 2, priceRetrievedAt: "2026-10-01" }, { variantId: "nt:2", regularPricePerM2: 29.95 }] }] };
const merged1 = mergeFlooringCatalogue({ products: [] }, first, { retrievedAt: "2026-10-01T00:00:00Z" });
const second = { products: [{ product_code: "FLR-A", variants: [{ variantId: "nt:1", regularPricePerM2: 44.95, packCoverageM2: 2, priceRetrievedAt: "2026-11-01" }] }] };
const merged2 = mergeFlooringCatalogue(merged1, second, { retrievedAt: "2026-11-01T00:00:00Z" });
const v1 = merged2.products[0].variants.find((item) => item.variantId === "nt:1");
assert.equal(v1.regularPricePerM2, 44.95);
assert.deepEqual(v1.priceHistory.map((entry) => entry.regularPricePerM2), [39.95], "previous price kept");
assert.equal(v1.firstImportedAt, "2026-10-01T00:00:00Z");
assert.equal(merged2.products[0].variants.find((item) => item.variantId === "nt:2").discontinued, true, "no longer listed -> discontinued, not deleted");
assert.equal(merged2.products.length, 1, "no second catalogue on re-import");
const merged3 = mergeFlooringCatalogue(merged2, second, { retrievedAt: "2026-12-01T00:00:00Z" });
assert.equal(merged3.products[0].variants.find((item) => item.variantId === "nt:1").priceHistory.length, 1, "unchanged price adds no history");

console.log("flooring selection: whole packs, shared wastage, pricing, live counts, areas, apply/override, allowance/variation, quotation/procurement sync without duplicates, re-import merge passed");
