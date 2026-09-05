import assert from "assert/strict";
import fs from "fs";
import path from "path";
import {
  CABINETRY_LOCATION_AREA_KEYS,
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
  buildCabinetrySelectionPayload,
  normaliseCabinetrySelection,
} from "../lib/builders/cabinetryWorkflow.js";

const ROOT = process.cwd();
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.json");
const selectionsSource = fs.readFileSync(path.join(ROOT, "pages/modules/builders/selections-book.js"), "utf8");
const productLibraryServiceSource = fs.readFileSync(path.join(ROOT, "lib/product-library/catalogueService.js"), "utf8");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const active = LAMINEX_CABINETRY_CATALOGUE.filter((record) => record.availabilityStatus !== "inactive");
const requiredFields = [
  "id",
  "supplier",
  "brand",
  "colourName",
  "colourFamily",
  "productRange",
  "finish",
  "application",
  "swatchImage",
  "swatchThumbnail",
  "officialProductUrl",
  "officialCollectionUrl",
  "availabilityStatus",
  "pricingTier",
  "priceStatus",
  "verifiedAt",
  "source",
];

assert.ok(catalogue.length > 6, "Laminex catalogue must not be the six-record starter set");
assert.equal(active.length, 53, "active Laminex cabinetry finish combinations must be imported");
assert.equal(new Set(active.map((record) => record.colourName)).size, 38, "active Laminex colour count must be grouped by colour");
assert.deepEqual(new Set(active.map((record) => record.supplier)), new Set(["Laminex"]), "Laminex catalogue must not leak other suppliers");
assert.equal(new Set(active.map((record) => record.id)).size, active.length, "Laminex catalogue ids must be duplicate-free");
assert.ok(active.every((record) => requiredFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))), "all Laminex records must carry the required structured fields");
assert.ok(active.every((record) => record.application.match(/cabinetry/i)), "active records must be cabinetry-compatible only");
assert.ok(active.every((record) => !/Formica|Waterloo|Partition|Wet Area|Flooring|Edging/i.test(`${record.productRange} ${record.source} ${record.application}`)), "unrelated ranges must be excluded from active Laminex selections");

for (const family of ["Whites & Neutrals", "Woodgrains", "Minerals", "Accents"]) {
  assert.ok(active.some((record) => record.colourFamily === family), `${family} must be available as a filterable family`);
}

for (const record of active) {
  assert.ok(record.officialProductUrl.startsWith("https://www.laminex.com.au/"), "official product links must point to Laminex");
  assert.ok(record.officialCollectionUrl.startsWith("https://www.laminex.com.au/"), "official collection links must point to Laminex");
  assert.ok(record.swatchImage.startsWith("/images/catalogues/laminex/"), "runtime swatches must use local public paths");
  assert.ok(fs.existsSync(path.join(ROOT, "public", record.swatchImage.replace(/^\//, ""))), `local swatch must exist for ${record.id}`);
}

const polarFinishes = active.filter((record) => record.colourName === "Polar White").map((record) => record.finish);
assert.ok(polarFinishes.includes("AbsoluteMatte") && polarFinishes.includes("Natural"), "multiple compatible finishes must be preserved for one colour");
assert.ok(selectionsSource.includes("groupCabinetryColourRecords"), "selector must group duplicate colour/finish records");
assert.ok(selectionsSource.includes("cabinetrySupplierButtons"), "selector must render contrast-controlled supplier buttons");
assert.ok(selectionsSource.includes("cabinetryCatalogueToolbar"), "selector must render search and filters");
assert.ok(selectionsSource.includes("cabinetry-inspection-modal"), "selector must render a large inspection modal");
assert.ok(selectionsSource.includes('target="_blank" rel="noopener noreferrer"'), "official Laminex links must open safely in a new tab");
assert.ok(selectionsSource.includes("applyCabinetryRecordToAllCompatibleAreas"), "selector must support applying a finish to all compatible room areas");
assert.ok(selectionsSource.includes("setEditingLocationName(\"\")"), "room navigation must remain independent");
assert.ok(selectionsSource.includes("color: #0f172a"), "inactive supplier buttons must have dark readable text");

const searchHit = active.filter((record) => [record.colourName, record.productRange, record.finish].join(" ").toLowerCase().includes("polar"));
assert.ok(searchHit.some((record) => record.colourName === "Polar White"), "search must be able to find Laminex colours");
assert.ok(active.filter((record) => record.productRange === "Laminex AbsoluteMatte Panels").every((record) => record.finish === "AbsoluteMatte"), "range and finish compatibility must remain exact");
assert.ok(active.some((record) => record.priceStatus === "included"), "included pricing status must be represented");
assert.ok(active.some((record) => record.priceStatus === "upgrade"), "upgrade pricing status must be represented");
assert.ok(active.some((record) => record.priceStatus === "supplier_quote_required"), "quote-required pricing status must be represented");

const selected = active.find((record) => record.colourName === "Polar White" && record.finish === "AbsoluteMatte");
const otherRoomColour = POLYTEC_CABINETRY_CATALOGUE[0];
const selection = normaliseCabinetrySelection({
  locations: [
    {
      location: "Kitchen",
      included: true,
      enabledAreaKeys: CABINETRY_LOCATION_AREA_KEYS,
      supplier: "Laminex",
      productRange: selected.productRange,
      defaultColour: selected,
      areaSelections: {
        lowerDoorsDrawers: selected,
        overheadDoors: selected,
      },
      benchtop: { range: "Builder stone", thickness: "20 mm", priceStatus: "quote_required" },
      handles: { base: { productName: "Handleless", productCode: "HANDLELESS" } },
      confirmedAt: "2026-08-31T00:00:00.000Z",
    },
    {
      location: "Laundry",
      included: true,
      enabledAreaKeys: ["lowerDoorsDrawers"],
      supplier: "Polytec",
      productRange: otherRoomColour.productRange,
      defaultColour: otherRoomColour,
      areaSelections: { lowerDoorsDrawers: otherRoomColour },
      benchtop: { range: "Laminate", thickness: "Laminated", priceStatus: "price_pending" },
      handles: { base: { productName: "Handleless", productCode: "HANDLELESS" } },
      confirmedAt: "2026-08-31T00:00:00.000Z",
    },
  ],
  schedule: [
    { componentId: "CAB-KIT-1", location: "Kitchen", unitType: "Standard base unit", quantity: 1, clientSelectableSurfaces: ["lowerDoorsDrawers"], handleQuantity: 1 },
  ],
});
const payload = buildCabinetrySelectionPayload({ projectId: "laminex-test", selection });
assert.equal(payload.selected_details.cabinetrySelection.locations[0].areaSelections.overheadDoors.id, selected.id, "selection must persist exact finish by room area");
assert.equal(payload.selected_details.cabinetrySelection.locations[1].supplier, "Polytec", "applying Laminex in Kitchen must not overwrite another room");
assert.equal(payload.selected_details.cabinetrySelection.boqLines[0].productRange, selected.productRange, "BOQ must carry Laminex range");
assert.equal(payload.selected_details.cabinetrySelection.boqLines[0].swatchImage, selected.swatchImage, "BOQ must carry selected swatch only");
assert.equal(payload.selected_details.cabinetrySelection.cabinetmakerRfq.lines[0].officialProductUrl, selected.officialProductUrl, "cabinetmaker RFQ must carry official Laminex URL");
assert.equal(payload.selected_details.cabinetrySelection.procurementSchedule[0].metadata.priceStatus, selected.priceStatus, "procurement must carry price status");

assert.match(productLibraryServiceSource, /AU-LAMINEX-CABINETRY-COLOURS\.json/, "Product Library must import the Laminex cabinetry catalogue");
assert.match(productLibraryServiceSource, /familyKey: "cabinet-finish"/, "Product Library must expose Laminex as cabinet-finish products");
assert.match(productLibraryServiceSource, /attributes:[\s\S]*colourFamily/, "Product Library products must expose colour-family attributes");

console.log(`Laminex cabinetry catalogue tests passed. activeColours=${new Set(active.map((record) => record.colourName)).size} activeCombinations=${active.length}`);
