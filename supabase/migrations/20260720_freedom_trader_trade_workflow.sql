create extension if not exists pgcrypto;

create table if not exists public.pending_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  ticker text not null,
  entry_price numeric,
  stop_loss numeric,
  target_price numeric,
  shares numeric,
  risk_reward numeric,
  expected_profit numeric,
  status text not null default 'pending',
  fib_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.open_positions (
  id uuid primary key default gen_random_uuid(),
  pending_trade_id uuid references public.pending_trades(id) on update cascade on delete set null,
  purchase_price numeric not null,
  purchase_date timestamptz not null default now(),
  shares numeric not null,
  brokerage numeric not null default 0,
  status text not null default 'open'
);

create table if not exists public.closed_trades (
  id uuid primary key default gen_random_uuid(),
  open_position_id uuid references public.open_positions(id) on update cascade on delete set null,
  sale_price numeric not null,
  sale_date timestamptz not null default now(),
  brokerage numeric not null default 0,
  gross_profit numeric,
  net_profit numeric,
  return_percent numeric,
  holding_days integer
);

create table if not exists public.trade_alerts (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references public.pending_trades(id) on update cascade on delete cascade,
  alert_type text not null,
  trigger_price numeric,
  triggered boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pending_trades add column if not exists user_id uuid;
alter table public.pending_trades add column if not exists ticker text;
alter table public.pending_trades add column if not exists entry_price numeric;
alter table public.pending_trades add column if not exists stop_loss numeric;
alter table public.pending_trades add column if not exists target_price numeric;
alter table public.pending_trades add column if not exists shares numeric;
alter table public.pending_trades add column if not exists risk_reward numeric;
alter table public.pending_trades add column if not exists expected_profit numeric;
alter table public.pending_trades add column if not exists status text default 'pending';
alter table public.pending_trades add column if not exists fib_data jsonb;
alter table public.pending_trades add column if not exists created_at timestamptz default now();

alter table public.open_positions add column if not exists pending_trade_id uuid;
alter table public.open_positions add column if not exists purchase_price numeric;
alter table public.open_positions add column if not exists purchase_date timestamptz default now();
alter table public.open_positions add column if not exists shares numeric;
alter table public.open_positions add column if not exists brokerage numeric default 0;
alter table public.open_positions add column if not exists status text default 'open';

alter table public.closed_trades add column if not exists open_position_id uuid;
alter table public.closed_trades add column if not exists sale_price numeric;
alter table public.closed_trades add column if not exists sale_date timestamptz default now();
alter table public.closed_trades add column if not exists brokerage numeric default 0;
alter table public.closed_trades add column if not exists gross_profit numeric;
alter table public.closed_trades add column if not exists net_profit numeric;
alter table public.closed_trades add column if not exists return_percent numeric;
alter table public.closed_trades add column if not exists holding_days integer;

alter table public.trade_alerts add column if not exists trade_id uuid;
alter table public.trade_alerts add column if not exists alert_type text;
alter table public.trade_alerts add column if not exists trigger_price numeric;
alter table public.trade_alerts add column if not exists triggered boolean default false;
alter table public.trade_alerts add column if not exists created_at timestamptz default now();

create index if not exists pending_trades_ticker_status_created_idx
  on public.pending_trades(ticker, status, created_at desc);

create index if not exists open_positions_status_trade_idx
  on public.open_positions(status, pending_trade_id);

create index if not exists closed_trades_open_position_idx
  on public.closed_trades(open_position_id);

create index if not exists trade_alerts_trade_type_idx
  on public.trade_alerts(trade_id, alert_type);

create index if not exists trade_alerts_triggered_idx
  on public.trade_alerts(triggered);
