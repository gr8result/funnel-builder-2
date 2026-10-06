import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createApplianceCatalogueSelectors } from "../lib/product-library/applianceCatalogueSelectorsCore.js";

const root = "data/product-library/catalogues/appliances";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const catalogue = read(`${root}/AU-APPLIANCE-CATALOGUE.json`);
const packs = read(`${root}/AU-APPLIANCE-PACKS.json`);
const brands = read(`${root}/AU-APPLIANCE-BRANDS.json`);
const selectors = createApplianceCatalogueSelectors({ productCatalogue: catalogue, packCatalogue: packs, brandCatalogue: brands });
const products = new Map(catalogue.products.map((product) => [product.productId, product]));
assert.equal(products.size, catalogue.products.length, "Unique stable IDs");
assert.equal(new Set(catalogue.products.map((product) => `${product.brandName}:${product.manufacturerModel.toUpperCase()}`)).size, products.size, "Unique exact brand/models");
assert.deepEqual(selectors.getApplianceBrands().map((brand) => brand.brandName), ["Bosch", "Euromaid", "Omega", "Smeg", "Westinghouse", "Whirlpool"]);
const summary = {};
for (const brand of ["Whirlpool", "Euromaid"]) {
  const stage = read(`${root}/AU-${brand.toUpperCase()}-HNC-RANGE.json`);
  const active = selectors.getActiveProductLibraryApplianceRecords().filter((record) => record.brand === brand);
  assert.deepEqual(active.map((record) => record.model).sort(), stage.products.map((record) => record.manufacturerModel).sort(), `${brand}: all source results and no stale selection rows`);
  for (const source of stage.products) {
    const product = active.find((record) => record.model === source.manufacturerModel);
    assert.equal(product.sku, source.sku);
    assert.equal(product.name, source.productName);
    assert.equal(product.description, source.fullDescription);
    assert.equal(product.productPageUrl, source.productPageUrl);
    assert.equal(product.sourceCheckedAt, source.sourceCheckedAt);
    assert.equal(product.hncPrice, source.hncPrice);
    assert.equal(product.image, source.primaryImage);
    assert.equal(product.imageSourceUrl, source.imageSourceUrl);
    assert.equal(product.manufacturerUrl, source.manufacturerUrl);
    for (const field of ["widthMm", "heightMm", "depthMm", "capacity", "finish"]) assert.equal(products.get(product.productId)[field], source[field], `${product.model} ${field} including unknown values`);
    for (const [key, value] of Object.entries(source.specifications)) assert.deepEqual(product.specifications[key], value, `${product.model} ${key} source specification`);
    if (brand === "Euromaid" && source.specifications.manufacturer?.["Fuel Type"]) assert.equal(product.fuelOrEnergyType, source.specifications.manufacturer["Fuel Type"], `${product.model}: published manufacturer fuel type`);
    const imageFile = path.join("public", product.image.replace(/^\//, ""));
    const bytes = fs.readFileSync(imageFile);
    assert(bytes.length > 1692, `${product.model}: not supplier placeholder`);
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash, source.imageSha256 || source.imageMetadata?.sha256, `${product.model}: exact verified image bytes`);
    const image = await sharp(bytes).metadata();
    assert(image.width > 100 && image.height > 100, `${product.model}: decodable photograph`);
    assert.doesNotMatch(product.imageSourceUrl, /placeholder|_tech|drawing/i);
    if (source.hncPrice == null) assert.equal(product.price, null, `${product.model}: missing price not invented`);
    else assert(source.hncPrice > 0 && product.priceSourceUrl === source.productPageUrl);
    if (source.sourceDiscrepancies?.length) assert.equal(product.selectableStatus, "not-client-selectable", `${product.model}: source discrepancy held for review`);
  }
  summary[brand] = { activeProducts: active.length, selectable: active.filter((record) => record.selectableStatus === "client-selectable").length, images: active.filter((record) => record.image).length, verifiedHncPrices: active.filter((record) => record.hncPrice > 0).length, packages: selectors.getApplianceRecordsByFamily("appliance-packs").filter((record) => record.brand === brand).length };
}
for (const pack of packs.packs) for (const id of pack.componentProductIds || []) assert(products.has(id), `Historical package component ${id} resolves`);
const baselineDir = "artifacts/recovery/hnc-appliances-20260916";
if (fs.existsSync(`${baselineDir}/AU-APPLIANCE-CATALOGUE.json`)) {
  const baseline = read(`${baselineDir}/AU-APPLIANCE-CATALOGUE.json`);
  for (const previous of baseline.products) {
    const current = products.get(previous.productId);
    assert(current, `${previous.productId}: historical ID retained`);
    if (!["Euromaid", "Whirlpool"].includes(previous.brandName)) assert.deepEqual(current, previous, `${previous.productId}: unrelated catalogue row unchanged`);
    for (const price of ["costPrice", "sourceCostPrice", "sellPrice", "importedSourceCost", "tenantSellPrice"]) if (Object.hasOwn(previous, price)) assert.equal(current[price], previous[price], `${previous.productId}: original ${price} retained`);
  }
  assert.equal(fs.readFileSync(`${root}/AU-APPLIANCE-PACKS.json`, "utf8"), fs.readFileSync(`${baselineDir}/AU-APPLIANCE-PACKS.json`, "utf8"), "Package file unchanged");
}
assert.equal(selectors.getActiveProductLibraryApplianceRecords().filter((record) => record.brand === "Blanco").length, 0);
console.log(JSON.stringify({ result: "PASS", brands: summary, totalHistoricalAndCurrent: products.size }, null, 2));
