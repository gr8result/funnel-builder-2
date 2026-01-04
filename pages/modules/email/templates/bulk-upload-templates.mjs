// C:\gr8_bulk_import\bulk-upload-templates.js
// ✅ Bulk import all .html files into Supabase email_templates table

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ✅ CONFIGURE YOUR SUPABASE DETAILS
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Folder path containing your .html templates
const folderPath = "C:\\email_templates\\imports"; // adjust if needed

async function uploadTemplates() {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".html"));

  console.log(`Found ${files.length} HTML templates to upload...\n`);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const html = fs.readFileSync(filePath, "utf8");

    const templateName = path.basename(file, ".html");
    const subject = templateName.replace(/[_-]/g, " ");

    const { error } = await supabase.from("email_templates").insert([
      {
        name: templateName,
        subject,
        html_content: html,
        created_at: new Date(),
      },
    ]);

    if (error) {
      console.error(`❌ Failed: ${file} —`, error.message);
    } else {
      console.log(`✅ Uploaded: ${file}`);
    }
  }

  console.log("\nAll templates processed.");
}

uploadTemplates();
