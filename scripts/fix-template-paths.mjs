// /scripts/fix-template-paths.mjs
// ✅ Fetches all index.html templates directly from Supabase storage
// ✅ Fixes broken image paths for email-assets/templates/template_X/index.html
// ✅ Works with your bucket: "email-assets"

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials. Check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = "email-assets";
const TEMPLATE_COUNT = 13; // Adjust if more templates exist
const PUBLIC_IMAGE_PATH = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/images/`;

(async () => {
  console.log("🚀 Starting Supabase HTML path fix...\n");

  for (let i = 1; i <= TEMPLATE_COUNT; i++) {
    const htmlPath = `templates/template_${i}/index.html`;

    // 1️⃣ Download the HTML file
    const { data, error } = await supabase.storage.from(BUCKET).download(htmlPath);
    if (error || !data) {
      console.error(`❌ Failed to download template_${i}:`, error?.message || "Unknown error");
      continue;
    }

    const html = await data.text();

    // 2️⃣ Fix relative image paths
    const fixedHTML = html
      .replace(/src="\.\/images\//g, `src="${PUBLIC_IMAGE_PATH}`)
      .replace(/src="images\//g, `src="${PUBLIC_IMAGE_PATH}`)
      .replace(/url\(['"]?\.\/images\//g, `url("${PUBLIC_IMAGE_PATH}`)
      .replace(/url\(['"]?images\//g, `url("${PUBLIC_IMAGE_PATH}`);

    // 3️⃣ Upload fixed HTML back to Supabase
    const blob = new Blob([fixedHTML], { type: "text/html" });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(htmlPath, blob, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Upload failed for template_${i}:`, uploadError.message);
    } else {
      console.log(`✅ Fixed & re-uploaded template_${i}`);
    }
  }

  console.log("\n🎉 All templates fixed successfully!");
})();
