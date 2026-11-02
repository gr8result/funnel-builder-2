import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
const migration = fs.readFileSync("supabase/migrations/20261101000100_funnel_master_templates.sql", "utf8");

await database.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, anon;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (
    workspace_id uuid not null,
    user_id uuid not null,
    status text not null default 'active',
    primary key (workspace_id, user_id)
  );
  create table public.funnels (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null,
    workspace_id uuid,
    name text not null,
    description text,
    notify_email text,
    default_list_id uuid,
    slug text,
    status text not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table public.funnel_steps (
    id uuid primary key default gen_random_uuid(),
    funnel_id uuid not null references public.funnels(id) on delete cascade,
    title text not null,
    content text not null default '',
    order_index integer not null default 0,
    updated_at timestamptz not null default now()
  );
  grant select on public.workspace_members to authenticated;
  grant usage on schema public to authenticated, anon, service_role;
  grant select, insert, update, delete on public.funnels, public.funnel_steps to public, anon, authenticated, service_role;
`);
await database.exec(`
  insert into public.workspaces values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'Builder A'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'Builder B');
  insert into public.workspace_members (workspace_id, user_id) values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');
`);
await database.exec(migration);
await database.exec(migration);

await database.exec("set role authenticated");
await database.query("select set_config('request.jwt.claim.sub', $1, false)", ["a0000000-0000-4000-8000-000000000001"]);
const ownFunnel = await database.query(`
  insert into public.funnels (owner_user_id, workspace_id, name)
  values ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Builder A funnel')
  returning id
`);
await database.query("insert into public.funnel_steps (funnel_id, title, content) values ($1, 'Step A', '<h1>Private A</h1>')", [ownFunnel.rows[0].id]);
assert.equal((await database.query("select id from public.funnels")).rows.length, 1, "builder A sees only their own funnel");
assert.equal((await database.query("select id from public.funnel_steps")).rows.length, 1, "builder A sees only steps in their funnel");
await assert.rejects(
  () => database.exec(`
    insert into public.funnels (owner_user_id, workspace_id, name)
    values ('a0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Wrong workspace')
  `),
  /row-level security/i,
  "owner identity cannot be used to write into another workspace",
);
await assert.rejects(
  () => database.exec(`
    insert into public.funnels (owner_user_id, workspace_id, name, is_master_template, template_description)
    values ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Attempt', true, 'attempted promotion')
  `),
  /metadata must be managed through the authenticated Funnel Builder API/i,
);
await assert.rejects(
  () => database.query("update public.funnels set template_description = 'attempted mutation' where id = $1", [ownFunnel.rows[0].id]),
  /metadata must be managed through the authenticated Funnel Builder API/i,
);
await database.query("select set_config('request.jwt.claim.sub', $1, false)", ["b0000000-0000-4000-8000-000000000002"]);
assert.equal((await database.query("select id from public.funnels")).rows.length, 0, "builder B cannot read builder A's funnel");
assert.equal((await database.query("select id from public.funnel_steps")).rows.length, 0, "builder B cannot read builder A's steps");
await database.exec("reset role; set role anon");
await assert.rejects(() => database.query("select id from public.funnels"), /permission denied/i, "anonymous users cannot read private funnels");
await assert.rejects(() => database.query("select id from public.funnel_steps"), /permission denied/i, "anonymous users cannot read private funnel steps");

await database.exec("reset role; set role service_role");
const master = await database.query(`
  insert into public.funnels (owner_user_id, workspace_id, name, is_master_template, template_description)
  values ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Approved master', true, 'approved master')
  returning id
`);
await database.query("insert into public.funnel_steps (funnel_id, title, content) values ($1, 'Master step', '<h1>Master</h1>')", [master.rows[0].id]);
const { rows } = await database.query("select is_master_template, template_description from public.funnels where is_master_template = true");
assert.deepEqual(rows, [{ is_master_template: true, template_description: "approved master" }]);

console.log("PASS migration reruns safely, protects master metadata, and isolates direct funnel/step access by workspace");
await database.close();
