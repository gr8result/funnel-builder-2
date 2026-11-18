// Isolated PostgreSQL (PGlite, in memory) checks for the merged Quotation V1 migration set
// (12-13 Nov 2026). The tree and the V1 release package had diverged; the merged set takes the
// release package's security hardening and the tree's constraint-name fix:
//   1. a second product can be mapped in the same room (the old unique rule is really dropped);
//      the same product twice is still refused;
//   2. anon cannot execute the membership helper functions;
//   3. supplier / manufacturer rows without an owner stay hidden (the 3 Oct tenant foundation: commercial
//      data always has an owner); the internal-member migration does not loosen that;
//   4. client-role members cannot read requirement mappings; internal staff can.
// Run: node scripts/test-quotation-v1-migrations.mjs [migrationsDir]   (default supabase/migrations)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const DIR = process.argv[2] || process.env.QB_MIGRATIONS_DIR || "supabase/migrations";
const MIGRATIONS = [
  "20260813091500_estimate_builder_commercial_backbone_stage1.sql",
  "20260813091600_builder_inclusion_templates.sql",
  "20260813091800_builder_selection_books.sql",
  "20260813092100_builder_product_library.sql",
  "20260813092400_seed_gr8_standard_specifications.sql",
  "20260813093000_selection_budget_manager.sql",
  "20261003000100_builder_selection_tenant_foundation.sql",
  "20261010000100_builder_requirement_quote_mappings.sql",
  "20261011000100_requirement_mapping_product_identity.sql",
  "20261021000100_builder_commercial_internal_member_rls.sql",
  "20261028000100_workspace_members_rls_recursion_fix.sql",
];
const A = "11111111-1111-4111-8111-111111111111";
const ESTIMATOR = "00000001-0000-4000-8000-000000000000";
const CLIENT = "00000002-0000-4000-8000-000000000000";

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text);
  create table public.workspace_entitlements (workspace_id uuid, entitlement text);
  create table public.communities (workspace_id uuid, name text);
  alter table public.workspaces enable row level security;
  alter table public.workspace_members enable row level security;
  alter table public.workspace_entitlements enable row level security;
  alter table public.communities enable row level security;
  insert into workspaces values ('${A}','Builder A');
  grant usage on schema public,auth to authenticated, anon;
  grant select on workspaces,workspace_members to authenticated;
  insert into auth.users values ('${ESTIMATOR}'),('${CLIENT}');
  insert into workspace_members values ('${A}','${ESTIMATOR}','estimator','active'),('${A}','${CLIENT}','client','active');`);
for (const file of MIGRATIONS) {
  const sql = (await fs.readFile(`${DIR}/${file}`, "utf8")).replace(/create extension if not exists pgcrypto;/gi, "");
  try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
}
await db.exec("grant select,insert,update,delete on all tables in schema public to authenticated");

const results = [];
const check = async (name, run) => {
  try { await run(); results.push(["PASS", name]); console.log("PASS", name); }
  catch (error) { results.push(["FAIL", name]); console.log("FAIL", name, "-", error.message.slice(0, 200)); }
};
const as = async (user, run) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try { return await run(); } finally { await db.exec("reset role"); }
};
const mapping = (product) => db.query(`insert into public.builder_requirement_quote_mappings (workspace_id, template_id, requirement_key, location_id, product_id, quote_section_id, quote_row_id)
  values ($1, 't1', 'pendant-light', 'kitchen', $2, 'ELECTRICAL', 'quote-1')`, [A, product]);

await check("a second product can be mapped in the same room; the same product twice is refused", async () => {
  const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='builder_requirement_quote_mappings' and is_nullable='NO' and column_default is null`)).rows.map((r) => r.column_name);
  const known = new Set(["workspace_id", "template_id", "requirement_key", "location_id", "product_id", "quote_section_id", "quote_row_id"]);
  assert.deepEqual(cols.filter((c) => !known.has(c)), [], "unexpected required columns");
  await mapping("product-a");
  await mapping("product-b");
  let refused = false;
  try { await mapping("product-a"); } catch { refused = true; }
  assert.equal(refused, true, "same product twice must be refused");
});

await check("anon cannot execute the membership helper functions", async () => {
  for (const fn of ["builder_commercial_is_internal_member", "is_workspace_member"]) {
    const exists = (await db.query("select count(*)::int c from pg_proc where proname=$1", [fn])).rows[0].c;
    if (!exists) continue;
    let denied = false;
    try { await as(null, () => db.query(`select public.${fn}($1)`, [A])); } catch (error) { denied = /permission denied/i.test(error.message); }
    assert.equal(denied, true, `${fn} executable by anon`);
  }
});

await check("supplier and manufacturer rows without an owner stay hidden (tenant foundation not loosened)", async () => {
  for (const table of ["builder_product_suppliers", "builder_product_manufacturers"]) {
    if (!(await db.query("select to_regclass($1) r", [`public.${table}`])).rows[0].r) continue;
    const nullable = (await db.query(`select is_nullable from information_schema.columns where table_schema='public' and table_name=$1 and column_name='workspace_id'`, [table])).rows[0]?.is_nullable === "YES";
    if (!nullable) continue;
    const required = (await db.query(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null`, [table])).rows;
    const names = required.map((c) => c.column_name);
    const values = required.map((c) => (/int|numeric/.test(c.data_type) ? 1 : /bool/.test(c.data_type) ? false : /json/.test(c.data_type) ? "{}" : `global-${c.column_name}`));
    await db.query(`insert into public.${table}(${names.map((x) => `"${x}"`).join(",")}) values (${names.map((_, i) => `$${i + 1}`).join(",")})`, values);
    const seen = await as(ESTIMATOR, async () => (await db.query(`select count(*)::int c from public.${table} where workspace_id is null`)).rows[0].c);
    assert.equal(seen, 0, `${table}: a row without an owner is readable`);
  }
});

await check("client-role members cannot read requirement mappings; internal staff can", async () => {
  const client = await as(CLIENT, async () => (await db.query("select count(*)::int c from public.builder_requirement_quote_mappings")).rows[0].c);
  const staff = await as(ESTIMATOR, async () => (await db.query("select count(*)::int c from public.builder_requirement_quote_mappings")).rows[0].c);
  assert.equal(client, 0, "client read mappings");
  assert.ok(staff > 0, "estimator cannot read mappings");
});

// Rollback rehearsal (release package): the internal-member policies and helper are removed and
// the mapping read policy goes back to its 20261010000100 definition. Run last: it changes the db.
await check("rollback_20261021000100.sql removes the internal-member policies and restores the mapping read policy", async () => {
  const path = "supabase/release/quotation-v1/rollback_20261021000100.sql";
  const sql = (await fs.readFile(path, "utf8")).replace(/delete from supabase_migrations\.schema_migrations[^;]*;/i, "");
  await db.exec(sql);
  const left = (await db.query("select count(*)::int c from pg_policies where schemaname='public' and policyname='internal_workspace_members_only'")).rows[0].c;
  assert.equal(left, 0, "internal-member policies left behind");
  const fn = (await db.query("select count(*)::int c from pg_proc where proname='builder_commercial_is_internal_member'")).rows[0].c;
  assert.equal(fn, 0, "helper function left behind");
  const read = (await db.query("select qual from pg_policies where tablename='builder_requirement_quote_mappings' and policyname='tenant_read'")).rows[0]?.qual || "";
  assert.match(read, /builder_selection_is_config_admin/);
});

const failed = results.filter(([r]) => r === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} checks passed (${DIR}); isolated in-memory database, not live Supabase.`);
process.exit(failed ? 1 : 0);
