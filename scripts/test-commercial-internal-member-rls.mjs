// Isolated PostgreSQL (PGlite, in memory) test for
// supabase/migrations/20261021000100_builder_commercial_internal_member_rls.sql.
// Builds two databases from the real migration files - one without this migration (baseline)
// and one with it - then compares what each workspace role can read and change.
// Expected: internal builder roles keep exactly their baseline access; client-role,
// unknown-role and inactive members lose all direct access to internal commercial tables.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const TARGET = '20261021000100_builder_commercial_internal_member_rls.sql';
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
  TARGET,
  '20261028000100_workspace_members_rls_recursion_fix.sql',
];
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const INTERNAL_ROLES = ['owner', 'admin', 'builder', 'builder_admin', 'builder_staff', 'estimator', 'interior_designer', 'sales'];
const users = {};
let n = 0;
const uid = () => `${String(++n).padStart(8, '0')}-0000-4000-8000-000000000000`;
for (const role of INTERNAL_ROLES) users[role] = { id: uid(), role, status: 'active', internal: true };
users.client = { id: uid(), role: 'client', status: 'active', internal: false };
users.unknown_role = { id: uid(), role: 'viewer', status: 'active', internal: false };
users.inactive_estimator = { id: uid(), role: 'estimator', status: 'inactive', internal: false };
users.client_in_A_owner_in_B = { id: uid(), role: 'client', status: 'active', internal: false, alsoOwnerOfB: true };

const targetSql = await fs.readFile(`supabase/migrations/${TARGET}`, 'utf8');
const listed = [...targetSql.matchAll(/^\s*'(builder_[a-z_]+|client_portal_[a-z_]+)'/gm)].map((m) => m[1]);
assert(listed.length > 40, 'could not read the migration table list');

async function build(includeTarget) {
  const db = new PGlite();
  await db.exec(`create role authenticated; create schema auth;
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
    insert into workspaces values ('${A}','Builder A'),('${B}','Builder B');
    grant usage on schema public,auth to authenticated;
    grant select on workspaces,workspace_members to authenticated;`);
  for (const u of Object.values(users)) {
    await db.query('insert into auth.users values ($1)', [u.id]);
    await db.query('insert into workspace_members values ($1,$2,$3,$4)', [A, u.id, u.role, u.status]);
    if (u.alsoOwnerOfB) await db.query(`insert into workspace_members values ($1,$2,'owner','active')`, [B, u.id]);
  }
  for (const file of MIGRATIONS) {
    if (file === TARGET && !includeTarget) continue;
    const sql = (await fs.readFile(`supabase/migrations/${file}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, '');
    try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
  }
  await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
  // Disposable seed rows in both workspaces (as superuser) wherever a minimal row is insertable.
  const seeded = [];
  for (const table of listed) {
    if (!(await db.query('select to_regclass($1) r', [`public.${table}`])).rows[0].r) continue;
    const cols = (await db.query(`select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null and column_name<>'workspace_id'`, [table])).rows;
    let ok = true;
    for (const ws of [A, B]) {
      const names = ['workspace_id', ...cols.map((c) => c.column_name)];
      const values = [ws, ...cols.map((c) => (/uuid/.test(c.data_type) ? null : /int|numeric|double|real/.test(c.data_type) ? 1 : /bool/.test(c.data_type) ? false : /json/.test(c.data_type) ? '{}' : /ARRAY/.test(c.data_type) ? '{}' : /timestamp|date/.test(c.data_type) ? new Date().toISOString() : 'test'))];
      if (values.includes(null)) { ok = false; break; }
      try {
        await db.query(`insert into public.${table}(${names.map((x) => `"${x}"`).join(',')}) values (${names.map((_, i) => `$${i + 1}`).join(',')})`, values);
      } catch { ok = false; break; }
    }
    if (ok) seeded.push(table);
  }
  return { db, seeded };
}

async function access(db, user, table) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user.id]);
  await db.exec('set role authenticated');
  const readA = (await db.query(`select count(*)::int c from public.${table} where workspace_id=$1`, [A])).rows[0].c;
  const readB = (await db.query(`select count(*)::int c from public.${table} where workspace_id=$1`, [B])).rows[0].c;
  let writeA = 0;
  await db.exec('begin');
  try { writeA = (await db.query(`update public.${table} set workspace_id=workspace_id where workspace_id=$1 returning 1`, [A])).rows.length; } catch { writeA = -1; }
  await db.exec('rollback');
  await db.exec('reset role');
  return { readA, readB, writeA };
}

let checks = 0;
const pass = (name) => { checks += 1; console.log('PASS', name); };
const before = await build(false);
const after = await build(true);
const present = [];
for (const t of listed) if ((await after.db.query('select to_regclass($1) r', [`public.${t}`])).rows[0].r) present.push(t);

const policies = (await after.db.query(`select tablename from pg_policies where policyname='internal_workspace_members_only' and permissive='RESTRICTIVE' and cmd='ALL'`)).rows.map((r) => r.tablename);
assert.deepEqual([...policies].sort(), [...present].sort());
pass(`restrictive internal-member policy installed on all ${present.length} existing listed tables; missing tables skipped safely`);

const tested = after.seeded.filter((t) => before.seeded.includes(t));
assert(tested.length >= 10, `too few seedable tables (${tested.length})`);
for (const [key, user] of Object.entries(users)) {
  for (const table of tested) {
    const b = await access(before.db, user, table);
    const a = await access(after.db, user, table);
    if (user.internal) {
      assert.deepEqual(a, b, `${key} access to ${table} changed: before ${JSON.stringify(b)} after ${JSON.stringify(a)}`);
    } else {
      assert.equal(a.readA, 0, `${key} can still read ${table} in builder A`);
      assert(a.writeA <= 0, `${key} can still change ${table} in builder A`);
      if (user.alsoOwnerOfB) assert.deepEqual({ readB: a.readB }, { readB: b.readB }, `${key} lost owner access to builder B ${table}`);
    }
    assert(a.readB === 0 || user.alsoOwnerOfB, `${key} read another builder's ${table}`);
  }
  pass(user.internal
    ? `${key}: access unchanged by the migration across ${tested.length} tables`
    : `${key}: no read/write of builder A internal records across ${tested.length} tables`);
}
const clientBaseline = await access(before.db, users.client, tested[0]);
assert(clientBaseline.readA > 0, 'baseline should show the client could read internal records before the migration');
pass(`regression proven: before the migration a client-role member could read ${tested[0]}; after, it cannot`);

await before.db.close(); await after.db.close();
console.log(`Commercial internal-member RLS: ${checks} checks passed (${tested.length} seeded tables, ${present.length} protected). Isolated in-memory database; not live Supabase.`);
