// utils/affdb.js
// FULL REPLACEMENT
// Server-only DB adapter for Affiliate Marketplace.
// ✅ NO fs/path
// ✅ NO hard-coded products
// ✅ Build-safe

export const EMPTY_AFF_DB = {
  programs: [],
  applications: [],
  approvals: [],
  links: [],
  clicks: [],
  conversions: [],
  payouts: [],
};

export function nid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function getUserId(/* req */) {
  return null;
}

// In-memory placeholder (per server process). Not persistent.
let mem = { ...EMPTY_AFF_DB };

export async function readDB() {
  return mem;
}

export async function writeDB(db) {
  mem = db && typeof db === "object" ? db : { ...EMPTY_AFF_DB };
  return true;
}
