create table if not exists public.standard_inclusions_documents (
  id text primary key,
  tenant_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  allowed_editor_user_ids uuid[] not null default '{}',
  version integer not null default 1 check (version > 0),
  source_type text not null default 'pptx-upload',
  source_file_name text not null default 'Standard Inclusions.pptx',
  current_pptx_asset_id text not null,
  current_exported_pdf_asset_id text,
  revision_history jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists standard_inclusions_documents_tenant_idx
  on public.standard_inclusions_documents (tenant_id);

create index if not exists standard_inclusions_documents_owner_idx
  on public.standard_inclusions_documents (owner_user_id);

alter table public.standard_inclusions_documents enable row level security;

create policy "standard inclusions owners can read"
  on public.standard_inclusions_documents
  for select
  using (
    auth.uid() = owner_user_id
    or auth.uid() = any(allowed_editor_user_ids)
  );

create policy "standard inclusions owners can insert"
  on public.standard_inclusions_documents
  for insert
  with check (auth.uid() = owner_user_id);

create policy "standard inclusions owners can update"
  on public.standard_inclusions_documents
  for update
  using (
    auth.uid() = owner_user_id
    or auth.uid() = any(allowed_editor_user_ids)
  )
  with check (
    auth.uid() = owner_user_id
    or auth.uid() = any(allowed_editor_user_ids)
  );
