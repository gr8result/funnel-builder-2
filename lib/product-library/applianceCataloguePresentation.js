// Appliance catalogue presentation helpers (labels, buckets, grouping).
// Extracted from pages/modules/builders/product-library.js; logic unchanged.
import { money, uniqueValues } from "./productLibraryFormat.js";
import { APPLIANCE_FAMILIES, isApplianceRecordSelectable } from "./applianceCatalogueSelectorsCore.js";

export const APPLIANCE_FALLBACK_IMAGES = {
  ovens: "/images/catalogues/appliances/fallbacks/oven.svg",
  cooktops: "/images/catalogues/appliances/fallbacks/cooktop.svg",
  rangehoods: "/images/catalogues/appliances/fallbacks/rangehood.svg",
  dishwashers: "/images/catalogues/appliances/fallbacks/dishwasher.svg",
  "freestanding-cookers": "/images/catalogues/appliances/fallbacks/freestanding-cooker.svg",
  microwaves: "/images/catalogues/appliances/fallbacks/microwave.svg",
  fridges: "/images/catalogues/appliances/fallbacks/refrigerator.svg",
  "appliance-packs": "/images/catalogues/appliances/fallbacks/appliance-pack.svg",
  generic: "/images/catalogues/appliances/fallbacks/generic.svg",
};

export const APPLIANCE_FAMILY_KEYS = new Set(APPLIANCE_FAMILIES.map((family) => family.familyId));

export function applianceFallbackImage(product = {}, familyItem = null) {
  const familyKey = product.familyKey || product.familyId || familyItem?.familyKey || "";
  return APPLIANCE_FALLBACK_IMAGES[familyKey] || APPLIANCE_FALLBACK_IMAGES.generic;
}

export function productIsAppliance(product = {}, familyItem = null) {
  const familyKey = product.familyKey || product.familyId || familyItem?.familyKey || "";
  return APPLIANCE_FAMILY_KEYS.has(familyKey)
    || familyItem?.categoryKey === "appliances"
    || product.categoryKey === "appliances"
    || product.sourceName === "Canonical Appliance Catalogue";
}

export function appliancePriceLabel(record, { admin = true } = {}) {
  if (!admin) return record.priceStatus === "quote_required" ? "Quote required" : "Price held in Product Library";
  if (record.priceStatus === "quote_required") return "Quote required";
  if (record.priceStatus === "price_pending") return "Price pending";
  if (record.price == null || record.price === "") return record.priceStatus || "No price";
  return `${money(record.price)} ${record.unit || ""}`.trim();
}

export function applianceHncPriceLabel(record = {}) {
  const price = Number(record.hncPrice);
  if (record.hncPrice == null || record.hncPrice === "" || !Number.isFinite(price) || price <= 0) return "";
  return `HNC SRP (inc. GST): ${price.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function applianceStatusClass(status = "") {
  if (status === "active-selectable") return "status-pill on";
  if (status === "active-reference-only") return "status-pill";
  return "status-pill off";
}

export function applianceSelectionUnavailableReason(record = {}) {
  if (isApplianceRecordSelectable(record)) return "";
  return record.eligibilityReasons?.filter(Boolean).join("; ") || "Product verification is required before selection.";
}

export function applianceValue(value, fallback = "Not supplied") {
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (value == null || value === "") return fallback;
  return String(value);
}

export function applianceSizeBucket(record = {}) {
  const widthText = `${record.width || ""} ${record.widthMm || ""} ${record.name || ""} ${record.productName || ""}`.toUpperCase();
  if (/\b90\s*CM\b|\b900\s*MM\b/.test(widthText) || Number(record.widthMm) >= 850) return "900 mm";
  if (/\b60\s*CM\b|\b600\s*MM\b/.test(widthText) || (Number(record.widthMm) >= 550 && Number(record.widthMm) < 850)) return "600 mm";
  return "Other size";
}

export function applianceConfigurationBucket(record = {}) {
  const text = [
    record.fuelOrEnergyType,
    record.installationType,
    record.finish,
    record.name,
    record.productName,
    record.specificationSummary?.rangehoodType,
    record.specificationSummary?.cooktopType,
  ].join(" ").toLowerCase();
  if (/induction/.test(text)) return "Induction";
  if (/ceramic/.test(text)) return "Ceramic";
  if (/\bgas\b/.test(text)) return "Gas";
  if (/electric/.test(text)) return "Electric";
  if (/canopy/.test(text)) return "Canopy";
  if (/slide/.test(text)) return "Slide-out";
  if (/fixed/.test(text)) return "Fixed";
  if (/undermount|under mount/.test(text)) return "Undermount";
  if (/freestanding|free standing/.test(text)) return "Freestanding";
  return "Other configuration";
}

export function applianceDimensionLabel(record = {}) {
  const width = record.width || (record.widthMm ? `W${record.widthMm}` : "");
  const depth = record.depth || (record.depthMm ? `D${record.depthMm}` : "");
  const height = record.height || (record.heightMm ? `H${record.heightMm}` : "");
  return [width, depth, height].filter(Boolean).join(" x ");
}

export function applianceFeatureList(record = {}) {
  const specs = record.specificationSummary || record.specifications || record.attributes?.specificationSummary || {};
  const candidates = [
    specs.features,
    specs.capacity,
    specs.functions,
    specs.zones,
    specs.placeSettings,
    specs.rangehoodType,
    specs.cooktopType,
    specs.energyRating,
    specs.warranty,
    record.warranty,
  ];
  return uniqueValues(candidates.flatMap((value) => Array.isArray(value) ? value : [value])).slice(0, 8);
}

export function applianceSpecificationEntries(record = {}) {
  const specifications = record.specificationSummary || record.specifications || record.attributes?.specificationSummary || {};
  const labelFor = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  const formatValue = (value) => {
    if (value == null || value === "") return "";
    if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join("; ");
    if (typeof value === "object") return Object.entries(value).map(([key, item]) => {
      const formatted = formatValue(item);
      return formatted ? `${labelFor(key)}: ${formatted}` : "";
    }).filter(Boolean).join("; ");
    return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  };
  return Object.entries(specifications).map(([key, value]) => ({ key, label: labelFor(key), value: formatValue(value) })).filter((entry) => entry.value);
}

export function applianceFilterOptionValues(records = []) {
  return {
    widths: uniqueValues(records.map(applianceSizeBucket)),
    fuels: uniqueValues(records.map((record) => record.fuelOrEnergyType || applianceConfigurationBucket(record))),
    installs: uniqueValues(records.map((record) => record.installationType)),
    finishes: uniqueValues(records.map((record) => record.finish)),
    verifications: uniqueValues(records.map((record) => record.verificationStatus)),
  };
}

export function groupAppliancesForBrand(records = []) {
  return records.reduce((groups, record) => {
    const family = record.familyId || "other";
    const size = applianceSizeBucket(record);
    const configuration = applianceConfigurationBucket(record);
    const key = `${family}::${size}::${configuration}`;
    if (!groups.has(key)) groups.set(key, { family, size, configuration, records: [] });
    groups.get(key).records.push(record);
    return groups;
  }, new Map());
}
