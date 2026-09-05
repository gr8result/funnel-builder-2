import assert from "assert/strict";
import fs from "fs";
import path from "path";
import {
  CABINETRY_LOCATION_AREA_KEYS,
  CABINETRY_SCHEDULE_TYPE_OPTIONS,
  POLYTEC_CABINETRY_CATALOGUE,
  buildCabinetrySelectionPayload,
  normaliseCabinetrySelection,
} from "../lib/builders/cabinetryWorkflow.js";

const ROOT = process.cwd();
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.json");
const reportPath = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.report.json");
const selectionsSource = fs.readFileSync(path.join(ROOT, "pages/modules/builders/selections-book.js"), "utf8");
const productLibraryServiceSource = fs.readFileSync(path.join(ROOT, "lib/product-library/catalogueService.js"), "utf8");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const active = POLYTEC_CABINETRY_CATALOGUE.filter((record) => record.availabilityStatus !== "inactive");

assert.equal(active.length, 306, "Polytec cabinetry colour/finish variants must be imported from the official matrix");
assert.equal(new Set(active.map((record) => record.colourName)).size, 170, "Polytec cabinetry colour count must be substantially more than seven placeholders");
assert.equal(report.importedColourFinishVariants, active.length, "report count must match imported records");
assert.equal(report.importedColours, 170, "report colour count must match imported colours");
assert.equal(report.duplicatesDetected, 0, "Polytec catalogue ids must be duplicate-free");
assert.equal(report.fetchFailures.length, 0, "Polytec colour pages must fetch without failures");
assert.ok(report.officialClaims.coloursPageMentionsMoreThan300Colours, "sync must verify Polytec's over-300-colour claim from the official page");
assert.ok(report.officialClaims.decorative18mmDescriptionMentionsDoorFinishes, "sync must verify the official decorative 18mm door finish claim");
assert.equal(catalogue.length, active.length, "runtime module must use generated catalogue data");

for (const record of active) {
  assert.equal(record.supplier, "Polytec");
  assert.ok(record.officialProductUrl.startsWith("https://www.polytec.com.au/colour/"), "Polytec records must link to official colour pages");
  assert.ok(record.officialCollectionUrl.startsWith("https://www.polytec.com.au/products/decorative-18mm-doors-and-panels/"), "Polytec records must carry official cabinetry product source");
  assert.ok(/doors and panels/i.test(record.productRange), "records must be cabinetry door/panel compatible");
  assert.equal(record.benchtopSuitability, false, "benchtop-only Polytec records must not appear in cabinetry colour choices");
  assert.ok(record.swatchImage.startsWith("/images/catalogues/polytec/"), "Polytec swatches must use local public paths");
  assert.ok(fs.existsSync(path.join(ROOT, "public", record.swatchImage.replace(/^\//, ""))), `local swatch must exist for ${record.id}`);
}

for (const finish of ["Smooth", "Matt", "Ravine", "Legato", "Venette", "WOODMATT".toLowerCase(), "ULTRAGLAZE", "ULTRAMATT"]) {
  assert.ok(active.some((record) => record.finish.toLowerCase() === finish.toLowerCase()), `${finish} must be represented`);
}

for (const type of [
  "Standard base unit",
  "Corner unit",
  "Sink cupboard",
  "Pull-out bin",
  "Underbench oven cabinet",
  "Dishwasher cabinet",
  "Microwave cabinet",
  "Rangehood cabinet",
  "Tall pantry",
  "Four-bank drawers",
  "Five-bank drawers",
  "Two-bank pot drawers",
  "Three-bank pot drawers: one small and two large",
  "Hidden drawers",
]) {
  assert.ok(CABINETRY_SCHEDULE_TYPE_OPTIONS.includes(type), `${type} must remain available in Cabinet Schedule`);
}

assert.match(selectionsSource, /function CabinetrySelectionList/, "Cabinetry workflow must use a shared list component");
assert.match(selectionsSource, /width: 28px; height: 28px; min-width: 28px; min-height: 28px/, "shared list rows must use an actual 28px checkbox control");
assert.match(selectionsSource, /CABINETRY_SUPPLIER_CONFIG/, "supplier website links must come from config");
assert.match(selectionsSource, /Visit Polytec Website/, "Polytec website label must exist");
assert.match(selectionsSource, /https:\/\/www\.polytec\.com\.au\/colours\//, "Polytec website URL must be exact");
assert.match(selectionsSource, /CabinetrySwatchImage/, "colour swatches must have image error handling");
assert.match(selectionsSource, /Load more colours/, "large colour catalogues must use incremental loading");
assert.match(selectionsSource, /guidedImageCardTitle/, "Interior category cards must use compact title strips over photos");
assert.doesNotMatch(selectionsSource, /guidedImageCardFooter/, "Interior category cards must not render footer information panels");
assert.match(selectionsSource, /clientSelections:cabinetryBack/, "Cabinetry Back must use the real internal workflow state before falling back");
assert.doesNotMatch(selectionsSource, /Back to Cabinetry Rooms/, "Cabinetry Back must not hard-code the room landing destination");
assert.match(selectionsSource, /function handleSelectCabinetryColour\(supplier, colourRecord\)/, "Laminex and Polytec must use one shared colour selection handler");
assert.match(selectionsSource, /function normaliseCabinetryColourSelectionRecord/, "supplier colour records must be normalised before selection");
assert.match(selectionsSource, /Choose where this colour will be used/, "Colour selection modal must show area guidance when no application area is selected");
assert.doesNotMatch(selectionsSource, /compatibleRecords\.length === 1/, "Single-combination colours must still open the shared area-confirmation modal");
assert.doesNotMatch(selectionsSource, /Visit Laminex Website<\/a> : null/, "supplier website button must not be hard-coded to Laminex");
assert.match(productLibraryServiceSource, /AU-POLYTEC-CABINETRY-COLOURS\.json/, "Product Library must import Polytec catalogue data");
assert.match(productLibraryServiceSource, /polytecColourToMasterProduct/, "Product Library must map Polytec catalogue records");

const selected = active.find((record) => record.colourName === "Adriatic" && record.finish === "Venette") || active[0];
const selection = normaliseCabinetrySelection({
  locations: [{
    location: "Kitchen",
    included: true,
    enabledAreaKeys: CABINETRY_LOCATION_AREA_KEYS,
    supplier: "Polytec",
    productRange: selected.productRange,
    defaultColour: selected,
    areaSelections: { lowerDoorsDrawers: selected, overheadDoors: selected },
    benchtop: { range: "Laminate", thickness: "Laminated", priceStatus: "price_pending" },
    handles: { base: { productName: "Handleless", productCode: "HANDLELESS" } },
    confirmedAt: "2026-08-31T00:00:00.000Z",
  }],
  schedule: [{ componentId: "CAB-KIT-POL-1", location: "Kitchen", unitType: "Standard base unit", quantity: 3, notes: "Three base units", clientSelectableSurfaces: ["lowerDoorsDrawers"], handleQuantity: 3 }],
});
const payload = buildCabinetrySelectionPayload({ projectId: "polytec-test", selection });
assert.equal(payload.selected_details.cabinetrySelection.locations[0].defaultColour.id, selected.id, "selected exact Polytec colour/finish must persist");
assert.equal(payload.selected_details.cabinetrySelection.schedule[0].quantity, 3, "schedule quantity must persist");
assert.equal(payload.selected_details.cabinetrySelection.schedule[0].notes, "Three base units", "schedule notes must persist");
assert.equal(payload.selected_details.cabinetrySelection.boqLines[0].supplier, "Polytec", "BOQ must carry Polytec supplier");

console.log(`Polytec cabinetry catalogue tests passed. activeColours=${new Set(active.map((record) => record.colourName)).size} activeCombinations=${active.length}`);
