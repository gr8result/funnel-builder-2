alter table public.gantt_projects
  add column if not exists daily_ld_rate numeric(12,2) not null default 0 check (daily_ld_rate >= 0);
