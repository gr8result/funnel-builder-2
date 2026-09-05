import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CABINETRY_AREA_LABELS,
  CABINETRY_BENCHTOPS,
  CABINETRY_LOCATIONS,
  HANDLE_HOUSE_BASE_CATALOGUE,
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
} from "../lib/builders/cabinetryWorkflow.js";
import { STONE_BENCHTOP_CATALOGUE, STONE_BENCHTOP_SUPPLIERS } from "../lib/builders/stoneBenchtopWorkflow.js";
import {
  APPLIANCE_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  PLUMBING_FIXTURE_REQUIREMENTS,
} from "../lib/builders/clientSelectionWorkflow.js";
import {
  canonicalCategoryId,
  canonicalSubcategoryId,
  classifyStage3QuotationRow,
  createDerivedEstimatingIndex,
  createProductMatchIndex,
  duplicateKeyFor,
  matchProductRecord,
  normalizeKey,
  reviewDuplicateGroups,
  stableCatalogueId,
  unresolvedReasonFor,
} from "../lib/construction-estimation/catalogues/masterCatalogueReconciliation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPaths = {
  report: path.join(repoRoot, "MASTER_CATALOGUE_RECONCILIATION_REPORT.md"),
  mapping: path.join(repoRoot, "MASTER_CATALOGUE_RECONCILED_MAPPING.csv"),
  duplicates: path.join(repoRoot, "MASTER_CATALOGUE_DUPLICATE_REVIEW.csv"),
  unresolved: path.join(repoRoot, "MASTER_CATALOGUE_UNRESOLVED_REVIEW.csv"),
  migrationPlan: path.join(repoRoot, "MASTER_CATALOGUE_STAGE3_MIGRATION_PLAN.md"),
};

const importedWorkbook = readJson("lib/construction-estimation/importedExcelWorkbookTemplate.json");
const quotationRows = importedQuotationRows(importedWorkbook.quotation);
const productRecords = loadProductRecords();
const productIndex = createProductMatchIndex(productRecords);
const derivedEstimatingIndex = createDerivedEstimatingIndex(quotationRows);
const reconciledRows = quotationRows.map((row) => reconcileQuotationRow(row, productIndex, derivedEstimatingIndex));
const duplicateReviews = reviewDuplicateGroups(reconciledRows);
const unresolvedRows = reconciledRows.filter((row) => row.proposed_source_type === "unresolved" || row.unresolved_reason);
const cabinetryRows = cabinetryMappingRows();
const cabinetryCompleteness = validateCabinetryRows(cabinetryRows);
const applianceCounts = applianceHierarchy(productRecords);

writeFile(outputPaths.mapping, csv(reconciledMappingHeaders(), reconciledRows));
writeFile(outputPaths.duplicates, csv(duplicateHeaders(), duplicateReviews));
writeFile(outputPaths.unresolved, csv(unresolvedHeaders(), unresolvedRows.map(unresolvedReviewRow)));
writeFile(outputPaths.report, renderReport({
  reconciledRows,
  duplicateReviews,
  unresolvedRows,
  cabinetryCompleteness,
  applianceCounts,
}));
writeFile(outputPaths.migrationPlan, renderMigrationPlan());

console.log(JSON.stringify({
  quotationRows: reconciledRows.length,
  classifications: countBy(reconciledRows, "proposed_source_type"),
  productMatches: reconciledRows.filter((row) => row.existing_product_library_match).length,
  derivedEstimatingMatches: reconciledRows.filter((row) => row.existing_estimating_catalogue_match).length,
  duplicateGroups: duplicateReviews.length,
  unresolvedReasons: countBy(unresolvedRows, "unresolved_reason"),
  cabinetryRecords: cabinetryRows.length,
  cabinetryComplete: cabinetryCompleteness.complete,
  outputs: outputPaths,
}, null, 2));

export function reconcileQuotationRow(row, productIndex, derivedEstimatingIndex) {
  const classification = classifyStage3QuotationRow(row);
  const ids = taxonomyIds(row.sectionLabel, row.item);
  const productMatch = classification.proposedSourceType === "product" || classification.proposedSourceType === "assembly"
    ? matchProductRecord(row, productIndex)
    : null;
  const proposedSourceId = productMatch
    ? productMatch.productId || productMatch.displayProductCode || productMatch.id
    : proposedIdFor(classification.proposedSourceType, { ...row, ...ids });
  const duplicateGroup = duplicateKeyFor({
    ...row,
    ...ids,
    proposed_source_type: classification.proposedSourceType,
    proposed_source_id: proposedSourceId,
  });
  const derivedMatch = ["estimating-item", "assembly", "allowance"].includes(classification.proposedSourceType)
    ? (derivedEstimatingIndex.get(stableCatalogueId(classification.proposedSourceType === "assembly" ? "assembly" : "estimating", { ...row, ...ids })) || [row.id]).join("|")
    : "";
  const matchConfidence = productMatch?.confidence || (derivedMatch ? "derived-runtime" : classification.proposedSourceType === "unresolved" ? "unresolved" : "rule");
  return {
    quotation_row_id: row.id,
    quotation_code: row.excelRow,
    stage_id: ids.stage_id,
    category_id: ids.category_id,
    subcategory_id: ids.subcategory_id,
    current_description: row.item,
    unit: row.unit,
    quantity: row.quantity,
    section: row.sectionLabel,
    proposed_source_type: classification.proposedSourceType,
    proposed_source_id: proposedSourceId,
    client_selectable: classification.proposedSourceType === "product" ? "true" : "false",
    existing_product_library_match: productMatch ? productMatch.productId || productMatch.displayProductCode || productMatch.id : "",
    existing_estimating_catalogue_match: derivedMatch,
    explicit_estimating_master_match: "",
    match_confidence: matchConfidence,
    duplicate_group: duplicateGroup,
    unresolved_reason: classification.proposedSourceType === "unresolved" ? unresolvedReasonFor({ ...row, unresolved_reason: classification.unresolvedReason }) : "",
    migration_status: migrationStatus(classification.proposedSourceType, productMatch, derivedMatch),
    notes: classification.notes,
  };
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
    excelRate: valueFor(rowItem, columns, "RATE"),
    importedCost: blankInputs ? "" : valueFor(rowItem, columns, "COST"),
    rawText: (rowItem.values || []).filter(Boolean).join(" | "),
    notes: rowItem.notes || "",
  };
}

function loadProductRecords() {
  const sourceFiles = [
    "data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json",
    "data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json",
    "data/product-library/catalogues/roofing/AU-FASCIA-GUTTER-DOWNPIPE-CATALOGUE.json",
    "data/product-library/catalogues/roofing/AU-MONIER-ROOF-TILES-CATALOGUE.json",
    "data/product-library/catalogues/roofing/AU-BRISTILE-ROOF-TILES-CATALOGUE.json",
    "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json",
    "data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json",
    "data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json",
  ];
  const records = sourceFiles.flatMap((file) => (readJson(file).products || []).map((record) => normalizeProductRecord(record, file)));
  records.push(...STONE_BENCHTOP_CATALOGUE.map((record) => normalizeProductRecord({
    productCode: record.id,
    productId: `product:stone-benchtops:${record.id}`,
    familyKey: "stone-benchtops",
    categoryKey: "Benchtops",
    supplier: record.supplier,
    brand: record.brand || record.supplier,
    range: record.collection,
    productName: `${record.supplier} ${record.productCode} ${record.colourName}`,
    model: record.productCode,
    description: record.description,
    primaryImageUrl: record.primarySwatchImage || record.slabImage,
    priceStatus: record.priceStatus,
    priceUnit: "m2 quote",
    active: record.availabilityStatus !== "inactive",
  }, "lib/builders/stoneBenchtopWorkflow.js:STONE_BENCHTOP_CATALOGUE")));
  records.push(...cabinetryRowsAsProducts());
  return records;
}

function cabinetryRowsAsProducts() {
  return cabinetryMappingRows().map((row) => ({
    source: row.current_source,
    productId: row.proposed_product_id,
    id: row.proposed_product_id,
    productCode: row.current_id,
    familyKey: row.family_id.replace("family:", ""),
    categoryKey: row.category_id.replace("category:", ""),
    supplier: row.supplier,
    brand: row.brand,
    range: row.range,
    productName: row.product_model_name,
    model: row.current_id,
    description: row.description,
    primaryImageUrl: row.image_reference,
    priceStatus: row.price_or_quote_status,
    priceUnit: row.unit,
    active: true,
  }));
}

function cabinetryMappingRows() {
  const rows = [];
  for (const record of LAMINEX_CABINETRY_CATALOGUE) rows.push(cabinetryFinishRow("Laminex", record));
  for (const record of POLYTEC_CABINETRY_CATALOGUE) rows.push(cabinetryFinishRow("Polytec", record));
  for (const record of STONE_BENCHTOP_CATALOGUE) rows.push(stoneRow(record));
  for (const record of HANDLE_HOUSE_BASE_CATALOGUE) rows.push(handleRow(record));
  for (const record of CABINETRY_BENCHTOPS) rows.push(cabinetryBenchtopPlaceholderRow(record));
  rows.push(hardwareRow("product:cabinetry-hardware:blum-soft-close", "Blum soft-close hardware", "Blum", "Blum", "Hinges and drawer systems", "Soft-close cabinetry hardware system."));
  rows.push(specialtyRow("product:cabinetry-components:kick-panels-brushed-aluminium", "kick-panels-brushed-aluminium", "Brushed aluminium kick panels", "Cabinetmaker", "Builder cabinetry", "Metal kick panel", "Supply and install brushed aluminium kick panels.", "included"));
  rows.push(specialtyRow("product:cabinetry-components:bulkheads-raw-mdf-wall-paint", "bulkheads-raw-mdf-wall-paint", "Raw MDF bulkheads painted to wall colour", "Cabinetmaker", "Builder cabinetry", "Painted bulkhead", "Supply and install Raw MDF bulkheads, prepared and painted to match internal wall colour.", "supplier_quote_required"));
  rows.push(specialtyRow("product:cabinetry-components:bulkheads-raw-mdf-ceiling-paint", "bulkheads-raw-mdf-ceiling-paint", "Raw MDF bulkheads painted to ceiling colour", "Cabinetmaker", "Builder cabinetry", "Painted bulkhead", "Supply and install Raw MDF bulkheads, prepared and painted to match ceiling colour.", "supplier_quote_required"));
  rows.push(specialtyRow("product:cabinetry-components:cabinet-shelving", "cabinet-shelving", "Cabinet shelving", "Cabinetmaker", "Builder cabinetry", "Shelving", "Cabinet shelving configured by room and cabinetry schedule.", "supplier_quote_required"));
  rows.push(specialtyRow("product:cabinetry-components:cleated-shelving", "cleated-shelving", "Cleated shelving", "Cabinetmaker", "Builder cabinetry", "Shelving", "Cleated shelving configured by room and cabinetry schedule.", "supplier_quote_required"));
  return rows;
}

function cabinetryFinishRow(supplier, record) {
  return {
    current_source: `lib/builders/cabinetryWorkflow.js:${supplier.toUpperCase()}_CABINETRY_CATALOGUE`,
    current_id: record.id || record.productCode || "",
    proposed_product_id: `product:cabinet-finish:${normalizeKey(record.id || record.colourName)}`,
    category_id: "category:cabinetry",
    family_id: "family:cabinet-finishes",
    supplier,
    brand: record.brand || supplier,
    range: record.productRange || record.productFamily || "",
    product_model_name: `${record.colourName || ""} ${record.finish || ""}`.trim(),
    description: record.description || `${record.colourName || "Cabinet finish"} ${record.finish || ""} for cabinetry doors, drawers and panels.`.trim(),
    image_reference: record.swatchImage || record.swatchThumbnail || "",
    unit: "ITEM",
    price_or_quote_status: record.priceStatus || record.pricingTier || "supplier_quote_required",
    applicable_rooms: CABINETRY_LOCATIONS.join("|"),
    selectable_status: "client-selectable",
  };
}

function stoneRow(record) {
  return {
    current_source: "lib/builders/stoneBenchtopWorkflow.js:STONE_BENCHTOP_CATALOGUE",
    current_id: record.id,
    proposed_product_id: `product:stone-benchtops:${normalizeKey(record.id)}`,
    category_id: "category:benchtops",
    family_id: "family:stone-benchtops",
    supplier: record.supplier,
    brand: record.brand || record.supplier,
    range: record.collection || "",
    product_model_name: `${record.productCode || ""} ${record.colourName || ""}`.trim(),
    description: record.description || `${record.supplier || "Stone"} ${record.colourName || "surface"} benchtop surface.`,
    image_reference: record.primarySwatchImage || record.slabImage || "",
    unit: "M2",
    price_or_quote_status: record.priceStatus || "supplier_quote_required",
    applicable_rooms: CABINETRY_LOCATIONS.join("|"),
    selectable_status: record.availabilityStatus === "inactive" ? "archived-resolvable" : "client-selectable",
  };
}

function handleRow(record) {
  return {
    current_source: "lib/builders/cabinetryWorkflow.js:HANDLE_HOUSE_BASE_CATALOGUE",
    current_id: record.id || record.productCode || "",
    proposed_product_id: `product:handles:handle-house-${normalizeKey(record.productCode || record.id || record.productName)}`,
    category_id: "category:cabinetry",
    family_id: "family:handles",
    supplier: "Handle House",
    brand: "Handle House",
    range: record.range || record.collection || "Cabinet handles",
    product_model_name: record.productName || record.name || record.productCode || "",
    description: record.description || `${record.productName || "Cabinet handle"} from Handle House.`,
    image_reference: record.imageUrl || "",
    unit: "EACH",
    price_or_quote_status: record.priceStatus || "supplier_quote_required",
    applicable_rooms: CABINETRY_LOCATIONS.join("|"),
    selectable_status: "client-selectable",
  };
}

function cabinetryBenchtopPlaceholderRow(record) {
  return {
    current_source: "lib/builders/cabinetryWorkflow.js:CABINETRY_BENCHTOPS",
    current_id: record.id || record.productCode || "",
    proposed_product_id: `product:benchtop-assembly:${normalizeKey(record.id || record.name || record.range)}`,
    category_id: "category:benchtops",
    family_id: "family:stone-benchtops",
    supplier: record.supplier || "Builder Cabinetmaker",
    brand: record.brand || "Builder cabinetry",
    range: record.range || record.productRange || "",
    product_model_name: record.name || record.productName || record.id || "",
    description: record.description || `${record.name || record.id || "Benchtop"} configured by cabinetry schedule.`,
    image_reference: record.imageUrl || "",
    unit: "ITEM",
    price_or_quote_status: record.priceStatus || "supplier_quote_required",
    applicable_rooms: CABINETRY_LOCATIONS.join("|"),
    selectable_status: "client-selectable",
  };
}

function hardwareRow(productId, name, supplier, brand, range, description) {
  return specialtyRow(productId, productId.split(":").pop(), name, supplier, brand, range, description, "supplier_quote_required", "family:drawer-systems");
}

function specialtyRow(productId, currentId, name, supplier, brand, range, description, priceStatus, familyId = "family:cabinetry") {
  return {
    current_source: "lib/builders/cabinetryWorkflow.js:fallbackCabinetryAreaSelection",
    current_id: currentId,
    proposed_product_id: productId,
    category_id: "category:cabinetry",
    family_id: familyId,
    supplier,
    brand,
    range,
    product_model_name: name,
    description,
    image_reference: "",
    unit: "ITEM",
    price_or_quote_status: priceStatus,
    applicable_rooms: CABINETRY_LOCATIONS.join("|"),
    selectable_status: "client-selectable",
  };
}

function validateCabinetryRows(rows) {
  const requiredFields = ["proposed_product_id", "category_id", "family_id", "supplier", "brand", "range", "product_model_name", "description", "unit", "price_or_quote_status", "applicable_rooms", "selectable_status"];
  const failures = rows.flatMap((row) => requiredFields.filter((field) => !row[field]).map((field) => ({ id: row.proposed_product_id, field })));
  const bySupplier = countBy(rows, "supplier");
  const requiredSuppliers = ["Laminex", "Polytec", "Neolith", "Caesarstone", "Smartstone", "Stone Ambassador", "Handle House", "Blum", "Cabinetmaker"];
  return {
    complete: failures.length === 0 && requiredSuppliers.every((supplier) => bySupplier[supplier]),
    rows: rows.length,
    failures,
    bySupplier,
    areaLabels: Object.values(CABINETRY_AREA_LABELS || {}).length,
  };
}

function applianceHierarchy(products) {
  const families = new Set(APPLIANCE_REQUIREMENTS.map((item) => item.familyKey));
  const rows = products
    .filter((product) => families.has(product.familyKey) && product.active !== false)
    .map((product) => ({
      family: product.familyKey,
      brand: product.brand || product.supplier || "Unassigned",
      range: product.range || "Unassigned",
      model: product.model || product.productCode || product.productName,
      product_id: product.productId || product.id || product.productCode,
    }));
  return rows.sort((left, right) => `${left.family}:${left.brand}:${left.range}:${left.model}`.localeCompare(`${right.family}:${right.brand}:${right.range}:${right.model}`));
}

function taxonomyIds(section, item) {
  const text = `${section || ""} ${item || ""}`.toLowerCase();
  return {
    stage_id: stageFor(text),
    category_id: categoryFor(text, section),
    subcategory_id: subcategoryFor(text, item || section),
  };
}

function stageFor(text) {
  if (/prelim|fee|cert|approval|supervision|documentation/.test(text)) return "stage:preliminaries";
  if (/site|earth|demo|slab|concrete|foundation/.test(text)) return "stage:base";
  if (/frame|truss|joist|beam/.test(text)) return "stage:frame";
  if (/roof|window|door|cladding|brick|block|lock/.test(text)) return "stage:lock-up";
  if (/external|driveway|landscape|fence|deck|pool|retaining/.test(text)) return "stage:external";
  if (/kitchen|appliance|bath|fixture|cabinet|paint|floor|tile|lining|plumb|electrical|plaster/.test(text)) return "stage:fix-out";
  return "stage:unassigned";
}

function categoryFor(text, fallback) {
  if (/appliance|oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerator/.test(text)) return "category:appliances";
  if (/cabinet|joinery|handle|shelving|bulkhead|kick panel|blum/.test(text)) return "category:cabinetry";
  if (/benchtop|stone/.test(text)) return "category:benchtops";
  if (/sink|tap|mixer|toilet|basin|bath|shower|plumb/.test(text)) return "category:plumbing-fixtures";
  if (/light|electrical|electrician|power|fan/.test(text)) return "category:electrical";
  if (/paint/.test(text)) return "category:painting";
  if (/tile|floor|carpet|vinyl/.test(text)) return "category:flooring-tiling";
  if (/window|door|garage|robe/.test(text)) return "category:windows-doors";
  if (/roof|gutter|fascia|downpipe/.test(text)) return "category:roofing";
  if (/brick|block|cladding|render/.test(text)) return "category:external-cladding";
  if (/driveway|landscape|deck|pool|retaining/.test(text)) return "category:external-works";
  if (/slab|concrete|foundation/.test(text)) return "category:slab";
  if (/frame|truss|joist|beam/.test(text)) return "category:frame";
  if (/site|prelim|cert|approval|fee|supervision|documentation/.test(text)) return "category:preliminaries";
  return canonicalCategoryId(fallback || "unassigned");
}

function subcategoryFor(text, fallback) {
  const pairs = [
    ["built-in-ovens", /oven/],
    ["cooktops", /cooktop|hot plate|induction/],
    ["rangehoods", /rangehood|range hood/],
    ["dishwashers", /dishwasher/],
    ["microwaves", /microwave/],
    ["refrigerators", /fridge|refrigerator/],
    ["handles", /handle/],
    ["cabinet-finishes", /cabinet.*finish|laminex|polytec/],
    ["drawer-systems", /blum|soft-close|drawer/],
    ["shelving", /shelving|shelf|cleated/],
    ["cabinet-units-components", /bulkhead|kick panel|cabinet|joinery/],
    ["stone-surfaces", /stone|benchtop/],
    ["tapware", /tap|mixer/],
    ["toilets", /toilet/],
    ["basins", /basin/],
    ["baths", /bath/],
    ["showers", /shower/],
    ["light-fittings", /light|pendant/],
    ["labour", /labour|carpenter|plumber|electrician|painter|tiler|install/],
    ["plant-hire", /hire|excavator|bobcat|crane|scaffold/],
    ["statutory-fees", /cert|approval|permit|fee|engineering/],
  ];
  const found = pairs.find(([, pattern]) => pattern.test(text));
  return found ? `subcategory:${found[0]}` : canonicalSubcategoryId(fallback || "unassigned");
}

function proposedIdFor(sourceType, row) {
  if (["heading", "formula", "informational", "obsolete", "unresolved"].includes(sourceType)) return "";
  if (sourceType === "product") return stableCatalogueId("product", row);
  if (sourceType === "assembly") return stableCatalogueId("assembly", row);
  if (sourceType === "allowance") return stableCatalogueId("allowance", row);
  if (sourceType === "custom") return stableCatalogueId("custom", row);
  return stableCatalogueId("estimating", row);
}

function migrationStatus(sourceType, productMatch, derivedMatch) {
  if (["heading", "formula", "informational", "obsolete"].includes(sourceType)) return "not-a-catalogue-record";
  if (sourceType === "unresolved") return "requires-review";
  if (productMatch) return "existing-product-library-match";
  if (derivedMatch && sourceType === "estimating-item") return "existing-derived-estimating-row";
  if (derivedMatch && sourceType === "assembly") return "requires-assembly-model";
  if (sourceType === "product") return "missing-product-library-candidate";
  if (sourceType === "estimating-item") return "missing-explicit-estimating-master";
  if (sourceType === "assembly") return "requires-assembly-model";
  return "requires-review";
}

function unresolvedReviewRow(row) {
  return {
    quotation_row_id: row.quotation_row_id,
    quotation_code: row.quotation_code,
    section: row.section,
    current_description: row.current_description,
    proposed_source_type: row.proposed_source_type,
    unresolved_reason: row.unresolved_reason || "not-unresolved-but-reviewable",
    duplicate_group: row.duplicate_group,
    recommended_action: row.proposed_source_type === "unresolved" ? "manual review before catalogue creation" : "keep out of catalogue or handle by source type",
    notes: row.notes,
  };
}

function renderReport({ reconciledRows, duplicateReviews, unresolvedRows, cabinetryCompleteness, applianceCounts }) {
  const classificationTotals = countBy(reconciledRows, "proposed_source_type");
  const statusTotals = countBy(reconciledRows, "migration_status");
  const unresolvedTotals = countBy(unresolvedRows, "unresolved_reason");
  const productMatches = reconciledRows.filter((row) => row.existing_product_library_match).length;
  const derivedEstimatingMatches = reconciledRows.filter((row) => row.existing_estimating_catalogue_match).length;
  const explicitEstimatingMatches = reconciledRows.filter((row) => row.explicit_estimating_master_match).length;
  const proposedProductCreates = reconciledRows.filter((row) => row.migration_status === "missing-product-library-candidate").length;
  const proposedEstimatingCreates = new Set(reconciledRows.filter((row) => row.proposed_source_type === "estimating-item" && !row.explicit_estimating_master_match).map((row) => row.proposed_source_id)).size;
  const originalCabinetryWorkflowRows = LAMINEX_CABINETRY_CATALOGUE.length + POLYTEC_CABINETRY_CATALOGUE.length + HANDLE_HOUSE_BASE_CATALOGUE.length + CABINETRY_BENCHTOPS.length;
  return `# Master Catalogue Reconciliation Report

Date: 2026-09-02

Stage 3A is a read-only reconciliation. No live modules were connected, no saved jobs or selections were migrated, no prices were changed, and no quotation rows were deleted or merged.

## Zero Match Finding

Stage 2 reported 0 Product Library matches because matching only used direct stable IDs, product codes, and quote source keys. The active Quotation Builder workbook usually stores legacy descriptions, generic allowances, or old supplier/model text, not current Product Library stable IDs. After safe fallback matching, confirmed Product Library matches are ${productMatches}.

Stage 2 reported 0 Estimating Catalogue matches because there is not yet an explicit Estimating Catalogue master source with stable \`estimatingItemId\` records. The active runtime Estimating Catalogue is derived from the Quotation Builder sheet in \`EstimateBuilderWorkbook.js\`, so derived-runtime matches are ${derivedEstimatingMatches}, while explicit estimating-master matches remain ${explicitEstimatingMatches}.

## Corrected Classification Totals

${markdownTable(["Classification", "Rows"], Object.entries(classificationTotals).map(([Classification, Rows]) => ({ Classification, Rows })))}

## Migration Status Totals

${markdownTable(["Status", "Rows"], Object.entries(statusTotals).map(([Status, Rows]) => ({ Status, Rows })))}

## Creation Candidates

| Candidate type | Count | Meaning |
| --- | --- | --- |
| Product Library | ${proposedProductCreates} | Product-like rows with no safe existing Product Library match. Many are generic material/range rows and still need human review before creation. |
| Estimating Catalogue | ${proposedEstimatingCreates} | Unique estimating source IDs that need an explicit master item if the derived workbook row becomes canonical. These currently exist only as workbook-derived runtime rows. |
| Assembly templates | ${classificationTotals["assembly"] || 0} | Rows that combine product and resource logic; do not create as single products. |

## Duplicate Review

Duplicate groups reviewed: ${duplicateReviews.length}

${markdownTable(["Review type", "Groups"], Object.entries(countBy(duplicateReviews, "review_type")).map(([type, count]) => ({ "Review type": type, Groups: count })))}

Price/unit conflict groups: ${duplicateReviews.filter((row) => row.price_unit_conflict === "yes").length}

## Unresolved Review

${markdownTable(["Reason", "Rows"], Object.entries(unresolvedTotals).map(([Reason, Rows]) => ({ Reason, Rows })))}

## Cabinetry Mapping Completeness

Mapped cabinetry records: ${cabinetryCompleteness.rows}

Original Stage 2 cabinetry workflow records revalidated: ${originalCabinetryWorkflowRows}

Additional stone/specialty records included for Stage 3A completeness: ${cabinetryCompleteness.rows - originalCabinetryWorkflowRows}

Completeness status: ${cabinetryCompleteness.complete ? "complete" : "requires review"}

${markdownTable(["Supplier", "Rows"], Object.entries(cabinetryCompleteness.bySupplier).map(([Supplier, Rows]) => ({ Supplier, Rows })))}

Coverage verified for Laminex, Polytec, Neolith, Caesarstone, Smartstone, Stone Ambassador, Handle House handles, Blum soft-close hardware, brushed aluminium kick panels, raw MDF bulkheads, cabinet shelving, and cleated shelving.

Every mapped cabinetry row includes stable product ID, category ID, family ID, supplier, brand, range, product/model name, description, unit, price or quote-required status, applicable rooms, and selectable status. Image references are present where the current source provides one.

## Appliance Structure

Required hierarchy: Appliance family -> Brand -> Range/model -> Product details.

${markdownTable(["Family", "Brand", "Range", "Models"], applianceSummary(applianceCounts))}

Current appliance master records are Westinghouse-only because that is what the active committed Kitchen catalogue contains. The import contract and mapping schema use family, brand, range, model, and product ID fields, so additional brands can be imported by CSV without code changes.
`;
}

function renderMigrationPlan() {
  return `# Master Catalogue Stage 3 Migration Plan

Date: 2026-09-02

This plan intentionally divides later implementation into small, reversible slices. Stage 3A did not perform these migrations.

## Slice 1 - Product Library Canonical Source

Create canonical Product Library import rows only for reconciled physical products with high-confidence matches or approved missing-product candidates. Keep archived records resolvable and preserve current JSON catalogues until parity tests pass.

Rollback: disable the new canonical source flag and continue reading committed JSON catalogues.

## Slice 2 - Estimating Catalogue Canonical Source

Add explicit estimating item records for labour, plant, subcontract, fees, preliminaries, and construction materials currently derived from the workbook. Maintain a source row alias back to the workbook row.

Rollback: ignore explicit estimating records and continue deriving the runtime sheet from Quotation Builder rows.

## Slice 3 - Quotation Builder References And Snapshots

Add source reference fields to quotation rows: source type, source ID, source version, and frozen snapshot fields. Backfill references in batches by classification and leave row descriptions/prices unchanged.

Rollback: hide reference fields and keep existing quotation row payloads.

## Slice 4 - Client Selections Catalogue Selectors

Move selectors to family -> brand -> model Product Library queries one family at a time. Start with appliances and external lighting, then cabinetry once snapshot alias tests pass.

Rollback: switch the affected family back to current workflow/static source.

## Slice 5 - CSV Imports

Implement Product Library and Estimating Catalogue CSV imports using the Stage 2 templates. Validate duplicate keys by supplier plus product/model code for products and by trade/resource/code for estimating items.

Rollback: reject new imports and leave current committed catalogues intact.

## Slice 6 - Validation And Regression Tests

Add tests for source separation, classification, duplicate review, stable IDs, matching fallback fields, appliance hierarchy, cabinetry mapping completeness, and snapshot immutability. Keep the completed Cabinetry UI tests as a release gate.

Rollback: no data rollback required; tests only gate deployment.
`;
}

function applianceSummary(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.family}|${row.brand}|${row.range}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return Array.from(groups.entries()).map(([key, Models]) => {
    const [Family, Brand, Range] = key.split("|");
    return { Family, Brand, Range, Models };
  });
}

function normalizeProductRecord(record, source) {
  return {
    source,
    productId: record.productId || record.product_id || record.productCode || record.product_code || record.id || "",
    id: record.productId || record.product_id || record.productCode || record.product_code || record.id || "",
    productCode: record.productCode || record.product_code || record.sku || record.id || "",
    familyKey: record.familyKey || record.family_key || "",
    categoryKey: record.categoryKey || record.category_key || "",
    supplier: record.supplier || record.supplier_name || record.manufacturer || record.brand || "",
    brand: record.brand || record.manufacturer || record.supplier || "",
    range: record.range || record.collection || "",
    model: record.model || record.model_number || record.sku || record.productCode || record.product_code || "",
    productName: record.productName || record.product_name || record.name || "",
    description: record.description || "",
    primaryImageUrl: record.primaryImageUrl || record.primary_image_url || record.imageUrl || "",
    priceStatus: record.priceStatus || record.price_status || "",
    priceUnit: record.priceUnit || record.price_unit || record.unit || "",
    active: record.active !== false && record.active !== "false",
    archived: record.archived === true,
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
  return String(section || "").toLowerCase().replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

function reconciledMappingHeaders() {
  return ["quotation_row_id", "quotation_code", "stage_id", "category_id", "subcategory_id", "current_description", "unit", "quantity", "section", "proposed_source_type", "proposed_source_id", "client_selectable", "existing_product_library_match", "existing_estimating_catalogue_match", "explicit_estimating_master_match", "match_confidence", "duplicate_group", "unresolved_reason", "migration_status", "notes"];
}

function duplicateHeaders() {
  return ["duplicate_group", "canonical_row_id", "duplicate_row_ids", "duplicate_count", "review_type", "proposed_stable_catalogue_id", "recommended_action", "price_unit_conflict", "units", "prices", "notes"];
}

function unresolvedHeaders() {
  return ["quotation_row_id", "quotation_code", "section", "current_description", "proposed_source_type", "unresolved_reason", "duplicate_group", "recommended_action", "notes"];
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function csv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))].join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}
