// /scripts/reupload-html.mjs
// ✅ Ensures all email templates are served as text/html (not plain text)
// ✅ Fixes "raw code" display problem when viewing or screenshotting in Puppeteer

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = "email-assets";
const TEMPLATE_COUNT = 13;

(async () => {
  console.log("🚀 Reuploading templates with correct MIME type...\n");

  for (let i = 1; i <= TEMPLATE_COUNT; i++) {
    const path = `templates/template_${i}/index.html`;

    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) {
      console.error(`❌ Failed to download template_${i}:`, error?.message);
      continue;
    }

    const content = await data.text();
    const blob = new Blob([content], { type: "text/html" });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Reupload failed for template_${i}: ${uploadError.message}`);
    } else {
      console.log(`✅ Fixed MIME type for template_${i}`);
    }
  }

  console.log("\n🎉 All HTML files reuploaded correctly!");
})();

