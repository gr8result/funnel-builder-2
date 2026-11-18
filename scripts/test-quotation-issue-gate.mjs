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

// ---- Owner rule 16 Nov 2026: unpriced selected products block issue (real job copy) ----------------
const { default: fs } = await import("node:fs");
const { default: JSZip } = await import("jszip");
const { reconcileProductSelections } = await import("../lib/builders/productSelectionIntegrity.js");
const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const { selectionPriceBlockers } = await import("../lib/construction-estimation/quotationIssueGate.js");
const jobFile = process.env.QUOTATION_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
if (fs.existsSync(jobFile)) {
  const job = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(jobFile))).file("estimate.json").async("string")).workbook;
  const silence = console.log; console.log = () => {};
  const audited = (wb) => { const calc = calculateEstimateBuilderWorkbook(structuredClone(wb)); return { calc, audit: reconcileProductSelections({ workbook: { ...wb, quotation: calc.quotation } }) }; };
  const base = audited(job);
  console.log = silence;
  const unpriced = base.audit.entries.filter((e) => e.outcome === "BLOCKED_MISSING_PRICE");

  check("real job: every selected product without a confirmed price blocks issue and is listed by name", () => {
    const result = quotationIssueCheck(base.calc.quotation, { selectionAudit: base.audit });
    const products = result.blockers.filter((b) => b.selection);
    assert(unpriced.length > 0, "the job copy has unpriced selected products");
    assert.equal(products.length, new Set(unpriced.map((e) => e.key)).size);
    assert(products.some((b) => /Basin Mixer/i.test(b.item)), "price-pending basin mixer listed");
    assert.match(result.message, /selected products? without a confirmed price/);
    assert.equal(result.ok, false);
  });

  check("real job: products included in a package, priced in the quote or awaiting approval do not block on price", () => {
    const result = quotationIssueCheck(base.calc.quotation, { selectionAudit: base.audit });
    const blockedKeys = new Set(result.blockers.filter((b) => b.selection).map((b) => b.item));
    for (const e of base.audit.entries.filter((x) => ["VERIFIED_INCLUDED_IN_PACKAGE", "PRICED_IN_QUOTE", "BLOCKED_BUILDER_APPROVAL"].includes(x.outcome))) {
      assert(!unpriced.some((u) => u.key === e.key), `${e.productName} is not an unpriced block`);
    }
    assert(base.audit.entries.some((e) => e.outcome === "VERIFIED_INCLUDED_IN_PACKAGE"), "job has package-included products");
    assert(blockedKeys.size > 0);
  });

  check("real job: an optional product marked not required (auditable reason) stops blocking; others still block", () => {
    const optional = unpriced[0];
    const resolutions = [{ issueId: `selection:${optional.key}`, type: "NOT_REQUIRED", status: "APPLIED", reason: "Client confirmed this item is not required" }];
    const result = quotationIssueCheck(base.calc.quotation, { selectionAudit: base.audit, resolutions });
    assert(!result.blockers.some((b) => b.selection && b.item === String(optional.productName || optional.productId).trim() && b.location === String(optional.location || "").trim()));
    assert.equal(selectionPriceBlockers(base.audit, { resolutions }).length, selectionPriceBlockers(base.audit).length - 1);
    assert.equal(result.ok, false, "the remaining unpriced products still block");
  });

  check("real job: a product removed from the selections (not selected) no longer blocks", () => {
    const victim = unpriced.find((e) => e.rowId);
    const copy = structuredClone(job);
    for (const room of copy.clientSelectionsBook.rooms || []) room.rows = (room.rows || []).filter((row) => row.id !== victim.rowId);
    console.log = () => {}; const after = audited(copy); console.log = silence;
    assert(!after.audit.entries.some((e) => e.key === victim.key && e.outcome === "BLOCKED_MISSING_PRICE"));
  });

  check("a $0 or blank selected-product price is not a price; the audit gives no free pass", () => {
    const audit = { entries: [
      { key: "a", outcome: "BLOCKED_MISSING_PRICE", productName: "Zero-dollar placeholder", selectedUnitPrice: 0 },
      { key: "b", outcome: "PRICED_IN_QUOTE", productName: "Priced tap", selectedUnitPrice: 220 },
      { key: "c", outcome: "VERIFIED_INCLUDED_IN_PACKAGE", productName: "Included gutter", selectedUnitPrice: 0 },
    ] };
    const result = quotationIssueCheck({ s: { rows: [priced] } }, { selectionAudit: audit });
    assert.deepEqual(result.blockers.map((b) => b.item), ["Zero-dollar placeholder"]);
  });
  const { cabinetryQuotationBriefs } = await import("../lib/construction-estimation/cabinetryRequirements.js");
  check("real job: outstanding cabinetry measurements (Kitchen, Laundry) block issue; entering them clears the block", () => {
    const briefs = cabinetryQuotationBriefs(job);
    const result = quotationIssueCheck(base.calc.quotation, { selectionAudit: base.audit, cabinetryBriefs: briefs });
    const cab = result.blockers.filter((b) => b.cabinetry);
    assert(cab.some((b) => b.location === "Kitchen" && /benchtop/i.test(b.item)), "Kitchen main benchtop measurement listed");
    assert(cab.some((b) => b.location === "Laundry"), "Laundry measurement listed");
    assert.match(result.message, /outstanding cabinetry measurements: Kitchen \(/);
    const done = briefs.map((b) => ({ ...b, outstanding: 0, measurements: (b.measurements || []).map((m) => ({ ...m, status: "approved" })) }));
    assert.equal(quotationIssueCheck({ s: { rows: [priced] } }, { cabinetryBriefs: done }).ok, true, "complete measurements do not block");
  });
} else console.log("SKIP real-job checks: job file not found", jobFile);

console.log(`\n${passed} checks passed (including selected-product pricing)`);
