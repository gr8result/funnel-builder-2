import fs from "node:fs";
import path from "node:path";
import { PRODUCT_LIBRARY_SOURCE_CSV, buildApprovedFamilySourceMap, parseApprovedProductLibraryCsv } from "../lib/product-library/catalogueModel.js";

const sourcePath = process.argv[2] || PRODUCT_LIBRARY_SOURCE_CSV;
const outPath = path.join(process.cwd(), "docs", "PRODUCT_LIBRARY_APPROVED_SOURCE_AUDIT.md");
const text = fs.readFileSync(sourcePath, "utf8");
const audit = parseApprovedProductLibraryCsv(text);
const familyMap = buildApprovedFamilySourceMap(audit.usableRows);

const lines = [
  "# Product Library Approved Source Audit",
  "",
  `Source file: \`${sourcePath}\``,
  "",
  "## Counts",
  "",
  `- Total physical rows: ${audit.totalPhysicalRows}`,
  `- Usable item rows: ${audit.usableRows.length}`,
  `- Repeated section/header rows excluded: ${audit.headingRows.length}`,
  `- Blank rows excluded: ${audit.blankRows.length}`,
  `- Section count: ${audit.sectionCount}`,
  `- Rows with quote item codes: ${audit.rowsWithQuoteItemCodes}`,
  `- Rows without usable codes: ${audit.rowsWithoutUsableCodes}`,
  `- Duplicate descriptions: ${audit.duplicateDescriptions.length}`,
  `- Missing rates: ${audit.missingRates.length}`,
  `- Obvious product family rows: ${audit.broadFamilyRows.length}`,
  `- Rows requiring manual review: ${audit.manualReviewRows.length}`,
  "",
  "## Family Coverage",
  "",
  ...Array.from(familyMap.entries()).map(([familyKey, rows]) => `- ${familyKey}: ${rows.length} source row(s)`),
  "",
  "## Duplicate Descriptions",
  "",
  ...(audit.duplicateDescriptions.length
    ? audit.duplicateDescriptions.slice(0, 80).map((item) => `- ${item.description}: rows ${item.sourceRows.join(", ")}`)
    : ["- None"]),
  "",
  "## Missing Rates",
  "",
  ...(audit.missingRates.length
    ? audit.missingRates.slice(0, 120).map((row) => `- Row ${row.sourceRow}: ${row.section} / ${row.category} / ${row.itemDescription}`)
    : ["- None"]),
  "",
  "## Manual Review Rows",
  "",
  ...(audit.manualReviewRows.length
    ? audit.manualReviewRows.slice(0, 160).map((row) => `- Row ${row.sourceRow}: ${row.reason}`)
    : ["- None"]),
  "",
  "## Notes",
  "",
  "- Section heading rows are deliberately excluded from usable products.",
  "- Blank quote codes are not fabricated. Rows without a code receive a separate stable `approvedSourceKey` such as `csv-row-42`.",
  "- Broad quote rows are treated as product families or family source rows, not as actual supplier products.",
  "- Supplier, brand, range, image and price data belongs to each organisation's private catalogue.",
  "",
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({
  sourcePath,
  outPath,
  totalPhysicalRows: audit.totalPhysicalRows,
  usableItemRows: audit.usableRows.length,
  sectionCount: audit.sectionCount,
  rowsWithQuoteItemCodes: audit.rowsWithQuoteItemCodes,
  rowsWithoutUsableCodes: audit.rowsWithoutUsableCodes,
}, null, 2));
