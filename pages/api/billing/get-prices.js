// /pages/api/billing/get-prices.js
// FULL REPLACEMENT
// Fixes: "MODULE_PRICES is not exported from '../../../data/pricing'"
// - Imports * as pricingModule and returns the best available export safely.

import * as pricingModule from "../../../data/pricing";

function pickPricing(mod) {
  // Support a bunch of possible shapes without breaking builds.
  // Priority order:
  // 1) MODULE_PRICES
  // 2) PRICES
  // 3) PRICING
  // 4) default export
  // 5) entire module object (last resort)
  if (mod && typeof mod === "object") {
    if (mod.MODULE_PRICES && typeof mod.MODULE_PRICES === "object")
      return mod.MODULE_PRICES;
    if (mod.PRICES && typeof mod.PRICES === "object") return mod.PRICES;
    if (mod.PRICING && typeof mod.PRICING === "object") return mod.PRICING;
    if (mod.default && typeof mod.default === "object") return mod.default;
    return mod;
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "GET only" });
  }

  try {
    const pricing = pickPricing(pricingModule);

    return res.status(200).json({
      ok: true,
      pricing,
    });
  } catch (e) {
    console.error("get-prices error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
