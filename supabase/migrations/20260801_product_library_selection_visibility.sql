-- Formalise Product Library visibility for client selections without removing
-- existing estimating/rate rows used by Estimate Builder and BOQ.

alter table public.builder_products
  add column if not exists selection_visibility text not null default 'client_selectable'
    check (selection_visibility in ('client_selectable', 'builder_selectable', 'estimating_only', 'hidden', 'archived')),
  add column if not exists active_status text not null default 'active'
    check (active_status in ('active', 'inactive', 'archived')),
  add column if not exists discontinued_status text not null default 'current'
    check (discontinued_status in ('current', 'discontinued', 'unknown')),
  add column if not exists supplier_category_url text,
  add column if not exists warranty_url text;

update public.builder_products
set selection_visibility = case
    when library_scope = 'ESTIMATING' then 'estimating_only'
    when library_scope = 'BOTH' and coalesce(available_for_selection, true) then 'builder_selectable'
    when coalesce(available_for_selection, true) then 'client_selectable'
    else 'hidden'
  end,
  active_status = case when active = false then 'inactive' else 'active' end,
  discontinued_status = case when verification_status = 'discontinued' then 'discontinued' else discontinued_status end
where selection_visibility = 'client_selectable'
  or active_status = 'active';

create index if not exists builder_products_selection_visibility_idx
  on public.builder_products(workspace_id, selection_visibility, active_status, discontinued_status);
