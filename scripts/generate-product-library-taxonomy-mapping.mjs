import fs from "node:fs";
import path from "node:path";
import {
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS,
  resolveProductLibrarySectionForQuotationRow,
} from "../lib/product-library/productLibraryTaxonomy.js";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "MASTER_CATALOGUE_RECONCILED_MAPPING.csv");
const CSV_OUT = path.join(ROOT, "PRODUCT_LIBRARY_QUOTATION_PRODUCT_MAPPING.csv");
const REPORT_OUT = path.join(ROOT, "PRODUCT_LIBRARY_TAXONOMY_CORRECTION_REPORT.md");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function toRecords(text) {
  const [headers = [], ...rows] = parseCsv(text);
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
}

const records = toRecords(fs.readFileSync(SOURCE, "utf8"));
const productRows = records.filter((row) => row.proposed_source_type === "product");
const outputRows = [[
  "quotation_row_id",
  "quotation_code",
  "classification",
  "current_description",
  "unit",
  "category_id",
  "subcategory_id",
  "product_library_section",
  "product_library_section_name",
  "proposed_source_id",
  "existing_product_library_match",
  "recommended_action",
  "notes",
]];

const sectionByKey = new Map(PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => [section.key, section]));
const counts = new Map(PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => [section.key, 0]));
let existingMatches = 0;

for (const row of productRows) {
  const sectionKey = resolveProductLibrarySectionForQuotationRow(row);
  const section = sectionByKey.get(sectionKey);
  if (!section) throw new Error(`No Product Library section resolved for ${row.quotation_row_id}`);
  counts.set(section.key, (counts.get(section.key) || 0) + 1);
  if (row.existing_product_library_match) existingMatches += 1;
  outputRows.push([
    row.quotation_row_id,
    row.quotation_code,
    row.proposed_source_type,
    row.current_description,
    row.unit,
    row.category_id,
    row.subcategory_id,
    section.key,
    section.displayName,
    row.proposed_source_id,
    row.existing_product_library_match,
    row.existing_product_library_match ? "review existing Product Library link" : "review import candidate before creation",
    row.notes || "",
  ]);
}

writeCsv(CSV_OUT, outputRows);

const report = [
  "# Product Library Taxonomy Correction Report",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "",
  "This report maps only Stage 3A rows classified as `product` into the Product Library canonical product taxonomy. Product Library browsing is room-first by default, while Browse All Products keeps the physical-product catalogue sections for administration. Labour, formulas, headings, preliminaries, allowances and assemblies remain excluded from Product Library creation.",
  "",
  "## Top-Level Product Library Sections",
  "",
  "| Section | Mapped Quotation Product Rows |",
  "| --- | ---: |",
  ...PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => `| ${section.displayName} | ${counts.get(section.key) || 0} |`),
  "",
  "## Match Status",
  "",
  `- Audited quotation rows: ${records.length}`,
  `- Product-classified rows mapped here: ${productRows.length}`,
  `- Confirmed existing Product Library matches: ${existingMatches}`,
  `- Product Library import candidates requiring review: ${productRows.length - existingMatches}`,
  "",
  "## Correction Notes",
  "",
  "- Product Library default navigation is room-first; Browse All Products retains physical-product sections for catalogue administration.",
  "- Appliances are a top-level Product Library section and are not buried under Kitchen.",
  "- Plumbing Fixtures & Fittings and Fix Out are visible top-level sections even when no live products have been approved.",
  "- This stage creates reconciliation files only; it does not create, delete, merge, price-change or migrate live catalogue records.",
  "",
].join("\n");

fs.writeFileSync(REPORT_OUT, report);

console.log(JSON.stringify({
  source: path.relative(ROOT, SOURCE),
  csv: path.relative(ROOT, CSV_OUT),
  report: path.relative(ROOT, REPORT_OUT),
  productRows: productRows.length,
  existingMatches,
  counts: Object.fromEntries(counts),
}, null, 2));
