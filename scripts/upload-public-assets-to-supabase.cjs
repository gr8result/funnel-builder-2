/**
 * Uploads all image files from public/assets/ into Supabase storage
 * at the assets bucket under the generic/ prefix so they appear
 * in the Generic Images section of the media library.
 *
 * Run with: node scripts/upload-public-assets-to-supabase.cjs
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "assets";
const SUPABASE_PREFIX = "generic";
const LOCAL_DIR = path.join(__dirname, "..", "public", "assets");

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function isImage(filename) {
  return Object.keys(MIME).some((ext) => filename.toLowerCase().endsWith(ext));
}

function safeName(name) {
  // keep extension, replace unsafe chars in base name
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") + ext;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const allFiles = fs.readdirSync(LOCAL_DIR).filter((f) => {
    const stat = fs.statSync(path.join(LOCAL_DIR, f));
    return stat.isFile() && isImage(f);
  });

  if (allFiles.length === 0) {
    console.log("No image files found in", LOCAL_DIR);
    return;
  }

  console.log(`Found ${allFiles.length} images — uploading to ${BUCKET}/${SUPABASE_PREFIX}/...\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of allFiles) {
    const localPath = path.join(LOCAL_DIR, filename);
    const objectName = safeName(filename);
    const objectPath = `${SUPABASE_PREFIX}/${objectName}`;
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    const fileBuffer = fs.readFileSync(localPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`  FAILED  ${objectName}: ${error.message}`);
      failed++;
    } else {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      console.log(`  OK  ${objectName}`);
      uploaded++;
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}  Failed: ${failed}  Skipped: ${skipped}`);
  if (uploaded > 0) {
    console.log(`\nImages are now visible in the media library under Generic Images.`);
    console.log(`They will appear at: /assets?view=generic`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
