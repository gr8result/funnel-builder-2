/**
 * Removes rows from social_image_library where owner_scope = 'generic' and the
 * image URL no longer returns a 200 response (dead/broken images).
 *
 * Run with: node scripts/cleanup-dead-generic-images.cjs
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(6000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Fetching generic entries from social_image_library...");
  const { data: rows, error } = await supabase
    .from("social_image_library")
    .select("id, url, storage_path, description")
    .or("owner_scope.eq.generic,storage_path.like.assets:generic/%")
    .order("created_at", { ascending: true });

  if (error) { console.error(error); process.exit(1); }
  console.log(`Found ${rows.length} generic entries. Checking URLs...\n`);

  const deadIds = [];
  for (const row of rows) {
    const url = String(row.url || "").trim();
    if (!url) { deadIds.push(row.id); console.log(`  DEAD (no url) id=${row.id}`); continue; }
    const alive = await checkUrl(url);
    if (!alive) {
      deadIds.push(row.id);
      console.log(`  DEAD  ${url.slice(0, 90)}`);
    } else {
      process.stdout.write(".");
    }
  }
  console.log(`\n\nDead: ${deadIds.length} / ${rows.length}`);

  if (deadIds.length === 0) { console.log("Nothing to delete."); return; }

  const BATCH = 50;
  let deleted = 0;
  for (let i = 0; i < deadIds.length; i += BATCH) {
    const batch = deadIds.slice(i, i + BATCH);
    const { error: delErr } = await supabase.from("social_image_library").delete().in("id", batch);
    if (delErr) console.error("Delete error:", delErr.message);
    else deleted += batch.length;
  }
  console.log(`Deleted ${deleted} dead rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
