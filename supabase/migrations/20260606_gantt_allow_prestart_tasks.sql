do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.gantt_tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%start_day%'
      and pg_get_constraintdef(oid) ~ '>=\s*0'
  loop
    execute format('alter table public.gantt_tasks drop constraint %I', constraint_record.conname);
  end loop;
end $$;
