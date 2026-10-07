-- Builder estimating backbone - Stage 1
-- Commercial estimating data model only.
-- Does not touch PDF plan importing, plan orientation, measurements, or takeoff engine tables.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create table if not exists public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_number text,
  name text not null,
  description text,
  client_name text,
  client_email text,
  client_phone text,
  site_address text,
  suburb text,
  state text,
  postcode text,
  status text not null default 'draft' check (status in ('draft', 'estimating', 'quoted', 'accepted', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  budget_status text not null default 'not_started' check (budget_status in ('not_started', 'draft', 'approved', 'tracking', 'over_budget', 'closed')),
  estimate_total numeric(14,2) not null default 0,
  approved_budget numeric(14,2) not null default 0,
  contract_value numeric(14,2) not null default 0,
  actual_cost_total numeric(14,2) not null default 0,
  start_date date,
  target_completion_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_number)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trading_name text,
  abn text,
  status text not null default 'active' check (status in ('active', 'preferred', 'inactive', 'archived')),
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address text,
  payment_terms text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.boq_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  name text not null,
  description text,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'optional', 'excluded', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade
);

create table if not exists public.supplier_price_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'importing', 'active', 'superseded', 'archived')),
  currency text not null default 'AUD',
  effective_from date,
  effective_to date,
  import_source text,
  import_file_name text,
  import_file_path text,
  import_status text not null default 'not_imported' check (import_status in ('not_imported', 'queued', 'processing', 'completed', 'failed')),
  import_error text,
  imported_at timestamptz,
  imported_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete cascade
);

create table if not exists public.supplier_price_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null,
  price_book_id uuid not null,
  sku text,
  item_code text,
  description text not null,
  category text,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  unit_sell numeric(14,4),
  tax_rate numeric(6,4) not null default 0,
  currency text not null default 'AUD',
  status text not null default 'active' check (status in ('active', 'inactive', 'superseded', 'archived')),
  effective_from date,
  effective_to date,
  raw_import_row jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete cascade,
  foreign key (price_book_id, workspace_id) references public.supplier_price_books(id, workspace_id) on delete cascade
);

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  section_id uuid,
  supplier_id uuid,
  supplier_price_item_id uuid,
  item_code text,
  description text not null,
  scope_notes text,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  unit_sell numeric(14,4) not null default 0,
  markup_percent numeric(8,4) not null default 0,
  tax_rate numeric(6,4) not null default 0,
  cost_total numeric(14,2) generated always as (round((quantity * unit_cost)::numeric, 2)) stored,
  sell_total numeric(14,2) generated always as (round((quantity * unit_sell)::numeric, 2)) stored,
  status text not null default 'draft' check (status in ('draft', 'included', 'optional', 'excluded', 'approved', 'ordered', 'completed', 'archived')),
  source text not null default 'manual' check (source in ('manual', 'price_book', 'import', 'template', 'variation')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (section_id, workspace_id) references public.boq_sections(id, workspace_id) on delete set null,
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete set null,
  foreign key (supplier_price_item_id, workspace_id) references public.supplier_price_items(id, workspace_id) on delete set null
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  supplier_id uuid not null,
  po_number text,
  title text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'sent', 'part_received', 'received', 'cancelled', 'closed')),
  currency text not null default 'AUD',
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  ordered_at timestamptz,
  expected_delivery_at timestamptz,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, po_number),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete restrict
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  purchase_order_id uuid not null,
  project_id uuid not null,
  boq_item_id uuid,
  supplier_price_item_id uuid,
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  tax_rate numeric(6,4) not null default 0,
  line_total numeric(14,2) generated always as (round((quantity * unit_cost)::numeric, 2)) stored,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'part_received', 'received', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (purchase_order_id, workspace_id) references public.purchase_orders(id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (boq_item_id, workspace_id) references public.boq_items(id, workspace_id) on delete set null,
  foreign key (supplier_price_item_id, workspace_id) references public.supplier_price_items(id, workspace_id) on delete set null
);

create table if not exists public.variations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  variation_number text,
  title text not null,
  description text,
  reason text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'client_review', 'approved', 'rejected', 'withdrawn', 'completed')),
  cost_total numeric(14,2) not null default 0,
  sell_total numeric(14,2) not null default 0,
  impact_days integer not null default 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, variation_number),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade
);

create table if not exists public.variation_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  variation_id uuid not null,
  project_id uuid not null,
  boq_item_id uuid,
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  unit_sell numeric(14,4) not null default 0,
  cost_total numeric(14,2) generated always as (round((quantity * unit_cost)::numeric, 2)) stored,
  sell_total numeric(14,2) generated always as (round((quantity * unit_sell)::numeric, 2)) stored,
  status text not null default 'draft' check (status in ('draft', 'included', 'excluded', 'approved')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (variation_id, workspace_id) references public.variations(id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (boq_item_id, workspace_id) references public.boq_items(id, workspace_id) on delete set null
);

create table if not exists public.client_selections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  supplier_id uuid,
  boq_item_id uuid,
  selection_category text not null,
  item_name text not null,
  description text,
  allowance_amount numeric(14,2) not null default 0,
  selected_amount numeric(14,2) not null default 0,
  variance_amount numeric(14,2) generated always as (round((selected_amount - allowance_amount)::numeric, 2)) stored,
  status text not null default 'pending' check (status in ('pending', 'client_review', 'selected', 'approved', 'ordered', 'installed', 'declined', 'archived')),
  required_by date,
  selected_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete set null,
  foreign key (boq_item_id, workspace_id) references public.boq_items(id, workspace_id) on delete set null
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  supplier_id uuid,
  document_type text not null default 'general' check (document_type in ('general', 'quote', 'contract', 'plan', 'specification', 'invoice', 'receipt', 'purchase_order', 'variation', 'selection', 'approval', 'rfi', 'photo', 'other')),
  title text not null,
  description text,
  storage_bucket text,
  storage_path text,
  public_url text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived', 'deleted')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (supplier_id, workspace_id) references public.suppliers(id, workspace_id) on delete set null
);

create table if not exists public.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  signed_document_id uuid,
  acceptance_number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'revoked')),
  quote_total numeric(14,2) not null default 0,
  client_name text not null,
  client_email text,
  client_phone text,
  acceptance_method text not null default 'manual' check (acceptance_method in ('manual', 'email_link', 'e_signature', 'uploaded_document')),
  signature_name text,
  signature_data text,
  ip_address inet,
  user_agent text,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, acceptance_number),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade,
  foreign key (signed_document_id, workspace_id) references public.project_documents(id, workspace_id) on delete set null
);

create table if not exists public.rfi_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  rfi_number text,
  subject text not null,
  question text not null,
  answer text,
  status text not null default 'open' check (status in ('draft', 'open', 'answered', 'closed', 'void')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  answered_at timestamptz,
  raised_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  answered_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_id, rfi_number),
  foreign key (project_id, workspace_id) references public.builder_projects(id, workspace_id) on delete cascade
);

create index if not exists builder_projects_workspace_idx on public.builder_projects(workspace_id);
create index if not exists builder_projects_status_idx on public.builder_projects(workspace_id, status);
create index if not exists boq_sections_project_idx on public.boq_sections(workspace_id, project_id);
create index if not exists boq_items_project_idx on public.boq_items(workspace_id, project_id);
create index if not exists boq_items_section_idx on public.boq_items(workspace_id, section_id);
create index if not exists suppliers_workspace_idx on public.suppliers(workspace_id);
create index if not exists supplier_price_books_supplier_idx on public.supplier_price_books(workspace_id, supplier_id);
create index if not exists supplier_price_items_book_idx on public.supplier_price_items(workspace_id, price_book_id);
create index if not exists supplier_price_items_supplier_idx on public.supplier_price_items(workspace_id, supplier_id);
create index if not exists purchase_orders_project_idx on public.purchase_orders(workspace_id, project_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders(workspace_id, supplier_id);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items(workspace_id, purchase_order_id);
create index if not exists variations_project_idx on public.variations(workspace_id, project_id);
create index if not exists variation_items_variation_idx on public.variation_items(workspace_id, variation_id);
create index if not exists client_selections_project_idx on public.client_selections(workspace_id, project_id);
create index if not exists project_documents_project_idx on public.project_documents(workspace_id, project_id);
create index if not exists quote_acceptances_project_idx on public.quote_acceptances(workspace_id, project_id);
create index if not exists rfi_questions_project_idx on public.rfi_questions(workspace_id, project_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'builder_projects',
    'boq_sections',
    'boq_items',
    'suppliers',
    'supplier_price_books',
    'supplier_price_items',
    'purchase_orders',
    'purchase_order_items',
    'variations',
    'variation_items',
    'client_selections',
    'project_documents',
    'quote_acceptances',
    'rfi_questions'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_updated_at',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'builder_projects',
    'boq_sections',
    'boq_items',
    'suppliers',
    'supplier_price_books',
    'supplier_price_items',
    'purchase_orders',
    'purchase_order_items',
    'variations',
    'variation_items',
    'client_selections',
    'project_documents',
    'quote_acceptances',
    'rfi_questions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_select', table_name);
    execute format(
      'create policy %I on public.%I for select using (public.is_workspace_member(workspace_id))',
      table_name || '_workspace_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (public.is_workspace_member(workspace_id))',
      table_name || '_workspace_insert',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_update', table_name);
    execute format(
      'create policy %I on public.%I for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      table_name || '_workspace_update',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete using (public.is_workspace_member(workspace_id))',
      table_name || '_workspace_delete',
      table_name
    );
  end loop;
end $$;
