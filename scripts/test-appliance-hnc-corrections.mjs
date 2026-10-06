// Run: node --import ./scripts/register-json-loader.mjs scripts/test-appliance-hnc-corrections.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  getActiveProductLibraryApplianceRecords,
  getApplianceProductById,
} from "../lib/product-library/applianceCatalogueSelectors.js";
import { applianceFeatureList, appliancePriceLabel } from "../lib/product-library/applianceCataloguePresentation.js";
import { getEffectiveApplianceCatalogue, getEffectiveProductCatalogue, getMasterProducts, setCatalogueStorage } from "../lib/product-library/catalogueService.js";
import { productPriceLabel, productVerifiedImage } from "../lib/product-library/productPresentation.js";
import { getProductLibraryRoomCategory, productBelongsToRoom, productBelongsToRoomCategory } from "../lib/product-library/productLibraryTaxonomy.js";

const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const products = catalogue.products;
const modelKey = (record) => `${record.brandName.toLowerCase()}::${record.manufacturerModel.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
assert.equal(products.length, 125);
assert.equal(new Set(products.map((record) => record.productId)).size, products.length, "unique historical and current product IDs");
assert.equal(new Set(products.map(modelKey)).size, products.length, "unique brand/model identities");

const retired = products.filter((record) => record.brandName === "Blanco");
assert.equal(retired.length, 14, "historical Blanco records are retained");
for (const record of retired) {
  assert.equal(record.active, false);
  assert.equal(record.selectable, false);
  assert.equal(getApplianceProductById(record.productId)?.manufacturerModel, record.manufacturerModel, "historical IDs still resolve");
}

setCatalogueStorage({ getItem: () => null, setItem() {}, removeItem() {} });
const effective = getEffectiveApplianceCatalogue({ organisationId: "hnc-corrections-test" });
const library = getActiveProductLibraryApplianceRecords();
const expectedBrands = ["Bosch", "Euromaid", "Omega", "Smeg", "Westinghouse"];
assert.deepEqual(effective.brands, expectedBrands);
for (const records of [library, effective.records]) {
  assert.equal(records.length, 111);
  assert.equal(records.filter((record) => record.brand === "Blanco").length, 0);
  assert.equal(records.filter((record) => record.brand === "Bosch").length, 38);
  assert.equal(records.some((record) => record.model === "PCR6A5B90A"), false);
  for (const model of ["EC64GB", "EC64GS", "EC95GLB", "EC95GLS"]) assert.ok(records.some((record) => record.model === model));
}

const euromaidEvidence = JSON.parse(fs.readFileSync("data/product-library/source-evidence/euromaid/hnc-cooktop-range-2026-09-11.json", "utf8"));
for (const evidence of euromaidEvidence.evidence) {
  const record = products.find((item) => item.manufacturerModel === evidence.model);
  assert.equal(record.productName, evidence.rawHncProduct.name.trim(), "exact HNC title, without silently correcting source discrepancies");
  assert.equal(record.manufacturerModel, evidence.rawHncProduct.sku);
  assert.equal(record.tenantSellPrice, evidence.displayedPrice.value, "use public listed SRP, not zero trade-price fields");
  assert.equal(record.finish, evidence.displayedColour);
  assert.equal(record.productPageUrl, evidence.sourceUrl);
  assert.equal(record.imageSourceUrl, evidence.image.sourceUrl);
}
const blackGlass = products.find((record) => record.manufacturerModel === "EC95GLB");
assert.equal(blackGlass.widthMm, 880);
assert.equal(blackGlass.productName, "Eclipse 600mm Gas Cooktop");
assert.equal(blackGlass.manualReviewRequired, true, "source title/dimension discrepancy stays flagged");
assert.equal(products.find((record) => record.manufacturerModel === "EC95GLS").widthMm, 860);

const boschCooktops = library.filter((record) => record.brand === "Bosch" && record.familyId === "cooktops");
assert.equal(boschCooktops.length, 14);
const boschEvidence = JSON.parse(fs.readFileSync("data/product-library/source-evidence/bosch/hnc-cooktop-corrections-2026-09-11.json", "utf8"));
const canonicalImageUrl = (url) => url.replace(/\/cache\/[a-f0-9]+\//, "/");
const verifiedCooktops = [...boschCooktops, ...library.filter((record) => ["EC64GB", "EC64GS", "EC95GLB", "EC95GLS"].includes(record.model))];
for (const record of verifiedCooktops) {
  assert.equal(record.imageStatus, "verified-authorised-supplier-local", `${record.model}: verified local HNC image`);
  assert.match(record.imageVerificationStatus, /^verified-(?:authorised-)?exact-model$/);
  const evidence = record.brand === "Bosch"
    ? boschEvidence.corrections.find((item) => item.model === record.model).evidence
    : euromaidEvidence.evidence.find((item) => item.model === record.model);
  const sourceModel = evidence.exactModelEvidence?.sku || evidence.rawHncProduct.sku;
  const gallery = evidence.image.supplierGallery || evidence.rawHncProduct.media_gallery.map((item) => item.url);
  assert.equal(sourceModel, record.model);
  assert.ok(gallery.map(canonicalImageUrl).includes(canonicalImageUrl(record.imageSourceUrl)), `${record.model}: image belongs to exact-SKU HNC gallery`);
  assert.equal(record.price, evidence.price?.listedPrice ?? evidence.displayedPrice.value);
  assert.match(record.imageSourceUrl, /^https:\/\/backend\.harveynormancommercial\.com\.au\//);
  assert.doesNotMatch(record.imageSourceUrl, /(?:_tech|_drawing|placeholder)/i);
  const localPath = path.join("public", record.image.replace(/^\//, ""));
  const imageBytes = fs.readFileSync(localPath);
  assert.equal(createHash("sha256").update(imageBytes).digest("hex"), evidence.image.sha256, `${record.model}: local image matches verified HNC bytes`);
  const metadata = await sharp(imageBytes).metadata();
  assert.ok(metadata.width > 100 && metadata.height > 100, `${record.model}: image decodes with usable dimensions`);
  assert.equal(record.priceStatus, "fixed");
  assert.ok(record.price > 0);
  assert.doesNotMatch(appliancePriceLabel(record), /pending/i, `${record.model}: displayed price is available`);
  assert.equal(record.currentRetailReference, record.price);
  assert.ok(record.currentRetailReferenceSourceUrl.endsWith(`/products/${record.model}`));
  assert.equal(record.sourceCheckedAt, "2026-09-11");
}

// The reported URL uses the room catalogue, which also includes migrated records.
// Checking only getEffectiveApplianceCatalogue would miss historical-model leaks here.
const roomCooktops = getEffectiveProductCatalogue().products
  .filter((record) => productBelongsToRoom(record, "butlers-pantry"))
  .filter((record) => productBelongsToRoomCategory(record, getProductLibraryRoomCategory("kitchen-cooktops")));
assert.equal(roomCooktops.filter((record) => record.brand === "Bosch").length, 14);
assert.equal(roomCooktops.filter((record) => record.brand === "Euromaid").length, 8);
assert.equal(roomCooktops.filter((record) => record.brand === "Blanco").length, 0);
assert.equal(roomCooktops.some((record) => record.model === "PCR6A5B90A"), false);
assert.equal(getMasterProducts().find((record) => record.model === "PCR6A5B90A").active, false, "historical migrated record remains addressable");
const pbh = roomCooktops.find((record) => record.model === "PBH6B5K90A");
assert.equal(pbh.productName, "Bosch Series 2 600mm Gas Cooktop");
assert.equal(pbh.dimensions, "W580 x D510 x H51.8mm");
assert.equal(pbh.clientPrice, 798);
const expectedPbhFeatures = ["4 cooking zones", "Cast iron pan supports with rubber feet", "Sword knobs", "Dishwasher-suitable pan supports", "Safety gas cut-off"];
assert.ok(expectedPbhFeatures.every((feature) => applianceFeatureList(pbh).includes(feature)), "all HNC features survive the room-card adapter");
for (const model of ["PBH6B5K90A", "EC64GB", "EC64GS", "EC95GLB", "EC95GLS"]) {
  const roomRecord = roomCooktops.find((record) => record.model === model);
  assert.ok(productVerifiedImage(roomRecord), `${model}: room card resolves exact image`);
  assert.doesNotMatch(productPriceLabel(roomRecord), /pending/i);
  assert.equal(roomRecord.officialProductUrl, `https://www.harveynormancommercial.com.au/products/${model}`);
  assert.ok(roomRecord.dimensions && roomRecord.finish && roomRecord.configuration);
  assert.ok(roomRecord.attributes.specificationSummary.features.length >= 5);
}

console.log(JSON.stringify({
  result: "PASS",
  historicalProducts: products.length,
  visibleProducts: effective.records.length,
  brands: effective.brands,
  blancoVisible: effective.records.filter((record) => record.brand === "Blanco").length,
  boschVisible: effective.records.filter((record) => record.brand === "Bosch").length,
  pcr6a5b90aVisible: effective.records.some((record) => record.model === "PCR6A5B90A"),
  boschCooktopImagesAndPrices: boschCooktops.map((record) => ({ model: record.model, image: record.image, price: record.price, priceStatus: record.priceStatus })),
  euromaidVisibleCooktopModels: effective.records.filter((record) => record.brand === "Euromaid" && record.familyId === "cooktops").map((record) => record.model).sort(),
  duplicateProductIds: products.length - new Set(products.map((record) => record.productId)).size,
  duplicateBrandModels: products.length - new Set(products.map(modelKey)).size,
}, null, 2));
