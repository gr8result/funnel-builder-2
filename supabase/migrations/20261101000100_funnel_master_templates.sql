-- Funnel master templates are catalogued on the existing funnels table.
-- Subscriber copies are regular funnels with a new owner and workspace.
alter table public.funnels
  add column if not exists is_master_template boolean not null default false,
  add column if not exists template_description text,
  add column if not exists template_thumbnail text;

create index if not exists funnels_master_template_catalogue_idx
  on public.funnels (updated_at desc)
  where is_master_template = true;

create or replace function public.guard_funnel_master_template_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.is_master_template or new.template_description is not null or new.template_thumbnail is not null then
        raise exception 'Master template metadata must be managed through the authenticated Funnel Builder API'
          using errcode = '42501';
      end if;
    elsif new.is_master_template is distinct from old.is_master_template
      or new.template_description is distinct from old.template_description
      or new.template_thumbnail is distinct from old.template_thumbnail then
      raise exception 'Master template metadata must be managed through the authenticated Funnel Builder API'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists funnels_guard_master_template_fields on public.funnels;
create trigger funnels_guard_master_template_fields
  before insert or update on public.funnels
  for each row execute function public.guard_funnel_master_template_fields();

create or replace function public.current_user_is_active_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id = auth.uid()
       and status = 'active'
  );
$$;

revoke all on function public.current_user_is_active_workspace_member(uuid) from public;
grant execute on function public.current_user_is_active_workspace_member(uuid) to authenticated, service_role;

alter table public.funnels enable row level security;
alter table public.funnel_steps enable row level security;

revoke all on table public.funnels, public.funnel_steps from public, anon;
grant select, insert, update, delete on table public.funnels, public.funnel_steps to authenticated;
grant all on table public.funnels, public.funnel_steps to service_role;

drop policy if exists funnels_workspace_owner_access on public.funnels;
drop policy if exists funnels_workspace_owner_guard on public.funnels;
create policy funnels_workspace_owner_access
  on public.funnels
  for all to authenticated
  using (
    owner_user_id = auth.uid()
    and not is_master_template
    and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id))
  )
  with check (
    owner_user_id = auth.uid()
    and not is_master_template
    and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id))
  );
create policy funnels_workspace_owner_guard
  on public.funnels
  as restrictive
  for all to authenticated
  using (
    owner_user_id = auth.uid()
    and not is_master_template
    and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id))
  )
  with check (
    owner_user_id = auth.uid()
    and not is_master_template
    and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id))
  );

drop policy if exists funnel_steps_workspace_owner_access on public.funnel_steps;
drop policy if exists funnel_steps_workspace_owner_guard on public.funnel_steps;
create policy funnel_steps_workspace_owner_access
  on public.funnel_steps
  for all to authenticated
  using (
    exists (
      select 1
        from public.funnels f
       where f.id = funnel_steps.funnel_id
         and f.owner_user_id = auth.uid()
         and not f.is_master_template
         and (f.workspace_id is null or public.current_user_is_active_workspace_member(f.workspace_id))
    )
  )
  with check (
    exists (
      select 1
        from public.funnels f
       where f.id = funnel_steps.funnel_id
         and f.owner_user_id = auth.uid()
         and not f.is_master_template
         and (f.workspace_id is null or public.current_user_is_active_workspace_member(f.workspace_id))
    )
  );
create policy funnel_steps_workspace_owner_guard
  on public.funnel_steps
  as restrictive
  for all to authenticated
  using (
    exists (
      select 1
        from public.funnels f
       where f.id = funnel_steps.funnel_id
         and f.owner_user_id = auth.uid()
         and not f.is_master_template
         and (f.workspace_id is null or public.current_user_is_active_workspace_member(f.workspace_id))
    )
  )
  with check (
    exists (
      select 1
        from public.funnels f
       where f.id = funnel_steps.funnel_id
         and f.owner_user_id = auth.uid()
         and not f.is_master_template
         and (f.workspace_id is null or public.current_user_is_active_workspace_member(f.workspace_id))
    )
  );
