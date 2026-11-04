-- Replace self-referencing membership policies with the existing security-definer
-- membership predicate. The active-member test and workspace boundary are unchanged.
begin;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_entitlements enable row level security;
alter table public.communities enable row level security;

drop policy if exists "members_read_workspace" on public.workspaces;
create policy "members_read_workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists "members_read_workspace_members" on public.workspace_members;
create policy "members_read_workspace_members"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "members_read_entitlements" on public.workspace_entitlements;
create policy "members_read_entitlements"
  on public.workspace_entitlements for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "members_read_communities" on public.communities;
create policy "members_read_communities"
  on public.communities for select to authenticated
  using (public.is_workspace_member(workspace_id));

commit;
