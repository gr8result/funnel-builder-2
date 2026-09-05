import assert from "node:assert/strict";
import fs from "node:fs";
import xlsx from "xlsx";
import { createApplianceCatalogueSelectors } from "../lib/product-library/applianceCatalogueSelectorsCore.js";
import {
  workbookQuoteImportRowsToLegacyCsv,
  workbookQuoteImportSummary,
} from "../lib/product-library/applianceWorkbookQuoteImport.js";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";

const workbookPath = process.argv[2] || "C:\\Users\\grant\\Downloads\\Appliances.xlsx";
const selectionsBookBefore = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
const productCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const packCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json", "utf8"));
const brandCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json", "utf8"));

const workbook = xlsx.readFile(workbookPath);
const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Quote Import"], { header: 1, blankrows: false, defval: "" });
const headerIndex = rows.findIndex((row) => String(row[0] || "").trim().toUpperCase() === "APPLIANCES" && String(row[1] || "").trim().toUpperCase() === "ITEM");
assert.ok(headerIndex >= 0, "workbook Quote Import appliance header must be discoverable");

const quoteRows = rows.slice(headerIndex + 1);
const summary = workbookQuoteImportSummary(quoteRows);
const rebuilt = buildCanonicalApplianceCatalogue(workbookQuoteImportRowsToLegacyCsv(quoteRows), { sourceFile: workbookPath });

assert.equal(summary.sheetRows, 251, "workbook row count after header must remain stable");
assert.equal(summary.transformedLegacyRows, 194, "accepted Checkpoint A workbook rows must remain 194");
assert.equal(summary.excludedRows.length, 4, "workbook-only review exclusions must stay explicit");
assert.equal(rebuilt.catalogue.products.length, 83, "workbook rebuild must produce 83 canonical products");
assert.equal(rebuilt.packCatalogue.packs.length, 35, "workbook rebuild must produce 35 canonical packages");
assert.equal(rebuilt.packCatalogue.relationships.length, 159, "workbook rebuild must produce 159 package relationships");

assert.equal(productCatalogue.sourceFile, workbookPath, "committed Product Library product catalogue must point to the workbook source");
assert.equal(productCatalogue.sourceSheet, "Quote Import", "committed Product Library product catalogue must name the source sheet");
assert.equal(productCatalogue.products.length, 83, "Product Library product JSON must contain 83 products");
assert.equal(packCatalogue.packs.length, 35, "Product Library pack JSON must contain 35 packages");
assert.equal(packCatalogue.relationships.length, 159, "Product Library pack JSON must contain 159 relationships");

const selectors = createApplianceCatalogueSelectors({ productCatalogue, packCatalogue, brandCatalogue });
const products = selectors.getPlatformMasterApplianceRecords();
const packs = selectors.getAppliancePacks();
const brandNames = brandCatalogue.brands.map((brand) => brand.brandName).sort();
assert.deepEqual(brandNames, ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"], "all six required brands must be owned by Product Library metadata");
assert.ok(brandCatalogue.brands.every((brand) => brand.logoUrl && brand.logoStatus === "official-source-referenced"), "every brand must have an official-source logo reference");
assert.ok(products.every((product) => product.stableProductId && product.categoryId && product.familyId), "every product exposes stable Product Library identifiers");
assert.ok(products.every((product) => product.supplier && product.brand && product.name && product.description), "every product exposes supplier, brand, model/name and description");
assert.ok(products.every((product) => product.unit === "EACH" && product.price != null), "every physical product keeps unit and workbook price");
assert.ok(products.every((product) => product.applicableRooms.includes("kitchen")), "every appliance product is applicable to kitchen selections");
assert.equal(products.some((product) => /paint|lighting/i.test(`${product.familyId} ${product.name}`)), false, "generic kitchen paint or lighting records must not be present");
assert.equal(products.some((product) => ["microwaves", "refrigerators", "fridges"].includes(product.familyId)), false, "microwave/fridge rows must not be invented without valid workbook products");
assert.ok(packs.every((pack) => pack.componentProductIds.every((productId) => products.some((product) => product.productId === productId))), "every package component ID resolves to a canonical product");

const omegaGasReview = summary.excludedRows.find((row) => /OCG95FFX/.test(row.item));
assert.ok(omegaGasReview, "workbook-only Omega OCG95FFX row remains in explicit review instead of being silently created");
assert.equal(selectors.getClientSelectableApplianceRecords().length, 83, "shared Product Library appliance selector exposes all active master appliances to consumers");

assert.equal(fs.readFileSync("pages/modules/builders/selections-book.js", "utf8"), selectionsBookBefore, "Checkpoint A test must not mutate selections-book.js");

console.log("Appliance Checkpoint A Product Library tests passed.");
