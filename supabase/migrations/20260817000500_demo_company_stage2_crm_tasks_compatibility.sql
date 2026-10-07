do $$
begin
  if to_regclass('public.crm_tasks') is not null then
    alter table public.crm_tasks
      add column if not exists lead_id uuid,
      add column if not exists user_id uuid references auth.users(id) on delete set null,
      add column if not exists title text,
      add column if not exists due_at timestamptz,
      add column if not exists status text not null default 'open',
      add column if not exists meta jsonb;
  end if;
end $$;

notify pgrst, 'reload schema';
