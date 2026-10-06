import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Merge an evidence-backed HNC snapshot by exact brand/model. Historical IDs,
// workbook prices and package relationships are never regenerated.
const dir = path.resolve("data/product-library/catalogues/appliances");
const cataloguePath = path.join(dir, "AU-APPLIANCE-CATALOGUE.json");
const brandsPath = path.join(dir, "AU-APPLIANCE-BRANDS.json");
const requested = process.argv.slice(2);
assert(requested.length && requested.every((brand) => ["Whirlpool", "Euromaid"].includes(brand)), "Pass Whirlpool and/or Euromaid explicitly");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const modelKey = (record) => `${record.brandName.toLowerCase()}::${record.manufacturerModel.trim().toUpperCase()}`;
const catalogue = read(cataloguePath);
const brands = read(brandsPath);
const baseline = structuredClone(catalogue.products);
const baselineByKey = new Map(baseline.map((record) => [modelKey(record), record]));
const output = { checkedAt: "2026-09-16", brands: {}, preservedOtherBrands: true, preservedAllHistoricalIds: true, preservedPackageFile: true };
const backupDir = path.resolve("artifacts/recovery/hnc-appliances-20260916");
fs.mkdirSync(backupDir, { recursive: true });
for (const name of ["AU-APPLIANCE-CATALOGUE.json", "AU-APPLIANCE-BRANDS.json", "AU-APPLIANCE-PACKS.json"]) {
  const destination = path.join(backupDir, name);
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(dir, name), destination);
}
const priceFields = ["costPrice", "sourceCostPrice", "sellPrice", "importedSourceCost", "tenantSellPrice"];
for (const brand of requested) {
  const stagePath = path.join(dir, `AU-${brand.toUpperCase()}-HNC-RANGE.json`);
  const stage = read(stagePath);
  assert(stage.products?.length, `${brand}: empty source snapshot rejected`);
  if (brand === "Euromaid") {
    assert.equal(stage.totalSourceCount, stage.products.length, "Euromaid full source count");
    assert.equal(stage.uniqueModelCount, stage.products.length, "Euromaid unique source count");
    assert.deepEqual(stage.failures, [], "Euromaid collection errors must be resolved");
    assert.equal(stage.pagination.length, stage.pagination[0].total_pages, "Euromaid all pages collected");
  }
  const incoming = new Map();
  const updated = [], added = [], retired = [];
  for (const row of stage.products) {
    assert.equal(row.brandName, brand);
    assert(row.manufacturerModel && row.sku && row.productName && row.familyId);
    assert(row.productPageUrl?.startsWith("https://www.harveynormancommercial.com.au/products/"));
    assert(row.sourceCheckedAt && row.fullDescription && Object.keys(row.specifications || {}).length);
    assert(row.primaryImage?.startsWith(`/images/catalogues/appliances/products/${brand.toLowerCase()}/`));
    const localImage = path.resolve("public", row.primaryImage.slice(1));
    assert(fs.existsSync(localImage) && fs.statSync(localImage).size > 1692, `${row.manufacturerModel}: missing image or supplier placeholder`);
    assert(row.imageSourceUrl && row.imageSourceOrganisation);
    const key = modelKey(row);
    assert(!incoming.has(key), `${brand}: duplicate exact source model ${row.manufacturerModel}`);
    const previous = baselineByKey.get(key);
    const sourceStamp = { status: "source-verified", source: "Harvey Norman Commercial", sourceUrl: row.productPageUrl, sourceCheckedAt: row.sourceCheckedAt };
    const sourceDiscrepancies = row.sourceDiscrepancies || [];
    const next = {
      schemaVersion: "product-library.appliance-catalogue.v1", categoryId: "category:appliances", productType: "physical-product", unit: "EACH",
      ...previous, ...row,
      productId: previous?.productId || row.productId || `product:appliances:${row.familyId}:${brand.toLowerCase()}:${row.manufacturerModel.toLowerCase()}`,
      descriptionStatus: row.descriptionStatus || "source-verified",
      specificationStatus: row.specificationStatus || "source-verified-published-fields",
      specificationSources: row.specificationSources || Object.fromEntries(Object.keys(row.specifications).map((field) => [field, field === "manufacturer" ? { ...sourceStamp, source: "Euromaid Australia", sourceUrl: row.manufacturerUrl } : sourceStamp])),
      manualReviewRequired: row.manualReviewRequired ?? sourceDiscrepancies.length > 0,
      manualReviewReason: row.manualReviewReason || sourceDiscrepancies.map((conflict) => `Source discrepancy (${conflict.field}): ${conflict.hncTitle || conflict.title}; ${conflict.manufacturerTitle || conflict.dimensions}. ${conflict.resolution}`).join(" "),
      supplierId: row.supplierId || "supplier:harvey-norman-commercial",
      supplierName: row.supplierName || "Harvey Norman Commercial",
      source: row.source || { type: "authorised-supplier-api", organisation: "Harvey Norman Commercial", url: row.productPageUrl, listingUrl: stage.sourceUrl, apiEndpoint: stage.endpoint, brandId: stage.brandFilter },
      research: row.research || { verificationStatus: "source-verified", sourceOrganisation: "Harvey Norman Commercial", checkedAt: row.sourceCheckedAt },
      evidence: row.evidence || { sourceOrganisation: "Harvey Norman Commercial", sourceCheckedAt: row.sourceCheckedAt, evidenceStatus: "exact-model-source-verified", sourceCategories: row.hncCategories, manufacturerUrl: row.manufacturerUrl },
      imageVerificationStatus: row.imageVerificationStatus || "verified-exact-model",
      applicableRooms: row.applicableRooms || ["kitchen"],
    };
    assert(next.productId, `${row.manufacturerModel}: stable ID required`);
    for (const field of priceFields) next[field] = previous?.[field] ?? null;
    next.priceStatus = next.tenantSellPrice != null || next.sellPrice != null || Number(next.hncPrice) > 0 ? "fixed" : "quote_required";
    next.priceSourceUrl = row.priceSourceUrl || row.productPageUrl;
    next.hncSupplierUrl = row.productPageUrl;
    next.productPageStatus = "verified-exact-model";
    next.active = true;
    next.selectable = true;
    next.hidden = false;
    next.eligibility = undefined;
    next.retiredAt = undefined;
    next.retirementReason = undefined;
    if (next.imageStatus === "verified-manufacturer-local") next.imageStatus = "verified-official-local";
    // Keep source category text, rather than guessing a replacement taxonomy.
    const categories = row.evidence?.sourceCategories || row.hncCategories || [];
    const subcategory = categories.filter((category) => !["Products", "Kitchen", "Laundry"].includes(category.name?.trim())).at(-1);
    next.subcategory = row.subcategory || subcategory?.name?.trim() || null;
    next.subfamilyName = next.subcategory;
    next.subfamilyId = row.subfamilyId || (subcategory?.url_path?.split("/").at(-1)) || "";
    if (brand === "Euromaid") {
      // Source updates must not leave old legacy dimensions or finishes behind.
      for (const axis of ["width", "height", "depth"]) next[axis] = row[`${axis}Mm`] == null ? null : `${row[`${axis}Mm`]} mm`;
      next.colour = row.finish ?? null;
      next.capacity = row.capacity ?? null;
      next.installationType = row.installationType ?? null;
      next.fuelOrEnergyType = row.fuelOrEnergyType ?? row.specifications.manufacturer?.["Fuel Type"] ?? null;
      next.features = row.features || [];
      next.specifications = { ...row.specifications, features: row.features || [] };
      next.specificationSources.features = sourceStamp;
      if (next.fuelOrEnergyType && row.fuelOrEnergyType == null) next.specificationSources.fuelOrEnergyType = { ...sourceStamp, source: "Euromaid Australia", sourceUrl: row.manufacturerUrl, sourceField: "Fuel Type" };
      next.hncPriceBasis = row.priceLabel;
      next.currentRetailReference = row.hncPrice;
      next.currentRetailReferenceSourceUrl = row.priceSourceUrl;
    }
    if (previous?.sourceRowIds) next.sourceRowIds = previous.sourceRowIds;
    if (previous?.source?.type?.startsWith("legacy")) next.legacySource = previous.legacySource || previous.source;
    if (previous?.legacySource) next.legacySource = previous.legacySource;
    if (previous?.imageStatus && previous.imageSourceUrl !== row.imageSourceUrl) next.previousImageSourceUrl = previous.previousImageSourceUrl || previous.imageSourceUrl;
    incoming.set(key, next);
    (previous ? updated : added).push(row.manufacturerModel);
  }
  catalogue.products = catalogue.products.map((record) => {
    if (record.brandName !== brand) return record;
    const replacement = incoming.get(modelKey(record));
    if (replacement) { incoming.delete(modelKey(record)); return replacement; }
    // User requested stale legacy models be retained for existing jobs but retired
    // from new selections. This does not claim the manufacturer discontinued them.
    if (brand === "Euromaid") {
      retired.push(record.manufacturerModel);
      const legacyEvidence = stage.absentLegacy?.find((item) => item.manufacturerModel === record.manufacturerModel);
      const exactLegacyImage = legacyEvidence?.primaryImage ? { primaryImage: legacyEvidence.primaryImage, imageSourceUrl: legacyEvidence.imageSourceUrl, imageSourceOrganisation: legacyEvidence.imageSourceOrganisation, imageStatus: legacyEvidence.imageStatus, imageCheckedAt: stage.sourceCheckedAt, manufacturerUrl: legacyEvidence.manufacturerUrl } : {};
      return { ...record, ...exactLegacyImage, active: false, selectable: false, hidden: true, retirementReason: "Historical model absent from the complete HNC Euromaid brand range checked 2026-09-16; retained for existing product/package references. No replacement model inferred.", retiredAt: "2026-09-16", hncRangePresence: "not-listed-in-complete-brand-results", hncRangeCheckedAt: "2026-09-16" };
    }
    return record;
  });
  catalogue.products.push(...incoming.values());
  if (brand === "Whirlpool") {
    const evidence = read(path.resolve("data/catalogue/reconciliation/WHIRLPOOL_HNC_RANGE_IMPORT_REPORT.json"));
    assert(evidence.complete && evidence.expectedTotal === stage.products.length, "Whirlpool pagination coverage must be complete");
    const logo = evidence.logo;
    assert(logo?.path && fs.existsSync(path.resolve("public", logo.path.slice(1))));
    const metadata = { brandId: "brand:whirlpool", brandName: "Whirlpool", supplierName: "Whirlpool", homepageUrl: logo.sourcePageUrl, logoUrl: logo.path, logoBackground: "#ffffff", logoSourceUrl: logo.sourcePageUrl, logoSourceOrganisation: logo.sourceOrganisation, logoStatus: "official-source-local", logoCheckedAt: logo.checkedAt, logo: logo.path, logoLocalPath: logo.path, logoSourceAssetUrl: logo.sourceUrl, logoAttribution: logo.sourceOrganisation, active: true, selectable: true };
    const index = brands.brands.findIndex((item) => item.brandName === brand);
    if (index < 0) brands.brands.push(metadata); else brands.brands[index] = { ...brands.brands[index], ...metadata };
  }
  output.brands[brand] = { sourceRecords: stage.products.length, added, updated, retiredHistoricalModels: retired, images: stage.products.filter((record) => record.primaryImage).length, prices: stage.products.filter((record) => Number(record.hncPrice) > 0).length, quoteRequired: stage.products.filter((record) => !(Number(record.hncPrice) > 0)).map((record) => record.manufacturerModel) };
}
const finalById = new Map(catalogue.products.map((record) => [record.productId, record]));
assert.equal(finalById.size, catalogue.products.length, "Duplicate product IDs rejected");
assert.equal(new Set(catalogue.products.map(modelKey)).size, catalogue.products.length, "Duplicate brand/model rows rejected");
for (const previous of baseline) {
  const current = finalById.get(previous.productId);
  assert(current, `Historical ID lost: ${previous.productId}`);
  if (!requested.includes(previous.brandName)) assert.deepEqual(current, previous, `Unrelated brand changed: ${previous.brandName}`);
  for (const field of priceFields) if (Object.hasOwn(previous, field)) assert.equal(current[field], previous[field], `${previous.manufacturerModel}: original ${field} changed`);
}
const packs = read(path.join(dir, "AU-APPLIANCE-PACKS.json"));
for (const pack of packs.packs) for (const id of pack.componentProductIds || []) assert(finalById.has(id), `Unresolved package component ${id}`);
catalogue.hncRangeImports = { ...catalogue.hncRangeImports, ...Object.fromEntries(requested.map((brand) => [brand, { checkedAt: "2026-09-16", count: output.brands[brand].sourceRecords, sourceFile: `AU-${brand.toUpperCase()}-HNC-RANGE.json` }])) };
// Write only after the complete in-memory merge passes identity/preservation checks.
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
write(cataloguePath, catalogue);
if (requested.includes("Whirlpool")) write(brandsPath, brands);
output.productCount = catalogue.products.length;
output.catalogueSha256 = createHash("sha256").update(fs.readFileSync(cataloguePath)).digest("hex");
const reportPath = path.resolve("data/catalogue/reconciliation/HNC_APPLIANCE_INTEGRATION_REPORT.json");
const priorReport = fs.existsSync(reportPath) ? read(reportPath) : {};
write(reportPath, { ...priorReport, ...output, brands: { ...priorReport.brands, ...output.brands } });
console.log(JSON.stringify(output, null, 2));
