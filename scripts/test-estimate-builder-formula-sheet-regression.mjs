import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workbookSource = readFileSync(resolve("components/estimate-builder/EstimateBuilderWorkbook.js"), "utf8");
const hookSource = readFileSync(resolve("hooks/estimate-builder/useEstimateBuilderWorkbook.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, `${marker} block is missing.`);
  const end = source.indexOf("];", start);
  assert(end > start, `${marker} block is not closed.`);
  return source.slice(start, end + 2);
}

const tabs = blockAfter(workbookSource, "const ESTIMATE_WORKBOOK_SHEET_TABS = [");
const expectedTabs = [
  '{ key: "dataInput", label: "Data Input" }',
  '{ key: "formulaSheet", label: "Calculations" }',
  '{ key: "quotation", label: "Quote Sheet" }',
];

let lastIndex = -1;
for (const tab of expectedTabs) {
  const index = tabs.indexOf(tab);
  assert(index > lastIndex, `Workbook sheet tab missing or out of order: ${tab}`);
  lastIndex = index;
}
assert((tabs.match(/\{ key:/g) || []).length === 3, "Workbook sheet tabs must remain the three compact workbook tabs.");

const hiddenPages = blockAfter(hookSource, "const ESTIMATE_BUILDER_HIDDEN_PAGES = [");
assert(hiddenPages.includes('{ key: "formulaSheet", label: "Calculations" }'), "formulaSheet must be an accepted hidden workbook page.");
assert(
  hookSource.includes("const ESTIMATE_BUILDER_PAGE_KEYS = new Set([...ESTIMATE_BUILDER_PAGES, ...ESTIMATE_BUILDER_HIDDEN_PAGES].map((page) => page.key));"),
  "Workbook page validation must include hidden workbook pages."
);
assert(hookSource.includes("if (!ESTIMATE_BUILDER_PAGE_KEYS.has(page)) return;"), "setPage must validate against the workbook page key list.");
assert(hookSource.includes("return ESTIMATE_BUILDER_PAGE_KEYS.has(page) ? page : fallbackPage;"), "Saved active pages must accept formulaSheet through the workbook page key list.");

assert(workbookSource.includes("formulaSheet: {"), "WORKSPACE_VISUALS.formulaSheet is missing.");
assert(workbookSource.includes('title: "Calculations"'), "WORKSPACE_VISUALS.formulaSheet must be labelled Calculations.");
assert(workbookSource.includes('subtitle: "View and edit workbook formulas and calculated quantities."'), "WORKSPACE_VISUALS.formulaSheet description changed.");
assert(workbookSource.includes("if (WORKSPACE_VISUALS[queryPage]) return queryPage;"), "Route page normalisation must accept page=formulaSheet through WORKSPACE_VISUALS.");
assert(workbookSource.includes("if (!router?.isReady || previewMode || mode || !WORKSPACE_VISUALS[pageKey]) return;"), "Route query writer must validate pages through WORKSPACE_VISUALS.");

assert(workbookSource.includes('{activePageKey === "dataInput" && (') && workbookSource.includes("<DataInputSheet"), "Data Input render branch is missing.");
assert(workbookSource.includes('{activePageKey === "formulaSheet" && (') && workbookSource.includes("<FormulaSheet"), "Existing FormulaSheet render branch is missing.");
assert(workbookSource.includes('{activePageKey === "quotation" && <QuotationSheet'), "Quote Sheet render branch is missing.");
assert(workbookSource.indexOf('{activePageKey === "dataInput" && (') < workbookSource.indexOf('{activePageKey === "formulaSheet" && ('), "Data Input and FormulaSheet branches are no longer separate in the expected order.");
assert(workbookSource.indexOf('{activePageKey === "formulaSheet" && (') < workbookSource.indexOf('{activePageKey === "quotation" && <QuotationSheet'), "FormulaSheet and Quote Sheet branches are no longer separate in the expected order.");

assert(workbookSource.includes("function FormulaSheet({ sheet, formulaTarget, onPickFormulaReference, canEditFormulas = false })"), "FormulaSheet component signature changed or is missing.");
assert(workbookSource.includes("const rows = formulaRows(sheet);"), "FormulaSheet must render the existing formulaRows(sheet) output.");
assert(workbookSource.includes("function formulaRows(sheet)"), "Existing formulaRows helper is missing.");
assert(workbookSource.includes("const defaultRows = sheet.dataSections.flatMap"), "formulaRows must preserve calculated row definitions from sheet.dataSections.");
assert(workbookSource.includes("...(sheet.workbook.formulaRows || [])"), "formulaRows must preserve workbook.formulaRows.");
assert(hookSource.includes("formulas: normalizeFormulas(defaults.formulas || {}, migratedFormulaRows.formulas),"), "Existing formulas must be normalised from defaults and saved formulas.");
assert(hookSource.includes("formulaRows,"), "Existing formulaRows must remain on the normalised workbook.");
assert(!workbookSource.includes("<CalculatedQuantitiesSheet"), "CalculatedQuantitiesSheet must not replace FormulaSheet.");

console.log("Estimate Builder FormulaSheet workbook regression passed.");
