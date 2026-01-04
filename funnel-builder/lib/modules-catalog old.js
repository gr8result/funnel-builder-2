// lib/modules-catalog.js
// Catalog for Billing page.
// Exports:
//   - MODULES: [{ id, name, icon, price_cents }]
//   - AUD(cents): "$X.XX"
//   - priceFor(selectedIds): { subtotal, discount, total, tier }
//
// NOTE: This keeps your structure intact and only APPENDS two new products:
//   digital_products, affiliate_marketplace

// ---- Prices (AUD cents). Tweak anytime. ----
const MODULES_BASE = [
  { id: "website_builder",     name: "Website builder",       icon: "🌐", price_cents: 4900 },
  { id: "business_automation", name: "Business automation",   icon: "⚙️", price_cents: 6900 },
  { id: "email_marketing",     name: "Email marketing",       icon: "📧", price_cents: 3900 },
  { id: "affiliate_management",name: "Affiliate management",  icon: "🤝", price_cents: 2900 },
  { id: "physical_products",   name: "Physical products",     icon: "📦", price_cents: 3900 },
  { id: "online_courses",      name: "Online courses",        icon: "🎓", price_cents: 3900 },
  { id: "evergreen_webinars",  name: "Evergreen webinars",    icon: "🎥", price_cents: 2900 },
  { id: "booking_calendar",    name: "Booking calendar",      icon: "📅", price_cents: 1900 },
  { id: "communities",         name: "Communities",           icon: "👥", price_cents: 2900 },
  { id: "pipelines",           name: "Pipelines",             icon: "📊", price_cents: 3900 },
  { id: "subaccounts",         name: "Subaccounts",           icon: "🧩", price_cents: 2900 },
];

// ---- NEW: appended products ----
const MODULES_EXTRA = [
  { id: "digital_products",      name: "Digital products",     icon: "💾", price_cents: 2900 },
  { id: "affiliate_marketplace", name: "Affiliate marketplace",icon: "🛒", price_cents: 3900 },
];

// Final export used by Billing
export const MODULES = [...MODULES_BASE, ...MODULES_EXTRA];

// Currency formatter (kept simple & fast)
export function AUD(cents = 0) {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

// Discount tiers (unchanged behaviour for billing UI):
// pick the highest tier where selected count >= min_count
const DISCOUNT_TIERS = [
  { min_count: 3, percent_off: 10 },
  { min_count: 5, percent_off: 15 },
  { min_count: 8, percent_off: 20 },
];

export function priceFor(selectedIds = []) {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const selected = new Set(ids);

  const subtotal = MODULES
    .filter(m => selected.has(m.id))
    .reduce((sum, m) => sum + (m.price_cents || 0), 0);

  // choose best tier
  let tier = { min_count: 0, percent_off: 0 };
  for (const t of DISCOUNT_TIERS) {
    if (ids.length >= t.min_count) tier = t;
  }

  const discount = Math.round(subtotal * (tier.percent_off / 100));
  const total = Math.max(0, subtotal - discount);

  return { subtotal, discount, total, tier };
}




