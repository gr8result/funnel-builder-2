export const PRICE_BANDS = [
  { value: "budget", label: "Budget" },
  { value: "mid_range", label: "Mid Range" },
  { value: "higher_end", label: "Higher End" },
  { value: "luxury", label: "Luxury" },
];

export const PRICING_MODES = [
  { value: "markup", label: "Markup %" },
  { value: "fixed_sell", label: "Fixed sell price" },
];

export const LIBRARY_SCOPES = [
  { value: "CLIENT_SELECTION", label: "Client Selection" },
  { value: "ESTIMATING", label: "Estimating" },
  { value: "BOTH", label: "Both" },
];

export const PRODUCT_LIBRARY_SCOPES = new Set(["CLIENT_SELECTION", "BOTH"]);
export const QUOTATION_BUILDER_SCOPES = new Set(["ESTIMATING", "BOTH"]);

// Cumulative client-selection pricing tiers. A project on a given tier may select
// its own tier and every tier below it; higher tiers appear as available upgrades.
export const PRICING_TIERS = [
  { value: "CLASSIC", label: "Classic" },
  { value: "PREMIER", label: "Premier" },
  { value: "PREMIUM", label: "Premium" },
];

export const TIER_RANK = { CLASSIC: 1, PREMIER: 2, PREMIUM: 3 };

export function normalizePricingTier(value, fallback = "CLASSIC") {
  const tier = String(value || "").trim().toUpperCase();
  return TIER_RANK[tier] ? tier : fallback;
}

// "included" when the product's tier is at or below the project's package tier,
// otherwise "upgrade". A product with no tier is treated as CLASSIC.
export function tierAccess(projectTier, productTier) {
  const projectRank = TIER_RANK[normalizePricingTier(projectTier)] || TIER_RANK.CLASSIC;
  const productRank = TIER_RANK[normalizePricingTier(productTier)] || TIER_RANK.CLASSIC;
  return productRank <= projectRank ? "included" : "upgrade";
}

// Category keys that default to requiring an image. Anything not listed here
// defaults to false (non-visual cost item). Matches the seed in
// supabase/migrations/20260723_product_library_rebuild.sql.
export const VISUAL_CATEGORY_KEYS = new Set([
  "roofing",
  "windows",
  "external_doors",
  "internal_doors",
  "tapware",
  "sanitaryware",
  "electrical",
  "lighting",
  "appliances",
  "cabinetry",
  "benchtops",
  "tiles",
  "flooring",
  "carpet",
]);

export const CLIENT_SELECTION_CATEGORY_KEYS = new Set([
  "roofing",
  "gutters",
  "windows",
  "garage_doors",
  "external_doors",
  "internal_doors",
  "paint",
  "painting",
  "kitchen",
  "butlers_pantry",
  "laundry",
  "bathroom",
  "ensuite",
  "powder_room",
  "plumbing",
  "tapware",
  "sanitaryware",
  "electrical",
  "lighting",
  "appliances",
  "cabinetry",
  "benchtops",
  "tiles",
  "flooring",
  "carpet",
  "air_conditioning",
  "external_works",
  "landscaping",
  "wardrobes",
]);

export const ESTIMATING_ONLY_CATEGORY_KEYS = new Set([
  "preliminaries",
  "site_works",
  "concrete",
  "structural_steel",
  "framing",
  "labour",
  "labor",
  "hire",
  "allowances",
]);

export const ROOM_AREA_OPTIONS = [
  "Kitchen",
  "Bathroom",
  "Ensuite",
  "Powder Room",
  "Laundry",
  "Flooring",
  "Doors & Hardware",
  "Windows",
  "Electrical & Lighting",
  "Internal Finishes",
  "External Finishes",
  "Wardrobes & Storage",
  "Outdoor",
];

export const CATEGORY_AREA_MAP = {
  appliances: "Kitchen",
  kitchen: "Kitchen",
  butlers_pantry: "Kitchen",
  cabinetry: "Kitchen",
  benchtops: "Kitchen",
  bathroom: "Bathroom",
  tapware: "Bathroom",
  sanitaryware: "Bathroom",
  ensuite: "Ensuite",
  laundry: "Laundry",
  flooring: "Flooring",
  carpet: "Flooring",
  tiles: "Internal Finishes",
  internal_doors: "Doors & Hardware",
  external_doors: "Doors & Hardware",
  garage_doors: "Doors & Hardware",
  windows: "Windows",
  electrical: "Electrical & Lighting",
  lighting: "Electrical & Lighting",
  paint: "Internal Finishes",
  painting: "Internal Finishes",
  roofing: "External Finishes",
  gutters: "External Finishes",
  external_works: "Outdoor",
  landscaping: "Outdoor",
  wardrobes: "Wardrobes & Storage",
};

export function defaultRequiresImageForCategory(category) {
  if (!category) return false;
  if (typeof category.metadata?.default_requires_image === "boolean") {
    return category.metadata.default_requires_image;
  }
  return VISUAL_CATEGORY_KEYS.has(category.category_key);
}

export function normalizeLibraryScope(value, fallback = "CLIENT_SELECTION") {
  const scope = String(value || "").trim().toUpperCase();
  return LIBRARY_SCOPES.some((option) => option.value === scope) ? scope : fallback;
}

export const PRICE_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "priced", label: "Has sell price" },
  { value: "unpriced", label: "Missing sell price" },
];

export const VIEW_MODE_STORAGE_KEY = "product_library_view_mode";

// Roles allowed to see builder cost/markup fields on the Client Selections Library.
// Matches the role split already used by client-selections.js so cost visibility is
// consistent across the catalogue and the project selections workflow.
export const INTERNAL_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff", "interior_designer"]);
export const COST_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff"]);

export const UPGRADE_VALUE_MODES = [
  { value: "auto", label: "Automatic (Builder Cost − Included Allowance)" },
  { value: "manual", label: "Manual override" },
];

// Selection groups from the brief. Editable in the Manage Categories modal — this list
// only seeds the initial options; builder_product_categories.selection_group is free text.
export const SELECTION_GROUPS = [
  "Kitchen and appliances",
  "Bathrooms",
  "Laundry",
  "Flooring",
  "Doors and hardware",
  "Electrical and lighting",
  "Climate",
  "Painting and colours",
  "Wardrobes",
  "Window furnishings",
  "Outdoor selections",
];

export const DEFAULT_TABLE_COLUMNS = [
  { key: "image", label: "", width: 64, sortable: false, alwaysVisible: true },
  { key: "product_name", label: "Product Name", width: 220, sortable: true, alwaysVisible: true },
  { key: "brand_model", label: "Brand / Model", width: 180, sortable: false },
  { key: "category", label: "Category", width: 150, sortable: true },
  { key: "supplier", label: "Supplier", width: 170, sortable: true },
  { key: "cost", label: "Cost", width: 110, sortable: true, align: "right" },
  { key: "sell", label: "Sell", width: 110, sortable: true, align: "right" },
  { key: "status", label: "Status", width: 110, sortable: true },
  { key: "actions", label: "Actions", width: 130, sortable: false, alwaysVisible: true },
];

export const OPTIONAL_TABLE_COLUMNS = [
  { key: "sku", label: "Product Code", width: 140, sortable: true },
  { key: "room_or_usage", label: "Room / Usage", width: 140, sortable: true },
  { key: "price_band", label: "Price Band", width: 120, sortable: true },
  { key: "updated_at", label: "Last Updated", width: 140, sortable: true },
];

export const DENSITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
];
