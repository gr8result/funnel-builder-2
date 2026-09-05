// Verifies Quotation Builder appliance defaults consume Product Library data.
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-quotation-builder-product-library-appliances.mjs
import { readFileSync } from "node:fs";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { getEffectiveApplianceCatalogue, setCatalogueStorage, resetLegacyMigrationFlag } from "../lib/product-library/catalogueService.js";

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  ok ? pass++ : fail++;
}

function freshStorage() {
  const map = new Map();
  setCatalogueStorage({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  resetLegacyMigrationFlag();
}

freshStorage();

const source = readFileSync(new URL("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js", import.meta.url), "utf8");
const workbookSource = readFileSync(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
check("defaults import effective Product Library selector", source.includes("getEffectiveApplianceCatalogue"), true);
check("defaults no longer import generated appliancePackageRows JSON", source.includes("appliancePackageRows.json"), false);

const catalogue = getEffectiveApplianceCatalogue({ organisationId: "" });
const workbook = createEstimateBuilderWorkbookDefaults();
const applianceSections = Object.entries(workbook.quotation).filter(([sectionName]) =>
  sectionName.toUpperCase().startsWith("APPLIANCES & WHITE GOODS"),
);
const generatedBrandSections = applianceSections.filter(([sectionName]) => sectionName.includes(" - "));
const rows = applianceSections.flatMap(([, section]) => section.rows || []);
const packageRows = rows.filter((row) => row.applianceHeading);
const componentRows = rows.filter((row) => !row.applianceHeading);

check("quotation appliance product-library brands", generatedBrandSections.map(([sectionName]) => sectionName.replace("APPLIANCES & WHITE GOODS - ", "")).sort(), catalogue.brands);
check("quotation package heading rows", packageRows.length, catalogue.counts.packs);
check("quotation package component rows", componentRows.length, catalogue.counts.relationships);
check("component rows use Product Library source", componentRows.every((row) => row.sourceOfRate === "Product Library"), true);
check("component rows carry stable Product Library IDs", componentRows.every((row) => row.canonicalProductId && row.productCode), true);
check("component rows carry Product Library metadata", componentRows.every((row) => row.productName && row.brand && row.sku && row.productLibrarySnapshot?.productId), true);
check("component rows preserve available Product Library images", componentRows.filter((row) => row.productImageUrl || row.productLibrarySnapshot?.imageReference).length > 50, true);
check("component rows carry unit and rate metadata", componentRows.every((row) => row.unit === "EACH" && row.excelRate !== ""), true);
check("package rows are headings, not priced catalogue records", packageRows.every((row) => row.excelRate === "" && row.importedCost === ""), true);
check("Quote Sheet no longer renders the Product Preview URL card", workbookSource.includes("Product Preview") || workbookSource.includes("Paste product image URL"), false);
check("Quote Sheet exports product image metadata", workbookSource.includes('"product_image"') && workbookSource.includes('"brand_manufacturer"') && workbookSource.includes('"sku_model"'), true);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
