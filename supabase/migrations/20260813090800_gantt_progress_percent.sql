alter table public.gantt_tasks
  add column if not exists progress_percent integer not null default 0
  check (progress_percent >= 0 and progress_percent <= 100);

update public.gantt_tasks
set progress_percent = case
  when status = 'complete' then 100
  when status = 'in_progress' then 50
  else 0
end
where progress_percent = 0
  and status in ('complete', 'in_progress');

