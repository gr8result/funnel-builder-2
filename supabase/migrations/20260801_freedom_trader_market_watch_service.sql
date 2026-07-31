create table if not exists public.freedom_market_watch_state (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.freedom_market_watch_state add column if not exists state jsonb not null default '{}'::jsonb;
alter table public.freedom_market_watch_state add column if not exists updated_at timestamptz not null default now();

alter table public.freedom_market_watch_state enable row level security;

drop policy if exists freedom_market_watch_state_owner_all on public.freedom_market_watch_state;
create policy freedom_market_watch_state_owner_all on public.freedom_market_watch_state
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
