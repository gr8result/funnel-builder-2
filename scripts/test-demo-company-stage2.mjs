import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

const migration = fs.readFileSync("supabase/migrations/20260817000200_demo_company_stage2_seed.sql", "utf8");
assert.match(migration, /reset_demo_company_stage2/);
assert.match(migration, /where id = demo_workspace\s+and is_demo = true/i);
assert.match(migration, /delete from public\.builder_commercial_projects where workspace_id = demo_workspace/i);
assert.match(migration, /delete from public\.leads where workspace_id = demo_workspace/i);
assert.match(migration, /'00000000-0000-4000-8000-000000000001'/);
assert.match(migration, /example\.com/);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing Supabase URL or service-role key for live Stage 2 verification.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function count(table, filters = {}) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count: value, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return value || 0;
}

async function select(table, columns, filters = {}) {
  let query = supabase.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query;
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data || [];
}

const { data: resetResult, error: resetError } = await supabase.rpc("reset_demo_company_stage2");
if (resetError) throw new Error(`reset_demo_company_stage2 failed: ${resetError.message}`);

assert.equal(resetResult?.ok, true);
assert.equal(resetResult?.workspace_id, DEMO_WORKSPACE_ID);
assert.equal(resetResult?.enquiries, 10);
assert.equal(resetResult?.projects, 20);

const { data: workspace, error: workspaceError } = await supabase
  .from("workspaces")
  .select("id, slug, name, is_demo")
  .eq("id", DEMO_WORKSPACE_ID)
  .maybeSingle();
if (workspaceError) throw workspaceError;

assert.equal(workspace?.is_demo, true);
assert.equal(workspace?.slug, "gr8-result-demo");
assert.equal(workspace?.name, "Gr8 Result Demo Company");

assert.equal(await count("leads", { workspace_id: DEMO_WORKSPACE_ID }), 10);
assert.equal(await count("builder_commercial_projects", { workspace_id: DEMO_WORKSPACE_ID }), 20);
assert.equal(await count("builder_estimate_snapshots", { workspace_id: DEMO_WORKSPACE_ID }), 20);
assert.equal(await count("builder_selection_sessions", { workspace_id: DEMO_WORKSPACE_ID }), 10);
assert.equal(await count("builder_client_selections", { workspace_id: DEMO_WORKSPACE_ID }), 10);
assert.equal(await count("builder_variations", { workspace_id: DEMO_WORKSPACE_ID }), 2);
assert.equal(await count("builder_procurement_items", { workspace_id: DEMO_WORKSPACE_ID }), 3);
assert.equal(await count("builder_rfis", { workspace_id: DEMO_WORKSPACE_ID }), 1);
assert.equal(await count("builder_project_documents", { workspace_id: DEMO_WORKSPACE_ID }), 20);

const leads = await select("leads", "email, phone, lead_status, stage, lead_source", { workspace_id: DEMO_WORKSPACE_ID });
assert.equal(leads.length, 10);
for (const lead of leads) {
  assert.match(lead.email || "", /@example\.com$/);
  assert.ok(["new", "assigned", "contacted", "quoted"].includes(lead.lead_status));
  assert.ok(lead.stage);
  assert.ok(lead.lead_source);
}

const projects = await select("builder_commercial_projects", "client_email, status, source_metadata", {
  workspace_id: DEMO_WORKSPACE_ID,
});
assert.equal(projects.length, 20);
for (const project of projects) {
  assert.match(project.client_email || "", /@example\.com$/);
  assert.equal(project.status, "active");
  assert.equal(project.source_metadata?.demo, true);
  assert.ok(project.source_metadata?.lifecycle_stage);
}

const nonDemoSamples = await select("workspaces", "id, is_demo", {});
for (const row of nonDemoSamples.filter((item) => item.id !== DEMO_WORKSPACE_ID)) {
  assert.equal(row.is_demo, false, `non-demo workspace ${row.id} should not be marked demo`);
}

console.log("test-demo-company-stage2.mjs passed");
