// lib/modules-catalog.js
// Catalog for Billing page.
// Exports:
//   - MODULES: [{ id, name, icon, price_cents }]
//   - AUD(cents): "$X.XX"
//   - priceFor(selectedIds): { subtotal, discount, total, tier }
//
// Also exports:
//   - DISCOUNT_TIERS: { [tierName]: percentOff }  (used by /pages/api/stripe-session.js)


// ---- Prices (AUD cents). Tweak anytime. ----
const MODULES_BASE = [
  { id: "website_builder",      name: "Website builder",        icon: "🌐", price_cents: 4900 },
  { id: "business_automation",  name: "Business automation",    icon: "⚙️", price_cents: 6900 },
  { id: "email_marketing",      name: "Email marketing",        icon: "📧", price_cents: 7900 },
  { id: "affiliate_management", name: "Affiliate management",   icon: "🤝", price_cents: 2900 },
  { id: "physical_products",    name: "Physical products",      icon: "📦", price_cents: 3900 },
  { id: "online_courses",       name: "Online courses",         icon: "🎓", price_cents: 3900 },
  { id: "evergreen_webinars",   name: "Evergreen webinars",     icon: "🎥", price_cents: 2900 },
  { id: "booking_calendar",     name: "Booking calendar",       icon: "📅", price_cents: 1900 },
  { id: "communities",          name: "Communities",            icon: "👥", price_cents: 2900 },
  { id: "pipelines",            name: "Pipelines",              icon: "📊", price_cents: 3900 },
  { id: "subaccounts",          name: "Subaccounts",            icon: "🧩", price_cents: 2900 },
];

// ---- NEW: appended products ----
const MODULES_EXTRA = [
  { id: "digital_products",       name: "Digital products",      icon: "💾", price_cents: 2900 },
  { id: "affiliate_marketplace",  name: "Affiliate marketplace", icon: "🛒", price_cents: 3900 },
];

// Final export used by Billing
export const MODULES = [...MODULES_BASE, ...MODULES_EXTRA];

// Currency formatter (kept simple & fast)
export function AUD(cents = 0) {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

/**
 * Tier discounts by tier name (used by stripe session creation).
 * Keep these as numbers (percent off).
 */
export const DISCOUNT_TIERS = {
  none: 0,
  starter: 0,
  growth: 0,
  scale: 0,
  pro: 0,
  agency: 0,
};

/**
 * Discount rules for the billing UI priceFor() helper.
 * This is what the billing page expects when it wants "best tier" based on module count.
 * You can tweak these any time.
 */
const DISCOUNT_RULES = [
  { min_count: 0,  percent_off: DISCOUNT_TIERS.none,    tier: "none" },
  { min_count: 3,  percent_off: DISCOUNT_TIERS.starter, tier: "starter" },
  { min_count: 5,  percent_off: DISCOUNT_TIERS.growth,  tier: "growth" },
  { min_count: 7,  percent_off: DISCOUNT_TIERS.scale,   tier: "scale" },
  { min_count: 9,  percent_off: DISCOUNT_TIERS.pro,     tier: "pro" },
  { min_count: 11, percent_off: DISCOUNT_TIERS.agency,  tier: "agency" },
];

export function priceFor(selectedIds = []) {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const selected = new Set(ids);

  const subtotal = MODULES
    .filter((m) => selected.has(m.id))
    .reduce((sum, m) => sum + (m.price_cents || 0), 0);

  // choose best tier based on # modules selected
  let tier = DISCOUNT_RULES[0];
  for (const t of DISCOUNT_RULES) {
    if (ids.length >= t.min_count) tier = t;
  }

  const discount = Math.round(subtotal * (tier.percent_off / 100));
  const total = Math.max(0, subtotal - discount);

  return { subtotal, discount, total, tier };
}
