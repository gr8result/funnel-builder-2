// Run: node --import ./scripts/register-json-loader.mjs scripts/test-appliance-brand-removal.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";
import {
  workbookQuoteImportRowsToLegacyRows,
  workbookQuoteImportSummary,
} from "../lib/product-library/applianceWorkbookQuoteImport.js";

const brandCatalogue = JSON.parse(readFileSync(new URL("../data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json", import.meta.url), "utf8"));
const registeredBrands = new Set(brandCatalogue.brands.map((brand) => brand.brandName.toUpperCase()));
const unsupportedBrand = "REMOVEDBRAND";
assert.equal(registeredBrands.has(unsupportedBrand), false);

const row = (category, item = "", unit = "", price = "") => [category, item, "", unit, price, 0, "workbook", ""];
const sourceRows = [
  row("OMEGA"),
  row("APPLIANCES", "OMEGA 60CM INDUCTION COOKTOP TEST60", "EACH", 100),
  row(unsupportedBrand),
  row("APPLIANCES", `${unsupportedBrand} 60CM INDUCTION COOKTOP REM60`, "EACH", 200),
  row("APPLIANCES", "60CM INDUCTION COOKTOP UNKNOWN60", "EACH", 250),
  row("OMEGA 600MM APPLIANCE PACK"),
  row("APPLIANCES", "OMEGA 60CM ELECTRIC OVEN TESTOVEN", "EACH", 300),
  row("APPLIANCES", "OMEGA 60CM GAS COOKTOP TESTGAS", "EACH", 400),
  row("APPLIANCE PACKS", "OMEGA PACK TESTPACK", "PACK", 700),
  row("BLANCO"),
  row("APPLIANCES", "BLANCO 60CM COOKTOP HISTORY60", "EACH", 500),
  row("BOSCH"),
  row("APPLIANCES", "BOSCH 60CM COOKTOP CURRENT60", "EACH", 600),
];

const imported = workbookQuoteImportRowsToLegacyRows(sourceRows);
assert.equal(imported.length, 6);
assert.ok(imported.every((item) => registeredBrands.has(item[1])));
assert.equal(imported.some((item) => /REM60|UNKNOWN60/.test(item[5])), false, "unsupported or unidentified items cannot inherit a preceding brand");
assert.deepEqual(imported.map((item) => item[0]), ["10", "17", "15", "16", "19", "21"], "source IDs and pack-before-components ordering are preserved");
assert.deepEqual(imported.map((item) => [item[1], item[7], item[9], item[10]]), [
  ["OMEGA", "EACH", "100", "100"],
  ["OMEGA", "PACK", "700", "700"],
  ["OMEGA", "EACH", "300", "300"],
  ["OMEGA", "EACH", "400", "400"],
  ["BLANCO", "EACH", "500", "500"],
  ["BOSCH", "EACH", "600", "600"],
], "registered historical brands and source prices remain intact; newly registered brands are recognized");

const summary = workbookQuoteImportSummary(sourceRows);
assert.equal(summary.sheetRows, sourceRows.length);
assert.equal(summary.transformedLegacyRows, imported.length);
assert.equal(summary.pricedRows, imported.length);
assert.equal(summary.unsupportedBrandRows, 3);
assert.equal(summary.headingRows + summary.pricedRows + summary.ignoredRows + summary.unsupportedBrandRows + summary.excludedRows.length, summary.sheetRows);
assert.equal(JSON.stringify(summary).includes(unsupportedBrand), false, "unsupported brand text must not return through published reconciliation metadata");

const catalogueDirectory = new URL("../data/product-library/catalogues/appliances/", import.meta.url);
for (const file of readdirSync(catalogueDirectory)) {
  const text = readFileSync(new URL(file, catalogueDirectory), "utf8");
  assert.doesNotMatch(text, /ariston/i, `${file}: removed brand references, including backups and audit metadata`);
  JSON.parse(text);
}
const catalogue = JSON.parse(readFileSync(new URL("AU-APPLIANCE-CATALOGUE.json", catalogueDirectory), "utf8"));
const packs = JSON.parse(readFileSync(new URL("AU-APPLIANCE-PACKS.json", catalogueDirectory), "utf8"));
const productIds = new Set(catalogue.products.map((product) => product.productId));
assert.equal(productIds.size, catalogue.products.length);
const packIds = new Set(packs.packs.map((pack) => pack.packId));
for (const pack of packs.packs) {
  assert.ok(pack.componentProductIds.every((id) => productIds.has(id)), `${pack.packId}: component references resolve`);
}
for (const relationship of packs.relationships) {
  assert.ok(productIds.has(relationship.componentProductId));
  assert.ok(packIds.has(relationship.packProductId));
}
assert.equal(existsSync(new URL("../public/images/catalogues/appliances/products/ariston/", import.meta.url)), false);
assert.equal(existsSync(new URL("../public/images/catalogues/appliances/brands/ariston-logo.svg", import.meta.url)), false);

const unsupportedLegacyRow = [...imported[0]];
for (const index of [1, 2, 13]) unsupportedLegacyRow[index] = unsupportedBrand;
unsupportedLegacyRow[5] = `${unsupportedBrand} 60CM INDUCTION COOKTOP REM60`;
unsupportedLegacyRow[6] = unsupportedLegacyRow[5];
const rebuilt = buildCanonicalApplianceCatalogue([imported[0], unsupportedLegacyRow].map((item) => item.join(",")).join("\n"));
assert.equal(rebuilt.catalogue.products.length, 1);
assert.equal(rebuilt.catalogue.products[0].brandName, "Omega");
assert.equal(JSON.stringify(rebuilt).includes(unsupportedBrand), false, "older CSV input cannot republish a removed brand");

console.log("Appliance brand cleanup, references, assets and importer checks passed.");
