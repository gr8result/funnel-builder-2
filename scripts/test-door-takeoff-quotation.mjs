// Acceptance test: Takeoff -> Product Library / Client Selections -> Quotation Builder -> BOQ /
// Procurement for internal doors, door furniture, jambs, cavity cages and window/door labour.
// Runs the real calculation path (calculateEstimateBuilderWorkbook on the full normalised template).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "anon";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quiet = console.log; console.log = () => {}; console.info = () => {}; console.warn = () => {};
const log = (...a) => quiet(...a);
const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const { quotationSectionsForFinalBoq } = await import("../lib/construction-estimation/finalQuotationBoq.js");
const { getCategoryProducts, getClientSelectableProducts, getMasterProducts, toCanonicalProductContract } = await import("../lib/product-library/catalogueService.js");
const { PRODUCT_CATEGORY_REGISTRY } = await import("../lib/product-library/productCategoryRegistry.js");
const hook = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");

const wall = (id, category, thicknessMm, page = 1) => ({ id, page, category, lengthMm: 12000, thicknessMm: `${thicknessMm} mm`, wallHeightM: 2.4, exteriorType: "Brick Veneer", linedFaces: 2 });
const opening = (id, hostWallId, openingClass, widthMm, heightMm, extra = {}) => ({ id, page: 1, hostWallId, openingClass, widthMm, heightMm, ...extra });

function fixture(scale = 1) {
  return {
    pixelsPerMm: 1,
    sheetLevels: { 1: "Ground Floor", 2: "Second Level" },
    // Cavity sliders sit in their own walls: the Takeoff frames any wall hosting a cavity pocket at
    // 90mm (takeoffMaterialQuantities.js), which would otherwise re-frame the ordinary doors' wall.
    completedWallRuns: [wall("g70", "interior", 70), wall("g90", "interior", 90), wall("u70", "interior", 70, 2), wall("gcav", "interior", 90), wall("ucav", "interior", 90, 2), wall("gx", "exterior", 90), wall("ux", "exterior", 90, 2)],
    placedOpenings: [
      opening("d720", "g70", "Internal Door", 720, 2040, { subType: "Internal", quantity: 2 * scale }),
      opening("d820", "g90", "Internal Door", 820, 2040, { subType: "Internal", quantity: 3 * scale }),
      opening("d920", "u70", "Internal Door", 920, 2040, { subType: "Internal", page: 2, quantity: 1 }),
      opening("dbl", "g90", "Internal Door", 1440, 2040, { subType: "DoubleInternal", quantity: 1 }),
      opening("cs820", "gcav", "Internal Door", 820, 2040, { subType: "Cavity", quantity: 2 * scale }),
      opening("cs720", "g90", "Internal Door", 720, 2040, { subType: "Cavity", quantity: 1 }),
      opening("cs920", "ucav", "Internal Door", 920, 2040, { subType: "Cavity", page: 2, quantity: 1 }),
      opening("odd650", "g70", "Internal Door", 650, 2040, { subType: "Internal", quantity: 1 }),
      opening("robe", "g70", "Internal Door", 1800, 2100, { subType: "Robe", quantity: 1 }),
      opening("entry", "gx", "External Door", 920, 2040, { subType: "Entry", quantity: 1 }),
      opening("gw", "gx", "Window", 1200, 1200, { quantity: 3 * scale }),
      opening("gw2", "gx", "Window", 600, 900, { quantity: 1 }),
      opening("uw", "ux", "Window", 1200, 1200, { page: 2, quantity: 2 * scale }),
      opening("uw2", "ux", "Window", 900, 900, { page: 2, quantity: 1 }),
    ],
  };
}

const doorProducts = getCategoryProducts("internal-doors");
const furniture = getCategoryProducts("door-furniture");
const hume820 = doorProducts.find((p) => /hume/i.test(p.manufacturer) && (p.attributes?.sizePrices || []).some((s) => s.size === "2040 x 820 x 35 mm" && s.price > 0));
const byFunction = (fn) => furniture.find((p) => (p.attributes?.function || "") === fn);
assert.ok(hume820 && byFunction("Passage") && byFunction("Privacy") && byFunction("Dummy"), "catalogue has a priced Hume door and passage/privacy/dummy furniture");

function workbookFor(job, selections = []) {
  const base = hook.__doorTakeoffTestUtils.normalizeWorkbook({});
  const wb = base || {};
  return { ...wb, jobId: "door-acceptance", aiPlanTakeoffJob: job, clientSelectionsBook: { rooms: [{ rows: selections.map((guidedSelection) => ({ guidedSelection })) }] } };
}
const rowsIn = (preview, name) => preview.quotation[Object.keys(preview.quotation).find((key) => key.toLowerCase().startsWith(name))].rows;
const generated = (rows) => rows.filter((row) => row.generatedTakeoffProductRow && row.lineType !== "Appliance heading");
const byItem = (rows, text) => rows.find((row) => row.item.includes(text));
const labour = (preview, section, source) => rowsIn(preview, section).find((row) => row.id === `quote-${source}`);

// ---- default product (no client selection yet)
const noSelection = calculateEstimateBuilderWorkbook(workbookFor(fixture()));
const fixOut = rowsIn(noSelection, "fix out (88)");
// 1. Internal Doors first in Section 93
assert.equal(fixOut[0].item, "INTERNAL DOORS", "Section 93 starts with the Internal Doors subsection");
const doorRows = generated(fixOut).filter((row) => row.quantityKey.startsWith("takeoffInternalDoor:"));
// 2. sizes and quantities from the Takeoff (leaves: singles + cavity leaves + 2 per double set)
const qty = (text) => byItem(doorRows, text)?.qty;
assert.equal(qty("720 X 2040"), 2 + 1 + 2, "720: 2 hinged + 1 cavity leaf + 2 leaves of the 1440 double set");
assert.equal(qty("820 X 2040"), 3 + 2, "820: 3 hinged + 2 cavity leaves");
assert.equal(qty("920 X 2040"), 1 + 1, "920: 1 hinged + 1 cavity leaf");
assert.ok(!doorRows.some((row) => /1800|ROBE/.test(row.item)), "robe sliders excluded");
const odd = byItem(doorRows, "650 X 2040");
assert.equal(odd.qty, 1, "unusual size retained");
assert.equal(odd.quoteRequired, true); assert.match(odd.notes, /PRODUCT \/ PRICE REQUIRED/);
assert.ok(doorRows.every((row) => row.takeoffSources.length), "every door row reconciles to Takeoff openings");
// 3. Product Library match (builder default) + price = qty x rate
const r720 = byItem(doorRows, "720 X 2040");
assert.ok(r720.canonicalProductId && getMasterProducts().some((p) => p.productId === r720.canonicalProductId));
assert.ok(r720.finalRateUsed > 0 && r720.cost === Math.round(r720.qty * r720.finalRateUsed * 100) / 100, "qty x resolved price = cost");

// ---- client selects a Hume door + furniture
const passage = byFunction("Passage"); const privacy = byFunction("Privacy"); const dummy = byFunction("Dummy");
const selected = calculateEstimateBuilderWorkbook(workbookFor(fixture(), [
  { requirementKey: "internal-doors", productId: hume820.productId },
  { requirementKey: "door-hardware", productId: passage.productId, function: "Passage" },
  { requirementKey: "door-hardware", productId: privacy.productId, function: "Privacy", quantity: 2 },
  { requirementKey: "door-hardware", productId: dummy.productId, function: "Dummy" },
]));
const fixOutSel = rowsIn(selected, "fix out (88)");
const r820 = byItem(generated(fixOutSel), "820 X 2040");
// 4. Client Selection flows into the quotation (ID, image, manufacturer, SKU/model, price)
assert.equal(r820.canonicalProductId, hume820.productId);
assert.equal(r820.manufacturer, hume820.manufacturer);
assert.equal(r820.productImageUrl, hume820.primaryImageUrl);
const humeRate = hume820.attributes.sizePrices.find((s) => s.size === "2040 x 820 x 35 mm").price / 1.1;
assert.ok(Math.abs(r820.finalRateUsed - humeRate) < 0.01, "resolved Hume 820 price (ex GST)");
// 5. Door furniture from Product Library, allocated from Takeoff counts
const fRows = generated(fixOutSel).filter((row) => row.quantityKey.startsWith("takeoffDoorFurniture:"));
const fQty = (product) => fRows.find((row) => row.canonicalProductId === product.productId)?.qty;
const hingedDoors = 2 + 3 + 1 + 1 + 1; // singles (incl. 650) + double sets
assert.equal(fQty(privacy), 2, "explicit privacy quantity kept");
assert.equal(fQty(passage), hingedDoors - 2, "passage gets the remaining hinged doors - not the total door count");
assert.equal(fQty(dummy), 1, "dummy = double door sets");
assert.ok(fRows.every((row) => row.productImageUrl !== undefined && row.brand && row.supplier !== undefined && row.unit));
// 6/7. jambs by wall thickness (existing jamb rule; cavity sliders excluded)
const jamb90 = byItem(generated(fixOutSel), "90 x 19"); const jamb110 = byItem(generated(fixOutSel), "110 x 19");
assert.equal(jamb90.qty, 2 + 1 + 1 + 2, "70mm walls -> 90x19: 720 x2, 920, 650 + robe (existing robe rule: 2 lengths)");
assert.equal(jamb110.qty, 3 + 1, "90mm walls -> 110x19: 820 x3 + double set");
// 8/9. cavity cages: size + wall variant, total = INSTALL CAVITY DOOR CAGE labour
const framing = rowsIn(selected, "framing timber");
const cages = generated(framing);
const cage = (text) => byItem(cages, text);
assert.equal(cage("820 CAVITY CAGE - 90MM WALL").qty, 2);
assert.equal(cage("820 CAVITY CAGE - 90MM WALL").canonicalProductId, "master-CAVITY-CAGE-820-90MM");
assert.equal(cage("720 CAVITY CAGE - 90MM WALL").canonicalProductId, "master-CAVITY-CAGE-720-90MM");
assert.equal(cage("920 CAVITY CAGE - 90MM WALL").quoteRequired, true, "unsourced cage variant is PRICE REQUIRED, never $0 silently");
const cageTotal = cages.reduce((n, row) => n + row.qty, 0);
assert.equal(labour(selected, "frame stage labour", 104).qty, cageTotal, "cage purchasing total = INSTALL CAVITY DOOR CAGE");
// 10/11. window labour
assert.equal(labour(selected, "frame stage labour", 73).qty, 3 + 1 + 2 + 1, "INSTALL WINDOWS = sum of Takeoff window quantities");
assert.equal(labour(selected, "frame stage labour", 74).qty, 2 + 1, "SECOND STOREY = upper-level windows only");
// 12/13. fix-out labour
assert.equal(labour(selected, "fix-out stage labour", 150).qty, 2 + 1 + 1, "HANG DOOR IN CAVITY SLIDER UNIT = cavity sliders");
assert.equal(labour(selected, "fix-out stage labour", 152).qty, 2 + 3 + 1 + 1 + 1 + 1, "HANG SINGLE DOOR = all internal openings minus cavity doors; purchasing subtypes do not narrow the labour total");
assert.equal(labour(selected, "fix-out stage labour", 153).qty, 1, "HANG DOUBLE DOORS = double sets");
// superseded legacy cage material rows are not costed twice
assert.equal(labour(selected, "frame stage labour", 30043)?.cost ?? rowsIn(selected, "frame stage labour").find((r) => r.id === "quote-30043").cost, 0);
// 14. BOQ + procurement keep product, size, wall thickness and quantities
const boq = quotationSectionsForFinalBoq(selected.quotation).flatMap((entry) => entry.rows);
assert.ok(boq.some((row) => row.id === r820.id && row.qty === 5));
assert.ok(boq.some((row) => row.id === cage("820 CAVITY CAGE - 90MM WALL").id));
const procurement = hook.__doorTakeoffTestUtils.buildProcurementItemsFromQuote({ ...workbookFor(fixture()), quotation: {} }, selected, []);
const cageItem = procurement.find((item) => item.quoteRowId === cage("820 CAVITY CAGE - 90MM WALL").id);
assert.equal(cageItem.qty, 2); assert.equal(cageItem.purchasingDetails.wallThicknessMm, 90); assert.equal(cageItem.purchasingDetails.doorWidthMm, 820);
assert.equal(cageItem.productId, "master-CAVITY-CAGE-820-90MM"); assert.equal(cageItem.sku, "2026108");
const doorItem = procurement.find((item) => item.quoteRowId === r820.id);
assert.equal(doorItem.qty, 5); assert.equal(doorItem.purchasingDetails.doorWidthMm, 820); assert.equal(doorItem.productId, hume820.productId);
// 15. nothing hard-coded: a scaled Takeoff scales every quantity
const scaled = calculateEstimateBuilderWorkbook(workbookFor(fixture(3)));
assert.equal(byItem(generated(rowsIn(scaled, "fix out (88)")), "820 X 2040").qty, 9 + 6);
assert.equal(labour(scaled, "frame stage labour", 104).qty, 6 + 1 + 1);
assert.equal(labour(scaled, "frame stage labour", 73).qty, 9 + 1 + 6 + 1);
// 16. one canonical catalogue: rows reference catalogue products; cages are not client-selectable
const allGenerated = [...generated(fixOutSel), ...cages].filter((row) => row.canonicalProductId);
assert.ok(allGenerated.every((row) => getMasterProducts().some((p) => p.productId === row.canonicalProductId)));
assert.equal(getClientSelectableProducts("", "cavity-sliding-door-cages").length, 0);
assert.equal(PRODUCT_CATEGORY_REGISTRY["cavity-sliding-door-cages"].modules.clientSelections, false);
assert.ok(toCanonicalProductContract(getCategoryProducts("cavity-sliding-door-cages")[0]).stableProductId);
// no Takeoff -> no generated rows, labour unchanged
const noTakeoff = calculateEstimateBuilderWorkbook(workbookFor(null));
assert.equal(generated(rowsIn(noTakeoff, "fix out (88)")).length, 0);

log("Door takeoff quotation acceptance checks passed (16/16).");
process.exit(0);
