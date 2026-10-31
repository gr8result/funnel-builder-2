// Isolated, production-shaped database for Email/SMS marketing tests (PGlite, in memory, no network).
// Legacy tables carry exactly the columns found in production by scripts/analyze-marketing-backfill-readonly.mjs
// on 2026-10-15 (only the columns these modules touch are typed precisely; nothing here is real data).
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const MIGRATION = 'supabase/review/central_contacts_migration_draft.sql';
export const BACKFILL = 'supabase/review/central_contacts_backfill_draft.sql';

export const WS = {
  A: 'aaaaaaaa-0000-4000-8000-000000000001',
  B: 'bbbbbbbb-0000-4000-8000-000000000002',
  C: 'cccccccc-0000-4000-8000-000000000003',
};
export const USER = {
  A: 'a0000000-0000-4000-8000-000000000001',      // member of A only
  B: 'b0000000-0000-4000-8000-000000000001',      // member of B only
  MULTI: 'f0000000-0000-4000-8000-000000000001',  // member of A and B (like the production platform owner)
  NONE: 'e0000000-0000-4000-8000-000000000001',   // no active workspace
};
export const LIST = {
  A: '1a000000-0000-4000-8000-000000000001',
  B: '1b000000-0000-4000-8000-000000000001',
  MULTI: '1f000000-0000-4000-8000-000000000001',
};
export const LEAD = {
  A1: '2a000000-0000-4000-8000-000000000001', // unsubscribed_at set, list A
  A2: '2a000000-0000-4000-8000-000000000002', // duplicate email of A3, list A
  A3: '2a000000-0000-4000-8000-000000000003', // duplicate email of A2, list of workspace B (mismatch)
  A4: '2a000000-0000-4000-8000-000000000004', // phone only, list that does not exist
  B1: '2b000000-0000-4000-8000-000000000001', // same email/phone as A2 but another builder
};

const LEGACY_SCHEMA = `
  create role authenticated nologin; create role anon nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  -- Supabase defaults: every new public table, function and sequence is granted to anon/authenticated/service_role,
  -- and access is controlled by RLS and explicit revokes. Reproduce that so revokes and policies are really tested.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create table public.workspaces (id uuid primary key, name text, slug text, plan text, owner_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), is_demo boolean default false);
  create table public.workspace_members (id uuid primary key default gen_random_uuid(), workspace_id uuid, user_id uuid, role text, status text default 'active', invited_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
  grant select on public.workspace_members to authenticated;
  create table public.accounts (id uuid primary key default gen_random_uuid(), user_id uuid, email text, sendgrid_from_email text, sendgrid_from_name text, sendgrid_reply_to text, dkim_domain text, dkim_verified boolean);

  create table public.leads (id uuid primary key default gen_random_uuid(), user_id uuid, pipeline_id uuid, stage text, name text, email text,
    created_at timestamptz not null default now(), updated_at timestamptz default now(), list_id text, phone text, source text, tags text, notes text,
    avatar_icon text, avatar_color text, unsubscribed_at timestamptz, workspace_id uuid, lead_owner_user_id uuid, lead_status text, lead_source text,
    assigned_at timestamptz, company text);
  create table public.lead_lists (id uuid primary key, name text, created_at timestamptz default now(), user_id uuid, pipeline_id uuid);
  create table public.email_lists (id uuid primary key, user_id uuid, name text, created_at timestamptz default now());
  create table public.subscribers (id uuid primary key default gen_random_uuid(), user_id uuid, email text, name text, created_at timestamptz default now(), phone text, list_id uuid);
  create table public.form_submissions (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), list_id uuid, email text, name text, user_id uuid);
  create table public.website_subscribers (id uuid primary key default gen_random_uuid(), account_id uuid, workspace_id uuid, email text, created_at timestamptz default now());
  create table public.bookings (id uuid primary key default gen_random_uuid(), user_id uuid, client_email text, workspace_id uuid, created_at timestamptz default now());

  create table public.email_broadcasts (id uuid primary key default gen_random_uuid(), user_id uuid, title text, subject text, to_field text, html_content text,
    created_at timestamptz default now(), updated_at timestamptz default now(), preheader text, from_name text, from_email text, reply_to text,
    audience_type text, list_id text, saved_email_path text, recipients jsonb, ab_enabled boolean, ab_subject_a text, ab_subject_b text, name text, workspace_id uuid);
  create table public.email_sends (id uuid primary key default gen_random_uuid(), user_id uuid, broadcast_id uuid, email text, status text, sent_at timestamptz,
    open_count integer default 0, first_open_at timestamptz, last_open_at timestamptz, click_count integer default 0, last_click_at timestamptz,
    unsubscribed boolean default false, recipient_email text, email_type text, opened_at timestamptz, clicked_at timestamptz, bounced_at timestamptz,
    unsubscribed_at timestamptz, message_hash text, sg_message_id text, processed_at timestamptz, delivered_at timestamptz, spam_reported boolean default false,
    last_event text, last_event_at timestamptz, send_id text, subscriber_id uuid, created_at timestamptz default now(), sendgrid_message_id text, error_message text,
    ab_enabled boolean, ab_variant text, subject text, broadcast_title text, broadcast_subject text, preheader text, campaigns_id uuid, autoresponder_id uuid,
    automation_id uuid, workspace_id uuid);
  create table public.email_events (id uuid primary key default gen_random_uuid(), owner uuid, contact_id uuid, campaign_id uuid, event text, url text, ts timestamptz, workspace_id uuid);
  create table public.email_campaigns_queue (id uuid primary key default gen_random_uuid(), user_id uuid, campaign_id uuid, lead_id uuid, to_email text, status text, scheduled_at timestamptz);
  create table public.email_suppressions (id uuid primary key default gen_random_uuid(), user_id uuid, email_lower text, reason text, created_at timestamptz default now());
  create table public.sms_queue (id uuid primary key default gen_random_uuid(), user_id uuid, lead_id uuid, to_phone text, body text, status text, workspace_id uuid, created_at timestamptz default now());
  create table public.sms_sent_history (id uuid primary key default gen_random_uuid(), user_id uuid, to_phone text, body text, origin text, status text,
    provider_message_id text, cost numeric, sent_at timestamptz, delivered_at timestamptz, last_error text, campaign_id uuid, created_at timestamptz default now(), workspace_id uuid);
  create table public.sms_delivery_receipts (id uuid primary key default gen_random_uuid(), provider text, provider_id text, "to" text, status text, delivered_at timestamptz, raw jsonb, created_at timestamptz default now());
  create table public.crm_tasks (id uuid primary key default gen_random_uuid(), user_id uuid, contact_id uuid, title text, completed boolean default false, workspace_id uuid, lead_id uuid, status text);
`;

export async function seedLegacyData(pg) {
  const { A, B, C } = WS;
  await pg.exec(`
    insert into auth.users values ('${USER.A}'),('${USER.B}'),('${USER.MULTI}'),('${USER.NONE}');
    insert into workspaces (id, name) values ('${A}','Builder A'),('${B}','Builder B'),('${C}','Builder C');
    insert into workspace_members (workspace_id, user_id, role, status) values
      ('${A}','${USER.A}','owner','active'), ('${B}','${USER.B}','owner','active'),
      ('${A}','${USER.MULTI}','admin','active'), ('${B}','${USER.MULTI}','admin','active'),
      ('${C}','${USER.NONE}','owner','removed');
    insert into accounts (user_id, email, sendgrid_from_email, sendgrid_from_name) values
      ('${USER.A}','owner-a@builder-a.test','news@builder-a.test','Builder A'),
      ('${USER.B}','owner-b@builder-b.test','news@builder-b.test','Builder B');

    -- lead_lists and email_lists share ids in production; reproduce that.
    insert into lead_lists (id, name, user_id) values ('${LIST.A}','A newsletter','${USER.A}'),('${LIST.B}','B newsletter','${USER.B}'),('${LIST.MULTI}','Owner list','${USER.MULTI}');
    insert into email_lists (id, name, user_id) values ('${LIST.A}','A newsletter','${USER.A}'),('${LIST.B}','B newsletter','${USER.B}'),('${LIST.MULTI}','Owner list','${USER.MULTI}');

    insert into leads (id, user_id, workspace_id, name, email, phone, list_id, unsubscribed_at, source, created_at) values
      ('${LEAD.A1}','${USER.A}','${A}','Una Subscribed','una@example.test','0412 000 001','${LIST.A}','2026-05-01T00:00:00Z','Website','2026-01-01T00:00:00Z'),
      ('${LEAD.A2}','${USER.A}','${A}','Sam Shared','Shared@Example.test ','+61 412 000 002','${LIST.A}',null,'Referral','2026-01-02T00:00:00Z'),
      ('${LEAD.A3}','${USER.A}','${A}','Sal Shared','shared@example.test','0412000003','${LIST.B}',null,'Referral','2026-01-03T00:00:00Z'),
      ('${LEAD.A4}','${USER.A}','${A}','Phone Only',null,'0412000004','00000000-0000-4000-8000-00000000dead',null,'Phone','2026-01-04T00:00:00Z'),
      ('${LEAD.B1}','${USER.B}','${B}','Other Builder','shared@example.test','0412 000 002','${LIST.B}',null,'Website','2026-01-05T00:00:00Z');

    insert into crm_tasks (user_id, contact_id, title, workspace_id) values ('${USER.A}','${LEAD.A1}','Call Una','${A}');

    insert into subscribers (user_id, email) values ('${USER.NONE}','nobody@example.test'),('${USER.MULTI}','owner-sub@example.test');
    insert into form_submissions (user_id, email) values (null,'anon@example.test'),('${USER.MULTI}','owner-form@example.test');

    insert into email_broadcasts (id, user_id, subject, html_content, audience_type, list_id) values
      ('3a000000-0000-4000-8000-000000000001','${USER.A}','A legacy','<p>a</p>','list','${LIST.A}'),
      ('3b000000-0000-4000-8000-000000000001','${USER.B}','B legacy','<p>b</p>','list','${LIST.B}'),
      ('3f000000-0000-4000-8000-000000000001','${USER.MULTI}','Owner legacy','<p>o</p>','list','${LIST.MULTI}');

    insert into email_sends (id, user_id, email, recipient_email, status, sendgrid_message_id, unsubscribed, spam_reported, bounced_at, sent_at) values
      ('4a000000-0000-4000-8000-000000000001','${USER.A}','shared@example.test','shared@example.test','sent','sgA1',true,false,null,'2026-06-01T00:00:00Z'),
      ('4a000000-0000-4000-8000-000000000002','${USER.A}','spam@example.test','spam@example.test','sent','sgA2',false,true,null,'2026-06-01T00:00:00Z'),
      ('4a000000-0000-4000-8000-000000000003','${USER.A}','gone@example.test','gone@example.test','sent','sgA3',false,false,'2026-06-02T00:00:00Z','2026-06-01T00:00:00Z'),
      ('4a000000-0000-4000-8000-000000000004','${USER.A}','una@example.test','una@example.test','sent','sgA4',false,false,null,'2026-06-01T00:00:00Z'),
      ('4f000000-0000-4000-8000-000000000001','${USER.MULTI}','owner@example.test','owner@example.test','sent','sgM1',true,false,null,'2026-06-01T00:00:00Z');

    insert into email_campaigns_queue (user_id, to_email, status) values ('${USER.A}','q@example.test','queued'),('${USER.MULTI}','q2@example.test','queued');
    insert into sms_sent_history (user_id, to_phone, status, provider_message_id) values
      ('${USER.A}','61412000002','sent','smsA1'),('${USER.MULTI}','61412000009','sent','smsM1');
  `);
}

export async function createMarketingDb({ applyMigration = true, seed = true } = {}) {
  const pg = new PGlite();
  await pg.exec(LEGACY_SCHEMA);
  if (seed) await seedLegacyData(pg);
  if (applyMigration) await pg.exec(fs.readFileSync(MIGRATION, 'utf8'));
  return { pg, db: createSupabaseAdapter(pg) };
}

export async function applyBackfillDefinitions(pg) {
  await pg.exec(fs.readFileSync(BACKFILL, 'utf8'));
}

// ---- Supabase-shaped adapter covering the calls the Email/SMS handlers make.
const SET_RETURNING = new Set([
  'claim_email_broadcast_delivery', 'eligible_email_marketing_contacts', 'find_contacts_by_normalized_phone',
  'record_sms_opt_out', 'ingest_sms_inbound', 'marketing_backfill_validate',
]);
const IDENT = /^[a-z_][a-z0-9_]*$/;
const qi = (n) => { if (!IDENT.test(n)) throw new Error(`bad identifier ${n}`); return `"${n}"`; };
const out = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(out) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, out(x)])) : v);
const param = (v) => (v && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

export function createSupabaseAdapter(pg) {
  const calls = [];
  function from(table) {
    const s = { op: 'select', cols: '*', filters: [], orders: [], lim: null, mode: null, payload: null, returning: false, onConflict: null, ignoreDuplicates: false };
    const cols = () => (s.cols === '*' ? '*' : s.cols.split(',').map((c) => qi(c.trim())).join(', '));
    const b = {
      select(c = '*') { if (s.op !== 'select') s.returning = true; s.cols = c; return b; },
      insert(rows) { s.op = 'insert'; s.payload = Array.isArray(rows) ? rows : [rows]; return b; },
      upsert(rows, { onConflict, ignoreDuplicates } = {}) { s.op = 'insert'; s.payload = Array.isArray(rows) ? rows : [rows]; s.onConflict = onConflict; s.ignoreDuplicates = ignoreDuplicates; return b; },
      update(p) { s.op = 'update'; s.payload = p; return b; },
      delete() { s.op = 'delete'; return b; },
      eq(c, v) { s.filters.push([c, '=', v]); return b; },
      neq(c, v) { s.filters.push([c, '<>', v]); return b; },
      lte(c, v) { s.filters.push([c, '<=', v]); return b; },
      gte(c, v) { s.filters.push([c, '>=', v]); return b; },
      is(c, v) { s.filters.push([c, 'is', v]); return b; },
      in(c, list) { s.filters.push([c, 'in', list]); return b; },
      order(c, { ascending = true } = {}) { s.orders.push(`${qi(c)} ${ascending ? 'asc' : 'desc'}`); return b; },
      limit(n) { s.lim = n; return b; },
      maybeSingle() { s.mode = 'maybe'; return b; },
      single() { s.mode = 'one'; return b; },
      async run() {
        const params = [];
        const where = () => (s.filters.length ? ' where ' + s.filters.map(([c, op, v]) => {
          if (op === 'is') return `${qi(c)} is ${v === null ? 'null' : v ? 'true' : 'false'}`;
          if (op === 'in') { if (!v.length) return 'false'; return `${qi(c)} in (${v.map((x) => { params.push(x); return `$${params.length}`; }).join(', ')})`; }
          params.push(v); return `${qi(c)} ${op} $${params.length}`;
        }).join(' and ') : '');
        let sql;
        if (s.op === 'select') sql = `select ${cols()} from ${qi(table)}${where()}${s.orders.length ? ` order by ${s.orders.join(', ')}` : ''}${s.lim ? ` limit ${Number(s.lim)}` : ''}`;
        else if (s.op === 'insert') {
          const keys = Object.keys(s.payload[0]);
          const values = s.payload.map((r) => `(${keys.map((k) => { params.push(param(r[k])); return `$${params.length}`; }).join(', ')})`);
          const conflict = s.onConflict ? ` on conflict (${s.onConflict.split(',').map((c) => qi(c.trim())).join(', ')}) do ${s.ignoreDuplicates ? 'nothing' : `update set ${keys.map((k) => `${qi(k)} = excluded.${qi(k)}`).join(', ')}`}` : '';
          sql = `insert into ${qi(table)} (${keys.map(qi).join(', ')}) values ${values.join(', ')}${conflict}${s.returning ? ` returning ${cols()}` : ''}`;
        } else if (s.op === 'update') {
          const sets = Object.entries(s.payload).map(([k, v]) => { params.push(param(v)); return `${qi(k)} = $${params.length}`; });
          sql = `update ${qi(table)} set ${sets.join(', ')}${where()}${s.returning ? ` returning ${cols()}` : ''}`;
        } else sql = `delete from ${qi(table)}${where()}`;
        calls.push({ table, op: s.op });
        try {
          const { rows } = await pg.query(sql, params);
          const data = out(rows);
          if (s.mode === 'one') return rows.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: `expected one row, got ${rows.length}` } };
          if (s.mode === 'maybe') return rows.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: data[0] || null, error: null };
          return { data, error: null };
        } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
      },
      then(res, rej) { return b.run().then(res, rej); },
    };
    return b;
  }
  return {
    calls,
    from,
    async rpc(name, args = {}) {
      calls.push({ rpc: name });
      const keys = Object.keys(args);
      const call = `${qi(name)}(${keys.map((k, i) => `${qi(k)} => $${i + 1}`).join(', ')})`;
      try {
        const { rows } = await pg.query(SET_RETURNING.has(name) ? `select * from ${call}` : `select ${call} as result`, keys.map((k) => param(args[k])));
        return { data: SET_RETURNING.has(name) ? out(rows) : out(rows[0]?.result), error: null };
      } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    },
  };
}

export async function asUser(pg, user, sql, params = []) {
  await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  await pg.exec('set role authenticated');
  try { return await pg.query(sql, params); } finally { await pg.exec('reset role'); }
}
