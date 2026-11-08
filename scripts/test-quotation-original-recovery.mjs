// Recovery 8 Nov 2026: the builder's own quotation categories must never be deleted by a load-time
// migration. Run:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-original-recovery.mjs [restored.gr8job]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { reconcileCabinetryQuotation, FINAL_CABINETRY } from "../lib/construction-estimation/finalCabinetryQuotation.js";
import { withWindowsPriceListQuotation } from "../lib/construction-estimation/windowsQuotePriceList.js";
import { restoreOriginalSections, mergeOrder } from "./restore-original-quotation-sections.mjs";

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log("PASS", name); };
const WS = FINAL_CABINETRY.workspaceId;
const LEGACY = ["CABINET MAKER", "BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES", "STANDARD WARDROBES COMPLETE (2.4M WIDE) (90)", "STANDARD 3 DOOR ROBE UP TO 3.6M WIDE"];
const row = (id, item, extra = {}) => ({ id, item, quantity: "", excelRate: "$1,500.00", formulas: { G: `B${id}*F${id}` }, ...extra });

await check("cabinetry migration keeps every builder cabinet section, rows and order", () => {
  const quotation = { "FIX OUT (88)": { rows: [row("f1", "Skirting")] } };
  LEGACY.forEach((name, i) => { quotation[name] = { collapsed: true, rows: [row(`c${i}`, `${name} item`)] }; });
  quotation["WATERPROOFING (107)"] = { rows: [row("w1", "Membrane")] };
  const workbook = { workspaceId: WS, quotation, quotationSectionOrder: Object.keys(quotation) };
  const out = reconcileCabinetryQuotation(workbook, WS);
  // A stable section id may be added; everything else must be identical.
  const noId = ({ sectionId, ...rest }) => rest;
  for (const name of LEGACY) assert.deepEqual(noId(out.quotation[name]), noId(quotation[name]), `${name} changed or removed`);
  assert.ok(out.quotation.CABINETRY, "CABINETRY section added");
  assert.deepEqual(out.quotationSectionOrder, ["FIX OUT (88)", ...LEGACY, "CABINETRY", "WATERPROOFING (107)"]);
});

await check("an existing CABINETRY section keeps its place; legacy sections around it stay", () => {
  const quotation = { "CABINET MAKER": { rows: [row("c1", "Kitchen base")] }, CABINETRY: { collapsed: true, rows: [] }, "BUTLERS PANTRY": { rows: [row("b1", "Pantry base")] } };
  const out = reconcileCabinetryQuotation({ workspaceId: WS, quotation, quotationSectionOrder: Object.keys(quotation) }, WS);
  assert.deepEqual(Object.keys(out.quotation), ["CABINET MAKER", "CABINETRY", "BUTLERS PANTRY"]);
  assert.equal(out.quotation.CABINETRY.collapsed, true);
  assert.ok(out.quotation.CABINETRY.rows.length > 0);
});

await check("windows price list keeps the builder's uncharged WINDOWS QUOTE / FLYSCREEN QUOTE rows", () => {
  const rows = [row("quote-750", "WINDOWS QUOTE", { excelRow: 750, excelRate: "$8,032.00" }), row("quote-753", "FLYSCREEN QUOTE", { excelRow: 753, excelRate: "$1,538.99" })];
  const out = withWindowsPriceListQuotation({ "WINDOWS (46)": { rows } });
  const ids = out["WINDOWS (46)"].rows.map((r) => r.id);
  assert.ok(ids.includes("quote-750") && ids.includes("quote-753"));
  const charged = withWindowsPriceListQuotation({ "WINDOWS (46)": { rows: [{ ...rows[0], quantity: "1" }] } });
  assert.ok(!charged["WINDOWS (46)"].rows.some((r) => r.id === "quote-750"), "a charged placeholder is still replaced (no double charge)");
});

await check("restore adds missing sections and rows verbatim and changes nothing current", () => {
  const original = { quotation: { A: { sortOrder: 1, rows: [row("a1", "A1"), row("a2", "A2")] }, OLD: { sortOrder: 2, collapsed: true, rows: [row("o1", "Old 1")] }, B: { sortOrder: 3, rows: [row("b1", "B1")] } } };
  const current = { quotation: { A: { rows: [row("a2", "A2", { manualRate: "$9" })] }, B: { rows: [row("b1", "B1")] }, NEW: { rows: [row("n1", "N1")] } }, quotationSectionOrder: ["A", "B", "NEW"] };
  const { workbook, report } = restoreOriginalSections(current, original, { uuid: () => "u" });
  assert.deepEqual(workbook.quotationSectionOrder, ["A", "OLD", "B", "NEW"]);
  assert.deepEqual(workbook.quotation.OLD.rows, original.quotation.OLD.rows);
  assert.deepEqual(workbook.quotation.A.rows.map((r) => r.id), ["a1", "a2"]);
  assert.equal(workbook.quotation.A.rows[1].manualRate, "$9", "current edit kept");
  assert.equal(report.restoredSections.length, 1); assert.equal(report.restoredRows.length, 1);
  assert.deepEqual(mergeOrder(["A", "B"], ["B", "X", "A", "Y"]), ["A", "Y", "B", "X"]);
});

const restoredFile = process.argv[2];
if (restoredFile && fs.existsSync(restoredFile)) {
  const zip = await JSZip.loadAsync(fs.readFileSync(restoredFile));
  const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
  await check("restored job: every original cabinet section survives the load-time cabinetry migration", () => {
    const forced = { ...workbook, cabinetryDatasetRevision: "older" };
    const out = reconcileCabinetryQuotation(forced, workbook.workspaceId || WS);
    for (const name of LEGACY) assert.equal(out.quotation[name]?.rows?.length, workbook.quotation[name].rows.length, name);
    assert.equal(Object.keys(out.quotation).length, Object.keys(workbook.quotation).length);
  });
  await check("restored job: WINDOWS QUOTE and FLYSCREEN QUOTE survive the windows price list", () => {
    const out = withWindowsPriceListQuotation(workbook.quotation);
    const items = Object.values(out).flatMap((s) => s.rows || []).map((r) => r.item);
    assert.ok(items.includes("WINDOWS QUOTE") && items.includes("FLYSCREEN QUOTE"));
  });
  await check("restored job: calculated quote shows the restored rows at $0 and charges nothing extra", async () => {
    const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
    const { quotation } = calculateEstimateBuilderWorkbook(workbook);
    for (const name of LEGACY) assert.equal(quotation[name]?.subtotal, 0, `${name} is shown and uncharged`);
    const windows = (quotation["WINDOWS (46)"]?.rows || []).filter((r) => /^(WINDOWS QUOTE|FLYSCREEN QUOTE)$/.test(r.item));
    assert.deepEqual(windows.map((r) => [r.item, Number(r.cost) || 0]), [["WINDOWS QUOTE", 0], ["FLYSCREEN QUOTE", 0]]);
    assert.ok(!(quotation["WINDOWS (46)"]?.rows || []).some((r) => r.generatedFlyscreenQuoteRow), "no generated 10% flyscreen allowance next to the price list");
  });
}
console.log(`\n${passed} checks passed`);
