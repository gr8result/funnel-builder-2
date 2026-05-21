#!/usr/bin/env node
// One-time script: add "Modules" page to the user's website builder project
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const PAGE_NAME = "Modules";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

(async () => {
  // Get all projects for this user
  const { data: rows, error } = await supabase
    .from("published_websites")
    .select("id, project_id, name, site_data, updated_at")
    .eq("user_id", USER_ID)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) { console.log("No projects found"); return; }

  console.log(`Found ${rows.length} project row(s):`);
  rows.forEach(r => console.log(`  id=${r.id}  project_id=${r.project_id}  name=${r.name}  updated=${r.updated_at}`));

  // Use the most recently updated project
  const row = rows[0];
  const siteData = row.site_data || {};
  const pages = Array.isArray(siteData.pages) ? siteData.pages : [];
  const pageBlocks = siteData.pageBlocks || {};

  const pageSlug = slugify(PAGE_NAME);
  if (pages.some(p => slugify(p.name) === pageSlug)) {
    console.log(`Page "${PAGE_NAME}" already exists — nothing to do.`);
    return;
  }

  const nextPages = [...pages, { name: PAGE_NAME, objective: `Build the ${PAGE_NAME} page.` }];
  const nextPageBlocks = { ...pageBlocks, [PAGE_NAME]: [] };

  const nextSiteData = { ...siteData, pages: nextPages, pageBlocks: nextPageBlocks };

  const { error: saveError } = await supabase
    .from("published_websites")
    .update({ site_data: nextSiteData, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  if (saveError) throw saveError;

  console.log(`✓ Added "${PAGE_NAME}" page to project "${row.name}" (id=${row.id})`);
  console.log(`  Total pages now: ${nextPages.length} — [${nextPages.map(p => p.name).join(", ")}]`);
})().catch(err => { console.error(err); process.exit(1); });
