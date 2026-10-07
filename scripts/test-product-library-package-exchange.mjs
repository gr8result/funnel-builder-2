import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  buildProductLibraryExportPackage,
  filterProductsForProductLibraryExchange,
  parseProductLibraryPackageFile,
  previewProductLibraryPackageImport,
} from "../lib/product-library/productLibraryExchange.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const products = [
  {
    productId: "builder-private-oven-obo660x",
    productCode: "OBO660X",
    familyKey: "ovens",
    categoryKey: "Appliances",
    topLevelArea: "kitchen",
    brand: "Omega",
    manufacturer: "Omega",
    supplier: "Omega",
    range: "Ovens",
    model: "OBO660X",
    productName: "Omega 60cm 4 Function Oven",
    description: "60cm built-in electric oven.",
    primaryImageUrl: tinyPng,
    thumbnailUrl: tinyPng,
    imageStatus: "verified_exact",
    brandLogoUrl: tinyPng,
    clientPrice: 601,
    normalizedUnitPrice: 601,
    priceStatus: "current",
    priceUnit: "EACH",
    active: true,
    isCustom: true,
    organisationId: "builder-a",
    attributes: { clientSelectable: true, quotationEnabled: true, applicableRooms: ["kitchen"] },
  },
  {
    productId: "builder-private-oven-missing",
    productCode: "NOIMAGE-1",
    familyKey: "ovens",
    categoryKey: "Appliances",
    topLevelArea: "kitchen",
    brand: "Test",
    manufacturer: "Test",
    supplier: "Test",
    model: "NOIMAGE-1",
    productName: "Missing Image Oven",
    imageStatus: "missing",
    priceStatus: "quote_required",
    priceUnit: "EACH",
    active: true,
    isCustom: true,
    organisationId: "builder-a",
  },
  {
    productId: "builder-private-basin-mixer-001",
    productCode: "TAP-001",
    familyKey: "tapware",
    categoryKey: "Bathroom",
    topLevelArea: "interior",
    brand: "Caroma",
    manufacturer: "Caroma",
    supplier: "Caroma",
    range: "Luna II",
    model: "68198BN6AF",
    productName: "Luna II Basin Mixer",
    primaryImageUrl: tinyPng,
    imageStatus: "verified_exact",
    clientPrice: 356,
    priceStatus: "current",
    priceUnit: "EACH",
    active: true,
    isCustom: true,
    organisationId: "builder-a",
    attributes: { clientSelectable: true, quotationEnabled: true, applicableRooms: ["bathroom", "ensuite", "powder-room"], fixtureType: "basin-mixer" },
  },
];

const applianceProducts = filterProductsForProductLibraryExchange(products, { sectionId: "appliances", scope: "all", builderId: "builder-a" });
const tapwareProducts = filterProductsForProductLibraryExchange(products, { sectionId: "plumbing-fixtures-fittings", categoryId: "tapware", scope: "all", builderId: "builder-a" });
assert.deepEqual(applianceProducts.map((product) => product.productCode), ["OBO660X", "NOIMAGE-1"]);
assert.deepEqual(tapwareProducts.map((product) => product.productCode), ["TAP-001"]);

const exported = await buildProductLibraryExportPackage({
  products: applianceProducts,
  scope: { scope: "section", sectionId: "appliances", brand: "Omega" },
  tenantId: "tenant-a",
  builderId: "builder-a",
  includeImages: true,
});

assert.equal(exported.contentType, "application/zip");
assert.ok(exported.fileName.endsWith(".zip"));
assert.equal(exported.manifest.totals.products, 2);
assert.equal(exported.manifest.totals.productImages, 1);
assert.equal(exported.manifest.totals.brandLogos, 1);
assert.equal(exported.manifest.missing_images.length, 1);

const zip = await JSZip.loadAsync(await exported.blob.arrayBuffer());
assert.ok(zip.file("catalogue.csv"), "catalogue.csv must be present");
assert.ok(zip.file("manifest.json"), "manifest.json must be present");
assert.ok(zip.file("images/obo660x.png"), "verified product image must be packaged by model");
assert.ok(zip.file("brand-logos/omega-logo.png"), "brand logo must be packaged separately");
assert.equal(await zip.file("images/obo660x.png").async("uint8array").then((bytes) => bytes.length > 0), true);

const csv = await zip.file("catalogue.csv").async("string");
assert.match(csv, /images\/obo660x\.png/);
assert.match(csv, /NOIMAGE-1/);

const importedFile = new File([exported.blob], exported.fileName, { type: "application/zip" });
const parsed = await parseProductLibraryPackageFile(importedFile);
const preview = previewProductLibraryPackageImport(parsed, [], { tenantId: "tenant-b", builderId: "builder-b" });
assert.equal(preview.totalProducts, 2);
assert.equal(preview.validProducts, 2);
assert.equal(preview.newProducts, 2);
assert.equal(preview.rows[0].product.organisationId, "builder-b");
assert.match(preview.rows[0].product.primaryImageUrl, /^data:image\/png;base64,/);

const platformBlocked = previewProductLibraryPackageImport(parsed, [{ productCode: "OBO660X", productId: "master-obo660x", familyKey: "ovens" }], { tenantId: "tenant-b", builderId: "builder-b" });
assert.equal(platformBlocked.rows[0].valid, true);
assert.equal(platformBlocked.rows[0].action, "update-master-reference");
assert.equal(platformBlocked.masterOverrideProducts, 1);

const addAsNew = previewProductLibraryPackageImport(parsed, [{ productCode: "OBO660X", productId: "master-obo660x", familyKey: "ovens" }], { tenantId: "tenant-b", builderId: "builder-b", importMode: "add" });
assert.equal(addAsNew.rows[0].valid, true);
assert.equal(addAsNew.rows[0].action, "create-builder-private");
assert.match(addAsNew.rows[0].product.productId, /^builder-builder-b-omega-obo660x$/);
assert.match(addAsNew.rows[0].product.productCode, /^builder-builder-b-omega-obo660x$/);

const tapwareExported = await buildProductLibraryExportPackage({
  products: tapwareProducts,
  scope: { scope: "category", sectionId: "plumbing-fixtures-fittings", categoryId: "tapware", brand: "Caroma" },
  tenantId: "tenant-a",
  builderId: "builder-a",
  includeImages: true,
});
const tapwareZip = await JSZip.loadAsync(await tapwareExported.blob.arrayBuffer());
assert.ok(tapwareZip.file("catalogue.csv"), "Tapware ZIP must include catalogue.csv");
assert.ok(tapwareZip.file("images/68198bn6af.png"), "Tapware ZIP must package the model image");
assert.equal(tapwareExported.manifest.totals.products, 1);

console.log("Product Library package exchange test passed.");
