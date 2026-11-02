import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = fs.readFileSync("supabase/migrations/20261101000200_crm_lead_notes_access.sql", "utf8");
const userA = "a0000000-0000-4000-8000-000000000001";
const userB = "b0000000-0000-4000-8000-000000000002";

await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, anon;
  create table public.lead_notes (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null,
    user_id uuid not null,
    note text not null,
    created_at timestamptz not null default now()
  );
  grant usage on schema public to authenticated, anon, service_role;
  grant select, insert, update, delete on public.lead_notes to public, anon, authenticated, service_role;
  insert into public.lead_notes (lead_id, user_id, note) values
    ('11111111-0000-4000-8000-000000000001', '${userA}', 'Private note A'),
    ('22222222-0000-4000-8000-000000000002', '${userB}', 'Private note B');
`);
await db.exec(migration);
await db.exec(migration);

await db.exec("set role anon");
await assert.rejects(() => db.query("select note from public.lead_notes"), /permission denied/i,
  "anon is denied even when the original table grants were inherited from PUBLIC");

await db.exec("reset role; set role authenticated");
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
assert.deepEqual((await db.query("select note from public.lead_notes order by note")).rows, [{ note: "Private note A" }],
  "builder A sees only notes owned by builder A");
await assert.rejects(
  () => db.query("insert into public.lead_notes (lead_id, user_id, note) values (gen_random_uuid(), $1, 'direct write')", [userA]),
  /permission denied/i,
  "authenticated clients cannot write CRM notes directly",
);

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userB]);
assert.deepEqual((await db.query("select note from public.lead_notes order by note")).rows, [{ note: "Private note B" }],
  "builder B cannot read builder A's notes");

await db.exec("reset role; set role service_role");
await db.query("insert into public.lead_notes (lead_id, user_id, note) values (gen_random_uuid(), $1, 'server-side CRM sync')", [userA]);
assert.equal((await db.query("select count(*)::int as count from public.lead_notes where note = 'server-side CRM sync'")).rows[0].count, 1,
  "server-side CRM note creation remains available");

console.log("PASS CRM note migration is idempotent, blocks anonymous/direct writes, and isolates authenticated reads");
await db.close();
