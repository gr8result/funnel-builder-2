import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function renameFiles() {
  console.log("🔄 Checking for email.html files to rename...");

  const { data: folders, error } = await supabase.storage
    .from("email-assets")
    .list("templates", { limit: 100, offset: 0 });

  if (error) {
    console.error("❌ Error listing folders:", error.message);
    return;
  }

  for (const folder of folders) {
    if (!folder.name.startsWith("template_")) continue;

    const oldPath = `templates/${folder.name}/email.html`;
    const newPath = `templates/${folder.name}/index.html`;

    console.log(`➡️ Renaming ${oldPath} → ${newPath}`);

    // Download existing file
    const { data, error: downloadError } = await supabase.storage
      .from("email-assets")
      .download(oldPath);

    if (downloadError) {
      console.warn(`⚠️ Skipping ${folder.name}: ${downloadError.message}`);
      continue;
    }

    // Upload to new name
    const { error: uploadError } = await supabase.storage
      .from("email-assets")
      .upload(newPath, data, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Failed to upload ${newPath}:`, uploadError.message);
      continue;
    }

    // Delete old file
    const { error: deleteError } = await supabase.storage
      .from("email-assets")
      .remove([oldPath]);

    if (deleteError) {
      console.warn(`⚠️ Could not delete old file ${oldPath}`);
    } else {
      console.log(`✅ ${folder.name} renamed successfully!`);
    }
  }

  console.log("🎉 All templates renamed!");
}

renameFiles();
