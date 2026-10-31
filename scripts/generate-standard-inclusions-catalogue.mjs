import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { toBrowserCatalogueProduct } from "../lib/product-library/browserCatalogueContract.mjs";

const outputPath = resolve("data/standard-inclusions/canonical-product-catalogue.json");
const products = getEffectiveProductCatalogue({ organisationId: "standard-inclusions-canonical" })
  .canonicalProducts
  .map(toBrowserCatalogueProduct);
const output = `${JSON.stringify({ products })}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== output) throw new Error("The Standard Inclusions catalogue snapshot is stale. Regenerate it before release.");
  console.log(`Standard Inclusions catalogue snapshot is current (${products.length} products).`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`Wrote ${products.length} products to ${outputPath}.`);
}
