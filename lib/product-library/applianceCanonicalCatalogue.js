import {
  parseApplianceLegacyCsv,
  reconcileApplianceLegacyRecords,
} from "../construction-estimation/catalogues/applianceLegacyCsv.js";

export const APPLIANCE_CANONICAL_SCHEMA_VERSION = "product-library.appliance-catalogue.v1";
export const APPLIANCE_PACK_SCHEMA_VERSION = "product-library.appliance-pack-catalogue.v1";
export const APPLIANCE_SOURCE_CHECKED_AT = "2026-09-03";

const SOURCE_ORGANISATION = "Legacy appliance options CSV";
const VERIFIED_PRODUCT_SOURCES = Object.freeze({
  "Ariston::NIO 844 DO B AUS": {
    sourceUrl: "https://ariston.com.au/inventory/nio844dob/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Ariston Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "archived-or-runout",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 785, heightMm: 51, depthMm: 520, cookingZonesOrBurners: 4, controls: "touch control", cookingTechnology: "induction" },
  },
  "Ariston::PC640NTX": {
    sourceUrl: "https://ariston.com.au/inventory/pc640ntx/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Ariston Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "archived-or-runout",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 555, heightMm: 390, depthMm: 475, cookingZonesOrBurners: 4, controls: "one hand electronic ignition", cookingTechnology: "gas" },
  },
  "Ariston::CP059MDX": {
    sourceUrl: "https://ariston.com.au/inventory/freestanding-cooker-cp059mdx-2/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Ariston Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "archived-or-runout",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, heightMm: 850, depthMm: 600, capacity: "90 L gross", cookingZonesOrBurners: 5, functions: 8, cooktopFuel: "gas", ovenFuel: "electric", cleaningSystem: "catalytic liners" },
  },
  "Euromaid::EO605DTB": {
    sourceUrl: "https://www.euromaid.com/en-au/60cm-5-function-built-in-oven-dark-stainless",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Euromaid Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, capacity: "92 L", functions: 5, finish: "dark stainless" },
  },
  "Omega::OF916FX": {
    sourceUrl: "https://omegaappliances.com.au/product/90cm-9-function-freestanding-oven-of916fx/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Omega Appliances Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, capacity: "153 L", functions: 9, cookingZonesOrBurners: 5, cooktopFuel: "gas", ovenFuel: "electric", finish: "stainless steel", electricalRequirements: "15 amp plug" },
  },
  "Smeg::PGA64": {
    sourceUrl: "https://www.smeg.com/au/products/PGA64",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, cookingTechnology: "gas", cookingZonesOrBurners: 4, finish: "stainless steel", controls: "knobs" },
  },
  "Smeg::SAI4954D": {
    sourceUrl: "https://www.smeg.com/au/products/SAI4954D",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, cookingTechnology: "induction", finish: "black" },
  },
  "Smeg::DWAU6315X3": {
    sourceUrl: "https://www.smeg.com/au/products/DWAU6315X3",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, installationType: "under counter built-in" },
  },
  "Smeg::FS9606AS-1": {
    sourceUrl: "https://www.smeg.com/au/products/FS9606AS-1",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, depthMm: 600, cookingZonesOrBurners: 5, cooktopFuel: "gas", ovenFuel: "electric" },
  },
  "Smeg::PUM601X": {
    sourceUrl: "https://www.smeg.com/au/products/PUM601X",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, hoodType: "integrated", finish: "stainless steel" },
  },
  "Smeg::SHW610X1": {
    sourceUrl: "https://www.smeg.com/au/products/SHW610X1",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, hoodType: "wallmount canopy", finish: "stainless steel" },
  },
  "Smeg::SHW910X2": {
    sourceUrl: "https://www.smeg.com/au/products/SHW910X2",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Smeg Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: false,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, hoodType: "wallmount canopy", finish: "stainless steel" },
  },
  "Westinghouse::WHC642BC": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/cooktops/whc642bc/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 590, heightMm: 46, depthMm: 520, cookingTechnology: "ceramic", cookingZonesOrBurners: 4, finish: "black ceramic glass", controls: "knob control" },
  },
  "Westinghouse::WHG644SC": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/cooktops/whg644sc/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 595, heightMm: 55, depthMm: 530, cookingTechnology: "gas", cookingZonesOrBurners: 4, finish: "stainless steel", controls: "control knob", electricalRequirements: "10A plug and lead" },
  },
  "Westinghouse::WHG958SC": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/cooktops/whg958sc/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, cookingTechnology: "gas", cookingZonesOrBurners: 5, finish: "stainless steel" },
  },
  "Westinghouse::WHI955BD": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/cooktops/whi955bd/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, cookingTechnology: "induction", cookingZonesOrBurners: 5, finish: "black glass" },
  },
  "Westinghouse::WFE9515SD": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/freestanding-ovens/wfe9515sd/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, cooktopFuel: "gas", ovenFuel: "electric", finish: "stainless steel" },
  },
  "Westinghouse::WVE6314DD": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/ovens/wve6314dd/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, capacity: "80 L gross", functions: 5, finish: "dark stainless steel", controls: "knob controls", electricalRequirements: "10A plug" },
  },
  "Westinghouse::WRC614SD": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/rangehoods/wrc614sd/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, hoodType: "canopy", finish: "stainless steel" },
  },
  "Westinghouse::WRC914SD": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/rangehoods/wrc914sd/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, hoodType: "canopy", finish: "stainless steel" },
  },
  "Westinghouse::WRF610WA": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/rangehoods/wrf610wa/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, hoodType: "fixed", finish: "white" },
  },
  "Westinghouse::WRF910WA": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/rangehoods/wrf910wa/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 900, hoodType: "fixed", finish: "white" },
  },
  "Westinghouse::WRR614SB": {
    sourceUrl: "https://www.westinghouse.com.au/cooking/rangehoods/wrr614sb/",
    sourceType: "official-australian-product-page",
    sourceOrganisation: "Westinghouse Australia",
    pageAccessible: true,
    exactModelFound: true,
    imageFound: true,
    specificationsFound: true,
    documentFound: true,
    discontinuedStatus: "current-or-supported",
    descriptionStatus: "verified-basic",
    facts: { widthMm: 600, hoodType: "slide-out", finish: "stainless steel" },
  },
});

export function buildCanonicalApplianceCatalogue(csvText, options = {}) {
  const parsed = parseApplianceLegacyCsv(csvText);
  const reconciliation = reconcileApplianceLegacyRecords(parsed.records);
  const checkpoint1 = checkpoint1FromReconciliation(parsed, reconciliation, options);
  const products = checkpoint1.products.map(canonicalProductFromCheckpoint1);
  const packs = checkpoint1.packs.map((pack) => canonicalPackFromCheckpoint1(pack, checkpoint1.packRelationships));
  const relationships = checkpoint1.packRelationships.map((relationship) => ({
    relationshipId: stableId("relationship", relationship.packProductId, relationship.componentSourceRow),
    ...relationship,
    relationshipType: "pack-component",
  }));
  const coverage = products.map(productCoverageRow);
  const manualReviewQueue = coverage
    .filter((row) => row.manualReviewRequired)
    .map((row) => ({
      productId: row.productId,
      brandName: row.brandName,
      manufacturerModel: row.manufacturerModel,
      familyId: row.familyId,
      reason: row.reasonForReview,
    }));

  return {
    checkpoint1,
    catalogue: {
      schemaVersion: APPLIANCE_CANONICAL_SCHEMA_VERSION,
      sourceFile: checkpoint1.sourceFile,
      sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
      products,
    },
    packCatalogue: {
      schemaVersion: APPLIANCE_PACK_SCHEMA_VERSION,
      sourceFile: checkpoint1.sourceFile,
      sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
      packs,
      relationships,
    },
    coverage,
    manualReviewQueue,
    imageAuditRows: products.map(productImageAuditRow),
    researchLogRows: products.flatMap(productResearchLogRows),
    fieldSourceAuditRows: products.flatMap(productFieldSourceRows),
    imageLicensingRows: products.map(productImageLicensingRow),
    report: {
      canonicalProducts: products.length,
      packs: packs.length,
      packRelationships: relationships.length,
      descriptionsCompleted: products.filter((product) => product.descriptionStatus === "verified-complete").length,
      descriptionsVerifiedBasic: products.filter((product) => product.descriptionStatus === "verified-basic").length,
      descriptionsSourceDerivedOnly: products.filter((product) => product.descriptionStatus === "source-derived-only").length,
      descriptionsPending: products.filter((product) => product.descriptionStatus === "pending").length,
      verifiedOfficialImages: products.filter((product) => product.imageStatus === "verified-official").length,
      verifiedRetailerImages: products.filter((product) => product.imageStatus === "verified-retailer").length,
      verifiedDistributorImages: products.filter((product) => product.imageStatus === "verified-distributor").length,
      verifiedArchivedImages: products.filter((product) => product.imageStatus === "verified-archived").length,
      imagesPendingLicence: products.filter((product) => product.imageStatus === "pending-licence").length,
      imagesUnavailable: products.filter((product) => product.imageStatus === "exact-image-unavailable").length,
      specificationsCompleted: products.filter((product) => product.specificationStatus === "completed").length,
      partialSpecificationRecords: products.filter((product) => product.specificationStatus === "partial").length,
      productsRequiringManualReview: manualReviewQueue.length,
      identityVariationsResolved: checkpoint1.identityVariationGroups.length,
      pricePreservation: pricePreservationSummary(checkpoint1, products, packs),
    },
  };
}

function checkpoint1FromReconciliation(parsed, reconciliation, options) {
  return {
    schemaVersion: "product-library.appliances.legacy-csv.v2-canonical",
    sourceFile: options.sourceFile || "",
    sourceRows: parsed.records,
    products: reconciliation.products.map((product) => legacyProductShape(product, options.sourceFile || "")),
    packs: reconciliation.packs.map((pack) => legacyPackShape(pack, options.sourceFile || "")),
    packRelationships: reconciliation.relationships.map(legacyRelationshipShape),
    invalidRows: parsed.rejectedRows,
    unresolvedModelNumbers: reconciliation.unresolvedRows,
    duplicateComponentRows: reconciliation.duplicateComponentRowDetails,
    priceConflicts: reconciliation.priceConflicts,
    identityVariationGroups: reconciliation.identityVariationGroups,
    report: {
      sourceRows: parsed.records.length + parsed.rejectedRows.length,
      uniqueProducts: reconciliation.products.length,
      packs: reconciliation.packs.length,
      packRelationships: reconciliation.relationships.length,
      duplicateComponentRows: reconciliation.duplicateComponentRows,
      unresolvedModelNumbers: reconciliation.unresolvedRows.length,
      rejectedRows: parsed.rejectedRows.length,
      priceConflicts: reconciliation.priceConflicts.length,
      identityVariationGroups: reconciliation.identityVariationGroups.length,
      productFamilies: reconciliation.countsByFamily,
    },
  };
}

function legacyProductShape(product, sourceFile) {
  return {
    productId: product.productId,
    schemaVersion: "product-library.product.v1",
    categoryId: product.categoryId,
    familyId: product.family,
    subfamilyId: "",
    productType: "physical-product",
    brandId: stableId("brand", product.brand),
    brandName: product.brand,
    rangeId: "",
    rangeName: "",
    manufacturerModel: product.modelNumber,
    sku: product.modelNumber,
    productName: product.productName,
    availableColours: [],
    availableFinishes: inferredFinishes(product.productName),
    fuelOrEnergyType: fuelOrEnergyType(product.productName),
    installationType: installationType(product.productName, product.family),
    unit: product.unit,
    costPrice: product.price,
    sellPrice: product.price,
    gstStatus: "unspecified",
    priceStatus: "fixed",
    supplierId: stableId("supplier", product.supplier),
    supplierName: product.supplier,
    applicableRooms: ["kitchen"],
    selectable: product.selectable,
    active: product.active,
    source: {
      type: "legacy-no-header-csv",
      file: sourceFile,
      legacySourceRow: product.sourceRowIds[0] || "",
    },
    sourceRows: product.sourceRowIds,
    legacySourceRows: product.sourceRowIds,
  };
}

function legacyPackShape(pack, sourceFile) {
  return {
    productId: pack.packId,
    brandId: stableId("brand", pack.brand),
    brandName: pack.brand,
    productName: pack.productName,
    costPrice: pack.price,
    sellPrice: pack.price,
    priceStatus: "fixed",
    active: true,
    selectable: true,
    source: {
      type: "legacy-no-header-csv",
      file: sourceFile,
      legacySourceRow: pack.sourceRowId,
    },
  };
}

function fuelOrEnergyType(productName) {
  const text = String(productName || "").toLowerCase();
  if (/induction/.test(text)) return "induction";
  if (/ceramic/.test(text)) return "ceramic electric";
  if (/\bgas\b/.test(text)) return "gas";
  if (/electric/.test(text)) return "electric";
  if (/dual fuel/.test(text)) return "dual fuel";
  return "";
}

function installationType(productName, familyId) {
  const text = String(productName || "").toLowerCase();
  if (familyId === "freestanding-cookers" || /freestanding|free standing/.test(text)) return "freestanding";
  if (/built[- ]?in/.test(text)) return "built-in";
  if (/slide\s*out|slideout/.test(text)) return "slide-out";
  if (/canopy/.test(text)) return "canopy";
  if (/under\s*cupboard|undermount|fixed/.test(text)) return "under-cupboard";
  return "";
}

function stableId(type, ...values) {
  return `${type}:${slug(values.filter(Boolean).join(":"))}`;
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function legacyRelationshipShape(relationship) {
  return {
    relationshipId: stableId("relationship", relationship.packId, relationship.componentSourceRowId),
    packProductId: relationship.packId,
    packLegacySourceRow: relationship.packSourceRowId,
    packSourceRow: relationship.packSourceRowId,
    componentProductId: relationship.componentProductId,
    componentLegacySourceRow: relationship.componentSourceRowId,
    componentSourceRow: relationship.componentSourceRowId,
    componentOrder: relationship.componentOrder,
    relationshipType: "pack-component",
  };
}

export function canonicalProductFromCheckpoint1(product) {
  const specs = specificationsForProduct(product);
  const enrichment = VERIFIED_PRODUCT_SOURCES[`${product.brandName}::${product.manufacturerModel}`] || null;
  if (enrichment) applyVerifiedFacts(specs, enrichment.facts || {});
  const status = specificationStatus(specs);
  const description = productDescription(product, specs);
  const widthMm = widthMmFromProductName(product.productName);
  const finish = inferredFinishes(product.productName).join(", ");
  const hasVerifiedPage = Boolean(enrichment?.sourceUrl);
  const imageStatus = enrichment?.imageFound ? "pending-licence" : "exact-image-unavailable";
  return {
    productId: product.productId,
    schemaVersion: APPLIANCE_CANONICAL_SCHEMA_VERSION,
    categoryId: product.categoryId,
    familyId: product.familyId,
    subfamilyId: product.subfamilyId,
    productType: product.productType,
    brandId: product.brandId,
    brandName: product.brandName,
    rangeId: product.rangeId,
    rangeName: product.rangeName,
    manufacturerModel: product.manufacturerModel,
    sku: product.sku || product.manufacturerModel,
    productName: product.productName,
    shortDescription: enrichment ? verifiedShortDescription(product, specs) : description.shortDescription,
    fullDescription: enrichment ? verifiedFullDescription(product, specs, enrichment) : description.fullDescription,
    descriptionStatus: enrichment?.descriptionStatus || "source-derived-only",
    specifications: specs,
    specificationStatus: status,
    specificationSources: specificationSources(specs, product),
    width: specs.width || null,
    widthMm: specs.widthMm || widthMm,
    height: specs.height || null,
    heightMm: specs.heightMm || null,
    depth: specs.depth || null,
    depthMm: specs.depthMm || null,
    capacity: specs.capacity || null,
    colour: "",
    finish,
    availableColours: product.availableColours || [],
    availableFinishes: product.availableFinishes || inferredFinishes(product.productName),
    fuelOrEnergyType: product.fuelOrEnergyType,
    installationType: product.installationType,
    unit: product.unit,
    costPrice: product.costPrice,
    sourceCostPrice: product.costPrice,
    sellPrice: product.sellPrice,
    importedSourceCost: product.costPrice,
    tenantSellPrice: product.sellPrice,
    currentRetailReference: null,
    currentRetailReferenceSourceUrl: "",
    gstStatus: product.gstStatus,
    priceStatus: product.priceStatus,
    supplierId: product.supplierId,
    supplierName: product.supplierName,
    primaryImage: "",
    additionalImages: [],
    imageStatus,
    imageSourceUrl: enrichment?.imageFound ? enrichment.sourceUrl : "",
    imageSourceOrganisation: enrichment?.imageFound ? enrichment.sourceOrganisation : "",
    imageCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
    productPageUrl: enrichment?.sourceUrl || "",
    productPageStatus: hasVerifiedPage ? "verified-exact-model" : "not-found-after-initial-pass",
    documentUrls: [],
    applicableRooms: product.applicableRooms,
    selectable: product.selectable,
    active: product.active,
    discontinued: enrichment?.discontinuedStatus === "archived-or-runout",
    discontinuedStatus: enrichment?.discontinuedStatus || "not-verified",
    source: product.source,
    research: {
      verificationStatus: hasVerifiedPage ? "verified-basic" : "manual-review-required",
      sourceType: enrichment?.sourceType || "",
      sourceOrganisation: enrichment?.sourceOrganisation || "",
      checkedAt: APPLIANCE_SOURCE_CHECKED_AT,
    },
    evidence: {
      sourceOrganisation: SOURCE_ORGANISATION,
      sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
      sourceRows: product.sourceRows,
      legacySourceRows: product.legacySourceRows,
      evidenceStatus: "legacy-source-only",
    },
    sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
    sourceRowIds: product.sourceRows,
    createdAt: "",
    updatedAt: "",
    manualReviewRequired: true,
    manualReviewReason: enrichment
      ? "Exact product source found; image licence/direct asset and full manufacturer specifications still need manual verification."
      : "Exact product page/image/specification source not verified after initial Checkpoint 2B pass.",
  };
}

export function canonicalPackFromCheckpoint1(pack, relationships = []) {
  const packRelationships = relationships
    .filter((relationship) => relationship.packLegacySourceRow === pack.source.legacySourceRow)
    .sort((a, b) => a.componentOrder - b.componentOrder)
    .map((relationship) => ({
      relationshipId: relationship.relationshipId || stableId("relationship", relationship.packProductId, relationship.componentSourceRow),
      componentProductId: relationship.componentProductId,
      sourceRowId: relationship.componentSourceRow,
    }));
  const sourceComponentProductIds = packRelationships.map((relationship) => relationship.componentProductId);
  const componentProductIds = Array.from(new Set(sourceComponentProductIds));
  return {
    packId: pack.productId,
    productId: pack.productId,
    schemaVersion: APPLIANCE_PACK_SCHEMA_VERSION,
    brand: pack.brandName,
    brandId: pack.brandId,
    brandName: pack.brandName,
    packName: pack.productName,
    shortDescription: `${pack.brandName} appliance pack`,
    fullDescription: `${pack.brandName} appliance pack with ${componentProductIds.length} deduplicated component product references across ${sourceComponentProductIds.length} source component rows.`,
    description: `${pack.brandName} appliance pack with ${componentProductIds.length} deduplicated component product references across ${sourceComponentProductIds.length} source component rows.`,
    componentProductIds,
    componentRelationships: packRelationships,
    sourceRelationshipIds: packRelationships.map((relationship) => relationship.relationshipId),
    sourceRowIds: [pack.source.legacySourceRow, ...packRelationships.map((relationship) => relationship.sourceRowId)],
    sourcePackPrice: pack.sellPrice,
    importedSourceCost: pack.costPrice,
    tenantSellPrice: pack.sellPrice,
    currentRetailReference: null,
    priceStatus: pack.priceStatus,
    active: pack.active,
    selectable: pack.selectable,
    sourceRowReference: pack.source.legacySourceRow,
    source: pack.source,
    sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
    createdAt: "",
    updatedAt: "",
  };
}

function specificationsForProduct(product) {
  const text = product.productName.toLowerCase();
  const width = widthFromProductName(product.productName);
  const widthMm = widthMmFromProductName(product.productName);
  const specs = {
    family: product.familyId,
    manufacturerModel: product.manufacturerModel,
    width,
    widthMm,
    finish: inferredFinishes(product.productName).join(", "),
    fuelOrEnergyType: product.fuelOrEnergyType || "",
    installationType: product.installationType || "",
  };
  if (product.familyId === "ovens") {
    specs.functions = firstNumberBefore(product.productName, "FUNCTION") || null;
    specs.fuelType = product.fuelOrEnergyType || (/oven/i.test(product.productName) ? "electric" : "");
    specs.capacity = null;
    specs.controlType = null;
    specs.cleaningType = null;
    specs.electricalRequirements = null;
  }
  if (product.familyId === "cooktops") {
    specs.cooktopType = product.fuelOrEnergyType || "";
    specs.cookingZonesOrBurners = firstNumberBefore(product.productName, "BURNER") || firstNumberBefore(product.productName, "ZONE") || null;
    specs.controlType = null;
    specs.gasOrElectricalRequirements = null;
  }
  if (product.familyId === "rangehoods") {
    specs.rangehoodType = rangehoodType(text);
    specs.extractionCapacity = null;
    specs.ductedOrRecirculating = null;
    specs.lighting = null;
    specs.noiseRating = null;
  }
  if (product.familyId === "dishwashers") {
    specs.installationType = /integrated/.test(text) ? "integrated" : "freestanding";
    specs.placeSettings = null;
    specs.waterRating = null;
    specs.energyRating = null;
  }
  if (product.familyId === "freestanding-cookers") {
    specs.cooktopFuel = /gas/.test(text) ? "gas" : product.fuelOrEnergyType || "";
    specs.ovenFuel = /electric/.test(text) ? "electric" : "";
    specs.ovenCapacity = null;
    specs.functions = null;
  }
  return specs;
}

function applyVerifiedFacts(specs, facts) {
  Object.entries(facts).forEach(([key, value]) => {
    if (key === "widthMm") {
      specs.widthMm = value;
      specs.width = `${value} mm`;
      return;
    }
    if (key === "heightMm") {
      specs.heightMm = value;
      return;
    }
    if (key === "depthMm") {
      specs.depthMm = value;
      return;
    }
    specs[key] = value;
  });
}

function specificationStatus(specs) {
  return specs.widthMm && specs.manufacturerModel && specs.family ? "partial" : "pending";
}

function productDescription(product, specs) {
  const sizeText = specs.width ? `${specs.width} ` : "";
  const familyLabel = familyLabelFor(product.familyId);
  const modelText = product.manufacturerModel ? ` Model ${product.manufacturerModel}.` : "";
  const typeParts = [sizeText.trim(), product.fuelOrEnergyType, product.installationType, familyLabel]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  return {
    shortDescription: `${product.brandName} ${typeParts || familyLabel} ${product.manufacturerModel}`.replace(/\s+/g, " ").trim(),
    fullDescription: `${product.productName}. ${typeParts ? `Classified as a ${typeParts}.` : `Classified as ${familyLabel}.`}${modelText} Pricing is preserved from the legacy appliance options CSV and should not be overwritten by current retail research.`,
  };
}

function widthFromProductName(productName) {
  const text = String(productName || "");
  if (/\b90\s*CM\b/i.test(text) || /\b900\s*MM\b/i.test(text) || /\b900MM\b/i.test(text)) return "900 mm";
  if (/\b60\s*CM\b/i.test(text) || /\b600\s*MM\b/i.test(text) || /\b600MM\b/i.test(text)) return "600 mm";
  return null;
}

function widthMmFromProductName(productName) {
  const text = String(productName || "");
  if (/\b90\s*CM\b/i.test(text) || /\b900\s*MM\b/i.test(text) || /\b900MM\b/i.test(text)) return 900;
  if (/\b60\s*CM\b/i.test(text) || /\b600\s*MM\b/i.test(text) || /\b600MM\b/i.test(text)) return 600;
  return null;
}

function specificationSources(specs, product) {
  const enrichment = VERIFIED_PRODUCT_SOURCES[`${product.brandName}::${product.manufacturerModel}`] || null;
  return Object.fromEntries(Object.entries(specs).map(([field, value]) => [
    field,
    value == null || value === ""
      ? { status: "pending-verification", source: "" }
      : {
          status: enrichment?.facts && Object.hasOwn(enrichment.facts, field) ? "verified-source" : "legacy-source-derived",
          source: enrichment?.facts && Object.hasOwn(enrichment.facts, field) ? enrichment.sourceOrganisation : SOURCE_ORGANISATION,
          sourceUrl: enrichment?.facts && Object.hasOwn(enrichment.facts, field) ? enrichment.sourceUrl : "",
          sourceCheckedAt: APPLIANCE_SOURCE_CHECKED_AT,
          sourceRowIds: product.sourceRows,
        },
  ]));
}

function verifiedShortDescription(product, specs) {
  const width = specs.width || "";
  const finish = specs.finish ? `, ${specs.finish}` : "";
  return `${product.brandName} ${width} ${familyLabelFor(product.familyId)} ${product.manufacturerModel}${finish}`.replace(/\s+/g, " ").trim();
}

function verifiedFullDescription(product, specs, enrichment) {
  const details = [
    specs.width ? `${specs.width} ${familyLabelFor(product.familyId)}` : familyLabelFor(product.familyId),
    specs.cookingTechnology || specs.cooktopType || specs.fuelOrEnergyType,
    specs.hoodType,
    specs.installationType,
    specs.capacity ? `${specs.capacity} capacity` : "",
    specs.functions ? `${specs.functions} functions` : "",
    specs.cookingZonesOrBurners ? `${specs.cookingZonesOrBurners} burners/zones` : "",
    specs.finish,
  ].filter(Boolean).join(", ");
  return `${product.brandName} ${product.manufacturerModel} is a ${details}. Verified source: ${enrichment.sourceOrganisation}. Source quotation pricing is preserved separately from current retail references.`;
}

function inferredFinishes(productName) {
  return /stainless|inox|\bss\b|\bx\b/i.test(productName) ? ["stainless steel"] : [];
}

function rangehoodType(text) {
  if (/slide\s*out|slideout/.test(text)) return "slide-out";
  if (/canopy/.test(text)) return "canopy";
  if (/under\s*cupboard/.test(text)) return "under-cupboard";
  if (/\bfixed\b/.test(text)) return "fixed";
  return "";
}

function firstNumberBefore(productName, token) {
  const match = String(productName || "").match(new RegExp(`\\b(\\d+)\\s+${token}\\b`, "i"));
  return match ? Number(match[1]) : null;
}

function familyLabelFor(familyId) {
  return {
    ovens: "oven",
    cooktops: "cooktop",
    rangehoods: "rangehood",
    dishwashers: "dishwasher",
    "freestanding-cookers": "freestanding cooker",
  }[familyId] || familyId;
}

function productCoverageRow(product) {
  return {
    productId: product.productId,
    brandName: product.brandName,
    manufacturerModel: product.manufacturerModel,
    familyId: product.familyId,
    descriptionStatus: product.descriptionStatus,
    specificationStatus: product.specificationStatus,
    productPageStatus: product.productPageStatus,
    imageStatus: product.imageStatus,
    imageSource: product.imageSourceUrl,
    manualReviewRequired: product.manualReviewRequired,
    reasonForReview: product.manualReviewReason,
  };
}

function productImageAuditRow(product) {
  return {
    productId: product.productId,
    brandName: product.brandName,
    manufacturerModel: product.manufacturerModel,
    familyId: product.familyId,
    primaryImage: product.primaryImage,
    imageStatus: product.imageStatus,
    imageSourceUrl: product.imageSourceUrl,
    imageSourceOrganisation: product.imageSourceOrganisation,
    imageCheckedAt: product.imageCheckedAt,
    productPageUrl: product.productPageUrl,
    manualReviewRequired: product.manualReviewRequired,
    reasonForReview: product.manualReviewReason,
  };
}

function productResearchLogRows(product) {
  const enrichment = VERIFIED_PRODUCT_SOURCES[`${product.brandName}::${product.manufacturerModel}`] || null;
  const attempts = [
    {
      searchQuery: `${product.brandName} ${product.manufacturerModel}`,
      sourceUrl: enrichment?.sourceUrl || "",
      sourceType: enrichment?.sourceType || "search-attempt",
      sourceOrganisation: enrichment?.sourceOrganisation || "",
      pageAccessible: enrichment?.pageAccessible || false,
      exactModelFound: enrichment?.exactModelFound || false,
      modelMatchConfidence: enrichment?.exactModelFound ? "exact" : "not-verified",
      imageFound: enrichment?.imageFound || false,
      specificationsFound: enrichment?.specificationsFound || false,
      documentFound: enrichment?.documentFound || false,
      notes: enrichment
        ? "Exact model source recorded in Checkpoint 2B enrichment map."
        : "Initial exact brand/model research did not produce a verified source in this pass; further manual/archived research required.",
    },
  ];
  if (!enrichment) {
    attempts.push({
      searchQuery: `"${product.manufacturerModel}" ${product.brandName} manual specification image`,
      sourceUrl: "",
      sourceType: "manual-archive-search-attempt",
      sourceOrganisation: "",
      pageAccessible: false,
      exactModelFound: false,
      modelMatchConfidence: "not-verified",
      imageFound: false,
      specificationsFound: false,
      documentFound: false,
      notes: "Queued for deeper manufacturer manual, retailer and archived-source review.",
    });
  }
  return attempts.map((attempt) => ({
    product_id: product.productId,
    brand: product.brandName,
    model: product.manufacturerModel,
    family: product.familyId,
    search_query: attempt.searchQuery,
    source_url: attempt.sourceUrl,
    source_type: attempt.sourceType,
    source_organisation: attempt.sourceOrganisation,
    page_accessible: attempt.pageAccessible,
    exact_model_found: attempt.exactModelFound,
    model_match_confidence: attempt.modelMatchConfidence,
    image_found: attempt.imageFound,
    specifications_found: attempt.specificationsFound,
    document_found: attempt.documentFound,
    checked_at: APPLIANCE_SOURCE_CHECKED_AT,
    notes: attempt.notes,
  }));
}

function productFieldSourceRows(product) {
  return Object.entries(product.specificationSources || {}).map(([field, source]) => ({
    product_id: product.productId,
    brand: product.brandName,
    model: product.manufacturerModel,
    family: product.familyId,
    field,
    value: product.specifications?.[field] ?? "",
    source_status: source.status,
    source_organisation: source.source || "",
    source_url: source.sourceUrl || "",
    checked_at: source.sourceCheckedAt || APPLIANCE_SOURCE_CHECKED_AT,
  }));
}

function productImageLicensingRow(product) {
  return {
    product_id: product.productId,
    brand: product.brandName,
    model: product.manufacturerModel,
    family: product.familyId,
    image_status: product.imageStatus,
    direct_image_url: "",
    source_page_url: product.productPageUrl,
    source_organisation: product.imageSourceOrganisation,
    source_type: product.research?.sourceType || "",
    verification_confidence: product.productPageUrl ? "exact-model-page-image-seen" : "not-verified",
    checked_date: APPLIANCE_SOURCE_CHECKED_AT,
    proposed_local_asset_path: product.productPageUrl ? `public/catalogues/appliances/${slug(product.brandName)}/${slug(product.manufacturerModel)}/${slug(product.brandName)}-${slug(product.manufacturerModel)}-main.webp` : "",
    licence_use_status: product.productPageUrl ? "pending-licence" : "not-available",
    downloaded: false,
  };
}

function pricePreservationSummary(checkpoint1, products, packs) {
  const productPricesPreserved = products.every((product) => {
    const source = checkpoint1.products.find((item) => item.productId === product.productId);
    return source && source.costPrice === product.costPrice && source.sellPrice === product.sellPrice;
  });
  const packPricesPreserved = packs.every((pack) => {
    const source = checkpoint1.packs.find((item) => item.productId === pack.packId);
    return source && source.costPrice === pack.importedSourceCost && source.sellPrice === pack.sourcePackPrice;
  });
  return { productPricesPreserved, packPricesPreserved };
}
