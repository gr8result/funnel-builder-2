/**
 * Recovery script: restores the Home page blocks from the debug snapshot
 * into the live published_websites row.
 *
 * Run: node scripts/recover-home-page.cjs
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Draft row ID (the one loaded in the builder editor; project_id = "draft:2208a52a-...")
const SITE_ID = "787be237-afa3-448e-88ba-674f79d71486";
const SNAPSHOT_PATH = path.join(__dirname, "..", "public", "tmp-project-debug.json");

async function main() {
  // 1. Load snapshot (data is nested under a UUID key)
  const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const snapshot = raw[Object.keys(raw)[0]] || raw;
  const homeBlocks = snapshot?.pageBlocks?.Home;
  if (!Array.isArray(homeBlocks) || homeBlocks.length === 0) {
    console.error("❌ Could not find pageBlocks.Home in snapshot.");
    process.exit(1);
  }
  console.log(`✅ Found ${homeBlocks.length} Home blocks in snapshot.`);

  // 2. Connect to Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 3. Fetch the current live row
  const { data: row, error: fetchError } = await supabase
    .from("published_websites")
    .select("id, site_data")
    .eq("id", SITE_ID)
    .maybeSingle();

  if (fetchError || !row) {
    console.error("❌ Failed to fetch site row:", fetchError?.message);
    process.exit(1);
  }
  console.log("✅ Fetched live site row.");

  const currentSiteData = row.site_data || {};

  // Safety check: warn if Home blocks already exist and are non-empty
  const existingHome = currentSiteData?.pageBlocks?.Home;
  if (Array.isArray(existingHome) && existingHome.length > 0) {
    console.warn(`⚠️  Live row already has ${existingHome.length} Home blocks. Overwriting with snapshot...`);
  }

  // 4. Merge recovered Home blocks into the existing site_data
  const newSiteData = {
    ...currentSiteData,
    pageBlocks: {
      ...(currentSiteData?.pageBlocks || {}),
      Home: homeBlocks,
    },
  };

  // 5. Write back
  const { error: updateError } = await supabase
    .from("published_websites")
    .update({ site_data: newSiteData, updated_at: new Date().toISOString() })
    .eq("id", SITE_ID);

  if (updateError) {
    console.error("❌ Failed to update site row:", updateError.message);
    process.exit(1);
  }

  console.log(`✅ SUCCESS — Home page restored with ${homeBlocks.length} blocks.`);
  console.log("   Open the website builder and switch to the Home page to verify.");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
