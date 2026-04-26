-- Social image library table
create table if not exists social_image_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  storage_path text,
  description text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_social_image_library_user on social_image_library (user_id, created_at desc);

-- Storage bucket (run this in Supabase dashboard Storage if bucket doesn't exist)
-- insert into storage.buckets (id, name, public) values ('social-images', 'social-images', true)
-- on conflict (id) do nothing;

-- RLS: users can only see/insert their own images
alter table social_image_library enable row level security;

create policy "Users can view own images" on social_image_library
  for select using (auth.uid() = user_id);

create policy "Users can insert own images" on social_image_library
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own images" on social_image_library
  for delete using (auth.uid() = user_id);
