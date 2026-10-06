// Client Selections > Shower Screens & Mirrors: catalogue, discovery, per-room configuration,
// project quantity, allowance / variation and the flow into Quotation + Procurement.
//   node --import ./scripts/register-json-loader.mjs scripts/test-shower-screens-mirrors.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getEffectiveProductCatalogue, getMasterProducts } from "../lib/product-library/catalogueService.js";
import { clientSelectionCategoryProducts, clientSelectionCategorySummaries, filterPlumbingFixtureProducts, plumbingFixtureFilterOptions } from "../lib/product-library/plumbingFixtureCatalogue.js";
import { discoverBathroomAccessoryTypes } from "../lib/product-library/bathroomAccessoryDiscovery.js";
import { SHOWER_SCREEN_MIRROR_REQUIREMENTS, guidedRequirementByKey, requirementFinancials, statusForRequirement } from "../lib/builders/clientSelectionWorkflow.js";
import { CLIENT_SELECTION_CATEGORY_BY_KEY, clientSelectionCategoryForRequirement, duplicateCategoryRequirementKeys, estimateSectionForRequirement } from "../lib/builders/clientSelectionCategories.js";
import { plumbingAllocationProgress, plumbingAllocationSummary, upsertPlumbingLine } from "../lib/builders/plumbingFixtureAllocation.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { isSelectionCategoryName, projectLocationNames, projectLocations } from "../lib/builders/projectLocations.js";
import { ALL_GUIDED_REQUIREMENTS } from "../lib/builders/clientSelectionWorkflow.js";
import { CLIENT_SELECTION_CATEGORIES } from "../lib/builders/clientSelectionCategories.js";
import { plumbingLocationsForRequirement } from "../lib/builders/plumbingFixtureAllocation.js";
import {
  availableOptionValues, configuredLineFromProduct, configuredLinesFromProduct, configuredSelectionLocations, dimensionProblems, draftFromConfiguredLine,
  isConfiguredSelectionRequirement, productConfigurator, projectFixtureRequirement, selectionGroupsForRequirement, variantForOptions,
} from "../lib/product-library/showerScreenMirrorCatalogue.js";

const results = [];
const check = (name, run) => { run(); results.push(name); };
const catalogueFile = "data/product-library/catalogues/bathroom/AU-SHOWER-SCREENS-MIRRORS-CATALOGUE.json";
const raw = JSON.parse(fs.readFileSync(catalogueFile, "utf8")).products;
const requirement = (key) => guidedRequirementByKey(key);
const range = (key) => clientSelectionCategoryProducts(requirement(key), { organisationId: "test-org" });
const screens = range("shower-screen");
const mirrors = range("mirror");
const cabinets = range("shaving-cabinet");
const bySupplier = (products, supplier) => products.filter((product) => product.supplier === supplier);
const facet = (product, key) => [product.attributes.selectionFacets[key]].flat().filter(Boolean);

check("catalogue is served through the Product Library service", () => {
  const master = getMasterProducts().filter((product) => product.productCode.startsWith("SSM-"));
  assert.equal(master.length, raw.length);
  // Mirrors already in the Product Library (Harvey Norman Commercial) stay in the same range.
  const existingMirrors = mirrors.filter((product) => !product.productCode.startsWith("SSM-"));
  assert.equal(existingMirrors.length, 14);
  assert(existingMirrors.every((product) => product.supplier === "Harvey Norman Commercial"));
  assert.equal(screens.length + mirrors.length + cabinets.length, raw.length + existingMirrors.length);
  assert.equal(new Set(raw.map((product) => product.product_code)).size, raw.length, "unique product codes");
});

check("requirements and category", () => {
  assert.deepEqual(SHOWER_SCREEN_MIRROR_REQUIREMENTS.map((item) => item.requirementKey), ["shower-screen", "mirror", "shaving-cabinet"]);
  assert.deepEqual(CLIENT_SELECTION_CATEGORY_BY_KEY["shower-screens-mirrors"].requirementKeys, ["shower-screen", "mirror", "shaving-cabinet"]);
  for (const key of ["shower-screen", "mirror", "shaving-cabinet"]) {
    assert.equal(clientSelectionCategoryForRequirement(key).key, "shower-screens-mirrors");
    assert.equal(estimateSectionForRequirement(key), "SHOWER SCREENS & MIRRORS");
    assert(isConfiguredSelectionRequirement(requirement(key)));
  }
  assert.deepEqual(duplicateCategoryRequirementKeys(), []);
});

check("supplier attribution: only the three suppliers, one spelling each", () => {
  assert.deepEqual([...new Set(raw.map((product) => product.supplier))].sort(), ["Bradnam's", "Regency", "Stegbar"]);
  for (const product of raw) {
    assert.equal(product.brand, product.supplier);
    assert(product.official_product_url.startsWith("https://"), `${product.product_code}: supplier URL`);
    assert(product.attributes.supplierMetadata.supplierCategory, `${product.product_code}: original supplier category kept`);
  }
});

check("framed screens", () => {
  const framed = screens.filter((product) => facet(product, "Screen Type").includes("Framed"));
  assert(framed.length >= 2);
  // Only Bradnam's publishes a framed range; Regency and Stegbar do not.
  assert.deepEqual([...new Set(framed.map((product) => product.supplier))], ["Bradnam's"]);
  assert.deepEqual(framed.map((product) => facet(product, "Door")[0]).sort(), ["Hinged / Pivot", "Sliding"]);
});

check("semi-frameless screens", () => {
  const semi = screens.filter((product) => facet(product, "Screen Type").includes("Semi-Frameless"));
  assert.deepEqual([...new Set(semi.map((product) => product.supplier))].sort(), ["Bradnam's", "Regency", "Stegbar"]);
  const inline = semi.find((product) => product.productCode === "SSM-REGENCY-AQUA-INLINE-GL530");
  assert.equal(inline.productName, "Aqua Series Inline - Front & Return (Gl530)");
  assert.deepEqual(facet(inline, "Configuration"), ["Corner"]);
  assert.deepEqual(facet(inline, "Door"), ["Pivot"]);
  assert.equal(inline.attributes.specifications.maxHeightMm, 2100);
  // Stegbar's own term "Semi-Framed" is kept beside the internal type.
  assert.equal(semi.find((product) => product.productCode === "SSM-STEGBAR-ONLINE-FRONT-ONLY-SCREEN").attributes.specifications.supplierScreenType, "Semi-Framed");
});

check("full frameless screens", () => {
  const frameless = screens.filter((product) => facet(product, "Screen Type").includes("Frameless"));
  assert.deepEqual([...new Set(frameless.map((product) => product.supplier))].sort(), ["Bradnam's", "Regency", "Stegbar"]);
  const regency = bySupplier(frameless, "Regency");
  assert.equal(regency.length, 8);
  assert(regency.every((product) => product.attributes.specifications.glassOptions.includes("10mm Clear Toughened")));
  assert(regency.every((product) => product.attributes.specifications.fixingOptions.join() === "Clip Fixing,Channel Fixing"));
});

check("mirrors and shaving cabinets are separate ranges", () => {
  assert.deepEqual([...new Set(mirrors.map((product) => product.supplier))].sort(), ["Bradnam's", "Harvey Norman Commercial", "Regency", "Stegbar"]);
  assert(mirrors.every((product) => !/cabinet/i.test(product.productName)));
  assert.equal(cabinets.length, 3);
  assert(cabinets.every((product) => /Cabinet$/.test(product.productName) && product.supplier === "Stegbar" && product.attributes.specifications.cabinetDepthMm === 150));
  assert.deepEqual(cabinets.map((product) => product.attributes.specifications.mounting).sort(), ["Recessed (up to 110mm) or surface mounted", "Recessed (up to 110mm) or surface mounted", "Surface mounted"]);
  const all = getEffectiveProductCatalogue({ organisationId: "test-org" }).products;
  const accessoryCodes = discoverBathroomAccessoryTypes(all).flatMap((type) => type.products.map((product) => product.productCode));
  assert(!accessoryCodes.some((code) => code.startsWith("SSM-")), "catalogue mirrors do not leak into Bathroom Accessories");
});

check("first-level groups come from the catalogue", () => {
  assert.deepEqual(selectionGroupsForRequirement("shower-screen", screens).groups.map((group) => group.label), ["Framed Shower Screens", "Semi-Frameless Shower Screens", "Full Frameless Shower Screens"]);
  assert.deepEqual(selectionGroupsForRequirement("mirror", mirrors).groups.map((group) => group.label), ["Frameless Mirrors", "Framed Mirrors", "Shaped Mirrors", "Other Mirrors"]);
  assert.equal(selectionGroupsForRequirement("mirror", mirrors).groups.reduce((total, group) => total + group.count, 0), mirrors.length, "every mirror is in exactly one group");
  const cabinetGroups = selectionGroupsForRequirement("shaving-cabinet", cabinets).groups;
  assert.equal(cabinetGroups.length, 1);
  for (const group of [...selectionGroupsForRequirement("shower-screen", screens).groups, ...selectionGroupsForRequirement("mirror", mirrors).groups, ...cabinetGroups]) {
    assert(group.count > 0 && group.imageUrl && group.suppliers.length, `${group.label}: count, image and suppliers`);
  }
  const summaries = clientSelectionCategorySummaries(SHOWER_SCREEN_MIRROR_REQUIREMENTS, { organisationId: "test-org" });
  assert.equal(summaries["shower-screen"].count, screens.length);
  assert.equal(summaries.mirror.count, mirrors.length);
  assert.equal(summaries["shaving-cabinet"].count, 3);
});

check("filters: supplier, type, configuration, finish, glass, size", () => {
  const options = plumbingFixtureFilterOptions(screens);
  assert.deepEqual(options.facets.Supplier, ["Bradnam's", "Regency", "Stegbar"]);
  assert.deepEqual(options.facets["Screen Type"], ["Framed", "Frameless", "Semi-Frameless"]);
  for (const value of ["Alcove", "Corner", "Fixed Panel", "Front Only", "Hinged / Pivot", "Sliding", "Splay"]) assert(options.facets.Configuration.includes(value), value);
  assert(options.facets.Finish.includes("Brushed Gold") && options.facets.Glass.includes("Satinlite") && options.facets.Size.includes("Made to measure"));
  const filtered = filterPlumbingFixtureProducts(screens, { facets: { Supplier: "Regency", "Screen Type": "Frameless", Finish: "Matt Black" } });
  assert.equal(filtered.length, 8);
  assert.equal(filterPlumbingFixtureProducts(screens, { facets: { Supplier: "Regency", "Screen Type": "Framed" } }).length, 0);
  assert.equal(filterPlumbingFixtureProducts(screens, { facets: { Door: "Sliding" } }).length, 7);
});

check("product images are real local files", () => {
  for (const product of raw) {
    assert(product.primary_image_url, `${product.product_code}: image`);
    const file = path.join("public", product.primary_image_url);
    assert(fs.existsSync(file) && fs.statSync(file).size > 5000, `${product.product_code}: ${file}`);
    assert(product.image_source_url.startsWith("https://"), `${product.product_code}: image source`);
  }
});

check("prices: published online prices only, everything else is quote required", () => {
  for (const product of raw) {
    const variants = product.attributes.configurator.variants;
    if (product.price_status === "current") {
      assert.equal(product.supplier, "Stegbar");
      assert(variants.length && variants.every((variant) => variant.sku && variant.price > 0), `${product.product_code}: SKU + price per variant`);
      assert.equal(product.client_price, Math.min(...variants.map((variant) => variant.price)));
    } else {
      assert.equal(product.price_status, "quote_required");
      assert.equal(product.client_price, null);
      assert.equal(variants.length, 0);
      assert(product.attributes.configurator.madeToMeasure, `${product.product_code}: made to measure`);
    }
  }
  // Every stored SKU / price is the supplier feed's own.
  const feed = JSON.parse(fs.readFileSync("data/product-library/source-evidence/shower-screens-mirrors/stegbar-shopify-products.json", "utf8")).products;
  const feedPrices = new Map(feed.flatMap((product) => product.variants.map((variant) => [variant.sku, Number(variant.price)])));
  const stored = raw.flatMap((product) => product.attributes.configurator.variants);
  assert(stored.length > 250);
  for (const variant of stored) assert.equal(feedPrices.get(variant.sku), variant.price, variant.sku);
});

check("project quantity comes from the takeoff's shower count, not from bathroom count", () => {
  const fixtures = [
    { type: "Shower", quantity: 1, room: "Bathroom", basis: "OBSERVED", confidence: 0.9, page: 1 },
    { type: "Shower", quantity: 1, room: "Ensuite", basis: "OBSERVED", confidence: 0.8, page: 1 },
    { type: "Shower", quantity: 1, room: "Powder Room", basis: "ASSUMED", confidence: 0.9, page: 1 },
    { type: "Bath", quantity: 1, room: "Bathroom 2", basis: "OBSERVED", confidence: 0.9, page: 1 },
    { type: "WC", quantity: 3, room: "", basis: "OBSERVED", confidence: 0.9, page: 1 },
  ];
  const required = projectFixtureRequirement("shower-screen", { aiPlanTakeoffJob: { aiAnalysis: { fixtures } } });
  assert.equal(required.quantity, 2);
  assert.deepEqual(required.rooms, [{ room: "Bathroom", quantity: 1 }, { room: "Ensuite", quantity: 1 }]);
  assert.equal(projectFixtureRequirement("shower-screen", { aiPlanTakeoffJob: { scheduleState: { aiAnalysis: { fixtures } } } }).quantity, 2);
  assert.equal(projectFixtureRequirement("shower-screen", {}), null, "no takeoff -> no invented quantity");
  assert.equal(projectFixtureRequirement("mirror", { aiPlanTakeoffJob: { aiAnalysis: { fixtures } } }), null);
});

// The book as Client Selections really stores it: physical rooms plus one container "room" per
// selection category that holds that category's guided rows.
const book = { rooms: [
  { id: "room-main-bathroom", name: "Main Bathroom", rows: [] },
  { id: "room-ensuite", name: "Ensuite", rows: [] },
  { id: "room-powder", name: "Powder Room", rows: [] },
  { id: "room-kitchen", name: "Kitchen", rows: [] },
  { id: "guided-bathroom-accessories", name: "Bathroom Accessories", rows: [] },
  { id: "guided-plumbing-fixtures", name: "Plumbing Fixtures", rows: [] },
  { id: "guided-shower-screens-mirrors", name: "Shower Screens & Mirrors", rows: [] },
  { id: "guided-tiles-stone", name: "Tiles & Stone", rows: [] },
  { id: "guided-interior", name: "Interior", rows: [] },
] };
const takeoffWorkbook = { aiPlanTakeoffJob: { aiAnalysis: {
  rooms: [{ name: "Main Bathroom", basis: "OBSERVED", confidence: 0.9 }, { name: "Bathroom 2", basis: "OBSERVED", confidence: 0.9 }],
  fixtures: [
    { type: "Shower", quantity: 1, room: "Main Bathroom", basis: "OBSERVED", confidence: 0.9 },
    { type: "Shower", quantity: 1, room: "Ensuite", basis: "OBSERVED", confidence: 0.9 },
    { type: "WC", quantity: 1, room: "Powder Room", basis: "OBSERVED", confidence: 0.9 },
  ],
} } };

check("selection categories never appear as project locations", () => {
  const locations = projectLocations({ book, workbook: takeoffWorkbook });
  // The book's template "Kitchen" page has nothing in the project behind it, so it is not a room;
  // Ensuite and Powder Room are confirmed by the fixtures the takeoff found in them.
  assert.deepEqual(locations.map((location) => location.name), ["Main Bathroom", "Ensuite", "Powder Room", "Bathroom 2"]);
  // Room ids are preserved; a takeoff-only room gets a stable derived id.
  assert.deepEqual(locations.map((location) => location.id), ["room-main-bathroom", "room-ensuite", "room-powder", "location-bathroom-2"]);
  // No requirement area or category label is a location - whichever list it is used for.
  const names = projectLocationNames({ book, workbook: takeoffWorkbook });
  for (const label of [...ALL_GUIDED_REQUIREMENTS.map((item) => item.areaLabel), ...CLIENT_SELECTION_CATEGORIES.map((item) => item.label)]) {
    if (label === "Kitchen") continue; // a real room as well as an area
    assert(isSelectionCategoryName(label), label);
    assert(!names.includes(label), label);
  }
  assert(!isSelectionCategoryName("Main Bathroom") && !isSelectionCategoryName("Ensuite 2") && !isSelectionCategoryName("Kitchen"));
  // Plumbing allocation, tiling and accessory packs read the same list: no category there either.
  for (const key of ["bathroom-basin", "toilet-suite", "floor-waste", "towel-rail"]) {
    assert(!plumbingLocationsForRequirement(key, names).some((location) => /accessories|fixtures|mirrors/i.test(location.label)), key);
  }
  // Before the fix this is what leaked: the raw book room names.
  assert(plumbingLocationsForRequirement("towel-rail", book.rooms.map((room) => room.name)).some((location) => location.label === "Bathroom Accessories"));
});

check("shower screen locations: rooms with a shower first, nothing hard-coded", () => {
  const locations = projectLocations({ book, workbook: takeoffWorkbook });
  const required = projectFixtureRequirement("shower-screen", takeoffWorkbook);
  const offered = configuredSelectionLocations("shower-screen", locations, required);
  assert.deepEqual(offered.primary.map((location) => [location.label, location.id, location.requiredQuantity]), [["Main Bathroom", "room-main-bathroom", 1], ["Ensuite", "room-ensuite", 1]]);
  // A bathroom the takeoff found no shower in is only offered behind "Other project locations";
  // the Powder Room is not a shower-screen location at all.
  assert.deepEqual(offered.other.map((location) => location.label), ["Bathroom 2"]);
  assert(![...offered.primary, ...offered.other].some((location) => /powder|kitchen|accessories/i.test(location.label)));
  // No fixture takeoff: the project's own bathrooms / ensuites; no project rooms: nothing invented.
  assert.deepEqual(configuredSelectionLocations("shower-screen", projectLocations({ book, cabinetryLocations: [{ location: "Main Bathroom" }, { location: "Ensuite" }] }), null).primary.map((location) => location.label), ["Main Bathroom", "Ensuite"]);
  assert.deepEqual(projectLocations({ book }), [], "Selections Book template pages alone are not project rooms");
  assert.deepEqual(configuredSelectionLocations("shower-screen", [], null), { primary: [], other: [], basis: "project rooms" });
  assert.deepEqual(configuredSelectionLocations("mirror", projectLocations({ book, workbook: takeoffWorkbook }), null).primary.map((location) => location.label), ["Main Bathroom", "Ensuite", "Powder Room", "Bathroom 2"]);
});

check("bulk add creates one independent selection per room", () => {
  const essential = screens.find((product) => product.productCode === "SSM-BRADNAMS-ESSENTIAL-HINGED-PIVOT");
  const created = configuredLinesFromProduct(essential, {
    quantity: 1, options: { glass: "Clear", finish: "Bright Silver" }, unitAllowance: 1200,
    locations: [
      { id: "room-main-bathroom", key: "main-bathroom", label: "Main Bathroom", widthMm: 900, heightMm: 2000 },
      { id: "room-ensuite", key: "ensuite", label: "Ensuite", widthMm: 1200, heightMm: 2000, depthMm: 900 },
    ],
  });
  assert.equal(created.length, 2);
  assert.deepEqual(created.map((line) => line.allocations), [[{ locationKey: "main-bathroom", location: "Main Bathroom", quantity: 1 }], [{ locationKey: "ensuite", location: "Ensuite", quantity: 1 }]]);
  assert.deepEqual(created.map((line) => line.locationId), ["room-main-bathroom", "room-ensuite"]);
  assert.deepEqual(created.map((line) => [line.configuration.widthMm, line.configuration.depthMm]), [[900, null], [1200, 900]]);
  assert.notEqual(created[0].lineId, created[1].lineId);
  let bulk = created.reduce((next, line) => upsertPlumbingLine(next, line), []);
  assert.equal(plumbingAllocationSummary(bulk).quantity, 2);
  // Edit ONLY the Ensuite: black frame, different width.
  const mainBefore = JSON.stringify(bulk[0]);
  const ensuiteDraft = draftFromConfiguredLine(bulk[1]);
  assert.deepEqual(ensuiteDraft.locations.map((location) => [location.id, location.label, location.widthMm]), [["room-ensuite", "Ensuite", 1200]]);
  const edited = configuredLineFromProduct(essential, { ...ensuiteDraft, room: "Ensuite", locationId: "room-ensuite", options: { glass: "Clear", finish: "Black" }, widthMm: 1000, heightMm: 2000 }, { existingLine: bulk[1], lines: [bulk[0]] });
  bulk = upsertPlumbingLine(bulk, edited);
  assert.equal(bulk.length, 2);
  assert.equal(JSON.stringify(bulk[0]), mainBefore, "Main Bathroom is untouched");
  assert.deepEqual([bulk[1].finish, bulk[1].configuration.widthMm, bulk[1].locationId], ["Black", 1000, "room-ensuite"]);
  // Per-room quantities reach the Quotation Builder and Procurement separately.
  const built = plumbingSelectionPatch(requirement("shower-screen"), bulk, null);
  assert.deepEqual(built.patch.guidedSelection.locationAllocations.map((item) => [item.location, item.quantity]), [["Main Bathroom", 1], ["Ensuite", 1]]);
  const workbook = connectAllocatedSelectionsToQuotation({}, { rooms: [{ rows: [built.patch] }] });
  const rows = workbook.quotation["SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS"].rows;
  assert.deepEqual(rows.map((row) => [row.locations, row.qty, row.finish]), [["Main Bathroom ×1", 1, "Bright Silver"], ["Ensuite ×1", 1, "Black"]]);
  assert.deepEqual(workbook.procurement.items.map((item) => item.locationSchedule), [[{ location: "Main Bathroom", quantity: 1 }], [{ location: "Ensuite", quantity: 1 }]]);
});

const regencyFrameless = screens.find((product) => product.productCode === "SSM-REGENCY-FRAMELESS-FRONT-AND-RETURN");
const stegbarSemi = screens.find((product) => product.productCode === "SSM-STEGBAR-AQUA-OVERLAP-GO330");
const stegbarOnline = screens.find((product) => product.productCode === "SSM-STEGBAR-ONLINE-FRONT-ONLY-SCREEN");

check("made-to-measure configuration and supplier size rules", () => {
  assert(regencyFrameless && stegbarSemi && stegbarOnline);
  const configurator = productConfigurator(regencyFrameless);
  assert(configurator.madeToMeasure && configurator.priceMode === "supplier-quote");
  assert.deepEqual(configurator.options.map((option) => option.key), ["glass", "finish", "fixing"]);
  assert.deepEqual(dimensionProblems(regencyFrameless, { widthMm: 1200, heightMm: 2000 }), []);
  assert.equal(dimensionProblems(regencyFrameless, { widthMm: 1200, heightMm: 2800 }).length, 1);
  assert.equal(dimensionProblems(stegbarSemi, { widthMm: 3000, heightMm: 2000 }).length, 1);
  assert.equal(dimensionProblems(regencyFrameless, {}).length, 2);
  // Fixed-size online product: SKU and price come from the chosen variant.
  assert.deepEqual(dimensionProblems(stegbarOnline, {}), []);
  const variant = variantForOptions(stegbarOnline, { size: "H1950 X W900 (mm)", glass: "Clear", finish: "Matt Black" });
  assert(variant.sku && variant.price > 0 && variant.widthMm === 900 && variant.heightMm === 1950);
  assert.equal(variantForOptions(stegbarOnline, { size: "H1950 X W900 (mm)" }), null);
  assert.deepEqual(availableOptionValues(stegbarOnline, "finish", { size: "H1950 X W900 (mm)" }).sort(), ["Bright Silver", "Matt Black"]);
});

const showerRequirement = requirement("shower-screen");
const ensuite = configuredLineFromProduct(regencyFrameless, { room: "Ensuite", quantity: 1, options: { glass: "10mm Clear Toughened", finish: "Matt Black", fixing: "Clip Fixing" }, widthMm: 1200, heightMm: 2000, unitAllowance: 1200 });
let lines = upsertPlumbingLine([], ensuite);
const bathroom = configuredLineFromProduct(stegbarSemi, { room: "Bathroom", quantity: 1, options: { glass: "Clear", finish: "Bright Silver" }, widthMm: 900, heightMm: 2000, unitAllowance: 1200 }, { lines });
lines = upsertPlumbingLine(lines, bathroom);
const required = { requiredQuantity: 2, requiredQuantitySource: "AI Plan Takeoff fixtures" };

check("each shower holds a different selection; quote-only stays unpriced", () => {
  assert.equal(lines.length, 2);
  assert.notEqual(lines[0].lineId, lines[1].lineId);
  assert.deepEqual(lines.map((line) => [line.supplier, line.allocations[0].location, line.configuration.screenType]), [["Regency", "Ensuite", "Frameless"], ["Stegbar", "Bathroom", "Semi-Frameless"]]);
  assert.equal(ensuite.unitPrice, null);
  assert.equal(ensuite.priceState, "Supplier Quote Required");
  assert.match(ensuite.specification, /Frameless · Front & Return · W 1200mm x H 2000mm · Glass: 10mm Clear Toughened · Finish: Matt Black · Fixing: Clip Fixing · Made to measure/);
  const summary = plumbingAllocationSummary(lines);
  assert.equal(summary.quantity, 2);
  assert.equal(summary.allowanceTotal, 2400);
  assert.equal(summary.selectedTotal, null);
  assert.equal(summary.variation, null, "no price is invented while a quote is outstanding");
  const built = plumbingSelectionPatch(showerRequirement, lines, { plumbingAllocation: required });
  assert.equal(built.patch.guidedSelection.priceState, "Price Pending");
  assert.equal(built.patch.guidedSelection.variationPending, true);
  const selection = { selection_status: "selected", selected_details: built.patch.guidedSelection };
  assert.deepEqual(plumbingAllocationProgress(selection.selected_details), { required: 2, requiredSource: "AI Plan Takeoff fixtures", allocated: 2, remaining: 0, complete: true });
  // Existing rule: every shower has a selection, so the requirement is complete; the outstanding
  // quote is carried as PRICE REQUIRED (never as a $0 variation).
  assert.equal(statusForRequirement(showerRequirement, selection), "complete");
  assert.equal(requirementFinancials(showerRequirement, selection).priceRequired, true);
  // The same product again in a second ensuite is a third, separate line.
  const second = configuredLineFromProduct(regencyFrameless, { room: "Ensuite", quantity: 1, options: {}, widthMm: 1000, heightMm: 2000, unitAllowance: 1200 }, { lines });
  assert.equal(upsertPlumbingLine(lines, second).length, 3);
});

check("allowance and variation use the existing engine: 2 x $1,200 vs $1,650 + $1,350 = +$600", () => {
  const quotedEnsuite = configuredLineFromProduct(regencyFrameless, { ...draftFromConfiguredLine(lines[0]), quotedPrice: 1650, quoteReference: "RQ-TEST-1" }, { existingLine: lines[0], lines });
  const quotedBathroom = configuredLineFromProduct(stegbarSemi, { ...draftFromConfiguredLine(lines[1]), quotedPrice: 1350, quoteReference: "SQ-TEST-2" }, { existingLine: lines[1], lines });
  assert.equal(quotedEnsuite.lineId, lines[0].lineId, "editing keeps the line");
  assert.deepEqual(quotedEnsuite.configurationOptions, lines[0].configurationOptions);
  lines = upsertPlumbingLine(upsertPlumbingLine(lines, quotedEnsuite), quotedBathroom);
  const summary = plumbingAllocationSummary(lines);
  assert.equal(summary.allowanceTotal, 2400);
  assert.equal(summary.selectedTotal, 3000);
  assert.equal(summary.variation, 600);
  assert.deepEqual(lines.map((line) => line.variation), [450, 150]);
  const built = plumbingSelectionPatch(showerRequirement, lines, { plumbingAllocation: required });
  assert.equal(built.patch.upgradeCost, 600);
  assert.equal(built.patch.guidedSelection.priceState, "Current Price");
  assert.equal(statusForRequirement(showerRequirement, { selection_status: "selected", selected_details: built.patch.guidedSelection }), "complete");
  assert.deepEqual(built.patch.guidedSelection.locationAllocations.map((item) => item.location), ["Ensuite", "Bathroom"]);
});

check("online product: supplier SKU and published price flow to the line", () => {
  const line = configuredLineFromProduct(stegbarOnline, { room: "Bathroom 2", quantity: 1, options: { size: "H1950 X W900 (mm)", glass: "Clear", finish: "Matt Black" }, unitAllowance: 300 });
  const variant = variantForOptions(stegbarOnline, line.configurationOptions);
  assert.equal(line.supplierCode, variant.sku);
  assert.equal(line.unitPrice, variant.price);
  assert.equal(line.priceSource, "catalogue-variant");
  assert.equal(line.variation, variant.price - 300);
  assert.equal(line.configuration.widthMm, 900);
});

check("selections flow into the Quotation Builder and Procurement", () => {
  const built = plumbingSelectionPatch(showerRequirement, lines, { plumbingAllocation: required });
  const mirrorLine = configuredLineFromProduct(mirrors.find((product) => product.productCode === "SSM-BRADNAMS-FRAMELESS-MIRROR-BEVELLED"), { room: "Ensuite", quantity: 1, options: {}, widthMm: 900, heightMm: 1000, unitAllowance: 250 });
  const cabinetLine = configuredLineFromProduct(cabinets[0], { room: "Bathroom", quantity: 1, options: Object.fromEntries(productConfigurator(cabinets[0]).options.map((option) => [option.key, option.values[0]])), unitAllowance: 500 });
  const mirrorPatch = plumbingSelectionPatch(requirement("mirror"), [mirrorLine], null);
  const cabinetPatch = plumbingSelectionPatch(requirement("shaving-cabinet"), [cabinetLine], null);
  const book = { rooms: [{ rows: [built.patch, mirrorPatch.patch, cabinetPatch.patch] }] };
  const workbook = connectAllocatedSelectionsToQuotation({}, book);
  const section = workbook.quotation["SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS"];
  assert.equal(section.rows.length, 4);
  const [ensuiteRow, bathroomRow, mirrorRow, cabinetRow] = section.rows;
  assert.equal(ensuiteRow.supplier, "Regency");
  assert.equal(ensuiteRow.locations, "Ensuite ×1");
  assert.equal(ensuiteRow.excelRate, 1500, "quoted $1,650 inc GST -> $1,500 ex GST base rate");
  assert.equal(ensuiteRow.priceStatus, "Supplier quote");
  assert.equal(ensuiteRow.quoteReference, "RQ-TEST-1");
  assert.match(ensuiteRow.description, /W 1200mm x H 2000mm/);
  assert.equal(ensuiteRow.allowanceTotal, 1200);
  assert.equal(ensuiteRow.variation, 450);
  assert.equal(bathroomRow.supplier, "Stegbar");
  assert.equal(mirrorRow.priceStatus, "Supplier Quote Required");
  assert.equal(mirrorRow.excelRate, "");
  assert.equal(cabinetRow.priceStatus, "Current Price");
  assert.equal(cabinetRow.model, cabinetLine.supplierCode);
  const items = workbook.procurement.items;
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => item.supplier), ["Regency", "Stegbar", "Bradnam's", "Stegbar"]);
  assert.deepEqual(items.map((item) => item.procurementCategory), ["Shower Screens", "Shower Screens", "Mirrors", "Shaving Cabinets"]);
  assert.equal(items[0].rateStatus, "Supplier quote RQ-TEST-1");
  assert.equal(items[2].rateStatus, "Supplier quote required");
  assert.equal(items[2].estimatedTotal, null);
  assert.deepEqual(items[0].locationSchedule, [{ location: "Ensuite", quantity: 1 }]);
  // Re-running replaces this connector's rows rather than duplicating them.
  assert.equal(connectAllocatedSelectionsToQuotation(workbook, book).quotation["SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS"].rows.length, 4);
});

check("an existing fixed retail mirror keeps its Product Library price", () => {
  const retail = mirrors.find((product) => product.productCode === "PLB-HNC-BEV600");
  const line = configuredLineFromProduct(retail, { room: "Powder Room", quantity: 2, options: {}, unitAllowance: 100 }, { cataloguePrice: retail.clientPrice });
  assert.equal(line.unitPrice, retail.clientPrice);
  assert.equal(line.priceSource, "catalogue-price");
  assert.equal(line.quantity, 2);
  assert.equal(line.variation, (retail.clientPrice - 100) * 2);
  assert.deepEqual(dimensionProblems(retail, {}), []);
});

console.log(`${results.length} checks passed:\n- ${results.join("\n- ")}`);
