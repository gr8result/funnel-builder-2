// ===============================
// /scripts/sync-local-to-supabase.mjs
// ✅ Syncs all HTML templates from local /public/email-templates
//    into Supabase table "email_templates"
// ===============================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { createClient } from "@supabase/supabase-js";

// ===============================
// 🧩 Setup
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(chalk.cyanBright("\n🚀 Starting sync-local-to-supabase.mjs...\n"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(chalk.red("❌ Missing Supabase credentials in .env.local"));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const templatesDir = path.join(__dirname, "../public/email-templates");

// ===============================
// 🧠 Utility Functions
// ===============================
async function uploadTemplateToSupabase(name, htmlContent) {
  try {
    const { data: existing, error: findError } = await supabase
      .from("email_templates")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (findError) throw findError;

    const payload = {
      name,
      html_content: htmlContent,
      is_global: true,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("email_templates")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) throw updateError;
      console.log(chalk.green(`✅ Updated template: ${name}`));
    } else {
      const { error: insertError } = await supabase
        .from("email_templates")
        .insert(payload);

      if (insertError) throw insertError;
      console.log(chalk.green(`✅ Inserted template: ${name}`));
    }
  } catch (err) {
    console.error(chalk.red(`❌ Failed to upload ${name}:`), err.message);
  }
}

// ===============================
// ⚙️ Main Execution
// ===============================
(async () => {
  try {
    if (!fs.existsSync(templatesDir)) {
      console.error(chalk.red(`❌ Folder not found: ${templatesDir}`));
      process.exit(1);
    }

    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith(".html"));
    if (files.length === 0) {
      console.warn(chalk.yellow("⚠️ No .html templates found in public/email-templates"));
      process.exit(0);
    }

    console.log(chalk.cyan(`🧩 Found ${files.length} template(s):`));
    files.forEach(f => console.log("   • " + f));

    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const htmlContent = fs.readFileSync(filePath, "utf8");
      const templateName = path.basename(file, ".html");
      await uploadTemplateToSupabase(templateName, htmlContent);
    }

    console.log(chalk.greenBright("\n🎉 All templates synced successfully!\n"));
    process.exit(0);
  } catch (err) {
    console.error(chalk.red("\n❌ Unhandled Error:"), err);
    process.exit(1);
  }
})();
