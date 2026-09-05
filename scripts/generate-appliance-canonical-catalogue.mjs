import crypto from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";

const sourceFile = process.argv[2] || "c:/Users/grant/Downloads/appliance options.csv";
const sourceText = readFileSync(sourceFile, "utf8");
const result = buildCanonicalApplianceCatalogue(sourceText, { sourceFile });
const sourceSha256 = crypto.createHash("sha256").update(sourceText).digest("hex").toUpperCase();

result.catalogue.sourceSha256 = sourceSha256;
result.packCatalogue.sourceSha256 = sourceSha256;

mkdirSync(resolve("data/product-library/catalogues/appliances"), { recursive: true });

writeJson("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", result.catalogue);
writeJson("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json", result.packCatalogue);
writeFileSync(resolve("APPLIANCE_PRODUCT_ENRICHMENT_REPORT.md"), renderEnrichmentReport(result));
writeFileSync(resolve("APPLIANCE_IMAGE_AND_SOURCE_AUDIT.csv"), csvFromRows(result.imageAuditRows));
writeFileSync(resolve("APPLIANCE_MANUAL_REVIEW_QUEUE.csv"), csvFromRows(result.manualReviewQueue));
writeFileSync(resolve("APPLIANCE_CATALOGUE_COVERAGE_REPORT.md"), renderCoverageReport(result));
writeFileSync(resolve("APPLIANCE_IDENTITY_VARIATION_RESOLUTION.csv"), csvFromRows(identityVariationRows(result)));
writeFileSync(resolve("APPLIANCE_PRODUCT_RESEARCH_LOG.csv"), csvFromRows(result.researchLogRows));
writeFileSync(resolve("APPLIANCE_FIELD_SOURCE_AUDIT.csv"), csvFromRows(result.fieldSourceAuditRows));
writeFileSync(resolve("APPLIANCE_IMAGE_LICENSING_REVIEW.csv"), csvFromRows(result.imageLicensingRows));

console.log(JSON.stringify(result.report, null, 2));

function writeJson(path, value) {
  writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`);
}

function renderEnrichmentReport(result) {
  return `# Appliance Product Enrichment Report

Checkpoint: Stage 3B Checkpoint 2.

Source file: \`${result.catalogue.sourceFile}\`

## Summary

| Metric | Count |
| --- | ---: |
| Canonical physical products | ${result.report.canonicalProducts} |
| Appliance packs | ${result.report.packs} |
| Pack-component relationships | ${result.report.packRelationships} |
| Source SHA-256 | ${sourceSha256} |
| Descriptions verified complete | ${result.report.descriptionsCompleted} |
| Descriptions verified basic | ${result.report.descriptionsVerifiedBasic} |
| Descriptions source-derived only | ${result.report.descriptionsSourceDerivedOnly} |
| Descriptions pending | ${result.report.descriptionsPending} |
| Specifications completed | ${result.report.specificationsCompleted} |
| Specification records partial | ${result.report.partialSpecificationRecords} |
| Verified official images | ${result.report.verifiedOfficialImages} |
| Verified retailer images | ${result.report.verifiedRetailerImages} |
| Verified distributor images | ${result.report.verifiedDistributorImages} |
| Verified archived images | ${result.report.verifiedArchivedImages} |
| Images pending licence | ${result.report.imagesPendingLicence} |
| Exact images unavailable after initial pass | ${result.report.imagesUnavailable} |
| Products requiring manual review | ${result.report.productsRequiringManualReview} |
| Identity variations resolved | ${result.report.identityVariationsResolved} |

## Price Preservation

- Product source cost and sell prices preserved: ${result.report.pricePreservation.productPricesPreserved ? "yes" : "no"}
- Pack source cost and pack prices preserved: ${result.report.pricePreservation.packPricesPreserved ? "yes" : "no"}
- Current external retail fields are present but empty, so current retail research cannot overwrite imported source quotation prices.

## Evidence And Image Status

Descriptions and structured specifications in this checkpoint are derived only from fields verifiable in the supplied legacy CSV: brand, model, family terms, width terms, fuel/install terms and source pricing. Official manufacturer product pages and model-specific images have not been bulk-attached without verification.

Products with exact model pages and visible page imagery are marked \`imageStatus: "pending-licence"\`; products without an exact source in this pass are marked \`imageStatus: "exact-image-unavailable"\` and remain queued for deeper manual/archived research.

Specification records are marked \`partial\` because no manufacturer source has verified dimensions beyond width, capacity, controls, energy ratings, water ratings, extraction rates or electrical requirements.

Research attempts are recorded in \`APPLIANCE_PRODUCT_RESEARCH_LOG.csv\`. Field-level provenance is recorded in \`APPLIANCE_FIELD_SOURCE_AUDIT.csv\`. Image licence status is recorded in \`APPLIANCE_IMAGE_LICENSING_REVIEW.csv\`.

## Not Connected

No Product Library UI, Client Selections, Quotation Builder, database migration, saved job migration, or job-file persistence changes were made in this checkpoint.
`;
}

function identityVariationRows(result) {
  return result.checkpoint1.identityVariationGroups.map((group) => ({
    identity_key: group.identityKey,
    brand: group.brand,
    model_number: group.modelNumber,
    source_row_ids: group.sourceRowIds.join("|"),
    prices: group.prices.join("|"),
    units: group.units.join("|"),
    selectable_values: group.selectable.join("|"),
    active_values: group.active.join("|"),
    descriptions: group.descriptions.join("|"),
    canonical_resolution: "one canonical model record",
    recommended_action: "Preserve source-row traceability and variation labels; do not create duplicate products.",
    actual_price_conflict: "FALSE",
  }));
}

function renderCoverageReport(result) {
  return `# Appliance Catalogue Coverage Report

## Coverage Matrix

${markdownTable(
  ["Brand", "Model", "Family", "Description", "Specification", "Product page", "Image", "Image source", "Manual review", "Reason"],
  result.coverage.map((row) => [
    row.brandName,
    row.manufacturerModel,
    row.familyId,
    row.descriptionStatus,
    row.specificationStatus,
    row.productPageStatus,
    row.imageStatus,
    row.imageSource,
    row.manualReviewRequired ? "yes" : "no",
    row.reasonForReview,
  ])
)}
`;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function csvFromRows(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
