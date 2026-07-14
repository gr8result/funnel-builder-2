create extension if not exists pgcrypto;

create or replace function freedom_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  exchange text,
  company_name text not null,
  sector text,
  industry text,
  country text,
  currency text not null default 'USD',
  description text,
  website text,
  logo_url text,
  colour_primary text,
  colour_secondary text,
  colour_accent text,
  market_cap numeric,
  employees integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_ticker_idx on companies (ticker);
create index if not exists companies_sector_idx on companies (sector);
create index if not exists companies_industry_idx on companies (industry);
create index if not exists companies_active_idx on companies (is_active);

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
before update on companies
for each row execute function freedom_set_updated_at();

create table if not exists live_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  price numeric,
  change numeric,
  change_percent numeric,
  open numeric,
  high numeric,
  low numeric,
  close_previous numeric,
  volume numeric,
  market_timestamp timestamptz,
  provider text not null default 'finnhub',
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists live_prices_company_idx on live_prices (company_id);
create index if not exists live_prices_updated_idx on live_prices (updated_at desc);

drop trigger if exists live_prices_set_updated_at on live_prices;
create trigger live_prices_set_updated_at
before update on live_prices
for each row execute function freedom_set_updated_at();

create table if not exists historical_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric,
  provider text not null default 'yahoo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, date, provider)
);

create index if not exists historical_prices_company_date_idx on historical_prices (company_id, date desc);
create index if not exists historical_prices_date_idx on historical_prices (date desc);

drop trigger if exists historical_prices_set_updated_at on historical_prices;
create trigger historical_prices_set_updated_at
before update on historical_prices
for each row execute function freedom_set_updated_at();

create table if not exists financials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year integer not null,
  revenue numeric,
  gross_profit numeric,
  operating_profit numeric,
  net_profit numeric,
  free_cash_flow numeric,
  cash numeric,
  debt numeric,
  roe numeric,
  roic numeric,
  operating_margin numeric,
  gross_margin numeric,
  eps numeric,
  book_value numeric,
  dividend numeric,
  payout_ratio numeric,
  provider text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, fiscal_year, provider)
);

create index if not exists financials_company_year_idx on financials (company_id, fiscal_year desc);

drop trigger if exists financials_set_updated_at on financials;
create trigger financials_set_updated_at
before update on financials
for each row execute function freedom_set_updated_at();

create table if not exists earnings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  quarter text not null,
  revenue numeric,
  eps numeric,
  guidance text,
  beat_miss text,
  transcript_summary text,
  ai_analysis text,
  report_date date,
  provider text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, quarter, provider)
);

create index if not exists earnings_company_quarter_idx on earnings (company_id, quarter desc);

drop trigger if exists earnings_set_updated_at on earnings;
create trigger earnings_set_updated_at
before update on earnings
for each row execute function freedom_set_updated_at();

create table if not exists valuation_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  current_eps numeric,
  growth_rate numeric,
  required_return numeric,
  terminal_pe numeric,
  fair_value numeric,
  strong_buy numeric,
  buy numeric,
  hold numeric,
  expensive numeric,
  expected_cagr numeric,
  assumptions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index if not exists valuation_models_company_idx on valuation_models (company_id);

drop trigger if exists valuation_models_set_updated_at on valuation_models;
create trigger valuation_models_set_updated_at
before update on valuation_models
for each row execute function freedom_set_updated_at();

create table if not exists company_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  overall_score numeric,
  financial_health numeric,
  growth numeric,
  competitive_moat numeric,
  management numeric,
  innovation numeric,
  valuation numeric,
  risk numeric,
  industry_outlook numeric,
  confidence numeric,
  last_updated timestamptz not null default now(),
  unique (company_id)
);

create index if not exists company_scores_overall_idx on company_scores (overall_score desc);

create table if not exists research_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  investment_thesis text,
  business_summary text,
  competitive_advantage text,
  key_risks text,
  management_notes text,
  ai_opinion text,
  last_updated timestamptz not null default now(),
  unique (company_id)
);

create index if not exists research_notes_company_idx on research_notes (company_id);

create table if not exists committee_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  value_investor jsonb not null default '{}'::jsonb,
  growth_investor jsonb not null default '{}'::jsonb,
  risk_analyst jsonb not null default '{}'::jsonb,
  industry_expert jsonb not null default '{}'::jsonb,
  portfolio_manager jsonb not null default '{}'::jsonb,
  committee_score numeric,
  final_recommendation text,
  confidence numeric,
  reasoning text,
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index if not exists committee_reviews_company_idx on committee_reviews (company_id);

drop trigger if exists committee_reviews_set_updated_at on committee_reviews;
create trigger committee_reviews_set_updated_at
before update on committee_reviews
for each row execute function freedom_set_updated_at();

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, owner)
);

drop trigger if exists watchlists_set_updated_at on watchlists;
create trigger watchlists_set_updated_at
before update on watchlists
for each row execute function freedom_set_updated_at();

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  target_buy numeric,
  strong_buy numeric,
  target_weight numeric,
  notes text,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, company_id)
);

create index if not exists watchlist_items_watchlist_idx on watchlist_items (watchlist_id, position);
create index if not exists watchlist_items_company_idx on watchlist_items (company_id);

drop trigger if exists watchlist_items_set_updated_at on watchlist_items;
create trigger watchlist_items_set_updated_at
before update on watchlist_items
for each row execute function freedom_set_updated_at();

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  alert_type text not null,
  priority text not null default 'normal',
  message text not null,
  trigger_payload jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alerts_company_idx on alerts (company_id);
create index if not exists alerts_status_idx on alerts (status);
create index if not exists alerts_priority_idx on alerts (priority);

drop trigger if exists alerts_set_updated_at on alerts;
create trigger alerts_set_updated_at
before update on alerts
for each row execute function freedom_set_updated_at();

create table if not exists portfolio (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner uuid,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists portfolio_set_updated_at on portfolio;
create trigger portfolio_set_updated_at
before update on portfolio
for each row execute function freedom_set_updated_at();

create table if not exists portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolio(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  quantity numeric not null default 0,
  average_cost numeric,
  target_weight numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, company_id)
);

create index if not exists portfolio_holdings_portfolio_idx on portfolio_holdings (portfolio_id);
create index if not exists portfolio_holdings_company_idx on portfolio_holdings (company_id);

drop trigger if exists portfolio_holdings_set_updated_at on portfolio_holdings;
create trigger portfolio_holdings_set_updated_at
before update on portfolio_holdings
for each row execute function freedom_set_updated_at();

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolio(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  transaction_type text not null,
  transaction_date timestamptz not null default now(),
  quantity numeric,
  price numeric,
  fees numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_portfolio_date_idx on transactions (portfolio_id, transaction_date desc);
create index if not exists transactions_company_idx on transactions (company_id);

drop trigger if exists transactions_set_updated_at on transactions;
create trigger transactions_set_updated_at
before update on transactions
for each row execute function freedom_set_updated_at();

create table if not exists cash_balance (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolio(id) on delete cascade,
  currency text not null default 'USD',
  balance numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (portfolio_id, currency)
);

drop trigger if exists cash_balance_set_updated_at on cash_balance;
create trigger cash_balance_set_updated_at
before update on cash_balance
for each row execute function freedom_set_updated_at();

create table if not exists performance_history (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolio(id) on delete cascade,
  date date not null,
  total_value numeric,
  cash_value numeric,
  holdings_value numeric,
  daily_return numeric,
  cumulative_return numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, date)
);

create index if not exists performance_history_portfolio_date_idx on performance_history (portfolio_id, date desc);

drop trigger if exists performance_history_set_updated_at on performance_history;
create trigger performance_history_set_updated_at
before update on performance_history
for each row execute function freedom_set_updated_at();

create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text unique not null,
  cadence text not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  status text not null default 'pending',
  last_error text,
  updated_at timestamptz not null default now()
);

drop trigger if exists background_jobs_set_updated_at on background_jobs;
create trigger background_jobs_set_updated_at
before update on background_jobs
for each row execute function freedom_set_updated_at();

insert into watchlists (name, owner)
values ('Core Watchlist', null)
on conflict (name, owner) do nothing;

insert into portfolio (name, owner, base_currency)
values ('Freedom Portfolio', null, 'USD')
on conflict (name) do nothing;

insert into background_jobs (job_name, cadence, status)
values
  ('daily_update_prices', 'daily', 'pending'),
  ('daily_update_valuation', 'daily', 'pending'),
  ('daily_update_company_scores', 'daily', 'pending'),
  ('daily_update_committee_review', 'daily', 'pending'),
  ('weekly_update_financials', 'weekly', 'pending'),
  ('quarterly_update_earnings', 'quarterly', 'pending'),
  ('nightly_watch_engine', 'daily', 'pending')
on conflict (job_name) do update set
  cadence = excluded.cadence,
  updated_at = now();
