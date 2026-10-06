// Regression tests: canonical Quotation Builder row cost (cost = quantity × rate).
//
//   node --import ./scripts/register-json-loader.mjs scripts/test-quotation-row-cost.mjs
//
// Runs the real Estimate Builder calculation engine on the default workbook.
import assert from "node:assert/strict";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { parseQuoteQuantity, quoteRowCost, resolveQuoteRowQuantity } from "../lib/construction-estimation/quoteRowCost.js";
import { quoteLineTotal } from "../lib/construction-estimation/finalQuotationBoq.js";

const results = [];
const test = (name, fn) => {
  try { fn(); results.push(["PASS", name]); } catch (error) { results.push(["FAIL", `${name}: ${error.message}`]); process.exitCode = 1; }
};

const INSULATION = "INSULATION (82)";
const SIALATION_SECOND = "quote-30026";

function workbook() {
  const wb = createEstimateBuilderWorkbookDefaults();
  // A two-storey job so the Second Level sialation row has a real Takeoff-linked area.
  const set = (section, key, value) => {
    wb.data[section] = wb.data[section] || { rows: {} };
    wb.data[section].rows = wb.data[section].rows || {};
    wb.data[section].rows[key] = { ...(wb.data[section].rows[key] || {}), value };
  };
  set("inputDataSheet", "floorCount", "Double storey");
  set("walls", "lowerExternalWallsLm", 60);
  set("walls", "upperExternalWallsLm", 52);
  set("walls", "lowerCeilingHeight", 2.7);
  set("walls", "upperCeilingHeight", 2.7);
  set("walls", "lowerWallSystem", "Timber/Steel Framed with lightweight cladding");
  set("walls", "upperWallSystem", "Timber/Steel Framed with lightweight cladding");
  return wb;
}

// Returns a new workbook (never mutates the one passed in).
function editRow(wb, section, id, patch) {
  return {
    ...wb,
    quotation: {
      ...wb.quotation,
      [section]: { ...wb.quotation[section], rows: wb.quotation[section].rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) },
    },
  };
}

// The same edit the Quotation Builder makes when the user types in the Qty cell.
const editQty = (wb, section, id, value) => editRow(wb, section, id, { quantity: value, autoQuantity: false, quantityManualOverride: true });
const calc = (wb) => calculateEstimateBuilderWorkbook(wb);
const row = (result, section, id) => result.quotation[section].rows.find((item) => item.id === id);
const firstManualRow = (wb, section) => wb.quotation[section].rows.find((item) => !item.quantityKey && !item.autoQuantity && item.active !== false && String(item.unit || "").trim());

// --- pure canonical function ------------------------------------------------------------------
test("canonical: 121.56 × $8.50 = $1,033.26", () => assert.equal(quoteRowCost({ quantity: 121.56, rate: 8.5 }), 1033.26));
test("canonical: 151.08 × $9.20 = $1,389.94", () => assert.equal(quoteRowCost({ quantity: 151.08, rate: 9.2 }), 1389.94));
test("canonical: blank × $10.50 = $0.00", () => assert.equal(quoteRowCost({ quantity: "", rate: 10.5 }), 0));
test("canonical: 0 × $12.75 = $0.00", () => assert.equal(quoteRowCost({ quantity: 0, rate: 12.75 }), 0));
test("canonical: a user-owned blank quantity never falls back to the linked quantity", () => {
  assert.equal(resolveQuoteRowQuantity({ userEntered: true, manualQuantity: "", linkedQuantity: 151.08 }), 0);
  assert.equal(resolveQuoteRowQuantity({ userEntered: true, manualQuantity: "0", linkedQuantity: 151.08 }), 0);
  assert.equal(parseQuoteQuantity(undefined), 0);
  assert.equal(parseQuoteQuantity(null), 0);
});

// --- engine: a plain manual row -----------------------------------------------------------------
const manualSection = "INSULATION (82)";
const baseWb = workbook();
const manual = firstManualRow(baseWb, manualSection) || baseWb.quotation[manualSection].rows[0];

test("1. Qty 10 × Rate $5 = Cost $50", () => {
  const wb = editRow(editQty(workbook(), manualSection, manual.id, "10"), manualSection, manual.id, { manualRate: "5" });
  assert.equal(row(calc(wb), manualSection, manual.id).cost, 50);
});
test("2. Change Qty to 20 → Cost $100", () => {
  const wb = editRow(editQty(workbook(), manualSection, manual.id, "20"), manualSection, manual.id, { manualRate: "5" });
  assert.equal(row(calc(wb), manualSection, manual.id).cost, 100);
});
test("3. Clear Qty → Cost $0", () => {
  const wb = editRow(editQty(workbook(), manualSection, manual.id, ""), manualSection, manual.id, { manualRate: "5" });
  assert.equal(row(calc(wb), manualSection, manual.id).cost, 0);
});
test("4. Qty 0 → Cost $0", () => {
  const wb = editRow(editQty(workbook(), manualSection, manual.id, "0"), manualSection, manual.id, { manualRate: "5" });
  assert.equal(row(calc(wb), manualSection, manual.id).cost, 0);
});
test("5. Change Rate with existing Qty → Cost recalculates", () => {
  const wb = editRow(editQty(workbook(), manualSection, manual.id, "20"), manualSection, manual.id, { manualRate: "7.5" });
  assert.equal(row(calc(wb), manualSection, manual.id).cost, 150);
});

// --- engine: the Section 83 Takeoff-linked row ("Sialation Installed price - Second Level") -------
const linkedBefore = calc(editRow(workbook(), INSULATION, SIALATION_SECOND, { manualRate: "10.50" }));
const linkedRowBefore = row(linkedBefore, INSULATION, SIALATION_SECOND);
const clearedWb = editQty(editRow(workbook(), INSULATION, SIALATION_SECOND, { manualRate: "10.50" }), INSULATION, SIALATION_SECOND, "");
const cleared = calc(clearedWb);

test("9. Imported / Takeoff-linked measured row uses Qty × Rate", () => {
  assert(linkedRowBefore.qty > 0, `linked quantity present (${linkedRowBefore.qty})`);
  assert.equal(linkedRowBefore.cost, quoteRowCost({ quantity: linkedRowBefore.qty, rate: 10.5 }));
});
test("Section 83: clearing Qty on the linked sialation row → Qty blank and Cost $0.00 (no Takeoff fallback)", () => {
  const after = row(cleared, INSULATION, SIALATION_SECOND);
  assert.equal(String(after.quantity), "");
  assert.equal(after.qty, 0);
  assert.equal(after.cost, 0);
});
test("6. Section total falls by exactly the cleared row's cost", () => {
  assert.equal(Math.round((linkedBefore.quotation[INSULATION].subtotal - cleared.quotation[INSULATION].subtotal) * 100) / 100, linkedRowBefore.cost);
});
test("7. Grand quotation total falls accordingly", () => {
  assert(cleared.summary.baseLineItemSubtotal < linkedBefore.summary.baseLineItemSubtotal, "line-item subtotal falls");
  assert.equal(Math.round((linkedBefore.summary.baseLineItemSubtotal - cleared.summary.baseLineItemSubtotal) * 100) / 100, linkedRowBefore.cost);
  assert(cleared.summary.finalQuoteTotal < linkedBefore.summary.finalQuoteTotal, "final quote total (with overheads / margin / GST) falls");
});
test("Re-entering Qty recalculates from the new Qty × current Rate", () => {
  const again = calc(editQty(clearedWb, INSULATION, SIALATION_SECOND, "40"));
  assert.equal(row(again, INSULATION, SIALATION_SECOND).cost, 420);
});
test("8. Save / reload does not resurrect a stale Cost", () => {
  // A saved row carrying the old calculated cost + imported cost, with Qty cleared.
  const saved = JSON.parse(JSON.stringify(editRow(clearedWb, INSULATION, SIALATION_SECOND, { cost: 1586.34, importedCost: "$1,586.34", qty: 151.08 })));
  const reloaded = row(calc(saved), INSULATION, SIALATION_SECOND);
  assert.equal(reloaded.cost, 0);
  assert.equal(quoteLineTotal({ quantity: "", manualRate: "10.50", importedCost: "$1,586.34" }), 0, "BOQ/procurement total never uses a stale importedCost");
});

// --- explicit special rows keep their own behaviour -----------------------------------------------
test("10. QUOTE row: qty 1 × quoted amount (spreadsheet B×F), and blank qty = $0 like the source spreadsheet", () => {
  const wb = workbook();
  const [section, quoteRow] = Object.entries(wb.quotation).flatMap(([name, value]) => (value.rows || []).map((item) => [name, item])).find(([, item]) => String(item.unit || "").toUpperCase() === "QUOTE" && !item.quantityKey);
  const withQty = calc(editRow(editQty(wb, section, quoteRow.id, "1"), section, quoteRow.id, { manualRate: "3690" }));
  assert.equal(row(withQty, section, quoteRow.id).cost, 3690);
  const blank = calc(editRow(editQty(workbook(), section, quoteRow.id, ""), section, quoteRow.id, { manualRate: "3690" }));
  assert.equal(row(blank, section, quoteRow.id).cost, 0);
});
test("10. Explicit engine-assigned total rows keep their own cost (cabinet maker section total)", () => {
  const result = calc(workbook());
  const totalRows = Object.values(result.quotation).flatMap((section) => (section.rows || []).filter((item) => item.cabinetMakerTotalRow).map((item) => ({ item, section })));
  totalRows.forEach(({ item, section }) => {
    const expected = Math.round(section.rows.filter((other) => !other.feeType && !other.cabinetMakerTotalRow).reduce((sum, other) => sum + other.cost, 0) * 100) / 100;
    assert.equal(item.cost, expected);
  });
});

// --- cross-section: every ordinary row in every section obeys cost = qty × rate -------------------
test("Global: every active ordinary row in every section has cost = qty × rate", () => {
  const result = calc(workbook());
  const violations = [];
  for (const [name, section] of Object.entries(result.quotation)) {
    for (const item of section.rows || []) {
      if (item.feeType || item.cabinetMakerTotalRow || item.sourceOfRate === "calculated" || item.sourceOfRate === "manual" && item.cost === 0 && item.qty === 0) continue;
      const expected = item.cost === 0 && (item.active === false || item.lineType === "Excluded item" || item.inactiveReason) ? 0 : quoteRowCost({ quantity: item.qty, rate: item.finalRateUsed });
      if (Math.abs(expected - item.cost) > 0.01) violations.push(`${name} / ${item.item}: qty ${item.qty} × ${item.finalRateUsed} = ${expected}, cost ${item.cost}`);
    }
  }
  assert.equal(violations.length, 0, violations.slice(0, 5).join("\n"));
});

for (const [status, name] of results) console.log(`${status} ${name}`);
console.log(`${results.filter(([status]) => status === "PASS").length}/${results.length} passed`);
