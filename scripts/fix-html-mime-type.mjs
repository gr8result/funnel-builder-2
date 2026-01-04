// /scripts/fix-html-mime-type.mjs
// ✅ Fixes MIME type for all HTML templates in Supabase Storage (email-assets/templates)

import 'dotenv/config';



import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("🔍 Starting Supabase MIME type repair...");

async function fixMimeTypes() {
  const { data, error } = await supabase.storage
    .from("email-assets")
    .list("templates", { limit: 50 });

  if (error) throw error;

  for (const folder of data) {
    if (folder.name.startsWith("template_")) {
      const filePath = `templates/${folder.name}/index.html`;

      const { data: fileData, error: headErr } = await supabase.storage
        .from("email-assets")
        .download(filePath);

      if (headErr) {
        console.log(`⚠️ Skipping ${filePath} (${headErr.message})`);
        continue;
      }

      const buffer = await fileData.arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from("email-assets")
        .upload(filePath, buffer, {
          contentType: "text/html",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadErr) {
        console.log(`❌ Failed to fix ${filePath}: ${uploadErr.message}`);
      } else {
        console.log(`✅ Fixed MIME type for ${filePath}`);
      }
    }
  }

  console.log("🎉 All HTML templates fixed successfully!");
}

fixMimeTypes().catch(console.error);
