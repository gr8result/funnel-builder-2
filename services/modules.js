// services/modules.js
// Single source of truth for modules and their Stripe Price IDs (from env).

export const MODULES = [
  { slug: "automation",  name: "Automation",            env: "NEXT_PUBLIC_PRICE_AUTOMATION"  },
  { slug: "email",       name: "Email marketing",       env: "NEXT_PUBLIC_PRICE_EMAIL"       },
  { slug: "affiliates",  name: "Affiliate management",  env: "NEXT_PUBLIC_PRICE_AFFILIATES"  },
  { slug: "products",    name: "Physical products",     env: "NEXT_PUBLIC_PRICE_PRODUCTS"    },
  { slug: "courses",     name: "Online courses",        env: "NEXT_PUBLIC_PRICE_COURSES"     },
  { slug: "webinars",    name: "Webinars",              env: "NEXT_PUBLIC_PRICE_WEBINARS"    },
  { slug: "communities", name: "Communities",           env: "NEXT_PUBLIC_PRICE_COMMUNITIES" },
  { slug: "pipelines",   name: "Pipelines",             env: "NEXT_PUBLIC_PRICE_PIPELINES"   },
  { slug: "subaccounts", name: "Subaccounts",           env: "NEXT_PUBLIC_PRICE_SUBACCOUNTS" },
];

// env → priceId
export function resolvePrices() {
  return MODULES.map(m => ({ ...m, priceId: process.env[m.env] || "" }));
}

// slug → priceId
export function slugsToPriceIds(slugs=[]) {
  const map = Object.fromEntries(resolvePrices().map(m => [m.slug, m.priceId]));
  return slugs.map(s => map[s]).filter(Boolean);
}

// priceId → slug (used by webhook)
export function priceToSlugMap() {
  const map = {};
  for (const m of resolvePrices()) if (m.priceId) map[m.priceId] = m.slug;
  return map;
}
