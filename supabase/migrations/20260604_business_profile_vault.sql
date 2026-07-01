create table if not exists public.business_profile_vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete set null,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'submitted', 'under_review', 'verified', 'needs_attention')
  ),
  completion_percent integer not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  admin_notes text null,
  needs_attention_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.business_profile_documents (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.business_profile_vaults(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null,
  field_key text not null,
  document_type text null,
  storage_bucket text not null default 'Private-assets',
  storage_path text not null,
  file_name text not null,
  file_size bigint null,
  mime_type text null,
  verification_status text not null default 'pending' check (
    verification_status in ('pending', 'approved', 'rejected', 'needs_attention')
  ),
  admin_notes text null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null
);

create index if not exists idx_business_profile_vaults_user_id
  on public.business_profile_vaults(user_id);

create index if not exists idx_business_profile_vaults_status
  on public.business_profile_vaults(status);

create index if not exists idx_business_profile_documents_vault_id
  on public.business_profile_documents(vault_id);

create index if not exists idx_business_profile_documents_user_id
  on public.business_profile_documents(user_id);

alter table public.business_profile_vaults enable row level security;
alter table public.business_profile_documents enable row level security;

drop policy if exists "Users can read their own business profile vault" on public.business_profile_vaults;
create policy "Users can read their own business profile vault"
  on public.business_profile_vaults
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own business profile vault" on public.business_profile_vaults;
create policy "Users can insert their own business profile vault"
  on public.business_profile_vaults
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own business profile vault" on public.business_profile_vaults;
create policy "Users can update their own business profile vault"
  on public.business_profile_vaults
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own business profile documents" on public.business_profile_documents;
create policy "Users can read their own business profile documents"
  on public.business_profile_documents
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own business profile documents" on public.business_profile_documents;
create policy "Users can insert their own business profile documents"
  on public.business_profile_documents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own business profile documents" on public.business_profile_documents;
create policy "Users can update their own business profile documents"
  on public.business_profile_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own business profile vault storage" on storage.objects;
create policy "Users can read own business profile vault storage"
  on storage.objects
  for select
  using (
    bucket_id = 'Private-assets'
    and auth.uid()::text = split_part(name, '/', 2)
    and split_part(name, '/', 1) = 'business-profile-vault'
  );

drop policy if exists "Users can upload own business profile vault storage" on storage.objects;
create policy "Users can upload own business profile vault storage"
  on storage.objects
  for insert
  with check (
    bucket_id = 'Private-assets'
    and auth.uid()::text = split_part(name, '/', 2)
    and split_part(name, '/', 1) = 'business-profile-vault'
  );
