import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  commitMasterProductImport,
  createBuilderProductReference,
  masterProductToClientSelectionProduct,
  parseMasterProductCatalogueCsv,
  parseMasterProductCatalogueJson,
  previewMasterProductImport,
  queryClientSelectableProducts,
} from "../lib/product-library/catalogueModel.js";
import { EXTERIOR_REQUIREMENTS, productsForRequirement } from "../lib/builders/clientSelectionWorkflow.js";

const repoRoot = process.cwd();
const csvPath = path.join(repoRoot, "data", "product-library", "catalogues", "bricks", "QLD-BRICKS-MASTER-CATALOGUE.csv");
const jsonPath = path.join(repoRoot, "data", "product-library", "catalogues", "bricks", "QLD-BRICKS-MASTER-CATALOGUE.json");
const auditPath = path.join(repoRoot, "docs", "catalogues", "QLD_BRICKS_CATALOGUE_SOURCE_AUDIT.md");

const csvRecords = parseMasterProductCatalogueCsv(fs.readFileSync(csvPath, "utf8"));
const jsonRecords = parseMasterProductCatalogueJson(fs.readFileSync(jsonPath, "utf8"));
const preview = previewMasterProductImport(csvRecords, []);
const commit = commitMasterProductImport(preview, []);
const products = commit.products;

assert.equal(preview.totalProducts, 14, "QLD bricks CSV must preview the first 14 genuine catalogue products");
assert.equal(preview.newProducts, 14, "first import should create all QLD brick records");
assert.equal(preview.changedProducts, 0, "first import should not update records");
assert.equal(preview.unchangedProducts, 0, "first import should not skip records");
assert.equal(preview.invalidProducts, 0, "QLD bricks import must validate without errors");
assert.equal(preview.missingImage, 0, "all imported brick rows must have product-specific manufacturer images");
assert.equal(preview.missingOfficialUrl, 0, "all brick rows must preserve official manufacturer URLs");
assert.equal(preview.missingPrice, 14, "unknown prices must be quote-required instead of zero");
assert.equal(commit.created.length, 14, "commit must create every previewed brick");
assert.equal(commit.updated.length, 0, "first import must not update products");
assert.equal(commit.skipped.length, 0, "first import must not skip products");
assert.equal(commit.invalid.length, 0, "commit must not include invalid products");

assert.deepEqual(
  jsonRecords.map((product) => product.productCode).sort(),
  products.map((product) => product.productCode).sort(),
  "JSON companion must normalize to the same product codes as the CSV import",
);

const byManufacturer = Map.groupBy(products, (product) => product.manufacturer);
assert.equal(byManufacturer.get("PGH Bricks")?.length, 7, "PGH supplier identification must come from imported records");
assert.equal(byManufacturer.get("Austral Bricks")?.length, 7, "Austral supplier identification must come from imported records");

const rangeCounts = Object.fromEntries(Array.from(Map.groupBy(products, (product) => `${product.manufacturer}:${product.range}`), ([range, rows]) => [range, rows.length]));
assert.equal(rangeCounts["PGH Bricks:Horizon"], 3, "PGH Horizon range grouping must be preserved");
assert.equal(rangeCounts["PGH Bricks:Smooth"], 4, "PGH Smooth range grouping must be preserved");
assert.equal(rangeCounts["Austral Bricks:La Paloma"], 4, "Austral La Paloma range grouping must be preserved");
assert.equal(rangeCounts["Austral Bricks:San Selmo Classico"], 3, "Austral San Selmo Classico range grouping must be preserved");

products.forEach((product) => {
  assert.equal(product.familyKey, "bricks", `${product.productCode} must stay bricks-only`);
  assert.equal(product.topLevelArea, "exterior", `${product.productCode} must stay under Exterior`);
  assert.ok(product.regions.includes("QLD"), `${product.productCode} must be QLD selectable`);
  assert.equal(product.regionReviewRequired, false, `${product.productCode} must not guess uncertain regional availability`);
  assert.equal(product.imageStatus, "verified_exact", `${product.productCode} must have exact/product-specific image status`);
  assert.ok(product.primaryImageUrl.startsWith("https://"), `${product.productCode} must keep a manufacturer image URL`);
  assert.equal(product.priceStatus, "quote_required", `${product.productCode} must not invent price data`);
  assert.notEqual(product.rrp, 0, `${product.productCode} must not show unknown price as $0`);
  assert.notEqual(product.clientPrice, 0, `${product.productCode} must not show unknown client price as $0`);
  assert.ok(product.officialProductUrl.startsWith("https://"), `${product.productCode} must preserve official URL`);
  assert.ok(product.priceSourceUrl.startsWith("https://"), `${product.productCode} must preserve pricing/provenance URL`);
});

const demoSubsetCodes = [
  "BRICK-PGH-HORIZON-AIRLIE",
  "BRICK-PGH-HORIZON-EMERALD",
  "BRICK-PGH-SMOOTH-BLACK-AND-TAN",
  "BRICK-PGH-SMOOTH-PEARL-GREY",
  "BRICK-AUSTRAL-LA-PALOMA-AZUL",
  "BRICK-AUSTRAL-LA-PALOMA-MIRO",
  "BRICK-AUSTRAL-SAN-SELMO-CLASSICO-AGED-RED",
  "BRICK-AUSTRAL-SAN-SELMO-CLASSICO-ORIGINAL",
];
const demoSubset = products.filter((product) => demoSubsetCodes.includes(product.productCode));
const enablements = demoSubset.map((product, index) => createBuilderProductReference(product, {
  organisationId: "demo-test-organisation",
  enabled: true,
  active: true,
  tier: index % 2 === 0 ? "Premier" : "Premium",
  selectionMode: "available_upgrade",
}));

const qldSelectable = queryClientSelectableProducts({
  organisationId: "demo-test-organisation",
  projectId: "qld-demo-project",
  familyKey: "bricks",
  region: "QLD",
  masterProducts: products,
  builderProducts: enablements,
});
assert.equal(qldSelectable.length, demoSubset.length, "QLD client selections must show only builder-enabled subset");

const suppliers = Array.from(new Set(qldSelectable.map((product) => product.supplier || product.manufacturer))).sort();
assert.deepEqual(suppliers, ["Austral Bricks", "PGH Bricks"], "supplier cards must be generated from enabled real products");

const pghRanges = Array.from(new Set(qldSelectable.filter((product) => product.manufacturer === "PGH Bricks").map((product) => product.range))).sort();
const australRanges = Array.from(new Set(qldSelectable.filter((product) => product.manufacturer === "Austral Bricks").map((product) => product.range))).sort();
assert.deepEqual(pghRanges, ["Horizon", "Smooth"], "PGH flow must expose actual imported ranges");
assert.deepEqual(australRanges, ["La Paloma", "San Selmo Classico"], "Austral flow must expose actual imported ranges");

const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "bricks");
const clientProducts = qldSelectable.map((product) => masterProductToClientSelectionProduct(product, { organisationId: "demo-test-organisation", requirement }));
const requirementProducts = productsForRequirement(clientProducts, requirement);
assert.equal(requirementProducts.length, demoSubset.length, "Client Selections product query must consume imported master products");
assert.ok(requirementProducts.every((product) => product.quote_structure_row_id === "approved-family:bricks"), "allowance requirement must remain separate from actual product identity");
assert.ok(requirementProducts.every((product) => product.metadata.productEntity.productCode === product.productCode), "actual product identity must remain attached to the selection entity");

const selectedProduct = qldSelectable.find((product) => product.productCode === "BRICK-PGH-HORIZON-AIRLIE");
const selectedReference = enablements.find((item) => item.masterProductCode === selectedProduct.productCode);
assert.equal(selectedProduct.range, "Horizon", "manufacturer range must remain real catalogue range");
assert.equal(selectedReference.tier, "Premier", "builder tier must be separate from manufacturer range");

const selectionSnapshot = {
  projectId: "qld-demo-project",
  organisationId: "demo-test-organisation",
  requirementKey: "bricks",
  familyKey: "bricks",
  linkedQuoteItemCode: "approved-family:bricks",
  productCode: selectedProduct.productCode,
  manufacturer: selectedProduct.manufacturer,
  range: selectedProduct.range,
  productName: selectedProduct.productName,
  colour: selectedProduct.colour,
  selectedPrice: selectedProduct.clientPrice ?? selectedProduct.rrp,
  imageReference: selectedProduct.primaryImageUrl,
  officialProductUrl: selectedProduct.officialProductUrl,
};
assert.equal(selectionSnapshot.selectedPrice, null, "selection persistence must keep unknown price as null");
assert.equal(selectionSnapshot.officialProductUrl, selectedProduct.officialProductUrl, "official URL must survive selection persistence");
assert.ok(fs.readFileSync(auditPath, "utf8").includes("Research date: 2026-08-13"), "source audit must record research date");

console.log("Queensland bricks master catalogue tests passed.");
