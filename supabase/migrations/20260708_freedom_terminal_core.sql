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
  symbol text unique not null,
  company_name text not null,
  sector text,
  industry text,
  exchange text,
  country text,
  currency text default 'USD',
  figi text,
  isin text,
  logo_url text,
  web_url text,
  market_cap numeric,
  ipo_date date,
  is_active boolean not null default true,
  source text not null default 'manual',
  raw_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_symbol_idx on companies (symbol);
create index if not exists companies_sector_idx on companies (sector);
create index if not exists companies_active_idx on companies (is_active);

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
before update on companies
for each row execute function freedom_set_updated_at();

create table if not exists live_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  current_price numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  day_high numeric,
  day_low numeric,
  open_price numeric,
  year_high numeric,
  year_low numeric,
  price_timestamp timestamptz,
  provider text not null default 'finnhub',
  raw_quote jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists live_prices_company_idx on live_prices (company_id);
create index if not exists live_prices_updated_idx on live_prices (updated_at desc);

drop trigger if exists live_prices_set_updated_at on live_prices;
create trigger live_prices_set_updated_at
before update on live_prices
for each row execute function freedom_set_updated_at();

create table if not exists financial_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  metric_date date not null default current_date,
  fiscal_year integer,
  fiscal_period text,
  revenue numeric,
  gross_margin numeric,
  operating_margin numeric,
  net_margin numeric,
  free_cash_flow numeric,
  eps_ttm numeric,
  pe_ttm numeric,
  ps_ttm numeric,
  debt_to_equity numeric,
  return_on_equity numeric,
  dividend_yield numeric,
  metrics jsonb not null default '{}'::jsonb,
  provider text not null default 'finnhub',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider, metric_date, fiscal_period)
);

create index if not exists financial_metrics_company_date_idx on financial_metrics (company_id, metric_date desc);

drop trigger if exists financial_metrics_set_updated_at on financial_metrics;
create trigger financial_metrics_set_updated_at
before update on financial_metrics
for each row execute function freedom_set_updated_at();

create table if not exists valuation_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  model_name text not null default 'Base Case',
  fair_value numeric,
  buy_below numeric,
  margin_of_safety_percent numeric,
  revenue_growth_rate numeric,
  terminal_growth_rate numeric,
  discount_rate numeric,
  assumptions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, model_name)
);

create index if not exists valuation_models_company_idx on valuation_models (company_id);
create index if not exists valuation_models_active_idx on valuation_models (is_active);

drop trigger if exists valuation_models_set_updated_at on valuation_models;
create trigger valuation_models_set_updated_at
before update on valuation_models
for each row execute function freedom_set_updated_at();

create table if not exists research_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  thesis text,
  why_we_like_it text,
  key_risks text,
  decision text,
  confidence_score numeric,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index if not exists research_notes_company_idx on research_notes (company_id);

drop trigger if exists research_notes_set_updated_at on research_notes;
create trigger research_notes_set_updated_at
before update on research_notes
for each row execute function freedom_set_updated_at();

create table if not exists earnings_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year integer,
  fiscal_quarter integer,
  report_date date,
  period_end date,
  eps_actual numeric,
  eps_estimate numeric,
  revenue_actual numeric,
  revenue_estimate numeric,
  surprise_percent numeric,
  raw_event jsonb not null default '{}'::jsonb,
  provider text not null default 'finnhub',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider, report_date, fiscal_year, fiscal_quarter)
);

create index if not exists earnings_history_company_date_idx on earnings_history (company_id, report_date desc);

drop trigger if exists earnings_history_set_updated_at on earnings_history;
create trigger earnings_history_set_updated_at
before update on earnings_history
for each row execute function freedom_set_updated_at();

create table if not exists industry_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  quality_score numeric not null default 0,
  moat_score numeric,
  balance_sheet_score numeric,
  growth_score numeric,
  valuation_score numeric,
  industry_rank integer,
  notes text,
  score_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, score_date)
);

create index if not exists industry_scores_company_date_idx on industry_scores (company_id, score_date desc);
create index if not exists industry_scores_quality_idx on industry_scores (quality_score desc);

drop trigger if exists industry_scores_set_updated_at on industry_scores;
create trigger industry_scores_set_updated_at
before update on industry_scores
for each row execute function freedom_set_updated_at();

create table if not exists portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  portfolio_name text not null default 'Freedom Portfolio',
  quantity numeric not null default 0,
  average_cost numeric,
  target_weight_percent numeric,
  notes text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, portfolio_name)
);

create index if not exists portfolio_holdings_portfolio_idx on portfolio_holdings (portfolio_name);
create index if not exists portfolio_holdings_company_idx on portfolio_holdings (company_id);

drop trigger if exists portfolio_holdings_set_updated_at on portfolio_holdings;
create trigger portfolio_holdings_set_updated_at
before update on portfolio_holdings
for each row execute function freedom_set_updated_at();

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  watchlist_name text not null default 'Core Watchlist',
  position integer,
  target_buy_price numeric,
  alert_drop_percent numeric,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, watchlist_name)
);

create index if not exists watchlists_name_position_idx on watchlists (watchlist_name, position);
create index if not exists watchlists_company_idx on watchlists (company_id);
create index if not exists watchlists_active_idx on watchlists (is_active);

drop trigger if exists watchlists_set_updated_at on watchlists;
create trigger watchlists_set_updated_at
before update on watchlists
for each row execute function freedom_set_updated_at();

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  alert_type text not null,
  condition_operator text not null,
  threshold_value numeric not null,
  message text,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alerts_company_idx on alerts (company_id);
create index if not exists alerts_active_idx on alerts (is_active);
create index if not exists alerts_type_idx on alerts (alert_type);

drop trigger if exists alerts_set_updated_at on alerts;
create trigger alerts_set_updated_at
before update on alerts
for each row execute function freedom_set_updated_at();

with seed(symbol, company_name, sector, industry, position, quality_score) as (
  values
    ('MSFT', 'Microsoft', 'Software', 'Cloud Software', 1, 96),
    ('NVDA', 'NVIDIA', 'Semiconductors', 'Graphics & AI Semiconductors', 2, 94),
    ('V', 'Visa', 'Payments', 'Payment Networks', 3, 95),
    ('AMZN', 'Amazon', 'Cloud & E-commerce', 'Cloud Infrastructure & E-commerce', 4, 93),
    ('COST', 'Costco', 'Consumer Defensive', 'Warehouse Retail', 5, 92),
    ('GOOGL', 'Alphabet', 'Digital Advertising & AI', 'Internet Content & Information', 6, 93),
    ('AVGO', 'Broadcom', 'Semiconductors', 'Semiconductor Infrastructure', 7, 92),
    ('MA', 'Mastercard', 'Payments', 'Payment Networks', 8, 94),
    ('ASML', 'ASML', 'Semiconductor Equipment', 'Semiconductor Equipment', 9, 91),
    ('TSM', 'Taiwan Semiconductor', 'Semiconductors', 'Foundry Semiconductors', 10, 92)
),
upserted_companies as (
  insert into companies (symbol, company_name, sector, industry, source)
  select symbol, company_name, sector, industry, 'seed'
  from seed
  on conflict (symbol) do update set
    company_name = excluded.company_name,
    sector = excluded.sector,
    industry = excluded.industry,
    updated_at = now()
  returning id, symbol
)
insert into watchlists (company_id, watchlist_name, position, is_active)
select c.id, 'Core Watchlist', s.position, true
from seed s
join companies c on c.symbol = s.symbol
on conflict (company_id, watchlist_name) do update set
  position = excluded.position,
  is_active = excluded.is_active,
  updated_at = now();

with seed(symbol, quality_score) as (
  values
    ('MSFT', 96),
    ('NVDA', 94),
    ('V', 95),
    ('AMZN', 93),
    ('COST', 92),
    ('GOOGL', 93),
    ('AVGO', 92),
    ('MA', 94),
    ('ASML', 91),
    ('TSM', 92)
)
insert into industry_scores (company_id, quality_score, score_date, notes)
select c.id, s.quality_score, current_date, 'Initial Freedom Terminal quality score'
from seed s
join companies c on c.symbol = s.symbol
on conflict (company_id, score_date) do update set
  quality_score = excluded.quality_score,
  notes = excluded.notes,
  updated_at = now();
