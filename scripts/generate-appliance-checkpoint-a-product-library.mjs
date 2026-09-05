import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import { buildCanonicalApplianceCatalogue } from "../lib/product-library/applianceCanonicalCatalogue.js";
import {
  workbookQuoteImportRowsToLegacyCsv,
  workbookQuoteImportSummary,
} from "../lib/product-library/applianceWorkbookQuoteImport.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = process.argv[2] || "C:\\Users\\grant\\Downloads\\Appliances.xlsx";
const sourceSheet = "Quote Import";
const outputDir = path.join(repoRoot, "data", "product-library", "catalogues", "appliances");
const brandsPath = path.join(outputDir, "AU-APPLIANCE-BRANDS.json");

const workbookBytes = fs.readFileSync(sourceFile);
const workbook = xlsx.read(workbookBytes);
const sheet = workbook.Sheets[sourceSheet];
if (!sheet) throw new Error(`Workbook sheet not found: ${sourceSheet}`);

const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
const headerIndex = allRows.findIndex((row) => String(row[0] || "").trim().toUpperCase() === "APPLIANCES" && String(row[1] || "").trim().toUpperCase() === "ITEM");
if (headerIndex < 0) throw new Error("Could not locate the Quote Import appliance header row.");

const quoteRows = allRows.slice(headerIndex + 1);
const workbookSummary = workbookQuoteImportSummary(quoteRows);
const legacyCsv = workbookQuoteImportRowsToLegacyCsv(quoteRows);
const result = buildCanonicalApplianceCatalogue(legacyCsv, { sourceFile });
const sourceSha256 = crypto.createHash("sha256").update(workbookBytes).digest("hex").toUpperCase();

result.catalogue.sourceFile = sourceFile;
result.catalogue.sourceSheet = sourceSheet;
result.catalogue.sourceSha256 = sourceSha256;
result.catalogue.workbookReconciliation = workbookSummary;
result.packCatalogue.sourceFile = sourceFile;
result.packCatalogue.sourceSheet = sourceSheet;
result.packCatalogue.sourceSha256 = sourceSha256;
result.packCatalogue.workbookReconciliation = workbookSummary;

fs.mkdirSync(outputDir, { recursive: true });
writeJson(path.join(outputDir, "AU-APPLIANCE-CATALOGUE.json"), result.catalogue);
writeJson(path.join(outputDir, "AU-APPLIANCE-PACKS.json"), result.packCatalogue);

const brandCatalogue = JSON.parse(fs.readFileSync(brandsPath, "utf8"));
brandCatalogue.sourceFile = sourceFile;
brandCatalogue.sourceSheet = sourceSheet;
brandCatalogue.sourceSha256 = sourceSha256;
writeJson(brandsPath, brandCatalogue);

writeFile("APPLIANCE_COMPLETE_CATALOGUE_REPORT.md", renderCompleteCatalogueReport({ result, workbookSummary, brandCatalogue, sourceSha256 }));
writeFile("APPLIANCE_PRODUCT_IMAGE_AUDIT.csv", csvFromRows(imageAuditRows(result)));
writeFile("APPLIANCE_PRODUCT_SOURCE_AUDIT.csv", csvFromRows(sourceAuditRows(result)));
writeFile("APPLIANCE_MISSING_IMAGE_REVIEW.csv", csvFromRows(missingImageRows(result)));
writeFile("APPLIANCE_BRAND_COVERAGE.csv", csvFromRows(brandCoverageRows(result, brandCatalogue)));
writeFile("APPLIANCE_WORKBOOK_RECONCILIATION.csv", csvFromRows(workbookReconciliationRows(result)));

console.log(JSON.stringify({
  sourceFile,
  sourceSheet,
  sourceSha256,
  workbook: workbookSummary,
  canonicalProducts: result.catalogue.products.length,
  packages: result.packCatalogue.packs.length,
  relationships: result.packCatalogue.relationships.length,
  brands: brandCoverageRows(result, brandCatalogue).map((row) => ({
    brand: row.brand,
    products: row.products,
    packages: row.packages,
    logoStatus: row.logo_status,
  })),
}, null, 2));

function renderCompleteCatalogueReport({ result, workbookSummary, brandCatalogue, sourceSha256 }) {
  const productBrands = countBy(result.catalogue.products, "brandName");
  const packBrands = countBy(result.packCatalogue.packs, "brandName");
  const missingImages = missingImageRows(result);
  return `# Appliance Complete Catalogue Report

Checkpoint: Stage 3B Checkpoint A - Product Library canonical catalogue.

Source workbook: \`${sourceFile}\`

Source sheet: \`${sourceSheet}\`

Source SHA-256: \`${sourceSha256}\`

## Architecture Inspection

| Area | Confirmed owner/location |
| --- | --- |
| Existing Product Library appliance products | \`data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json\` |
| Existing Product Library appliance packages | \`data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json\` |
| Appliance brand/logo metadata | \`data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json\` |
| Canonical appliance selectors | \`lib/product-library/applianceCatalogueSelectors.js\` and \`lib/product-library/applianceCatalogueSelectorsCore.js\` |
| Catalogue service exposure | \`lib/product-library/catalogueService.js\` maps appliance products and packs into the master Product Library catalogue |
| Persistence/storage mechanism | committed Product Library JSON files for platform master data; builder deltas remain separate by organisation/workspace |
| Tenant ownership model | platform master records use \`sourcePlatform: platform-master\`; tenant records/deltas are organisation-specific overlays and do not own this catalogue |
| Current appliance JSON files | the three files listed above under \`data/product-library/catalogues/appliances\` |
| Duplicate hard-coded appliance arrays | none added for Checkpoint A; consuming modules were not connected or edited |
| Imported product/image destination | products/packages/brands in \`data/product-library/catalogues/appliances\`; approved future local product image assets should live under \`public/images/catalogues/appliances/products/<brand>/<model>.*\` with the source audit updated |

The proposed catalogue owner is Product Library. No live consuming module is the canonical owner.

## Workbook Reconciliation

| Metric | Count |
| --- | ---: |
| Quote Import rows after header | ${workbookSummary.sheetRows} |
| Rows transformed into legacy appliance rows | ${workbookSummary.transformedLegacyRows} |
| Priced rows | ${workbookSummary.pricedRows} |
| Heading/note rows ignored as non-catalogue records | ${workbookSummary.headingRows} |
| Canonical physical products | ${result.catalogue.products.length} |
| Canonical packages | ${result.packCatalogue.packs.length} |
| Pack-component relationships | ${result.packCatalogue.relationships.length} |
| Duplicate component rows consolidated | ${result.checkpoint1.report.duplicateComponentRows} |
| Unresolved source rows | ${result.checkpoint1.report.unresolvedModelNumbers} |
| Actual price conflict groups | ${result.checkpoint1.report.priceConflicts} |
| Workbook-only rows held for review | ${workbookSummary.excludedRows.length} |

Workbook-only review exclusions:

${markdownTable(
  ["Source row", "Item", "Unit", "Rate", "Reason"],
  workbookSummary.excludedRows.map((row) => ({
    "Source row": row.source_row_id,
    Item: row.item,
    Unit: row.unit,
    Rate: row.rate,
    Reason: row.reason,
  })),
)}

## Brand Coverage

${markdownTable(
  ["Brand", "Products", "Packages", "Logo", "Logo source"],
  brandCoverageRows(result, brandCatalogue).map((row) => ({
    Brand: row.brand,
    Products: row.products,
    Packages: row.packages,
    Logo: row.logo_status,
    "Logo source": row.logo_source_url,
  })),
)}

## Product Families

${markdownTable(
  ["Family", "Products"],
  Object.entries(countBy(result.catalogue.products, "familyId")).map(([Family, Products]) => ({ Family, Products })),
)}

## Image And Source Status

| Status | Count |
| --- | ---: |
| Product images with approved local/remote primary image | ${result.catalogue.products.filter((product) => product.primaryImage).length} |
| Product images pending licence | ${result.catalogue.products.filter((product) => product.imageStatus === "pending-licence").length} |
| Exact product image unavailable after initial pass | ${result.catalogue.products.filter((product) => product.imageStatus === "exact-image-unavailable").length} |
| Missing image review rows | ${missingImages.length} |
| Exact model product pages verified | ${result.catalogue.products.filter((product) => product.productPageStatus === "verified-exact-model").length} |

No generic kitchen paint, lighting, microwave or refrigerator rows were created. Product images were not substituted with wrong-model imagery; exact source pages are recorded where verified and unresolved images remain in the missing image review.

## Price Preservation

Product and package prices are preserved from \`${sourceFile}\`; current retail research fields remain separate and empty, so external price research cannot overwrite workbook pricing.

## Checkpoint Boundary

Client Selections and Quotation Builder were not connected in this checkpoint. \`pages/modules/builders/selections-book.js\`, saved jobs, quotation snapshots and job-file persistence are not part of this Product Library catalogue owner change.
`;
}

function imageAuditRows(result) {
  return result.catalogue.products.map((product) => ({
    product_id: product.productId,
    brand: product.brandName,
    family: product.familyId,
    model: product.manufacturerModel,
    product_name: product.productName,
    primary_image: product.primaryImage,
    image_status: product.imageStatus,
    image_source_url: product.imageSourceUrl,
    image_source_organisation: product.imageSourceOrganisation,
    product_page_url: product.productPageUrl,
    checked_at: product.imageCheckedAt,
    proposed_local_asset_path: product.productPageUrl ? `public/images/catalogues/appliances/products/${slug(product.brandName)}/${slug(product.manufacturerModel)}.webp` : "",
    licence_status: product.primaryImage ? "approved-for-use" : product.imageStatus,
  }));
}

function sourceAuditRows(result) {
  return result.catalogue.products.map((product) => ({
    product_id: product.productId,
    brand: product.brandName,
    family: product.familyId,
    model: product.manufacturerModel,
    source_file: result.catalogue.sourceFile,
    source_sheet: result.catalogue.sourceSheet,
    source_row_ids: product.sourceRowIds.join("|"),
    product_page_status: product.productPageStatus,
    product_page_url: product.productPageUrl,
    description_status: product.descriptionStatus,
    specification_status: product.specificationStatus,
    source_checked_at: product.sourceCheckedAt,
    manual_review_required: product.manualReviewRequired,
    manual_review_reason: product.manualReviewReason,
  }));
}

function missingImageRows(result) {
  return result.catalogue.products
    .filter((product) => !product.primaryImage || !String(product.imageStatus || "").startsWith("verified"))
    .map((product) => ({
      product_id: product.productId,
      brand: product.brandName,
      family: product.familyId,
      model: product.manufacturerModel,
      image_status: product.imageStatus,
      exact_model_source_url: product.productPageUrl,
      source_organisation: product.imageSourceOrganisation,
      required_action: product.productPageUrl
        ? "Confirm supplier/manufacturer image licence or approved direct asset before storing primary image."
        : "Complete exact model image research; do not use category or wrong-model fallback.",
    }));
}

function brandCoverageRows(result, brandCatalogue) {
  const productsByBrand = countBy(result.catalogue.products, "brandName");
  const packsByBrand = countBy(result.packCatalogue.packs, "brandName");
  return (brandCatalogue.brands || []).map((brand) => ({
    brand: brand.brandName,
    products: productsByBrand[brand.brandName] || 0,
    packages: packsByBrand[brand.brandName] || 0,
    logo_url: brand.logoUrl || "",
    logo_status: brand.logoStatus || "missing",
    logo_source_url: brand.logoSourceUrl || "",
    homepage_url: brand.homepageUrl || "",
    checked_at: brand.logoCheckedAt || "",
  }));
}

function workbookReconciliationRows(result) {
  const productBySourceRow = new Map();
  result.catalogue.products.forEach((product) => {
    product.sourceRowIds.forEach((rowId) => productBySourceRow.set(rowId, product));
  });
  const packBySourceRow = new Map(result.packCatalogue.packs.map((pack) => [pack.sourceRowReference, pack]));
  const rows = [
    ...Array.from(productBySourceRow.entries()).map(([rowId, product]) => ({
      source_row_id: rowId,
      canonical_type: "product-component",
      canonical_id: product.productId,
      brand: product.brandName,
      family: product.familyId,
      model: product.manufacturerModel,
      name: product.productName,
      unit: product.unit,
      price: product.sellPrice,
      action: "map workbook component row to canonical Product Library product",
    })),
    ...Array.from(packBySourceRow.entries()).map(([rowId, pack]) => ({
      source_row_id: rowId,
      canonical_type: "package",
      canonical_id: pack.packId,
      brand: pack.brandName,
      family: "appliance-packs",
      model: "",
      name: pack.packName,
      unit: "PACK",
      price: pack.sourcePackPrice,
      action: "map workbook package row to canonical Product Library package",
    })),
  ];
  (result.catalogue.workbookReconciliation?.excludedRows || []).forEach((excluded) => {
    rows.push({
      source_row_id: excluded.source_row_id,
      canonical_type: "workbook-only-review-exclusion",
      canonical_id: "",
      brand: "",
      family: "",
      model: "",
      name: excluded.item,
      unit: excluded.unit,
      price: excluded.rate,
      action: excluded.reason,
    });
  });
  return rows.sort((left, right) => Number(left.source_row_id) - Number(right.source_row_id));
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] || "";
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
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

function csvFromRows(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n") + "\n";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeFile(relativePath, contents) {
  fs.writeFileSync(path.join(repoRoot, relativePath), contents, "utf8");
}
