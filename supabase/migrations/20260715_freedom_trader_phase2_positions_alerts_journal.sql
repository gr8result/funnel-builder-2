create extension if not exists pgcrypto;

create table if not exists public.freedom_trader_positions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  company_name text,
  quantity integer not null,
  entry_price numeric not null,
  entry_date timestamptz not null default now(),
  target_price numeric,
  stop_price numeric,
  current_price numeric,
  status text not null default 'open',
  exit_price numeric,
  exit_date timestamptz,
  brokerage_buy numeric default 0,
  brokerage_sell numeric default 0,
  realised_profit numeric,
  unrealised_profit numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.freedom_trader_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  alert_type text not null,
  trigger_price numeric,
  direction text,
  message text,
  priority text default 'normal',
  status text default 'active',
  last_checked_price numeric,
  triggered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.freedom_trader_journal (
  id uuid primary key default gen_random_uuid(),
  position_id uuid,
  symbol text not null,
  event_type text not null,
  event_date timestamptz default now(),
  price numeric,
  quantity integer,
  notes text,
  screenshot_url text,
  created_at timestamptz default now()
);

alter table public.freedom_trader_positions add column if not exists company_name text;
alter table public.freedom_trader_positions add column if not exists brokerage_buy numeric default 0;
alter table public.freedom_trader_positions add column if not exists brokerage_sell numeric default 0;
alter table public.freedom_trader_positions add column if not exists unrealised_profit numeric;
alter table public.freedom_trader_positions add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'freedom_trader_positions'
      and column_name = 'quantity'
      and data_type <> 'integer'
  ) then
    alter table public.freedom_trader_positions
      alter column quantity type integer using quantity::integer;
  end if;
end $$;

alter table public.freedom_trader_alerts add column if not exists direction text;
alter table public.freedom_trader_alerts add column if not exists last_checked_price numeric;
alter table public.freedom_trader_alerts add column if not exists acknowledged_at timestamptz;
alter table public.freedom_trader_alerts add column if not exists updated_at timestamptz default now();
alter table public.freedom_trader_alerts add column if not exists position_id uuid;

alter table public.freedom_trader_journal add column if not exists position_id uuid;

create index if not exists freedom_trader_positions_status_symbol_idx
  on public.freedom_trader_positions(status, symbol);

create index if not exists freedom_trader_alerts_status_symbol_idx
  on public.freedom_trader_alerts(status, symbol);

create index if not exists freedom_trader_journal_symbol_date_idx
  on public.freedom_trader_journal(symbol, event_date desc);
