import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeUpgradeValue,
  effectiveUpgradeValue,
  upgradeImpactType,
  upgradeImpactLabel,
  money,
} from "../lib/product-library/helpers.js";
import { normalizePricingTier, tierAccess, TIER_RANK, PRICING_TIERS } from "../lib/product-library/constants.js";
import { parseCsv, csvRecords, slugify, normalizeMoney, truthyCsv } from "../lib/product-library/csv.js";
import {
  calculateSelectionFinancials,
  calculateSelectionVariation,
  calculateSessionBudget,
  roundMoney,
} from "../lib/builders/selectionBudget.js";
import { isValidProductUrl } from "../lib/product-library/urlValidation.js";
import { PRODUCT_CSV_HEADERS } from "../lib/product-library/csv.js";

// --- Upgrade value: Upgrade Value = Builder Cost - Included Allowance ---------------
assert.equal(computeUpgradeValue({ cost_price: 850, base_allowance: 500 }), 350, "auto upgrade value should be cost - allowance");
assert.equal(upgradeImpactType(350), "upgrade");
assert.equal(upgradeImpactLabel(350), `+${money(350)} Upgrade`);

// Downgrade / credit: selected product cheaper than the allowance.
assert.equal(computeUpgradeValue({ cost_price: 400, base_allowance: 500 }), -100, "a downgrade should compute as a negative credit");
assert.equal(upgradeImpactType(-100), "credit");
assert.equal(upgradeImpactLabel(-100), `-${money(100)} Credit`);

// Included: cost equals allowance exactly.
assert.equal(computeUpgradeValue({ cost_price: 500, base_allowance: 500 }), 0);
assert.equal(upgradeImpactType(0), "included");
assert.equal(upgradeImpactLabel(0), "Included");

// Manual override takes precedence over the automatic calculation, and can itself be negative.
assert.equal(
  effectiveUpgradeValue({ cost_price: 850, base_allowance: 500, upgrade_value_mode: "manual", upgrade_cost: 999 }),
  999,
  "manual override should win over the automatic calculation"
);
assert.equal(
  effectiveUpgradeValue({ cost_price: 850, base_allowance: 500, upgrade_value_mode: "manual", upgrade_cost: -50 }),
  -50,
  "manual override supports a negative (credit) value"
);
// Reset to automatic: once upgrade_value_mode flips back to auto, the manual number must be ignored.
assert.equal(
  effectiveUpgradeValue({ cost_price: 850, base_allowance: 500, upgrade_value_mode: "auto", upgrade_cost: 999 }),
  350,
  "resetting to automatic must ignore any previously stored manual override"
);

// Rounding must not drift across repeated cent-level operations.
assert.equal(computeUpgradeValue({ cost_price: 100.1, base_allowance: 33.33 }), 66.77);

// --- Pricing tiers: cumulative Classic <= Premier <= Premium -----------------------
assert.deepEqual(PRICING_TIERS.map((t) => t.value), ["CLASSIC", "PREMIER", "PREMIUM"]);
assert.equal(normalizePricingTier("classic"), "CLASSIC");
assert.equal(normalizePricingTier(""), "CLASSIC", "an untiered product defaults to Classic");
assert.equal(normalizePricingTier("nonsense"), "CLASSIC");
assert.equal(tierAccess("PREMIER", "CLASSIC"), "included", "a lower-tier product is included in a higher project tier");
assert.equal(tierAccess("PREMIER", "PREMIER"), "included");
assert.equal(tierAccess("CLASSIC", "PREMIUM"), "upgrade", "a higher-tier product is an upgrade on a lower project tier");
assert.ok(TIER_RANK.CLASSIC < TIER_RANK.PREMIER && TIER_RANK.PREMIER < TIER_RANK.PREMIUM);

// --- CSV parsing / validation helpers -----------------------------------------------
const csvText = [
  "Product Name,Internal Product Code,Cost",
  "Bosch Oven,OVEN-001,850",
  '"Franke Sink, Double Bowl",SINK-002,"1,200"',
].join("\n");
const records = csvRecords(csvText);
assert.equal(records.length, 2);
assert.equal(records[0].product_name, "Bosch Oven");
assert.equal(records[0].internal_product_code, "OVEN-001");
assert.equal(records[1].product_name, "Franke Sink, Double Bowl", "quoted commas inside a cell must not split the row");
assert.equal(normalizeMoney(records[1].cost), 1200, "quoted thousands-separated money must parse to a plain number");
assert.equal(normalizeMoney(""), null);
assert.equal(normalizeMoney("not a number"), null);
assert.equal(truthyCsv("yes"), true);
assert.equal(truthyCsv("no"), false);
assert.equal(truthyCsv("", true), true, "blank falls back to the provided default");
assert.equal(slugify("Kitchen Sinks"), "kitchen_sinks");

// Duplicate product-code detection within a single import file (mirrors the check in
// pages/api/product-library/import-preview.js and import-commit.js).
function findDuplicateSkusInFile(rows) {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row) => {
    const key = slugify(row.internal_product_code);
    if (!key) return;
    if (seen.has(key)) duplicates.push(row.internal_product_code);
    seen.add(key);
  });
  return duplicates;
}
const dupeRows = csvRecords(
  ["product_name,internal_product_code", "A,SKU-1", "B,SKU-1", "C,SKU-2"].join("\n")
);
assert.deepEqual(findDuplicateSkusInFile(dupeRows), ["SKU-1"]);

// --- Selection financials: negative credits, manual override, GST -----------------
const upgradeCase = calculateSelectionFinancials({
  builderCost: 850,
  includedAllowance: 500,
  builderMarkupPercent: 0,
  gstRate: 10,
});
assert.equal(upgradeCase.impactType, "upgrade");
assert.equal(upgradeCase.variationAmount, roundMoney(850 * 1.1 - 500));

const creditCase = calculateSelectionFinancials({
  builderCost: 300,
  includedAllowance: 500,
  builderMarkupPercent: 0,
  gstRate: 10,
});
assert.equal(creditCase.impactType, "credit");
assert.ok(creditCase.variationAmount < 0, "a cheaper selection than its allowance must be a negative credit, never clamped to zero");

const overrideCase = calculateSelectionFinancials({
  builderCost: 850,
  includedAllowance: 500,
  manualOverridePrice: 400,
});
assert.equal(overrideCase.hasManualOverride, true);
assert.equal(overrideCase.clientSelectionPrice, 400);
assert.equal(overrideCase.variationAmount, roundMoney(400 - 500), "manual override must flow through to the variation, not the calculated price");

// calculateSelectionVariation: wastage/markup/overhead/commission/admin-fee/GST on the
// cost-over-allowance difference only, with the admin fee waived on a credit.
const variation = calculateSelectionVariation({
  allowance: 500,
  selectedProduct: { builderCost: 850 },
  quantity: 1,
  projectPricingSettings: {
    default_wastage_percent: 0,
    default_builder_markup_percent: 20,
    default_overhead_percent: 5,
    default_sales_commission_percent: 2,
    variation_admin_fee: 50,
    default_gst_rate: 10,
  },
});
assert.equal(variation.rawDifference, 350);
assert.equal(variation.impactType, "upgrade");
assert.ok(variation.administrationFee === 50, "the flat admin fee applies to an upgrade");

const variationCredit = calculateSelectionVariation({
  allowance: 500,
  selectedProduct: { builderCost: 300 },
  projectPricingSettings: { variation_admin_fee: 50, default_gst_rate: 10 },
});
assert.equal(variationCredit.administrationFee, 0, "the flat admin fee must never apply to a credit");
assert.ok(variationCredit.clientVariationTotal < 0);

// calculateSessionBudget must exclude replaced/removed selections from the running total.
const sessionBudget = calculateSessionBudget({
  originalEstimateTotal: 500000,
  privateUpgradeCeiling: 10000,
  selections: [
    { is_active: true, selection_status: "selected", variation_amount: 1000 },
    { is_active: true, selection_status: "replaced", variation_amount: 5000 },
    { is_active: false, selection_status: "selected", variation_amount: 2000 },
    { is_active: true, selection_status: "approved", variation_amount: -300 },
  ],
});
assert.equal(sessionBudget.currentNetSelectionVariation, 700, "only active, non-replaced/removed selections count toward the running total");
assert.equal(sessionBudget.currentUpdatedEstimateTotal, 500700);

// --- Static assertions for DB/API-only behaviour that can't run without a live DB ---
const migrationSql = fs.readFileSync(
  new URL("../supabase/migrations/20260726_client_selections_library.sql", import.meta.url),
  "utf8"
);
assert.match(
  migrationSql,
  /builder_products_standard_per_tier_uidx/,
  "a unique index preventing conflicting standard-inclusion products per category+tier must exist"
);
assert.match(migrationSql, /where standard_included = true and active = true and category_id is not null/);

const productsApi = fs.readFileSync(new URL("../pages/api/product-library/products.js", import.meta.url), "utf8");
assert.match(productsApi, /assertNoStandardInclusionConflict/, "the write API must check for a standard-inclusion conflict before saving");
assert.match(productsApi, /builder_client_selections/, "delete must check whether the product is referenced by a project selection");
assert.match(productsApi, /archivedInstead: true/, "a referenced product must be archived rather than deleted");

const clientSelectionsPage = fs.readFileSync(new URL("../pages/modules/builders/client-selections.js", import.meta.url), "utf8");
assert.match(clientSelectionsPage, /product_id: form\.productId \|\| null/, "a selection created from the catalogue must store product_id");
assert.match(clientSelectionsPage, /brand: form\.brand\.trim\(\)/, "the selection row must snapshot brand/model/colour/etc. at selection time, not just a product_id reference");
assert.match(clientSelectionsPage, /hasActiveDraftVariation/, "creating a draft variation must be guarded against duplicates");

// --- Product URL validation: never a fabricated link, never an insecure scheme silently accepted ---
assert.equal(isValidProductUrl("").empty, true, "an empty URL is valid (nothing stored) but flagged as empty");
assert.equal(isValidProductUrl("   ").empty, true);
assert.equal(isValidProductUrl("https://www.bosch-home.com.au/productdetail/HBG7341B1A").ok, true, "a real https product URL must validate");
assert.equal(isValidProductUrl("not a url").ok, false, "garbage input must be rejected, never silently accepted");
assert.equal(isValidProductUrl("javascript:alert(1)").ok, false, "non-http(s) schemes must be rejected");
assert.equal(isValidProductUrl("ftp://example.com/product").ok, false);
const httpCheck = isValidProductUrl("http://example.com/product");
assert.equal(httpCheck.ok, true, "http is allowed but must carry a warning, matching the brief's 'preferably HTTPS'");
assert.ok(httpCheck.warning, "an http (non-secure) link must surface a warning to the user");

// --- CSV schema covers the brief's media/verification fields ---
["additional_image_urls", "supplier_product_url", "manufacturer_product_url", "image_source_url", "image_verification_status", "date_last_verified"].forEach((header) => {
  assert.ok(PRODUCT_CSV_HEADERS.includes(header), `PRODUCT_CSV_HEADERS must include ${header}`);
});

// --- Static assertions for the collapsible nav / Focus Mode / media migration ---
const layoutSource = fs.readFileSync(new URL("../components/Layout.js", import.meta.url), "utf8");
assert.match(layoutSource, /export const NavCollapseContext/, "Layout.js must expose a nav-collapse context so pages can drive Focus Mode without prop-drilling through _app.js");
assert.match(layoutSource, /NAV_COLLAPSE_STORAGE_KEY/, "the global nav collapse preference must be persisted");

const selectionsBookSource = fs.readFileSync(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");
assert.match(selectionsBookSource, /BOOK_SIDEBAR_COLLAPSE_KEY/, "the schedule's local sidebar collapse preference must be persisted");
assert.match(selectionsBookSource, /enterFocusMode/);
assert.match(selectionsBookSource, /event\.key === "Escape"/, "Escape must exit Focus Mode");
assert.match(selectionsBookSource, /Selection Status/, "the schedule table must have its own Selection Status column, split from the upgrade/credit amount");

const externalLinkSource = fs.readFileSync(new URL("../components/product-library/ExternalProductLink.jsx", import.meta.url), "utf8");
assert.match(externalLinkSource, /target="_blank"/, "product links must open in a new tab, never navigate the current selections session away");
assert.match(externalLinkSource, /rel="noopener noreferrer"/, "product links must use rel=noopener noreferrer");

const mediaMigrationSql = fs.readFileSync(new URL("../supabase/migrations/20260728_client_selections_media_links.sql", import.meta.url), "utf8");
assert.match(mediaMigrationSql, /verification_status/, "the media migration must add the verification workflow columns");
assert.match(mediaMigrationSql, /image_unavailable/, "stock-photo-domain images already stored must be flagged, never silently deleted");

console.log("Client Selections Library calculation and validation tests passed.");
