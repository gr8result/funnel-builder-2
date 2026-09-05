-- Estimate Builder commercial backbone extension - Stage 1.
-- Additive only. The existing workbook remains the source of truth.
-- These tables snapshot workbook output and store commercial records around it.

create extension if not exists pgcrypto;

create or replace function public.builder_commercial_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.builder_commercial_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
  );
$$;

create table if not exists public.builder_commercial_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  existing_project_id uuid,
  existing_project_table text not null default 'projects',
  source_workbook_job_id text,
  source_workbook_file_name text,
  source_registered_job_id text,
  source_quote_number text,
  project_name text not null,
  client_name text,
  client_email text,
  client_phone text,
  site_address text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  original_estimate_total numeric(14, 2) not null default 0,
  approved_variations_total numeric(14, 2) not null default 0,
  contract_total numeric(14, 2) not null default 0,
  currency text not null default 'AUD',
  source_metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.builder_estimate_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_number integer not null default 1,
  snapshot_label text,
  status text not null default 'draft'
    check (status in ('draft', 'current', 'superseded', 'approved', 'void')),
  source_workbook_job_id text,
  source_workbook_file_name text,
  source_registered_job_id text,
  source_quote_number text,
  source_quote_date date,
  source_quote_version text,
  source_template_key text,
  source_template_name text,
  summary jsonb not null default '{}'::jsonb,
  workbook_metadata jsonb not null default '{}'::jsonb,
  workbook_snapshot jsonb,
  base_line_item_subtotal numeric(14, 2) not null default 0,
  preliminaries_total numeric(14, 2) not null default 0,
  overheads_total numeric(14, 2) not null default 0,
  margin_total numeric(14, 2) not null default 0,
  profit_total numeric(14, 2) not null default 0,
  gst_total numeric(14, 2) not null default 0,
  fees_total numeric(14, 2) not null default 0,
  sales_commission_total numeric(14, 2) not null default 0,
  final_quote_total numeric(14, 2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, snapshot_number),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.builder_boq_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid not null,
  source_section_key text not null,
  source_section_name text not null,
  display_name text,
  section_number text,
  sort_order integer not null default 0,
  subtotal numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'excluded', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, snapshot_id, source_section_key),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete cascade
);

create table if not exists public.builder_suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  trade_category text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'preferred', 'blocked', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, name)
);

create table if not exists public.builder_supplier_price_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid,
  name text not null,
  description text,
  source_file_name text,
  import_status text not null default 'draft'
    check (import_status in ('draft', 'importing', 'imported', 'failed', 'archived')),
  currency text not null default 'AUD',
  effective_from date,
  effective_to date,
  imported_at timestamptz,
  import_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null
);

create table if not exists public.builder_supplier_price_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid,
  price_book_id uuid,
  sku text,
  item_code text,
  description text not null,
  category text,
  unit text,
  unit_cost numeric(14, 4) not null default 0,
  gst_rate numeric(8, 4) not null default 10,
  currency text not null default 'AUD',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'discontinued', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null,
  foreign key (price_book_id, workspace_id)
    references public.builder_supplier_price_books(id, workspace_id) on delete cascade
);

create table if not exists public.builder_boq_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid not null,
  section_id uuid,
  supplier_id uuid,
  supplier_price_item_id uuid,
  source_quote_row_id text,
  source_excel_row text,
  source_section_key text,
  source_section_name text,
  item_name text not null,
  description text,
  quantity numeric(14, 4) not null default 0,
  unit text,
  unit_rate numeric(14, 4) not null default 0,
  line_total numeric(14, 2) not null default 0,
  rate_source text,
  line_type text,
  cost_code text,
  sort_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'excluded', 'quote_required', 'archived')),
  source_row jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete cascade,
  foreign key (section_id, workspace_id)
    references public.builder_boq_sections(id, workspace_id) on delete set null,
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null,
  foreign key (supplier_price_item_id, workspace_id)
    references public.builder_supplier_price_items(id, workspace_id) on delete set null
);

create table if not exists public.builder_procurement_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  supplier_id uuid,
  source_quote_row_id text,
  source_procurement_item_id text,
  item_name text not null,
  description text,
  section_name text,
  procurement_category text,
  quantity numeric(14, 4) not null default 0,
  unit text,
  estimated_rate numeric(14, 4) not null default 0,
  estimated_total numeric(14, 2) not null default 0,
  required_by date,
  order_by date,
  order_status text not null default 'not_started',
  delivery_status text not null default 'not_required_yet',
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'removed_from_quote', 'ordered', 'delivered', 'cancelled', 'archived')),
  source_item jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null,
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null
);

create table if not exists public.builder_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  supplier_id uuid,
  po_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'part_received', 'received', 'cancelled', 'closed')),
  supplier_name text,
  supplier_email text,
  issue_date date,
  required_by date,
  issued_at timestamptz,
  subtotal numeric(14, 2) not null default 0,
  gst_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  delivery_address text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, po_number),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null
);

create table if not exists public.builder_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  purchase_order_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  procurement_item_id uuid,
  supplier_price_item_id uuid,
  source_quote_row_id text,
  source_procurement_item_id text,
  description text not null,
  quantity_ordered numeric(14, 4) not null default 0,
  quantity_received numeric(14, 4) not null default 0,
  unit text,
  unit_cost numeric(14, 4) not null default 0,
  gst_rate numeric(8, 4) not null default 10,
  line_total numeric(14, 2) not null default 0,
  status text not null default 'ordered'
    check (status in ('draft', 'ordered', 'part_received', 'received', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (purchase_order_id, workspace_id)
    references public.builder_purchase_orders(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null,
  foreign key (procurement_item_id, workspace_id)
    references public.builder_procurement_items(id, workspace_id) on delete set null,
  foreign key (supplier_price_item_id, workspace_id)
    references public.builder_supplier_price_items(id, workspace_id) on delete set null
);

create table if not exists public.builder_quote_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  approval_number text,
  approval_type text not null default 'original_quote'
    check (approval_type in ('original_quote', 'variation', 'selection', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'approved', 'declined', 'void', 'superseded')),
  approved_amount numeric(14, 2) not null default 0,
  signer_name text,
  signer_email text,
  signer_ip text,
  signed_at timestamptz,
  signature_data_url text,
  document_url text,
  document_hash text,
  approval_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null
);

create table if not exists public.builder_variations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  approval_id uuid,
  variation_number text not null,
  title text not null,
  reason text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'void', 'invoiced')),
  subtotal numeric(14, 2) not null default 0,
  gst_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  margin_total numeric(14, 2) not null default 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  approved_by_email text,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, variation_number),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (approval_id, workspace_id)
    references public.builder_quote_approvals(id, workspace_id) on delete set null
);

create table if not exists public.builder_variation_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  variation_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  source_quote_row_id text,
  source_section_name text,
  description text not null,
  quantity numeric(14, 4) not null default 0,
  unit text,
  unit_cost numeric(14, 4) not null default 0,
  unit_price numeric(14, 4) not null default 0,
  gst_rate numeric(8, 4) not null default 10,
  cost_total numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  status text not null default 'active'
    check (status in ('active', 'excluded', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (variation_id, workspace_id)
    references public.builder_variations(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null
);

create table if not exists public.builder_supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  purchase_order_id uuid,
  supplier_id uuid,
  supplier_name text,
  invoice_number text not null,
  status text not null default 'received'
    check (status in ('draft', 'received', 'approved', 'paid', 'disputed', 'void')),
  invoice_date date,
  due_date date,
  approved_at timestamptz,
  paid_at timestamptz,
  subtotal numeric(14, 2) not null default 0,
  gst_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  document_url text,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, supplier_id, invoice_number),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (purchase_order_id, workspace_id)
    references public.builder_purchase_orders(id, workspace_id) on delete set null,
  foreign key (supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null
);

create table if not exists public.builder_supplier_invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  supplier_invoice_id uuid not null,
  purchase_order_item_id uuid,
  boq_item_id uuid,
  source_quote_row_id text,
  description text not null,
  quantity numeric(14, 4) not null default 0,
  unit text,
  unit_cost numeric(14, 4) not null default 0,
  gst_rate numeric(8, 4) not null default 10,
  line_total numeric(14, 2) not null default 0,
  status text not null default 'active'
    check (status in ('active', 'excluded', 'disputed', 'void')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (supplier_invoice_id, workspace_id)
    references public.builder_supplier_invoices(id, workspace_id) on delete cascade,
  foreign key (purchase_order_item_id, workspace_id)
    references public.builder_purchase_order_items(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null
);

create table if not exists public.builder_budget_actuals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  source_quote_row_id text,
  section_name text,
  cost_code text,
  description text not null,
  original_estimate_amount numeric(14, 2) not null default 0,
  approved_variations_amount numeric(14, 2) not null default 0,
  purchase_order_committed_amount numeric(14, 2) not null default 0,
  supplier_invoice_actual_amount numeric(14, 2) not null default 0,
  remaining_budget_amount numeric(14, 2) generated always as (
    original_estimate_amount
    + approved_variations_amount
    - greatest(purchase_order_committed_amount, supplier_invoice_actual_amount)
  ) stored,
  forecast_final_amount numeric(14, 2) generated always as (
    greatest(purchase_order_committed_amount, supplier_invoice_actual_amount)
  ) stored,
  status text not null default 'active'
    check (status in ('active', 'allowance', 'over_budget', 'closed', 'excluded')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null
);

create table if not exists public.builder_client_selections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  variation_id uuid,
  source_quote_row_id text,
  category text,
  title text not null,
  description text,
  included_in_contract boolean not null default true,
  allowance_amount numeric(14, 2) not null default 0,
  selected_product_name text,
  selected_supplier_id uuid,
  selected_supplier_name text,
  selected_colour text,
  selected_finish text,
  selected_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'selected', 'approved', 'declined', 'changed', 'cancelled')),
  required_by date,
  selected_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null,
  foreign key (variation_id, workspace_id)
    references public.builder_variations(id, workspace_id) on delete set null,
  foreign key (selected_supplier_id, workspace_id)
    references public.builder_suppliers(id, workspace_id) on delete set null
);

create table if not exists public.builder_project_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  document_type text not null default 'general'
    check (document_type in (
      'general',
      'estimate_snapshot',
      'quote',
      'approval',
      'variation',
      'purchase_order',
      'supplier_invoice',
      'selection',
      'rfi',
      'contract',
      'photo',
      'other'
    )),
  title text not null,
  description text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  storage_bucket text,
  storage_path text,
  public_url text,
  related_table text,
  related_record_id uuid,
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null
);

create table if not exists public.builder_rfis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  snapshot_id uuid,
  boq_item_id uuid,
  client_selection_id uuid,
  source_quote_row_id text,
  rfi_number text not null,
  subject text not null,
  question text not null,
  answer text,
  status text not null default 'open'
    check (status in ('open', 'answered', 'closed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  asked_by_name text,
  asked_by_email text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  answered_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, rfi_number),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade,
  foreign key (snapshot_id, workspace_id)
    references public.builder_estimate_snapshots(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id)
    references public.builder_boq_items(id, workspace_id) on delete set null,
  foreign key (client_selection_id, workspace_id)
    references public.builder_client_selections(id, workspace_id) on delete set null
);

create index if not exists builder_commercial_projects_workspace_idx on public.builder_commercial_projects(workspace_id);
create index if not exists builder_commercial_projects_existing_project_idx on public.builder_commercial_projects(workspace_id, existing_project_id);
create index if not exists builder_commercial_projects_workbook_job_idx on public.builder_commercial_projects(workspace_id, source_workbook_job_id);

create index if not exists builder_estimate_snapshots_workspace_idx on public.builder_estimate_snapshots(workspace_id);
create index if not exists builder_estimate_snapshots_project_idx on public.builder_estimate_snapshots(workspace_id, project_id);
create index if not exists builder_estimate_snapshots_workbook_job_idx on public.builder_estimate_snapshots(workspace_id, source_workbook_job_id);

create index if not exists builder_boq_sections_workspace_idx on public.builder_boq_sections(workspace_id);
create index if not exists builder_boq_sections_project_idx on public.builder_boq_sections(workspace_id, project_id);
create index if not exists builder_boq_sections_snapshot_idx on public.builder_boq_sections(workspace_id, snapshot_id);

create index if not exists builder_boq_items_workspace_idx on public.builder_boq_items(workspace_id);
create index if not exists builder_boq_items_project_idx on public.builder_boq_items(workspace_id, project_id);
create index if not exists builder_boq_items_snapshot_idx on public.builder_boq_items(workspace_id, snapshot_id);
create index if not exists builder_boq_items_source_quote_row_idx on public.builder_boq_items(workspace_id, source_quote_row_id);
create index if not exists builder_boq_items_supplier_idx on public.builder_boq_items(workspace_id, supplier_id);

create index if not exists builder_suppliers_workspace_idx on public.builder_suppliers(workspace_id);
create index if not exists builder_supplier_price_books_workspace_idx on public.builder_supplier_price_books(workspace_id);
create index if not exists builder_supplier_price_books_supplier_idx on public.builder_supplier_price_books(workspace_id, supplier_id);
create index if not exists builder_supplier_price_items_workspace_idx on public.builder_supplier_price_items(workspace_id);
create index if not exists builder_supplier_price_items_supplier_idx on public.builder_supplier_price_items(workspace_id, supplier_id);

create index if not exists builder_procurement_items_workspace_idx on public.builder_procurement_items(workspace_id);
create index if not exists builder_procurement_items_project_idx on public.builder_procurement_items(workspace_id, project_id);
create index if not exists builder_procurement_items_snapshot_idx on public.builder_procurement_items(workspace_id, snapshot_id);
create index if not exists builder_procurement_items_source_quote_row_idx on public.builder_procurement_items(workspace_id, source_quote_row_id);
create index if not exists builder_procurement_items_supplier_idx on public.builder_procurement_items(workspace_id, supplier_id);

create index if not exists builder_purchase_orders_workspace_idx on public.builder_purchase_orders(workspace_id);
create index if not exists builder_purchase_orders_project_idx on public.builder_purchase_orders(workspace_id, project_id);
create index if not exists builder_purchase_orders_snapshot_idx on public.builder_purchase_orders(workspace_id, snapshot_id);
create index if not exists builder_purchase_orders_supplier_idx on public.builder_purchase_orders(workspace_id, supplier_id);

create index if not exists builder_purchase_order_items_workspace_idx on public.builder_purchase_order_items(workspace_id);
create index if not exists builder_purchase_order_items_project_idx on public.builder_purchase_order_items(workspace_id, project_id);
create index if not exists builder_purchase_order_items_source_quote_row_idx on public.builder_purchase_order_items(workspace_id, source_quote_row_id);

create index if not exists builder_variations_workspace_idx on public.builder_variations(workspace_id);
create index if not exists builder_variations_project_idx on public.builder_variations(workspace_id, project_id);
create index if not exists builder_variations_snapshot_idx on public.builder_variations(workspace_id, snapshot_id);

create index if not exists builder_variation_items_workspace_idx on public.builder_variation_items(workspace_id);
create index if not exists builder_variation_items_project_idx on public.builder_variation_items(workspace_id, project_id);
create index if not exists builder_variation_items_source_quote_row_idx on public.builder_variation_items(workspace_id, source_quote_row_id);

create index if not exists builder_budget_actuals_workspace_idx on public.builder_budget_actuals(workspace_id);
create index if not exists builder_budget_actuals_project_idx on public.builder_budget_actuals(workspace_id, project_id);
create index if not exists builder_budget_actuals_snapshot_idx on public.builder_budget_actuals(workspace_id, snapshot_id);
create index if not exists builder_budget_actuals_source_quote_row_idx on public.builder_budget_actuals(workspace_id, source_quote_row_id);

create index if not exists builder_client_selections_workspace_idx on public.builder_client_selections(workspace_id);
create index if not exists builder_client_selections_project_idx on public.builder_client_selections(workspace_id, project_id);
create index if not exists builder_client_selections_snapshot_idx on public.builder_client_selections(workspace_id, snapshot_id);
create index if not exists builder_client_selections_source_quote_row_idx on public.builder_client_selections(workspace_id, source_quote_row_id);
create index if not exists builder_client_selections_supplier_idx on public.builder_client_selections(workspace_id, selected_supplier_id);

create index if not exists builder_quote_approvals_workspace_idx on public.builder_quote_approvals(workspace_id);
create index if not exists builder_quote_approvals_project_idx on public.builder_quote_approvals(workspace_id, project_id);
create index if not exists builder_quote_approvals_snapshot_idx on public.builder_quote_approvals(workspace_id, snapshot_id);

create index if not exists builder_project_documents_workspace_idx on public.builder_project_documents(workspace_id);
create index if not exists builder_project_documents_project_idx on public.builder_project_documents(workspace_id, project_id);
create index if not exists builder_project_documents_snapshot_idx on public.builder_project_documents(workspace_id, snapshot_id);

create index if not exists builder_rfis_workspace_idx on public.builder_rfis(workspace_id);
create index if not exists builder_rfis_project_idx on public.builder_rfis(workspace_id, project_id);
create index if not exists builder_rfis_snapshot_idx on public.builder_rfis(workspace_id, snapshot_id);
create index if not exists builder_rfis_source_quote_row_idx on public.builder_rfis(workspace_id, source_quote_row_id);

create index if not exists builder_supplier_invoices_workspace_idx on public.builder_supplier_invoices(workspace_id);
create index if not exists builder_supplier_invoices_project_idx on public.builder_supplier_invoices(workspace_id, project_id);
create index if not exists builder_supplier_invoices_supplier_idx on public.builder_supplier_invoices(workspace_id, supplier_id);

create index if not exists builder_supplier_invoice_items_workspace_idx on public.builder_supplier_invoice_items(workspace_id);
create index if not exists builder_supplier_invoice_items_project_idx on public.builder_supplier_invoice_items(workspace_id, project_id);
create index if not exists builder_supplier_invoice_items_source_quote_row_idx on public.builder_supplier_invoice_items(workspace_id, source_quote_row_id);

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'builder_commercial_projects',
    'builder_estimate_snapshots',
    'builder_boq_sections',
    'builder_boq_items',
    'builder_suppliers',
    'builder_supplier_price_books',
    'builder_supplier_price_items',
    'builder_procurement_items',
    'builder_purchase_orders',
    'builder_purchase_order_items',
    'builder_variations',
    'builder_variation_items',
    'builder_budget_actuals',
    'builder_client_selections',
    'builder_quote_approvals',
    'builder_project_documents',
    'builder_rfis',
    'builder_supplier_invoices',
    'builder_supplier_invoice_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table_name);

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = v_table_name || '_workspace_select'
    ) then
      execute format(
        'create policy %I on public.%I for select using (public.builder_commercial_is_workspace_member(workspace_id))',
        v_table_name || '_workspace_select',
        v_table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = v_table_name || '_workspace_insert'
    ) then
      execute format(
        'create policy %I on public.%I for insert with check (public.builder_commercial_is_workspace_member(workspace_id))',
        v_table_name || '_workspace_insert',
        v_table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = v_table_name || '_workspace_update'
    ) then
      execute format(
        'create policy %I on public.%I for update using (public.builder_commercial_is_workspace_member(workspace_id)) with check (public.builder_commercial_is_workspace_member(workspace_id))',
        v_table_name || '_workspace_update',
        v_table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = v_table_name || '_workspace_delete'
    ) then
      execute format(
        'create policy %I on public.%I for delete using (public.builder_commercial_is_workspace_member(workspace_id))',
        v_table_name || '_workspace_delete',
        v_table_name
      );
    end if;
  end loop;
end $$;

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'builder_commercial_projects',
    'builder_estimate_snapshots',
    'builder_boq_sections',
    'builder_boq_items',
    'builder_suppliers',
    'builder_supplier_price_books',
    'builder_supplier_price_items',
    'builder_procurement_items',
    'builder_purchase_orders',
    'builder_purchase_order_items',
    'builder_variations',
    'builder_variation_items',
    'builder_budget_actuals',
    'builder_client_selections',
    'builder_quote_approvals',
    'builder_project_documents',
    'builder_rfis',
    'builder_supplier_invoices',
    'builder_supplier_invoice_items'
  ]
  loop
    if not exists (
      select 1
      from pg_trigger
      where tgname = v_table_name || '_set_updated_at'
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.builder_commercial_set_updated_at()',
        v_table_name || '_set_updated_at',
        v_table_name
      );
    end if;
  end loop;
end $$;
