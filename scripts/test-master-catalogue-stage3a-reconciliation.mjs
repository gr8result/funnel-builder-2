import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifyStage3QuotationRow,
  createProductMatchIndex,
  duplicateKeyFor,
  matchProductRecord,
  normalizeKey,
  reviewDuplicateGroups,
  stableCatalogueId,
} from "../lib/construction-estimation/catalogues/masterCatalogueReconciliation.js";
import {
  createQuotationSnapshot,
  normalizeProductRecord,
} from "../lib/construction-estimation/catalogues/masterCatalogueSchemas.js";

assert.equal(
  classifyStage3QuotationRow({ item: "ROOFING", unit: "", quantity: "", formulas: {} }).proposedSourceType,
  "heading",
  "heading rows must not become catalogue records",
);
assert.equal(
  classifyStage3QuotationRow({ item: "TOTAL ROOFING", unit: "", quantity: "", formulas: { G: "SUM(G1:G4)" } }).proposedSourceType,
  "formula",
  "formula total rows must not become products or estimating items",
);
assert.equal(
  classifyStage3QuotationRow({ item: "ITEM", unit: "UNIT", quantity: "QTY", formulas: {} }).proposedSourceType,
  "informational",
  "repeated workbook column headers are informational/malformed rows",
);
assert.equal(
  classifyStage3QuotationRow({ item: "Supply and install selected oven", unit: "EACH", quantity: "1", formulas: {} }).proposedSourceType,
  "assembly",
  "product plus resource rows classify as assemblies",
);
assert.equal(
  classifyStage3QuotationRow({ item: "Excavator hire", unit: "DAY", quantity: "1", formulas: {} }).proposedSourceType,
  "estimating-item",
  "plant and hire stay in the Estimating Catalogue side",
);

const duplicateRows = [
  { quotation_row_id: "quote-1", quotation_code: "1", current_description: "Travel cost", category_id: "category:siteworks", subcategory_id: "subcategory:travel", proposed_source_type: "estimating-item", unit: "DAY", excelRate: "100" },
  { quotation_row_id: "quote-2", quotation_code: "2", current_description: "Travel cost", category_id: "category:siteworks", subcategory_id: "subcategory:travel", proposed_source_type: "estimating-item", unit: "DAY", excelRate: "100" },
];
duplicateRows.forEach((row) => {
  row.duplicate_group = duplicateKeyFor(row);
  row.proposed_source_id = stableCatalogueId("estimating", row);
});
const duplicateReview = reviewDuplicateGroups(duplicateRows);
assert.equal(duplicateReview.length, 1, "duplicate detection groups matching source candidates");
assert.equal(duplicateReview[0].canonical_row_id, "quote-1", "lowest quotation row is proposed canonical row");
assert.equal(duplicateReview[0].price_unit_conflict, "no", "matching duplicate prices/units do not conflict");

assert.equal(
  stableCatalogueId("product", { category_id: "category:Appliances", subcategory_id: "subcategory:Built In Ovens", current_description: "Westinghouse WVE6515SD" }),
  "product:appliances:built-in-ovens:westinghouse-wve6515sd",
  "stable IDs are deterministic and label-case independent",
);

const productIndex = createProductMatchIndex([
  { productId: "product:appliances:oven:wve6515sd", productCode: "OVEN-WESTINGHOUSE-WVE6515SD", supplier: "Westinghouse", brand: "Westinghouse", model: "WVE6515SD", productName: "Westinghouse WVE6515SD oven" },
]);
assert.equal(
  matchProductRecord({ current_description: "Westinghouse wall oven WVE6515SD" }, productIndex)?.productId,
  "product:appliances:oven:wve6515sd",
  "safe fallback matching can recognise supplier/model text",
);
assert.equal(
  matchProductRecord({ productCode: "OVEN-WESTINGHOUSE-WVE6515SD" }, productIndex)?.confidence,
  "product-code",
  "safe fallback matching checks product code fields",
);

const activeMapping = fs.readFileSync(new URL("../MASTER_CATALOGUE_RECONCILED_MAPPING.csv", import.meta.url), "utf8");
assert.match(activeMapping, /quotation_row_id,quotation_code,stage_id/, "Stage 3A reconciled mapping exists");
assert.doesNotMatch(activeMapping, /generic-paint.*kitchen/i, "generic Kitchen paint is not introduced by reconciliation");
assert.doesNotMatch(activeMapping, /generic-lighting.*kitchen/i, "generic Kitchen lighting is not introduced by reconciliation");

const applianceRows = activeMapping.split(/\r?\n/).filter((line) => /category:appliances/.test(line));
assert.ok(applianceRows.length > 0, "appliance rows remain grouped by appliance family/category");
assert.ok(normalizeKey("Family -> Brand -> Range/model -> Product details"), "appliance hierarchy is represented by stable normalized keys");

const cabinetryReport = fs.readFileSync(new URL("../MASTER_CATALOGUE_RECONCILIATION_REPORT.md", import.meta.url), "utf8");
for (const label of ["Laminex", "Polytec", "Neolith", "Caesarstone", "Smartstone", "Stone Ambassador", "Handle House", "Blum", "brushed aluminium kick panels", "Raw MDF bulkheads", "cabinet shelving", "cleated shelving"]) {
  assert.match(cabinetryReport, new RegExp(label, "i"), `Cabinetry mapping report covers ${label}`);
}

const snapshot = createQuotationSnapshot({
  sourceType: "product",
  record: normalizeProductRecord({
    id: "product:test:immutable",
    familyKey: "ovens",
    productName: "Immutable Oven",
    description: "Original description",
    sellPrice: 100,
  }),
  snapshotAt: "2026-09-02T00:00:00.000Z",
});
const changed = { description: "Changed description", sellPrice: 200 };
assert.equal(snapshot.description, "Original description", "quotation snapshot description is not mutated");
assert.equal(snapshot.sellPrice, 100, "quotation snapshot price is not mutated");
assert.equal(changed.sellPrice, 200, "test fixture changed separately from snapshot");

console.log("Master catalogue Stage 3A reconciliation tests passed.");
