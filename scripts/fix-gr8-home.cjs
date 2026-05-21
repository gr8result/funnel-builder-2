/**
 * Fix Gr8 Result Digital Solutions – Home page:
 *   1. Remove 3 duplicate footers + 1 spacer from the bottom
 *   2. Set services grid to style-02 (shows background images + large icons)
 *
 * Run ONLY when the user has the builder tab closed (so autosave cannot overwrite).
 * Usage: node scripts/fix-gr8-home.cjs
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROW_ID = "b3a3567c-d418-4f33-874e-cb4e2504913b";
const PROJECT_ID = "draft:2208a52a-8175-477e-823c-fc6de7fe4afe";

// Block IDs to DELETE from the Home page
const BLOCKS_TO_DELETE = new Set([
  1778381470902, // duplicate footer 1
  1778381490363, // duplicate footer 2
  1778381501090, // duplicate footer 3
  1778626142012, // spacer / space block at bottom
]);

// Services grid block to UPDATE
const SERVICES_GRID_ID = 1778894829892;

async function main() {
  console.log("Fetching row from published_websites…");
  const { data: row, error: fetchErr } = await supabase
    .from("published_websites")
    .select("id, project_id, site_data")
    .eq("id", ROW_ID)
    .single();

  if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);
  if (!row) throw new Error("Row not found");

  const siteData = row.site_data;
  const pageBlocks = siteData.pageBlocks || {};
  const blocks = pageBlocks["Home"];

  if (!Array.isArray(blocks)) throw new Error("pageBlocks.Home not found or not an array");

  console.log(`Home page has ${blocks.length} blocks before edits`);

  // Print the ids of blocks being removed
  const toRemove = blocks.filter((b) => BLOCKS_TO_DELETE.has(Number(b.id)));
  console.log(
    "Removing blocks:",
    toRemove.map((b) => `${b.id} (${b.type || b.blockType || "?"})`)
  );

  // Filter out deleted blocks
  const remaining = blocks.filter((b) => !BLOCKS_TO_DELETE.has(Number(b.id)));

  // Update services grid
  const gridIdx = remaining.findIndex((b) => Number(b.id) === SERVICES_GRID_ID);
  if (gridIdx === -1) {
    console.warn(`WARNING: Services grid block ${SERVICES_GRID_ID} not found — skipping style update`);
  } else {
    const grid = remaining[gridIdx];
    const updatedProps = {
      ...(grid.props || {}),
      servicesStylePreset: "style-02",
      iconSize: 44,
      iconBadgeWidth: 80,
      iconBadgeHeight: 96,
    };
    remaining[gridIdx] = { ...grid, props: updatedProps };
    console.log(`Updated services grid (id ${SERVICES_GRID_ID}) to style-02`);
  }

  console.log(`Home page will have ${remaining.length} blocks after edits`);

  // Build updated siteData — also clear the global footer block
  const updatedSiteData = {
    ...siteData,
    globalFooterBlock: null,
    pageBlocks: {
      ...pageBlocks,
      Home: remaining,
    },
  };

  // Write back to Supabase
  const { error: updateErr } = await supabase
    .from("published_websites")
    .update({ site_data: updatedSiteData, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID);

  if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

  console.log("✅ Done! DB updated successfully.");
  console.log(
    "\nNEXT STEP: Tell the user to run this in their browser console, then reload:"
  );
  console.log(
    `  localStorage.removeItem('gr8:website-projects:v1')`
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
