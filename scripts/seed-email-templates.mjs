// /scripts/seed_email_templates.mjs
// ---------------------------------------------------------
// Seeds default email templates for GR8 RESULT master user
// Used by clone_default_templates() to copy for new users
// ---------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Master (Waite and Sea) account ID
const MASTER_USER_ID = "3c921040-cd45-4a05-ba74-60db34591091";

// Seed templates directory
const TEMPLATE_DIR = "./public/templates/seed";

async function seedTemplates() {
  console.log("🚀 Seeding default email templates...");

  const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const name = path.basename(file, ".json");
    const filePath = path.join(TEMPLATE_DIR, file);
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const { error } = await supabase
      .from("email_templates")
      .upsert(
        {
          user_id: MASTER_USER_ID,
          name,
          thumbnail_url: `/templates/thumbnails/${name}.png`,
          html_content: json.html || "<!-- blank -->",
          design_json: json.design || {},
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,name" }
      );

    if (error) console.error(`❌ Error adding ${name}:`, error);
    else console.log(`✅ Added or updated: ${name}`);
  }

  console.log("✨ Seeding complete.");
}

seedTemplates();
