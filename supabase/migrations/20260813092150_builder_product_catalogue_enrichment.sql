-- Product catalogue import and enrichment pipeline.
-- Additive only. Does not touch estimating, quote calculations, takeoff, or selections layout.

alter table public.builder_products
  add column if not exists product_url text,
  add column if not exists listed_price numeric(14,2),
  add column if not exists trade_cost numeric(14,2),
  add column if not exists gst_included boolean,
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('csv', 'excel', 'manual', 'website', 'api', 'quote_sheet')),
  add column if not exists source_url text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists enrichment_status text not null default 'not_required'
    check (enrichment_status in ('not_required', 'queued', 'in_review', 'enriched', 'missing_image', 'missing_price', 'missing_image_and_price', 'failed'));

create table if not exists public.builder_product_import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_name text not null,
  source_type text not null default 'csv'
    check (source_type in ('csv', 'excel', 'manual', 'website', 'api', 'quote_sheet')),
  supplier_id uuid references public.builder_product_suppliers(id) on delete set null,
  source_url text,
  file_name text,
  imported_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  missing_image_count integer not null default 0,
  missing_price_count integer not null default 0,
  status text not null default 'completed'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.builder_product_enrichment_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid references public.builder_products(id) on delete cascade,
  supplier_id uuid references public.builder_product_suppliers(id) on delete set null,
  import_batch_id uuid references public.builder_product_import_batches(id) on delete set null,
  source_type text not null default 'website'
    check (source_type in ('csv', 'excel', 'manual', 'website', 'api', 'quote_sheet')),
  source_name text,
  source_url text,
  requested_fields text[] not null default array[]::text[],
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'enriched', 'missing_data', 'skipped', 'failed')),
  priority integer not null default 50,
  notes text,
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists builder_products_source_type_idx on public.builder_products(workspace_id, source_type);
create index if not exists builder_products_source_url_idx on public.builder_products(workspace_id, source_url);
create index if not exists builder_products_enrichment_status_idx on public.builder_products(workspace_id, enrichment_status);
create index if not exists builder_product_import_batches_workspace_idx on public.builder_product_import_batches(workspace_id, created_at desc);
create index if not exists builder_product_enrichment_queue_workspace_idx on public.builder_product_enrichment_queue(workspace_id, status, priority, created_at);
create index if not exists builder_product_enrichment_queue_product_idx on public.builder_product_enrichment_queue(workspace_id, product_id);

alter table public.builder_product_import_batches enable row level security;
alter table public.builder_product_enrichment_queue enable row level security;

drop policy if exists builder_product_import_batches_select on public.builder_product_import_batches;
create policy builder_product_import_batches_select
  on public.builder_product_import_batches for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_import_batches_insert on public.builder_product_import_batches;
create policy builder_product_import_batches_insert
  on public.builder_product_import_batches for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_import_batches_update on public.builder_product_import_batches;
create policy builder_product_import_batches_update
  on public.builder_product_import_batches for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_import_batches_delete on public.builder_product_import_batches;
create policy builder_product_import_batches_delete
  on public.builder_product_import_batches for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_enrichment_queue_select on public.builder_product_enrichment_queue;
create policy builder_product_enrichment_queue_select
  on public.builder_product_enrichment_queue for select
  using (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_enrichment_queue_insert on public.builder_product_enrichment_queue;
create policy builder_product_enrichment_queue_insert
  on public.builder_product_enrichment_queue for insert
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_enrichment_queue_update on public.builder_product_enrichment_queue;
create policy builder_product_enrichment_queue_update
  on public.builder_product_enrichment_queue for update
  using (public.builder_commercial_is_workspace_member(workspace_id))
  with check (public.builder_commercial_is_workspace_member(workspace_id));

drop policy if exists builder_product_enrichment_queue_delete on public.builder_product_enrichment_queue;
create policy builder_product_enrichment_queue_delete
  on public.builder_product_enrichment_queue for delete
  using (public.builder_commercial_is_workspace_member(workspace_id));
