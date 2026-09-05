import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APPLIANCE_REQUIREMENTS, PLUMBING_FIXTURE_REQUIREMENTS } from "../lib/builders/clientSelectionWorkflow.js";
import {
  CABINETRY_BENCHTOPS,
  HANDLE_HOUSE_BASE_CATALOGUE,
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
} from "../lib/builders/cabinetryWorkflow.js";
import { STONE_BENCHTOP_CATALOGUE, STONE_BENCHTOP_SUPPLIERS } from "../lib/builders/stoneBenchtopWorkflow.js";
import {
  ESTIMATING_CATALOGUE_IMPORT_COLUMNS,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  classifyCatalogueRecord,
} from "../lib/construction-estimation/catalogues/masterCatalogueSchemas.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workbookTemplatePath = path.join(repoRoot, "lib", "construction-estimation", "importedExcelWorkbookTemplate.json");
const outputPaths = {
  sourceAudit: path.join(repoRoot, "MASTER_CATALOGUE_SOURCE_AUDIT.md"),
  quotationMapping: path.join(repoRoot, "MASTER_CATALOGUE_QUOTATION_MAPPING.csv"),
  cabinetryMapping: path.join(repoRoot, "CABINETRY_PRODUCT_LIBRARY_MAPPING.md"),
  productTemplate: path.join(repoRoot, "PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv"),
  estimatingTemplate: path.join(repoRoot, "ESTIMATING_CATALOGUE_IMPORT_TEMPLATE.csv"),
};

const productRecords = loadMasterProducts();
const importedWorkbook = JSON.parse(fs.readFileSync(workbookTemplatePath, "utf8"));
const quotationRows = importedQuotationRows(importedWorkbook.quotation);

const productIndex = createProductIndex(productRecords);
const mappingRows = quotationRows.map((row) => classifyQuotationRow(row, productIndex));
const sourceAuditRows = buildSourceAuditRows({ productRecords, quotationRows });
const cabinetryRows = buildCabinetryRows(productRecords);

writeFile(outputPaths.sourceAudit, renderSourceAudit(sourceAuditRows, mappingRows, productRecords));
writeFile(outputPaths.quotationMapping, csv([
  "quotation_row_id",
  "quotation_code",
  "stage_id",
  "category_id",
  "subcategory_id",
  "current_description",
  "proposed_source_type",
  "proposed_source_id",
  "client_selectable",
  "existing_product_library_match",
  "existing_estimating_catalogue_match",
  "match_confidence",
  "duplicate_group",
  "migration_status",
  "notes",
], mappingRows));
writeFile(outputPaths.cabinetryMapping, renderCabinetryMapping(cabinetryRows));
writeFile(outputPaths.productTemplate, csv(PRODUCT_LIBRARY_IMPORT_COLUMNS, [exampleProductRow()]));
writeFile(outputPaths.estimatingTemplate, csv(ESTIMATING_CATALOGUE_IMPORT_COLUMNS, [exampleEstimatingRow()]));

const totals = countBy(mappingRows, "proposed_source_type");
console.log(JSON.stringify({
  quotationRows: mappingRows.length,
  productRecords: productRecords.length,
  cabinetryRecords: cabinetryRows.length,
  totals,
  files: outputPaths,
}, null, 2));

function buildSourceAuditRows({ productRecords, quotationRows }) {
  const familyCounts = countBy(productRecords, "familyKey");
  const rows = [
    row("Product Library", "lib/product-library/catalogueService.js", "getMasterProducts", productRecords.length, "product", "committed JSON catalogues", "Imported by pages/modules/builders/product-library.js and pages/modules/builders/selections-book.js"),
    row("Product Library", "lib/product-library/catalogueModel.js", "PRODUCT_FAMILIES", 36, "taxonomy/product-family", "static JS array", "Imported by Product Library page, Client Selections workflow, and EstimateBuilderWorkbook"),
    row("Product Library", "data/product-library/PRODUCTS-LIBRARY.csv", "buildApprovedClientSelectionsCatalogue", 613, "approved source rows", "CSV", "Product Library import/model tests and approved selections catalogue builder"),
    row("Quotation Builder", "lib/construction-estimation/importedExcelWorkbookTemplate.json", "quotation.sections[].rows", quotationRows.length, "quotation row", "imported Excel JSON template", "Consumed by createEstimateWorksheetV4Defaults() and EstimateBuilderWorkbook Quote Sheet"),
    row("Quotation Builder", "lib/construction-estimation/estimateWorksheetV4Schema.js", "V4_QUOTE_SECTIONS", 18, "quote taxonomy labels", "static JS array", "Estimate worksheet/schema"),
    row("Estimating Catalogue", "components/estimate-builder/EstimateBuilderWorkbook.js", "EstimatingCatalogueSheet", 1, "runtime sheet", "workbook state", "Estimate Builder workbook page"),
    row("Estimating Catalogue", "components/estimate-builder/EstimateBuilderWorkbook.js", "deriveProductLibraryFromQuoteSheet", 1, "derived estimating/product rows", "quotation sheet state", "Estimating Catalogue/Product Library screens"),
    row("Client Selections", "pages/modules/builders/selections-book.js", "queryClientSelectableProducts + getMasterProducts", 1, "consumer selector", "Product Library master records plus embedded fallbacks", "Active route imports catalogueModel/catalogueService and cabinetry/stone workflows"),
    row("Cabinetry", "lib/builders/cabinetryWorkflow.js", "LAMINEX_CABINETRY_CATALOGUE", LAMINEX_CABINETRY_CATALOGUE.length, "product/cabinet-finish", "committed JSON via workflow adapter", "Client Selections Cabinetry"),
    row("Cabinetry", "lib/builders/cabinetryWorkflow.js", "POLYTEC_CABINETRY_CATALOGUE", POLYTEC_CABINETRY_CATALOGUE.length, "product/cabinet-finish", "committed JSON via workflow adapter", "Client Selections Cabinetry"),
    row("Cabinetry", "lib/builders/cabinetryWorkflow.js", "HANDLE_HOUSE_BASE_CATALOGUE", HANDLE_HOUSE_BASE_CATALOGUE.length, "product/handles", "static JS array", "Client Selections Cabinetry"),
    row("Cabinetry", "lib/builders/cabinetryWorkflow.js", "CABINETRY_BENCHTOPS", CABINETRY_BENCHTOPS.length, "product/benchtop placeholder", "static JS array", "Client Selections Cabinetry"),
    row("Benchtops", "lib/builders/stoneBenchtopWorkflow.js", "STONE_BENCHTOP_SUPPLIERS", Object.keys(STONE_BENCHTOP_SUPPLIERS || {}).length, "product/benchtop suppliers", "committed JSON/workflow adapter", "Client Selections Cabinetry/benchtops"),
    row("Benchtops", "lib/builders/stoneBenchtopWorkflow.js", "STONE_BENCHTOP_CATALOGUE", STONE_BENCHTOP_CATALOGUE.length, "product/benchtop surfaces", "committed JS catalogue", "Client Selections stone benchtop workflow"),
    row("Appliances", "lib/builders/clientSelectionWorkflow.js", "APPLIANCE_REQUIREMENTS", APPLIANCE_REQUIREMENTS.length, "selection requirement", "static JS array", "Client Selections Appliances"),
    row("Plumbing Fixtures", "lib/builders/clientSelectionWorkflow.js", "PLUMBING_FIXTURE_REQUIREMENTS", PLUMBING_FIXTURE_REQUIREMENTS.length, "selection requirement", "static JS array", "Client Selections Plumbing Fixtures"),
  ];
  for (const [familyKey, count] of Object.entries(familyCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push(row("Product Library family", "lib/product-library/catalogueService.js", familyKey, count, "product", "committed JSON catalogue aggregation", "Product Library / Client Selections"));
  }
  return rows;
}

function loadMasterProducts() {
  const productSources = [
    ["bricks", "data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json"],
    ["roofing", "data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json"],
    ["roofing", "data/product-library/catalogues/roofing/AU-FASCIA-GUTTER-DOWNPIPE-CATALOGUE.json"],
    ["roofing", "data/product-library/catalogues/roofing/AU-MONIER-ROOF-TILES-CATALOGUE.json"],
    ["roofing", "data/product-library/catalogues/roofing/AU-BRISTILE-ROOF-TILES-CATALOGUE.json"],
    ["exterior", "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json"],
    ["exterior", "data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json"],
    ["kitchen", "data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json"],
  ];
  const products = productSources.flatMap(([, relativePath]) => {
    const catalogue = readJson(relativePath);
    return (catalogue.products || []).map((record) => normalizeAuditProduct(record));
  });
  return products;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function normalizeAuditProduct(record = {}) {
  return {
    ...record,
    id: record.productId || record.id || record.productCode || record.product_code || "",
    productId: record.productId || record.id || record.productCode || record.product_code || "",
    productCode: record.productCode || record.product_code || record.sku || record.id || "",
    productName: record.productName || record.product_name || record.name || "",
    familyKey: record.familyKey || record.family_key || record.productFamilyKey || "",
    brand: record.brand || record.manufacturer || record.supplier || "",
    supplier: record.supplier || record.manufacturer || record.brand || "",
    active: record.active !== false,
    archived: record.archived === true,
    discontinued: record.discontinued === true || record.availabilityStatus === "inactive",
    linkedQuoteItemCode: record.linkedQuoteItemCode || record.quote_structure_row_id || record.approvedSourceKey || "",
  };
}

function classifyQuotationRow(row, productIndex) {
  const description = row.item || row.rawText || "";
  const classification = classifyCatalogueRecord({
    ...row,
    current_description: description,
    formula: Object.keys(row.formulas || {}).length ? row.formulas : null,
  });
  const ids = taxonomyIds(row.sectionLabel, description);
  const productMatch = findProductMatch(row, productIndex);
  const estimatingMatch = "";
  const sourceId = proposedSourceId(row, classification.proposedSourceType, productMatch, ids);
  const confidence = productMatch ? "exact" : classification.proposedSourceType === "unresolved" ? "unresolved" : "rule";
  const duplicateGroup = duplicateKey(row, classification.proposedSourceType, ids);
  return {
    quotation_row_id: row.id || `quote-${row.excelRow || ""}`,
    quotation_code: row.excelRow || "",
    stage_id: ids.stageId,
    category_id: ids.categoryId,
    subcategory_id: ids.subcategoryId,
    current_description: description,
    proposed_source_type: classification.proposedSourceType,
    proposed_source_id: sourceId,
    client_selectable: classification.proposedSourceType === "product" ? "true" : "false",
    existing_product_library_match: productMatch || "",
    existing_estimating_catalogue_match: estimatingMatch,
    match_confidence: confidence,
    duplicate_group: duplicateGroup,
    migration_status: migrationStatus(classification.proposedSourceType, productMatch),
    notes: classification.notes,
  };
}

function createProductIndex(products) {
  const byCode = new Map();
  const byQuoteCode = new Map();
  const byName = new Map();
  for (const product of products) {
    const code = normalize(product.productCode || product.product_code || product.sku);
    if (code) byCode.set(code, product);
    const quoteCode = normalize(product.linkedQuoteItemCode || product.quote_structure_row_id || product.approvedSourceKey);
    if (quoteCode) byQuoteCode.set(quoteCode, product);
    const name = normalize(`${product.familyKey || ""}:${product.productName || product.product_name || ""}`);
    if (name) byName.set(name, product);
  }
  return { byCode, byQuoteCode, byName };
}

function findProductMatch(row, index) {
  const quoteCode = normalize(row.linkedQuoteItemCode || row.quote_structure_row_id || `approved-family:${familyFromText(row.item || "")}`);
  const quoteMatch = quoteCode ? index.byQuoteCode.get(quoteCode) : null;
  if (quoteMatch) return quoteMatch.productCode || quoteMatch.id || "";
  const code = normalize(row.item);
  const codeMatch = code ? index.byCode.get(code) : null;
  if (codeMatch) return codeMatch.productCode || codeMatch.id || "";
  return "";
}

function taxonomyIds(section, item) {
  const haystack = `${section} ${item}`.toLowerCase();
  const stageId = stageFor(haystack);
  const categoryId = categoryFor(haystack, section);
  const subcategoryId = subcategoryFor(haystack, item || section);
  return { stageId, categoryId, subcategoryId };
}

function stageFor(text) {
  if (/site|earth|demo|slab|concrete|foundation/.test(text)) return "stage:base";
  if (/frame|truss|roof frame/.test(text)) return "stage:frame";
  if (/roof|window|door|cladding|brick|lock/.test(text)) return "stage:lock-up";
  if (/kitchen|appliance|bath|fixture|cabinet|paint|floor|tile|lining|plumb|electrical/.test(text)) return "stage:fix-out";
  if (/external|driveway|landscape|fence|deck|pool/.test(text)) return "stage:external";
  if (/prelim|fee|cert|approval|supervision/.test(text)) return "stage:preliminaries";
  return "stage:unassigned";
}

function categoryFor(text, fallback) {
  if (/appliance|oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerator/.test(text)) return "category:appliances";
  if (/cabinet|joinery|handle/.test(text)) return "category:cabinetry";
  if (/benchtop|stone/.test(text)) return "category:benchtops";
  if (/sink|tap|mixer|toilet|basin|bath|shower|plumb/.test(text)) return "category:plumbing-fixtures";
  if (/light|electrical|electrician|power/.test(text)) return "category:electrical";
  if (/paint/.test(text)) return "category:painting";
  if (/tile|floor/.test(text)) return "category:flooring-tiling";
  if (/window|door|garage/.test(text)) return "category:windows-doors";
  if (/roof|gutter|fascia|downpipe/.test(text)) return "category:roofing";
  if (/brick|cladding|render/.test(text)) return "category:external-cladding";
  if (/driveway|landscape|deck|pool|retaining/.test(text)) return "category:external-works";
  if (/slab|concrete/.test(text)) return "category:slab";
  if (/frame|truss/.test(text)) return "category:frame";
  if (/site|prelim|cert|approval|fee|supervision/.test(text)) return "category:preliminaries";
  return `category:${slug(fallback || "unassigned")}`;
}

function subcategoryFor(text, fallback) {
  const pairs = [
    ["ovens", /oven/],
    ["cooktops", /cooktop|hot plate|induction/],
    ["rangehoods", /rangehood|range hood/],
    ["dishwashers", /dishwasher/],
    ["microwaves", /microwave/],
    ["refrigerators", /fridge|refrigerator/],
    ["handles", /handle/],
    ["cabinet-finishes", /cabinet.*finish|laminex|polytec/],
    ["stone-surfaces", /stone|benchtop/],
    ["tapware", /tap|mixer/],
    ["toilets", /toilet/],
    ["basins", /basin/],
    ["baths", /bath/],
    ["showers", /shower/],
    ["light-fittings", /light|pendant/],
    ["labour", /labour|carpenter|plumber|electrician|painter|tiler/],
    ["plant-hire", /hire|excavator|bobcat|crane/],
    ["statutory-fees", /cert|approval|permit|fee/],
  ];
  const found = pairs.find(([, pattern]) => pattern.test(text));
  return `subcategory:${found ? found[0] : slug(fallback || "unassigned")}`;
}

function proposedSourceId(row, sourceType, productMatch, ids) {
  if (productMatch) return productMatch;
  const base = slug(row.item || row.sectionLabel || row.id || "row");
  if (sourceType === "product") return `product:${ids.subcategoryId.replace("subcategory:", "")}:${base}`;
  if (sourceType === "estimating-item") return `estimating:${ids.subcategoryId.replace("subcategory:", "")}:${base}`;
  if (sourceType === "assembly") return `assembly:${ids.subcategoryId.replace("subcategory:", "")}:${base}`;
  return "";
}

function migrationStatus(sourceType, productMatch) {
  if (["heading", "formula"].includes(sourceType)) return "not-a-catalogue-record";
  if (sourceType === "unresolved") return "requires-review";
  if (productMatch) return "existing-product-library-match";
  if (sourceType === "product") return "missing-product-library-candidate";
  if (sourceType === "estimating-item") return "missing-estimating-catalogue-candidate";
  if (sourceType === "assembly") return "requires-assembly-model";
  return "requires-review";
}

function duplicateKey(row, sourceType, ids) {
  if (["heading", "formula", "unresolved"].includes(sourceType)) return "";
  return `${sourceType}:${ids.categoryId}:${ids.subcategoryId}:${normalize(row.item || "")}`;
}

function buildCabinetryRows(masterProducts) {
  const byCode = new Set(masterProducts.map((product) => normalize(product.productCode || product.id)));
  const rows = [];
  for (const record of LAMINEX_CABINETRY_CATALOGUE) {
    rows.push(cabinetryRow("lib/builders/cabinetryWorkflow.js:LAMINEX_CABINETRY_CATALOGUE", record.id || record.productCode, productId("laminex", record), "cabinet-finish", byCode, "Medium"));
  }
  for (const record of POLYTEC_CABINETRY_CATALOGUE) {
    rows.push(cabinetryRow("lib/builders/cabinetryWorkflow.js:POLYTEC_CABINETRY_CATALOGUE", record.id || record.productCode, productId("polytec", record), "cabinet-finish", byCode, "Medium"));
  }
  for (const record of HANDLE_HOUSE_BASE_CATALOGUE) {
    rows.push(cabinetryRow("lib/builders/cabinetryWorkflow.js:HANDLE_HOUSE_BASE_CATALOGUE", record.id || record.productCode || record.productName, productId("handle-house", record), "handles", byCode, "High"));
  }
  for (const record of CABINETRY_BENCHTOPS) {
    rows.push(cabinetryRow("lib/builders/cabinetryWorkflow.js:CABINETRY_BENCHTOPS", record.id || record.productCode || record.name || record.range, productId("cabinetry-benchtop", record), "stone-benchtops", byCode, "High"));
  }
  return rows;
}

function cabinetryRow(source, currentId, proposedId, family, byCode, risk) {
  const currentKey = normalize(currentId);
  return {
    source,
    currentId: currentId || "",
    proposedId,
    family,
    usedBySavedSelections: "unknown-read-only-audit",
    migrationRisk: risk,
    existingMasterMatch: byCode.has(currentKey) ? "yes" : "no",
    identifierRisk: currentId ? "stable-current-id-or-code" : "temporary/generated-id-risk",
  };
}

function productId(prefix, record) {
  return `product:${prefix}:${slug(record.productCode || record.id || record.productName || record.name || record.colourName || record.range || "unmapped")}`;
}

function renderSourceAudit(rows, mappings, products) {
  const totals = countBy(mappings, "proposed_source_type");
  const migrationTotals = countBy(mappings, "migration_status");
  const applianceCounts = applianceBrandCounts(products);
  const duplicateGroups = duplicateGroupRows(mappings);
  return `# Master Catalogue Source Audit

Date: 2026-09-02

This is a generated read-only inventory. It does not migrate live data, change saved-job schemas, or alter Client Selections rendering.

## Active Data Sources

${markdownTable(["Module", "Active file", "Export/symbol", "Record count", "Record type", "Storage source", "Runtime consumer"], rows)}

## Quotation Classification Totals

${markdownTable(["Classification", "Rows"], Object.entries(totals).map(([key, value]) => ({ Classification: key, Rows: value })))}

## Migration Status Totals

${markdownTable(["Status", "Rows"], Object.entries(migrationTotals).map(([key, value]) => ({ Status: key, Rows: value })))}

## Duplicate Groups

Duplicate group count: ${duplicateGroups.length}

${markdownTable(["Duplicate group", "Rows"], duplicateGroups.slice(0, 40).map((item) => ({ "Duplicate group": item.key, Rows: item.count })))}

## Appliance Model Counts By Family And Brand

${markdownTable(["Family", "Brand", "Selectable models"], applianceCounts)}

## Runtime Import Evidence

| Area | Runtime evidence |
| --- | --- |
| Product Library | \`pages/modules/builders/product-library.js\` imports \`PRODUCT_FAMILIES\`, \`queryClientSelectableProducts\`, and \`getMasterProducts\`; \`lib/product-library/catalogueService.js\` rebuilds master records from committed JSON catalogues. |
| Estimating Catalogue | \`components/estimate-builder/EstimateBuilderWorkbook.js\` renders \`EstimatingCatalogueSheet\` and derives current QS/rate rows from the quote sheet via \`deriveProductLibraryFromQuoteSheet\`. |
| Quotation Builder | \`lib/construction-estimation/estimateWorksheetV4Defaults.js\` consumes \`importedExcelWorkbookTemplate.json\` and builds active quote sections/rows. |
| Client Selections | \`pages/modules/builders/selections-book.js\` imports Product Library, appliance/plumbing requirements, cabinetry workflow catalogues, stone benchtop workflow, and reads/writes selection snapshots. |
| Cabinetry | \`pages/modules/builders/selections-book.js\` imports \`LAMINEX_CABINETRY_CATALOGUE\`, \`POLYTEC_CABINETRY_CATALOGUE\`, \`HANDLE_HOUSE_BASE_CATALOGUE\`, and \`CABINETRY_BENCHTOPS\` from \`lib/builders/cabinetryWorkflow.js\`. |
| Appliances | Appliance requirements live in \`lib/builders/clientSelectionWorkflow.js\`; actual models currently resolve from \`getMasterProducts()\` using appliance family keys. |
| Plumbing fixtures | Plumbing fixture requirements live in \`lib/builders/clientSelectionWorkflow.js\`; selectable fixture records are Product Library candidates, not estimating catalogue rows. |
| Benchtops | Cabinetry workflow uses placeholder benchtop choices; stone surface suppliers are exposed through \`lib/builders/stoneBenchtopWorkflow.js\` and master products are in the benchtop JSON catalogue. |
| Handles | Current Handle House handle records are embedded in \`lib/builders/cabinetryWorkflow.js\` and consumed by the active Client Selections route. |

## Duplicated Embedded Data

| Module | Duplicate/embedded source | Notes |
| --- | --- | --- |
| Client Selections | \`pages/modules/builders/selections-book.js\` static arrays | Entry door furniture, product option library, wet-area cabinetry config, window defaults, and image URL fallbacks remain embedded. |
| Product Library | \`lib/product-library/catalogueModel.js\` family taxonomy | Active taxonomy owner, but some family labels still need canonical category IDs rather than display names. |
| Quotation Builder | Imported Excel workbook template | Complete quote row list; should remain taxonomy source until stable IDs are formalized. |
| Estimating Catalogue | Workbook-derived QS/rate rows | Needs explicit estimating item master records before migration. |

## Source Safety Notes

- Product Library master records are currently rebuilt from committed JSON catalogues through \`getMasterProducts()\`.
- Quotation Builder rows are currently generated from \`importedExcelWorkbookTemplate.json\` by \`createEstimateWorksheetV4Defaults()\`.
- Client Selections active route is still \`pages/modules/builders/selections-book.js\`, but it was not modified by this generated audit.
- Existing archived or discontinued product records should remain resolvable for saved-job snapshots.
- Quotation rows should carry \`sourceType/sourceId/sourceVersion\` plus frozen description, image, unit, cost, sell price, GST treatment, and selected options.
`;
}

function renderCabinetryMapping(rows) {
  const totals = countBy(rows, "family");
  return `# Cabinetry Product Library Mapping

Date: 2026-09-02

Read-only mapping of the approved Cabinetry workflow catalogue records to proposed Product Library stable IDs. No Cabinetry UI, persistence, or source catalogue data was moved.

## Totals

${markdownTable(["Family", "Records"], Object.entries(totals).map(([key, value]) => ({ Family: key, Records: value })))}

## Mapping

${markdownTable(["Current source", "Current ID", "Proposed Product ID", "Family", "Used by saved selections", "Migration risk", "Existing master match", "Identifier risk"], rows.map((item) => ({
    "Current source": item.source,
    "Current ID": item.currentId,
    "Proposed Product ID": item.proposedId,
    Family: item.family,
    "Used by saved selections": item.usedBySavedSelections,
    "Migration risk": item.migrationRisk,
    "Existing master match": item.existingMasterMatch,
    "Identifier risk": item.identifierRisk,
  })))}

## Saved Selection Identity Risks

| Risk | Finding |
| --- | --- |
| Array index | Current workflow tests and code still reference catalogue array positions for fixtures such as \`POLYTEC_CABINETRY_CATALOGUE[0]\`; saved selections should be checked for position-derived fallback IDs before migration. |
| Display name | Cabinetry colour/finish and handle selections display supplier, range, colour, finish and product name fields; migration must preserve display-name aliases. |
| Supplier/name combination | Current saved rows record supplier/name combinations in several snapshot fields; supplier plus current ID/product code should be the matching key where available. |
| Image path | Existing swatch/product image paths are used in saved schedules; quotation and selection snapshots should freeze those image paths. |
| Temporary/generated ID | Records without explicit current IDs are marked with temporary/generated ID risk; active selection normalization also has fallback IDs built from requirement plus name/index. |
`;
}

function importedQuotationRows(sheet = {}) {
  const columns = sheet.columns || [];
  return (sheet.sections || [])
    .filter((section) => !isRemovedQuoteSection(section.label))
    .flatMap((section, sectionIndex) => (section.rows || [])
      .filter((rowItem) => !isRemovedQuoteSection(rowItem.section))
      .map((rowItem) => importedQuoteRow(rowItem, columns, section.label, sectionIndex)));
}

function importedQuoteRow(rowItem, columns, sectionLabel, sectionIndex) {
  const blankInputs = isBlankInputQuoteSection(rowItem.section);
  const blankQty = isBlankQtyQuoteSection(rowItem.section);
  const excelRate = valueFor(rowItem, columns, "RATE");
  return {
    id: `quote-${rowItem.sourceRow}`,
    excelRow: rowItem.sourceRow,
    sectionKey: `${sectionLabel || "Ungrouped"}${sectionIndex ? ` (${sectionIndex + 1})` : ""}`,
    sectionLabel: rowItem.section || sectionLabel || "Ungrouped",
    section: rowItem.section,
    values: rowItem.values || [],
    formulas: rowItem.formulas || {},
    item: valueFor(rowItem, columns, "ITEM"),
    quantity: blankInputs || blankQty ? "" : valueFor(rowItem, columns, "QTY"),
    unit: valueFor(rowItem, columns, "UNIT"),
    excelRate,
    importedCost: blankInputs ? "" : valueFor(rowItem, columns, "COST"),
    rawText: (rowItem.values || []).filter(Boolean).join(" | "),
    notes: rowItem.notes || "",
  };
}

function valueFor(rowItem, columns, label) {
  const index = columns.findIndex((column) => String(column?.label ?? column ?? "").trim().toUpperCase() === label);
  return index >= 0 ? rowItem.values?.[index] || "" : "";
}

function isRemovedQuoteSection(section) {
  return new Set(["upper level framing"]).has(normalizeQuoteSectionName(section));
}

function isBlankInputQuoteSection(section) {
  return new Set(["roof framing"]).has(normalizeQuoteSectionName(section));
}

function isBlankQtyQuoteSection(section) {
  const name = normalizeQuoteSectionName(section);
  return new Set(["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials"]).has(name) || name.startsWith("roof cover");
}

function normalizeQuoteSectionName(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applianceBrandCounts(products) {
  const applianceFamilies = new Set(["ovens", "cooktops", "rangehoods", "dishwashers", "microwaves", "fridges"]);
  const grouped = new Map();
  for (const product of products) {
    if (!applianceFamilies.has(product.familyKey)) continue;
    if (product.active === false || product.archived === true || product.discontinued === true) continue;
    const key = `${product.familyKey}|${product.brand || product.manufacturer || product.supplier || "Unassigned"}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return Array.from(grouped.entries()).map(([key, count]) => {
    const [Family, Brand] = key.split("|");
    return { Family, Brand, "Selectable models": count };
  }).sort((left, right) => `${left.Family}:${left.Brand}`.localeCompare(`${right.Family}:${right.Brand}`));
}

function exampleProductRow() {
  return {
    category_id: "category:appliances",
    subcategory_id: "subcategory:ovens",
    family_id: "family:built-in-ovens",
    supplier: "Winning Appliances",
    brand: "Westinghouse",
    range: "600mm Built-in Ovens",
    product_code: "WVEP615SC",
    name: "Westinghouse 60cm Multifunction Oven",
    description: "Example physical selectable product.",
    unit: "EACH",
    cost_price: "650.00",
    sell_price: "895.00",
    gst_treatment: "GST inclusive",
    colours: "Stainless steel",
    finishes: "Stainless steel",
    sizes: "60cm",
    specifications: "electric; multifunction",
    warranty: "Supplier warranty",
    image_url: "/images/product-library/example-oven.jpg",
    source_url: "https://supplier.example/products/WVEP615SC",
    client_selectable: "true",
    applicable_rooms: "kitchen",
    active: "true",
  };
}

function exampleEstimatingRow() {
  return {
    category_id: "category:electrical",
    subcategory_id: "subcategory:labour",
    resource_type: "labour",
    trade: "electrician",
    code: "ELEC-LABOUR-HR",
    name: "Electrician labour",
    description: "Example non-client-selectable estimating rate.",
    unit: "HOUR",
    cost_rate: "95.00",
    sell_rate: "125.00",
    gst_treatment: "GST exclusive",
    default_markup: "20",
    supplier_or_subcontractor: "Preferred electrical subcontractor",
    region: "QLD",
    effective_from: "2026-09-02",
    active: "true",
  };
}

function row(Module, ActiveFile, ExportSymbol, RecordCount, RecordType, StorageSource, RuntimeConsumer) {
  return {
    Module,
    "Active file": ActiveFile,
    "Export/symbol": ExportSymbol,
    "Record count": RecordCount,
    "Record type": RecordType,
    "Storage source": StorageSource,
    "Runtime consumer": RuntimeConsumer,
  };
}

function markdownTable(headers, rows) {
  const values = rows.map((item) => headers.map((header) => String(item[header] ?? "")));
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...values.map((line) => `| ${line.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

function markdownCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function csv(headers, rows) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function duplicateGroupRows(rows) {
  return Object.entries(countBy(rows.filter((row) => row.duplicate_group), "duplicate_group"))
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function familyFromText(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("oven")) return "ovens";
  if (text.includes("cooktop")) return "cooktops";
  if (text.includes("rangehood") || text.includes("range hood")) return "rangehoods";
  if (text.includes("dishwasher")) return "dishwashers";
  if (text.includes("microwave")) return "microwaves";
  if (text.includes("fridge") || text.includes("refrigerator")) return "fridges";
  if (text.includes("handle")) return "handles";
  if (text.includes("benchtop") || text.includes("stone")) return "stone-benchtops";
  if (text.includes("sink")) return "kitchen-sinks";
  if (text.includes("mixer") || text.includes("tap")) return "kitchen-sink-mixers";
  return "";
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function normalize(value) {
  return slug(value);
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
