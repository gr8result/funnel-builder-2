-- Track whether imported catalogue rows have a usable product model.
-- Additive only. Does not alter estimating, quote calculations, takeoff, or selections.

alter table public.builder_products
  add column if not exists model_status text not null default 'present'
    check (model_status in ('present', 'missing', 'not_required', 'needs_review'));

create index if not exists builder_products_model_status_idx
  on public.builder_products(workspace_id, model_status);
