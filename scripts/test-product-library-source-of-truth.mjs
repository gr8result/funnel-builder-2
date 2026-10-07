import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "data", "product-library", "PRODUCTS-LIBRARY.csv");
const docsPath = path.join(repoRoot, "docs", "PRODUCT_LIBRARY_SOURCE_OF_TRUTH.md");

assert.ok(fs.existsSync(sourcePath), "Approved Product Library source file is missing.");
assert.ok(fs.statSync(sourcePath).size > 0, "Approved Product Library source file is empty.");

const csv = fs.readFileSync(sourcePath, "utf8");
const rowCount = csv.split(/\r?\n/).filter((line) => line.length > 0).length;
assert.ok(rowCount > 1, "Approved Product Library source file must contain data rows.");

const docs = fs.readFileSync(docsPath, "utf8");
assert.match(docs, /data\/product-library\/PRODUCTS-LIBRARY\.csv/, "Source-of-truth documentation must name the canonical CSV path.");
assert.match(docs, /Quotation Builder remains unchanged/, "Source-of-truth documentation must preserve Quotation Builder boundaries.");
assert.match(docs, /Supplier-specific data is organisation-specific/, "Source-of-truth documentation must preserve organisation-specific supplier data.");

console.log(`Product Library source-of-truth file present: ${rowCount} row(s).`);
