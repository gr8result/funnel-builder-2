// Tenant isolation of saved AI Takeoff jobs, with no network and no Supabase: the real table definitions, helper
// functions and row-level security from the migrations are applied to an in-memory Postgres (PGlite), then
// attacked as different users. Saved takeoff jobs live in builder_commercial_projects (the job) and
// builder_estimate_snapshots (the saved workbook, which holds aiPlanTakeoffJob).
//
// Real SQL used verbatim: builder_commercial_is_workspace_member and the two CREATE TABLEs (20260813091500),
// the workspace policies from that migration's policy loop, and the whole internal-member migration
// (20261021000100). Stand-ins: auth.uid(), auth.users, workspaces, workspace_members (as in Supabase).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = 'supabase/migrations';
const backbone = fs.readFileSync(`${dir}/20260813091500_estimate_builder_commercial_backbone_stage1.sql`, 'utf8');
const internalRls = fs.readFileSync(`${dir}/20261021000100_builder_commercial_internal_member_rls.sql`, 'utf8');
const functionSource = (sql, name) => {
  const start = sql.search(new RegExp(`create (or replace )?function public\\.${name}\\(`));
  assert(start >= 0, `${name} is in the migration`);
  const open = sql.indexOf('$$', start), close = sql.indexOf('$$', open + 2);
  return `${sql.slice(start, close + 2)};`;
};
const tableSource = (sql, name) => {
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  assert(start >= 0, `${name} is created in the migration`);
  const end = sql.indexOf('\n);', start);
  return `${sql.slice(start, end + 3)}`;
};
// The workspace policies exactly as the backbone migration's loop creates them.
const policyTemplates = [...backbone.matchAll(/'create policy %I on public\.%I (for [^']+)'/g)].map((m) => m[1]);
assert.equal(policyTemplates.length, 4, 'select, insert, update and delete workspace policies');

const db = new PGlite();
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon; grant usage on schema public to authenticated, anon;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid references public.workspaces(id) on delete cascade, user_id uuid, role text, status text default 'active');
`);
await db.exec(functionSource(backbone, 'builder_commercial_set_updated_at'));
await db.exec(functionSource(backbone, 'builder_commercial_is_workspace_member'));
for (const table of ['builder_commercial_projects', 'builder_estimate_snapshots']) {
  await db.exec(tableSource(backbone, table));
  await db.exec(`alter table public.${table} enable row level security; grant select, insert, update, delete on public.${table} to authenticated, anon;`);
  for (const [index, body] of policyTemplates.entries()) await db.exec(`create policy ${table}_workspace_${index} on public.${table} ${body.replace(/public\.builder_commercial_is_workspace_member\(workspace_id\)/g, 'public.builder_commercial_is_workspace_member(workspace_id)')};`);
}
await db.exec(internalRls);

const W = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222' };
const U = { a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', client: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', left: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
await db.exec(`
  insert into auth.users values ('${U.a}'), ('${U.b}'), ('${U.client}'), ('${U.left}');
  insert into public.workspaces values ('${W.a}', 'Builder A'), ('${W.b}', 'Builder B');
  insert into public.workspace_members values ('${W.a}', '${U.a}', 'owner', 'active'), ('${W.b}', '${U.b}', 'owner', 'active'),
    ('${W.a}', '${U.client}', 'client', 'active'), ('${W.a}', '${U.left}', 'estimator', 'removed');
`);
// Run as a signed-in user (or anonymous), the way PostgREST does: role + JWT subject.
async function as(user, sql, params = []) {
  await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (error) { return { error: error.message }; } finally { await db.exec('reset role;'); }
}
const job = (name) => JSON.stringify({ aiPlanTakeoffJob: { jobName: name, plan: { pages: [] }, completedWallRuns: [{ id: 'w1' }] } });

// Each builder saves a takeoff job in their own workspace.
const projectA = (await as(U.a, `insert into public.builder_commercial_projects (workspace_id, project_name) values ($1, 'A job') returning id`, [W.a])).rows[0].id;
const projectB = (await as(U.b, `insert into public.builder_commercial_projects (workspace_id, project_name) values ($1, 'B job') returning id`, [W.b])).rows[0].id;
await as(U.a, `insert into public.builder_estimate_snapshots (workspace_id, project_id, workbook_snapshot) values ($1, $2, $3::jsonb)`, [W.a, projectA, job('A takeoff')]);
await as(U.b, `insert into public.builder_estimate_snapshots (workspace_id, project_id, workbook_snapshot) values ($1, $2, $3::jsonb)`, [W.b, projectB, job('B takeoff')]);

const results = [];
const check = (name, ok, detail) => { results.push(name); assert.ok(ok, `${name}: ${JSON.stringify(detail)}`); };
const seen = async (user) => (await as(user, `select workbook_snapshot->'aiPlanTakeoffJob'->>'jobName' as name from public.builder_estimate_snapshots order by name`)).rows?.map((r) => r.name) || [];
check('each builder sees only their own takeoff jobs', JSON.stringify(await seen(U.a)) === '["A takeoff"]' && JSON.stringify(await seen(U.b)) === '["B takeoff"]', { a: await seen(U.a), b: await seen(U.b) });

const steal = await as(U.b, `update public.builder_estimate_snapshots set workbook_snapshot = '{"aiPlanTakeoffJob":{"jobName":"hijacked"}}'::jsonb where workspace_id = $1 returning id`, [W.a]);
check('builder B cannot change builder A\'s takeoff', !steal.rows?.length, steal);
const wipe = await as(U.b, `delete from public.builder_estimate_snapshots where workspace_id = $1 returning id`, [W.a]);
check('builder B cannot delete builder A\'s takeoff', !wipe.rows?.length, wipe);
const plant = await as(U.b, `insert into public.builder_estimate_snapshots (workspace_id, project_id, workbook_snapshot) values ($1, $2, '{}'::jsonb)`, [W.a, projectA]);
check('builder B cannot write a takeoff into builder A\'s workspace', Boolean(plant.error), plant);
const move = await as(U.b, `update public.builder_estimate_snapshots set workspace_id = $1 where workspace_id = $2 returning id`, [W.a, W.b]);
check('builder B cannot move a takeoff into another workspace', Boolean(move.error) || !move.rows?.length, move);
check('a client-role member of A\'s workspace cannot read the internal takeoff', (await seen(U.client)).length === 0, await seen(U.client));
const clientWrite = await as(U.client, `update public.builder_estimate_snapshots set workbook_snapshot = '{}'::jsonb returning id`);
check('nor change it', !clientWrite.rows?.length, clientWrite);
check('a removed member cannot read it', (await seen(U.left)).length === 0, await seen(U.left));
check('an anonymous visitor sees nothing', (await seen(null)).length === 0, await seen(null));
const projectsB = (await as(U.b, `select id from public.builder_commercial_projects`)).rows.map((r) => r.id);
check('the job records are isolated the same way', JSON.stringify(projectsB) === JSON.stringify([projectB]), projectsB);
const owner = await seen(U.a);
check('builder A\'s takeoff is untouched after every attempt', JSON.stringify(owner) === '["A takeoff"]', owner);
console.log(`Takeoff tenant isolation (real migrations, in-memory Postgres): ${results.length} checks passed.`);
