alter table public.gantt_projects
  add column if not exists actual_start_date date,
  add column if not exists contract_days integer not null default 0 check (contract_days >= 0),
  add column if not exists weather_lost_day_allowance integer not null default 0 check (weather_lost_day_allowance >= 0),
  add column if not exists misc_lost_day_allowance integer not null default 0 check (misc_lost_day_allowance >= 0),
  add column if not exists unforeseen_lost_day_allowance integer not null default 0 check (unforeseen_lost_day_allowance >= 0);

update public.gantt_projects
set actual_start_date = start_date
where actual_start_date is null
  and start_date is not null;
