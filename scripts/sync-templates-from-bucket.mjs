// /scripts/sync-templates-from-bucket.mjs
// ✅ Syncs .html templates and thumbnails from Supabase Storage -> email_templates table

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "email-assets";
const TABLE = "email_templates";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials. Check your .env.local file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncTemplates() {
  console.log("🔄 Starting sync from bucket:", BUCKET);

  // 1️⃣ Get file list from bucket root
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });

  if (listError) {
    console.error("❌ Error listing bucket:", listError.message);
    process.exit(1);
  }

  // Filter only .html templates
  const htmlFiles = files.filter((f) => f.name.endsWith(".html"));
  console.log(`📦 Found ${htmlFiles.length} .html files in bucket.`);

  for (const file of htmlFiles) {
    const name = file.name.replace(".html", "");
    const htmlUrl = `${SUPABASE_URL.replace(
      ".co",
      ".co/storage/v1/object/public"
    )}/${BUCKET}/${file.name}`;
    const thumbnailUrl = `${SUPABASE_URL.replace(
      ".co",
      ".co/storage/v1/object/public"
    )}/${BUCKET}/${name}.png`;

    // 2️⃣ Check if it exists already
    const { data: existing, error: fetchError } = await supabase
      .from(TABLE)
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (fetchError) {
      console.error(`⚠️ Error checking ${name}:`, fetchError.message);
      continue;
    }

    // 3️⃣ Insert or update
    if (!existing) {
      console.log(`🆕 Inserting new template: ${name}`);
      const { error: insertError } = await supabase.from(TABLE).insert([
        {
          name,
          subject: `${name.charAt(0).toUpperCase() + name.slice(1)} Email`,
          html_content: htmlUrl,
          thumbnail_url: thumbnailUrl,
          category: "Synced",
        },
      ]);
      if (insertError)
        console.error(`❌ Insert failed for ${name}:`, insertError.message);
      else console.log(`✅ Inserted ${name}`);
    } else {
      console.log(`♻️ Updating existing template: ${name}`);
      const { error: updateError } = await supabase
        .from(TABLE)
        .update({
          html_content: htmlUrl,
          thumbnail_url: thumbnailUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError)
        console.error(`⚠️ Update failed for ${name}:`, updateError.message);
      else console.log(`✅ Updated ${name}`);
    }
  }

  console.log("🎉 Sync complete!");
}

// Run the sync
syncTemplates().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
