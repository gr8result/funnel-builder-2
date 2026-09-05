import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  STONE_BENCHTOP_CATALOGUE,
  STONE_BENCHTOP_SUPPLIERS,
  activeStoneBenchtopProducts,
  buildStoneSupplierRfq,
  configureStoneBenchtopSelection,
} from "../lib/builders/stoneBenchtopWorkflow.js";
import {
  buildCabinetrySelectionPayload,
  defaultCabinetryDraft,
  normaliseCabinetrySelection,
} from "../lib/builders/cabinetryWorkflow.js";

const root = process.cwd();
const cataloguePath = path.join(root, "data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.json");
const reportPath = path.join(root, "data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.report.json");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const active = activeStoneBenchtopProducts(STONE_BENCHTOP_CATALOGUE);

assert.equal(catalogue.title, "Stone, Porcelain & Sintered Benchtops");
assert.ok(active.length >= 100, "catalogue must not be a tiny starter catalogue");
assert.deepEqual(STONE_BENCHTOP_SUPPLIERS.sort(), ["Caesarstone", "Neolith", "Smartstone", "Stone Ambassador"].sort());
for (const supplier of STONE_BENCHTOP_SUPPLIERS) {
  assert.ok(active.some((product) => product.supplier === supplier), `${supplier} products imported`);
}
assert.equal(new Set(active.map((product) => product.id)).size, active.length, "stable ids must be unique");
assert.equal(report.duplicatesDetected, 0, "duplicates must be detected/reported");

for (const product of active) {
  assert.ok(product.officialProductUrl.startsWith("https://"), `${product.id} preserves official product URL`);
  assert.ok(product.materialType, `${product.id} preserves material terminology`);
  assert.ok(product.finishOptions.length, `${product.id} has compatible finish options`);
  assert.ok(product.thicknessOptions.length, `${product.id} has compatible thickness options`);
  assert.notEqual(product.priceStatus, "$0", "unknown prices must not render as zero");
  if (product.primarySwatchImage) {
    assert.ok(fs.existsSync(path.join(root, "public", product.primarySwatchImage.replace(/^\//, ""))), `${product.id} local image exists`);
  }
}

assert.ok(active.some((product) => product.supplier === "Smartstone" && product.priceGroup === "Pure"), "Smartstone Pure preserved");
assert.ok(active.some((product) => product.supplier === "Smartstone" && product.priceGroup === "Classic"), "Smartstone Classic preserved");
assert.ok(active.some((product) => product.supplier === "Smartstone" && product.priceGroup === "Deluxe"), "Smartstone Deluxe preserved");
assert.ok(active.some((product) => product.supplier === "Stone Ambassador" && product.collection === "Zenith Surfaces (VCS)" && product.priceGroup === "Essential"), "Stone Ambassador Zenith Essential preserved");
assert.ok(active.some((product) => product.supplier === "Stone Ambassador" && product.collection === "Vasari Porcelain" && product.priceGroup === "Category 1"), "Stone Ambassador Vasari category preserved");
assert.ok(active.some((product) => product.supplier === "Stone Ambassador" && product.collection === "Kaya Surfaces"), "Stone Ambassador Kaya preserved");
assert.ok(active.some((product) => product.supplier === "Stone Ambassador" && /WA only/i.test(product.availabilityRegion)), "region restriction preserved");
assert.ok(active.some((product) => product.supplier === "Caesarstone" && product.productCode === "6011" && /Mineral Surface/i.test(product.materialType)), "Caesarstone code/material preserved");
assert.ok(active.some((product) => product.supplier === "Neolith" && product.colourName === "Calacatta Roma"), "Neolith model preserved");

const caesar = active.find((product) => product.supplier === "Caesarstone" && product.productCode === "6011");
const configured = configureStoneBenchtopSelection(caesar, {
  room: "Kitchen",
  finish: caesar.finishOptions[0],
  slabThickness: caesar.thicknessOptions[0],
  finishedEdgeThickness: "40 mm mitred edge",
  edgeProfile: "Mitred apron",
  applications: ["Main benchtop"],
  cutouts: ["Sink", "Cooktop"],
});
assert.equal(configured.slabThickness, "20mm");
assert.equal(configured.finishedEdgeThickness, "40 mm mitred edge", "actual slab thickness and finished-edge thickness are separate");
assert.deepEqual(configured.cutouts, ["Sink", "Cooktop"]);

const smartstone = active.filter((product) => product.supplier === "Smartstone").slice(0, 3);
assert.equal(smartstone.length, 3, "three-product comparison source available");
assert.ok(smartstone.every((product) => product.supplier === "Smartstone"), "supplier separation holds for comparison");

let draft = defaultCabinetryDraft({ locations: [{ location: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: {}, handles: { base: { productName: "Handleless" } } }, { location: "Laundry", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: {}, handles: { base: { productName: "Handleless" } } }] });
draft = normaliseCabinetrySelection({
  ...draft,
  locations: draft.locations.map((location) => location.location === "Kitchen" ? { ...location, benchtop: { ...configured, materialChoice: "stone", category: "Stone, Porcelain & Sintered Benchtops", range: configured.collection, colour: configured.colourName, thickness: configured.slabThickness } } : location),
});
assert.equal(draft.locations.find((location) => location.location === "Kitchen").benchtop.productCode, "6011");
assert.equal(draft.locations.find((location) => location.location === "Laundry").benchtop, null, "Kitchen benchtop must not overwrite Laundry");
assert.ok(draft.boqLines.some((line) => line.sourceSelectionType === "stone_benchtop" && line.productCode === "6011"), "BOQ receives stone benchtop line");
assert.ok(buildStoneSupplierRfq(draft.locations).lines.some((line) => line.productCode === "6011"), "stone supplier RFQ receives selected surface");
const payload = buildCabinetrySelectionPayload({ workspaceId: "workspace-a", projectId: "project-a", selection: draft });
assert.ok(payload.selected_details.cabinetrySelection.stoneSupplierRfq.lines.length, "selection payload carries stone supplier RFQ");

const catalogueServiceSource = fs.readFileSync(path.join(root, "lib/product-library/catalogueService.js"), "utf8");
assert.match(catalogueServiceSource, /AU-STONE-BENCHTOP-CATALOGUE\.json/, "Product Library imports the stone catalogue");
assert.match(catalogueServiceSource, /familyKey:\s*"stone-benchtops"/, "Product Library maps records to the stone-benchtops family");
assert.match(catalogueServiceSource, /stoneBenchtopToMasterProduct/, "Product Library supplier mapping exists");

console.log(`Stone benchtop catalogue tests passed. activeProducts=${active.length} suppliers=${STONE_BENCHTOP_SUPPLIERS.length}`);
