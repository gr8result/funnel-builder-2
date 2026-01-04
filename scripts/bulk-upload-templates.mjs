// /scripts/bulk-upload-templates.mjs
// ✅ Guaranteed environment loading + clean Supabase key handling

import "dotenv/config"; // <== This auto-loads .env/.env.local at runtime
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// ✅ Explicitly verify environment variables
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables missing!");
  console.error("SUPABASE_URL =", SUPABASE_URL);
  console.error("SUPABASE_SERVICE_ROLE_KEY =", SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

console.log("✅ Environment loaded OK");
console.log("Using project:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ✅ Define paths
const TEMPLATES_DIR = path.resolve(
  "C:/Users/grant/dev/funnel-builder/pages/modules/email/templates/import"
);
const BUCKET_NAME = "email-assets";
const TABLE_NAME = "email_templates";

// ✅ Upload file to Supabase
async function uploadToBucket(filePath, fileName, contentType) {
  try {
    const buffer = fs.readFileSync(filePath);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`templates/${fileName}`, buffer, { contentType, upsert: false });

    if (error && !error.message.includes("exists")) {
      console.error(`❌ Upload failed ${fileName}:`, error.message);
      return null;
    }

    console.log(`✅ Uploaded: ${fileName}`);
    return `templates/${fileName}`;
  } catch (err) {
    console.error(`❌ Upload error for ${fileName}:`, err.message);
    return null;
  }
}

// ✅ Generate thumbnail from HTML
async function generateThumbnail(html, name) {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const tmp = path.join("./", `${name}.png`);
    await page.screenshot({ path: tmp, fullPage: true });
    await browser.close();
    console.log(`🖼️ Thumbnail created for ${name}`);
    return tmp;
  } catch (err) {
    console.error(`❌ Thumbnail failed for ${name}:`, err.message);
    return null;
  }
}

// ✅ Bulk upload
async function uploadTemplates() {
  console.log(`📂 Reading: ${TEMPLATES_DIR}`);
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error("❌ Directory missing:", TEMPLATES_DIR);
    return;
  }

  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".html"));
  console.log(`📄 Found ${files.length} templates\n`);

  for (const f of files) {
    const filePath = path.join(TEMPLATES_DIR, f);
    const html = fs.readFileSync(filePath, "utf8");
    const name = path.basename(f, ".html");
    const subject = name.replace(/[_-]/g, " ");

    const { data: existing } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️ Skipping duplicate: ${name}`);
      continue;
    }

    const fileKey = await uploadToBucket(filePath, f, "text/html");
    const thumbPath = await generateThumbnail(html, name);
    const thumbKey =
      thumbPath && (await uploadToBucket(thumbPath, `${name}.png`, "image/png"));

    const { data: publicUrlData } = thumbKey
      ? supabase.storage.from(BUCKET_NAME).getPublicUrl(thumbKey)
      : { data: { publicUrl: null } };

    const { error: insertError } = await supabase.from(TABLE_NAME).insert([
      {
        name,
        subject,
        html_content: html,
        thumbnail_url: publicUrlData.publicUrl,
        created_at: new Date(),
      },
    ]);

    if (insertError) {
      console.error(`❌ Insert failed for ${name}:`, insertError.message);
    } else {
      console.log(`✅ Added ${name} to ${TABLE_NAME}`);
    }

    if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  console.log("🎉 Upload finished!");
}

uploadTemplates().catch(e => console.error("❌ Fatal error:", e));
