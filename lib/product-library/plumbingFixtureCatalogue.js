// Client Selections Plumbing Fixtures range.
//
// The products themselves live in the canonical Product Library (AU-HNC-PLUMBING-CATALOGUE.json,
// served through catalogueService). A row belongs to a Plumbing Fixtures category only when it
// carries attributes.plumbingFixtureCategory, which the HNC import script sets after checking
// the product against its Harvey Norman Commercial product page. Nothing here lists products.

import { getEffectiveProductCatalogue } from "./catalogueService.js";
import { bathroomAccessoryTypeByKey, classifyBathroomAccessory, discoverBathroomAccessoryTypes } from "./bathroomAccessoryDiscovery.js";
import { matchesSelectionProductType, isSelectableDiscoveryProduct, indexSelectionProductTypes, normalizeProductType } from "./selectionProductDiscovery.js";

export const PLUMBING_FIXTURE_SUPPLIER = "Harvey Norman Commercial";

// Keyed by the requirementKey of each PLUMBING_FIXTURE_REQUIREMENTS entry.
export const PLUMBING_FIXTURE_CATEGORY_DETAILS = {
  sink: { title: "Sinks", description: "Topmount and undermount kitchen sinks", viewLabel: "View Sinks" },
  "sink-mixer": { title: "Sink Mixers", description: "Standard and pull-out kitchen sink mixers", viewLabel: "View Sink Mixers" },
  "bathroom-basin": { title: "Bathroom Basins", description: "Above counter, inset, wall hung and under counter basins", viewLabel: "View Basins" },
  "basin-mixer": { title: "Basin Mixers", description: "Bathroom basin mixers", viewLabel: "View Basin Mixers" },
  bath: { title: "Baths", description: "Freestanding and built-in baths", viewLabel: "View Baths" },
  "shower-fixtures": { title: "Shower Fixtures", description: "Single and twin showers, rails and shower mixers", viewLabel: "View Shower Fixtures" },
  "toilet-suite": { title: "Toilet Suites", description: "Back to wall, close coupled and link toilet suites", viewLabel: "View Toilet Suites" },
  "laundry-tub": { title: "Laundry Tubs", description: "Flushline tubs and tub-and-cabinet units", viewLabel: "View Laundry Tubs" },
  "bath-mixer": { title: "Bath & Shower Mixers", description: "Wall, bath and shower mixers - allocate each one to a bath or a shower", viewLabel: "View Bath & Shower Mixers" },
  "bath-spout": { title: "Bath Spouts", description: "Wall bath spouts and outlets to match your tapware range", viewLabel: "View Bath Spouts" },
  "shower-screen": { title: "Shower Screens", description: "Framed, semi-frameless and frameless shower screens, configured for each shower", viewLabel: "View Shower Screens" },
  mirror: { title: "Mirrors", description: "Frameless, framed and shaped mirrors", viewLabel: "View Mirrors" },
  "shaving-cabinet": { title: "Shaving Cabinets", description: "Mirrored cabinets, recessed or surface mounted", viewLabel: "View Shaving Cabinets" },
};
// "shower-fixtures" means rails, roses and hand showers - mixers are "bath-mixer" (Bath & Shower Mixers).
PLUMBING_FIXTURE_CATEGORY_DETAILS["shower-fixtures"] = { title: "Shower Rails & Roses", description: "Rail showers, twin showers, shower roses and hand showers", viewLabel: "View Shower Rails & Roses" };

export function plumbingFixtureCategoryDetails(requirement = {}) {
  return PLUMBING_FIXTURE_CATEGORY_DETAILS[requirement.requirementKey]
    || { title: requirement.label || "", description: requirement.description || "", viewLabel: `View ${requirement.label || "Products"}` };
}

// Allocated catalogue ranges share structured type/tag matching. Bathroom Accessories
// discovers its subtypes from the complete effective library; Plumbing Fixtures retains
// its supplier-verified classification rules.
export const CLIENT_SELECTION_TAG = "clientSelectionRequirement";

function clientSelectionOrder(product = {}) {
  const order = Number(product.attributes?.clientSelectionOrder);
  return Number.isFinite(order) && order > 0 ? order : Number.MAX_SAFE_INTEGER;
}

export function isClientSelectionProductFor(product = {}, requirementKey = "") {
  if (bathroomAccessoryTypeByKey(requirementKey)) {
    return isSelectableDiscoveryProduct(product) && classifyBathroomAccessory(product)?.key === requirementKey;
  }
  return Boolean(requirementKey)
    && matchesSelectionProductType(product, [requirementKey]);
}

export function clientSelectionCategoryProducts(requirement = {}, { organisationId = "", products } = {}) {
  if (requirement.areaKey === "plumbing-fixtures") return plumbingFixtureProducts(requirement.requirementKey, { organisationId });
  const catalogue = products || getEffectiveProductCatalogue({ organisationId }).products;
  if (requirement.areaKey === "bathroom-accessories") {
    return (discoverBathroomAccessoryTypes(catalogue).find((type) => type.key === requirement.requirementKey)?.products || [])
      .sort((left, right) => `${left.brand} ${left.productName}`.localeCompare(`${right.brand} ${right.productName}`, undefined, { numeric: true }));
  }
  return catalogue
    .filter((product) => isClientSelectionProductFor(product, requirement.requirementKey))
    .sort((left, right) => clientSelectionOrder(left) - clientSelectionOrder(right) || `${left.brand} ${left.productName}`.localeCompare(`${right.brand} ${right.productName}`));
}

export function clientSelectionCategorySummaries(requirements = [], { organisationId = "" } = {}) {
  const products = getEffectiveProductCatalogue({ organisationId }).products;
  const accessories = new Map(discoverBathroomAccessoryTypes(products).map((type) => [type.key, type.products]));
  const productTypes = indexSelectionProductTypes(products);
  return Object.fromEntries(requirements.map((requirement) => {
    const range = requirement.areaKey === "bathroom-accessories" ? accessories.get(requirement.requirementKey) || []
      : requirement.areaKey === "plumbing-fixtures" ? products.filter((product) => isInPlumbingFixtureCategory(product, requirement.requirementKey))
        : productTypes.get(normalizeProductType(requirement.requirementKey)) || [];
    const hero = range.find((product) => product.primaryImageUrl && product.imageStatus === "verified_exact") || range.find((product) => product.primaryImageUrl);
    return [requirement.requirementKey, { count: range.length, imageUrl: hero?.primaryImageUrl || "", imageAlt: hero ? `${hero.brand} ${hero.productName}` : "" }];
  }));
}

export function isPlumbingFixtureProductFor(product = {}, requirementKey = "") {
  return Boolean(requirementKey)
    && product.attributes?.plumbingFixtureCategory === requirementKey
    && product.supplier === PLUMBING_FIXTURE_SUPPLIER
    && product.active !== false
    && !product.archived
    && !product.discontinued;
}

function plumbingFixtureOrder(product = {}) {
  const order = Number(product.attributes?.plumbingFixtureOrder);
  return Number.isFinite(order) && order > 0 ? order : Number.MAX_SAFE_INTEGER;
}

function comparePlumbingFixtureProducts(left, right) {
  const orderDifference = plumbingFixtureOrder(left) - plumbingFixtureOrder(right);
  if (orderDifference) return orderDifference;
  return `${left.brand} ${left.productName}`.localeCompare(`${right.brand} ${right.productName}`);
}

// The HNC range for one category, as the builder's effective catalogue sees it (builder
// disables still apply). Its verified HNC choices are ordered standard -> midrange -> upgrade.
export function plumbingFixtureProducts(requirementKey = "", { organisationId = "" } = {}) {
  return getEffectiveProductCatalogue({ organisationId }).products
    .filter((product) => isInPlumbingFixtureCategory(product, requirementKey))
    .sort(comparePlumbingFixtureProducts);
}

// Bath & Shower Mixers ("bath-mixer") is one category over one canonical pool: products tagged
// bath-mixer plus the few tagged shower-mixer by the HNC import. Each product appears once; whether
// a unit serves a bath or a shower is recorded on its room allocation, never by copying the product.
const MERGED_PLUMBING_CATEGORY_TAGS = { "bath-mixer": ["bath-mixer", "shower-mixer"] };
function isInPlumbingFixtureCategory(product = {}, requirementKey = "") {
  return (MERGED_PLUMBING_CATEGORY_TAGS[requirementKey] || [requirementKey]).some((tag) => isPlumbingFixtureProductFor(product, tag));
}

// Per category: how many products are offered, and a real photo from that category's own range
// to illustrate its card (there are no separate category photographs to use).
export function plumbingFixtureCategorySummaries(requirementKeys = [], { organisationId = "" } = {}) {
  const products = getEffectiveProductCatalogue({ organisationId }).products;
  return Object.fromEntries(requirementKeys.map((key) => {
    const range = products
      .filter((product) => isInPlumbingFixtureCategory(product, key))
      .sort(comparePlumbingFixtureProducts);
    const hero = range.find((product) => product.primaryImageUrl && product.imageStatus === "verified_exact");
    return [key, { count: range.length, imageUrl: hero?.primaryImageUrl || "", imageAlt: hero ? `${hero.brand} ${hero.productName}` : "" }];
  }));
}

// The code HNC displays on its product page; never the internal PLB-HNC-* catalogue id.
export function plumbingFixtureSupplierCode(product = {}) {
  const attributes = product.attributes || product.metadata?.productEntity?.attributes || {};
  return attributes.hncProductCode || product.model || "";
}

// Filters are offered only where the products actually carry that data.
export function plumbingFixtureFilterOptions(products = []) {
  const values = (pick) => Array.from(new Set(products.map(pick).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    brands: values((product) => product.brand),
    colours: values((product) => product.colour || product.attributes?.colour || ""),
    types: values((product) => product.attributes?.hncSubCategory || ""),
    hasPrices: products.some((product) => Number(product.selectedCost) > 0),
    // Category-specific facets stored on the product by its importer (e.g. floor wastes: Type,
    // Shape, Size, Length). Offered only where more than one value exists.
    facets: Object.fromEntries(
      Array.from(new Set(products.flatMap((product) => Object.keys(productFacets(product)))))
        .map((key) => [key, Array.from(new Set(products.flatMap((product) => facetValues(product, key)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))])
        .filter(([, list]) => list.length > 1),
    ),
  };
}

function productFacets(product = {}) {
  return product.attributes?.selectionFacets || product.metadata?.productEntity?.attributes?.selectionFacets || {};
}

// A facet holds one value (floor waste Shape) or every value the product is offered in (a shower
// screen's finishes, glass and sizes).
function facetValues(product = {}, key = "") {
  const value = productFacets(product)[key];
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String);
}

export function filterPlumbingFixtureProducts(products = [], { brand = "", colour = "", type = "", search = "", sort = "", facets = {} } = {}) {
  const term = String(search || "").trim().toLowerCase();
  const filtered = products.filter((product) => {
    if (brand && product.brand !== brand) return false;
    if (colour && (product.colour || product.attributes?.colour || "") !== colour) return false;
    if (type && product.attributes?.hncSubCategory !== type) return false;
    if (Object.entries(facets || {}).some(([key, value]) => value && !facetValues(product, key).includes(value))) return false;
    if (!term) return true;
    return [product.productName, product.brand, product.supplier, product.range, plumbingFixtureSupplierCode(product), product.colour, product.dimensions]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
  if (sort === "price-asc" || sort === "price-desc") {
    const direction = sort === "price-asc" ? 1 : -1;
    // Unpriced products always sort last rather than as $0.
    return [...filtered].sort((a, b) => {
      const pa = Number(a.selectedCost) || 0;
      const pb = Number(b.selectedCost) || 0;
      if (!pa || !pb) return (pb ? 1 : 0) - (pa ? 1 : 0);
      return (pa - pb) * direction;
    });
  }
  return filtered;
}
