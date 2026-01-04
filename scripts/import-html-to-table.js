// /scripts/import-html-to-table.js
// ✅ Imports local .html files into the `html` column of your Supabase email_templates table

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Initialise Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Path to your local HTML templates
const TEMPLATE_DIR = path.resolve("./templates");

(async () => {
  const files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".html"));
  console.log(`📦 Found ${files.length} HTML files to import into Supabase...`);

  for (const file of files) {
    const filePath = path.join(TEMPLATE_DIR, file);
    const htmlContent = fs.readFileSync(filePath, "utf8");
    const templateName = path.basename(file, ".html");

    console.log(`📤 Uploading ${templateName}...`);

    // Match template by name or insert new
    const { data: existing, error: selectError } = await supabase
      .from("email_templates")
      .select("id")
      .eq("name", templateName)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      console.error(`❌ Error checking ${templateName}:`, selectError.message);
      continue;
    }

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from("email_templates")
        .update({ html: htmlContent })
        .eq("id", existing.id);

      if (error) console.error(`❌ Failed to update ${templateName}:`, error.message);
      else console.log(`✅ Updated ${templateName}`);
    } else {
      // Insert new record
      const { error } = await supabase.from("email_templates").insert([
        {
          name: templateName,
          html: htmlContent,
          is_global: false,
        },
      ]);

      if (error) console.error(`❌ Failed to insert ${templateName}:`, error.message);
      else console.log(`✅ Inserted ${templateName}`);
    }
  }

  console.log("🎉 Import complete! All HTML templates are now in Supabase.");
})();
