create extension if not exists pgcrypto;

-- Replaces the filesystem-backed trade journal (tmp/freedom-trade-journal.json),
-- which does not survive serverless deploys and is not the project's
-- database. Derived fields (profit/loss, return %, R-multiple) are computed
-- on read from these raw inputs, same as the previous JSON-file version.
create table if not exists public.trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  broker text,
  ticker text not null,
  company text,
  exchange text,
  currency text not null default 'USD',
  side text not null default 'buy',
  trade_date_time timestamptz not null default now(),
  quantity numeric not null,
  actual_fill_price numeric not null,
  brokerage_fees numeric not null default 0,
  stop_loss numeric,
  target numeric,
  status text not null default 'open',
  closing_price numeric,
  closing_date timestamptz,
  exit_reason text,
  notes text,
  document_reference text,
  pending_trade_id uuid references public.pending_trades(id) on update cascade on delete set null,
  open_position_id uuid references public.open_positions(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_journal_ticker_status_idx
  on public.trade_journal(ticker, status, trade_date_time desc);
