-- REVIEW DRAFT ONLY. Do not run until schema/ownership review and a separately approved backfill plan.
-- Additive contact foundation. No records are inserted, updated, merged, or deleted here.
-- Tenant scope is workspace_id. The app must not switch reads/writes until legacy rows are reconciled.
-- Single consent model (consolidated 2026-10-15): contact_consent_events is the only source of truth.
-- The lead-row columns from legacy_lead_marketing_consent_proposal.sql are included below as a
-- deny-by-default projection that the existing email/SMS senders read; a trigger keeps them in step.
-- Do not apply the legacy proposal separately.

begin;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  company text,
  source text,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_workspace_id_id_unique unique (workspace_id, id)
);

create index if not exists contacts_workspace_email_lookup_idx
  on public.contacts (workspace_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create index if not exists contacts_workspace_phone_lookup_idx
  on public.contacts (workspace_id, regexp_replace(phone, '\D', '', 'g'))
  where phone is not null and btrim(phone) <> '';

-- Maps each legacy record to a permanent contact without replacing source rows.
create table if not exists public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  contact_id uuid not null,
  source_table text not null,
  source_record_key text not null,
  source_name text,
  original_created_at timestamptz,
  linked_at timestamptz not null default now(),
  constraint contact_sources_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id) on delete restrict,
  constraint contact_sources_source_record_unique
    unique (workspace_id, source_table, source_record_key)
);
create index if not exists contact_sources_contact_idx
  on public.contact_sources (workspace_id, contact_id);

-- List membership is separate from contact identity and has no automatic consent default.
create table if not exists public.contact_list_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  contact_id uuid not null,
  source_list_table text not null check (source_list_table in ('email_lists', 'lead_lists')),
  source_list_id text not null,
  purpose text not null check (purpose in ('marketing', 'transactional')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'unsubscribed', 'bounced', 'suppressed')),
  lawful_basis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_list_memberships_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id) on delete restrict,
  constraint contact_list_memberships_marketing_basis_check
    check (purpose <> 'marketing' or status <> 'active' or lawful_basis is not null),
  constraint contact_list_memberships_unique
    unique (workspace_id, contact_id, source_list_table, source_list_id)
);
create index if not exists contact_list_memberships_list_idx
  on public.contact_list_memberships (workspace_id, source_list_table, source_list_id, status);

-- Append-only consent and withdrawal evidence. Unsubscribe never deletes the contact.
create table if not exists public.contact_consent_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  contact_id uuid not null,
  channel text not null check (channel in ('email', 'sms', 'phone', 'other')),
  event_type text not null check (event_type in ('granted', 'withdrawn', 'unsubscribed', 'lawful_basis_recorded')),
  lawful_basis text,
  source text,
  evidence_ref text,
  provider_event_id text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint contact_consent_events_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id) on delete restrict
);
create index if not exists contact_consent_events_contact_idx
  on public.contact_consent_events (workspace_id, contact_id, channel, occurred_at desc);
create unique index if not exists contact_consent_events_provider_event_uidx
  on public.contact_consent_events (workspace_id, provider_event_id);

-- Persisted broadcast state; delivery rows are unique per workspace, broadcast, and contact.
alter table public.email_broadcasts
  add column if not exists status text not null default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists audience_list_table text;
alter table public.email_broadcasts
  add constraint email_broadcasts_status_check
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'));
alter table public.email_broadcasts
  add constraint email_broadcasts_scheduled_time_check
    check (status <> 'scheduled' or scheduled_at is not null);
create unique index if not exists email_broadcasts_workspace_id_id_uidx
  on public.email_broadcasts (workspace_id, id);
create index if not exists email_broadcasts_due_idx
  on public.email_broadcasts (scheduled_at, id)
  where status = 'scheduled';

create table if not exists public.email_broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  broadcast_id uuid not null,
  contact_id uuid not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'suppressed', 'failed', 'unknown', 'cancelled')),
  attempt_count integer not null default 0,
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  sent_at timestamptz,
  finished_at timestamptz,
  suppressed_at timestamptz,
  unknown_at timestamptz,
  cancelled_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  constraint email_broadcast_deliveries_broadcast_workspace_fkey
    foreign key (workspace_id, broadcast_id)
    references public.email_broadcasts(workspace_id, id) on delete restrict,
  constraint email_broadcast_deliveries_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id) on delete restrict,
  constraint email_broadcast_deliveries_workspace_id_id_unique unique (workspace_id, id),
  constraint email_broadcast_deliveries_unique
    unique (workspace_id, broadcast_id, contact_id),
  constraint email_broadcast_deliveries_attempt_count_check
    check (attempt_count between 0 and 1000)
);
create index if not exists email_broadcast_deliveries_due_idx
  on public.email_broadcast_deliveries (scheduled_at, id)
  where status = 'pending';

create table if not exists public.email_broadcast_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  delivery_id uuid not null,
  email_send_id uuid references public.email_sends(id) on delete set null,
  attempt_number integer not null,
  claim_token uuid not null,
  status text not null check (status in ('sending', 'sent', 'suppressed', 'failed', 'unknown', 'cancelled')),
  started_at timestamptz not null,
  finished_at timestamptz,
  provider_message_id text,
  error_message text,
  constraint email_broadcast_attempt_delivery_workspace_fkey
    foreign key (workspace_id, delivery_id)
    references public.email_broadcast_deliveries(workspace_id, id) on delete restrict,
  constraint email_broadcast_attempts_delivery_attempt_unique
    unique (delivery_id, attempt_number)
);

alter table public.email_sends add column if not exists contact_id uuid;
alter table public.email_sends add column if not exists broadcast_delivery_id uuid references public.email_broadcast_deliveries(id) on delete set null;
create unique index if not exists email_sends_broadcast_delivery_uidx
  on public.email_sends (broadcast_delivery_id)
  where broadcast_delivery_id is not null;

-- Keep existing lead IDs for compatibility while introducing the central identity link.
alter table if exists public.email_campaigns_queue
  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict,
  add column if not exists contact_id uuid;

alter table if exists public.sms_queue add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;

-- Existing receipt rows remain intact; unlinked callbacks can be reconciled after contact backfill.
alter table public.sms_delivery_receipts
  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict,
  add column if not exists contact_id uuid,
  add column if not exists campaign_id uuid,
  add column if not exists sms_sent_history_id uuid references public.sms_sent_history(id) on delete set null,
  add column if not exists provider_event_id text,
  add column if not exists event_hash text,
  add column if not exists association_status text not null default 'pending_match';
create unique index if not exists sms_delivery_receipts_provider_event_uidx
  on public.sms_delivery_receipts (provider, event_hash);

-- Scope inbound SMS routing explicitly; existing user-only rows must be mapped before webhook activation.
alter table if exists public.telephony_numbers
  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;

-- One active workspace per inbound number. Rows are added deliberately from reviewed telephony_numbers mappings.
create table if not exists public.sms_inbound_numbers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  provider text not null default 'smsglobal',
  phone_e164 text not null check (phone_e164 ~ '^[0-9]{8,15}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists sms_inbound_numbers_active_uidx
  on public.sms_inbound_numbers (provider, phone_e164)
  where active;

-- Durable inbound SMS inbox. Every callback is stored (one row per provider event) before it is acted on,
-- so a STOP is never lost even when the number is not yet mapped to a builder.
create table if not exists public.sms_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'smsglobal',
  provider_message_id text,
  event_hash text not null,
  from_phone text not null,
  to_phone text not null,
  body text,
  keyword text check (keyword in ('STOP', 'START')),
  received_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  workspace_id uuid references public.workspaces(id) on delete restrict,
  status text not null default 'received'
    check (status in ('received', 'processed', 'unmapped', 'ignored', 'resolved')),
  processed_at timestamptz,
  resolution_note text,
  constraint sms_inbound_events_provider_event_unique unique (provider, event_hash)
);
create index if not exists sms_inbound_events_stop_hold_idx
  on public.sms_inbound_events (from_phone, workspace_id)
  where keyword = 'STOP';

-- SendGrid Event Webhook ledger. sg_event_id makes redeliveries idempotent.
create table if not exists public.email_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'sendgrid',
  provider_event_id text not null,
  event_type text not null,
  bounce_type text,
  provider_message_id text,
  email_lower text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  workspace_id uuid references public.workspaces(id) on delete restrict,
  contact_id uuid,
  email_send_id uuid references public.email_sends(id) on delete set null,
  association_status text not null
    check (association_status in ('matched', 'workspace_only', 'unresolved', 'conflict')),
  payload jsonb not null,
  constraint email_provider_events_unique unique (provider, provider_event_id)
);
create index if not exists email_provider_events_workspace_idx
  on public.email_provider_events (workspace_id, occurred_at desc);

-- email_suppressions already exists in production (id, user_id, email_lower, reason, created_at; 0 rows).
-- Scope it to the workspace and record the evidence behind each suppression.
alter table public.email_suppressions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict,
  add column if not exists source text,
  add column if not exists provider_event_id text,
  add column if not exists suppressed_at timestamptz;
create unique index if not exists email_suppressions_workspace_email_reason_uidx
  on public.email_suppressions (workspace_id, email_lower, reason)
  where workspace_id is not null;

create or replace function public.claim_email_broadcast_delivery(p_delivery_id uuid, p_claim_token uuid)
returns setof public.email_broadcast_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  target_broadcast_id uuid;
  target_workspace_id uuid;
  broadcast_status text;
  broadcast_schedule timestamptz;
  claimed public.email_broadcast_deliveries;
begin
  select d.broadcast_id, d.workspace_id
    into target_broadcast_id, target_workspace_id
    from public.email_broadcast_deliveries d
    where d.id = p_delivery_id;
  if not found then return; end if;

  select b.status, b.scheduled_at
    into broadcast_status, broadcast_schedule
    from public.email_broadcasts b
    where b.id = target_broadcast_id and b.workspace_id = target_workspace_id
    for update;
  if not found or broadcast_status <> 'scheduled' or broadcast_schedule > now() then return; end if;

  update public.email_broadcast_deliveries d
    set status = 'sending', claim_token = p_claim_token,
        claimed_at = now(), claim_expires_at = now() + interval '10 minutes',
        attempt_count = attempt_count + 1
    where d.id = p_delivery_id and d.status = 'pending' and d.scheduled_at <= now()
    returning d.* into claimed;
  if not found then return; end if;
  return next claimed;
end;
$$;
revoke all on function public.claim_email_broadcast_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_email_broadcast_delivery(uuid, uuid) to service_role;

create or replace function public.cancel_email_broadcast(p_workspace_id uuid, p_broadcast_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  perform 1 from public.email_broadcasts b
    where b.id = p_broadcast_id and b.workspace_id = p_workspace_id
      and b.user_id = p_user_id and b.status = 'scheduled'
    for update;
  if not found then return -1; end if;

  if exists (select 1 from public.email_broadcast_deliveries d
    where d.workspace_id = p_workspace_id and d.broadcast_id = p_broadcast_id and d.status = 'sending') then
    return -2;
  end if;

  update public.email_broadcasts
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = p_broadcast_id and workspace_id = p_workspace_id and user_id = p_user_id;
  update public.email_broadcast_deliveries
    set status = 'cancelled', cancelled_at = now(), finished_at = now()
    where workspace_id = p_workspace_id and broadcast_id = p_broadcast_id and status = 'pending';
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.cancel_email_broadcast(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_email_broadcast(uuid, uuid, uuid) to service_role;

create or replace function public.finalize_email_broadcast(p_workspace_id uuid, p_broadcast_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if exists (select 1 from public.email_broadcast_deliveries d where d.workspace_id = p_workspace_id and d.broadcast_id = p_broadcast_id and d.status in ('pending', 'sending')) then
    return 'scheduled';
  end if;
  select case when exists (
    select 1 from public.email_broadcast_deliveries d
    where d.workspace_id = p_workspace_id and d.broadcast_id = p_broadcast_id and d.status in ('failed', 'unknown')
  ) then 'failed' else 'sent' end into next_status;
  update public.email_broadcasts b
    set status = next_status, sent_at = case when next_status = 'sent' then now() else sent_at end, updated_at = now()
    where b.id = p_broadcast_id and b.workspace_id = p_workspace_id and b.status = 'scheduled';
  return next_status;
end;
$$;
revoke all on function public.finalize_email_broadcast(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_email_broadcast(uuid, uuid) to service_role;

create or replace function public.complete_email_broadcast_delivery(
  p_delivery_id uuid,
  p_workspace_id uuid,
  p_claim_token uuid,
  p_attempt_id uuid,
  p_email_send_id uuid,
  p_status text,
  p_provider_message_id text,
  p_error text,
  p_finished_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_broadcast_id uuid;
begin
  if p_status not in ('sent', 'suppressed', 'failed', 'unknown', 'cancelled') then
    raise exception 'Invalid terminal delivery status';
  end if;

  update public.email_broadcast_deliveries d
    set status = p_status,
        finished_at = p_finished_at,
        sent_at = case when p_status = 'sent' then p_finished_at else sent_at end,
        suppressed_at = case when p_status = 'suppressed' then p_finished_at else suppressed_at end,
        unknown_at = case when p_status = 'unknown' then p_finished_at else unknown_at end,
        cancelled_at = case when p_status = 'cancelled' then p_finished_at else cancelled_at end,
        provider_message_id = p_provider_message_id,
        last_error = p_error
    where d.id = p_delivery_id and d.workspace_id = p_workspace_id
      and d.claim_token = p_claim_token and d.status = 'sending'
    returning d.broadcast_id into target_broadcast_id;
  if not found then return false; end if;

  if p_attempt_id is not null then
    update public.email_broadcast_delivery_attempts
      set status = p_status, finished_at = p_finished_at,
          provider_message_id = p_provider_message_id, error_message = p_error
      where id = p_attempt_id and workspace_id = p_workspace_id and claim_token = p_claim_token;
  end if;
  if p_email_send_id is not null then
    update public.email_sends
      set status = p_status, error_message = p_error, processed_at = p_finished_at,
          sent_at = case when p_status = 'sent' then p_finished_at else sent_at end,
          sendgrid_message_id = p_provider_message_id
      where id = p_email_send_id and workspace_id = p_workspace_id and broadcast_delivery_id = p_delivery_id;
  end if;
  return true;
end;
$$;
revoke all on function public.complete_email_broadcast_delivery(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_email_broadcast_delivery(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;

create or replace function public.expire_stale_email_broadcast_claims()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired record;
  changed integer;
begin
  changed := 0;
  for expired in
    update public.email_broadcast_deliveries d
      set status = 'unknown', unknown_at = now(), finished_at = now(),
          last_error = 'Worker lease expired; provider outcome requires reconciliation.'
      where d.status = 'sending' and d.claim_expires_at <= now()
      returning d.id, d.workspace_id, d.claim_token
  loop
    update public.email_broadcast_delivery_attempts a
      set status = 'unknown', finished_at = now(),
          error_message = 'Worker lease expired; provider outcome requires reconciliation.'
      where a.workspace_id = expired.workspace_id and a.claim_token = expired.claim_token;
    update public.email_sends s
      set status = 'unknown', processed_at = now(),
          error_message = 'Worker lease expired; provider outcome requires reconciliation.'
      where s.broadcast_delivery_id = expired.id and s.workspace_id = expired.workspace_id
        and s.status = 'processing';
    changed := changed + 1;
  end loop;

  update public.email_broadcasts b
    set status = case when exists (
      select 1 from public.email_broadcast_deliveries d
      where d.workspace_id = b.workspace_id and d.broadcast_id = b.id and d.status in ('failed', 'unknown')
    ) then 'failed' else 'sent' end,
    sent_at = case when exists (
      select 1 from public.email_broadcast_deliveries d
      where d.workspace_id = b.workspace_id and d.broadcast_id = b.id and d.status in ('failed', 'unknown')
    ) then b.sent_at else now() end,
    updated_at = now()
    where b.status = 'scheduled'
      and not exists (select 1 from public.email_broadcast_deliveries d
        where d.workspace_id = b.workspace_id and d.broadcast_id = b.id and d.status in ('pending', 'sending'));
  return changed;
end;
$$;
revoke all on function public.expire_stale_email_broadcast_claims() from public, anon, authenticated;
grant execute on function public.expire_stale_email_broadcast_claims() to service_role;

create or replace function public.find_contacts_by_normalized_phone(p_workspace_id uuid, p_phone text)
returns table (contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select regexp_replace(p_phone, '\D', '', 'g') as digits
  )
  select c.id
  from public.contacts c, input i
  where c.workspace_id = p_workspace_id
    and c.phone is not null
    and (
        regexp_replace(c.phone, '\D', '', 'g') = i.digits
        or (left(regexp_replace(c.phone, '\D', '', 'g'), 1) = '0'
          and '61' || substring(regexp_replace(c.phone, '\D', '', 'g') from 2) = i.digits)
    );
$$;
revoke all on function public.find_contacts_by_normalized_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.find_contacts_by_normalized_phone(uuid, text) to service_role;

-- One permission rule for every reader (eligibility, consent check, lead projection, scheduler mirror):
-- the latest email/SMS event must be a grant with a lawful basis, and if the contact has EVER opted out,
-- a provider-verified opt-in (source 'provider:%optin', e.g. the recipient replying START) must postdate
-- the last opt-out. A builder-entered grant can never lift an unsubscribe, spam complaint or STOP.
create or replace function public.marketing_permission_granted(p_workspace_id uuid, p_contact_id uuid, p_channel text)
returns boolean
language sql stable security definer set search_path = public
as $$
  with ev as (
    select e.id, e.event_type, e.lawful_basis, e.source, e.occurred_at, e.recorded_at
    from public.contact_consent_events e
    where e.workspace_id = p_workspace_id and e.contact_id = p_contact_id and e.channel = p_channel
      and e.event_type in ('granted', 'withdrawn', 'unsubscribed')
  ),
  last_out as (select max(occurred_at) as out_at from ev where event_type <> 'granted'),
  latest as (select * from ev order by occurred_at desc, recorded_at desc, id desc limit 1)
  select coalesce((
    select l.event_type = 'granted'
      and nullif(btrim(l.lawful_basis), '') is not null
      and (
        (select out_at from last_out) is null
        or exists (select 1 from ev v where v.event_type = 'granted' and v.source like 'provider:%optin'
                     and v.occurred_at > (select out_at from last_out))
      )
    from latest l
  ), false);
$$;
revoke all on function public.marketing_permission_granted(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.marketing_permission_granted(uuid, uuid, text) to service_role;

create or replace function public.eligible_email_marketing_contacts(
  p_workspace_id uuid,
  p_list_table text,
  p_list_id text
)
returns table (contact_id uuid)
language sql stable security definer set search_path = public
as $$
  select m.contact_id
  from public.contact_list_memberships m
  join public.contacts c
    on c.id = m.contact_id and c.workspace_id = m.workspace_id
  where m.workspace_id = p_workspace_id
    and m.source_list_table = p_list_table
    and m.source_list_id = p_list_id
    and m.status = 'active'
    and m.purpose = 'marketing'
    and nullif(btrim(m.lawful_basis), '') is not null
    and c.is_demo = false
    and nullif(btrim(c.email), '') is not null
    and public.marketing_permission_granted(m.workspace_id, m.contact_id, 'email')
    and not exists (
      select 1 from public.email_suppressions s
      where s.workspace_id = m.workspace_id and s.email_lower = lower(btrim(c.email))
    );
$$;
revoke all on function public.eligible_email_marketing_contacts(uuid, text, text) from public, anon, authenticated;
grant execute on function public.eligible_email_marketing_contacts(uuid, text, text) to service_role;

create or replace function public.has_current_marketing_consent(p_workspace_id uuid, p_contact_id uuid, p_channel text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.contacts c
    where c.id = p_contact_id
      and c.workspace_id = p_workspace_id
      and c.is_demo = false
      and p_channel in ('email', 'sms')
      and public.marketing_permission_granted(p_workspace_id, p_contact_id, p_channel)
      and case p_channel
        when 'email' then nullif(btrim(c.email), '') is not null
          and not exists (select 1 from public.email_suppressions s
            where s.workspace_id = p_workspace_id and s.email_lower = lower(btrim(c.email)))
        when 'sms' then nullif(btrim(c.phone), '') is not null
        else false
      end
  );
$$;
revoke all on function public.has_current_marketing_consent(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.has_current_marketing_consent(uuid, uuid, text) to service_role;

-- Workspace assignment is explicitly backfilled; do not infer it from ambiguous user IDs.
alter table if exists public.subscribers add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table if exists public.form_submissions add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table if exists public.gantt_contacts add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table if exists public.email_lists add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table if exists public.lead_lists add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table if exists public.sms_messages add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table public.email_campaigns_queue add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table public.sms_queue add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table public.sms_delivery_receipts add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;

-- Saved SMS campaign drafts and their queue association.
create table if not exists public.sms_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  audience_type text not null check (audience_type in ('lead', 'list')),
  lead_id text,
  list_id text,
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 3),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'queued', 'cancelled', 'sent', 'failed')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_marketing_campaigns_workspace_id_id_unique unique (workspace_id, id),
  constraint sms_marketing_campaigns_audience_check check (
    (audience_type = 'lead' and lead_id is not null and list_id is null)
    or (audience_type = 'list' and list_id is not null and lead_id is null)
  )
);
create index if not exists sms_marketing_campaigns_workspace_created_idx
  on public.sms_marketing_campaigns (workspace_id, created_at desc);

alter table public.sms_marketing_campaigns enable row level security;
revoke all on public.sms_marketing_campaigns from anon;
grant select, insert, update, delete on public.sms_marketing_campaigns to authenticated;

drop policy if exists sms_marketing_campaigns_workspace_select on public.sms_marketing_campaigns;
create policy sms_marketing_campaigns_workspace_select on public.sms_marketing_campaigns
  for select to authenticated using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = sms_marketing_campaigns.workspace_id
      and wm.user_id = auth.uid() and wm.status = 'active'
  ));
drop policy if exists sms_marketing_campaigns_workspace_insert on public.sms_marketing_campaigns;
create policy sms_marketing_campaigns_workspace_insert on public.sms_marketing_campaigns
  for insert to authenticated with check (user_id = auth.uid() and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = sms_marketing_campaigns.workspace_id
      and wm.user_id = auth.uid() and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'marketing')
  ));
drop policy if exists sms_marketing_campaigns_workspace_update on public.sms_marketing_campaigns;
create policy sms_marketing_campaigns_workspace_update on public.sms_marketing_campaigns
  for update to authenticated using (user_id = auth.uid() and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = sms_marketing_campaigns.workspace_id
      and wm.user_id = auth.uid() and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'marketing')
  )) with check (user_id = auth.uid() and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = sms_marketing_campaigns.workspace_id
      and wm.user_id = auth.uid() and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'marketing')
  ));
drop policy if exists sms_marketing_campaigns_workspace_delete on public.sms_marketing_campaigns;
create policy sms_marketing_campaigns_workspace_delete on public.sms_marketing_campaigns
  for delete to authenticated using (user_id = auth.uid() and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = sms_marketing_campaigns.workspace_id
      and wm.user_id = auth.uid() and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'marketing')
  ));

alter table public.sms_queue add column if not exists campaign_id uuid;
alter table public.sms_sent_history add column if not exists campaign_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sms_queue_campaign_workspace_fkey') then
    alter table public.sms_queue add constraint sms_queue_campaign_workspace_fkey
      foreign key (workspace_id, campaign_id)
      references public.sms_marketing_campaigns(workspace_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sms_sent_history_campaign_workspace_fkey') then
    alter table public.sms_sent_history add constraint sms_sent_history_campaign_workspace_fkey
      foreign key (workspace_id, campaign_id)
      references public.sms_marketing_campaigns(workspace_id, id) on delete restrict not valid;
  end if;
end;
$$;

create or replace function public.cancel_sms_marketing_campaign(
  p_workspace_id uuid,
  p_campaign_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  campaign_status text;
  cancelled_rows integer := 0;
begin
  select c.status into campaign_status
  from public.sms_marketing_campaigns c
  where c.workspace_id = p_workspace_id and c.id = p_campaign_id and c.user_id = p_user_id
  for update;
  if not found then return -1; end if;
  if campaign_status not in ('draft', 'scheduled', 'queued') then return -2; end if;

  perform q.id from public.sms_queue q
    where q.workspace_id = p_workspace_id and q.campaign_id = p_campaign_id
    order by q.id for update;
  if exists (
    select 1 from public.sms_queue q
    where q.workspace_id = p_workspace_id and q.campaign_id = p_campaign_id
      and q.status in ('pending', 'processing')
  ) then return -2; end if;

  delete from public.sms_queue q
    where q.workspace_id = p_workspace_id and q.campaign_id = p_campaign_id
      and q.status in ('queued', 'pending');
  get diagnostics cancelled_rows = row_count;

  update public.sms_marketing_campaigns
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where workspace_id = p_workspace_id and id = p_campaign_id and user_id = p_user_id;
  return cancelled_rows;
end;
$$;
revoke all on function public.cancel_sms_marketing_campaign(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_sms_marketing_campaign(uuid, uuid, uuid) to service_role;

-- Nullable references permit additive rollout. Every contact link is tenant-composite.
-- crm_tasks is deliberately excluded: its existing contact_id holds LEAD ids (35 of 40 rows, read-only check
-- 2026-10-15); a contacts FK would make those rows fail on their next update. CRM owns that column.
-- projects is deliberately excluded here: its row count is queryable, but its columns are not
-- exposed in current PostgREST metadata. Add its reference only after direct schema inspection.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'leads', 'subscribers', 'website_subscribers', 'form_submissions', 'bookings',
    'sms_sent_history', 'sms_messages', 'gantt_contacts', 'email_sends',
    'email_campaigns_queue', 'sms_queue', 'sms_delivery_receipts'
  ] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = target_table and c.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I add column if not exists contact_id uuid', target_table);
      if not exists (
        select 1 from pg_constraint
        where conrelid = to_regclass(format('public.%I', target_table))
          and conname = target_table || '_contact_workspace_fkey'
      ) then
        execute format(
          'alter table public.%I add constraint %I foreign key (workspace_id, contact_id) references public.contacts(workspace_id, id) on delete restrict not valid',
          target_table, target_table || '_contact_workspace_fkey'
        );
      end if;
    end if;
  end loop;
end $$;

-- Lead-row consent projection (merged from legacy_lead_marketing_consent_proposal.sql).
-- Every flag defaults to "no permission". Only the trigger and record_sms_opt_out write them;
-- the existing senders (send-broadcast, autoresponders, automations, SMS queue/single/sequence) read them.
alter table public.leads
  add column if not exists email_marketing_consent boolean not null default false,
  add column if not exists email_marketing_consent_at timestamptz,
  add column if not exists email_marketing_consent_source text,
  add column if not exists email_marketing_opt_out boolean not null default false,
  add column if not exists email_marketing_opt_out_at timestamptz,
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_marketing_consent_source text,
  add column if not exists sms_marketing_opt_out boolean not null default false,
  add column if not exists sms_marketing_opt_out_at timestamptz,
  add column if not exists sms_opt_out boolean not null default false;

create index if not exists leads_workspace_email_marketing_consent_idx
  on public.leads (workspace_id, email)
  where email_marketing_consent = true and email_marketing_opt_out = false;
create index if not exists leads_workspace_sms_marketing_consent_idx
  on public.leads (workspace_id, id)
  where sms_marketing_consent = true and sms_marketing_opt_out = false;

-- Mirrors normalizeAustralianPhone in lib/smsglobal/webhookSecurity.mjs.
create or replace function public.normalize_au_phone_digits(p_phone text)
returns text
language plpgsql immutable
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if left(digits, 2) = '00' then digits := substring(digits from 3); end if;
  if left(digits, 1) = '0' and length(digits) >= 9 then
    digits := '61' || substring(digits from 2);
  elsif left(digits, 3) = '610' and length(digits) >= 12 then
    digits := '61' || substring(digits from 4);
  end if;
  return digits;
end;
$$;

-- Projects the contact's current permission (marketing_permission_granted) onto its linked lead rows,
-- which the existing senders read. Recomputed from full history, so out-of-order events cannot flip it.
create or replace function public.project_consent_event_to_leads()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  permitted boolean;
  opted_out boolean;
begin
  if new.channel not in ('email', 'sms') or new.event_type not in ('granted', 'withdrawn', 'unsubscribed') then
    return new;
  end if;
  permitted := public.marketing_permission_granted(new.workspace_id, new.contact_id, new.channel);
  opted_out := not permitted and exists (
    select 1 from public.contact_consent_events e
    where e.workspace_id = new.workspace_id and e.contact_id = new.contact_id
      and e.channel = new.channel and e.event_type in ('withdrawn', 'unsubscribed')
  );

  update public.leads l set
    email_marketing_consent = case when new.channel = 'email' then permitted else l.email_marketing_consent end,
    email_marketing_consent_at = case when new.channel = 'email' and permitted then new.occurred_at
      when new.channel = 'email' then null else l.email_marketing_consent_at end,
    email_marketing_consent_source = case when new.channel = 'email' and permitted then coalesce(new.source, 'contact_consent_events')
      when new.channel = 'email' then null else l.email_marketing_consent_source end,
    email_marketing_opt_out = case when new.channel = 'email' then opted_out else l.email_marketing_opt_out end,
    email_marketing_opt_out_at = case when new.channel = 'email' and opted_out then coalesce(l.email_marketing_opt_out_at, new.occurred_at)
      when new.channel = 'email' then null else l.email_marketing_opt_out_at end,
    sms_marketing_consent = case when new.channel = 'sms' then permitted else l.sms_marketing_consent end,
    sms_marketing_consent_at = case when new.channel = 'sms' and permitted then new.occurred_at
      when new.channel = 'sms' then null else l.sms_marketing_consent_at end,
    sms_marketing_consent_source = case when new.channel = 'sms' and permitted then coalesce(new.source, 'contact_consent_events')
      when new.channel = 'sms' then null else l.sms_marketing_consent_source end,
    sms_marketing_opt_out = case when new.channel = 'sms' then opted_out else l.sms_marketing_opt_out end,
    sms_marketing_opt_out_at = case when new.channel = 'sms' and opted_out then coalesce(l.sms_marketing_opt_out_at, new.occurred_at)
      when new.channel = 'sms' then null else l.sms_marketing_opt_out_at end,
    sms_opt_out = case when new.channel = 'sms' then opted_out else l.sms_opt_out end
  where l.workspace_id = new.workspace_id
    and (
      l.contact_id = new.contact_id
      or exists (
        select 1 from public.contact_sources s
        where s.workspace_id = new.workspace_id and s.contact_id = new.contact_id
          and s.source_table = 'leads' and s.source_record_key = l.id::text
      )
    );
  return new;
end;
$$;
drop trigger if exists contact_consent_events_project_to_leads on public.contact_consent_events;
create trigger contact_consent_events_project_to_leads
  after insert on public.contact_consent_events
  for each row execute function public.project_consent_event_to_leads();

-- Atomic SMS opt-out for one workspace: consent events for matching contacts, plus the
-- workspace's lead rows with the same number (covers leads not yet linked to a contact).
-- leads has only a phone column in production (no mobile); verified read-only 2026-10-15.
create or replace function public.record_sms_opt_out(
  p_workspace_id uuid,
  p_phone text,
  p_provider_event_id text,
  p_occurred_at timestamptz,
  p_source text default 'provider:smsglobal-stop'
)
returns table (contacts_opted_out integer, leads_opted_out integer)
language plpgsql security definer set search_path = public
as $$
declare
  digits text := public.normalize_au_phone_digits(p_phone);
  contact_rows integer := 0;
  lead_rows integer := 0;
begin
  if p_workspace_id is null or length(digits) < 8 or nullif(btrim(p_provider_event_id), '') is null then
    raise exception 'record_sms_opt_out requires a workspace, a phone number and a provider event id';
  end if;

  insert into public.contact_consent_events
    (workspace_id, contact_id, channel, event_type, source, evidence_ref, provider_event_id, occurred_at)
  select p_workspace_id, f.contact_id, 'sms', 'unsubscribed', p_source, p_provider_event_id,
         p_provider_event_id || ':' || f.contact_id, coalesce(p_occurred_at, now())
  from (select distinct contact_id from public.find_contacts_by_normalized_phone(p_workspace_id, digits)) f
  on conflict (workspace_id, provider_event_id) do nothing;
  get diagnostics contact_rows = row_count;

  update public.leads l
    set sms_opt_out = true,
        sms_marketing_opt_out = true,
        sms_marketing_opt_out_at = coalesce(l.sms_marketing_opt_out_at, p_occurred_at, now())
    where l.workspace_id = p_workspace_id
      and public.normalize_au_phone_digits(l.phone) = digits;
  get diagnostics lead_rows = row_count;

  return query select contact_rows, lead_rows;
end;
$$;
revoke all on function public.record_sms_opt_out(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_sms_opt_out(uuid, text, text, timestamptz, text) to service_role;

-- One atomic call per SMSGlobal inbound callback: store, map, act. Idempotent per provider event.
-- STOP on a mapped number -> record_sms_opt_out. STOP on an unmapped number stays 'unmapped' and blocks
-- marketing SMS to that phone from EVERY workspace until an operator resolves it (see is_sms_marketing_blocked).
-- START on a mapped number -> provider-verified opt-in for matching contacts (the only way to lift a STOP).
create or replace function public.ingest_sms_inbound(
  p_provider text,
  p_provider_message_id text,
  p_event_hash text,
  p_from text,
  p_to text,
  p_body text,
  p_received_at timestamptz
)
returns table (inbound_id uuid, status text, keyword text, workspace_id uuid, duplicate boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  from_digits text := public.normalize_au_phone_digits(p_from);
  to_digits text := public.normalize_au_phone_digits(p_to);
  normalized text := upper(regexp_replace(btrim(coalesce(p_body, '')), '[.![:space:]]+$', ''));
  kw text;
  ws uuid;
  row_id uuid;
  existing public.sms_inbound_events;
  next_status text;
  evidence text;
begin
  if nullif(btrim(p_event_hash), '') is null or length(from_digits) < 8 or length(to_digits) < 8 then
    raise exception 'ingest_sms_inbound requires an event hash and valid from/to numbers';
  end if;
  kw := case
    when normalized in ('STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'STOPALL', 'OPTOUT', 'OPT OUT') then 'STOP'
    when normalized in ('START', 'UNSTOP') then 'START'
    else null end;

  insert into public.sms_inbound_events (provider, provider_message_id, event_hash, from_phone, to_phone, body, keyword, received_at)
  values (coalesce(p_provider, 'smsglobal'), nullif(btrim(p_provider_message_id), ''), p_event_hash, from_digits, to_digits, p_body, kw, coalesce(p_received_at, now()))
  on conflict on constraint sms_inbound_events_provider_event_unique do nothing
  returning id into row_id;
  if row_id is null then
    select * into existing from public.sms_inbound_events e
      where e.provider = coalesce(p_provider, 'smsglobal') and e.event_hash = p_event_hash;
    return query select existing.id, existing.status, existing.keyword, existing.workspace_id, true;
    return;
  end if;

  select n.workspace_id into ws from public.sms_inbound_numbers n
    where n.provider = coalesce(p_provider, 'smsglobal') and n.phone_e164 = to_digits and n.active;
  evidence := coalesce(nullif(btrim(p_provider_message_id), ''), p_event_hash);

  if ws is null then
    next_status := case when kw is null then 'ignored' else 'unmapped' end;
  elsif kw = 'STOP' then
    perform public.record_sms_opt_out(ws, from_digits, evidence, coalesce(p_received_at, now()), 'provider:smsglobal-stop');
    next_status := 'processed';
  elsif kw = 'START' then
    insert into public.contact_consent_events
      (workspace_id, contact_id, channel, event_type, lawful_basis, source, evidence_ref, provider_event_id, occurred_at)
    select ws, f.contact_id, 'sms', 'granted', 'express consent: recipient replied START to the builder''s number',
           'provider:smsglobal-start-optin', evidence, evidence || ':start:' || f.contact_id, coalesce(p_received_at, now())
    from (select distinct contact_id from public.find_contacts_by_normalized_phone(ws, from_digits)) f
    on conflict (workspace_id, provider_event_id) do nothing;
    next_status := 'processed';
  else
    next_status := 'ignored';
  end if;

  update public.sms_inbound_events e
    set workspace_id = ws, status = next_status, processed_at = case when next_status = 'processed' then now() end
    where e.id = row_id;
  return query select row_id, next_status, kw, ws, false;
end;
$$;
revoke all on function public.ingest_sms_inbound(text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_sms_inbound(text, text, text, text, text, text, timestamptz) to service_role;

-- Pre-send guard for every marketing SMS path. Blocked when:
--  * an unresolved STOP from this phone arrived on an unmapped number (any workspace), or
--  * a STOP to this workspace is newer than any START to this workspace, or
--  * a lead in this workspace with this phone carries an opt-out flag.
create or replace function public.is_sms_marketing_blocked(p_workspace_id uuid, p_phone text)
returns boolean
language sql stable security definer set search_path = public
as $$
  with d as (select public.normalize_au_phone_digits(p_phone) as digits)
  select
    exists (
      select 1 from public.sms_inbound_events e, d
      where e.from_phone = d.digits and e.keyword = 'STOP' and e.status = 'unmapped'
    )
    or coalesce((
      select max(e.received_at) filter (where e.keyword = 'STOP')
             > coalesce(max(e.received_at) filter (where e.keyword = 'START'), '-infinity'::timestamptz)
      from public.sms_inbound_events e, d
      where e.from_phone = d.digits and e.workspace_id = p_workspace_id and e.status = 'processed'
    ), false)
    or exists (
      select 1 from public.leads l, d
      where l.workspace_id = p_workspace_id
        and public.normalize_au_phone_digits(l.phone) = d.digits
        and (l.sms_opt_out or l.sms_marketing_opt_out)
    );
$$;
revoke all on function public.is_sms_marketing_blocked(uuid, text) from public, anon, authenticated;
grant execute on function public.is_sms_marketing_blocked(uuid, text) to service_role;

-- One atomic call per SendGrid event. Idempotent on sg_event_id. Ownership comes from the email_sends row
-- (by sg_message_id) or the workspace_id custom arg; when they disagree nothing is applied ('conflict').
-- Suppression side effects only run when the workspace is known; SendGrid's own account-level suppression
-- list still drops future sends to bounced / complaining / unsubscribed addresses in every case.
create or replace function public.record_email_provider_event(p_event jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  event_id text := nullif(btrim(p_event->>'sg_event_id'), '');
  kind text := lower(nullif(btrim(p_event->>'event'), ''));
  bounce_kind text := lower(nullif(btrim(p_event->>'type'), ''));
  message_id text := nullif(split_part(coalesce(p_event->>'sg_message_id', ''), '.', 1), '');
  addr text := lower(btrim(coalesce(p_event->>'email', '')));
  ev_at timestamptz := coalesce(to_timestamp(nullif(p_event->>'timestamp', '')::double precision), now());
  arg_ws uuid;
  arg_contact uuid;
  matched_send_id uuid;
  matched_send_ws uuid;
  matched_send_user uuid;
  ws uuid;
  contact uuid;
  assoc text;
  suppress_reason text;
  consent_type text;
  matches integer;
begin
  if event_id is null or kind is null then
    raise exception 'SendGrid event requires sg_event_id and event';
  end if;
  begin arg_ws := nullif(p_event->>'workspace_id', '')::uuid; exception when others then arg_ws := null; end;
  begin arg_contact := nullif(p_event->>'contact_id', '')::uuid; exception when others then arg_contact := null; end;

  if message_id is not null then
    select count(*) into matches from public.email_sends s
      where s.sendgrid_message_id = message_id or s.sg_message_id = message_id;
    if matches = 1 then
      select s.id, s.workspace_id, s.user_id into matched_send_id, matched_send_ws, matched_send_user from public.email_sends s
        where s.sendgrid_message_id = message_id or s.sg_message_id = message_id;
    end if;
  end if;

  if matched_send_ws is not null and arg_ws is not null and matched_send_ws <> arg_ws then
    assoc := 'conflict';
  else
    ws := coalesce(matched_send_ws, arg_ws);
    if ws is not null and arg_contact is not null
       and exists (select 1 from public.contacts c where c.id = arg_contact and c.workspace_id = ws) then
      contact := arg_contact;
    end if;
    assoc := case when ws is null then 'unresolved' when contact is not null then 'matched' else 'workspace_only' end;
  end if;

  insert into public.email_provider_events
    (provider, provider_event_id, event_type, bounce_type, provider_message_id, email_lower, occurred_at,
     workspace_id, contact_id, email_send_id, association_status, payload)
  values ('sendgrid', event_id, kind, bounce_kind, message_id, nullif(addr, ''), ev_at,
     case when assoc = 'conflict' then null else ws end, contact, matched_send_id, assoc, p_event)
  on conflict on constraint email_provider_events_unique do nothing;
  if not found then return 'duplicate'; end if;

  if matched_send_id is not null and assoc <> 'conflict' then
    update public.email_sends s set
      last_event = kind,
      last_event_at = greatest(coalesce(s.last_event_at, ev_at), ev_at),
      status = case
        when kind = 'delivered' and s.status in ('sent', 'processing', 'processed') then 'delivered'
        when kind = 'bounce' and bounce_kind = 'bounce' then 'bounced'
        when kind = 'dropped' then 'dropped'
        when kind in ('unsubscribe', 'group_unsubscribe') then 'unsubscribed'
        else s.status end,
      delivered_at = case when kind = 'delivered' then coalesce(s.delivered_at, ev_at) else s.delivered_at end,
      opened_at = case when kind = 'open' then coalesce(s.opened_at, ev_at) else s.opened_at end,
      first_open_at = case when kind = 'open' then coalesce(s.first_open_at, ev_at) else s.first_open_at end,
      last_open_at = case when kind = 'open' then ev_at else s.last_open_at end,
      open_count = case when kind = 'open' then coalesce(s.open_count, 0) + 1 else s.open_count end,
      clicked_at = case when kind = 'click' then coalesce(s.clicked_at, ev_at) else s.clicked_at end,
      last_click_at = case when kind = 'click' then ev_at else s.last_click_at end,
      click_count = case when kind = 'click' then coalesce(s.click_count, 0) + 1 else s.click_count end,
      bounced_at = case when kind = 'bounce' and bounce_kind = 'bounce' then coalesce(s.bounced_at, ev_at) else s.bounced_at end,
      spam_reported = case when kind = 'spamreport' then true else s.spam_reported end,
      unsubscribed = case when kind in ('unsubscribe', 'group_unsubscribe') then true else s.unsubscribed end,
      unsubscribed_at = case when kind in ('unsubscribe', 'group_unsubscribe') then coalesce(s.unsubscribed_at, ev_at) else s.unsubscribed_at end
    where s.id = matched_send_id;
  end if;

  if ws is null or assoc = 'conflict' or addr = '' then return assoc; end if;

  suppress_reason := case
    when kind = 'bounce' and bounce_kind = 'bounce' then 'hard_bounce'
    when kind = 'spamreport' then 'spam_complaint'
    when kind in ('unsubscribe', 'group_unsubscribe') then 'unsubscribed'
    else null end;
  if suppress_reason is null then return assoc; end if;

  insert into public.email_suppressions (user_id, workspace_id, email_lower, reason, source, provider_event_id, suppressed_at, created_at)
  values (matched_send_user, ws, addr, suppress_reason, 'provider:sendgrid-' || kind, event_id, ev_at, now())
  on conflict (workspace_id, email_lower, reason) where workspace_id is not null do nothing;

  consent_type := case when kind = 'spamreport' then 'withdrawn'
                       when kind in ('unsubscribe', 'group_unsubscribe') then 'unsubscribed' else null end;
  if consent_type is not null then
    insert into public.contact_consent_events
      (workspace_id, contact_id, channel, event_type, source, evidence_ref, provider_event_id, occurred_at)
    select ws, c.id, 'email', consent_type, 'provider:sendgrid-' || kind, event_id, event_id || ':' || c.id, ev_at
    from public.contacts c
    where c.workspace_id = ws and (c.id = contact or lower(btrim(c.email)) = addr)
    on conflict (workspace_id, provider_event_id) do nothing;
    -- Leads not yet linked to a contact still carry the flag the legacy senders read.
    update public.leads l
      set email_marketing_opt_out = true,
          email_marketing_consent = false,
          email_marketing_opt_out_at = coalesce(l.email_marketing_opt_out_at, ev_at)
      where l.workspace_id = ws and lower(btrim(l.email)) = addr;
  end if;
  return assoc;
end;
$$;
revoke all on function public.record_email_provider_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_email_provider_event(jsonb) to service_role;

alter table public.contacts enable row level security;
alter table public.contact_sources enable row level security;
alter table public.contact_list_memberships enable row level security;
alter table public.contact_consent_events enable row level security;
alter table public.email_broadcast_deliveries enable row level security;
alter table public.email_broadcast_delivery_attempts enable row level security;
alter table public.sms_delivery_receipts enable row level security;
alter table public.sms_inbound_numbers enable row level security;

grant select, insert, update on public.contacts to authenticated;
grant select, insert on public.contact_sources to authenticated;
grant select, insert, update on public.contact_list_memberships to authenticated;
grant select, insert on public.contact_consent_events to authenticated;
grant select on public.email_broadcast_deliveries to authenticated;
grant select on public.email_broadcast_delivery_attempts to authenticated;
grant select on public.sms_delivery_receipts to authenticated;
grant select on public.sms_inbound_numbers to authenticated;

create policy contacts_workspace_select on public.contacts
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contacts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contacts_workspace_insert on public.contacts
  for insert to authenticated with check (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contacts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contacts_workspace_update on public.contacts
  for update to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contacts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  ) with check (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contacts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );

create policy contact_sources_workspace_select on public.contact_sources
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_sources.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contact_sources_workspace_insert on public.contact_sources
  for insert to authenticated with check (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_sources.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );

create policy contact_list_memberships_workspace_select on public.contact_list_memberships
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_list_memberships.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contact_list_memberships_workspace_insert on public.contact_list_memberships
  for insert to authenticated with check (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_list_memberships.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contact_list_memberships_workspace_update on public.contact_list_memberships
  for update to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_list_memberships.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  ) with check (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_list_memberships.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );

create policy contact_consent_events_workspace_select on public.contact_consent_events
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_consent_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy contact_consent_events_workspace_insert on public.contact_consent_events
  for insert to authenticated with check (
    coalesce(source, '') not like 'provider:%'
    and exists (select 1 from public.workspace_members wm
      where wm.workspace_id = contact_consent_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy email_broadcast_deliveries_workspace_select on public.email_broadcast_deliveries
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = email_broadcast_deliveries.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy email_broadcast_attempts_workspace_select on public.email_broadcast_delivery_attempts
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = email_broadcast_delivery_attempts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy sms_delivery_receipts_workspace_select on public.sms_delivery_receipts
  for select to authenticated using (
    workspace_id is not null and exists (select 1 from public.workspace_members wm
      where wm.workspace_id = sms_delivery_receipts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
create policy sms_inbound_numbers_workspace_select on public.sms_inbound_numbers
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm
      where wm.workspace_id = sms_inbound_numbers.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );

alter table public.sms_inbound_events enable row level security;
alter table public.email_provider_events enable row level security;
grant select on public.email_provider_events to authenticated;
create policy email_provider_events_workspace_select on public.email_provider_events
  for select to authenticated using (
    workspace_id is not null and exists (select 1 from public.workspace_members wm
      where wm.workspace_id = email_provider_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );
-- sms_inbound_events holds message bodies; service role only (no authenticated grant).

-- Broadcast isolation. RESTRICTIVE policies are ANDed with whatever permissive policies already exist,
-- so they can only narrow access: a broadcast is visible/editable only by its own user, inside a workspace
-- that user is an active member of. Rows with no workspace_id (quarantined legacy rows) are invisible.
alter table public.email_broadcasts enable row level security;
drop policy if exists email_broadcasts_owner_access on public.email_broadcasts;
create policy email_broadcasts_owner_access on public.email_broadcasts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists email_broadcasts_workspace_guard on public.email_broadcasts;
create policy email_broadcasts_workspace_guard on public.email_broadcasts
  as restrictive for all to authenticated
  using (
    workspace_id is not null and user_id = auth.uid()
    and exists (select 1 from public.workspace_members wm
      where wm.workspace_id = email_broadcasts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  )
  with check (
    workspace_id is not null and user_id = auth.uid()
    and exists (select 1 from public.workspace_members wm
      where wm.workspace_id = email_broadcasts.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
  );

commit;

-- No automatic unique-email/phone merge is installed. Shared family/business identifiers and
-- duplicated historical rows require the separately reviewed reconciliation stage.
