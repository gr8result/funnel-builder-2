create extension if not exists pgcrypto;

-- Replaces localStorage as the source of truth for Freedom Trader's Fib
-- retracement + trade-plan state. One saved plan per authenticated user per
-- symbol (opportunity_id is optional metadata linking back to a scanner
-- result, not part of the uniqueness key). Uses the same bare-uuid
-- user_id convention (no FK to auth.users) as the existing
-- freedom-trader tables (pending_trades etc.) in 20260720_freedom_trader_trade_workflow.sql.
create table if not exists public.freedom_trader_fib_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  opportunity_id uuid,
  direction text not null default 'bullish',
  anchor_start_timestamp text,
  anchor_start_price numeric,
  anchor_end_timestamp text,
  anchor_end_price numeric,
  show_extensions boolean not null default false,
  assignments jsonb not null default '{}'::jsonb,
  minimum_risk_reward numeric not null default 2,
  calculated_risk_reward numeric,
  analysis_generated_at text,
  market_data_timestamp text,
  analysis_version text,
  migrated_from_local_storage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint freedom_trader_fib_plans_user_symbol_unique unique (user_id, symbol)
);

alter table public.freedom_trader_fib_plans add column if not exists user_id uuid;
alter table public.freedom_trader_fib_plans add column if not exists symbol text;
alter table public.freedom_trader_fib_plans add column if not exists opportunity_id uuid;
alter table public.freedom_trader_fib_plans add column if not exists direction text default 'bullish';
alter table public.freedom_trader_fib_plans add column if not exists anchor_start_timestamp text;
alter table public.freedom_trader_fib_plans add column if not exists anchor_start_price numeric;
alter table public.freedom_trader_fib_plans add column if not exists anchor_end_timestamp text;
alter table public.freedom_trader_fib_plans add column if not exists anchor_end_price numeric;
alter table public.freedom_trader_fib_plans add column if not exists show_extensions boolean default false;
alter table public.freedom_trader_fib_plans add column if not exists assignments jsonb default '{}'::jsonb;
alter table public.freedom_trader_fib_plans add column if not exists minimum_risk_reward numeric default 2;
alter table public.freedom_trader_fib_plans add column if not exists calculated_risk_reward numeric;
alter table public.freedom_trader_fib_plans add column if not exists analysis_generated_at text;
alter table public.freedom_trader_fib_plans add column if not exists market_data_timestamp text;
alter table public.freedom_trader_fib_plans add column if not exists analysis_version text;
alter table public.freedom_trader_fib_plans add column if not exists migrated_from_local_storage boolean default false;
alter table public.freedom_trader_fib_plans add column if not exists created_at timestamptz default now();
alter table public.freedom_trader_fib_plans add column if not exists updated_at timestamptz default now();

create index if not exists freedom_trader_fib_plans_user_symbol_idx
  on public.freedom_trader_fib_plans(user_id, symbol);

-- Defense in depth: the API route (using the service-role client) always
-- explicitly filters by the bearer-token-derived user_id, but RLS is added
-- in case this table is ever queried with an anon/user-scoped key.
alter table public.freedom_trader_fib_plans enable row level security;

drop policy if exists "own freedom trader fib plans" on public.freedom_trader_fib_plans;
create policy "own freedom trader fib plans" on public.freedom_trader_fib_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
