import { PRICE_BANDS, TIER_RANK } from "./constants.js";

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  const stripped = String(value).replace(/[^0-9.-]/g, "");
  if (!/\d/.test(stripped)) return null; // e.g. "not a number" strips to "" / "-" — not a real amount
  const numeric = Number(stripped);
  return Number.isFinite(numeric) ? numeric : null;
}

export function truthyCsv(value, fallback = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y", "included", "active"].includes(text);
}

export function normalizePriceBand(value) {
  const key = slugify(value);
  return PRICE_BANDS.some((band) => band.value === key) ? key : "mid_range";
}

export function normalizePricingTierCsv(value) {
  const tier = String(value || "").trim().toUpperCase();
  return TIER_RANK[tier] ? tier : null;
}

export function csvCell(input) {
  const text = String(input ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseCsv(text) {
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

export function csvRecords(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => slugify(header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

export const PRODUCT_CSV_HEADERS = [
  "product_code",
  "internal_product_code",
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
  "selection_group",
  "tier",
  "pricing_tier",
  "supplier",
  "supplier_sku",
  "builder_cost",
  "client_price",
  "allowance",
  "currency",
  "gst_treatment",
  "width",
  "fuel_type",
  "mounting_type",
  "installation_type",
  "image_url_or_reference",
  "product_url",
  "active_status",
  "availability_status",
  "visual_product",
  "requires_image",
  "library_scope",
  "supplier_code",
  "size",
  "colour",
  "finish",
  "cost",
  "included_allowance",
  "upgrade_value",
  "rrp",
  "sell_price",
  "markup",
  "gst_included",
  "unit",
  "standard_included",
  "available_for_selection",
  "active",
  "display_order",
  "image_url",
  "additional_image_urls",
  "supplier_product_url",
  "manufacturer_product_url",
  "image_source_url",
  "image_verification_status",
  "date_last_verified",
  "spec_pdf_url",
  "description",
  "notes",
  "client_notes",
];
