// Air conditioning -> Quotation Builder on the real job (16 Nov 2026). The builder's section is
// "AIR CONDITIONERS (141)" with rows like "KELVINATOR 2.6 KW SPLIT AIR COND"; before the fix the AC
// selection matched no row there, so it never reached the builder's AC line. Read-only job copy.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-ac-quote-link.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { serviceQuoteRequirements } from "../lib/builders/residentialServices.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { plumbingLineWithTotals } from "../lib/builders/plumbingFixtureAllocation.js";

const arg = process.argv.find((item) => item.startsWith("--job="))?.slice(6);
const file = arg || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
if (!fs.existsSync(file)) { console.log(`SKIP real job copy not found: ${file}`); process.exit(0); }
const zip = await JSZip.loadAsync(fs.readFileSync(file));
const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;

const offered = serviceQuoteRequirements(workbook, "air-conditioning");
assert(offered.length >= 2, `the builder AC rows are offered to the client (${offered.map((r) => r.label).join(", ")})`);
assert(offered.every((row) => /AIR CONDITION/i.test(row.section)), "only the builder's air-conditioning section");
assert(!offered.some((row) => /INSTALLATION/i.test(row.label)), "installation stays on its own row");
const split = offered.find((row) => /SPLIT/i.test(row.label));
assert(split, "a split-system row is offered");

const line = plumbingLineWithTotals({
  lineId: "hvac:split:living", productId: "test-split-ac", productCode: "TEST-SPLIT", productName: "Test 2.5kW Split System", brand: "Test", unit: "EACH",
  unitPrice: 1200, unitAllowance: 0, priceBasis: "Retail inc GST", quotationRowId: split.rowId, quotationSection: split.section, originalMaterialAllowance: split.materialAllowance ?? null,
  allocations: [{ locationKey: "living", location: "Living", quantity: 1 }],
});
const book = { rooms: [{ id: "lighting", name: "Lighting & Ceiling Fans", rows: [{ id: "row-ac", status: "selected", guidedSelection: { requirementKey: "air-conditioning", requirementLabel: "Air Conditioning", confirmed: true, plumbingAllocation: { lines: [line] } } }] }] };
const before = JSON.stringify(workbook.quotation);
const synced = connectAllocatedSelectionsToQuotation(structuredClone(workbook), book);
const row = synced.quotation[split.section].rows.find((item) => item.id === split.rowId);
assert.equal(row.selectedProducts?.[0]?.productId, "test-split-ac", "the AC product lands on the builder's split-system row");
assert.match(row.description, /Test 2\.5kW Split System/);
assert.equal(Object.values(synced.quotation).flatMap((s) => s.rows || []).filter((r) => r.productId === "test-split-ac" && r.id !== split.rowId).length, 0, "no second AC charge row");
const again = connectAllocatedSelectionsToQuotation(synced, book);
assert.deepEqual(again.quotation, synced.quotation, "re-sync is stable");
const removed = connectAllocatedSelectionsToQuotation(synced, { rooms: [] });
assert.equal(removed.quotation[split.section].rows.find((item) => item.id === split.rowId).selectedProducts, undefined, "removing the selection restores the builder row");
assert.equal(JSON.stringify(workbook.quotation), before, "source untouched");
console.log(`PASS AC links to ${split.section} / ${split.label}; ${offered.length} builder AC rows offered; stable re-sync; removal restores the row`);
