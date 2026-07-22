/**
 * One-off admin script: uploads the approved Premier Inclusions Schedule.pptx
 * as the protected Standard Inclusions master template. Never call this from
 * a tenant-facing API route — it is the only writer of the master asset path.
 *
 * Run with: node scripts/upload-standard-inclusions-master.mjs path/to/Premier-Inclusions-Schedule.pptx
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const STANDARD_INCLUSIONS_BUCKET = "assets";
const STANDARD_INCLUSIONS_MASTER_PATH = "standard-inclusions/_master/premier-inclusions-schedule.pptx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath || !/\.pptx$/i.test(filePath)) {
  console.error("Usage: node scripts/upload-standard-inclusions-master.mjs path/to/file.pptx");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function main() {
  const absolutePath = path.resolve(filePath);
  const body = await readFile(absolutePath);
  console.log(`Uploading ${absolutePath} (${body.length} bytes) to ${STANDARD_INCLUSIONS_BUCKET}/${STANDARD_INCLUSIONS_MASTER_PATH}...`);

  const { error } = await supabase.storage.from(STANDARD_INCLUSIONS_BUCKET).upload(STANDARD_INCLUSIONS_MASTER_PATH, body, {
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    upsert: true,
  });
  if (error) {
    console.error("Upload failed:", error.message || error);
    process.exit(1);
  }

  console.log("Standard Inclusions master template uploaded successfully.");
  console.log("Existing tenant copies are unaffected — only new 'first open' clones will pick up this version.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
