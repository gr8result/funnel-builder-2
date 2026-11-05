// Quotation V1: unpriced charged rows block a commercial snapshot (issue).
// Run: node --import ./scripts/register-extensionless-loader.mjs scripts/test-quotation-issue-gate.mjs
import assert from "node:assert/strict";
import { quotationIssueCheck, quotationRowMissingPrice } from "../lib/construction-estimation/quotationIssueGate.js";

let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log("PASS", name); };

const priced = { id: "r1", item: "Slab", qty: 120, excelRate: 85, cost: 10200, sourceOfRate: "workbook" };

check("fully priced quotation can be issued", () => {
  const result = quotationIssueCheck({ structure: { title: "Structure", rows: [priced] } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

check("charged row with rate missing blocks issue", () => {
  const result = quotationIssueCheck({ structure: { rows: [priced, { id: "r2", item: "Roof sheeting", qty: 210, sourceOfRate: "rate missing" }] } });
  assert.equal(result.ok, false);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].rowId, "r2");
  assert.match(result.message, /Roof sheeting/);
});

check("charged quote-required client selection blocks issue", () => {
  const result = quotationIssueCheck({ selections: { rows: [{ id: "s1", item: "Pendant light", qty: 2, quoteRequired: true, priceStatus: "Quote Required" }] } });
  assert.equal(result.ok, false);
  assert.equal(result.blockers[0].reason, "quote required");
});

check("catalogue rows listed without a quantity are not charged and never block", () => {
  const result = quotationIssueCheck({ doors: { rows: [{ id: "d1", item: "Corinthian Urban PURB 1", quoteRequired: true }] } });
  assert.equal(result.ok, true);
});

check("price-pending status blocks issue", () => {
  assert.equal(quotationRowMissingPrice({ priceStatus: "Supplier Quote Required" }), "Supplier Quote Required");
  assert.equal(quotationRowMissingPrice({ priceStatus: "Price pending" }), "Price pending");
});

check("builder-entered supplier quote resolves a quote-required row", () => {
  const result = quotationIssueCheck({ selections: { rows: [{ id: "s1", item: "Pendant light", qty: 2, quoteRequired: true, supplierQuote: "345.00" }] } });
  assert.equal(result.ok, true);
});

check("excluded, hidden and zero-quantity template rows never block", () => {
  const result = quotationIssueCheck({ structure: { rows: [
    priced,
    { id: "x1", item: "Excluded option", qty: 3, sourceOfRate: "rate missing", active: false },
    { id: "x2", item: "Hidden row", qty: 3, sourceOfRate: "rate missing", hiddenQuoteRow: true },
    { id: "x3", item: "Unused template row", qty: 0, sourceOfRate: "rate missing" },
    { id: "x4", item: "Excluded quote", quoteRequired: true, included: false },
  ] } });
  assert.equal(result.ok, true, JSON.stringify(result.blockers));
});

check("empty or malformed quotation is not treated as blocked", () => {
  assert.equal(quotationIssueCheck({}).ok, true);
  assert.equal(quotationIssueCheck(null).ok, true);
  assert.equal(quotationIssueCheck({ bad: { rows: "x" } }).ok, true);
});

check("a charged quantity at $0 blocks unless it is explicitly a no-charge item", () => {
  const unflagged = quotationIssueCheck({ s: { rows: [{ id: "z1", item: "Unpriced labour", qty: 4, excelRate: "", cost: 0, sourceOfRate: "workbook" }] } });
  assert.equal(unflagged.ok, false);
  assert.match(unflagged.blockers[0].reason, /no price/);
  const included = quotationIssueCheck({ s: { rows: [{ id: "z2", item: "Standard tapware", qty: 1, cost: 0, priceStatus: "Included" }] } });
  assert.equal(included.ok, true);
});

check("the gate never changes a row or invents a price", () => {
  const row = { id: "r9", item: "Roof sheeting", qty: 210, sourceOfRate: "rate missing" };
  const before = JSON.stringify(row);
  quotationIssueCheck({ s: { rows: [row] } });
  assert.equal(JSON.stringify(row), before);
});

check("manual rate and supplier quote both clear a missing price", () => {
  for (const field of ["manualRate", "supplierQuote", "quotedSupplierRate"]) {
    const result = quotationIssueCheck({ s: { rows: [{ id: "m1", item: "Fixed glass", qty: 1, quoteRequired: true, sourceOfRate: "rate missing", [field]: "$480.00", cost: 480 }] } });
    assert.equal(result.ok, true, field);
  }
});

check("an exact duplicate charge blocks issue; different items sharing an id do not", () => {
  const waste = { id: "tiling:laundry:waste-x-Shower", item: "Floor waste (Shower)", qty: 1, excelRate: "$30", cost: 30, sourceOfRate: "workbook" };
  const dup = quotationIssueCheck({ "TILING - LAUNDRY": { rows: [waste, { ...waste }] } });
  assert.equal(dup.ok, false);
  assert.equal(dup.blockers.length, 1);
  assert.match(dup.blockers[0].reason, /duplicate/);
  const collision = quotationIssueCheck({ s: { rows: [
    { id: "quote-30039", item: "Third-storey windows", qty: 2, excelRate: "$900", cost: 1800 },
    { id: "quote-30039", item: "Linea cladding", qty: 40, excelRate: "$55", cost: 2200 },
  ] } });
  assert.equal(collision.ok, true);
});

check("a typed rate that the engine ignores (row still totals $0) does not clear the block", () => {
  const result = quotationIssueCheck({ windows: { rows: [{ id: "w1", item: "Fixed Glass - 650H x 3000W", qty: 1, quoteRequired: true, manualRate: "$10.00", cost: 0 }] } });
  assert.equal(result.ok, false);
});

console.log(`\n${passed} checks passed`);
