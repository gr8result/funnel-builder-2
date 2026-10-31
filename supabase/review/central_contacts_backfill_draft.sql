-- REVIEW DRAFT ONLY. Do not run until central_contacts_migration_draft.sql is applied and this file is approved.
-- Run on staging first. Analysis behind it: docs/email-sms-backfill-analysis-2026-10-15.md.
--
-- Rules (deterministic, never guessed):
--  * A legacy row gets a workspace only when its user_id has exactly ONE active workspace membership, or when an
--    operator has recorded an explicit decision in marketing_backfill_owner_decisions (and the user is a member).
--  * Everything else is quarantined with a reason; quarantined rows keep workspace_id NULL, which the RLS guard
--    and the application treat as invisible / unsendable.
--  * One contact per lead row. No email/phone merging (families and businesses share identifiers).
--  * List memberships are created as 'pending' with no lawful basis: production holds no consent evidence, so
--    no one becomes eligible for marketing through the backfill.
--  * Opt-out evidence (leads.unsubscribed_at, email_sends unsubscribe / spam / bounce flags) IS carried over.
--  * Every change and every inserted row is logged against a run id so marketing_backfill_rollback can undo it.
--
-- Usage:
--   select public.marketing_backfill_run('operator@example', 'staging dry run');   -- returns run id
--   select * from public.marketing_backfill_validate('<run id>');                   -- every row must pass
--   select * from public.marketing_backfill_quarantine where run_id = '<run id>';
--   select public.marketing_backfill_rollback('<run id>');                          -- before go-live only

begin;

create table if not exists public.marketing_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  started_by text not null,
  notes text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rolled_back_at timestamptz
);

-- Explicit human ownership decisions for users in several workspaces. table_name '*' applies to every table.
create table if not exists public.marketing_backfill_owner_decisions (
  user_id uuid not null,
  table_name text not null default '*',
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  decided_by text not null,
  evidence text not null check (length(btrim(evidence)) > 0),
  decided_at timestamptz not null default now(),
  primary key (user_id, table_name)
);

create table if not exists public.marketing_backfill_changes (
  run_id uuid not null references public.marketing_backfill_runs(id) on delete restrict,
  seq bigserial,
  table_name text not null,
  record_id text not null,
  column_name text not null,
  old_value text,
  new_value text,
  primary key (run_id, seq)
);

create table if not exists public.marketing_backfill_created (
  run_id uuid not null references public.marketing_backfill_runs(id) on delete restrict,
  seq bigserial,
  table_name text not null,
  record_id uuid not null,
  primary key (run_id, seq)
);

create table if not exists public.marketing_backfill_quarantine (
  run_id uuid not null references public.marketing_backfill_runs(id) on delete restrict,
  table_name text not null,
  record_id text not null,
  reason text not null,
  detail jsonb,
  primary key (run_id, table_name, record_id, reason)
);

alter table public.marketing_backfill_runs enable row level security;
alter table public.marketing_backfill_owner_decisions enable row level security;
alter table public.marketing_backfill_changes enable row level security;
alter table public.marketing_backfill_created enable row level security;
alter table public.marketing_backfill_quarantine enable row level security;
-- No authenticated grants: service role / SQL editor only.

create or replace function public.marketing_backfill_resolve_owner(p_user_id uuid, p_table text)
returns table (workspace_id uuid, reason text)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  decided uuid;
  memberships integer;
  only_ws uuid;
begin
  if p_user_id is null then
    return query select null::uuid, 'no_user'; return;
  end if;
  select d.workspace_id into decided from public.marketing_backfill_owner_decisions d
    where d.user_id = p_user_id and d.table_name in (p_table, '*')
    order by (d.table_name = p_table) desc limit 1;
  if decided is not null then
    if exists (select 1 from public.workspace_members wm
               where wm.user_id = p_user_id and wm.workspace_id = decided and wm.status = 'active') then
      return query select decided, 'operator_decision'; return;
    end if;
    return query select null::uuid, 'decision_not_member'; return;
  end if;
  select count(distinct wm.workspace_id), min(wm.workspace_id::text)::uuid into memberships, only_ws
    from public.workspace_members wm where wm.user_id = p_user_id and wm.status = 'active';
  if memberships = 1 then return query select only_ws, 'single_membership'; return; end if;
  if memberships = 0 then return query select null::uuid, 'user_without_workspace'; return; end if;
  return query select null::uuid, 'user_in_multiple_workspaces';
end;
$$;

create or replace function public.marketing_backfill_run(p_started_by text, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  run uuid;
  t text;
  r record;
  owner record;
  new_contact uuid;
  new_source uuid;
  new_row uuid;
  list_ws uuid;
begin
  insert into public.marketing_backfill_runs (started_by, notes) values (p_started_by, p_notes) returning id into run;

  -- 1. Workspace ownership for legacy marketing rows (only where workspace_id is NULL).
  foreach t in array array['lead_lists', 'email_lists', 'subscribers', 'form_submissions', 'email_broadcasts',
                           'email_sends', 'sms_sent_history', 'sms_queue', 'email_campaigns_queue'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for r in execute format('select id::text as id, user_id, workspace_id from public.%I order by id', t) loop
      select * into owner from public.marketing_backfill_resolve_owner(r.user_id, t);
      if r.workspace_id is not null then
        if owner.workspace_id is not null and owner.workspace_id <> r.workspace_id then
          insert into public.marketing_backfill_quarantine values
            (run, t, r.id, 'existing_workspace_disagrees_with_owner', jsonb_build_object('existing', r.workspace_id, 'owner', owner.workspace_id));
        end if;
        continue;
      end if;
      if owner.workspace_id is null then
        insert into public.marketing_backfill_quarantine values (run, t, r.id, owner.reason, jsonb_build_object('user_id', r.user_id));
        continue;
      end if;
      execute format('update public.%I set workspace_id = $1 where id::text = $2 and workspace_id is null', t)
        using owner.workspace_id, r.id;
      insert into public.marketing_backfill_changes (run_id, table_name, record_id, column_name, old_value, new_value)
        values (run, t, r.id, 'workspace_id', null, owner.workspace_id::text);
    end loop;
  end loop;

  -- 2. One central contact per workspace-scoped lead (no merging), linked both ways.
  for r in
    select l.* from public.leads l
    where l.workspace_id is not null
      and not exists (select 1 from public.contact_sources s
                      where s.workspace_id = l.workspace_id and s.source_table = 'leads' and s.source_record_key = l.id::text)
    order by l.created_at, l.id
  loop
    insert into public.contacts (workspace_id, display_name, email, phone, company, source, created_by)
      values (r.workspace_id, nullif(btrim(r.name), ''), nullif(lower(btrim(r.email)), ''), nullif(btrim(r.phone), ''),
              nullif(btrim(r.company), ''), 'backfill:leads', null)
      returning id into new_contact;
    insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'contacts', new_contact);
    insert into public.contact_sources (workspace_id, contact_id, source_table, source_record_key, source_name, original_created_at)
      values (r.workspace_id, new_contact, 'leads', r.id::text, r.source, r.created_at)
      returning id into new_source;
    insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'contact_sources', new_source);
    update public.leads set contact_id = new_contact where id = r.id;
    insert into public.marketing_backfill_changes (run_id, table_name, record_id, column_name, old_value, new_value)
      values (run, 'leads', r.id::text, 'contact_id', r.contact_id::text, new_contact::text);
  end loop;

  -- 3. List membership from leads.list_id -> lead_lists in the SAME workspace. Pending, no lawful basis.
  for r in
    select l.id, l.workspace_id, l.contact_id, l.list_id::text as list_id from public.leads l
    where l.workspace_id is not null and l.contact_id is not null and l.list_id is not null
  loop
    select ll.workspace_id into list_ws from public.lead_lists ll where ll.id::text = r.list_id;
    if not found then
      insert into public.marketing_backfill_quarantine values (run, 'leads', r.id::text, 'list_not_found', jsonb_build_object('list_id', r.list_id));
      continue;
    end if;
    if list_ws is distinct from r.workspace_id then
      insert into public.marketing_backfill_quarantine values
        (run, 'leads', r.id::text, 'list_in_other_or_unknown_workspace', jsonb_build_object('list_id', r.list_id, 'list_workspace', list_ws));
      continue;
    end if;
    insert into public.contact_list_memberships (workspace_id, contact_id, source_list_table, source_list_id, purpose, status, lawful_basis)
      values (r.workspace_id, r.contact_id, 'lead_lists', r.list_id, 'marketing', 'pending', null)
      on conflict on constraint contact_list_memberships_unique do nothing
      returning id into new_row;
    if new_row is not null then
      insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'contact_list_memberships', new_row);
    end if;
  end loop;

  -- 4. Opt-out evidence only. Source 'backfill:%' can never satisfy the provider-verified opt-in rule.
  for r in select l.id, l.workspace_id, l.contact_id, l.unsubscribed_at from public.leads l
           where l.workspace_id is not null and l.contact_id is not null and l.unsubscribed_at is not null loop
    insert into public.contact_consent_events (workspace_id, contact_id, channel, event_type, source, evidence_ref, provider_event_id, occurred_at)
      values (r.workspace_id, r.contact_id, 'email', 'unsubscribed', 'backfill:leads.unsubscribed_at', r.id::text,
              'backfill:leads:' || r.id, r.unsubscribed_at)
      on conflict (workspace_id, provider_event_id) do nothing
      returning id into new_row;
    if new_row is not null then
      insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'contact_consent_events', new_row);
    end if;
  end loop;

  for r in
    select s.id, s.workspace_id, s.user_id, lower(btrim(coalesce(s.recipient_email, s.email))) as addr,
           s.unsubscribed, s.spam_reported, s.bounced_at,
           coalesce(s.unsubscribed_at, s.bounced_at, s.last_event_at, s.sent_at, s.created_at) as at_time
    from public.email_sends s
    where s.workspace_id is not null and (s.unsubscribed or s.spam_reported or s.bounced_at is not null)
      and nullif(btrim(coalesce(s.recipient_email, s.email)), '') is not null
  loop
    if r.unsubscribed or r.spam_reported then
      for owner in select c.id from public.contacts c where c.workspace_id = r.workspace_id and c.email = r.addr loop
        insert into public.contact_consent_events (workspace_id, contact_id, channel, event_type, source, evidence_ref, provider_event_id, occurred_at)
          values (r.workspace_id, owner.id, 'email', case when r.spam_reported then 'withdrawn' else 'unsubscribed' end,
                  'backfill:email_sends', r.id::text, 'backfill:email_sends:' || r.id || ':' || owner.id, r.at_time)
          on conflict (workspace_id, provider_event_id) do nothing
          returning id into new_row;
        if new_row is not null then
          insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'contact_consent_events', new_row);
        end if;
      end loop;
    end if;
    insert into public.email_suppressions (user_id, workspace_id, email_lower, reason, source, suppressed_at, created_at)
      values (r.user_id, r.workspace_id, r.addr,
              case when r.spam_reported then 'spam_complaint' when r.unsubscribed then 'unsubscribed' else 'legacy_bounce' end,
              'backfill:email_sends:' || r.id, r.at_time, now())
      on conflict (workspace_id, email_lower, reason) where workspace_id is not null do nothing
      returning id into new_row;
    if new_row is not null then
      insert into public.marketing_backfill_created (run_id, table_name, record_id) values (run, 'email_suppressions', new_row);
    end if;
  end loop;

  update public.marketing_backfill_runs set finished_at = now() where id = run;
  return run;
end;
$$;

-- Validation: every check must report passed = true before the run is accepted.
create or replace function public.marketing_backfill_validate(p_run_id uuid)
returns table (check_name text, passed boolean, detail text)
language sql stable security definer set search_path = public
as $$
  select 'every workspace-scoped lead has exactly one contact link',
         not exists (select 1 from public.leads l where l.workspace_id is not null and
           (select count(*) from public.contact_sources s where s.workspace_id = l.workspace_id
              and s.source_table = 'leads' and s.source_record_key = l.id::text) <> 1),
         (select count(*)::text || ' scoped leads' from public.leads where workspace_id is not null)
  union all
  select 'lead.contact_id matches its contact_sources link',
         not exists (select 1 from public.leads l join public.contact_sources s
           on s.source_table = 'leads' and s.source_record_key = l.id::text
           where l.contact_id is distinct from s.contact_id),
         null
  union all
  select 'contacts stay in their lead''s workspace',
         not exists (select 1 from public.leads l join public.contacts c on c.id = l.contact_id
           where c.workspace_id <> l.workspace_id),
         null
  union all
  select 'memberships only link lists of the same workspace',
         not exists (select 1 from public.contact_list_memberships m join public.lead_lists ll
           on m.source_list_table = 'lead_lists' and ll.id::text = m.source_list_id
           where ll.workspace_id is distinct from m.workspace_id),
         null
  union all
  select 'backfill granted no marketing permission',
         not exists (select 1 from public.contact_list_memberships m where m.status = 'active')
         and not exists (select 1 from public.contact_consent_events e where e.event_type = 'granted' and e.source like 'backfill:%'),
         null
  union all
  select 'no pre-existing workspace_id was overwritten',
         not exists (select 1 from public.marketing_backfill_changes c
           where c.run_id = p_run_id and c.column_name = 'workspace_id' and c.old_value is not null),
         (select count(*)::text || ' workspace assignments' from public.marketing_backfill_changes
           where run_id = p_run_id and column_name = 'workspace_id')
  union all
  select 'every unassigned legacy row is quarantined',
         (select count(*) from public.marketing_backfill_quarantine q
            where q.run_id = p_run_id and q.reason in ('no_user', 'user_without_workspace', 'user_in_multiple_workspaces', 'decision_not_member'))
         = (select coalesce(sum(n), 0) from (
              select count(*) as n from public.email_broadcasts where workspace_id is null
              union all select count(*) from public.lead_lists where workspace_id is null
              union all select count(*) from public.email_lists where workspace_id is null
              union all select count(*) from public.email_sends where workspace_id is null
              union all select count(*) from public.sms_sent_history where workspace_id is null
              union all select count(*) from public.sms_queue where workspace_id is null
              union all select count(*) from public.email_campaigns_queue where workspace_id is null
              union all select count(*) from public.subscribers where workspace_id is null
              union all select count(*) from public.form_submissions where workspace_id is null) x),
         (select count(*)::text || ' quarantined' from public.marketing_backfill_quarantine where run_id = p_run_id)
  union all
  select 'opt-outs carried over for every unsubscribed lead',
         not exists (select 1 from public.leads l where l.unsubscribed_at is not null and l.contact_id is not null
           and not coalesce(l.email_marketing_opt_out, false)),
         null;
$$;

-- Undo one run. Refuses once the system has started using the new data (non-backfill consent events,
-- scheduled deliveries or provider events on backfilled contacts) because that history must be kept.
create or replace function public.marketing_backfill_rollback(p_run_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  current_value text;
  column_type text;
begin
  if exists (select 1 from public.marketing_backfill_runs where id = p_run_id and rolled_back_at is not null) then
    return 'already rolled back';
  end if;
  if exists (
    select 1 from public.marketing_backfill_created bc
    where bc.run_id = p_run_id and bc.table_name = 'contacts' and (
      exists (select 1 from public.contact_consent_events e where e.contact_id = bc.record_id and e.source not like 'backfill:%')
      or exists (select 1 from public.email_broadcast_deliveries d where d.contact_id = bc.record_id)
      or exists (select 1 from public.email_provider_events p where p.contact_id = bc.record_id))
  ) then
    raise exception 'Backfilled contacts already carry live history; rollback refused. Export and review instead.';
  end if;

  delete from public.contact_consent_events where id in
    (select record_id from public.marketing_backfill_created where run_id = p_run_id and table_name = 'contact_consent_events');
  delete from public.email_suppressions where id in
    (select record_id from public.marketing_backfill_created where run_id = p_run_id and table_name = 'email_suppressions');
  delete from public.contact_list_memberships where id in
    (select record_id from public.marketing_backfill_created where run_id = p_run_id and table_name = 'contact_list_memberships');

  for c in select * from public.marketing_backfill_changes where run_id = p_run_id order by seq desc loop
    execute format('select %I::text from public.%I where id::text = $1', c.column_name, c.table_name) into current_value using c.record_id;
    if current_value is distinct from c.new_value then
      raise exception 'Rollback conflict: %.% for % changed after the backfill', c.table_name, c.column_name, c.record_id;
    end if;
    select format_type(a.atttypid, a.atttypmod) into column_type from pg_attribute a
      where a.attrelid = to_regclass('public.' || c.table_name) and a.attname = c.column_name and not a.attisdropped;
    execute format('update public.%I set %I = cast($1 as %s) where id::text = $2', c.table_name, c.column_name, column_type)
      using c.old_value, c.record_id;
  end loop;

  -- Lead opt-out flags derived from backfilled events are reset to their pre-backfill (column-default) state.
  update public.leads l set email_marketing_opt_out = false, email_marketing_opt_out_at = null,
         email_marketing_consent = false, email_marketing_consent_at = null, email_marketing_consent_source = null
    where l.id::text in (select record_id from public.marketing_backfill_changes where run_id = p_run_id and table_name = 'leads');

  delete from public.contact_sources where id in
    (select record_id from public.marketing_backfill_created where run_id = p_run_id and table_name = 'contact_sources');
  delete from public.contacts where id in
    (select record_id from public.marketing_backfill_created where run_id = p_run_id and table_name = 'contacts');

  update public.marketing_backfill_runs set rolled_back_at = now() where id = p_run_id;
  return 'rolled back';
end;
$$;

revoke all on function public.marketing_backfill_resolve_owner(uuid, text) from public, anon, authenticated;
revoke all on function public.marketing_backfill_run(text, text) from public, anon, authenticated;
revoke all on function public.marketing_backfill_validate(uuid) from public, anon, authenticated;
revoke all on function public.marketing_backfill_rollback(uuid) from public, anon, authenticated;

commit;

-- Read-only pre-checks to run (and keep) before the backfill. Counts only.
-- select count(*) filter (where workspace_id is null) as unscoped, count(*) from public.email_broadcasts;
-- select count(*) filter (where workspace_id is null) as unscoped, count(*) from public.email_sends;
-- select user_id, count(distinct workspace_id) from public.workspace_members where status = 'active'
--   group by user_id having count(distinct workspace_id) > 1;
