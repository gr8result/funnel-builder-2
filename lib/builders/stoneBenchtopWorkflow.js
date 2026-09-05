import stoneBenchtopCatalogueData from "../../data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js";

export const STONE_BENCHTOP_SUPPLIERS = ["Neolith", "Smartstone", "Caesarstone", "Stone Ambassador"];
export const STONE_BENCHTOP_MATERIAL_LABEL = "Stone, porcelain or sintered benchtop";
export const STONE_BENCHTOP_FULL_LABEL = "Stone, Porcelain & Sintered Benchtops";
export const STONE_BENCHTOP_DISCLAIMER = "On-screen images are indicative. Natural-looking pattern, veining, scale and colour may vary between slabs, production batches and displays. Confirm the final selection using a current physical sample or full slab before manufacture.";

export const STONE_BENCHTOP_APPLICATIONS = [
  "Main benchtop",
  "Island benchtop",
  "Vanity benchtop",
  "Butler's Pantry benchtop",
  "Laundry benchtop",
  "Other",
];

export const STONE_BENCHTOP_EDGE_PROFILES = [
  "Square arris",
  "Pencil round",
  "Mitred apron",
  "Shark nose",
  "Bullnose",
  "Builder/supplier nominated",
];

export const WATERFALL_END_OPTIONS = ["None", "Left", "Right", "Both"];
export const CUTOUT_OPTIONS = ["Sink", "Cooktop", "Tap", "Other"];

export const STONE_BENCHTOP_CATALOGUE = (stoneBenchtopCatalogueData.products || []).map(normaliseStoneBenchtopRecord);

export function activeStoneBenchtopProducts(records = STONE_BENCHTOP_CATALOGUE) {
  return records.filter((record) => record.availabilityStatus !== "inactive" && record.active !== false);
}

export function stoneBenchtopProductById(productId = "") {
  return STONE_BENCHTOP_CATALOGUE.find((record) => record.id === productId) || null;
}

export function configureStoneBenchtopSelection(product = {}, configuration = {}) {
  const finishOptions = product.finishOptions?.length ? product.finishOptions : ["Supplier confirmation required"];
  const thicknessOptions = product.thicknessOptions?.length ? product.thicknessOptions : ["Supplier confirmation required"];
  const finish = finishOptions.includes(configuration.finish) ? configuration.finish : finishOptions[0];
  const slabThickness = thicknessOptions.includes(configuration.slabThickness) ? configuration.slabThickness : thicknessOptions[0];
  const applications = Array.isArray(configuration.applications) && configuration.applications.length ? configuration.applications : [applicationForRoom(configuration.room || "")];
  return {
    supplier: product.supplier || "",
    productId: product.id || "",
    productCode: product.productCode || "",
    colourName: product.colourName || "",
    collection: product.collection || "",
    materialType: product.materialType || "",
    slabImage: product.slabImage || product.primarySwatchImage || "",
    finish,
    slabThickness,
    finishedEdgeThickness: configuration.finishedEdgeThickness || slabThickness,
    edgeProfile: configuration.edgeProfile || STONE_BENCHTOP_EDGE_PROFILES[0],
    waterfallEnds: configuration.waterfallEnds || "None",
    upstand: configuration.upstand || "",
    splashbackApplication: configuration.splashbackApplication || "",
    applications,
    dimensions: configuration.dimensions || "",
    approximateAreaSqm: configuration.approximateAreaSqm || "",
    cutouts: Array.isArray(configuration.cutouts) ? configuration.cutouts : [],
    notes: configuration.notes || "",
    templateRequired: configuration.templateRequired !== false,
    supplierQuoteRequired: configuration.supplierQuoteRequired !== false,
    physicalSampleConfirmed: Boolean(configuration.physicalSampleConfirmed),
    fullSlabViewed: Boolean(configuration.fullSlabViewed),
    pricingStatus: configuration.pricingStatus || product.priceStatus || "supplier_quote_required",
    priceStatus: configuration.priceStatus || configuration.pricingStatus || product.priceStatus || "supplier_quote_required",
    allowance: configuration.allowance ?? null,
    selectedPrice: configuration.selectedPrice ?? null,
    variation: configuration.variation ?? null,
    officialProductUrl: product.officialProductUrl || "",
    verifiedAt: product.verifiedAt || "",
    priceGroup: product.priceGroup || "",
    colourFamily: product.colourFamily || "",
    patternType: product.patternType || "",
  };
}

export function stoneBenchtopToBoqLine(location = {}) {
  const benchtop = location.benchtop || {};
  if (benchtop.materialChoice !== "stone") return null;
  return {
    sourceSelectionId: "cabinetry",
    sourceSelectionType: "stone_benchtop",
    location: location.location || location.name || "Kitchen",
    itemName: `${location.location || location.name || "Kitchen"} ${benchtop.applications?.join(", ") || "stone benchtop"}`,
    quantity: Number(benchtop.approximateAreaSqm) || 1,
    unit: benchtop.approximateAreaSqm ? "SQM" : "ITEM",
    supplier: benchtop.supplier,
    productCode: benchtop.productCode,
    productRange: benchtop.collection,
    colourName: benchtop.colourName,
    finish: benchtop.finish,
    slabThickness: benchtop.slabThickness,
    finishedEdgeThickness: benchtop.finishedEdgeThickness,
    edgeProfile: benchtop.edgeProfile,
    waterfallEnds: benchtop.waterfallEnds,
    cutouts: benchtop.cutouts,
    swatchImage: benchtop.slabImage,
    officialProductUrl: benchtop.officialProductUrl,
    priceStatus: benchtop.pricingStatus || "supplier_quote_required",
    variation: benchtop.variation ?? null,
  };
}

export function buildStoneSupplierRfq(locations = []) {
  const lines = locations.map(stoneBenchtopToBoqLine).filter(Boolean);
  return {
    generatedFrom: "client_selections_stone_benchtops",
    status: lines.length ? "ready_for_supplier_quote" : "not_required",
    lines,
  };
}

function applicationForRoom(room = "") {
  if (/laundry/i.test(room)) return "Laundry benchtop";
  if (/bath|ensuite|powder/i.test(room)) return "Vanity benchtop";
  if (/pantry/i.test(room)) return "Butler's Pantry benchtop";
  return "Main benchtop";
}

function normaliseStoneBenchtopRecord(record = {}) {
  return {
    ...record,
    finishOptions: Array.isArray(record.finishOptions) && record.finishOptions.length ? record.finishOptions : ["Supplier confirmation required"],
    thicknessOptions: Array.isArray(record.thicknessOptions) && record.thicknessOptions.length ? record.thicknessOptions : ["Supplier confirmation required"],
    slabSizes: Array.isArray(record.slabSizes) && record.slabSizes.length ? record.slabSizes : ["Confirm with supplier"],
    lifestyleImages: Array.isArray(record.lifestyleImages) ? record.lifestyleImages : [],
    availabilityStatus: record.availabilityStatus || "active",
    priceStatus: record.priceStatus || "supplier_quote_required",
    pricingTier: record.pricingTier || record.priceStatus || "supplier_quote_required",
  };
}
