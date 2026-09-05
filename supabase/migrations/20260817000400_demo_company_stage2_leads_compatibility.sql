alter table public.leads
  add column if not exists company text;

notify pgrst, 'reload schema';
