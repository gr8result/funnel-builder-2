-- Delete selection history before client selections during Demo Company reset.
-- The history table has composite FKs that include workspace_id and use
-- ON DELETE SET NULL, while workspace_id itself is not nullable.

create or replace function public.reset_demo_company_stage2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_workspace constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if not exists (
    select 1
    from public.workspaces
    where id = demo_workspace
      and is_demo = true
  ) then
    raise exception 'Demo workspace is missing or is not marked as demo';
  end if;

  if to_regclass('public.builder_selection_history') is not null then
    delete from public.builder_selection_history where workspace_id = demo_workspace;
  end if;

  if to_regclass('public.builder_client_selections') is not null then
    delete from public.builder_client_selections where workspace_id = demo_workspace;
  end if;

  return public.reset_demo_company_stage2_seed_impl_20260817();
end;
$$;
