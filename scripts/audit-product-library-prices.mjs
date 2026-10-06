// Read-only price audit of every active, selectable Product Library product, using the same master
// catalogue (getMasterProducts) and visibility rule (isProductVisible) the running app uses.
// A price is valid only when its status is "current", its amount is a positive number and it has a
// pricing unit. $0 is never counted as a valid price. Nothing is written to any catalogue.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/audit-product-library-prices.mjs
import fs from "node:fs";
import { getMasterProducts, isProductVisible } from "../lib/product-library/catalogueService.js";
import { resolveProductPrice } from "../lib/product-library/catalogueModel.js";

const REPORT = "artifacts/product-library-price-audit.json";

function priceOf(product) {
  const raw = product.clientPrice ?? product.rrp ?? product.normalizedUnitPrice ?? null;
  return raw === null || raw === undefined || raw === "" ? null : raw;
}

export function classifyProductPrice(product) {
  const status = product.priceStatus || "price_pending";
  const raw = priceOf(product);
  const amount = raw === null ? null : Number(raw);
  const unit = String(product.priceUnit || "").trim();
  const issues = [];
  if (raw !== null && !Number.isFinite(amount)) issues.push("invalid");
  else if (amount !== null && amount < 0) issues.push("invalid");
  else if (amount === 0) issues.push("zero");
  const resolved = resolveProductPrice(product);
  if (resolved.price === null) issues.push("missing");
  if (!unit) issues.push("missing_unit");
  if (resolved.price !== null && !product.priceSourceUrl && !product.priceVerifiedAt && !product.priceSourceNote) issues.push("unknown_source");
  // Priced = the price every module actually resolves (builder ?? master), not the raw status flag.
  const valid = resolved.price !== null && Boolean(unit);
  return { status, amount, unit, valid, issues, source: resolved.source };
}

const products = getMasterProducts().filter(isProductVisible);
const rows = products.map((product) => ({ product, price: classifyProductPrice(product) }));
const count = (issue) => rows.filter((row) => row.price.issues.includes(issue)).length;
const tally = (list, key) => Object.entries(list.reduce((acc, row) => {
  const value = key(row.product) || "(not set)";
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {})).sort((a, b) => b[1] - a[1]);
const missing = rows.filter((row) => !row.price.valid);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    selectableProducts: rows.length,
    withValidPrice: rows.filter((row) => row.price.valid).length,
    missingPrice: count("missing"),
    zeroPrice: count("zero"),
    invalidPrice: count("invalid"),
    missingPricingUnit: count("missing_unit"),
    currentPriceWithUnknownSource: count("unknown_source"),
  },
  byStatus: tally(rows, (product) => product.priceStatus),
  missingByCategory: tally(missing, (product) => product.categoryKey || product.familyKey),
  missingByBrand: tally(missing, (product) => product.brand || product.manufacturer),
  missingBySupplier: tally(missing, (product) => product.supplier),
  missingUnitByCategory: tally(rows.filter((row) => row.price.issues.includes("missing_unit")), (product) => product.categoryKey || product.familyKey),
  unknownSourceByCategory: tally(rows.filter((row) => row.price.issues.includes("unknown_source")), (product) => product.categoryKey || product.familyKey),
  products: rows.filter((row) => !row.price.valid || row.price.issues.length).map(({ product, price }) => ({
    productCode: product.productCode,
    productName: product.productName,
    category: product.categoryKey || product.familyKey,
    brand: product.brand,
    supplier: product.supplier,
    priceStatus: price.status,
    amount: price.amount,
    unit: price.unit,
    issues: price.issues,
  })),
};

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ totals: report.totals, byStatus: report.byStatus }, null, 2));
console.log("Missing price by category (top 25):", report.missingByCategory.slice(0, 25));
console.log("Missing price by brand (top 25):", report.missingByBrand.slice(0, 25));
console.log("Missing price by supplier (top 25):", report.missingBySupplier.slice(0, 25));
console.log(`Full report: ${REPORT}`);
