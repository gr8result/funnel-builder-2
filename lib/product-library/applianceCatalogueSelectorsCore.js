export const APPLIANCE_IMAGE_FALLBACK_LABEL = "Exact product image required";

export const APPLIANCE_ELIGIBILITY_STATES = [
  "active-selectable",
  "active-reference-only",
  "draft",
  "legacy",
  "discontinued",
  "hidden",
  "verification-required",
];

export const APPLIANCE_FAMILIES = [
  { familyId: "ovens", name: "Ovens", icon: "Oven" },
  { familyId: "cooktops", name: "Cooktops", icon: "Flame" },
  { familyId: "rangehoods", name: "Rangehoods", icon: "Wind" },
  { familyId: "dishwashers", name: "Dishwashers", icon: "Droplets" },
  { familyId: "freestanding-cookers", name: "Freestanding Cookers", icon: "PanelTop" },
  { familyId: "microwaves", name: "Microwaves", icon: "Microwave" },
  { familyId: "fridges", name: "Refrigerators", icon: "Refrigerator" },
  { familyId: "appliance-packs", name: "Appliance Packs", icon: "Package" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function productVerificationReasons(record = {}) {
  const reasons = [];
  if (!record.productId) reasons.push("missing stable product ID");
  if (!record.familyId) reasons.push("missing appliance family");
  if (!record.brandName) reasons.push("missing brand");
  if (!record.productName) reasons.push("missing product/model name");
  if (record.manualReviewRequired) reasons.push(record.manualReviewReason || "manual verification required");
  if (record.imageStatus === "pending-licence") reasons.push("product image pending supplier licence verification");
  if (record.imageStatus === "exact-image-unavailable") reasons.push("exact product image unavailable from verified sources");
  if (record.descriptionStatus !== "verified-complete") reasons.push(`description status ${record.descriptionStatus || "unknown"}`);
  if (record.specificationStatus !== "complete") reasons.push(`specification status ${record.specificationStatus || "unknown"}`);
  return uniqueSorted(reasons);
}

export function resolveApplianceCatalogueEligibility(record = {}) {
  if (!record || typeof record !== "object") return "hidden";
  if (record.hidden === true || record.active === false) return "hidden";
  const reasons = productVerificationReasons(record);
  if (!record.productId || !record.familyId || !record.brandName || !record.productName) return "draft";
  if (record.source?.type?.startsWith("legacy") && record.productPageStatus !== "verified-exact-model") return "legacy";
  if (reasons.length) return "verification-required";
  if (record.selectable === false) return "active-reference-only";
  return "active-selectable";
}

export function applianceProductToCatalogueRecord(record = {}) {
  const eligibility = resolveApplianceCatalogueEligibility(record);
  const specs = record.specifications || {};
  const hasApprovedImage = Boolean(record.primaryImage) && [
    "verified-official-local",
    "verified-authorised-supplier-local",
    "verified-exact-local",
  ].includes(record.imageStatus);
  return {
    ...record,
    recordType: "appliance-product",
    stableProductId: record.productId || "",
    productId: record.productId || "",
    productCode: record.productId || "",
    categoryId: record.categoryId || "category:appliances",
    familyId: record.familyId || "",
    familyName: APPLIANCE_FAMILIES.find((family) => family.familyId === record.familyId)?.name || record.familyId || "Appliances",
    supplier: record.supplierName || record.brandName || "",
    brand: record.brandName || "",
    range: record.rangeName || "",
    model: record.manufacturerModel || record.sku || "",
    name: record.productName || "",
    description: record.fullDescription || record.shortDescription || record.productName || "",
    image: hasApprovedImage ? record.primaryImage : "",
    imageFallbackLabel: hasApprovedImage ? "" : APPLIANCE_IMAGE_FALLBACK_LABEL,
    unit: record.unit || "EACH",
    price: record.tenantSellPrice ?? record.sellPrice ?? null,
    priceStatus: record.priceStatus || "price_pending",
    sourceCostPrice: record.sourceCostPrice ?? record.importedSourceCost ?? null,
    applicableRooms: Array.isArray(record.applicableRooms) ? record.applicableRooms : ["kitchen"],
    selectableStatus: eligibility === "active-selectable" ? "client-selectable" : "not-client-selectable",
    eligibility,
    eligibilityReasons: productVerificationReasons(record),
    discontinued: false,
    discontinuedStatus: record.discontinuedStatus || "",
    discontinuedReviewFlag: record.discontinued === true,
    verificationStatus: record.research?.verificationStatus || record.descriptionStatus || "verification-required",
    sourcePlatform: "platform-master",
    tenantId: "",
    sourceCheckedAt: record.sourceCheckedAt || record.imageCheckedAt || record.research?.checkedAt || "",
    productPageUrl: record.productPageUrl || "",
    documentUrls: Array.isArray(record.documentUrls) ? record.documentUrls : [],
    imageAttribution: record.imageSourceOrganisation || record.research?.sourceOrganisation || "",
    width: record.width || specs.width || "",
    widthMm: record.widthMm ?? specs.widthMm ?? null,
    height: record.height || specs.height || "",
    heightMm: record.heightMm ?? specs.heightMm ?? null,
    depth: record.depth || specs.depth || "",
    depthMm: record.depthMm ?? specs.depthMm ?? null,
    finish: record.finish || specs.finish || "",
    fuelOrEnergyType: record.fuelOrEnergyType || specs.fuelOrEnergyType || specs.fuelType || specs.cooktopFuel || "",
    installationType: record.installationType || specs.installationType || "",
    specificationSummary: specs,
  };
}

function applianceComponentSummary(record = {}, productId = "") {
  return {
    productId: record.productId || productId,
    productCode: record.productCode || record.productId || productId,
    brand: record.brand || record.brandName || "",
    model: record.model || record.manufacturerModel || "",
    name: record.name || record.productName || productId,
    familyId: record.familyId || "",
    familyName: record.familyName || "",
    unit: record.unit || "EACH",
    price: record.price ?? record.tenantSellPrice ?? record.sellPrice ?? null,
    priceStatus: record.priceStatus || "",
    image: record.image || "",
    imageFallbackLabel: record.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL,
    eligibility: record.eligibility || "verification-required",
    verificationStatus: record.verificationStatus || "",
  };
}

export function filterApplianceRecords(recordsToFilter = [], filters = {}) {
  return (Array.isArray(recordsToFilter) ? recordsToFilter : []).filter((record) => {
    const search = lower(filters.search);
    const haystack = [
      record.model,
      record.manufacturerModel,
      record.name,
      record.productName,
      record.familyId,
      record.familyName,
      record.brand,
      record.brandName,
      record.width,
      record.widthMm,
      record.fuelOrEnergyType,
      record.installationType,
      record.finish,
      record.eligibility,
      record.verificationStatus,
      record.selectableStatus,
      record.sourcePlatform,
      record.tenantId,
    ].join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (filters.family && record.familyId !== filters.family) return false;
    if (filters.productType && record.familyId !== filters.productType) return false;
    if (filters.brand && lower(record.brand || record.brandName) !== lower(filters.brand)) return false;
    if (filters.width && !lower(record.width || record.widthMm).includes(lower(filters.width))) return false;
    if (filters.fuel && !lower(record.fuelOrEnergyType).includes(lower(filters.fuel))) return false;
    if (filters.install && !lower(record.installationType).includes(lower(filters.install))) return false;
    if (filters.finish && !lower(record.finish).includes(lower(filters.finish))) return false;
    if (filters.status && record.eligibility !== filters.status) return false;
    if (filters.verification && lower(record.verificationStatus) !== lower(filters.verification)) return false;
    if (filters.selectable && record.selectableStatus !== filters.selectable) return false;
    if (filters.sourcePlatform && record.sourcePlatform !== filters.sourcePlatform) return false;
    if (filters.tenantId && record.tenantId !== filters.tenantId) return false;
    return true;
  }).sort((left, right) => {
    if (filters.sort === "price-asc") return (Number(left.price) || 0) - (Number(right.price) || 0);
    if (filters.sort === "price-desc") return (Number(right.price) || 0) - (Number(left.price) || 0);
    return (left.name || left.productName || "").localeCompare(right.name || right.productName || "");
  });
}

export function createApplianceCatalogueSelectors({ productCatalogue = {}, packCatalogue = {}, brandCatalogue = {} } = {}) {
  const brandMetadata = Array.isArray(brandCatalogue.brands) ? brandCatalogue.brands : [];
  const brandByName = new Map(brandMetadata.map((brand) => [lower(brand.brandName), brand]));

  function attachBrandMetadata(record = {}) {
    const brand = brandByName.get(lower(record.brand || record.brandName));
    if (!brand) return record;
    return {
      ...record,
      brandId: record.brandId || brand.brandId || "",
      brandLogo: record.brandLogo || brand.logoUrl || "",
      logo: record.logo || brand.logoUrl || "",
      logoUrl: record.logoUrl || brand.logoUrl || "",
      logoBackground: record.logoBackground || brand.logoBackground || "",
      brandHomepageUrl: record.brandHomepageUrl || brand.homepageUrl || "",
      brandLogoStatus: record.brandLogoStatus || brand.logoStatus || "",
      brandLogoSourceUrl: record.brandLogoSourceUrl || brand.logoSourceUrl || "",
    };
  }

  function clientVisibleRecord(record = {}) {
    return record.active !== false
      && record.selectable !== false
      && !record.hidden
      && !["hidden", "draft"].includes(record.eligibility);
  }

  function records() {
    return (productCatalogue.products || []).map(applianceProductToCatalogueRecord).map(attachBrandMetadata);
  }

  function getAppliancePacks() {
    const productById = new Map(records().map((record) => [record.productId, record]));
    return (packCatalogue.packs || []).map((pack) => {
      const packageRelationships = Array.isArray(pack.componentRelationships) && pack.componentRelationships.length
        ? pack.componentRelationships
        : (pack.componentProductIds || []).map((componentProductId, index) => ({ componentProductId, componentOrder: index + 1, sourceRowId: "" }));
      const components = packageRelationships.map((relationship) => {
        const componentId = relationship.componentProductId || relationship.productId || "";
        return {
          relationshipId: relationship.relationshipId || "",
          sourceRowId: relationship.sourceRowId || "",
          ...(productById.get(componentId) || {
            productId: componentId,
            name: componentId,
            eligibility: "verification-required",
            eligibilityReasons: ["component product ID does not resolve"],
          }),
        };
      }).map((component) => applianceComponentSummary(component, component.productId));
      const componentWarnings = components.flatMap((component) => (
        component.eligibility === "active-selectable" ? [] : [`${component.model || component.name || component.productId}: ${component.eligibility}`]
      ));
      return attachBrandMetadata({
        ...pack,
        recordType: "appliance-pack",
        familyId: "appliance-packs",
        familyName: "Appliance Packs",
        stableProductId: pack.packId || pack.productId || "",
        productId: pack.productId || pack.packId || "",
        productCode: pack.productId || pack.packId || "",
        brand: pack.brandName || pack.brand || "",
        supplier: pack.brandName || pack.brand || "",
        model: "",
        name: pack.packName || "",
        description: pack.fullDescription || pack.description || pack.packName || "",
        unit: "PACK",
        price: pack.sourcePackPrice ?? pack.tenantSellPrice ?? null,
        priceStatus: pack.priceStatus || "price_pending",
        sourceCostPrice: pack.importedSourceCost ?? null,
        image: "",
        imageFallbackLabel: APPLIANCE_IMAGE_FALLBACK_LABEL,
        applicableRooms: ["kitchen"],
        componentProductIds: packageRelationships.map((relationship) => relationship.componentProductId || relationship.productId || "").filter(Boolean),
        componentRelationships: packageRelationships,
        components,
        componentWarnings,
        eligibility: componentWarnings.length ? "verification-required" : "active-selectable",
        eligibilityReasons: componentWarnings.length ? ["pack contains legacy or unverified component products"] : [],
        selectableStatus: componentWarnings.length ? "not-client-selectable" : "client-selectable",
        sourcePlatform: "platform-master",
        sourceCheckedAt: pack.sourceCheckedAt || packCatalogue.sourceCheckedAt || "",
      });
    });
  }

  function getApplianceRecordsByFamily(familyId) {
    if (familyId === "appliance-packs") return getAppliancePacks();
    return records().filter((record) => record.familyId === familyId);
  }

  return {
    getPlatformMasterApplianceRecords: () => records(),
    getAdministrativeApplianceRecords: () => records(),
    getActiveProductLibraryApplianceRecords: () => records().filter((record) => !["hidden", "draft"].includes(record.eligibility)),
    getClientSelectableApplianceRecords: () => records().filter(clientVisibleRecord),
    getClientVisibleApplianceRecords: ({ tenantRecords = [], includeBuilderApprovedLegacy = false, approvedLegacyIds = [] } = {}) => {
      const approvedLegacy = new Set(approvedLegacyIds);
      const tenantVisible = (Array.isArray(tenantRecords) ? tenantRecords : [])
        .map((record) => ({
          ...applianceProductToCatalogueRecord(record),
          sourcePlatform: "tenant",
          tenantId: record.tenantId || record.organisationId || "",
        }))
        .map(attachBrandMetadata)
        .filter(clientVisibleRecord);
      const platformVisible = records().filter((record) => (
        clientVisibleRecord(record)
        || (includeBuilderApprovedLegacy && approvedLegacy.has(record.productId))
      ));
      return [...platformVisible, ...tenantVisible];
    },
    getLegacyQuotationCompatibleApplianceRecords: () => records().filter((record) => record.source?.type?.startsWith("legacy") || ["legacy", "verification-required", "discontinued"].includes(record.eligibility)),
    getApplianceRecordsRequiringVerification: () => records().filter((record) => ["verification-required", "draft", "legacy", "discontinued"].includes(record.eligibility) || record.eligibilityReasons.length),
    getTenantSpecificApplianceRecords: (tenantRecords = []) => (Array.isArray(tenantRecords) ? tenantRecords : []).map((record) => ({
      ...applianceProductToCatalogueRecord(record),
      sourcePlatform: "tenant",
      tenantId: record.tenantId || record.organisationId || "",
    })),
    getApplianceFamilies: ({ includePacks = true } = {}) => {
      const productRows = records();
      const packRows = includePacks ? getAppliancePacks() : [];
      return APPLIANCE_FAMILIES
        .filter((family) => family.familyId !== "appliance-packs" || includePacks)
        .map((family) => {
          const familyProducts = productRows.filter((record) => record.familyId === family.familyId);
          const familyPacks = family.familyId === "appliance-packs" ? packRows : [];
          const brands = uniqueSorted([...familyProducts.map((record) => record.brand), ...familyPacks.map((pack) => pack.brand)]);
          const activeCount = [...familyProducts, ...familyPacks].filter((record) => ["active-selectable", "active-reference-only"].includes(record.eligibility)).length;
          return { ...family, productCount: familyProducts.length + familyPacks.length, activeCount, brandCount: brands.length };
        })
        .filter((family) => includePacks || family.familyId !== "appliance-packs");
    },
    getApplianceRecordsByFamily,
    getApplianceBrandByName: (brandName) => brandByName.get(lower(brandName)) || null,
    getApplianceBrands: ({ familyId = "" } = {}) => {
      const productRows = familyId ? getApplianceRecordsByFamily(familyId) : [...records(), ...getAppliancePacks()];
      const countsByBrand = productRows.reduce((counts, record) => {
        const brand = record.brand || record.brandName;
        if (brand) counts.set(brand, (counts.get(brand) || 0) + 1);
        return counts;
      }, new Map());
      return Array.from(countsByBrand.entries())
        .map(([brandName, count]) => ({
          ...(brandByName.get(lower(brandName)) || {
            brandId: `brand:${lower(brandName).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
            brandName,
            supplierName: brandName,
            homepageUrl: "",
            logoUrl: "",
            logoSourceUrl: "",
            logoSourceOrganisation: "",
            logoStatus: "missing",
            logoCheckedAt: "",
          }),
          count,
        }))
        .sort((left, right) => left.brandName.localeCompare(right.brandName));
    },
    getApplianceBrandsByFamily: (familyId) => uniqueSorted(getApplianceRecordsByFamily(familyId).map((record) => record.brand || record.brandName)),
    getApplianceModelsByFamilyAndBrand: (familyId, brand) => {
      const brandKey = lower(brand);
      return getApplianceRecordsByFamily(familyId)
        .filter((record) => !brandKey || lower(record.brand || record.brandName) === brandKey)
        .sort((left, right) => (left.model || left.name).localeCompare(right.model || right.name));
    },
    getApplianceProductById: (productId) => {
      const key = clean(productId);
      return [...records(), ...getAppliancePacks()].find((record) => record.productId === key || record.packId === key) || null;
    },
    getAppliancePacks,
  };
}
