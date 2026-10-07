import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("components/estimate-builder/EstimateBuilderWorkbook.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(source.includes("const ESTIMATE_WORKBOOK_SHEET_TABS = ["), "Workbook sheet tab definition is missing.");
const tabBlock = source.slice(
  source.indexOf("const ESTIMATE_WORKBOOK_SHEET_TABS = ["),
  source.indexOf("];", source.indexOf("const ESTIMATE_WORKBOOK_SHEET_TABS = [")) + 2
);
const expectedTabs = [
  '{ key: "dataInput", label: "Data Input" }',
  '{ key: "formulaSheet", label: "Calculations" }',
  '{ key: "quotation", label: "Quote Sheet" }',
];
assert(expectedTabs.every((tab) => tabBlock.includes(tab)), "One or more required workbook sheet tabs are missing.");
assert(
  expectedTabs.every((tab, index) => tabBlock.indexOf(tab) >= 0 && (index === 0 || tabBlock.indexOf(expectedTabs[index - 1]) < tabBlock.indexOf(tab))),
  "Workbook sheet tabs are not in the required order."
);
assert(source.includes("<WorkbookSheetTabs activePageKey={activePageKey} onNavigate={navigateWorkspacePage} />"), "Workbook sheet tabs are not mounted in the workbook shell.");
assert(source.includes("function WorkbookSheetTabs("), "WorkbookSheetTabs component is missing.");
assert(source.includes("activePageKey === tab.key"), "Workbook sheet active state is not wired.");
assert(source.includes("onClick={() => onNavigate(tab.key)}"), "Workbook sheet tabs do not navigate through the existing workspace router.");
assert(source.includes('{activePageKey === "dataInput" && (') && source.includes("<DataInputSheet"), "Existing Data Input sheet render path is missing.");
assert(source.includes('{activePageKey === "formulaSheet" && (') && source.includes("<FormulaSheet"), "Existing FormulaSheet render path is missing.");
assert(source.includes('{activePageKey === "quotation" && <QuotationSheet'), "Existing Quote Sheet/Quotation render path is missing.");
assert(!source.includes("function NewQuoteCalculationSheet"), "A duplicate simplified quote calculation sheet was introduced.");

console.log("Estimate workbook sheet-tab checks passed.");
