import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migrations = [
  "20260813085900_landing_pages_legacy_baseline.sql",
  "20260813090100_account_onboarding_gate.sql",
  "20260813090300_workspace_part1_tables.sql",
  "20260813090400_workspace_part2_security.sql",
  "20260813090500_workspace_crm_refactor.sql",
  "20260813090550_landing_pages_storage_buckets.sql",
  "20260813090600_business_profile_vault.sql",
  "20261014000100_landing_page_campaigns.sql",
  "20261028000100_workspace_members_rls_recursion_fix.sql",
  "20261101000100_funnel_master_templates.sql",
  "20261101000200_crm_lead_notes_access.sql",
  "20261101000300_campaign_master_templates.sql",
  "20261101000400_funnel_form_crm.sql",
  "20261101000500_landing_pages_security_hardening.sql",
];

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant select on auth.users to service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null unique,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets(id),
    name text not null
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.buckets, storage.objects to service_role;
`);

for (let pass = 1; pass <= 2; pass += 1) {
  for (const migration of migrations) {
    await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, "utf8"));
  }
}

const requiredTables = [
  "accounts", "workspaces", "workspace_members", "workspace_entitlements",
  "communities", "email_lists", "subscribers", "list_subscribers", "tags",
  "subscriber_tags", "funnels", "funnel_steps", "leads", "lead_notes",
  "form_submissions", "business_profile_vaults", "business_profile_documents",
  "landing_campaigns", "landing_pages", "landing_page_versions",
  "landing_page_submissions", "landing_page_events", "landing_audit_log",
];
for (const table of requiredTables) {
  assert.equal(
    (await db.query("select to_regclass($1) is not null as present", [`public.${table}`])).rows[0].present,
    true,
    `${table} exists`,
  );
  assert.equal(
    (await db.query(`
      select c.relrowsecurity as enabled
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = $1
    `, [table])).rows[0].enabled,
    true,
    `${table} has RLS enabled`,
  );
}

assert.deepEqual(
  (await db.query("select id, public from storage.buckets order by id")).rows,
  [{ id: "Private-assets", public: false }, { id: "assets", public: true }],
);
assert.equal(
  (await db.query(`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'workspaces' and column_name = 'is_demo'
    ) as present
  `)).rows[0].present,
  true,
);
assert.equal((await db.query("select has_table_privilege('anon', 'public.funnels', 'select') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_table_privilege('anon', 'public.funnels', 'truncate') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_table_privilege('anon', 'public.landing_pages', 'select') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_function_privilege('authenticated', 'public.is_workspace_member(uuid)', 'execute') as allowed")).rows[0].allowed, true);
assert.equal((await db.query("select has_function_privilege('authenticated', 'public.lp_is_workspace_member(uuid)', 'execute') as allowed")).rows[0].allowed, true);
assert.equal((await db.query("select has_function_privilege('anon', 'public.lp_clone_master_template(uuid,uuid,uuid,text,uuid,text)', 'execute') as allowed")).rows[0].allowed, false);

const USER_A = "a0000000-0000-4000-8000-000000000001";
const USER_B = "b0000000-0000-4000-8000-000000000002";
const WS_A = "aaaaaaaa-0000-4000-8000-000000000001";
const WS_B = "bbbbbbbb-0000-4000-8000-000000000002";
await db.exec(`
  insert into auth.users values
    ('${USER_A}', 'a@example.test'),
    ('${USER_B}', 'b@example.test');
  insert into public.workspaces (id, name, owner_id) values
    ('${WS_A}', 'Builder A', '${USER_A}'),
    ('${WS_B}', 'Builder B', '${USER_B}');
  insert into public.workspace_members (workspace_id, user_id, role, status) values
    ('${WS_A}', '${USER_A}', 'owner', 'active'),
    ('${WS_B}', '${USER_B}', 'owner', 'active');
`);

async function asUser(userId, callback) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
  try {
    return await callback();
  } finally {
    await db.exec("reset role");
  }
}

const funnel = await asUser(USER_A, async () => {
  const result = await db.query(`
    insert into public.funnels (owner_user_id, workspace_id, name, slug)
    values ($1, $2, 'Builder A funnel', 'builder-a-funnel')
    returning id
  `, [USER_A, WS_A]);
  await db.query(`
    insert into public.funnel_steps (funnel_id, title, content)
    values ($1, 'Offer', '<h1>Private A</h1>')
  `, [result.rows[0].id]);
  await db.query(`
    insert into public.landing_campaigns (workspace_id, created_by, name)
    values ($1, $2, 'Builder A campaign')
  `, [WS_A, USER_A]);
  await db.query(`
    insert into public.leads (workspace_id, user_id, name, email)
    values ($1, $2, 'Private A', 'private-a@example.test')
  `, [WS_A, USER_A]);
  return result.rows[0];
});

await asUser(USER_B, async () => {
  assert.equal((await db.query("select id from public.funnels")).rows.length, 0);
  assert.equal((await db.query("select id from public.funnel_steps")).rows.length, 0);
  assert.equal((await db.query("select id from public.landing_campaigns")).rows.length, 0);
  assert.equal((await db.query("select id from public.leads")).rows.length, 0);
  await assert.rejects(
    () => db.query(`
      insert into public.funnels (owner_user_id, workspace_id, name)
      values ($1, $2, 'Cross tenant')
    `, [USER_B, WS_A]),
    /row-level security/i,
  );
});

await db.exec("set role service_role");
const lead = await db.query("select id from public.leads where user_id = $1", [USER_A]);
await db.query("insert into public.lead_notes (lead_id, user_id, note) values ($1, $2, 'Private note A')", [lead.rows[0].id, USER_A]);
await db.exec("reset role");

await asUser(USER_A, async () => {
  assert.deepEqual((await db.query("select note from public.lead_notes")).rows, [{ note: "Private note A" }]);
});
await asUser(USER_B, async () => {
  assert.equal((await db.query("select note from public.lead_notes")).rows.length, 0);
});

await db.exec("set role anon");
await assert.rejects(() => db.query("select note from public.lead_notes"), /permission denied/i);
await db.exec("reset role; set role service_role");
const master = await db.query(`
  insert into public.funnels (
    owner_user_id, workspace_id, name, is_master_template,
    template_kind, template_payload, template_source_campaign_id
  ) values ($1, $2, 'Immutable campaign master', true, 'campaign',
    '{"pages":[{"document":{"sections":[{"type":"hero"}]}}]}'::jsonb,
    gen_random_uuid())
  returning id
`, [USER_A, WS_A]);
await assert.rejects(
  () => db.query("update public.funnels set template_payload = '{}'::jsonb where id = $1", [master.rows[0].id]),
  /immutable/i,
);
await db.exec("reset role");

assert.equal((await db.query("select count(*)::int as count from public.funnels where id = $1", [funnel.id])).rows[0].count, 1);
console.log("PASS staging bootstrap applies twice, enables RLS, normalizes grants, isolates builders, protects CRM notes, and keeps campaign masters immutable");
await db.close();
