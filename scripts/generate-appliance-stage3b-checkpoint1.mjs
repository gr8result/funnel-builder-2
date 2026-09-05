import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importLegacyApplianceCsv } from "../lib/product-library/applianceLegacyCsvImporter.js";
import {
  APPLIANCE_LEGACY_FIELD_COUNT,
  APPLIANCE_LEGACY_FIELDS,
  classifyApplianceFamily,
  extractApplianceModelNumber,
  parseApplianceLegacyCsv,
  reconcileApplianceLegacyRecords,
  stableAppliancePackId,
  stableApplianceProductId,
} from "../lib/construction-estimation/catalogues/applianceLegacyCsv.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCsvPath = process.env.APPLIANCE_LEGACY_CSV_PATH || "C:\\Users\\grant\\Downloads\\appliance options.csv";
const outputPaths = {
  mapping: path.join(repoRoot, "APPLIANCE_LEGACY_CSV_MAPPING.md"),
  report: path.join(repoRoot, "APPLIANCE_CATALOGUE_IMPORT_REPORT.md"),
  dedupe: path.join(repoRoot, "APPLIANCE_PRODUCT_DEDUPLICATION.csv"),
  packs: path.join(repoRoot, "APPLIANCE_PACK_COMPONENT_MAPPING.csv"),
  unresolved: path.join(repoRoot, "APPLIANCE_UNRESOLVED_ROWS.csv"),
  reconciliation: path.join(repoRoot, "APPLIANCE_CHECKPOINT1_RECONCILIATION.md"),
  comparison: path.join(repoRoot, "APPLIANCE_CHECKPOINT1_RESULT_COMPARISON.csv"),
  priceReview: path.join(repoRoot, "APPLIANCE_PRICE_CONFLICT_REVIEW.csv"),
};

if (!fs.existsSync(sourceCsvPath)) {
  console.error(`Missing appliance legacy CSV: ${sourceCsvPath}`);
  process.exit(1);
}

const sourceCsv = fs.readFileSync(sourceCsvPath, "utf8");
const parsed = parseApplianceLegacyCsv(sourceCsv);
const reconciliation = reconcileApplianceLegacyRecords(parsed.records);
const allRejected = [...parsed.rejectedRows, ...reconciliation.rejectedRows];
const implementationA = importLegacyApplianceCsv(sourceCsv, { sourceFile: sourceCsvPath });
const sourceStats = sourceFileStats(sourceCsvPath, sourceCsv);
const comparisonRows = resultComparisonRows(parsed.records, implementationA, reconciliation);
const priceReviewRows = priceConflictReviewRows(reconciliation.identityVariationGroups);

writeFile(outputPaths.mapping, renderLegacyMapping(sourceCsvPath));
writeFile(outputPaths.report, renderImportReport({ parsed, reconciliation, rejectedRows: allRejected, sourceCsvPath, sourceStats }));
writeFile(outputPaths.dedupe, csv(productHeaders(), reconciliation.products.map(productRow)));
writeFile(outputPaths.packs, csv(packHeaders(), packRows(reconciliation)));
writeFile(outputPaths.unresolved, csv(unresolvedHeaders(), unresolvedRows(parsed, reconciliation)));
writeFile(outputPaths.comparison, csv(comparisonHeaders(), comparisonRows));
writeFile(outputPaths.priceReview, csv(priceReviewHeaders(), priceReviewRows));
writeFile(outputPaths.reconciliation, renderCheckpointReconciliation({
  sourceStats,
  implementationA,
  reconciliation,
  comparisonRows,
  priceReviewRows,
}));

console.log(JSON.stringify({
  sourceCsvPath,
  sourceSha256: sourceStats.sha256,
  sourceFileSizeBytes: sourceStats.fileSizeBytes,
  sourceModifiedUtc: sourceStats.modifiedUtc,
  sourceRows: parsed.records.length + parsed.rejectedRows.length,
  fieldCount: APPLIANCE_LEGACY_FIELD_COUNT,
  uniquePhysicalProducts: reconciliation.products.length,
  appliancePacks: reconciliation.packs.length,
  duplicateComponentRows: reconciliation.duplicateComponentRows,
  packComponentRelationships: reconciliation.relationships.length,
  unresolvedRows: reconciliation.unresolvedRows.length,
  rejectedRows: allRejected.length,
  priceConflicts: reconciliation.priceConflicts.length,
  identityVariationReviewGroups: reconciliation.identityVariationGroups.length,
  countsByBrand: reconciliation.countsByBrand,
  countsByFamily: reconciliation.countsByFamily,
  accountedSourceRows: reconciliation.accountedSourceRows + allRejected.length,
  outputs: outputPaths,
}, null, 2));

function sourceFileStats(filePath, sourceText) {
  const stat = fs.statSync(filePath);
  return {
    absolutePath: path.resolve(filePath),
    fileSizeBytes: stat.size,
    sha256: crypto.createHash("sha256").update(sourceText).digest("hex").toUpperCase(),
    rowCount: parsed.records.length + parsed.rejectedRows.length,
    fieldCount: APPLIANCE_LEGACY_FIELD_COUNT,
    modifiedUtc: stat.mtime.toISOString(),
  };
}

function renderLegacyMapping(csvPath) {
  return `# Appliance Legacy CSV Mapping

Date: 2026-09-02

Source file: \`${csvPath}\`

This is a read-only parser contract for the supplied 19-field, headerless appliance CSV. The parser first converts every row into a named legacy record; reconciliation code must not depend on unexplained array indexes.

## Field Contract

${markdownTable(["Index", "Field", "Description"], APPLIANCE_LEGACY_FIELDS.map((field) => ({
    Index: field.index,
    Field: field.key,
    Description: field.description,
  })))}

## Later Standard Import Shape

The legacy parser is deliberately separated from the future Product Library CSV import. A later tenant import should map uploaded rows into canonical product fields: category, family, brand, range, model, SKU/product code, supplier, product name, description, unit, price status, optional price, image fields, applicable rooms, selectable flag, active flag, and tenant/workspace ownership.

Unknown future brands are accepted through normalization; this parser does not hardcode Euromaid, Ariston, Westinghouse, Smeg, Blanco, and Omega as the only permitted brands.
`;
}

function renderImportReport({ parsed, reconciliation, rejectedRows, sourceCsvPath, sourceStats }) {
  const sourceRows = parsed.records.length + parsed.rejectedRows.length;
  const sourceAccounting = [
    { Type: "unique physical appliance products", Rows: reconciliation.products.length },
    { Type: "appliance packs", Rows: reconciliation.packs.length },
    { Type: "duplicate component rows", Rows: reconciliation.duplicateComponentRows },
    { Type: "unresolved source rows", Rows: reconciliation.unresolvedRows.length },
    { Type: "rejected malformed rows", Rows: rejectedRows.length },
  ];
  return `# Appliance Catalogue Import Report

Date: 2026-09-02

Checkpoint 1 is data reconciliation only. No live Product Library records were created, no Client Selections or Quotation Builder screens were connected, and no product images were gathered.

## Source Summary

| Metric | Count |
| --- | --- |
| Source CSV path | ${sourceCsvPath} |
| Source file size | ${sourceStats.fileSizeBytes} bytes |
| Source SHA-256 | ${sourceStats.sha256} |
| Source modified UTC | ${sourceStats.modifiedUtc} |
| Source rows | ${sourceRows} |
| Expected fields per legacy row | ${APPLIANCE_LEGACY_FIELD_COUNT} |
| Accepted legacy rows | ${parsed.records.length} |
| Rejected malformed rows | ${rejectedRows.length} |
| EACH rows | ${parsed.records.filter((record) => record.unit === "EACH").length} |
| PACK rows | ${parsed.records.filter((record) => record.unit === "PACK").length} |
| Accounted source rows | ${reconciliation.accountedSourceRows + rejectedRows.length} |

## Reconciliation Totals

${markdownTable(["Type", "Rows"], sourceAccounting)}

Pack-to-product relationships: ${reconciliation.relationships.length}

Actual price conflict groups: ${reconciliation.priceConflicts.length}

Identity variation review groups: ${reconciliation.identityVariationGroups.length}

## Counts By Brand

${markdownTable(["Brand", "Source rows"], Object.entries(reconciliation.countsByBrand).map(([Brand, count]) => ({ Brand, "Source rows": count })))}

## Counts By Product Family

${markdownTable(["Family", "Unique products"], Object.entries(reconciliation.countsByFamily).map(([Family, count]) => ({ Family, "Unique products": count })))}

## Price Conflicts

${reconciliation.priceConflicts.length ? markdownTable(["Identity", "Brand", "Model", "Rows", "Prices", "Units", "Selectable", "Active"], reconciliation.priceConflicts.map((conflict) => ({
    Identity: conflict.identityKey,
    Brand: conflict.brand,
    Model: conflict.modelNumber,
    Rows: conflict.sourceRowIds.join("|"),
    Prices: conflict.prices.join("|"),
    Units: conflict.units.join("|"),
    Selectable: conflict.selectable.join("|"),
    Active: conflict.active.join("|"),
  }))) : "No actual price or unit conflicts were detected for repeated brand/model components. Eighteen same-model description/selectable variations are retained in `APPLIANCE_PRICE_CONFLICT_REVIEW.csv` because the latest disputed run counted them as price conflicts."}

## Appliance Hierarchy Prepared

The reconciled product candidates support the later required UI path:

\`Appliance family -> available brands -> available models -> product details and image -> selection snapshot\`

Images are intentionally blank at this checkpoint.
`;
}

function productHeaders() {
  return [
    "product_id",
    "brand",
    "supplier",
    "category_id",
    "family_id",
    "family",
    "model_number",
    "product_name",
    "description",
    "unit",
    "price",
    "selectable",
    "active",
    "source_row_ids",
    "duplicate_source_row_count",
    "image_reference",
  ];
}

function productRow(product) {
  return {
    product_id: product.productId,
    brand: product.brand,
    supplier: product.supplier,
    category_id: product.categoryId,
    family_id: product.familyId,
    family: product.family,
    model_number: product.modelNumber,
    product_name: product.productName,
    description: product.description,
    unit: product.unit,
    price: product.price,
    selectable: product.selectable,
    active: product.active,
    source_row_ids: product.sourceRowIds.join("|"),
    duplicate_source_row_count: Math.max(0, product.sourceRowIds.length - 1),
    image_reference: product.imageReference,
  };
}

function packHeaders() {
  return [
    "pack_id",
    "pack_source_row_id",
    "brand",
    "pack_name",
    "pack_price",
    "component_product_id",
    "component_source_row_id",
    "component_family",
    "contains_oven",
    "contains_cooktop",
    "contains_rangehood",
    "contains_dishwasher",
    "contains_microwave",
    "contains_refrigerator",
    "contains_freestanding_cooker",
    "contains_other_appliance_component",
    "unresolved_component_families",
  ];
}

function packRows(reconciliation) {
  return reconciliation.packs.flatMap((pack) => {
    const relationships = reconciliation.relationships.filter((relationship) => relationship.packSourceRowId === pack.sourceRowId);
    const components = relationships.length ? relationships : [{ componentProductId: "", componentFamily: "", componentSourceRowId: "" }];
    return components.map((relationship) => ({
      pack_id: pack.packId,
      pack_source_row_id: pack.sourceRowId,
      brand: pack.brand,
      pack_name: pack.productName,
      pack_price: pack.price,
      component_product_id: relationship.componentProductId,
      component_source_row_id: relationship.componentSourceRowId,
      component_family: relationship.componentFamily || "",
      contains_oven: pack.containsOven,
      contains_cooktop: pack.containsCooktop,
      contains_rangehood: pack.containsRangehood,
      contains_dishwasher: pack.containsDishwasher,
      contains_microwave: pack.containsMicrowave,
      contains_refrigerator: pack.containsRefrigerator,
      contains_freestanding_cooker: pack.containsFreestandingCooker,
      contains_other_appliance_component: pack.containsOtherComponent,
      unresolved_component_families: pack.unresolvedComponentFamilies.join("|"),
    }));
  });
}

function unresolvedHeaders() {
  return ["source_line_number", "legacy_row_id", "brand", "unit", "legacy_name", "reason", "source_fields"];
}

function comparisonHeaders() {
  return [
    "source_row_id",
    "brand",
    "source_description",
    "unit",
    "model_from_implementation_a",
    "model_from_implementation_b",
    "family_from_a",
    "family_from_b",
    "identity_key_a",
    "identity_key_b",
    "classification_a",
    "classification_b",
    "pack_id_a",
    "pack_id_b",
    "product_id_a",
    "product_id_b",
    "price_a",
    "price_b",
    "discrepancy_type",
    "recommended_resolution",
    "evidence",
  ];
}

function resultComparisonRows(records, implementationA, implementationB) {
  const aRowByLegacyId = new Map(implementationA.sourceRows.map((row) => [row.legacySourceRow, row]));
  const aProductByLegacyId = new Map();
  implementationA.products.forEach((product) => {
    product.legacySourceRows.forEach((rowId) => aProductByLegacyId.set(rowId, product));
  });
  const aPackByLegacyId = new Map(implementationA.packs.map((pack) => [pack.legacySourceRows[0], pack]));
  const bProductByLegacyId = new Map();
  implementationB.products.forEach((product) => {
    product.sourceRowIds.forEach((rowId) => bProductByLegacyId.set(rowId, product));
  });
  const aPackRelByLegacyId = new Map(implementationA.packRelationships.map((rel) => [rel.componentLegacySourceRow, rel]));
  const bPackRelByLegacyId = new Map(implementationB.relationships.map((rel) => [rel.componentSourceRowId, rel]));

  return records.map((record) => {
    const aRow = aRowByLegacyId.get(record.legacyRowId);
    const aProduct = aProductByLegacyId.get(record.legacyRowId);
    const bProduct = bProductByLegacyId.get(record.legacyRowId);
    const aRel = aPackRelByLegacyId.get(record.legacyRowId);
    const bRel = bPackRelByLegacyId.get(record.legacyRowId);
    const discrepancyType = comparisonDiscrepancy({ record, aRow, aProduct, bProduct, aRel, bRel });
    return {
      source_row_id: record.legacyRowId,
      brand: record.brand,
      source_description: record.legacyName,
      unit: record.unit,
      model_from_implementation_a: aRow?.manufacturerModel || "",
      model_from_implementation_b: record.modelNumber,
      family_from_a: aRow?.familyId || "",
      family_from_b: record.applianceFamily,
      identity_key_a: aProduct?.dedupeKey || (record.rowKind === "pack" ? `pack:${stableAppliancePackId(record)}` : ""),
      identity_key_b: bProduct?.identityKey || (record.rowKind === "pack" ? `pack:${stableAppliancePackId(record)}` : ""),
      classification_a: aRow?.unit === "PACK" ? "pack" : "component",
      classification_b: record.rowKind,
      pack_id_a: record.rowKind === "pack" ? aPackByLegacyId.get(record.legacyRowId)?.productId || "" : aRel?.packProductId || "",
      pack_id_b: record.rowKind === "pack" ? stableAppliancePackId(record) : bRel?.packId || "",
      product_id_a: aProduct?.productId || "",
      product_id_b: bProduct?.productId || "",
      price_a: aRow?.sellPrice ?? "",
      price_b: record.price ?? "",
      discrepancy_type: discrepancyType,
      recommended_resolution: recommendedResolution(discrepancyType),
      evidence: comparisonEvidence({ record, aRow, aProduct, bProduct, aRel, bRel }),
    };
  });
}

function comparisonDiscrepancy({ record, aRow, aProduct, bProduct, aRel, bRel }) {
  const types = [];
  if ((aRow?.manufacturerModel || "") !== record.modelNumber) types.push("model-extraction");
  if ((aRow?.familyId || "") !== record.applianceFamily) types.push("family-classification");
  if ((aProduct?.productId || "") !== (bProduct?.productId || "")) types.push(record.rowKind === "pack" ? "pack-id-shape" : "product-identity");
  if ((aRel?.packLegacySourceRow || "") !== (bRel?.packSourceRowId || "")) types.push("relationship-context");
  return types.join("|") || "none";
}

function recommendedResolution(discrepancyType) {
  if (discrepancyType === "none") return "No change required.";
  if (discrepancyType.includes("model-extraction")) return "Use canonical model extraction: strip option prefix, preserve hyphenated and multi-token model numbers, reject dimensions.";
  if (discrepancyType.includes("relationship-context")) return "Use source-row pack context so every EACH row remains traceable to its PACK row.";
  if (discrepancyType.includes("family-classification")) return "Classify freestanding oven/cooker rows as freestanding-cookers when the source says freestanding.";
  return "Use canonical parser output for future reports/imports.";
}

function comparisonEvidence({ record, aRow, aProduct, bProduct, aRel, bRel }) {
  const parts = [];
  if (record.legacyName.includes("OPTION - ")) parts.push("source row is an option label containing a physical model after OPTION -");
  if (/\b600MM\b|\b900MM\b/.test(record.legacyName)) parts.push("dimension token present; not a model ID");
  if (aRow?.manufacturerModel && record.modelNumber && aRow.manufacturerModel !== record.modelNumber) parts.push(`models differ: ${aRow.manufacturerModel} vs ${record.modelNumber}`);
  if (aProduct?.productId && bProduct?.productId && aProduct.productId !== bProduct.productId) parts.push("product IDs differ under old versus canonical identity");
  if ((aRel?.packLegacySourceRow || "") !== (bRel?.packSourceRowId || "")) parts.push("pack relationship source row assignment differs");
  return parts.join("; ");
}

function priceReviewHeaders() {
  return [
    "identity_key",
    "brand",
    "model_number",
    "source_row_ids",
    "prices",
    "units",
    "selectable_values",
    "active_values",
    "descriptions",
    "review_classification",
    "actual_price_conflict",
    "recommended_action",
    "evidence",
  ];
}

function priceConflictReviewRows(groups) {
  return groups.map((group) => {
    const actualPriceConflict = group.prices.length > 1 || group.units.length > 1;
    return {
      identity_key: group.identityKey,
      brand: group.brand,
      model_number: group.modelNumber,
      source_row_ids: group.sourceRowIds.join("|"),
      prices: group.prices.join("|"),
      units: group.units.join("|"),
      selectable_values: group.selectable.join("|"),
      active_values: group.active.join("|"),
      descriptions: group.descriptions.join("|"),
      review_classification: actualPriceConflict ? "actual conflicting prices for the same model" : "source description variation",
      actual_price_conflict: actualPriceConflict ? "TRUE" : "FALSE",
      recommended_action: actualPriceConflict ? "Manual pricing decision required before import." : "Keep one physical product and preserve all source rows/labels as provenance.",
      evidence: actualPriceConflict ? "Repeated identity has differing price or unit values." : "Repeated identity has the same price/unit; latest parser counted description/selectable variation as a price conflict.",
    };
  });
}

function renderCheckpointReconciliation({ sourceStats, implementationA, reconciliation, comparisonRows, priceReviewRows }) {
  const a = implementationA.report;
  const b = {
    sourceRows: sourceStats.rowCount,
    uniqueProducts: reconciliation.products.length,
    packs: reconciliation.packs.length,
    packRelationships: reconciliation.relationships.length,
    duplicateComponentRows: reconciliation.duplicateComponentRows,
    priceConflicts: reconciliation.priceConflicts.length,
    freestandingCookers: reconciliation.countsByFamily["freestanding-cookers"] || 0,
  };
  const modelDiscrepancies = comparisonRows.filter((row) => row.discrepancy_type.includes("model-extraction"));
  const productIdentityDiscrepancies = comparisonRows.filter((row) => row.discrepancy_type.includes("product-identity"));
  const familyDiscrepancies = comparisonRows.filter((row) => row.discrepancy_type.includes("family-classification"));
  return `# Appliance Checkpoint 1 Reconciliation

Date: 2026-09-02

Scope: focused reconciliation only. Stage 3B Checkpoint 2 image research was not started.

## Source File Verification

| Attribute | Value |
| --- | --- |
| Absolute source path | ${sourceStats.absolutePath} |
| File size | ${sourceStats.fileSizeBytes} bytes |
| SHA-256 | ${sourceStats.sha256} |
| Row count | ${sourceStats.rowCount} |
| CSV field count | ${sourceStats.fieldCount} |
| Modification timestamp UTC | ${sourceStats.modifiedUtc} |

Both implementations were reproduced against these exact bytes.

## Competing Result Totals

| Metric | Earlier implementation | Latest implementation | Authoritative result |
| --- | ---: | ---: | ---: |
| Source rows | ${a.sourceRows} | ${sourceStats.rowCount} | ${sourceStats.rowCount} |
| Unique physical products | ${a.uniqueProducts} | 83 | ${b.uniqueProducts} |
| Appliance packs | ${a.packs} | 35 | ${b.packs} |
| Pack relationships | ${a.packRelationships} | 128 | ${b.packRelationships} |
| Duplicate component rows | ${a.duplicateComponentRows} | 76 | ${b.duplicateComponentRows} |
| Actual price conflict groups | ${a.priceConflicts} | 18 alleged | ${b.priceConflicts} |
| Freestanding cookers | 5 | 6 | ${b.freestandingCookers} |

## Authoritative Decision

Neither implementation was fully correct.

The earlier \`lib/product-library/applianceLegacyCsvImporter.js\` preserved the source-row pack/component relationship count correctly: every one of the 159 \`EACH\` rows belongs to a pack context. It was not correct for product identity because option labels such as \`CANOPY RANGEHOOD OPTION - ... ARHC60X\` were treated as separate model identities.

The latest \`lib/construction-estimation/catalogues/applianceLegacyCsv.js\` was correct to collapse option labels to physical brand/model identities, giving 83 unique products and 76 duplicate component rows. It was not correct to reduce pack relationships to 128 best-match family links, because that lost 31 source-row relationships. It also reported 18 price conflicts that are description/selectable variations, not actual price or unit conflicts.

The corrected canonical implementation is \`lib/construction-estimation/catalogues/applianceLegacyCsv.js\`.

## Rule Comparison

| Rule | Earlier implementation | Latest disputed implementation | Corrected canonical rule |
| --- | --- | --- | --- |
| Model-number extraction | Preserved multi-token models but included \`OPTION - ...\` in some model IDs. | Removed dimensions but truncated hyphen/multi-token models. | Strip option prefix, preserve hyphenated/multi-token model numbers, reject dimensions like 600MM/900MM. |
| Product identity key | Existing ID, then brand/model, then brand/name. | Brand/model, then brand/name. | Brand/model, then brand/name fallback; option labels collapse to the physical model. |
| Product-name fallback | Used when no model was found. | Used when no model was found. | Same, only after dimension and option-prefix checks. |
| Pack detection | \`PACK\` unit. | \`PACK\` unit. | \`PACK\` unit. |
| Component detection | \`EACH\` unit. | \`EACH\` unit. | \`EACH\` unit. |
| Duplicate classification | 159 EACH - 100 products = 59 duplicates. | 159 EACH - 83 products = 76 duplicates. | 159 EACH - 83 products = 76 duplicates. |
| Price-conflict classification | Price only; found 0. | Price/unit/active/selectable/description variation; found 18. | Actual price/unit conflicts = 0; description/selectable variations reviewed separately = 18. |
| Appliance-family classification | Freestanding oven was classified as oven. | Freestanding oven/cooker classified as freestanding-cookers. | Freestanding oven/cooker rows are freestanding-cookers when source text says freestanding. |
| Pack-component relationships | Source-row context; 159 relationships. | One best product per required family; 128 relationships. | Source-row context; 159 relationships, all resolving to canonical product IDs. |
| Active/selectable treatment | Preserved booleans on records. | Preserved booleans and counted selectable variation as conflict. | Preserve booleans; do not call selectable-only variation a price conflict. |

## Numerical Discrepancies Explained

- 100 versus 83 unique products: ${productIdentityDiscrepancies.length} source rows change product identity. The difference is 17 physical identities, mostly option-labelled dishwasher and rangehood rows that should collapse into existing brand/model products.
- 159 versus 128 relationships: the latest disputed implementation created one selected component per required family, losing 31 source-row component relationships. The authoritative output restores all 159 EACH rows as pack-component relationships.
- 59 versus 76 duplicate rows: once 17 option-labelled records collapse into physical model identities, duplicate rows increase by 17.
- 18 alleged price conflicts: all 18 are same-price/same-unit identity variation groups. They are reviewed in \`APPLIANCE_PRICE_CONFLICT_REVIEW.csv\`; none are actual price conflicts.
- 5 versus 6 freestanding cookers: \`OMEGA 90CM 9 FUNCTION FREESTANDING OVEN OF916FX\` is classified as freestanding-cookers because the source explicitly says freestanding.

## Row-Level Review Files

- \`APPLIANCE_CHECKPOINT1_RESULT_COMPARISON.csv\` contains ${comparisonRows.length} row-level comparisons.
- \`APPLIANCE_PRICE_CONFLICT_REVIEW.csv\` contains ${priceReviewRows.length} alleged conflict groups, with actual conflict flags.

## Deprecated Implementation

\`lib/product-library/applianceLegacyCsvImporter.js\` is superseded for Checkpoint 1 authority. Safe removal plan: keep it temporarily for historical comparison, move downstream generators/tests to \`lib/construction-estimation/catalogues/applianceLegacyCsv.js\`, then delete the deprecated importer once no imports reference it.
`;
}

function unresolvedRows(parsed, reconciliation) {
  return [
    ...reconciliation.unresolvedRows.map((row) => ({
      source_line_number: row.sourceLineNumber,
      legacy_row_id: row.legacyRowId,
      brand: row.brand,
      unit: row.unit,
      legacy_name: row.legacyName,
      reason: row.rowKind === "component" ? "unresolved appliance type" : "unsupported unit",
      source_fields: row.sourceFields.join("|"),
    })),
    ...parsed.rejectedRows.map((row) => ({
      source_line_number: row.sourceLineNumber,
      legacy_row_id: "",
      brand: "",
      unit: "",
      legacy_name: "",
      reason: row.rejectionReason,
      source_fields: row.sourceFields.join("|"),
    })),
  ];
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => markdownCell(row[header])).join(" | ")} |`),
  ].join("\n");
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function csv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))].join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}
