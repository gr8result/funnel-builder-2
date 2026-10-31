-- Landing Pages: campaign-first AI landing page builder.
--
-- Every landing page belongs to a campaign. Pages keep an editable draft document, a numbered version history,
-- and a pointer to the version that is live. Public form submissions are recorded durably first, then copied into
-- the existing CRM (public.leads + public.lead_notes) by lp_sync_submission(), which is atomic and idempotent, so a
-- CRM failure leaves a retryable submission instead of a lost enquiry. No second contact database is created.
--
-- Re-runnable. Writes from the app go through server routes using the service role after a workspace membership
-- check (lib/withWorkspace.js); the RLS below is defence in depth for direct client access.


create or replace function public.lp_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid() and coalesce(m.status, 'active') = 'active'
  );
$$;

create or replace function public.lp_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---- Campaigns ------------------------------------------------------------------------------------------------------
create table if not exists public.landing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  brief jsonb not null default '{}'::jsonb,
  interview jsonb not null default '{}'::jsonb,
  starts_on date,
  ends_on date,
  archived_at timestamptz,
  duplicated_from uuid references public.landing_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists landing_campaigns_workspace_idx on public.landing_campaigns (workspace_id, updated_at desc);

-- ---- Pages ----------------------------------------------------------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  created_by uuid not null,
  title text not null default 'Landing page',
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  document jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  published_version_id uuid,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (campaign_id, workspace_id) references public.landing_campaigns(id, workspace_id) on delete cascade
);
create index if not exists landing_pages_campaign_idx on public.landing_pages (campaign_id);
create index if not exists landing_pages_workspace_idx on public.landing_pages (workspace_id, updated_at desc);

create table if not exists public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  page_id uuid not null,
  version_no integer not null,
  kind text not null check (kind in ('generated', 'save', 'autosave', 'ai', 'restore', 'publish')),
  label text,
  document jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (page_id, version_no),
  foreign key (page_id, workspace_id) references public.landing_pages(id, workspace_id) on delete cascade
);
create index if not exists landing_page_versions_page_idx on public.landing_page_versions (page_id, version_no desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landing_pages_published_version_fk') then
    alter table public.landing_pages
      add constraint landing_pages_published_version_fk
      foreign key (published_version_id) references public.landing_page_versions(id) on delete set null;
  end if;
end $$;

-- ---- Submissions (durable inbox) -------------------------------------------------------------------------------------
create table if not exists public.landing_page_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  page_id uuid not null,
  page_version_id uuid references public.landing_page_versions(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  name text,
  email text not null,
  phone text,
  fields jsonb not null default '{}'::jsonb,
  consent boolean not null default false,
  consent_text text,
  attribution jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  status text not null default 'received' check (status in ('received', 'synced', 'failed')),
  attempts integer not null default 0,
  last_error text,
  lead_id uuid,
  lead_note_id uuid,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (page_id, idempotency_key),
  foreign key (page_id, workspace_id) references public.landing_pages(id, workspace_id) on delete cascade,
  foreign key (campaign_id, workspace_id) references public.landing_campaigns(id, workspace_id) on delete cascade
);
create index if not exists landing_page_submissions_campaign_idx on public.landing_page_submissions (campaign_id, created_at desc);
create index if not exists landing_page_submissions_pending_idx on public.landing_page_submissions (status, created_at) where status <> 'synced';

-- ---- Visit / conversion events --------------------------------------------------------------------------------------
create table if not exists public.landing_page_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid not null,
  page_id uuid not null,
  type text not null check (type in ('visit', 'submit')),
  visitor_hash text,
  attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (page_id, workspace_id) references public.landing_pages(id, workspace_id) on delete cascade
);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_page_events'::regclass
      and conname = 'landing_page_events_campaign_workspace_fk'
  ) then
    alter table public.landing_page_events
      add constraint landing_page_events_campaign_workspace_fk
      foreign key (campaign_id, workspace_id) references public.landing_campaigns(id, workspace_id) on delete cascade;
  end if;
end $$;
create index if not exists landing_page_events_campaign_idx on public.landing_page_events (campaign_id, type, created_at desc);

-- ---- Audit log ------------------------------------------------------------------------------------------------------
create table if not exists public.landing_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity text not null,
  entity_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  actor uuid,
  created_at timestamptz not null default now()
);
create index if not exists landing_audit_log_entity_idx on public.landing_audit_log (entity, entity_id, created_at desc);

drop trigger if exists landing_campaigns_touch on public.landing_campaigns;
create trigger landing_campaigns_touch before update on public.landing_campaigns
  for each row execute function public.lp_touch_updated_at();
drop trigger if exists landing_pages_touch on public.landing_pages;
create trigger landing_pages_touch before update on public.landing_pages
  for each row execute function public.lp_touch_updated_at();

-- ---- Row-level security ---------------------------------------------------------------------------------------------
alter table public.landing_campaigns enable row level security;
alter table public.landing_pages enable row level security;
alter table public.landing_page_versions enable row level security;
alter table public.landing_page_submissions enable row level security;
alter table public.landing_page_events enable row level security;
alter table public.landing_audit_log enable row level security;

drop policy if exists landing_campaigns_member on public.landing_campaigns;
create policy landing_campaigns_member on public.landing_campaigns for all to authenticated
  using (public.lp_is_workspace_member(workspace_id)) with check (public.lp_is_workspace_member(workspace_id));
drop policy if exists landing_pages_member on public.landing_pages;
create policy landing_pages_member on public.landing_pages for all to authenticated
  using (public.lp_is_workspace_member(workspace_id)) with check (public.lp_is_workspace_member(workspace_id));
drop policy if exists landing_page_versions_member_read on public.landing_page_versions;
create policy landing_page_versions_member_read on public.landing_page_versions for select to authenticated
  using (public.lp_is_workspace_member(workspace_id));
drop policy if exists landing_page_submissions_member_read on public.landing_page_submissions;
create policy landing_page_submissions_member_read on public.landing_page_submissions for select to authenticated
  using (public.lp_is_workspace_member(workspace_id));
drop policy if exists landing_page_events_member_read on public.landing_page_events;
create policy landing_page_events_member_read on public.landing_page_events for select to authenticated
  using (public.lp_is_workspace_member(workspace_id));
drop policy if exists landing_audit_log_member_read on public.landing_audit_log;
create policy landing_audit_log_member_read on public.landing_audit_log for select to authenticated
  using (public.lp_is_workspace_member(workspace_id));

-- ---- CRM sync -------------------------------------------------------------------------------------------------------
-- Copies one recorded submission into the existing CRM in a single transaction:
--   * finds the workspace's lead by case-insensitive email (serialised with an advisory lock), or creates it;
--   * never overwrites existing contact details, only fills blanks and adds campaign tags;
--   * adds a lead note carrying the enquiry and its campaign attribution;
--   * marks the submission synced. A second call for the same submission returns the same lead and adds nothing.
create or replace function public.lp_sync_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.landing_page_submissions%rowtype;
  c public.landing_campaigns%rowtype;
  p public.landing_pages%rowtype;
  v_lead_id uuid;
  v_note_id uuid;
  v_tags text;
  v_campaign_tag text;
  v_note text;
  v_field record;
begin
  select * into s from public.landing_page_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission % not found', p_submission_id; end if;
  if s.status = 'synced' and s.lead_id is not null then return s.lead_id; end if;

  select * into c from public.landing_campaigns where id = s.campaign_id and workspace_id = s.workspace_id;
  select * into p from public.landing_pages where id = s.page_id and workspace_id = s.workspace_id;
  if c.id is null or p.id is null then raise exception 'campaign or page missing for submission %', p_submission_id; end if;

  perform pg_advisory_xact_lock(hashtextextended(s.workspace_id::text || ':' || lower(btrim(s.email)), 0));

  v_campaign_tag := 'campaign:' || left(regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g'), 60);

  select id, tags into v_lead_id, v_tags from public.leads
   where workspace_id = s.workspace_id and lower(btrim(email)) = lower(btrim(s.email))
   order by created_at asc limit 1 for update;

  if v_lead_id is null then
    insert into public.leads (user_id, workspace_id, name, email, phone, source, lead_source, tags, lead_status, created_at, updated_at)
    values (c.created_by, s.workspace_id, nullif(btrim(coalesce(s.name, '')), ''), lower(btrim(s.email)),
            nullif(btrim(coalesce(s.phone, '')), ''), 'Landing Page', 'Landing Page: ' || c.name,
            'landing-page,' || v_campaign_tag, 'new', now(), now())
    returning id into v_lead_id;
  else
    v_tags := coalesce(v_tags, '');
    if position('landing-page' in v_tags) = 0 then v_tags := concat_ws(',', nullif(v_tags, ''), 'landing-page'); end if;
    if position(v_campaign_tag in v_tags) = 0 then v_tags := concat_ws(',', nullif(v_tags, ''), v_campaign_tag); end if;
    update public.leads set
      name = coalesce(nullif(btrim(coalesce(name, '')), ''), nullif(btrim(coalesce(s.name, '')), '')),
      phone = coalesce(nullif(btrim(coalesce(phone, '')), ''), nullif(btrim(coalesce(s.phone, '')), '')),
      lead_source = coalesce(nullif(btrim(coalesce(lead_source, '')), ''), 'Landing Page: ' || c.name),
      tags = v_tags,
      updated_at = now()
    where id = v_lead_id;
  end if;

  v_note := 'Landing page enquiry — campaign "' || c.name || '"' || chr(10)
    || 'Page: ' || p.title || ' (/lp/' || p.slug || ')' || chr(10)
    || 'Submitted: ' || to_char(s.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC' || chr(10)
    || 'Campaign ID: ' || c.id || chr(10)
    || 'Submission ID: ' || s.id || chr(10);
  for v_field in select key, value from jsonb_each_text(s.fields) order by key loop
    v_note := v_note || initcap(replace(v_field.key, '_', ' ')) || ': ' || left(v_field.value, 2000) || chr(10);
  end loop;
  if s.attribution <> '{}'::jsonb then
    v_note := v_note || 'Attribution: ' || s.attribution::text || chr(10);
  end if;
  v_note := v_note || 'Consent: ' || case when s.consent then 'given' else 'not given' end;

  insert into public.lead_notes (lead_id, user_id, note) values (v_lead_id, c.created_by, v_note) returning id into v_note_id;

  update public.landing_page_submissions
     set status = 'synced', lead_id = v_lead_id, lead_note_id = v_note_id, synced_at = now(),
         attempts = attempts + 1, last_error = null
   where id = s.id;

  insert into public.landing_audit_log (workspace_id, entity, entity_id, action, detail)
  values (s.workspace_id, 'submission', s.id, 'crm_synced', jsonb_build_object('lead_id', v_lead_id, 'campaign_id', c.id));

  return v_lead_id;
end;
$$;

revoke all on function public.lp_sync_submission(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.lp_sync_submission(uuid) from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on function public.lp_sync_submission(uuid) from authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.lp_sync_submission(uuid) to service_role'; end if;
end $$;

grant all on public.landing_campaigns, public.landing_pages, public.landing_page_versions,
  public.landing_page_submissions, public.landing_page_events, public.landing_audit_log to service_role;
grant select, insert, update, delete on public.landing_campaigns, public.landing_pages to authenticated;
grant select on public.landing_page_versions, public.landing_page_submissions,
  public.landing_page_events, public.landing_audit_log to authenticated;

create or replace function public.lp_readiness()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with module_tables as (
    select name, to_regclass('public.' || name) as relation
    from unnest(array['landing_campaigns','landing_pages','landing_page_versions',
      'landing_page_submissions','landing_page_events','landing_audit_log']) as name
  ), table_checks as (
    select name,
      relation is not null as exists,
      coalesce((select relrowsecurity from pg_class where oid = relation), false) as rls,
      relation is not null and not exists (
        select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) as privilege
        where not has_table_privilege('service_role', relation, privilege)
      ) as service_permissions,
      exists (select 1 from pg_policies where schemaname = 'public' and tablename = name
        and 'authenticated' = any(roles) and qual like '%lp_is_workspace_member%') as member_policy,
      not exists (select 1 from pg_policies where schemaname = 'public' and tablename = name
        and ('anon' = any(roles) or 'public' = any(roles))) as anonymous_denied
    from module_tables
  ), sync_check as (
    select coalesce(bool_and(
      prosecdef and coalesce(proconfig @> array['search_path=public'], false)
      and has_function_privilege('service_role', oid, 'EXECUTE')
      and not has_function_privilege('anon', oid, 'EXECUTE')
      and not has_function_privilege('authenticated', oid, 'EXECUTE')
    ), false) as safe
    from pg_proc where oid = to_regprocedure('public.lp_sync_submission(uuid)')
  )
  select jsonb_build_object(
    'ready', (select bool_and(exists and rls and service_permissions and member_policy and anonymous_denied) from table_checks)
      and (select safe from sync_check),
    'tables', (select jsonb_agg(to_jsonb(table_checks)) from table_checks),
    'sync_permissions', (select safe from sync_check)
  );
$$;

revoke all on function public.lp_readiness() from public, anon, authenticated;
grant execute on function public.lp_readiness() to service_role;

notify pgrst, 'reload schema';
