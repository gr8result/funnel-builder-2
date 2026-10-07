create table if not exists public.gantt_delays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gantt_projects(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  day_count integer not null check (day_count > 0),
  reason text not null,
  notes text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists gantt_delays_project_id_idx
  on public.gantt_delays(project_id);

alter table public.gantt_delays enable row level security;

drop policy if exists "gantt_delays_owner_select" on public.gantt_delays;
create policy "gantt_delays_owner_select"
  on public.gantt_delays
  for select
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_delays.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_delays_owner_insert" on public.gantt_delays;
create policy "gantt_delays_owner_insert"
  on public.gantt_delays
  for insert
  with check (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_delays.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_delays_owner_update" on public.gantt_delays;
create policy "gantt_delays_owner_update"
  on public.gantt_delays
  for update
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_delays.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_delays.project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "gantt_delays_owner_delete" on public.gantt_delays;
create policy "gantt_delays_owner_delete"
  on public.gantt_delays
  for delete
  using (
    exists (
      select 1
      from public.gantt_projects p
      where p.id = gantt_delays.project_id
        and p.user_id = auth.uid()
    )
  );
