/**
 * Migration: add visitor-tracking columns to website_page_views
 * Run once: node scripts/migrate-visit-tracking.cjs
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  // Use supabase rpc or direct REST to run DDL.
  // We use the PostgREST SQL endpoint available via service role.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sql = `
    ALTER TABLE website_page_views
      ADD COLUMN IF NOT EXISTS ip_address   text,
      ADD COLUMN IF NOT EXISTS user_agent   text,
      ADD COLUMN IF NOT EXISTS page_path    text,
      ADD COLUMN IF NOT EXISTS visitor_id   text,
      ADD COLUMN IF NOT EXISTS referrer     text;

    CREATE INDEX IF NOT EXISTS idx_wpv_visitor
      ON website_page_views(project_id, visitor_id);

    CREATE INDEX IF NOT EXISTS idx_wpv_created
      ON website_page_views(project_id, created_at DESC);
  `;

  // Supabase exposes a /rest/v1/rpc endpoint but raw SQL requires the management API
  // or a helper function. We use the Supabase Management API if available, otherwise
  // attempt via the pg REST endpoint.
  const mgmtUrl = `https://api.supabase.com/v1/projects/${extractRef(base)}/database/query`;

  // Try Management API first (requires SUPABASE_ACCESS_TOKEN env var)
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) {
    const resp = await fetch(mgmtUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const body = await resp.text();
    if (resp.ok) {
      console.log("✅ Migration applied via Management API");
      return;
    }
    console.warn("Management API failed:", body);
  }

  // Fallback: try via supabase-js rpc exec_sql (only works if function exists)
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (!error) {
    console.log("✅ Migration applied via exec_sql RPC");
    return;
  }

  // Final fallback: print the SQL for manual application
  console.log("⚠️  Could not apply migration automatically.");
  console.log("Run the following SQL in your Supabase SQL Editor:");
  console.log("─".repeat(60));
  console.log(sql.trim());
  console.log("─".repeat(60));
}

function extractRef(url) {
  // https://abcdefgh.supabase.co → abcdefgh
  return (url.match(/https?:\/\/([^.]+)\.supabase\.co/) || [])[1] || "";
}

run().catch((err) => { console.error(err); process.exit(1); });
