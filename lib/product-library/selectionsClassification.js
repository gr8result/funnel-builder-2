export const SELECTIONS_PRODUCT_TAGS = [
  "appliance",
  "oven",
  "built-in-oven",
  "freestanding-oven",
  "cooktop",
  "gas-cooktop",
  "electric-cooktop",
  "induction-cooktop",
  "rangehood",
  "dishwasher",
  "microwave",
  "refrigerator",
  "600mm",
  "900mm",
  "tapware",
  "basin-mixer",
  "shower-mixer",
  "sink-mixer",
  "kitchen-mixer",
  "laundry-mixer",
  "bath-mixer",
  "bath-outlet",
  "shower-outlet",
  "wall-mounted",
  "bench-mounted",
  "wet-area",
  "basin",
  "toilet",
  "bath",
  "shower-screen",
  "vanity",
  "bathroom-accessory",
  "internal-door",
  "external-door",
  "entry-door",
  "garage-door",
  "passage-hardware",
  "privacy-hardware",
  "entrance-hardware",
  "floor-tile",
  "wall-tile",
  "feature-tile",
  "carpet",
  "hybrid-flooring",
  "timber-flooring",
  "internal-paint",
  "external-paint",
  "cabinetry",
  "benchtop",
  "splashback",
  "roofing",
  "colorbond-roofing",
  "roof-tile",
  "brick",
  "cladding",
  "robe-fitout",
  "shelf-and-rail",
  "drawers",
  "shelving",
];

export const SELECTIONS_COMPATIBILITY_FIELDS = [
  "product_code",
  "product_name",
  "brand",
  "range",
  "model",
  "description",
  "category",
  "subcategory",
  "product_type",
  "requirement_tags",
  "compatible_area_types",
  "tier",
  "supplier",
  "supplier_sku",
  "builder_cost",
  "client_price",
  "allowance",
  "currency",
  "gst_treatment",
  "colour",
  "finish",
  "size",
  "width",
  "fuel_type",
  "mounting_type",
  "installation_type",
  "image_url_or_reference",
  "product_url",
  "active_status",
  "availability_status",
];

export function normalizeSelectionTag(value) {
  return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]+/g, "").replace(/--+/g, "-");
}

export function parseSelectionTags(value) {
  return [...new Set(String(value || "").split(/[|;,]/).map(normalizeSelectionTag).filter(Boolean))];
}

export function validateSelectionsProductCsvRecord(record) {
  const errors = [];
  if (!String(record.product_name || "").trim()) errors.push("product_name is required");
  if (!String(record.category || "").trim()) errors.push("category is required");
  if (!String(record.subcategory || "").trim()) errors.push("subcategory is required");
  const tags = parseSelectionTags(record.requirement_tags);
  if (!tags.length) errors.push("requirement_tags is required");
  const unknown = tags.filter((tag) => !SELECTIONS_PRODUCT_TAGS.includes(tag));
  if (unknown.length) errors.push(`Unknown requirement_tags: ${unknown.join(", ")}`);
  if (!String(record.tier || "").trim()) errors.push("tier is required");
  if (!String(record.supplier || "").trim()) errors.push("supplier is required");
  return { ok: errors.length === 0, errors, tags };
}
