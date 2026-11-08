// 8 Nov 2026: Client Selections sections show under the builder's existing trade, and a Client
// Selections save never merges or renames the builder's categories. Run:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-trade-hierarchy.mjs [restored.gr8job]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { clientSelectionTradeParentNames } from "../lib/construction-estimation/quoteTradeHierarchy.js";
import { preserveQuotationStructure, normalizeQuotationStructure } from "../lib/construction-estimation/quotationStructure.js";

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log("PASS", name); };
const row = (id, item, extra = {}) => ({ id, item, quantity: "", excelRate: "$10.00", formulas: { G: `B${id}*F${id}` }, ...extra });

await check("generated sections map to the builder's existing trades", () => {
  const expected = {
    "tiling - kitchen": "tiling", "tiling - butlers pantry": "tiling", "tiling - 2nd bedroom ensuite": "tiling",
    "electrical - client selections": "electrical",
    "plumbing fit off - client selections": "plumbing fittings & tapwear",
    "plumbing - hot water - client selections": "hot water",
    "fix out - bathroom accessories - client selections": "fix out",
    "shower screens & mirrors - client selections": "mirrors & shower screens",
    "stairs & balustrades - client selections": "stairs",
    "entry door furniture - client selections": "doors",
    "floor coverings - client selections": "floorcoverings",
  };
  for (const [name, parent] of Object.entries(expected)) assert.equal(clientSelectionTradeParentNames(name)[0], parent, name);
  // Builder sections and sections with no clear trade are never placed automatically.
  for (const name of ["tiling", "kitchen", "door jamb materials", "cabinet maker", "wardrobes - client selections", "client selections"]) assert.deepEqual(clientSelectionTradeParentNames(name), [], name);
});

await check("Client Selections save keeps builder categories, names, order and rows", () => {
  const quotation = {
    "DOORS (71)": { rows: [row("d1", "Door")] },
    "DOOR FURNITURE (72)": { rows: [row("df1", "Trilock")] },
    "CABINET MAKER": { rows: [row("c1", "Kitchen base")] },
    "KITCHEN SINKS (117)": { rows: [row("k1", "Sink")] },
    "TILING (108)": { rows: [row("t0", "ITEM")] },
    "TILING - KITCHEN": { rows: [row("t1", "Splashback", { quantity: 2 })] },
    "ELECTRICAL - CLIENT SELECTIONS": { rows: [row("e1", "GPO", { quantity: 3 })] },
  };
  const kept = preserveQuotationStructure(structuredClone(quotation));
  assert.deepEqual(Object.keys(kept), Object.keys(quotation));
  for (const name of Object.keys(quotation)) assert.deepEqual(kept[name], quotation[name], name);
  // What the old save did: merged four of them into fixed trades.
  const merged = normalizeQuotationStructure(structuredClone(quotation));
  assert.ok(!("CABINET MAKER" in merged) && !("DOOR FURNITURE (72)" in merged), "old merge removed builder categories (documented)");
});

await check("the Client Selections save path uses the preserving repair, not the merge", () => {
  const hook = fs.readFileSync(new URL("../hooks/estimate-builder/useEstimateBuilderWorkbook.js", import.meta.url), "utf8");
  const connectors = fs.readFileSync(new URL("../lib/builders/selectionReconciliation.js", import.meta.url), "utf8");
  for (const [label, src] of [["hook", hook], ["connectors", connectors]]) {
    assert.ok(!/normalizeQuotationStructure\(/.test(src), `${label} still merges categories`);
    assert.ok(/preserveQuotationStructure\(/.test(src), `${label} uses the preserving repair`);
  }
});

const restoredFile = process.argv[2];
if (restoredFile && fs.existsSync(restoredFile)) {
  const zip = await JSZip.loadAsync(fs.readFileSync(restoredFile));
  const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
  await check("restored job: a Client Selections save keeps all categories and rows in place", () => {
    const kept = preserveQuotationStructure(structuredClone(workbook.quotation));
    assert.deepEqual(Object.keys(kept), Object.keys(workbook.quotation));
    for (const [name, section] of Object.entries(workbook.quotation)) {
      assert.equal(kept[name].rows.length, section.rows.length, name);
      section.rows.forEach((r, i) => {
        const k = kept[name].rows[i];
        assert.equal(k.item, r.item); assert.deepEqual(k.formulas, r.formulas);
        // UNDERSLAB AND DRAINAGE: the existing progress-allocation rule (not changed here) still applies on save.
        if (name !== "UNDERSLAB AND DRAINAGE") { assert.equal(String(k.quantity ?? ""), String(r.quantity ?? "")); assert.equal(k.excelRate, r.excelRate); assert.equal(k.manualRate, r.manualRate); }
      });
    }
  });
}
console.log(`\n${passed} checks passed`);
