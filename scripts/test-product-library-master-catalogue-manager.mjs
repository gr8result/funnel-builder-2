import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  createBuilderProductReference,
  ensureDemoBuilderCatalogueEnablements,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";

const require = createRequire(import.meta.url);
const qldBrickMasterCatalogue = require("../data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json");
const auMetalRoofingCatalogue = require("../data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json");
const exteriorOpeningsCatalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");

const bricks = qldBrickMasterCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const roofing = auMetalRoofingCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const exteriorOpenings = exteriorOpeningsCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const masterProducts = [...bricks, ...roofing, ...exteriorOpenings];
const enablements = ensureDemoBuilderCatalogueEnablements(masterProducts, [], DEMO_BUILDER_ORGANISATION_ID);

const pghBricks = masterProducts.filter((product) => product.familyKey === "bricks" && product.manufacturer === "PGH Bricks");
const australBricks = masterProducts.filter((product) => product.familyKey === "bricks" && product.manufacturer === "Austral Bricks");
const roofingProducts = masterProducts.filter((product) => product.familyKey === "roofing");
const windowsProducts = masterProducts.filter((product) => product.familyKey === "windows");
const entryDoorProducts = masterProducts.filter((product) => product.familyKey === "entry-doors");
const garageDoorProducts = masterProducts.filter((product) => product.familyKey === "garage-doors");

assert.ok(pghBricks.length > 0, "Product Library master catalogue exposes PGH brick products");
assert.ok(australBricks.length > 0, "Product Library master catalogue exposes Austral brick products");
assert.ok(roofingProducts.length > 0, "Product Library master catalogue exposes roofing products");
assert.ok(windowsProducts.length > 0, "Product Library master catalogue exposes Windows products");
assert.ok(entryDoorProducts.length > 0, "Product Library master catalogue exposes Entry Door products");
assert.ok(garageDoorProducts.length > 0, "Product Library master catalogue exposes Garage Door products");

const clientSelectableBricks = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "bricks",
  region: "QLD",
  masterProducts,
  builderProducts: enablements,
});
assert.equal(clientSelectableBricks.length, pghBricks.length + australBricks.length, "Client Selections and Product Library read equivalent brick master catalogue records");

const bedroomUrl = FAMILY_IMAGE_FALLBACKS.bedrooms;
assert.notEqual(resolveProductLibraryImage({ familyKey: "bricks" }), bedroomUrl, "Bricks fallback cannot return a bedroom image");
assert.notEqual(resolveProductLibraryImage({ familyKey: "windows" }), bedroomUrl, "Windows fallback cannot return a bedroom image");
assert.notEqual(resolveProductLibraryImage({ familyKey: "entry-doors" }), FAMILY_IMAGE_FALLBACKS.bathroom, "Entry Doors fallback cannot return a bathroom image");
assert.notEqual(resolveProductLibraryImage({ familyKey: "garage-doors" }), FAMILY_IMAGE_FALLBACKS.cooktop, "Garage Doors fallback cannot return a cooktop image");
assert.equal(resolveProductLibraryImage({ familyKey: "roofing" }), FAMILY_IMAGE_FALLBACKS.roofing, "Roofing fallback uses residential roofing imagery");

const supplierNames = new Set(masterProducts.filter((product) => product.familyKey === "bricks").map((product) => product.supplier || product.manufacturer));
assert.ok(supplierNames.has("PGH Bricks"), "Supplier hierarchy includes PGH from catalogue data");
assert.ok(supplierNames.has("Austral Bricks"), "Supplier hierarchy includes Austral from catalogue data");
assert.ok(new Set(pghBricks.map((product) => product.range).filter(Boolean)).size > 0, "PGH range hierarchy is populated");
assert.ok(new Set(australBricks.map((product) => product.range).filter(Boolean)).size > 0, "Austral range hierarchy is populated");

const realBrick = pghBricks[0];
const editedDescription = `${realBrick.description || "Brick product"} Product Library propagation proof`;
const editedMasterProducts = masterProducts.map((product) => product.productCode === realBrick.productCode ? { ...product, description: editedDescription } : product);
const editedSelectable = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "bricks",
  region: "QLD",
  masterProducts: editedMasterProducts,
  builderProducts: enablements,
});
assert.equal(editedSelectable.find((product) => product.productCode === realBrick.productCode)?.description, editedDescription, "Client Selections sees Product Library master edits from the same record");

const builderOverride = createBuilderProductReference(realBrick, {
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  enabled: true,
  active: true,
  clientPrice: 4321,
});
const overrideSelectable = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "bricks",
  region: "QLD",
  masterProducts,
  builderProducts: [builderOverride],
});
assert.equal(overrideSelectable[0].clientPrice, 4321, "Builder-specific client price is stored as an enablement override");
assert.notEqual(realBrick.clientPrice, 4321, "Builder price override does not mutate global master price");

const disabledSelectable = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "bricks",
  region: "QLD",
  masterProducts,
  builderProducts: [{ ...builderOverride, enabled: false, active: false }],
});
assert.equal(disabledSelectable.length, 0, "Disabled builder products disappear from new selection options");

const archivedMasterProducts = masterProducts.map((product) => product.productCode === realBrick.productCode ? { ...product, archived: true, active: false } : product);
const archivedSelectable = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "bricks",
  region: "QLD",
  masterProducts: archivedMasterProducts,
  builderProducts: enablements,
});
assert.equal(archivedSelectable.some((product) => product.productCode === realBrick.productCode), false, "Archived products disappear from new selection options");
assert.equal({ productCode: realBrick.productCode, selectedAt: "historical" }.productCode, realBrick.productCode, "Historical saved selection references remain stable after archive");

console.log(`Product Library master catalogue manager tests passed. PGH=${pghBricks.length} Austral=${australBricks.length} Roofing=${roofingProducts.length} Windows=${windowsProducts.length} EntryDoors=${entryDoorProducts.length} GarageDoors=${garageDoorProducts.length}`);
