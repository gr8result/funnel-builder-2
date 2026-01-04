// /scripts/bulk-upload-templates.mjs
// ✅ Bulk upload HTML email templates and images to Supabase
// ✅ Auto-loads .env.local, skips duplicates, and generates thumbnails

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

// ✅ Always load correct .env.local even if run from anywhere
const envPath = path.resolve("C:\\Users\\grant\\dev\\funnel-builder\\.env.local");
dotenv.config({ path: envPath });

// ✅ Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables. Check .env.local at:", envPath);
  process.exit(1);
}

// ✅ Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ✅ Local import directory (corrected path)
const TEMPLATES_DIR = "C:\\Users\\grant\\dev\\funnel-builder\\pages\\modules\\email\\templates\\import";

// ✅ Supabase Storage and table details
const BUCKET_NAME = "email-assets";
const TABLE_NAME = "email_templates";

// ✅ Upload file to Supabase Storage
async function uploadToBucket(filePath, fileName, contentType) {
  try {
    const buffer = fs.readFileSync(filePath);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`templates/${fileName}`, buffer, { contentType, upsert: false });

    if (error && !error.message.includes("already exists")) {
      console.error(`❌ Failed to upload ${fileName}:`, error.message);
      return null;
    }

    console.log(`✅ Uploaded to bucket: ${fileName}`);
    return `templates/${fileName}`;
  } catch (err) {
    console.error(`❌ Upload error for ${fileName}:`, err.message);
    return null;
  }
}

// ✅ Generate a PNG thumbnail from HTML using Puppeteer
async function generateThumbnail(htmlContent, templateName) {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const tmpFile = path.join("./", `${templateName}.png`);
    await page.screenshot({ path: tmpFile, fullPage: true });
    await browser.close();
    console.log(`🖼️ Generated thumbnail for: ${templateName}`);
    return tmpFile;
  } catch (err) {
    console.error(`❌ Thumbnail generation failed for ${templateName}:`, err.message);
    return null;
  }
}

// ✅ Bulk upload templates
async function uploadTemplates() {
  console.log(`📂 Reading folder: ${TEMPLATES_DIR}`);

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error("❌ Directory not found:", TEMPLATES_DIR);
    return;
  }

  const allFiles = fs.readdirSync(TEMPLATES_DIR);
  const htmlFiles = allFiles.filter(f => f.endsWith(".html"));
  const imageFiles = allFiles.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

  console.log(`📄 Found ${htmlFiles.length} HTML templates`);
  console.log(`🖼️ Found ${imageFiles.length} image files\n`);

  // ✅ Upload image assets first
  for (const img of imageFiles) {
    const imgPath = path.join(TEMPLATES_DIR, img);
    await uploadToBucket(imgPath, img, "image/png");
  }

  // ✅ Process HTML templates
  for (const file of htmlFiles) {
    const filePath = path.join(TEMPLATES_DIR, file);
    const html = fs.readFileSync(filePath, "utf8");
    const templateName = path.basename(file, ".html");
    const subject = templateName.replace(/[_-]/g, " ");

    // Check duplicate
    const { data: existing } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("name", templateName)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️ Skipping duplicate: ${templateName}`);
      fs.appendFileSync("skipped.txt", `${templateName}\n`);
      continue;
    }

    // Upload HTML
    const fileKey = await uploadToBucket(filePath, file, "text/html");

    // Generate thumbnail
    const thumbPath = await generateThumbnail(html, templateName);
    const thumbKey = thumbPath
      ? await uploadToBucket(thumbPath, `${templateName}.png`, "image/png")
      : null;

    const { data: publicUrlData } = thumbKey
      ? supabase.storage.from(BUCKET_NAME).getPublicUrl(thumbKey)
      : { data: { publicUrl: null } };

    // Insert to DB
    const { error: insertError } = await supabase.from(TABLE_NAME).insert([
      {
        name: templateName,
        subject,
        html_content: html,
        thumbnail_url: publicUrlData.publicUrl,
        created_at: new Date(),
      },
    ]);

    if (insertError) {
      console.error(`❌ Failed to insert ${templateName}:`, insertError.message);
    } else {
      console.log(`✅ Added ${templateName} to ${TABLE_NAME}\n`);
    }

    if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  console.log("🎉 All templates processed successfully!");
}

// ✅ Execute the bulk upload
uploadTemplates().catch(err => {
  console.error("❌ Fatal error:", err);
});
