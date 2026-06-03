/**
 * One-time script: inserts a "chart" block after the pricing-table block
 * on the Pricing page of the real site row 787be237-afa3-448e-88ba-674f79d71486.
 *
 * Usage:  node scripts/insert-chart-block.cjs
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROW_ID = "787be237-afa3-448e-88ba-674f79d71486";
const TABLE_NAME = "published_websites";
const PAGE_KEY = "Pricing";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CHART_BLOCK_PROPS = {
  heading: "Price Savings Comparison",
  subheading: "See how much you save vs. buying each module individually",
  backgroundColor: "#0f172a",
  textColor: "#f8fafc",
  showAnnualSavings: true,
  fullWidthBackground: true,
  baseLayoutWidth: 1500,
  plans: [
    { id: "starter", name: "Starter", color: "#6366f1", individualPrice: 215, billingPrice: 159 },
    { id: "growth", name: "Growth", color: "#22c55e", individualPrice: 474, billingPrice: 359 },
    { id: "scale", name: "Scale", color: "#f59e0b", individualPrice: 913, billingPrice: 499 },
    { id: "professional", name: "Professional", color: "#7c3aed", individualPrice: 1883, billingPrice: 999 },
  ],
};

async function run() {
  const { data: row, error } = await supabase
    .from(TABLE_NAME)
    .select("id, site_data")
    .eq("id", ROW_ID)
    .single();

  if (error) throw error;
  if (!row) { console.error("Row not found:", ROW_ID); process.exit(1); }

  const siteData = row.site_data && typeof row.site_data === "object" ? row.site_data : {};
  const pageBlocks = siteData.pageBlocks && typeof siteData.pageBlocks === "object" ? { ...siteData.pageBlocks } : {};
  const blocks = Array.isArray(pageBlocks[PAGE_KEY]) ? pageBlocks[PAGE_KEY] : [];

  const pricingIdx = blocks.findIndex((b) => b.type === "pricing-table");
  if (pricingIdx === -1) {
    console.error(`No pricing-table found in ${PAGE_KEY} page. Current block types: ${blocks.map((b) => b.type).join(", ")}`);
    process.exit(1);
  }

  if (blocks.some((b) => b.type === "chart")) {
    console.log("chart block already present on Pricing page — nothing to do.");
    process.exit(0);
  }

  const chartBlock = {
    id: crypto.randomUUID(),
    type: "chart",
    props: CHART_BLOCK_PROPS,
  };

  pageBlocks[PAGE_KEY] = [
    ...blocks.slice(0, pricingIdx + 1),
    chartBlock,
    ...blocks.slice(pricingIdx + 1),
  ];

  const { error: updateError } = await supabase
    .from(TABLE_NAME)
    .update({ site_data: { ...siteData, pageBlocks } })
    .eq("id", ROW_ID);

  if (updateError) throw updateError;

  console.log(`✓ Chart block inserted after pricing-table on ${PAGE_KEY} page (position ${pricingIdx + 1})`);
  console.log(`  New block order: ${pageBlocks[PAGE_KEY].map((b) => b.type).join(", ")}`);
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
