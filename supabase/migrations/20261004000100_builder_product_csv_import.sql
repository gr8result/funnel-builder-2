-- Additive staging only: existing tenant ownership, RLS, jobs and pricing snapshots are unchanged.
create table public.builder_product_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  plan jsonb not null,
  baseline jsonb not null,
  report jsonb
);
alter table public.builder_product_imports enable row level security;
revoke all on public.builder_product_imports from public, authenticated;
grant select, insert on public.builder_product_imports to service_role;

create function public.commit_builder_product_import(p_workspace uuid, p_user uuid, p_batch uuid, p_rows integer[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  batch public.builder_product_imports;
  entry jsonb;
  payload public.builder_products;
  actual jsonb;
  result jsonb;
  made integer := 0;
  changed integer := 0;
begin
  if not exists (select 1 from workspace_members where workspace_id = p_workspace and user_id = p_user and status = 'active' and role in ('owner','admin')) then
    raise exception 'Builder administrator required';
  end if;
  select * into batch from builder_product_imports where id = p_batch and workspace_id = p_workspace and created_by = p_user for update;
  if not found then raise exception 'Preview not found in this workspace'; end if;
  if batch.report is not null then return batch.report; end if;
  if batch.expires_at < now() then raise exception 'Preview expired; preview again'; end if;
  if coalesce(cardinality(p_rows),0) = 0 then raise exception 'Select at least one valid row'; end if;
  -- Prevent concurrent inserts, edits or imports between the stale check and commit.
  lock table builder_products, builder_product_suppliers, builder_selection_aliases in share row exclusive mode;
  select jsonb_build_object(
    'products', coalesce((select jsonb_object_agg(id,to_jsonb(p)) from builder_products p where workspace_id=p_workspace),'{}'::jsonb),
    'suppliers', coalesce((select jsonb_object_agg(id,to_jsonb(s)) from builder_product_suppliers s where workspace_id=p_workspace),'{}'::jsonb),
    'aliases', coalesce((select jsonb_object_agg(id,to_jsonb(a)) from builder_selection_aliases a where workspace_id=p_workspace),'{}'::jsonb)
  ) into actual;
  if actual <> batch.baseline then raise exception 'Library or mappings changed; preview again before importing'; end if;
  if exists (select 1 from unnest(p_rows) n where not exists (select 1 from jsonb_array_elements(batch.plan->'rows') r where (r->>'row')::integer=n and r->>'action' in ('NEW','UPDATE','UNCHANGED'))) then
    raise exception 'Only valid preview rows can be committed';
  end if;
  for entry in select value from jsonb_array_elements(batch.plan->'rows') where (value->>'row')::integer = any(p_rows) loop
    if entry->>'action' in ('NEW','UPDATE') then
      payload := jsonb_populate_record(null::builder_products, coalesce(nullif(entry->'before','null'::jsonb),'{}'::jsonb) || (entry->'patch'));
      if entry->>'action' = 'NEW' then
        insert into builder_products(workspace_id,product_name,sku,description,unit,selection_slot_ids,base_allowance,upgrade_cost,primary_image_url,active,metadata,created_by,updated_by)
        values(p_workspace,payload.product_name,payload.sku,payload.description,payload.unit,payload.selection_slot_ids,coalesce(payload.base_allowance,0),coalesce(payload.upgrade_cost,0),payload.primary_image_url,coalesce(payload.active,true),payload.metadata,p_user,p_user);
        made := made + 1;
      else
        update builder_products set product_name=payload.product_name,sku=payload.sku,description=payload.description,unit=payload.unit,
          selection_slot_ids=payload.selection_slot_ids,base_allowance=payload.base_allowance,upgrade_cost=payload.upgrade_cost,
          primary_image_url=payload.primary_image_url,active=payload.active,metadata=payload.metadata,updated_at=now(),updated_by=p_user
          where id=(entry->>'id')::uuid and workspace_id=p_workspace;
        if not found then raise exception 'Product no longer belongs to this workspace'; end if;
        changed := changed + 1;
      end if;
    end if;
    if entry->'alias' <> 'null'::jsonb then
      insert into builder_selection_aliases(workspace_id,alias,selection_slot_id)
      values(p_workspace,entry->'alias'->>'alias',entry->'alias'->>'selection_slot_id')
      on conflict(workspace_id,alias) do update set selection_slot_id=excluded.selection_slot_id,updated_at=now();
    end if;
  end loop;
  result := (batch.plan->'report') || jsonb_build_object('NEW',made,'UPDATE',changed,'excluded',jsonb_array_length(batch.plan->'rows')-(select count(distinct n) from unnest(p_rows) n));
  update builder_product_imports set report=result where id=p_batch and workspace_id=p_workspace;
  return result;
end $$;
revoke all on function public.commit_builder_product_import(uuid,uuid,uuid,integer[]) from public, authenticated;
grant execute on function public.commit_builder_product_import(uuid,uuid,uuid,integer[]) to service_role;
