import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";

const sourcePath = process.argv[2] || "c:/Users/grant/Downloads/appliance options.csv";
const sourceText = readFileSync(sourcePath, "utf8");
const result = buildCanonicalApplianceCatalogue(sourceText, { sourceFile: sourcePath });
const checkpoint1 = result.checkpoint1;
const products = result.catalogue.products;
const packs = result.packCatalogue.packs;
const relationships = result.packCatalogue.relationships;

assert.equal(products.length, 83, "canonical physical appliance products must remain exactly 83");
assert.equal(packs.length, 35, "canonical appliance packs must remain exactly 35");
assert.equal(relationships.length, 159, "pack-component relationships must remain exactly 159");

const productIds = new Set(products.map((product) => product.productId));
assert.equal(productIds.size, products.length, "product IDs must be unique");
assert.ok(relationships.every((relationship) => productIds.has(relationship.componentProductId)), "every pack component must resolve to a real product ID");
assert.ok(packs.every((pack) => pack.componentProductIds.every((productId) => productIds.has(productId))), "pack component lists must resolve to products");

const brandModelKeys = products.map((product) => `${product.brandName}:${product.manufacturerModel}`);
assert.equal(new Set(brandModelKeys).size, brandModelKeys.length, "brand/model product records must not duplicate");
checkpoint1.products.forEach((sourceProduct) => {
  assert.ok(productIds.has(sourceProduct.productId), `deterministic ID changed or missing: ${sourceProduct.productId}`);
});

assert.ok(products.every((product) => product.descriptionStatus), "every product must have a description status");
assert.ok(products.every((product) => product.shortDescription && product.fullDescription), "every product must have generated client-facing descriptions");
assert.ok(products.every((product) => product.imageStatus), "every product must have an image status");
assert.ok(products.filter((product) => product.imageStatus.startsWith("verified")).every((product) => product.imageSourceUrl), "verified images must have source URLs");
assert.ok(products.filter((product) => ["pending-licence", "exact-image-unavailable"].includes(product.imageStatus)).every((product) => !product.primaryImage), "pending/unavailable images must not be represented as verified product images");

products.forEach((product) => {
  const sourceProduct = checkpoint1.products.find((item) => item.productId === product.productId);
  assert.equal(product.costPrice, sourceProduct.costPrice, `${product.productId} source cost must be preserved`);
  assert.equal(product.sellPrice, sourceProduct.sellPrice, `${product.productId} sell price must be preserved`);
  const withRetailReference = { ...product, currentRetailReference: product.sellPrice + 500 };
  assert.equal(withRetailReference.sellPrice, product.sellPrice, "current retail information must not overwrite source pricing");
});

packs.forEach((pack) => {
  const sourcePack = checkpoint1.packs.find((item) => item.productId === pack.packId);
  assert.equal(pack.sourcePackPrice, sourcePack.sellPrice, `${pack.packId} pack price must be preserved`);
  assert.equal(pack.importedSourceCost, sourcePack.costPrice, `${pack.packId} pack cost must be preserved`);
});

assert.ok(products.every((product) => product.specifications && typeof product.specifications === "object" && !Array.isArray(product.specifications)), "specifications must be structured objects");
assert.ok(products.every((product) => product.specificationStatus), "every product must have a specification status");
assert.ok(products.every((product) => product.specificationStatus === "partial"), "legacy-only specifications remain partial until manufacturer verification");
assert.ok(products.every((product) => product.specificationSources && Object.values(product.specificationSources).every((source) => source.status)), "every specification value has a source or pending status");
assert.ok(products.every((product) => Object.hasOwn(product, "widthMm") && Object.hasOwn(product, "heightMm") && Object.hasOwn(product, "depthMm")), "canonical products expose millimetre dimension fields");
assert.ok(products.every((product) => product.sourceCostPrice === product.costPrice), "source cost price is preserved separately");
assert.ok(products.every((product) => Array.isArray(product.sourceRowIds) && product.sourceRowIds.length > 0), "canonical products expose source row IDs");
assert.ok(packs.every((pack) => pack.brandName && pack.shortDescription && pack.fullDescription), "canonical packs include display descriptions");
assert.ok(packs.every((pack) => Array.isArray(pack.sourceRelationshipIds) && pack.sourceRelationshipIds.length > 0), "canonical packs preserve source relationship IDs");
assert.ok(packs.every((pack) => Array.isArray(pack.sourceRowIds) && pack.sourceRowIds.length > 1), "canonical packs preserve pack and component source rows");
assert.equal(products.some((product) => ["microwaves", "refrigerators", "fridges"].includes(product.familyId)), false, "do not invent microwave or refrigerator products");
assert.equal(products.some((product) => /paint|lighting/i.test(`${product.familyId} ${product.productName}`)), false, "generic paint and lighting must remain excluded");

const customBrandCsv = [
  "2000,FUTUREBRAND,FUTUREBRAND,,,FUTUREBRAND 60CM ELECTRIC OVEN FB60EO,APPLIANCES | FUTUREBRAND 60CM ELECTRIC OVEN FB60EO | EACH | 1 | source,EACH,,1,1,,,FUTUREBRAND,,TRUE,appliance,TRUE,source",
].join("\n");
const customBrandResult = buildCanonicalApplianceCatalogue(customBrandCsv, { sourceFile: "inline.csv" });
assert.equal(customBrandResult.catalogue.products[0].brandName, "Futurebrand", "unknown future brands must remain data-driven");
assert.equal(customBrandResult.catalogue.products[0].productId, "product:appliances:ovens:futurebrand:fb60eo");
assert.equal(result.report.specificationsCompleted, 0, "no manufacturer-verified specification records are marked completed");
assert.equal(result.report.partialSpecificationRecords, 83, "all source-derived specification records remain partial");
assert.equal(result.report.identityVariationsResolved, 18, "identity variation groups remain traceable");
assert.ok(result.researchLogRows.length >= 83, "every product has research log coverage");
assert.ok(result.fieldSourceAuditRows.length > 83, "field-level source audit rows are generated");
assert.equal(result.imageLicensingRows.length, 83, "every product has an image licensing review row");

console.log("Canonical appliance catalogue checks passed.", result.report);
