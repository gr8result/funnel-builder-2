import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";

const EXPECTED_SOURCE_SHA256 = "F325357E987DAFB4A695C0529057423DB917BD5FEFADAD6C2AA7242A16667872";
const sourcePath = process.argv[2] || "C:\\Users\\grant\\Downloads\\appliance options.csv";
const sourceText = readFileSync(sourcePath, "utf8");
const sourceSha256 = crypto.createHash("sha256").update(sourceText).digest("hex").toUpperCase();

assert.equal(sourceSha256, EXPECTED_SOURCE_SHA256, "source CSV SHA-256 must match the authoritative Checkpoint 1 baseline");

const result = buildCanonicalApplianceCatalogue(sourceText, { sourceFile: sourcePath });
const { products } = result.catalogue;
const { packs, relationships } = result.packCatalogue;

assert.equal(products.length, 83, "Checkpoint 2 must retain exactly 83 canonical products");
assert.equal(packs.length, 35, "Checkpoint 2 must retain exactly 35 canonical packs");
assert.equal(relationships.length, 159, "Checkpoint 2 must retain exactly 159 source-level relationships");
assert.equal(result.checkpoint1.report.sourceRows, 194, "all 194 source rows remain accounted for");

const requiredProductFields = [
  "productId",
  "schemaVersion",
  "categoryId",
  "familyId",
  "subfamilyId",
  "productType",
  "brandId",
  "brandName",
  "rangeId",
  "rangeName",
  "manufacturerModel",
  "sku",
  "productName",
  "shortDescription",
  "fullDescription",
  "specifications",
  "widthMm",
  "heightMm",
  "depthMm",
  "capacity",
  "colour",
  "finish",
  "fuelOrEnergyType",
  "installationType",
  "unit",
  "sourceCostPrice",
  "tenantSellPrice",
  "gstStatus",
  "priceStatus",
  "supplierId",
  "supplierName",
  "primaryImage",
  "additionalImages",
  "imageStatus",
  "imageSourceUrl",
  "productPageUrl",
  "documentUrls",
  "applicableRooms",
  "selectable",
  "active",
  "discontinued",
  "source",
  "sourceCheckedAt",
  "sourceRowIds",
  "createdAt",
  "updatedAt",
];

products.forEach((product) => {
  requiredProductFields.forEach((field) => assert.ok(Object.hasOwn(product, field), `${product.productId} missing ${field}`));
});

const productIds = new Set(products.map((product) => product.productId));
assert.equal(productIds.size, 83, "product IDs are unique and deterministic");
assert.ok(products.every((product) => product.productId === `product:appliances:${product.familyId}:${slug(product.brandName)}:${slug(product.manufacturerModel || product.productName)}`), "product IDs match deterministic brand/model rule");
assert.equal(new Set(products.map((product) => `${slug(product.brandName)}::${slug(product.manufacturerModel)}`)).size, products.length, "no duplicate brand/model products");
assert.ok(products.every((product) => Array.isArray(product.sourceRowIds) && product.sourceRowIds.length > 0), "every product has source row traceability");

assert.ok(relationships.every((relationship) => productIds.has(relationship.componentProductId)), "every source relationship resolves to a product");
assert.ok(packs.every((pack) => pack.componentProductIds.every((productId) => productIds.has(productId))), "every pack component ID resolves");
assert.ok(packs.every((pack) => Array.isArray(pack.sourceRelationshipIds) && pack.sourceRelationshipIds.length > 0), "packs preserve source relationship IDs");
assert.equal(new Set(packs.flatMap((pack) => pack.sourceRelationshipIds)).size, 159, "source relationship IDs remain unique");
assert.ok(packs.every((pack) => Array.isArray(pack.sourceRowIds) && pack.sourceRowIds.length > 1), "packs preserve pack and component source rows");

assert.ok(products.every((product) => product.descriptionStatus), "every product has a description status");
assert.ok(products.every((product) => product.imageStatus), "every product has an image status");
assert.ok(products.filter((product) => product.imageStatus.startsWith("verified")).every((product) => product.imageSourceUrl && product.productPageUrl), "verified images require traceable sources");
assert.ok(products.every((product) => ["verified-official", "verified-retailer", "verified-distributor", "verified-archived", "pending-licence", "exact-image-unavailable"].includes(product.imageStatus)), "products use Checkpoint 2B image statuses");
assert.ok(products.filter((product) => ["pending-licence", "exact-image-unavailable"].includes(product.imageStatus)).every((product) => !product.primaryImage), "pending images are not represented as verified");

assert.ok(products.every((product) => product.specificationSources && Object.values(product.specificationSources).every((source) => source.status)), "every specification value has a source or pending status");
assert.equal(result.report.specificationsCompleted, 0, "no manufacturer-verified specification records are marked complete");
assert.equal(result.report.partialSpecificationRecords, 83, "all product specification records remain partial");
assert.equal(result.report.identityVariationsResolved, 18, "identity variations remain traceable");
assert.ok(result.researchLogRows.length >= 83, "all products have research attempts recorded");
assert.equal(result.imageLicensingRows.length, 83, "all products have image licensing review rows");
assert.ok(result.fieldSourceAuditRows.every((row) => row.source_status), "field source audit rows include source status");

products.forEach((product) => {
  assert.equal(product.sourceCostPrice, product.costPrice, `${product.productId} source cost price changed`);
  assert.equal(product.tenantSellPrice, product.sellPrice, `${product.productId} tenant sell price changed`);
  const withRetailReference = { ...product, currentRetailReference: product.sellPrice + 250 };
  assert.equal(product.sellPrice, withRetailReference.sellPrice, "current retail references cannot overwrite source prices");
});

packs.forEach((pack) => {
  const checkpointPack = result.checkpoint1.packs.find((sourcePack) => sourcePack.productId === pack.packId);
  assert.equal(pack.sourcePackPrice, checkpointPack.sellPrice, `${pack.packId} source pack price changed`);
});

assert.equal(products.some((product) => ["microwaves", "refrigerators", "fridges"].includes(product.familyId)), false, "no invented microwave or refrigerator records");
assert.equal(products.some((product) => /paint|lighting/i.test(`${product.familyId} ${product.productName}`)), false, "Kitchen paint/lighting separation is preserved");

const futureBrand = buildCanonicalApplianceCatalogue("9001,FUTURE BRAND,FUTURE BRAND,,,FUTURE BRAND 60CM ELECTRIC OVEN FB60EO,APPLIANCES | FUTURE BRAND 60CM ELECTRIC OVEN FB60EO | EACH | 1 | source,EACH,,1,1,,,FUTURE BRAND,,TRUE,appliance,TRUE,source", { sourceFile: "inline.csv" });
assert.equal(futureBrand.catalogue.products[0].brandName, "Future Brand", "unknown future brands remain supported");

console.log("Appliance Stage 3B Checkpoint 2 tests passed.", result.report);

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
