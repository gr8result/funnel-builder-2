create extension if not exists pgcrypto;

create table if not exists public.freedom_paper_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null default 'Freedom Trader Paper Account',
  starting_balance numeric(18, 6) not null default 100000,
  currency text not null default 'AUD',
  available_cash numeric(18, 6) not null default 100000,
  closed_profit_loss numeric(18, 6) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, currency)
);

create table if not exists public.freedom_paper_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.freedom_paper_accounts(id) on update cascade on delete cascade,
  ticker text not null,
  company_name text not null,
  exchange text not null,
  currency text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit')),
  quantity numeric(18, 6) not null check (quantity > 0),
  requested_price numeric(18, 6),
  filled_price numeric(18, 6),
  brokerage_fee numeric(18, 6) not null default 0,
  status text not null check (status in ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected')),
  rejection_reason text,
  stop_loss_price numeric(18, 6),
  target_price numeric(18, 6),
  price_provider text,
  price_source text,
  price_last_updated_at timestamptz,
  price_delayed boolean not null default true,
  exit_reason text,
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.freedom_paper_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.freedom_paper_accounts(id) on update cascade on delete cascade,
  ticker text not null,
  company_name text not null,
  exchange text not null,
  currency text not null,
  quantity numeric(18, 6) not null check (quantity >= 0),
  average_entry_price numeric(18, 6) not null,
  stop_loss_price numeric(18, 6),
  target_price numeric(18, 6),
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (account_id, ticker, currency, status)
);

create table if not exists public.freedom_paper_trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.freedom_paper_accounts(id) on update cascade on delete cascade,
  order_id uuid references public.freedom_paper_orders(id) on update cascade on delete set null,
  position_id uuid references public.freedom_paper_positions(id) on update cascade on delete set null,
  ticker text not null,
  company_name text not null,
  exchange text not null,
  currency text not null,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric(18, 6) not null,
  price numeric(18, 6) not null,
  brokerage_fee numeric(18, 6) not null default 0,
  realised_profit_loss numeric(18, 6),
  exit_reason text,
  traded_at timestamptz not null default now()
);

create table if not exists public.freedom_trade_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.freedom_paper_accounts(id) on update cascade on delete cascade,
  order_id uuid references public.freedom_paper_orders(id) on update cascade on delete set null,
  position_id uuid references public.freedom_paper_positions(id) on update cascade on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists freedom_paper_orders_account_status_idx on public.freedom_paper_orders(account_id, status, created_at desc);
create index if not exists freedom_paper_orders_ticker_idx on public.freedom_paper_orders(ticker, created_at desc);
create index if not exists freedom_paper_positions_account_status_idx on public.freedom_paper_positions(account_id, status, ticker);
create index if not exists freedom_paper_trades_account_ticker_idx on public.freedom_paper_trades(account_id, ticker, traded_at desc);
create index if not exists freedom_trade_events_account_created_idx on public.freedom_trade_events(account_id, created_at desc);
