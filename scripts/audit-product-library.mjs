/**
 * Read-only Product Library data-quality audit. Reports issues without changing
 * any data, per the "migration/report rather than silently discarding data" rule.
 *
 * Run with: node scripts/audit-product-library.mjs [workspaceId]
 * Omit workspaceId to audit every workspace's products in one pass.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
const workspaceIdFilter = process.argv[2] || null;

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  let query = supabase.from("builder_products").select("*");
  if (workspaceIdFilter) query = query.eq("workspace_id", workspaceIdFilter);
  const { data: products, error } = await query;
  if (error) {
    console.error("Could not read builder_products:", error.message || error);
    process.exit(1);
  }

  const report = {
    totalProducts: products.length,
    duplicateNames: [],
    duplicateSkus: [],
    missingCategory: [],
    missingSupplier: [],
    malformedPrices: [],
    inactiveProducts: [],
    missingProductCode: [],
    missingImageForVisual: [],
    invalidPricingTier: [],
    conflictingStandardInclusions: [],
  };

  const byName = new Map();
  const bySku = new Map();
  const byStandardInclusionSlot = new Map();
  const VALID_TIERS = new Set(["CLASSIC", "PREMIER", "PREMIUM"]);

  for (const product of products) {
    const nameKey = slugify(product.product_name);
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(product.id);
    }
    const skuKey = slugify(product.sku);
    if (skuKey) {
      if (!bySku.has(skuKey)) bySku.set(skuKey, []);
      bySku.get(skuKey).push(product.id);
    }

    if (!product.category_id) report.missingCategory.push(product.id);
    if (!product.supplier_id) report.missingSupplier.push(product.id);
    if (!product.sku) report.missingProductCode.push(product.id);
    if (product.active === false) report.inactiveProducts.push(product.id);

    const priceFields = ["base_allowance", "upgrade_cost", "cost_price", "sell_price", "markup_percent"];
    for (const field of priceFields) {
      const value = product[field];
      if (value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        report.malformedPrices.push({ id: product.id, field, value });
      }
    }

    if (product.is_visual_product && product.requires_image !== false && !product.primary_image_url) {
      report.missingImageForVisual.push(product.id);
    }

    if (product.pricing_tier && !VALID_TIERS.has(product.pricing_tier)) {
      report.invalidPricingTier.push({ id: product.id, value: product.pricing_tier });
    }

    if (product.standard_included && product.active !== false && product.category_id) {
      const slotKey = `${product.workspace_id || "platform"}|${product.category_id}|${product.pricing_tier || "CLASSIC"}`;
      if (!byStandardInclusionSlot.has(slotKey)) byStandardInclusionSlot.set(slotKey, []);
      byStandardInclusionSlot.get(slotKey).push(product.id);
    }
  }

  for (const [key, ids] of byName) if (ids.length > 1) report.duplicateNames.push({ key, ids });
  for (const [key, ids] of bySku) if (ids.length > 1) report.duplicateSkus.push({ key, ids });
  for (const [key, ids] of byStandardInclusionSlot) {
    if (ids.length > 1) report.conflictingStandardInclusions.push({ categoryAndTier: key, ids });
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nSummary: ${report.totalProducts} products, ${report.duplicateNames.length} duplicate names, ${report.duplicateSkus.length} duplicate SKUs, ${report.missingCategory.length} missing category, ${report.missingSupplier.length} missing supplier, ${report.malformedPrices.length} malformed prices, ${report.inactiveProducts.length} inactive, ${report.missingProductCode.length} missing product code, ${report.missingImageForVisual.length} visual products missing a required image, ${report.invalidPricingTier.length} invalid pricing tiers, ${report.conflictingStandardInclusions.length} conflicting standard-inclusion slots.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
