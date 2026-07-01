-- Enforce per-user ownership for Gantt projects, tasks, and contacts.

alter table public.gantt_projects enable row level security;
alter table public.gantt_tasks enable row level security;
alter table public.gantt_contacts enable row level security;

drop policy if exists "gantt_projects_owner_all" on public.gantt_projects;
create policy "gantt_projects_owner_all"
  on public.gantt_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "gantt_tasks_owner_select" on public.gantt_tasks;
create policy "gantt_tasks_owner_select"
  on public.gantt_tasks
  for select
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_tasks.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_tasks_owner_insert" on public.gantt_tasks;
create policy "gantt_tasks_owner_insert"
  on public.gantt_tasks
  for insert
  with check (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_tasks.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_tasks_owner_update" on public.gantt_tasks;
create policy "gantt_tasks_owner_update"
  on public.gantt_tasks
  for update
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_tasks.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_tasks.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_tasks_owner_delete" on public.gantt_tasks;
create policy "gantt_tasks_owner_delete"
  on public.gantt_tasks
  for delete
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_tasks.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_contacts_owner_all" on public.gantt_contacts;
create policy "gantt_contacts_owner_all"
  on public.gantt_contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

