import fs from "node:fs";
import path from "node:path";
import { auditApprovedProductLibraryCsv } from "../lib/product-library/approvedCsvParser.js";

const csvPath = process.argv[2] || "C:\\Users\\grant\\Downloads\\PRODUCTS LIBRARY.csv";
const outputPath = path.join(process.cwd(), "docs", "PRODUCT_LIBRARY_APPROVED_CSV_AUDIT.md");
const csvText = fs.readFileSync(csvPath, "utf8");
const audit = auditApprovedProductLibraryCsv(csvText);

function tableRows(rows, fields, limit = 80) {
  if (!rows.length) return "_None._";
  const header = `| ${fields.join(" | ")} |`;
  const divider = `| ${fields.map(() => "---").join(" | ")} |`;
  const body = rows.slice(0, limit).map((row) => `| ${fields.map((field) => String(row[field] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  const suffix = rows.length > limit ? [``, `_Showing ${limit} of ${rows.length} rows._`] : [];
  return [header, divider, ...body, ...suffix].join("\n");
}

const duplicateRows = audit.duplicateDescriptions.map((item) => ({ description: item.description, rows: item.rows.join(", ") }));
const codePreview = audit.items.slice(0, 120).map((item) => ({
  sourceRow: item.sourceRow,
  section: item.section,
  description: item.description,
  quotationItemCode: item.quotationItemCode || "(generated preview)",
  stableQuotationItemCode: item.stableQuotationItemCode,
}));

const md = `# Product Library Approved CSV Audit

Source file: \`${csvPath}\`

## Summary

- Total physical CSV rows: ${audit.physicalRows}
- Valid item rows: ${audit.validItemRows}
- Sections found: ${audit.sections.length}
- Duplicate descriptions: ${audit.duplicateDescriptions.length}
- Missing item codes: ${audit.missingItemCodes.length}
- Missing prices: ${audit.missingPrices.length}
- Rows requiring family conversion: ${audit.rowsRequiringFamilyConversion.length}
- Rows that appear supplier-specific: ${audit.supplierSpecificRows.length}
- Rows requiring manual review: ${audit.manualReviewRows.length}

## Sections

${audit.sections.map((section) => `- ${section}`).join("\n")}

## Stable Code Preview

Codes are generated as a preview only. Existing genuine quotation item codes are preserved, generated codes reserve their values once approved, and every row keeps source-row traceability.

${tableRows(codePreview, ["sourceRow", "section", "description", "quotationItemCode", "stableQuotationItemCode"], 120)}

## Duplicate Descriptions

${tableRows(duplicateRows, ["description", "rows"], 80)}

## Missing Item Codes

${tableRows(audit.missingItemCodes.map((item) => ({ sourceRow: item.sourceRow, section: item.section, description: item.description, generatedCode: item.stableQuotationItemCode })), ["sourceRow", "section", "description", "generatedCode"], 120)}

## Missing Prices

${tableRows(audit.missingPrices.map((item) => ({ sourceRow: item.sourceRow, section: item.section, description: item.description, unit: item.unit })), ["sourceRow", "section", "description", "unit"], 120)}

## Rows Requiring Family Conversion

${tableRows(audit.rowsRequiringFamilyConversion.map((item) => ({ sourceRow: item.sourceRow, section: item.section, description: item.description, generatedCode: item.stableQuotationItemCode })), ["sourceRow", "section", "description", "generatedCode"], 120)}

## Supplier-Specific Rows

Supplier names are treated as data for builder catalogues, not platform structure.

${tableRows(audit.supplierSpecificRows.map((item) => ({ sourceRow: item.sourceRow, section: item.section, description: item.description, genericCode: item.stableQuotationItemCode })), ["sourceRow", "section", "description", "genericCode"], 120)}

## Manual Review Rows

${tableRows(audit.manualReviewRows.map((item) => ({ sourceRow: item.sourceRow, section: item.section, description: item.description, reason: !item.description ? "Missing description" : !item.unit ? "Missing unit" : "Supplier-specific source text" })), ["sourceRow", "section", "description", "reason"], 120)}
`;

fs.writeFileSync(outputPath, md);
console.log(JSON.stringify({
  outputPath,
  physicalRows: audit.physicalRows,
  validItemRows: audit.validItemRows,
  sections: audit.sections.length,
}, null, 2));
