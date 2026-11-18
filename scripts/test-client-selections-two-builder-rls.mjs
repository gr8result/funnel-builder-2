// Two-builder tenant isolation for the tables Client Selections reads and writes (15 Nov 2026).
// Isolated PostgreSQL (PGlite, in memory) built from the real migration files - nothing touches
// Supabase. Two builders (A, B) each own a linked project -> snapshot -> session -> client selections
// -> selection book -> variation. Three signed-in users act through RLS as `authenticated`:
//   ownerA (owner of A only), ownerB (owner of B only), clientA (client-role member of A).
// Expected: each owner reads and changes only their own workspace; neither can read, update, delete
// or insert into the other's; a client-role member has no direct access to internal records.
//   node scripts/test-client-selections-two-builder-rls.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const DIR = process.env.QB_MIGRATIONS_DIR || 'supabase/migrations';
const MIGRATIONS = [
  '20260813091500_estimate_builder_commercial_backbone_stage1.sql',
  '20260813091600_builder_inclusion_templates.sql',
  '20260813091800_builder_selection_books.sql',
  '20260813092100_builder_product_library.sql',
  '20260813092400_seed_gr8_standard_specifications.sql',
  '20260813093000_selection_budget_manager.sql',
  '20261003000100_builder_selection_tenant_foundation.sql',
  '20261010000100_builder_requirement_quote_mappings.sql',
  '20261011000100_requirement_mapping_product_identity.sql',
  '20261021000100_builder_commercial_internal_member_rls.sql',
  '20261028000100_workspace_members_rls_recursion_fix.sql',
];
// Parent first: later rows point at earlier ones of the same workspace.
const TABLES = ['builder_commercial_projects', 'builder_estimate_snapshots', 'builder_selection_sessions', 'builder_client_selections', 'builder_selection_books', 'builder_variations'];
const PARENT_COLUMN = { project_id: 'builder_commercial_projects', snapshot_id: 'builder_estimate_snapshots', estimate_snapshot_id: 'builder_estimate_snapshots', session_id: 'builder_selection_sessions', selection_session_id: 'builder_selection_sessions' };
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const users = {
  ownerA: { id: 'aaaaaaaa-0000-4000-8000-000000000001', memberships: [[A, 'owner']] },
  ownerB: { id: 'bbbbbbbb-0000-4000-8000-000000000002', memberships: [[B, 'owner']] },
  clientA: { id: 'cccccccc-0000-4000-8000-000000000003', memberships: [[A, 'client']] },
};

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text);
  create table public.workspace_entitlements (workspace_id uuid, entitlement text);
  create table public.communities (workspace_id uuid, name text);
  alter table public.workspaces enable row level security;
  alter table public.workspace_members enable row level security;
  alter table public.workspace_entitlements enable row level security;
  alter table public.communities enable row level security;`);
await db.query(`insert into workspaces values ($1,'Builder A'),($2,'Builder B')`, [A, B]);
for (const user of Object.values(users)) {
  await db.query('insert into auth.users values ($1)', [user.id]);
  for (const [ws, role] of user.memberships) await db.query(`insert into workspace_members values ($1,$2,$3,'active')`, [ws, user.id, role]);
}
for (const file of MIGRATIONS) {
  const sql = (await fs.readFile(`${DIR}/${file}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, '');
  try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
}
await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');

// Seed one linked row per table per workspace (as superuser, bypassing RLS).
const ids = { [A]: {}, [B]: {} };
async function requiredColumns(table) {
  return (await db.query(`select column_name, data_type, udt_name from information_schema.columns
    where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null and column_name not in ('workspace_id','id')`, [table])).rows;
}
function valueFor(column, ws) {
  const parent = PARENT_COLUMN[column.column_name];
  if (parent) return ids[ws][parent];
  if (/uuid/.test(column.data_type)) return crypto.randomUUID();
  if (/int|numeric|double|real/.test(column.data_type)) return 1;
  if (/bool/.test(column.data_type)) return false;
  if (/json/.test(column.data_type)) return '{}';
  if (/ARRAY/.test(column.data_type)) return '{}';
  if (/timestamp|date/.test(column.data_type)) return new Date().toISOString();
  return `seed-${column.column_name}`;
}
async function rowFor(table, ws) {
  const id = crypto.randomUUID();
  const cols = await requiredColumns(table);
  // Optional parent links are filled too, so a policy that joins through the project sees a real one.
  const optionalParents = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='YES' and column_name = any($2)`, [table, Object.keys(PARENT_COLUMN)])).rows
    .filter((c) => ids[ws][PARENT_COLUMN[c.column_name]]);
  const names = ['id', 'workspace_id', ...cols.map((c) => c.column_name), ...optionalParents.map((c) => c.column_name)];
  const values = [id, ws, ...cols.map((c) => valueFor(c, ws)), ...optionalParents.map((c) => ids[ws][PARENT_COLUMN[c.column_name]])];
  return { id, names, values };
}
const insertSql = (table, names) => `insert into public.${table}(${names.map((x) => `"${x}"`).join(',')}) values (${names.map((_, i) => `$${i + 1}`).join(',')})`;
for (const table of TABLES) {
  assert((await db.query('select to_regclass($1) r', [`public.${table}`])).rows[0].r, `${table} exists in the migrations`);
  for (const ws of [A, B]) {
    const row = await rowFor(table, ws);
    try { await db.query(insertSql(table, row.names), row.values); }
    catch (error) { throw new Error(`could not seed ${table} for ${ws === A ? 'A' : 'B'}: ${error.message}`); }
    ids[ws][table] = row.id;
  }
}

async function as(user, run) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user.id]);
  await db.exec('set role authenticated');
  try { return await run(); } finally { await db.exec('reset role'); }
}
async function probe(user, table, own, other) {
  return as(user, async () => {
    const count = async (ws) => (await db.query(`select count(*)::int c from public.${table} where workspace_id=$1`, [ws])).rows[0].c;
    const attempt = async (sql, params) => { await db.exec('begin'); try { return (await db.query(sql, params)).rows.length; } catch { return -1; } finally { await db.exec('rollback'); } };
    const result = {
      readOwn: own ? await count(own) : 0,
      readOther: await count(other),
      updateOther: await attempt(`update public.${table} set workspace_id=workspace_id where workspace_id=$1 returning 1`, [other]),
      deleteOther: await attempt(`delete from public.${table} where workspace_id=$1 returning 1`, [other]),
      updateOwn: own ? await attempt(`update public.${table} set workspace_id=workspace_id where workspace_id=$1 returning 1`, [own]) : 0,
    };
    // Insert a row into the OTHER builder's workspace (pointing at that builder's parents).
    const row = await (async () => { await db.exec('reset role'); const r = await rowFor(table, other); await db.exec('set role authenticated'); return r; })();
    result.insertOther = await attempt(`${insertSql(table, row.names)} returning 1`, row.values);
    // Moving one's own row into the other workspace is an insert into it too.
    result.moveOwnToOther = own ? await attempt(`update public.${table} set workspace_id=$2 where workspace_id=$1 returning 1`, [own, other]) : 0;
    return result;
  });
}

let checks = 0;
const results = {};
for (const table of TABLES) {
  const a = await probe(users.ownerA, table, A, B);
  const b = await probe(users.ownerB, table, B, A);
  const c = await probe(users.clientA, table, null, A);
  results[table] = { ownerA: a, ownerB: b, clientA: c };
  for (const [name, r] of [['ownerA', a], ['ownerB', b]]) {
    assert(r.readOwn > 0, `${name} can read its own ${table}`);
    assert(r.updateOwn > 0, `${name} can change its own ${table}`);
    assert.equal(r.readOther, 0, `${name} read the other builder's ${table}`);
    assert(r.updateOther <= 0, `${name} updated the other builder's ${table}`);
    assert(r.deleteOther <= 0, `${name} deleted the other builder's ${table}`);
    assert(r.insertOther <= 0, `${name} inserted into the other builder's ${table}`);
    assert(r.moveOwnToOther <= 0, `${name} moved a ${table} row into the other builder's workspace`);
    checks += 7;
  }
  assert.equal(c.readOther, 0, `client-role member read builder A ${table}`);
  assert(c.updateOther <= 0 && c.deleteOther <= 0 && c.insertOther <= 0, `client-role member changed builder A ${table}`);
  checks += 2;
  console.log(`PASS ${table}: owners isolated (read/update/delete/insert/move), client-role member has no direct access`);
}
await db.close();
console.log(`Client Selections two-builder RLS: ${checks} checks passed across ${TABLES.length} tables. Isolated in-memory PostgreSQL from the real migrations; not live Supabase.`);
