import { normalizeMasterProductRecord } from "./catalogueModel.js";
import {
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS,
  PRODUCT_LIBRARY_ROOM_CATEGORIES,
  getProductLibraryRoomCategory,
  productBelongsToRoomCategory,
  resolveProductLibrarySectionForFamily,
  resolveQuotationBuilderMappingForProduct,
} from "./productLibraryTaxonomy.js";

export const PRODUCT_LIBRARY_EXCHANGE_SCHEMA_VERSION = "gr8-product-library-exchange/v1";

export const PRODUCT_LIBRARY_EXCHANGE_COLUMNS = [
  "action",
  "canonical_product_id",
  "product_id",
  "tenant_id",
  "builder_id",
  "external_id",
  "section_id",
  "section_name",
  "room",
  "category_id",
  "category_name",
  "product_type",
  "brand_id",
  "brand_name",
  "range_id",
  "range_name",
  "model",
  "sku",
  "product_name",
  "short_description",
  "full_description",
  "applicable_rooms",
  "client_selectable",
  "quotation_enabled",
  "active",
  "unit",
  "cost_price",
  "price",
  "display_price",
  "tax_status",
  "gst_status",
  "price_effective_date",
  "size",
  "width_mm",
  "height_mm",
  "depth_mm",
  "colour",
  "finish",
  "material",
  "configuration",
  "specifications_json",
  "image_reference",
  "image_url",
  "image_path",
  "thumbnail_image_path",
  "additional_image_urls",
  "specification_url",
  "warranty",
  "package_id",
  "package_name",
  "component_product_ids",
  "source_reference",
  "product_code",
  "price_status",
  "image_status",
  "image_source_url",
  "official_product_url",
  "attributes_json",
  "profile",
];

const APPROVED_IMAGE_STATUS = new Set([
  "verified_exact",
  "verified_range",
  "verified-official-local",
  "verified-authorised-supplier-local",
  "verified-exact-local",
  "official_verified",
  "approved",
]);

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function csvFromRows(rows = []) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function rowsFromCsv(text = "") {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => canonicalColumn(header));
  return rows.slice(1).map((row, rowIndex) => ({
    __rowNumber: rowIndex + 2,
    ...Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])),
  }));
}

export function productLibraryExchangeTemplateRows() {
  return [PRODUCT_LIBRARY_EXCHANGE_COLUMNS];
}

export function productLibraryExchangeFileName({
  scope = "current-filtered",
  category = "",
  brand = "",
  range = "",
  format = "csv",
  packaged = false,
} = {}) {
  const parts = ["product-library", scope, category, brand, range].filter(Boolean).map(slug);
  return `${parts.join("-") || "product-library-export"}.${packaged ? "zip" : format}`;
}

export function filterProductsForProductLibraryExchange(products = [], {
  scope = "current-filtered",
  sectionId = "",
  categoryId = "",
  brand = "",
  range = "",
  currentProducts = [],
  selectedProductIds = [],
  builderId = "",
} = {}) {
  const selectedSet = new Set(selectedProductIds.filter(Boolean));
  const currentSet = new Set(currentProducts.map(productKey).filter(Boolean));
  const section = PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((item) => item.key === sectionId || item.displayName === sectionId) || null;
  const category = categoryId ? getProductLibraryRoomCategory(categoryId) : null;
  return products.filter((product) => {
    if (scope === "current-filtered" && currentSet.size && !currentSet.has(productKey(product))) return false;
    if (scope === "selected" && selectedSet.size && !selectedSet.has(productKey(product))) return false;
    if (scope === "builder-private" && !isBuilderPrivateProduct(product, builderId)) return false;
    if (scope === "missing-images" && approvedProductImage(product)) return false;
    if (scope === "missing-prices" && hasProductPrice(product)) return false;
    if (scope === "inactive" && product.active !== false && product.archived !== true && product.discontinued !== true) return false;
    if (section) {
      const quotationMapping = resolveQuotationBuilderMappingForProduct(product);
      const productSection = resolveProductLibrarySectionForFamily(product.familyKey || product.familyId || "");
      const sectionMatches = quotationMapping.quotationSectionId
        ? quotationMapping.quotationSectionId === section.key
        : productSection?.key === section.key || (section.familyKeys || []).includes(product.familyKey || product.familyId || "");
      if (!sectionMatches) return false;
    }
    if (category && !productBelongsToRoomCategory(product, category)) return false;
    if (brand && product.brand !== brand && product.manufacturer !== brand && product.supplier !== brand) return false;
    if (range && product.range !== range && product.collection !== range) return false;
    return true;
  });
}

export function productToExchangeRow(product = {}, { imagePath = "", thumbnailPath = "", section = null, category = null } = {}) {
  const attributes = product.attributes || {};
  const dimensions = dimensionsFromProduct(product);
  const applicableRooms = product.applicableRoomIds || product.applicableRooms || attributes.applicableRooms || attributes.applicableRoomIds || [];
  const clientSelectable = product.clientSelectable ?? attributes.clientSelectable ?? attributes.selectableStatus !== "reference-only";
  const quotationEnabled = product.quotationEnabled ?? attributes.quotationEnabled ?? true;
  const quotationMapping = resolveQuotationBuilderMappingForProduct(product);
  const exportSection = section || getSectionByKey(quotationMapping.quotationSectionId) || sectionForProduct(product);
  const exportCategory = product.sourceType === "canonical_cabinetry_workflow"
    ? { key: quotationMapping.quotationSubsectionId, name: product.categoryKey }
    : category || categoryForProduct(product);
  return [
    "",
    product.productId || product.productCode || "",
    product.productId || product.productCode || "",
    product.tenantId || product.organisationId || "",
    product.builderId || product.organisationId || "",
    product.externalId || product.sku || product.model || "",
    exportSection?.key || quotationMapping.quotationSectionId || "",
    exportSection?.displayName || quotationMapping.quotationSection || "",
    arrayToList(applicableRooms),
    exportCategory?.key || quotationMapping.quotationSubsectionId || product.categoryKey || "",
    exportCategory?.name || quotationMapping.quotationSubsection || product.category || product.categoryKey || "",
    product.familyKey || product.familyId || "",
    product.brandId || (product.brand ? `brand:${slug(product.brand)}` : ""),
    product.brand || product.manufacturer || product.supplier || "",
    product.rangeId || (product.range ? `range:${slug(product.range)}` : ""),
    product.range || product.collection || "",
    product.model || product.sku || "",
    product.sku || product.model || "",
    product.productName || "",
    product.shortDescription || product.description || "",
    product.fullDescription || product.description || "",
    arrayToList(applicableRooms),
    boolText(clientSelectable !== false),
    boolText(quotationEnabled !== false),
    boolText(product.active !== false && product.archived !== true),
    product.priceUnit || product.unit || "",
    product.builderCost ?? product.costPrice ?? "",
    product.builderPrice ?? product.clientPrice ?? product.displayPrice ?? product.rrp ?? product.normalizedUnitPrice ?? "",
    product.clientPrice ?? product.displayPrice ?? product.rrp ?? product.normalizedUnitPrice ?? "",
    product.taxStatus || product.gstTreatment || (product.gstIncluded === false ? "GST exclusive" : "GST inclusive"),
    product.gstTreatment || (product.gstIncluded === false ? "GST exclusive" : "GST inclusive"),
    product.priceEffectiveDate || "",
    product.size || dimensions.label || "",
    dimensions.width || "",
    dimensions.height || "",
    dimensions.depth || "",
    product.colour || attributes.colour || "",
    product.finish || attributes.finish || "",
    product.material || attributes.material || "",
    product.configuration || attributes.configuration || "",
    safeJson({ ...(attributes.specificationSummary || {}), ...(attributes.specifications || {}) }),
    imagePath || product.primaryImageUrl || product.primaryImage || "",
    product.imageSourceUrl || product.officialProductUrl || product.sourceUrl || product.primaryImageUrl || product.primaryImage || "",
    imagePath,
    thumbnailPath || imagePath || product.thumbnailUrl || product.thumbnailImage || "",
    arrayToList(product.galleryImageUrls || product.additionalImages || []),
    product.specificationUrl || "",
    product.warranty || attributes.warranty || "",
    product.packageId || attributes.packageId || "",
    product.packageName || attributes.packageName || "",
    arrayToList(product.packageComponentIds || attributes.componentProductIds || []),
    product.sourceUrl || product.officialProductUrl || product.imageSourceUrl || "",
    product.productCode || "",
    product.priceStatus || "quote_required",
    product.imageStatus || "missing",
    product.imageSourceUrl || "",
    product.officialProductUrl || "",
    safeJson(attributes),
    product.profile || "",
  ];
}

export function productsToExchangeCsv(products = [], imagePathByProductKey = new Map()) {
  const rows = [PRODUCT_LIBRARY_EXCHANGE_COLUMNS];
  products.forEach((product) => {
    rows.push(productToExchangeRow(product, {
      imagePath: imagePathByProductKey.get(productKey(product))?.imagePath || "",
      thumbnailPath: imagePathByProductKey.get(productKey(product))?.thumbnailPath || "",
      section: sectionForProduct(product),
      category: categoryForProduct(product),
    }));
  });
  return csvFromRows(rows);
}

export function buildProductLibraryExportManifest({
  products = [],
  packagedImages = [],
  missingImages = [],
  scope = {},
  tenantId = "",
  builderId = "",
  schemaVersion = PRODUCT_LIBRARY_EXCHANGE_SCHEMA_VERSION,
} = {}) {
  const productCount = products.length;
  const packageCount = products.filter((product) => product.familyKey === "appliance-packs" || product.attributes?.appliancePack).length;
  return {
    schemaVersion,
    exportDate: new Date().toISOString(),
    tenantId,
    builderId,
    scope,
    totals: {
      products: productCount,
      packages: packageCount,
      productImages: packagedImages.filter((item) => item.kind === "product").length,
      brandLogos: packagedImages.filter((item) => item.kind === "brand-logo").length,
      missingImages: missingImages.length,
      platformProducts: products.filter((product) => !isBuilderPrivateProduct(product, builderId)).length,
      builderPrivateProducts: products.filter((product) => isBuilderPrivateProduct(product, builderId)).length,
    },
    missing_images: missingImages,
    packaged_images: packagedImages.map(({ sourceBlob, ...item }) => item),
  };
}

export async function buildProductLibraryExportPackage({
  products = [],
  scope = {},
  tenantId = "",
  builderId = "",
  includeImages = true,
  format = "csv",
} = {}) {
  const imagePathByProductKey = new Map();
  const missingImages = [];
  const packagedImages = [];

  if (includeImages) {
    for (const product of products) {
      const imageUrl = approvedProductImage(product);
      const key = productKey(product);
      if (!imageUrl) {
        missingImages.push(missingImageEntry(product, "missing_or_unapproved"));
        continue;
      }
      const productAsset = await assetFromUrl(imageUrl, productImageFileName(product, imageUrl), "product");
      if (!productAsset) {
        missingImages.push(missingImageEntry(product, "unreadable_image"));
        continue;
      }
      imagePathByProductKey.set(key, { imagePath: `images/${productAsset.fileName}`, thumbnailPath: `images/${productAsset.fileName}` });
      packagedImages.push({ ...productAsset, productId: product.productId || "", productCode: product.productCode || "", model: product.model || "" });
    }

    for (const logo of uniqueBrandLogos(products)) {
      const logoAsset = await assetFromUrl(logo.url, logoFileName(logo), "brand-logo");
      if (logoAsset) packagedImages.push({ ...logoAsset, brand: logo.brand });
    }
  } else {
    products.forEach((product) => {
      if (!approvedProductImage(product)) missingImages.push(missingImageEntry(product, "missing_or_unapproved"));
    });
  }

  const csv = productsToExchangeCsv(products, imagePathByProductKey);
  const manifest = buildProductLibraryExportManifest({ products, packagedImages, missingImages, scope, tenantId, builderId });

  if (!includeImages) {
    return {
      fileName: productLibraryExchangeFileName({ ...scope, format, packaged: false }),
      contentType: "text/csv;charset=utf-8",
      blobParts: [csv],
      csv,
      manifest,
    };
  }

  const JSZip = await import("jszip");
  const zip = new JSZip.default();
  zip.file("catalogue.csv", csv);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  packagedImages.forEach((asset) => {
    if (!asset.sourceBlob) return;
    zip.file(asset.kind === "brand-logo" ? `brand-logos/${asset.fileName}` : `images/${asset.fileName}`, asset.sourceBlob);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  return {
    fileName: productLibraryExchangeFileName({ ...scope, format: "csv", packaged: true }),
    contentType: "application/zip",
    blob,
    csv,
    manifest,
  };
}

export async function parseProductLibraryPackageFile(file) {
  const fileName = file?.name || "";
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await file.arrayBuffer());
    const csvFile = zip.file("catalogue.csv") || Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv"));
    if (!csvFile) throw new Error("ZIP package does not contain catalogue.csv.");
    const manifestFile = zip.file("manifest.json");
    const manifest = manifestFile ? JSON.parse(await manifestFile.async("string")) : null;
    const rows = rowsFromCsv(await csvFile.async("string"));
    const imagesByKey = await imagesFromZip(zip);
    return { fileName, format: "zip", rows, manifest, imagesByKey };
  }
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }).map((row, index) => ({ __rowNumber: index + 2, ...row }));
    return { fileName, format: "xlsx", rows, manifest: null, imagesByKey: new Map() };
  }
  const text = await file.text();
  if (lowerName.endsWith(".json")) {
    const payload = JSON.parse(text || "{}");
    const products = Array.isArray(payload) ? payload : Array.isArray(payload.products) ? payload.products : [];
    return { fileName, format: "json", rows: products.map((product, index) => ({ __rowNumber: index + 1, ...product })), manifest: payload.manifest || null, imagesByKey: new Map() };
  }
  return { fileName, format: "csv", rows: rowsFromCsv(text), manifest: null, imagesByKey: new Map() };
}

export function previewProductLibraryPackageImport(parsed, existingProducts = [], { tenantId = "", builderId = "", importMode = "update" } = {}) {
  const existingByCanonicalId = new Map();
  const existingByScopedModel = new Map();
  existingProducts.forEach((product) => {
    [product.productId, product.productCode].filter(Boolean).forEach((key) => {
      existingByCanonicalId.set(normalisedKey(key), product);
    });
    const modelKey = scopedBrandModelKey(product, builderId || tenantId);
    if (modelKey) existingByScopedModel.set(modelKey, product);
  });
  const duplicateKeys = duplicateImportKeys(parsed?.rows || []);
  const rows = (parsed?.rows || []).map((row, index) => {
    const normalized = normalizeExchangeRow(row, parsed?.imagesByKey, { tenantId, builderId, fileName: parsed?.fileName || "", importMode });
    const product = {
      ...normalizeMasterProductRecord(normalized),
      organisationId: builderId || tenantId,
      tenantId,
      builderId,
      isCustom: true,
    };
    const existing = existingByCanonicalId.get(normalisedKey(product.productId))
      || existingByCanonicalId.get(normalisedKey(product.productCode))
      || existingByScopedModel.get(scopedBrandModelKey(product, builderId || tenantId))
      || null;
    const issues = validateExchangeProduct(product, row);
    duplicateRowIssues(row, duplicateKeys).forEach((issue) => issues.push(issue));
    const platformOwned = existing && !isBuilderPrivateProduct(existing, builderId);
    const unchanged = existing && productsEquivalentForImport(existing, product);
    const updateAction = platformOwned ? "update-master-reference" : unchanged ? "unchanged" : existing ? "update-builder-private" : "create-builder-private";
    const addAction = "create-builder-private";
    return {
      rowNumber: row.__rowNumber || index + 2,
      valid: !issues.length,
      action: importMode === "add" ? addAction : updateAction,
      product,
      existingProduct: existing || null,
      platformOwned,
      issues,
    };
  });
  return {
    fileName: parsed?.fileName || "",
    format: parsed?.format || "",
    manifest: parsed?.manifest || null,
    totalProducts: rows.length,
    validProducts: rows.filter((row) => row.valid).length,
    newProducts: rows.filter((row) => row.valid && row.action === "create-builder-private").length,
    updatedProducts: rows.filter((row) => row.valid && row.action === "update-builder-private").length,
    masterOverrideProducts: rows.filter((row) => row.valid && row.action === "update-master-reference").length,
    unchangedProducts: rows.filter((row) => row.valid && row.action === "unchanged").length,
    invalidProducts: rows.filter((row) => !row.valid).length,
    duplicateIdsModels: rows.filter((row) => row.issues.some((issue) => issue.field === "canonical_product_id" || issue.field === "model")).length,
    missingPrices: rows.filter((row) => !hasProductPrice(row.product)).length,
    missingImages: rows.filter((row) => !approvedProductImage(row.product)).length,
    rows,
  };
}

export function commitProductLibraryPackageImport(preview, existingProducts = []) {
  const byCode = new Map(existingProducts.map((product) => [product.productCode, product]));
  const created = [];
  const updated = [];
  const masterOverrides = [];
  const skipped = [];
  const invalid = [];
  (preview?.rows || []).forEach((row) => {
    if (!row.valid) {
      invalid.push(row);
      return;
    }
    if (row.action === "unchanged") {
      skipped.push(row.product);
      return;
    }
    if (row.action === "update-master-reference") {
      masterOverrides.push(row);
      return;
    }
    const existed = byCode.has(row.product.productCode);
    byCode.set(row.product.productCode, row.product);
    if (existed) updated.push(row.product);
    else created.push(row.product);
  });
  return { products: Array.from(byCode.values()), created, updated, masterOverrides, skipped, invalid };
}

function normalizeExchangeRow(row = {}, imagesByKey = new Map(), { tenantId = "", builderId = "", fileName = "", importMode = "update" } = {}) {
  const model = row.model || row.sku || row.external_id || "";
  const fallbackId = builderScopedProductId({ tenantId, builderId, brand: row.brand_name || row.brand, model, sku: row.sku || row.external_id });
  const productId = importMode === "add"
    ? fallbackId
    : row.canonical_product_id || row.product_id || row.productId || row.product_code || row.productCode || fallbackId;
  const productCode = importMode === "add"
    ? productId
    : row.product_code || row.productCode || row.canonical_product_id || row.product_id || productId || model;
  const imagePath = row.image_path || row.primary_image_path || row.image_reference || "";
  const matchedImage = imagePath ? imagesByKey.get(normalisedPath(imagePath)) || imagesByKey.get(normalisedKey(productId)) || imagesByKey.get(normalisedKey(model)) : "";
  const importedAt = new Date().toISOString();
  return {
    product_id: productId,
    product_code: productCode,
    stable_product_id: productId,
    family_key: row.family_key || row.product_type || familyKeyFromCategory(row.category_id, row.category_name, row.section_id),
    category_key: row.category_id || row.category_name || "",
    top_level_area: row.top_level_area || topLevelAreaFromSection(row.section_id),
    manufacturer: row.brand_name || row.manufacturer || row.supplier || "",
    brand: row.brand_name || row.brand || "",
    supplier: row.supplier || row.brand_name || row.brand || "",
    range: row.range_name || row.range || "",
    product_name: row.product_name || row.name || "",
    model,
    sku: row.sku || row.external_id || model,
    description: row.full_description || row.short_description || row.description || "",
    colour: row.colour || "",
    finish: row.finish || "",
    size: row.size || "",
    profile: row.profile || "",
    dimensions: dimensionsLabel(row),
    configuration: row.configuration || "",
    material: row.material || "",
    primary_image_url: matchedImage || row.image_reference || row.image_url || "",
    thumbnail_url: matchedImage || row.thumbnail_image_path || row.image_reference || row.image_url || "",
    image_source_url: row.image_source_url || row.source_reference || row.image_url || row.image_reference || "",
    image_source_type: matchedImage ? "builder_private_zip_import" : row.image_source_type || "",
    image_verified_at: matchedImage ? importedAt : row.image_verified_at || "",
    image_status: matchedImage ? "verified_exact" : row.image_status || (row.image_reference || row.image_url ? "review_required" : "missing"),
    official_product_url: row.official_product_url || row.product_url || row.source_reference || "",
    specification_url: row.specification_url || "",
    client_price: row.price || row.display_price || "",
    rrp: row.price || row.display_price || "",
    currency: row.currency || "AUD",
    gst_included: row.tax_status || row.gst_status ? !/excl/i.test(row.tax_status || row.gst_status) : true,
    price_unit: row.unit || "",
    normalized_unit_price: row.price || row.display_price || "",
    price_status: row.price_status || (row.price || row.display_price ? "current" : "quote_required"),
    price_effective_date: row.price_effective_date || "",
    regions: row.regions || "AU",
    active: row.active,
    source_type: "builder_private_import",
    source_name: fileName,
    source_url: row.source_reference || "",
    source_verified_at: importedAt,
    source_scope: "builder_private_product_library",
    attributes: {
      ...parseMaybeJson(row.attributes_json),
      applicableRooms: splitList(row.applicable_rooms || row.room),
      clientSelectable: parseBoolean(row.client_selectable, true),
      quotationEnabled: parseBoolean(row.quotation_enabled, true),
      specifications: parseMaybeJson(row.specifications_json),
      packageId: row.package_id || "",
      packageName: row.package_name || "",
      componentProductIds: splitList(row.component_product_ids),
      importedTenantId: tenantId,
      importedBuilderId: builderId,
      importedAt,
      originalFileName: fileName,
      catalogueVersion: PRODUCT_LIBRARY_EXCHANGE_SCHEMA_VERSION,
    },
    organisationId: builderId || tenantId,
    tenantId,
    builderId,
    isCustom: true,
  };
}

async function imagesFromZip(zip) {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && /^images\//i.test(entry.name));
  const images = new Map();
  for (const entry of entries) {
    const ext = extensionFromPath(entry.name) || "png";
    const mime = mimeFromExtension(ext);
    const dataUrl = `data:${mime};base64,${await entry.async("base64")}`;
    images.set(normalisedPath(entry.name), dataUrl);
    images.set(normalisedKey(fileBaseName(entry.name)), dataUrl);
  }
  return images;
}

async function assetFromUrl(url = "", fileName = "", kind = "product") {
  if (!url || !fileName) return null;
  try {
    if (url.startsWith("data:")) {
      const [, meta = "", base64 = ""] = url.match(/^data:([^;]+);base64,(.*)$/) || [];
      if (!base64) return null;
      const mime = meta || mimeFromExtension(extensionFromPath(fileName));
      return { kind, fileName: ensureExtension(fileName, mime), mimeType: mime, sourceUrl: url.slice(0, 64), sourceBlob: base64ToUint8Array(base64) };
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size || !String(blob.type || "").startsWith("image/")) return null;
    return { kind, fileName: ensureExtension(fileName, blob.type), mimeType: blob.type, size: blob.size, sourceUrl: url, sourceBlob: blob };
  } catch {
    return null;
  }
}

function approvedProductImage(product = {}) {
  const url = product.primaryImageUrl || product.primaryImage || product.primary_image_url || product.image || "";
  const status = String(product.imageStatus || product.image_status || product.verificationStatus || "").toLowerCase();
  if (!url || /^data:image\/svg/i.test(url)) return "";
  if (/fallback|placeholder|awaiting|logo|brand-logo/i.test(url)) return "";
  if (!APPROVED_IMAGE_STATUS.has(status) && !/verified|exact|official|approved/i.test(status)) return "";
  return url;
}

function uniqueBrandLogos(products = []) {
  const logos = new Map();
  products.forEach((product) => {
    const brand = product.brand || product.manufacturer || product.supplier || "";
    const url = product.brandLogoUrl || product.logoUrl || product.attributes?.brandLogoUrl || product.attributes?.brandLogo || "";
    if (brand && url && !logos.has(`${brand}:${url}`)) logos.set(`${brand}:${url}`, { brand, url });
  });
  return Array.from(logos.values());
}

function productImageFileName(product = {}, imageUrl = "") {
  const key = product.model || product.productCode || product.productId || product.sku || product.productName || "product";
  return `${slug(key)}.${extensionFromDataUrl(imageUrl) || extensionFromPath(imageUrl) || "jpg"}`;
}

function logoFileName(logo = {}) {
  return `${slug(logo.brand || "brand")}-logo.${extensionFromDataUrl(logo.url) || extensionFromPath(logo.url) || "png"}`;
}

function sectionForProduct(product = {}) {
  const familyKey = product.familyKey || product.familyId || "";
  return PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((section) => (section.familyKeys || []).includes(familyKey)) || null;
}

function getSectionByKey(sectionKey = "") {
  return PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((section) => section.key === sectionKey) || null;
}

function categoryForProduct(product = {}) {
  return PRODUCT_LIBRARY_ROOM_CATEGORIES.find((category) => productBelongsToRoomCategory(product, category)) || null;
}

function familyKeyFromCategory(categoryId = "", categoryName = "", sectionId = "") {
  const category = getProductLibraryRoomCategory(categoryId) || PRODUCT_LIBRARY_ROOM_CATEGORIES.find((item) => item.name === categoryName);
  if (category?.familyKeys?.length) return category.familyKeys[0];
  const section = PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((item) => item.key === sectionId || item.displayName === sectionId);
  return section?.familyKeys?.[0] || "";
}

function topLevelAreaFromSection(sectionId = "") {
  if (/appliance|cabinet|benchtop|plumbing/i.test(sectionId)) return "kitchen";
  if (/external|roof|window/i.test(sectionId)) return "exterior";
  return "";
}

function dimensionsFromProduct(product = {}) {
  const dimensions = product.dimensions || {};
  if (typeof dimensions === "object" && dimensions) {
    return { width: dimensions.width || product.width || "", height: dimensions.height || product.height || "", depth: dimensions.depth || product.depth || "", label: "" };
  }
  return { width: product.width || "", height: product.height || "", depth: product.depth || "", label: dimensions || "" };
}

function dimensionsLabel(row = {}) {
  return [row.width_mm && `W${row.width_mm}mm`, row.height_mm && `H${row.height_mm}mm`, row.depth_mm && `D${row.depth_mm}mm`].filter(Boolean).join(" x ");
}

function hasProductPrice(product = {}) {
  return product.clientPrice != null || product.rrp != null || product.normalizedUnitPrice != null || product.priceStatus === "quote_required";
}

function isBuilderPrivateProduct(product = {}, builderId = "") {
  return Boolean(product.isCustom || product.organisationId || product.builderId || (builderId && product.tenantId === builderId));
}

function productOwnerKey(product = {}, fallbackOwner = "") {
  return product.builderId || product.organisationId || product.tenantId || fallbackOwner || "platform-master";
}

function scopedBrandModelKey(product = {}, fallbackOwner = "") {
  const brand = product.brand || product.brandName || product.manufacturer || product.supplier || "";
  const model = product.model || product.sku || product.externalId || "";
  const owner = productOwnerKey(product, fallbackOwner);
  if (!brand || !model || !owner) return "";
  return normalisedKey([owner, brand, model].join("::"));
}

function validateExchangeProduct(product = {}, raw = {}) {
  const issues = [];
  if (!product.productCode && !product.productId) issues.push({ field: "product_id", problem: "Product ID or model is required." });
  if (!product.familyKey) issues.push({ field: "category_id", problem: "Could not resolve Product Library family/category." });
  if (!product.productName) issues.push({ field: "product_name", problem: "Product name is required." });
  if (!product.brand) issues.push({ field: "brand_name", problem: "Brand is required." });
  if (raw.display_price && !Number.isFinite(Number(String(raw.display_price).replace(/[$,]/g, "")))) issues.push({ field: "display_price", problem: "Display price is not numeric." });
  return issues;
}

function duplicateImportKeys(rows = []) {
  const ids = new Map();
  const models = new Map();
  rows.forEach((row) => {
    const id = normalisedKey(row.canonical_product_id || row.product_id || row.productId || row.product_code || row.productCode);
    const model = normalisedKey([row.brand_name || row.brand, row.model || row.sku || row.external_id].filter(Boolean).join("::"));
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    if (!id && model) models.set(model, (models.get(model) || 0) + 1);
  });
  return { ids, models };
}

function duplicateRowIssues(row = {}, duplicateKeys = {}) {
  const issues = [];
  const id = normalisedKey(row.canonical_product_id || row.product_id || row.productId || row.product_code || row.productCode);
  const model = normalisedKey([row.brand_name || row.brand, row.model || row.sku || row.external_id].filter(Boolean).join("::"));
  if (id && duplicateKeys.ids?.get(id) > 1) issues.push({ field: "canonical_product_id", problem: "Duplicate canonical product ID in import file." });
  if (!id && model && duplicateKeys.models?.get(model) > 1) issues.push({ field: "model", problem: "Duplicate brand + model/SKU in import file." });
  return issues;
}

function productsEquivalentForImport(existing = {}, imported = {}) {
  return comparableProduct(existing).join("\u001f") === comparableProduct(imported).join("\u001f");
}

function comparableProduct(product = {}) {
  return [
    product.productId || "",
    product.productCode || "",
    product.brand || product.manufacturer || "",
    product.range || "",
    product.model || product.sku || "",
    product.productName || "",
    product.description || "",
    product.builderPrice ?? product.clientPrice ?? product.normalizedUnitPrice ?? product.rrp ?? "",
    product.priceUnit || "",
    product.primaryImageUrl || product.primaryImage || "",
    product.imageStatus || "",
    product.active !== false && product.archived !== true ? "active" : "inactive",
  ].map((value) => String(value ?? "").trim());
}

function builderScopedProductId({ tenantId = "", builderId = "", brand = "", model = "", sku = "" } = {}) {
  const owner = slug(builderId || tenantId || "builder");
  const brandSlug = slug(brand || "brand");
  const modelSlug = slug(model || sku || "product");
  return `builder-${owner}-${brandSlug}-${modelSlug}`;
}

function missingImageEntry(product = {}, reason = "missing") {
  return {
    product_id: product.productId || "",
    product_code: product.productCode || "",
    model: product.model || product.sku || "",
    product_name: product.productName || "",
    brand: product.brand || product.manufacturer || product.supplier || "",
    reason,
  };
}

function productKey(product = {}) {
  return product.productId || product.productCode || product.model || product.sku || "";
}

function normalisedKey(value = "") {
  return slug(value).replace(/-/g, "");
}

function normalisedPath(value = "") {
  return String(value || "").replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

function extensionFromPath(value = "") {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "";
}

function extensionFromDataUrl(value = "") {
  const match = String(value || "").match(/^data:([^;]+);base64,/i);
  return match ? IMAGE_EXTENSION_BY_MIME[match[1].toLowerCase()] || "" : "";
}

function ensureExtension(fileName = "", mimeType = "") {
  if (extensionFromPath(fileName)) return fileName;
  return `${fileName}.${IMAGE_EXTENSION_BY_MIME[mimeType] || "jpg"}`;
}

function mimeFromExtension(ext = "") {
  const clean = String(ext || "").toLowerCase().replace(/^\./, "");
  if (clean === "jpg" || clean === "jpeg") return "image/jpeg";
  if (clean === "webp") return "image/webp";
  if (clean === "gif") return "image/gif";
  if (clean === "svg") return "image/svg+xml";
  return "image/png";
}

function fileBaseName(path = "") {
  return String(path || "").split("/").pop().replace(/\.[^.]+$/, "");
}

function base64ToUint8Array(base64 = "") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function splitList(value = "") {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(/[|;,]/).map((item) => item.trim()).filter(Boolean);
}

function arrayToList(value = []) {
  return Array.isArray(value) ? value.filter(Boolean).join("|") : String(value || "");
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(true|yes|1|y)$/i.test(String(value));
}

function boolText(value) {
  return value ? "TRUE" : "FALSE";
}

function parseMaybeJson(value = "") {
  if (!value || typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function safeJson(value = {}) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

function parseCsv(text = "") {
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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function canonicalColumn(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function slug(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
