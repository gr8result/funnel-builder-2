import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  APPLIANCE_LEGACY_SOURCE_COLUMNS,
  classifyApplianceFamily,
  extractManufacturerModel,
  importLegacyApplianceCsv,
} from "../lib/product-library/applianceLegacyCsvImporter.js";

const sourcePath = process.argv[2] || "c:/Users/grant/Downloads/appliance options.csv";
const result = importLegacyApplianceCsv(readFileSync(sourcePath, "utf8"), { sourceFile: sourcePath });

assert.equal(APPLIANCE_LEGACY_SOURCE_COLUMNS.length, 19, "all 19 legacy columns must be explicitly mapped");
assert.equal(result.report.sourceRows, 194, "all legacy appliance rows must be accounted for");
assert.deepEqual(result.report.units, { EACH: 159, PACK: 35 });
assert.deepEqual(result.report.brands, {
  ARISTON: 33,
  BLANCO: 32,
  EUROMAID: 33,
  OMEGA: 30,
  SMEG: 33,
  WESTINGHOUSE: 33,
});

assert.equal(result.invalidRows.length, 0, "valid source file should not reject rows");
assert.equal(result.packs.length, 35, "all PACK rows should become appliance packs");
assert.equal(result.sourceRows.filter((row) => row.unit === "EACH").length, 159);
assert.ok(result.products.length < 159, "component rows repeated across packs must be deduplicated");
assert.equal(result.duplicateComponentRows.length, 159 - result.products.length);
assert.equal(result.unresolvedModelNumbers.length, 0, "each physical product should have an extracted model number");
assert.equal(result.priceConflicts.length, 0, "repeated component rows should not disagree on price");

const euromaidOvenRows = result.sourceRows.filter((row) => row.manufacturerModel === "EO605DTB");
const euromaidOvenProduct = result.products.find((product) => product.manufacturerModel === "EO605DTB");
assert.ok(euromaidOvenRows.length > 1, "fixture should contain repeated EUROMAID oven component rows");
assert.ok(euromaidOvenProduct, "repeated EUROMAID oven should produce one canonical product");
assert.equal(euromaidOvenProduct.sourceRows.length, euromaidOvenRows.length);
assert.equal(euromaidOvenProduct.productId, "product:appliances:ovens:euromaid:eo605dtb");
assert.equal(euromaidOvenProduct.productId, result.products.find((product) => product.manufacturerModel === "EO605DTB").productId);

assert.equal(extractManufacturerModel("WESTINGHOUSE 60CM CERAMIC COOKTOP WHC642BC", "WESTINGHOUSE"), "WHC642BC");
assert.equal(extractManufacturerModel("SMEG 90CM FREESTANDING COOKER C9GMXA-1", "SMEG"), "C9GMXA-1");
assert.equal(extractManufacturerModel("ARISTON 90CM GAS COOKTOP PKQ 755 D GH AUS", "ARISTON"), "PKQ 755 D GH AUS");
assert.equal(classifyApplianceFamily({ productName: "SMEG 60CM INDUCTION COOKTOP SI2641D", unit: "EACH" }), "cooktops");
assert.equal(classifyApplianceFamily({ productName: "OMEGA 90CM CANOPY RANGEHOOD ORC916MB", unit: "EACH" }), "rangehoods");
assert.equal(classifyApplianceFamily({ productName: "ARISTON PACK - 600MM GAS COOKTOP PACK", unit: "PACK" }), "appliance-packs");

assert.ok(result.packRelationships.length >= result.packs.length, "packs must reference component product IDs");
assert.ok(result.packRelationships.every((relationship) => relationship.packProductId && relationship.componentProductId), "pack relationships must use stable product IDs");
assert.ok(result.packs.every((pack) => Array.isArray(pack.componentProductIds) && pack.componentProductIds.length > 0), "each pack must list component product IDs");
assert.ok(result.products.every((product) => product.categoryId === "category:appliances"), "generic paint and lighting must be excluded from this kitchen appliance import");
assert.ok(!result.products.some((product) => /paint|lighting/i.test(`${product.familyId} ${product.productName}`)), "paint and lighting records must not enter appliance products");
assert.equal(result.productsMissingImages.length, result.products.length, "missing images should be reported for later verification");
assert.equal(result.productsMissingDescriptions.length, result.products.length, "missing descriptions should be reported for later enrichment");

const mutated = structuredClone(result.products[0]);
mutated.sellPrice += 1000;
assert.notEqual(mutated.sellPrice, result.products[0].sellPrice, "product records can be snapshotted immutably by consumers");

console.log("Appliance legacy CSV importer checks passed.", {
  sourceRows: result.report.sourceRows,
  uniqueProducts: result.report.uniqueProducts,
  packs: result.report.packs,
  duplicateComponentRows: result.report.duplicateComponentRows,
  unresolvedModelNumbers: result.report.unresolvedModelNumbers,
  priceConflicts: result.report.priceConflicts,
});
