-- Stage 1 Demo Company infrastructure.
-- Creates a canonical demo-workspace marker, the permanent Demo Company
-- workspace, and a scoped event log/reset foundation. No mock customer data
-- is seeded in this stage.

alter table public.workspaces
  add column if not exists is_demo boolean not null default false;

create index if not exists workspaces_is_demo_idx
  on public.workspaces (is_demo)
  where is_demo = true;

do $$
declare
  target record;
begin
  for target in
    select *
    from (values
      ('sms_queue', 'cascade'),
      ('sms_sent_history', 'set null'),
      ('email_sends', 'set null'),
      ('email_broadcasts', 'set null'),
      ('email_events', 'set null'),
      ('email_lists', 'cascade'),
      ('sms_messages', 'set null'),
      ('crm_pipelines', 'cascade'),
      ('crm_tasks', 'cascade'),
      ('social_posts', 'cascade'),
      ('social_schedule', 'cascade'),
      ('social_queue', 'cascade'),
      ('social_usage_log', 'cascade'),
      ('published_websites', 'set null'),
      ('email_automations', 'cascade'),
      ('funnels', 'cascade'),
      ('services', 'cascade')
    ) as t(table_name, delete_action)
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = target.table_name
        and c.relkind in ('r', 'p')
    ) then
      execute format(
        'alter table public.%I add column if not exists workspace_id uuid references public.workspaces(id) on delete %s',
        target.table_name,
        target.delete_action
      );
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from public.workspaces
    where slug = 'gr8-result-demo'
      and id <> '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Cannot create Demo Company: slug gr8-result-demo is already used by another workspace.';
  end if;
end $$;

insert into public.workspaces (id, name, slug, plan, is_demo, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'Gr8 Result Demo Company',
  'gr8-result-demo',
  'growth',
  true,
  now(),
  now()
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  plan = excluded.plan,
  is_demo = true,
  updated_at = now();

update public.workspaces
set is_demo = false
where id <> '00000000-0000-4000-8000-000000000001'
  and is_demo is distinct from false;

create table if not exists public.demo_action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_type text not null,
  provider text,
  target text,
  payload jsonb not null default '{}'::jsonb,
  simulated_result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint demo_action_log_demo_workspace_only
    check (workspace_id = '00000000-0000-4000-8000-000000000001')
);

alter table public.demo_action_log enable row level security;

drop policy if exists demo_action_log_members_select on public.demo_action_log;
create policy demo_action_log_members_select
  on public.demo_action_log
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = demo_action_log.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

create or replace function public.reset_demo_company_stage1()
returns jsonb
language plpgsql
security definer
as $$
declare
  demo_workspace constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if not exists (
    select 1 from public.workspaces
    where id = demo_workspace and is_demo = true
  ) then
    raise exception 'Demo workspace is missing or is not marked as demo';
  end if;

  -- Stage 1 foundation only. Stage 2 will add the scoped dataset reset steps.
  insert into public.demo_action_log (workspace_id, action_type, provider, simulated_result)
  values (
    demo_workspace,
    'reset-foundation-invoked',
    'internal',
    jsonb_build_object('ok', true, 'message', 'Stage 1 reset foundation verified; no mock data reset performed.')
  );

  return jsonb_build_object(
    'ok', true,
    'workspace_id', demo_workspace,
    'message', 'Stage 1 reset foundation verified; no mock data reset performed.'
  );
end;
$$;
