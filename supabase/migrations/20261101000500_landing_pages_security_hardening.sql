-- Normalize client privileges and close workspace/function gaps before staging
-- acceptance. Apply only after the Landing Pages and funnel migrations.

alter table public.workspaces
  add column if not exists is_demo boolean not null default false;
create index if not exists workspaces_is_demo_idx
  on public.workspaces (is_demo) where is_demo = true;

revoke all on table
  public.accounts, public.workspaces, public.workspace_members,
  public.workspace_entitlements, public.communities,
  public.email_lists, public.subscribers, public.list_subscribers,
  public.tags, public.subscriber_tags,
  public.funnels, public.funnel_steps, public.leads, public.lead_notes,
  public.form_submissions, public.business_profile_vaults,
  public.business_profile_documents, public.landing_campaigns,
  public.landing_pages, public.landing_page_versions,
  public.landing_page_submissions, public.landing_page_events,
  public.landing_audit_log
from public, anon, authenticated;

grant all on table
  public.accounts, public.workspaces, public.workspace_members,
  public.workspace_entitlements, public.communities,
  public.email_lists, public.subscribers, public.list_subscribers,
  public.tags, public.subscriber_tags,
  public.funnels, public.funnel_steps, public.leads, public.lead_notes,
  public.form_submissions, public.business_profile_vaults,
  public.business_profile_documents, public.landing_campaigns,
  public.landing_pages, public.landing_page_versions,
  public.landing_page_submissions, public.landing_page_events,
  public.landing_audit_log
to service_role;

grant select, update on public.accounts to authenticated;
grant select on
  public.workspaces, public.workspace_members, public.workspace_entitlements,
  public.communities, public.lead_notes, public.form_submissions,
  public.landing_page_versions, public.landing_page_submissions,
  public.landing_page_events, public.landing_audit_log
to authenticated;
grant select, insert, update, delete on
  public.email_lists, public.subscribers, public.list_subscribers,
  public.tags, public.subscriber_tags, public.funnels, public.funnel_steps,
  public.leads, public.business_profile_vaults,
  public.business_profile_documents, public.landing_campaigns,
  public.landing_pages
to authenticated;

alter function public.is_workspace_member(uuid) security definer;
alter function public.is_workspace_member(uuid)
  set search_path = pg_catalog, public;
revoke all on function public.is_workspace_member(uuid)
  from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid)
  to authenticated, service_role;

alter function public.lp_is_workspace_member(uuid) security definer;
alter function public.lp_is_workspace_member(uuid)
  set search_path = pg_catalog, public;
revoke all on function public.lp_is_workspace_member(uuid)
  from public, anon, authenticated;
grant execute on function public.lp_is_workspace_member(uuid)
  to authenticated, service_role;

alter function public.assert_workspace_member(uuid, uuid) security definer;
alter function public.assert_workspace_member(uuid, uuid)
  set search_path = pg_catalog, public;
revoke all on function public.assert_workspace_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assert_workspace_member(uuid, uuid)
  to service_role;

alter function public.lp_sync_submission(uuid) security definer;
alter function public.lp_sync_submission(uuid)
  set search_path = pg_catalog, public;
revoke all on function public.lp_sync_submission(uuid)
  from public, anon, authenticated;
grant execute on function public.lp_sync_submission(uuid) to service_role;

drop policy if exists leads_owner_access on public.leads;
drop policy if exists leads_workspace_owner_access on public.leads;
create policy leads_workspace_owner_access
  on public.leads for all to authenticated
  using (
    user_id = auth.uid()
    and workspace_id is not null
    and public.current_user_is_active_workspace_member(workspace_id)
  )
  with check (
    user_id = auth.uid()
    and workspace_id is not null
    and public.current_user_is_active_workspace_member(workspace_id)
  );

drop policy if exists lead_notes_owner_read on public.lead_notes;
drop policy if exists lead_notes_authenticated_read_own on public.lead_notes;
drop policy if exists lead_notes_authenticated_read_own_guard on public.lead_notes;
drop policy if exists lead_notes_workspace_owner_read on public.lead_notes;
drop policy if exists lead_notes_workspace_owner_guard on public.lead_notes;
create policy lead_notes_workspace_owner_read
  on public.lead_notes for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.leads l
      where l.id = lead_notes.lead_id
        and l.user_id = auth.uid()
        and l.workspace_id is not null
        and public.current_user_is_active_workspace_member(l.workspace_id)
    )
  );
create policy lead_notes_workspace_owner_guard
  on public.lead_notes as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.leads l
      where l.id = lead_notes.lead_id
        and l.user_id = auth.uid()
        and l.workspace_id is not null
        and public.current_user_is_active_workspace_member(l.workspace_id)
    )
  );

drop policy if exists funnels_owner_access on public.funnels;
drop policy if exists funnel_steps_owner_access on public.funnel_steps;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.funnels'::regclass
      and conname = 'funnels_workspace_required'
  ) then
    alter table public.funnels
      add constraint funnels_workspace_required
      check (workspace_id is not null) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass
      and conname = 'leads_workspace_required'
  ) then
    alter table public.leads
      add constraint leads_workspace_required
      check (workspace_id is not null) not valid;
  end if;
end $$;

alter table public.funnels validate constraint funnels_workspace_required;
alter table public.leads validate constraint leads_workspace_required;
