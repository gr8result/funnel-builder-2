create extension if not exists pgcrypto;

create table if not exists public.freedom_trader_report_settings (
  user_id text primary key,
  trading_balance numeric not null default 5000,
  account_currency text not null default 'AUD',
  maximum_planned_loss_per_trade numeric not null default 75,
  maximum_simultaneous_open_trades integer not null default 3,
  maximum_total_money_committed numeric not null default 2500,
  maximum_total_planned_loss numeric not null default 150,
  minimum_risk_reward numeric not null default 2,
  maximum_trade_plan_age_hours numeric not null default 96,
  updated_at timestamptz not null default now()
);

create table if not exists public.freedom_trader_reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  report_type text not null check (report_type in ('now', 'morning', 'evening')),
  generated_at timestamptz not null default now(),
  market_data_timestamp timestamptz,
  market_data_quality text not null check (market_data_quality in ('live', 'delayed', 'cached', 'stale', 'unavailable')),
  recommendations jsonb not null default '[]'::jsonb,
  position_actions jsonb not null default '[]'::jsonb,
  order_instructions jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  summary jsonb,
  overall_instruction text not null
);

create table if not exists public.freedom_action_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  symbol text,
  action text not null check (action in ('BUY', 'SELL', 'EXIT', 'CANCEL_ORDER', 'MOVE_STOP')),
  message text not null,
  trigger_price numeric,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists freedom_trader_reports_user_type_generated_idx
  on public.freedom_trader_reports(user_id, report_type, generated_at desc);

create index if not exists freedom_action_alerts_user_ack_created_idx
  on public.freedom_action_alerts(user_id, acknowledged_at, created_at desc);

create index if not exists freedom_action_alerts_symbol_action_idx
  on public.freedom_action_alerts(symbol, action);
