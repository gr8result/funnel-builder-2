import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export async function listUserTemplates(userId) {
  const folder = `user-templates/${userId}`;
  const { data, error } = await supabase.storage
    .from("email-user-assets")
    .list(folder, { sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  return data.filter((f) => f.name.endsWith(".html"));
}

export async function loadTemplate(userId, filename) {
  const path = `user-templates/${userId}/${filename}`;
  const { data, error } = await supabase.storage
    .from("email-user-assets")
    .download(path);
  if (error) throw error;
  return await data.text();
}

export async function saveTemplate(userId, filename, content) {
  const path = `user-templates/${userId}/${filename}`;
  // remove then upload to allow overwrite
  await supabase.storage.from("email-user-assets").remove([path]);
  const blob = new Blob([content], { type: "text/html" });
  const { error } = await supabase.storage
    .from("email-user-assets")
    .upload(path, blob, { upsert: true });
  if (error) throw error;
  return true;
}
