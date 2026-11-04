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

console.log(`\n${passed} checks passed`);
