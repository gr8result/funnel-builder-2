// Flooring (non-tile floor coverings) in the Product Library: the type taxonomy, the supplier-
// neutral record shape every flooring importer produces, whole-pack order quantities and the
// re-import merge that keeps identities stable and price history intact.
//
//   SUPPLIER IMPORT (scripts/product-library/import-flooring.mjs + one adapter per supplier)
//     -> catalogue JSON (data/product-library/catalogues/flooring/*.json)
//     -> PRODUCT LIBRARY (catalogueService MASTER_CATALOGUE_SOURCES)
//     -> FLOORING TAXONOMY (attributes.flooringType)
//     -> CLIENT SELECTIONS (flooring areas) -> QUOTATION / BOQ / PROCUREMENT
//
// One Product Library product = one supplier range at one size/thickness ("variant group"); each
// genuine colour / decor is a variant carrying its own SKU, image, URL and price. Tiles never
// belong here - they stay under Tiles & Stone.

import { DEFAULT_TILE_WASTAGE_PCT, tileOrder } from "../builders/tilingCalculations.js";

export const FLOORING_FAMILY_KEY = "flooring";
export const FLOORING_REQUIREMENT_KEY = "interior-flooring";

// The estimating wastage rule is shared with tiling (one rule, one default).
export const DEFAULT_FLOORING_WASTAGE_PCT = DEFAULT_TILE_WASTAGE_PCT;

export const FLOORING_TYPES = [
  { key: "hybrid", label: "Hybrid", quoteSection: "HYBRID FLOORING" },
  { key: "vinyl", label: "Vinyl Plank", quoteSection: "VINYL FLOORING" },
  { key: "laminate", label: "Laminate", quoteSection: "LAMINATED FLOORING" },
  { key: "engineered-timber", label: "Engineered Timber", quoteSection: "ENGINEERED TIMBER" },
  { key: "timber", label: "Solid Timber", quoteSection: "SOLID TIMBER FLOORING" },
  { key: "carpet", label: "Carpet", quoteSection: "CARPETS" },
];
const TYPE_BY_KEY = new Map(FLOORING_TYPES.map((type) => [type.key, type]));

export function flooringType(key = "") {
  return TYPE_BY_KEY.get(key) || null;
}

// The flooring type a supplier's own material / category wording states. Returns "" when the
// wording does not clearly name a non-tile flooring type (never guessed).
export function flooringTypeFromText(text = "") {
  const value = String(text || "").toLowerCase();
  if (/\btile|porcelain|ceramic/.test(value)) return "";
  if (/engineered/.test(value)) return "engineered-timber";
  if (/hybrid|\bspc\b|rigid core/.test(value)) return "hybrid";
  if (/laminate/.test(value)) return "laminate";
  if (/vinyl|\blvt\b|\blvp\b/.test(value)) return "vinyl";
  if (/carpet/.test(value)) return "carpet";
  if (/solid timber|hardwood|timber/.test(value)) return "timber";
  return "";
}

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
};

// Published price fields of one variant. The estimating price is ALWAYS the regular price; a sale
// price is kept beside it and never overwrites it. Per-m2 and per-pack are derived from each other
// only through the genuine published pack coverage, and the derivation is marked.
export function flooringVariantPricing(variant = {}) {
  // Coverage keeps its published precision (e.g. 1.9152 m2); only money is rounded to cents.
  const coverageValue = Number(variant.packCoverageM2);
  const coverage = Number.isFinite(coverageValue) && coverageValue > 0 ? coverageValue : null;
  const regularPerM2 = money(variant.regularPricePerM2);
  const salePerM2 = money(variant.salePricePerM2);
  const regularPerPack = money(variant.regularPricePerPack) ?? (regularPerM2 && coverage ? money(regularPerM2 * coverage) : null);
  const perM2 = regularPerM2 ?? (money(variant.regularPricePerPack) && coverage ? money(variant.regularPricePerPack / coverage) : null);
  return {
    packCoverageM2: coverage,
    regularPricePerM2: perM2,
    salePricePerM2: salePerM2 && perM2 && salePerM2 < perM2 ? salePerM2 : null,
    regularPricePerPack: regularPerPack,
    salePricePerPack: money(variant.salePricePerPack),
    perM2Derived: !regularPerM2 && Boolean(perM2),
    perPackDerived: !money(variant.regularPricePerPack) && Boolean(regularPerPack),
    priced: Boolean(perM2 || regularPerPack),
  };
}

// Net area -> wastage -> required area -> WHOLE packs -> purchased coverage.
export function flooringOrder(netAreaM2, { wastagePct = DEFAULT_FLOORING_WASTAGE_PCT, packCoverageM2 = 0 } = {}) {
  const order = tileOrder(netAreaM2, { wastagePct, boxCoverageM2: packCoverageM2 });
  return {
    netAreaM2: Math.round(order.netAreaM2 * 100) / 100,
    wastagePct: order.wastagePct,
    requiredAreaM2: Math.round(order.orderAreaM2 * 100) / 100,
    packCoverageM2: order.boxCoverageM2,
    packs: order.boxes,
    purchasedAreaM2: order.suppliedAreaM2 === null ? null : Math.round(order.suppliedAreaM2 * 10000) / 10000,
  };
}

// Material cost of an order at the regular (estimating) price: whole packs x pack price when the
// pack price is known, otherwise purchased m2 x price per m2.
export function flooringOrderCost(order = {}, pricing = {}) {
  if (!order?.packs) return null;
  if (pricing.regularPricePerPack) return Math.round(order.packs * pricing.regularPricePerPack * 100) / 100;
  if (pricing.regularPricePerM2 && order.purchasedAreaM2) return Math.round(order.purchasedAreaM2 * pricing.regularPricePerM2 * 100) / 100;
  return null;
}

// Stable identities: one product per supplier variant group, one variant per supplier SKU.
export const flooringProductCode = (supplierKey, groupKey) => `FLR-${String(supplierKey).toUpperCase()}-${String(groupKey).toUpperCase()}`.replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-");
export const flooringVariantId = (supplierKey, sku) => `${supplierKey}:${String(sku).trim().toUpperCase()}`;

const PRICE_FIELDS = ["regularPricePerM2", "salePricePerM2", "regularPricePerPack", "salePricePerPack", "packCoverageM2"];
const samePrice = (a = {}, b = {}) => PRICE_FIELDS.every((key) => (a[key] ?? null) === (b[key] ?? null));

// Re-import merge. Existing products / variants are matched by their stable ids and updated in
// place; a changed price appends the previous price to priceHistory (never discarded); a variant
// no longer listed by the supplier is kept but marked discontinued rather than deleted.
export function mergeFlooringCatalogue(existing = { products: [] }, incoming = { products: [] }, { retrievedAt = new Date().toISOString() } = {}) {
  const previousVariants = new Map();
  (existing.products || []).forEach((product) => (product.variants || []).forEach((variant) => previousVariants.set(variant.variantId, { variant, product })));
  const seen = new Set();
  const products = (incoming.products || []).map((product) => {
    const variants = (product.variants || []).map((variant) => {
      seen.add(variant.variantId);
      const previous = previousVariants.get(variant.variantId)?.variant;
      if (!previous) return { ...variant, firstImportedAt: retrievedAt, lastImportedAt: retrievedAt, lastPriceCheckedAt: retrievedAt, priceHistory: [] };
      const history = Array.isArray(previous.priceHistory) ? [...previous.priceHistory] : [];
      if (!samePrice(previous, variant)) history.push({ ...Object.fromEntries(PRICE_FIELDS.map((key) => [key, previous[key] ?? null])), retrievedAt: previous.priceRetrievedAt || previous.lastPriceCheckedAt || "" });
      return { ...previous, ...variant, discontinued: false, discontinuedDetectedAt: undefined, supplierQuoteHistory: previous.supplierQuoteHistory || [], firstImportedAt: previous.firstImportedAt || retrievedAt, lastImportedAt: retrievedAt, lastPriceCheckedAt: retrievedAt, priceHistory: history };
    });
    return { ...product, variants };
  });
  // Previously imported variants the supplier no longer lists stay on record, discontinued.
  const byCode = new Map(products.map((product) => [product.product_code, product]));
  for (const [variantId, { variant, product }] of previousVariants) {
    if (seen.has(variantId)) continue;
    const kept = { ...variant, discontinued: true, discontinuedDetectedAt: variant.discontinuedDetectedAt || retrievedAt };
    if (byCode.has(product.product_code)) byCode.get(product.product_code).variants.push(kept);
    else { const copy = { ...product, variants: [kept], active: false, discontinued: true }; byCode.set(product.product_code, copy); products.push(copy); }
  }
  return { ...incoming, products };
}

// Product Library record helpers used by Client Selections.
export function isFlooringProduct(product = {}) {
  return (product.familyKey || product.family_key) === FLOORING_FAMILY_KEY && Boolean(product.attributes?.flooringType);
}

export function activeFlooringVariants(product = {}) {
  return (product.variants || []).filter((variant) => variant && !variant.discontinued);
}

// Live counts per flooring type from the Product Library records themselves.
export function flooringCountsByType(products = []) {
  const counts = Object.fromEntries(FLOORING_TYPES.map((type) => [type.key, { products: 0, colours: 0 }]));
  products.filter(isFlooringProduct).forEach((product) => {
    const bucket = counts[product.attributes.flooringType];
    if (!bucket) return;
    const colours = activeFlooringVariants(product).length;
    if (!colours) return;
    bucket.products += 1;
    bucket.colours += colours;
  });
  return counts;
}
