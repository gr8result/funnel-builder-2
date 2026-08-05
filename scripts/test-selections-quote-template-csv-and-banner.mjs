import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import {
  QUOTATION_TEMPLATE_CSV_COLUMNS,
  applyApprovedSelectionsImport,
  loadApprovedSelectionMappings,
  parseCsvObjects,
  previewApprovedSelectionsCsv,
  quotationTemplateCsvFromWorkbook,
  quotationTemplateItemsFromWorkbook,
  rowsToCsv,
} from "../lib/selections/quotationTemplateCsv.js";

const require = createRequire(import.meta.url);
const importedWorkbook = require("../lib/construction-estimation/importedExcelWorkbookTemplate.json");

const sourceRows = importedWorkbook.quotation.sections.flatMap((section) => section.rows || []);
assert.equal(sourceRows.length, 1578, "Current imported Quotation Builder template raw row count should remain unchanged.");

const workbook = {
  quotation: {
    exterior: {
      rows: [
        { id: "quote-1", section: "Exterior", item: "Garage Door", rawText: "Garage Door | 1 | each | 1200", unit: "each", importedCost: "900", excelRate: "1200", active: true },
        { id: "quote-2", section: "Exterior", item: "Soil Test", rawText: "Soil Test | 1 | each | 800", unit: "each", importedCost: "600", excelRate: "800", active: true },
      ],
    },
    kitchen: {
      rows: [
        { id: "quote-3", section: "Kitchen", item: "Oven", rawText: "Oven | 1 | each | 990", unit: "each", importedCost: "700", excelRate: "990", active: true },
      ],
    },
  },
};
const before = JSON.stringify(workbook);
const items = quotationTemplateItemsFromWorkbook(workbook, ["exterior", "kitchen"]);
assert.equal(items.length, 3, "Export row count should match current workbook quotation rows.");
assert.deepEqual(items.map((item) => item.quote_item_code), ["quote-1", "quote-2", "quote-3"], "All original quote item codes should export.");
assert.equal(items[0].include_in_selections, "yes", "Export should default include_in_selections to yes.");

const csv = quotationTemplateCsvFromWorkbook(workbook, ["exterior", "kitchen"]);
assert.ok(csv.startsWith("\uFEFF"), "CSV should include UTF-8 BOM for Excel compatibility.");
assert.deepEqual(parseCsvObjects(csv).map((row) => row.quote_item_code), ["quote-1", "quote-2", "quote-3"]);
assert.equal(JSON.stringify(workbook), before, "CSV export must not modify Quotation Builder data.");

const approvedCsv = rowsToCsv([
  QUOTATION_TEMPLATE_CSV_COLUMNS,
  ["quote-1", "", "", "", "", "", "", "", "", "", "", "", "Exterior", "Doors", "Garage Door", "per area", "yes", "approved"],
  ["quote-3", "", "", "", "", "", "", "", "", "", "", "", "Kitchen", "Appliances", "Oven", "per kitchen", "yes", ""],
]);
const preview = previewApprovedSelectionsCsv(approvedCsv, items, [], "approved.csv");
assert.equal(preview.totalRows, 2, "Preview should show total uploaded rows.");
assert.equal(preview.validRows.length, 2, "Preview should retain approved rows.");
assert.equal(preview.invalidRows.length, 0, "Valid upload should have no invalid rows.");

const duplicate = rowsToCsv([
  QUOTATION_TEMPLATE_CSV_COLUMNS,
  ["quote-1", "", "", "", "", "", "", "", "", "", "", "", "Exterior", "Doors", "Garage Door", "", "yes", ""],
  ["quote-1", "", "", "", "", "", "", "", "", "", "", "", "Exterior", "Doors", "Garage Door", "", "yes", ""],
]);
assert.equal(previewApprovedSelectionsCsv(duplicate, items, [], "duplicate.csv").canImport, false, "Duplicate quote item codes should block import.");

const unknown = rowsToCsv([
  QUOTATION_TEMPLATE_CSV_COLUMNS,
  ["quote-missing", "", "", "", "", "", "", "", "", "", "", "", "Exterior", "Doors", "Garage Door", "", "yes", ""],
]);
assert.equal(previewApprovedSelectionsCsv(unknown, items, [], "unknown.csv").unknownItemCodes[0], "quote-missing", "Unknown quote codes should be reported.");

const existing = [{ quoteItemCode: "quote-2", selectionArea: "Exterior", selectionCategory: "Testing", selectionItemName: "Soil Test", approvedForSelections: true }];
const reconciliation = previewApprovedSelectionsCsv(approvedCsv, items, existing, "approved.csv");
assert.equal(reconciliation.removedMappings.length, 1, "Removed mappings should require reconciliation.");
const imported = applyApprovedSelectionsImport(existing, reconciliation, "remove");
assert.deepEqual(imported.map((item) => item.quoteItemCode), ["quote-1", "quote-3"], "Only uploaded approved rows should remain active when removal is confirmed.");

global.window = { localStorage: { getItem: () => null } };
assert.deepEqual(loadApprovedSelectionMappings({ organisationId: "org", projectId: "project" }), [], "No approved mapping should not fall back to demo items.");
delete global.window;

const estimateBuilder = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
assert.match(estimateBuilder, /Download Quotation Template CSV/);
assert.match(estimateBuilder, /Upload Approved Selections CSV/);
assert.match(estimateBuilder, /Download Current Approved Selections CSV/);
assert.ok(estimateBuilder.includes('type="file" accept=".csv,text/csv"'), "Upload should use a native CSV file input.");

const templatesPage = readFileSync("pages/inclusions-selections/templates.tsx", "utf8");
assert.match(templatesPage, /loadApprovedSelectionMappings/);
assert.match(templatesPage, /No approved selection items have been uploaded for this area/);
assert.doesNotMatch(templatesPage, /tiles=\{EXTERIOR_PRODUCT_TYPES\}/, "Stage 2 must not display the hard-coded Exterior fallback grid.");

[
  "pages/inclusions-selections/areas.tsx",
  "pages/inclusions-selections/templates.tsx",
  "pages/inclusions-selections/workspace.tsx",
  "pages/inclusions-selections/review.tsx",
  "pages/inclusions-selections/approvals.tsx",
  "pages/inclusions-selections/documents-export.tsx",
  "pages/inclusions-selections/procurement.tsx",
  "pages/modules/builders/product-library.js",
].forEach((file) => {
  assert.match(readFileSync(file, "utf8"), /InclusionsSelectionsProjectBanner/, `${file} should render the shared banner.`);
});

const banner = readFileSync("src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner.tsx", "utf8");
assert.match(banner, /Inclusions & Selections/);
assert.match(banner, /Choose project areas, select products and finishes, and prepare the completed selections schedule\./);
assert.match(banner, /@media \(max-width: 640px\)/, "Banner should include mobile layout rules.");

console.log("Selections quotation CSV and banner tests passed.");
