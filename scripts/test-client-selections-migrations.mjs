import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// The three Client Selections migrations, applied in order on real PostgreSQL (PGlite) after the
// migrations they depend on: table, triggers, product-specific identity, tenant and client RLS,
// and that the RLS migration can be re-run.
//   node scripts/test-client-selections-migrations.mjs
const CLIENT_SELECTIONS_MIGRATIONS = [
  '20261010000100_builder_requirement_quote_mappings.sql',
  '20261011000100_requirement_mapping_product_identity.sql',
  '20261021000100_builder_commercial_internal_member_rls.sql',
];
const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ESTIMATOR_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CLIENT_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let checks = 0;
async function check(name, run) { await run(); checks += 1; console.log('PASS', name); }
const migration = async filename => (await fs.readFile(`supabase/migrations/${filename}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, '');
const asUser = async user => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]); await db.exec('set role authenticated'); };
const asService = () => db.exec('reset role');

await db.exec(`create role authenticated; create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text);
  alter table public.workspace_members enable row level security;
  insert into auth.users values ('${OWNER_A}'),('${OWNER_B}'),('${ESTIMATOR_A}'),('${CLIENT_A}');
  insert into workspaces values ('${A}','Builder A'),('${B}','Builder B');
  insert into workspace_members values ('${A}','${OWNER_A}','owner','active'),('${B}','${OWNER_B}','owner','active'),
    ('${A}','${ESTIMATOR_A}','estimator','active'),('${A}','${CLIENT_A}','client','active');
  grant usage on schema public,auth to authenticated; grant select on workspace_members to authenticated;`);
for (const filename of [
  '20260813091500_estimate_builder_commercial_backbone_stage1.sql',
  '20260813091600_builder_inclusion_templates.sql',
  '20260813091800_builder_selection_books.sql',
  '20260813092100_builder_product_library.sql',
  '20260813092400_seed_gr8_standard_specifications.sql',
  '20260813093000_selection_budget_manager.sql',
  '20261003000100_builder_selection_tenant_foundation.sql',
]) {
  try { await db.exec(await migration(filename)); } catch (error) { throw new Error(`prerequisite ${filename}: ${error.message}`, { cause: error }); }
}
await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
await db.query(`insert into builder_products(workspace_id,product_name,selection_slot_ids) values ($1,'Product A',array['kitchen_sink']),($2,'Product B',array['kitchen_sink'])`, [A, B]);

for (const filename of CLIENT_SELECTIONS_MIGRATIONS) {
  await check(`${filename} applies`, async () => { await db.exec(await migration(filename)); });
}

const insertMapping = (workspace, product, location = 'kitchen', row = 'row-1') => db.query(
  `insert into builder_requirement_quote_mappings(workspace_id,template_id,requirement_key,product_id,location_id,quote_section_id,quote_row_id) values ($1,'template','ceiling-fan',$2,$3,'ELECTRICAL',$4) returning *`,
  [workspace, product, location, row]);

await check('builder_requirement_quote_mappings exists with product_id and its identity constraint', async () => {
  const columns = (await db.query(`select column_name from information_schema.columns where table_name='builder_requirement_quote_mappings'`)).rows.map(row => row.column_name);
  assert(columns.includes('product_id'));
  const unique = (await db.query(`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.builder_requirement_quote_mappings'::regclass and contype='u'`)).rows;
  assert.deepEqual(unique.map(row => row.conname), ['builder_requirement_quote_mappings_identity_unique'], `unique constraints left: ${JSON.stringify(unique)}`);
});

await asUser(OWNER_A);
await check('two different products can be mapped for the same requirement and room', async () => {
  await insertMapping(A, 'spyda-black-1', 'kitchen', 'row-1');
  await insertMapping(A, 'spyda-black-2', 'kitchen', 'row-2');
  assert.equal((await db.query(`select * from builder_requirement_quote_mappings where workspace_id=$1`, [A])).rows.length, 2);
});
await check('the same product, requirement and room cannot be mapped twice', async () => {
  await assert.rejects(insertMapping(A, 'spyda-black-1', 'kitchen', 'row-3'), /duplicate key|unique/i);
});
await check('updates bump version and stamp the verifier', async () => {
  const before = (await db.query(`select id, version from builder_requirement_quote_mappings where product_id='spyda-black-1'`)).rows[0];
  const after = (await db.query(`update builder_requirement_quote_mappings set quote_row_id='row-9' where id=$1 returning version, verified_by`, [before.id])).rows[0];
  assert.equal(after.version, before.version + 1);
  assert.equal(after.verified_by, OWNER_A);
});

await asService();
await insertMapping(B, 'other-builder-fan', 'kitchen', 'row-b');
await asUser(OWNER_A);
await check('a builder cannot read or change another builder\'s mappings', async () => {
  const rows = (await db.query('select workspace_id from builder_requirement_quote_mappings')).rows;
  assert(rows.length > 0 && rows.every(row => row.workspace_id === A));
  assert.equal((await db.query(`update builder_requirement_quote_mappings set status='RETIRED' where workspace_id=$1 returning id`, [B])).rows.length, 0);
});
await check('a builder cannot move a mapping to another workspace', async () => {
  await assert.rejects(db.query(`update builder_requirement_quote_mappings set workspace_id=$1 where workspace_id=$2`, [B, A]));
});

await asUser(ESTIMATOR_A);
await check('internal staff (estimator) can read mappings and products but not write mappings', async () => {
  assert.equal((await db.query('select * from builder_requirement_quote_mappings')).rows.length, 2);
  assert.equal((await db.query('select * from builder_products')).rows.length, 1);
  await assert.rejects(insertMapping(A, 'estimator-fan', 'living', 'row-e'), /row-level security|policy/i);
});

await asUser(CLIENT_A);
await check('a client-role member of the same workspace cannot read internal commercial records', async () => {
  assert.equal((await db.query('select * from builder_requirement_quote_mappings')).rows.length, 0);
  assert.equal((await db.query('select * from builder_products')).rows.length, 0);
  await assert.rejects(insertMapping(A, 'client-fan', 'living', 'row-c'), /row-level security|policy/i);
});

await asService();
await check('the RLS migration can be applied again', async () => {
  await db.exec(await migration('20261021000100_builder_commercial_internal_member_rls.sql'));
});

console.log(`Client Selections migrations: ${checks} checks passed.`);
