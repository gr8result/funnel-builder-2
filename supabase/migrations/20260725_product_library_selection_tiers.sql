-- Product Library → Client Selections catalogue: cumulative pricing tiers + full
-- variation breakdown. Additive only — no drop/rename/retype of existing columns,
-- no id regeneration. Reuses the existing builder_client_selections /
-- builder_selection_sessions / builder_selection_budget_settings engine rather
-- than creating a parallel store.

-- 1. Product pricing tier (Classic ⊂ Premier ⊂ Premium). Distinct from the existing
--    price_band (budget/mid_range/higher_end/luxury) and library_scope. Nullable;
--    a product with no tier is treated as CLASSIC by the access logic.
alter table public.builder_products
  add column if not exists pricing_tier text
    check (pricing_tier in ('CLASSIC', 'PREMIER', 'PREMIUM'));

create index if not exists builder_products_pricing_tier_idx
  on public.builder_products(workspace_id, pricing_tier);

-- 2. Project inclusions package tier. builder_commercial_projects stored no tier at all.
alter table public.builder_commercial_projects
  add column if not exists pricing_tier text
    check (pricing_tier in ('CLASSIC', 'PREMIER', 'PREMIUM'));

-- 3. Per-project/session pricing config for the FULL variation formula. The existing
--    settings row only carried builder markup + GST; overhead/commission/admin-fee/
--    wastage previously existed only inside the Estimate Builder workbook JSON. Adding
--    them here keeps the calculator config-driven, never hard-coded.
alter table public.builder_selection_budget_settings
  add column if not exists default_overhead_percent numeric(8, 4) not null default 0,
  add column if not exists default_sales_commission_percent numeric(8, 4) not null default 0,
  add column if not exists variation_admin_fee numeric(14, 2) not null default 0,
  add column if not exists default_wastage_percent numeric(8, 4) not null default 0;

-- 4. Selection-row breakdown columns the brief's PROJECT SELECTION model needs and that
--    aren't already present. (included_allowance, supplier_cost, builder_cost,
--    installation_cost, builder_markup_percent, gst_rate, variation_amount,
--    calculated_client_selection_price, client_selection_price, room, category,
--    selection_status, is_active already exist — not re-added.)
alter table public.builder_client_selections
  add column if not exists product_id uuid references public.builder_products(id) on delete set null,
  add column if not exists pricing_tier text,
  add column if not exists quantity numeric(14, 3) not null default 1,
  add column if not exists allowance_unit_value numeric(14, 2),
  add column if not exists additional_costs numeric(14, 2) not null default 0,
  add column if not exists markup_amount numeric(14, 2) not null default 0,
  add column if not exists overhead_amount numeric(14, 2) not null default 0,
  add column if not exists commission_amount numeric(14, 2) not null default 0,
  add column if not exists administration_fee numeric(14, 2) not null default 0,
  add column if not exists wastage_amount numeric(14, 2) not null default 0,
  add column if not exists gst_amount numeric(14, 2) not null default 0;

create index if not exists builder_client_selections_product_idx
  on public.builder_client_selections(workspace_id, product_id)
  where product_id is not null;
