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
  account_summary jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  summary jsonb,
  overall_instruction text not null
);

create table if not exists public.freedom_action_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  symbol text,
  action text not null check (action in ('BUY', 'TAKE_SOME_PROFIT', 'FINAL_EXIT', 'SAFETY_EXIT', 'CANCEL_ORDER', 'MOVE_SAFETY_EXIT')),
  message text not null,
  trigger_price numeric,
  market_data_timestamp timestamptz,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

alter table public.freedom_trader_reports add column if not exists account_summary jsonb not null default '{}'::jsonb;
alter table public.freedom_trader_reports add column if not exists scan_summary jsonb;
alter table public.freedom_action_alerts add column if not exists market_data_timestamp timestamptz;

alter table public.freedom_action_alerts drop constraint if exists freedom_action_alerts_action_check;
alter table public.freedom_action_alerts add constraint freedom_action_alerts_action_check
  check (action in ('BUY', 'TAKE_SOME_PROFIT', 'FINAL_EXIT', 'SAFETY_EXIT', 'CANCEL_ORDER', 'MOVE_SAFETY_EXIT'));

create index if not exists freedom_trader_reports_user_type_generated_idx
  on public.freedom_trader_reports(user_id, report_type, generated_at desc);

create index if not exists freedom_action_alerts_user_ack_created_idx
  on public.freedom_action_alerts(user_id, acknowledged_at, created_at desc);

create index if not exists freedom_action_alerts_symbol_action_idx
  on public.freedom_action_alerts(symbol, action);

alter table public.freedom_trader_report_settings enable row level security;
alter table public.freedom_trader_reports enable row level security;
alter table public.freedom_action_alerts enable row level security;

drop policy if exists freedom_report_settings_owner_all on public.freedom_trader_report_settings;
create policy freedom_report_settings_owner_all on public.freedom_trader_report_settings
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists freedom_reports_owner_all on public.freedom_trader_reports;
create policy freedom_reports_owner_all on public.freedom_trader_reports
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists freedom_action_alerts_owner_all on public.freedom_action_alerts;
create policy freedom_action_alerts_owner_all on public.freedom_action_alerts
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
