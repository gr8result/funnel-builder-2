// /scripts/generate-template-thumbnails.mjs
// ✅ FINAL FULL VERSION (WORKS ON WINDOWS / POWERSHELL)
// ------------------------------------------------------
// 🧠 Purpose:
// Generates live PNG thumbnails for every email template
// stored in your Supabase `email_templates` table.
// Uploads them to the "email-thumbnails" bucket and updates
// each row’s `thumbnail_url` in Supabase.
//
// 🧩 Requirements:
// - Puppeteer installed: npm i puppeteer
// - .env.local file with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// - Bucket "email-thumbnails" in Supabase Storage
//
// 💡 Run with:
//    node scripts/generate-template-thumbnails.mjs
// ------------------------------------------------------

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// ✅ Force-load .env.local (same as Next.js)
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Loaded environment from:", envPath);
} else {
  console.error("❌ .env.local not found. Please ensure it's in the project root.");
  process.exit(1);
}

// ✅ Get Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials. Found:");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL);
  console.log("SUPABASE_SERVICE_ROLE_KEY:", SERVICE_ROLE_KEY ? "•••HIDDEN•••" : "undefined");
  process.exit(1);
}

console.log("🔑 Using Supabase URL:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const TMP_DIR = path.resolve("./tmp-thumbs");
fs.mkdirSync(TMP_DIR, { recursive: true });

// ------------------------------------------------------
// Step 1: Verify connection + load templates
// ------------------------------------------------------
console.log("\n🚀 Loading templates from Supabase...");

const { data: templates, error } = await supabase
  .from("email_templates")
  .select("id, name, html_content")
  .not("html_content", "is", null);

if (error) {
  console.error("❌ Failed to fetch templates:", error.message);
  process.exit(1);
}

if (!templates || !templates.length) {
  console.log("⚠️ No templates found in Supabase.");
  process.exit(0);
}

console.log(`📦 Found ${templates.length} templates to process.\n`);

// ------------------------------------------------------
// Step 2: Setup Puppeteer (headless browser)
// ------------------------------------------------------
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 800, height: 1000 });
page.setDefaultNavigationTimeout(120000); // 2-minute timeout

// ------------------------------------------------------
// Step 3: Loop through each template and create thumbnail
// ------------------------------------------------------
for (const tpl of templates) {
  const safeName = tpl.name.replace(/[^\w\d-]+/g, "_");
  const thumbFile = `${safeName}.png`;
  const thumbPath = path.join(TMP_DIR, thumbFile);
  const thumbPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/email-thumbnails/${thumbFile}`;

  try {
    console.log(`🎨 Rendering thumbnail for: ${tpl.name}`);

    // Render HTML content in Puppeteer
    await page.setContent(tpl.html_content, { waitUntil: "load" });
    await new Promise((res) => setTimeout(res, 2000)); // wait for assets

    // Screenshot full page
    await page.screenshot({ path: thumbPath, fullPage: true });

    // Upload to Supabase
    const buffer = fs.readFileSync(thumbPath);
    const { error: uploadError } = await supabase.storage
      .from("email-thumbnails")
      .upload(thumbFile, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Update database record
    const { error: dbError } = await supabase
      .from("email_templates")
      .update({ thumbnail_url: thumbPublicUrl })
      .eq("id", tpl.id);

    if (dbError) throw dbError;

    console.log(`✅ Saved thumbnail for "${tpl.name}" → ${thumbPublicUrl}`);
  } catch (err) {
    console.error(`❌ Error processing ${tpl.name}:`, err.message);
  }
}

// ------------------------------------------------------
// Step 4: Done
// ------------------------------------------------------
await browser.close();
console.log("\n🎉 All thumbnails generated successfully!");
