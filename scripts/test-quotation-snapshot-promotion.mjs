// Real SQL on isolated PostgreSQL/WASM; no network or customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const staffA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const staffB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table workspaces(id uuid primary key, name text);
create table workspace_members(workspace_id uuid, user_id uuid, role text, status text);
create table workspace_entitlements(workspace_id uuid, entitlement text);
create table communities(workspace_id uuid, name text);
insert into workspaces values ('${A}','A'),('${B}','B');
insert into auth.users values ('${staffA}'),('${staffB}'),('${client}');
insert into workspace_members values ('${A}','${staffA}','owner','active'),('${B}','${staffB}','owner','active'),('${A}','${client}','client','active');
grant usage on schema public, auth to authenticated, anon, service_role;
grant select on workspace_members, workspaces to authenticated;`);
const files = [
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
  '20261113000100_quotation_snapshot_promotion.sql',
];
for (const file of files) await db.exec((await fs.readFile(`supabase/migrations/${file}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, ''));
await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
const project = async workspace => (await db.query("insert into builder_commercial_projects(workspace_id,project_name) values ($1,'Disposable') returning id", [workspace])).rows[0].id;
const projectA = await project(A), projectB = await project(B);
const snapshot = async (workspace, projectId, n, total) => (await db.query(`insert into builder_estimate_snapshots(workspace_id,project_id,snapshot_number,final_quote_total,source_workbook_job_id) values ($1,$2,$3,$4,'isolated-job') returning id`, [workspace, projectId, n, total])).rows[0].id;
const old = await snapshot(A, projectA, 1, 100);
const pending = await snapshot(A, projectA, 2, 200);
const newer = await snapshot(A, projectA, 3, 300);
await snapshot(B, projectB, 1, 999);
const promote = async (id, counts = [0, 0, 0], workspace = A) => (await db.query('select builder_promote_quotation_snapshot($1,$2,$3,$4,$5,$6) ok', [workspace, projectA, id, ...counts])).rows[0].ok;
const current = async () => (await db.query("select id from builder_estimate_snapshots where workspace_id=$1 and status='current'", [A])).rows.map(r => r.id);
const as = async (role, user, fn) => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
};
try {
  assert.equal(await as('service_role', null, () => promote(old)), true);
  await assert.rejects(promote(pending, [1, 0, 0]), /incomplete/);
  assert.deepEqual(await current(), [old]);
  assert.equal((await db.query('select contract_total from builder_commercial_projects where id=$1', [projectA])).rows[0].contract_total, '100.00');
  console.log('PASS failed/incomplete issuance keeps the previous current snapshot and project totals');
  assert.equal(await promote(newer), true);
  assert.equal(await promote(pending), false);
  assert.deepEqual(await current(), [newer]);
  assert.equal(await promote(newer), true);
  console.log('PASS out-of-order completion cannot replace a newer snapshot; retry is idempotent');
  await assert.rejects(promote(newer, [0, 0, 0], B), /not found/);
  await assert.rejects(promote(newer, [null, 0, 0]), /required/);
  for (const [role, user] of [['anon', null], ['authenticated', staffA], ['authenticated', client]]) {
    await assert.rejects(as(role, user, () => promote(newer)), /permission denied/);
  }
  console.log('PASS promotion rejects cross-workspace identifiers and anonymous/client/direct authenticated execution');
  for (const [user, expected] of [[staffA, 3], [staffB, 1], [client, 0]]) {
    const rows = await as('authenticated', user, () => db.query('select workspace_id from builder_estimate_snapshots'));
    assert.equal(rows.rows.length, expected);
    assert(rows.rows.every(r => r.workspace_id === (user === staffB ? B : A)));
  }
  await assert.rejects(as('authenticated', staffB, () => db.query(`insert into builder_estimate_snapshots(workspace_id,project_id,snapshot_number) values ($1,$2,10)`, [A, projectA])), /row-level security/);
  console.log('PASS two-builder snapshot read/write isolation and confidential client-role access');
  await db.exec('begin');
  const fourth = await snapshot(A, projectA, 4, 400);
  await promote(fourth);
  await db.exec('rollback');
  assert.deepEqual(await current(), [newer]);
  console.log('PASS transaction rollback restores the previous current snapshot');
} finally { await db.close(); }
