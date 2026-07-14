create extension if not exists pgcrypto;

create table if not exists public.freedom_trader_watchlist (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,
  company_name text,
  exchange text,
  sector text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.freedom_trader_setups (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.freedom_trader_watchlist(symbol) on update cascade on delete cascade,
  setup_type text,
  trading_score numeric,
  trend text,
  entry_price numeric,
  target_price numeric,
  stop_price numeric,
  support_price numeric,
  resistance_price numeric,
  risk_reward_ratio numeric,
  expected_holding_days integer,
  confidence numeric,
  status text,
  reasoning text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.freedom_trader_positions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.freedom_trader_watchlist(symbol) on update cascade,
  entry_price numeric not null,
  quantity numeric not null,
  entry_date timestamptz not null,
  target_price numeric,
  stop_price numeric,
  current_price numeric,
  status text,
  exit_price numeric,
  exit_date timestamptz,
  realised_profit numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.freedom_trader_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.freedom_trader_watchlist(symbol) on update cascade on delete cascade,
  alert_type text not null,
  trigger_price numeric,
  message text,
  priority text,
  status text default 'active',
  triggered_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.freedom_trader_transactions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid references public.freedom_trader_positions(id) on update cascade on delete set null,
  symbol text not null references public.freedom_trader_watchlist(symbol) on update cascade,
  transaction_type text,
  quantity numeric,
  price numeric,
  brokerage numeric,
  transaction_date timestamptz,
  notes text
);

create index if not exists freedom_trader_setups_symbol_status_idx
  on public.freedom_trader_setups(symbol, status);

create index if not exists freedom_trader_positions_symbol_status_idx
  on public.freedom_trader_positions(symbol, status);

create index if not exists freedom_trader_alerts_symbol_status_idx
  on public.freedom_trader_alerts(symbol, status);

insert into public.freedom_trader_watchlist (symbol, company_name, exchange, sector, active)
values
  ('NVDA', 'NVIDIA', 'NASDAQ', 'Semiconductors', true),
  ('AMD', 'Advanced Micro Devices', 'NASDAQ', 'Semiconductors', true),
  ('TSLA', 'Tesla', 'NASDAQ', 'EV & Energy', true),
  ('PLTR', 'Palantir', 'NASDAQ', 'AI Software', true),
  ('AVGO', 'Broadcom', 'NASDAQ', 'Semiconductors', true),
  ('AMZN', 'Amazon', 'NASDAQ', 'Cloud & E-commerce', true),
  ('META', 'Meta Platforms', 'NASDAQ', 'Digital Advertising & AI', true),
  ('COIN', 'Coinbase', 'NASDAQ', 'Crypto Infrastructure', true),
  ('MSTR', 'MicroStrategy', 'NASDAQ', 'Bitcoin Treasury', true),
  ('SMCI', 'Super Micro Computer', 'NASDAQ', 'AI Infrastructure', true)
on conflict (symbol) do update set
  company_name = excluded.company_name,
  exchange = excluded.exchange,
  sector = excluded.sector,
  active = excluded.active,
  updated_at = now();
