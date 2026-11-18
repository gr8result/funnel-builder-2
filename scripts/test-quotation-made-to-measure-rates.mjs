// Made-to-measure shower screens and mirrors in the Quotation Builder: an allowance saved as a
// "supplier quote" is never the rate; mirrors take the builder's per-LM mirror rate x width; screens
// without a real quote are Supplier Quote Required.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-made-to-measure-rates.mjs
import assert from "node:assert/strict";
import { RFQ_PENDING_SUPPLIER_QUOTE, builderMirrorRate, configuredLineRate, isAllowancePlaceholderQuote } from "../lib/builders/allocatedSelectionQuotation.js";

const mirror = (widthMm, heightMm = 900, type = "Framed Mirrors", configuration = "Essential Mirror Frame") => ({
  configuredSelection: true, productName: "Essential Mirror - Essential Mirror Frame", priceSource: "supplier-quote", unitPrice: 300, unitAllowance: 300, quoteReference: "",
  configuration: { type, configuration, widthMm, heightMm, madeToMeasure: true },
});
const quotation = {
  "MIRRORS (143)": { rows: [
    { item: "FRAMED 900 HIGH", unit: "LM", excelRate: "$85.00" },
    { item: "FLAT POLISHED", unit: "LM", excelRate: "$92.00" },
    { item: "MICRO FRAMED", unit: "LM", excelRate: "$122.00" },
    { item: "BEVELLED EDGE", unit: "LM", excelRate: "$244.00", manualRate: "250" },
  ] },
};

// The allowance copied in as a "quote" is a placeholder; a real quote (with its reference) is not.
assert.equal(isAllowancePlaceholderQuote(mirror(1000)), true);
assert.equal(isAllowancePlaceholderQuote({ ...mirror(1000), quoteReference: "RQ-1" }), false, "a referenced supplier quote is a price");
assert.equal(isAllowancePlaceholderQuote({ ...mirror(1000), unitPrice: 412 }), false, "a quote that differs from the allowance is a price");
assert.equal(isAllowancePlaceholderQuote({ ...mirror(1000), configuredSelection: false }), false, "only made-to-measure lines");

// Each mirror size has its own rate from the builder's per-LM rows.
assert.equal(builderMirrorRate(mirror(1000), quotation).rate, 85);
assert.equal(builderMirrorRate(mirror(2000), quotation).rate, 170);
assert.equal(builderMirrorRate(mirror(900), quotation).rate, 76.5);
assert.match(builderMirrorRate(mirror(2000), quotation).status, /FRAMED 900 HIGH \$85\.00\/LM x 2 m/);
assert.equal(builderMirrorRate(mirror(1200, 900, "Frameless Mirror", "Bevelled"), quotation).rate, 300, "a builder's manual rate wins ($250/LM x 1.2 m)");
assert.equal(builderMirrorRate(mirror(1500, 900, "Frameless Mirror", "Flat Polished"), quotation).rate, 138);
// Framed "900 HIGH" never prices a mirror of another height; no width means no rate.
assert.equal(builderMirrorRate(mirror(1000, 1200), quotation), null);
assert.equal(builderMirrorRate(mirror(0), quotation), null);
// A shower screen is never priced from mirror rows.
assert.equal(builderMirrorRate({ configuredSelection: true, productName: "Essential Framed Shower Screen", configuration: { type: "Essential (Framed)", configuration: "Hinged / Pivot", widthMm: 1000, heightMm: 2000 } }, quotation), null);
// Client Selections rows are never a rate source.
assert.equal(builderMirrorRate(mirror(1000), { "SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS": { rows: [{ item: "FRAMED 900 HIGH", unit: "LM", excelRate: "$85.00", source: "client-selections-allocated-product" }] } }), null);


// Rate order (owner decision 12 Nov 2026): real supplier quote -> for mirrors, the builder's per-LM
// mirror rate -> otherwise no rate (Supplier Quote Required). No price is ever substituted, and
// anything but a real quote keeps rfq_status "Pending Supplier Quote".
const screen = { configuredSelection: true, productName: "Essential Framed Shower Screen", priceSource: "supplier-quote", unitPrice: 600, unitAllowance: 600, quoteReference: "", configuration: { type: "Essential (Framed)", configuration: "Hinged / Pivot", widthMm: 1000, heightMm: 2000 } };
const screenRate = configuredLineRate(screen, 545.4545, quotation);
assert.equal(screenRate.rate, null, "a screen without a real quote has no rate - neither the $545.45 placeholder nor a template");
assert.equal(screenRate.builderRate, null);
assert.equal(screenRate.rfqStatus, RFQ_PENDING_SUPPLIER_QUOTE);
const quoted = configuredLineRate({ ...screen, quoteReference: "RQ-9", unitPrice: 1320 }, 1200, quotation);
assert.deepEqual([quoted.rate, quoted.rfqStatus], [1200, null], "a real supplier quote wins and is not pending");
assert.equal(configuredLineRate(mirror(1000), 272.7273, quotation).rate, 85, "a matching LM mirror rate");
assert.equal(configuredLineRate(mirror(1000, 1200), 272.7273, quotation).rate, null, "no matching LM rate: Supplier Quote Required");
assert.equal(configuredLineRate(mirror(1000), 272.7273, {}).rfqStatus, RFQ_PENDING_SUPPLIER_QUOTE);
assert.equal(configuredLineRate({ ...screen, configuredSelection: false }, 99, quotation).rate, 99, "ordinary products are untouched");

console.log("made-to-measure rates: allowance placeholders are not prices; real quote -> LM mirror rate -> Supplier Quote Required (no substituted price), flagged Pending Supplier Quote");
