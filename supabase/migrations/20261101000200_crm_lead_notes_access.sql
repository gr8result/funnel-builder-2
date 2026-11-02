-- Lead notes are private CRM records. Public/anonymous and direct client writes
-- are not used by the app; server-side API and CRM sync use service_role.
alter table public.lead_notes enable row level security;

revoke all on table public.lead_notes from public, anon, authenticated;
grant select on table public.lead_notes to authenticated;
grant all on table public.lead_notes to service_role;

drop policy if exists lead_notes_authenticated_read_own on public.lead_notes;
drop policy if exists lead_notes_authenticated_read_own_guard on public.lead_notes;
create policy lead_notes_authenticated_read_own
  on public.lead_notes
  for select to authenticated
  using (user_id = auth.uid());
create policy lead_notes_authenticated_read_own_guard
  on public.lead_notes
  as restrictive
  for select to authenticated
  using (user_id = auth.uid());
