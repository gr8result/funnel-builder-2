// Applies 20261014000100_landing_page_campaigns.sql to an isolated in-memory Postgres (PGlite) and exercises it.
// Nothing here connects to Supabase. leads / lead_notes / workspaces are minimal stand-ins with the live columns that matter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = fs.readFileSync('supabase/migrations/20261014000100_landing_page_campaigns.sql', 'utf8');
const db = new PGlite();
await db.exec(`
  create role authenticated nologin; create role anon nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text default 'active');
  create table public.leads (id uuid primary key default gen_random_uuid(), user_id uuid not null, workspace_id uuid, name text, email text,
    phone text, source text, lead_source text, tags text, lead_status text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null, user_id uuid not null, note text not null, created_at timestamptz default now());
`);
await db.exec(migration);
await db.exec(migration);
console.log('PASS migration applies twice on a clean database');

const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
const uA = 'a0000000-0000-4000-8000-000000000001', uB = 'b0000000-0000-4000-8000-000000000001';
await db.exec(`insert into workspaces values ('${A}','Dream Homes'),('${B}','Other Builder');
  insert into workspace_members values ('${A}','${uA}','owner','active'),('${B}','${uB}','owner','active');
  insert into leads (id, user_id, workspace_id, name, email, phone, source, lead_source, tags) values
    ('11111111-0000-4000-8000-000000000001','${uA}','${A}','Existing Person','existing@example.com','0400000000','Referral','Referral','vip'),
    ('11111111-0000-4000-8000-000000000002','${uB}','${B}','Other Tenant','dup@example.com',null,'Manual','Manual',null);`);

const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const camp = await one(`insert into landing_campaigns (workspace_id, created_by, name) values ($1,$2,'Build Your Dream Home in 2027') returning id`, [A, uA]);
const page = await one(`insert into landing_pages (workspace_id, campaign_id, created_by, slug, title) values ($1,$2,$3,'dream-home-2027','Dream Home') returning id`, [A, camp.id, uA]);
const ver = await one(`insert into landing_page_versions (workspace_id, page_id, version_no, kind, document) values ($1,$2,1,'publish','{}') returning id`, [A, page.id]);
await db.query(`update landing_pages set published_version_id=$1, status='published' where id=$2`, [ver.id, page.id]);

await assert.rejects(db.query(`insert into landing_pages (workspace_id, campaign_id, created_by, slug) values ($1,$2,$3,'x-other')`, [B, camp.id, uB]), /foreign key/, 'a page cannot attach to another tenant campaign');
await assert.rejects(db.query(`insert into landing_pages (workspace_id, campaign_id, created_by, slug) values ($1,$2,$3,'Bad Slug!')`, [A, camp.id, uA]), /check/);
await assert.rejects(db.query(`insert into landing_pages (workspace_id, campaign_id, created_by, slug) values ($1,$2,$3,'dream-home-2027')`, [A, camp.id, uA]), /unique/);
console.log('PASS pages are tenant-bound to their campaign, slugs are validated and unique');

const sub = async (key, email, fields = {}) => one(`insert into landing_page_submissions (workspace_id, campaign_id, page_id, page_version_id, idempotency_key, name, email, phone, fields, consent, attribution)
  values ($1,$2,$3,$4,$5,'Sam Taylor',$6,'0411222333',$7,true,'{"utm_source":"facebook"}') returning id`, [A, camp.id, page.id, ver.id, key, email, JSON.stringify(fields)]);
const s1 = await sub('key-00000001', 'Sam.Taylor@Example.com', { message: 'Four bedrooms', budget_range: '$600k-$800k' });
await assert.rejects(sub('key-00000001', 'x@example.com'), /unique/, 'idempotency key blocks a duplicate submission');

const lead1 = (await one(`select lp_sync_submission($1) as id`, [s1.id])).id;
const lead1Again = (await one(`select lp_sync_submission($1) as id`, [s1.id])).id;
assert.equal(lead1, lead1Again, 'sync is idempotent');
assert.equal((await one(`select count(*)::int n from lead_notes where lead_id=$1`, [lead1])).n, 1, 'no duplicate note on re-sync');
const newLead = await one(`select * from leads where id=$1`, [lead1]);
assert.equal(newLead.workspace_id, A); assert.equal(newLead.email, 'sam.taylor@example.com'); assert.equal(newLead.user_id, uA);
assert.equal(newLead.lead_source, 'Landing Page: Build Your Dream Home in 2027');
assert.match(newLead.tags, /campaign:build-your-dream-home-in-2027/);
const note = await one(`select note from lead_notes where lead_id=$1`, [lead1]);
assert.match(note.note, /Build Your Dream Home in 2027/); assert.match(note.note, /Budget Range: \$600k-\$800k/); assert.match(note.note, /utm_source/);
const s1row = await one(`select status, lead_id, lead_note_id from landing_page_submissions where id=$1`, [s1.id]);
assert.equal(s1row.status, 'synced'); assert.equal(s1row.lead_id, lead1);
console.log('PASS a new enquirer becomes a CRM lead with campaign source, tags and an enquiry note; re-sync adds nothing');

const s2 = await sub('key-00000002', 'EXISTING@example.com ', { message: 'Second home' });
const lead2 = (await one(`select lp_sync_submission($1) as id`, [s2.id])).id;
assert.equal(lead2, '11111111-0000-4000-8000-000000000001', 'case-insensitive dedupe matches the existing contact');
const existing = await one(`select * from leads where id=$1`, [lead2]);
assert.equal(existing.name, 'Existing Person'); assert.equal(existing.phone, '0400000000'); assert.equal(existing.lead_source, 'Referral', 'original source kept');
assert.match(existing.tags, /^vip,landing-page,campaign:/);
assert.equal((await one(`select count(*)::int n from leads where workspace_id=$1`, [A])).n, 2);
const s3 = await sub('key-00000003', 'dup@example.com');
const lead3 = (await one(`select lp_sync_submission($1) as id`, [s3.id])).id;
assert.notEqual(lead3, '11111111-0000-4000-8000-000000000002', 'same email in another tenant is a different contact');
assert.equal((await one(`select workspace_id from leads where id=$1`, [lead3])).workspace_id, A);
console.log('PASS existing contacts are updated without overwriting details; dedupe never crosses tenants');

// RLS as signed-in users
async function as(user, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  await db.exec('set role authenticated');
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on schema public to authenticated`);
assert.equal((await as(uB, `select id from landing_campaigns`)).rows.length, 0, 'tenant B cannot see tenant A campaigns');
assert.equal((await as(uB, `select id from landing_page_submissions`)).rows.length, 0);
assert.equal((await as(uA, `select id from landing_page_submissions`)).rows.length, 3);
await assert.rejects(as(uB, `insert into landing_campaigns (workspace_id, created_by, name) values ($1,$2,'x')`, [A, uB]), /row-level security/);
await assert.rejects(as(uA, `insert into landing_page_submissions (workspace_id, campaign_id, page_id, idempotency_key, email) values ($1,$2,$3,'forged-0001','a@b.co')`, [A, camp.id, page.id]), /row-level security/, 'clients cannot forge submissions');
await assert.rejects(as(uA, `select lp_sync_submission($1)`, [s1.id]), /permission denied/, 'clients cannot call the CRM sync');
console.log('PASS RLS isolates tenants; submissions and CRM sync are server-only');
const readiness = (await one('select lp_readiness() as result')).result;
assert.equal(readiness.ready, true, JSON.stringify(readiness));
assert.equal(readiness.tables.length, 6);
await assert.rejects(as(uA, 'select lp_readiness()'), /permission denied/);
await db.exec('revoke insert on landing_campaigns from service_role');
assert.equal((await one('select lp_readiness() as result')).result.ready, false);
await db.exec('grant insert on landing_campaigns to service_role');
await db.exec('alter table landing_pages disable row level security');
assert.equal((await one('select lp_readiness() as result')).result.ready, false);
await db.exec('alter table landing_pages enable row level security');
assert.equal((await one('select lp_readiness() as result')).result.ready, true);
const workspaceC = 'cccccccc-0000-4000-8000-000000000003';
const userC = 'c0000000-0000-4000-8000-000000000003';
await db.query('insert into workspaces values ($1,$2)', [workspaceC, 'New Subscriber']);
await db.query("insert into workspace_members values ($1,$2,'owner','active')", [workspaceC, userC]);
const newCampaign = await as(userC, 'insert into landing_campaigns (workspace_id,created_by,name) values ($1,$2,$3) returning id', [workspaceC, userC, 'Spring Promotion']);
assert.equal(newCampaign.rows.length, 1);
assert.equal((await as(uA, 'select id from landing_campaigns where id=$1', [newCampaign.rows[0].id])).rows.length, 0);
console.log('PASS readiness detects missing permissions and disabled RLS; new subscribers need membership only, not individual schema setup');
console.log('\nAll landing page migration checks passed.');
