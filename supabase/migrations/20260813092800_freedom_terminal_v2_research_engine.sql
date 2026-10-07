create extension if not exists pgcrypto;

create or replace function freedom_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text,
  currency text,
  timezone text,
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  country text not null unique,
  iso_code text,
  currency text,
  primary_exchange text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  gics_code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists industries (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid references sectors(id) on delete set null,
  name text not null,
  gics_code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sector_id, name)
);

do $$
begin
  if to_regclass('public.companies') is null then
    create table companies (
      id uuid primary key default gen_random_uuid(),
      ticker text,
      symbol text,
      exchange text,
      isin text,
      company_name text not null,
      short_name text,
      logo_url text,
      colour_primary text,
      colour_secondary text,
      colour_accent text,
      sector text,
      industry text,
      country text,
      website text,
      description text,
      ceo text,
      employees integer,
      head_office text,
      market_cap numeric,
      currency text default 'USD',
      ipo_date date,
      status text not null default 'active',
      is_active boolean not null default true,
      source text not null default 'freedom-terminal',
      raw_profile jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

alter table companies add column if not exists ticker text;
alter table companies add column if not exists symbol text;
alter table companies add column if not exists exchange text;
alter table companies add column if not exists market_id uuid references markets(id) on delete set null;
alter table companies add column if not exists isin text;
alter table companies add column if not exists short_name text;
alter table companies add column if not exists logo_url text;
alter table companies add column if not exists colour_primary text;
alter table companies add column if not exists colour_secondary text;
alter table companies add column if not exists colour_accent text;
alter table companies add column if not exists sector text;
alter table companies add column if not exists sector_id uuid references sectors(id) on delete set null;
alter table companies add column if not exists industry text;
alter table companies add column if not exists industry_id uuid references industries(id) on delete set null;
alter table companies add column if not exists country text;
alter table companies add column if not exists country_id uuid references countries(id) on delete set null;
alter table companies add column if not exists website text;
alter table companies add column if not exists web_url text;
alter table companies add column if not exists description text;
alter table companies add column if not exists ceo text;
alter table companies add column if not exists employees integer;
alter table companies add column if not exists head_office text;
alter table companies add column if not exists market_cap numeric;
alter table companies add column if not exists currency text default 'USD';
alter table companies add column if not exists ipo_date date;
alter table companies add column if not exists status text not null default 'active';
alter table companies add column if not exists is_active boolean not null default true;
alter table companies add column if not exists source text not null default 'freedom-terminal';
alter table companies add column if not exists raw_profile jsonb not null default '{}'::jsonb;
alter table companies add column if not exists created_at timestamptz not null default now();
alter table companies add column if not exists updated_at timestamptz not null default now();

update companies set ticker = upper(symbol) where ticker is null and symbol is not null;
update companies set symbol = upper(ticker) where symbol is null and ticker is not null;
update companies set short_name = company_name where short_name is null and company_name is not null;
update companies set website = web_url where website is null and web_url is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_ticker_unique'
  ) then
    alter table companies add constraint companies_ticker_unique unique (ticker);
  end if;
exception when duplicate_table then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_symbol_unique'
  ) then
    alter table companies add constraint companies_symbol_unique unique (symbol);
  end if;
exception when duplicate_table then
  null;
end $$;

create unique index if not exists companies_ticker_unique_idx on companies (ticker) where ticker is not null;
create unique index if not exists companies_symbol_unique_idx on companies (symbol) where symbol is not null;
create index if not exists companies_exchange_idx on companies (exchange);
create index if not exists companies_sector_idx on companies (sector);
create index if not exists companies_industry_idx on companies (industry);
create index if not exists companies_country_idx on companies (country);
create index if not exists companies_status_idx on companies (status);

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at before update on companies for each row execute function freedom_set_updated_at();

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
  volume numeric,
  price_timestamp timestamptz,
  provider text not null default 'finnhub',
  raw_quote jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

alter table live_prices add column if not exists current_price numeric;
alter table live_prices add column if not exists previous_close numeric;
alter table live_prices add column if not exists day_high numeric;
alter table live_prices add column if not exists day_low numeric;
alter table live_prices add column if not exists open_price numeric;
alter table live_prices add column if not exists price_timestamp timestamptz;
alter table live_prices add column if not exists raw_quote jsonb not null default '{}'::jsonb;
alter table live_prices add column if not exists created_at timestamptz not null default now();
alter table live_prices add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'price') then
    update live_prices set current_price = price where current_price is null and price is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'close_previous') then
    update live_prices set previous_close = close_previous where previous_close is null and close_previous is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'high') then
    update live_prices set day_high = high where day_high is null and high is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'low') then
    update live_prices set day_low = low where day_low is null and low is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'open') then
    update live_prices set open_price = open where open_price is null and open is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'market_timestamp') then
    update live_prices set price_timestamp = market_timestamp where price_timestamp is null and market_timestamp is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_prices' and column_name = 'raw_payload') then
    update live_prices set raw_quote = raw_payload where raw_quote = '{}'::jsonb and raw_payload is not null;
  end if;
end $$;

create index if not exists live_prices_company_idx on live_prices (company_id);
create index if not exists live_prices_updated_idx on live_prices (updated_at desc);

drop trigger if exists live_prices_set_updated_at on live_prices;
create trigger live_prices_set_updated_at before update on live_prices for each row execute function freedom_set_updated_at();

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

drop trigger if exists historical_prices_set_updated_at on historical_prices;
create trigger historical_prices_set_updated_at before update on historical_prices for each row execute function freedom_set_updated_at();

create table if not exists financials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year integer,
  period_end date,
  period_type text,
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
  net_margin numeric,
  return_on_equity numeric,
  debt_to_equity numeric,
  eps numeric,
  book_value numeric,
  dividend numeric,
  payout_ratio numeric,
  provider text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table financials add column if not exists period_end date;
alter table financials add column if not exists period_type text;
alter table financials add column if not exists fiscal_year integer;
alter table financials add column if not exists net_margin numeric;
alter table financials add column if not exists return_on_equity numeric;
alter table financials add column if not exists debt_to_equity numeric;
alter table financials add column if not exists raw_payload jsonb not null default '{}'::jsonb;
alter table financials add column if not exists updated_at timestamptz not null default now();
alter table financials alter column fiscal_year drop not null;

create index if not exists financials_company_period_idx on financials (company_id, period_end desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financials_company_period_provider_unique'
  ) then
    alter table financials add constraint financials_company_period_provider_unique unique (company_id, period_end, period_type, provider);
  end if;
exception when duplicate_object then
  null;
end $$;

drop trigger if exists financials_set_updated_at on financials;
create trigger financials_set_updated_at before update on financials for each row execute function freedom_set_updated_at();

insert into markets (code, name, country, currency, timezone) values
  ('ASX', 'Australian Securities Exchange', 'Australia', 'AUD', 'Australia/Sydney'),
  ('NASDAQ', 'Nasdaq Stock Market', 'United States', 'USD', 'America/New_York'),
  ('NYSE', 'New York Stock Exchange', 'United States', 'USD', 'America/New_York'),
  ('LSE', 'London Stock Exchange', 'United Kingdom', 'GBP', 'Europe/London'),
  ('TSX', 'Toronto Stock Exchange', 'Canada', 'CAD', 'America/Toronto'),
  ('EURONEXT', 'Euronext', 'European Union', 'EUR', 'Europe/Paris'),
  ('HKEX', 'Hong Kong Stock Exchange', 'Hong Kong', 'HKD', 'Asia/Hong_Kong'),
  ('TSE', 'Tokyo Stock Exchange', 'Japan', 'JPY', 'Asia/Tokyo')
on conflict (code) do update set
  name = excluded.name,
  country = excluded.country,
  currency = excluded.currency,
  timezone = excluded.timezone,
  updated_at = now();

insert into countries (country, iso_code, currency, primary_exchange) values
  ('Australia', 'AU', 'AUD', 'ASX'),
  ('United States', 'US', 'USD', 'NASDAQ'),
  ('United Kingdom', 'GB', 'GBP', 'LSE'),
  ('Canada', 'CA', 'CAD', 'TSX'),
  ('European Union', 'EU', 'EUR', 'EURONEXT'),
  ('Hong Kong', 'HK', 'HKD', 'HKEX'),
  ('Japan', 'JP', 'JPY', 'TSE'),
  ('Taiwan', 'TW', 'TWD', 'TWSE'),
  ('Netherlands', 'NL', 'EUR', 'EURONEXT')
on conflict (country) do update set
  iso_code = excluded.iso_code,
  currency = excluded.currency,
  primary_exchange = excluded.primary_exchange,
  updated_at = now();

insert into sectors (name) values
  ('Technology'),
  ('Healthcare'),
  ('Financials'),
  ('Consumer'),
  ('Industrials'),
  ('Utilities'),
  ('Energy'),
  ('Real Estate'),
  ('Materials'),
  ('Communications')
on conflict (name) do nothing;

create table if not exists company_import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  ticker text not null,
  status text not null default 'queued',
  provider_status jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_import_jobs_ticker_idx on company_import_jobs (ticker);
create index if not exists company_import_jobs_status_idx on company_import_jobs (status);

drop trigger if exists company_import_jobs_set_updated_at on company_import_jobs;
create trigger company_import_jobs_set_updated_at before update on company_import_jobs for each row execute function freedom_set_updated_at();

create table if not exists company_competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  competitor_company_id uuid not null references companies(id) on delete cascade,
  relationship_type text not null default 'peer',
  source text,
  created_at timestamptz not null default now(),
  unique (company_id, competitor_company_id)
);

create table if not exists company_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  category text,
  description text,
  revenue_share numeric,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists revenue_segments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  segment_name text not null,
  segment_type text not null default 'product',
  period_end date,
  revenue numeric,
  revenue_percent numeric,
  currency text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, segment_name, segment_type, period_end)
);

create table if not exists analyst_estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null default 'finnhub',
  period_end date,
  period_type text,
  eps_avg numeric,
  eps_high numeric,
  eps_low numeric,
  revenue_avg numeric,
  revenue_high numeric,
  revenue_low numeric,
  analyst_count integer,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider, period_end, period_type)
);

create index if not exists analyst_estimates_company_period_idx on analyst_estimates (company_id, period_end desc);

create table if not exists freedom250 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  overall_score numeric,
  quality_score numeric,
  growth_score numeric,
  risk_score numeric,
  moat_score numeric,
  management_score numeric,
  valuation_score numeric,
  committee_score numeric,
  rank integer,
  status text not null default 'candidate',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create index if not exists freedom250_rank_idx on freedom250 (rank);
create index if not exists freedom250_overall_score_idx on freedom250 (overall_score desc);

drop trigger if exists freedom250_set_updated_at on freedom250;
create trigger freedom250_set_updated_at before update on freedom250 for each row execute function freedom_set_updated_at();

alter table watchlists add column if not exists name text;
alter table watchlists add column if not exists owner uuid;
alter table watchlists add column if not exists description text;
alter table watchlists add column if not exists is_default boolean not null default false;
alter table watchlists add column if not exists created_at timestamptz not null default now();
alter table watchlists add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watchlists'
      and column_name = 'company_id'
  ) then
    alter table watchlists alter column company_id drop not null;
  end if;
end $$;
update watchlists set name = watchlist_name where name is null and watchlist_name is not null;
update watchlists set name = 'Core Watchlist' where name is null;
create unique index if not exists watchlists_name_owner_unique_idx on watchlists (name, coalesce(owner::text, ''));

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  position integer,
  target_buy_price numeric,
  alert_drop_percent numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, company_id)
);

create index if not exists watchlist_items_watchlist_idx on watchlist_items (watchlist_id);
create index if not exists watchlist_items_company_idx on watchlist_items (company_id);

create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid,
  base_currency text not null default 'USD',
  cash numeric not null default 0,
  income numeric not null default 0,
  allocation jsonb not null default '{}'::jsonb,
  sector_allocation jsonb not null default '{}'::jsonb,
  country_allocation jsonb not null default '{}'::jsonb,
  risk jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portfolios_name_owner_unique_idx on portfolios (name, coalesce(owner::text, ''));

create table if not exists portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  quantity numeric not null default 0,
  average_cost numeric,
  market_value numeric,
  unrealized_gain numeric,
  weight_percent numeric,
  target_weight_percent numeric,
  notes text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table portfolio_holdings add column if not exists portfolio_id uuid references portfolios(id) on delete cascade;
alter table portfolio_holdings add column if not exists market_value numeric;
alter table portfolio_holdings add column if not exists unrealized_gain numeric;
alter table portfolio_holdings add column if not exists weight_percent numeric;
alter table portfolio_holdings add column if not exists updated_at timestamptz not null default now();
create index if not exists portfolio_holdings_portfolio_id_idx on portfolio_holdings (portfolio_id);

create table if not exists ai_research_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_summary text,
  investment_thesis text,
  bull_case text,
  bear_case text,
  swot jsonb not null default '{}'::jsonb,
  competitive_advantage text,
  management_review text,
  financial_review text,
  industry_outlook text,
  key_risks text,
  opportunities text,
  valuation_summary text,
  committee_review text,
  confidence numeric,
  model_version text,
  source text not null default 'ai',
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

drop trigger if exists ai_research_reports_set_updated_at on ai_research_reports;
create trigger ai_research_reports_set_updated_at before update on ai_research_reports for each row execute function freedom_set_updated_at();

create table if not exists valuation_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  method text not null,
  assumptions jsonb not null default '{}'::jsonb,
  fair_value numeric,
  buy_below numeric,
  strong_buy_below numeric,
  expensive_above numeric,
  margin_of_safety numeric,
  expected_return numeric,
  rating text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, method)
);

create table if not exists valuation_method_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  valuation_date date not null default current_date,
  eps_multiple_value numeric,
  dcf_value numeric,
  peg_value numeric,
  dividend_discount_value numeric,
  owner_earnings_value numeric,
  buffett_method_value numeric,
  average_fair_value numeric,
  raw_outputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, valuation_date)
);

create table if not exists technical_analysis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  analysis_date date not null default current_date,
  ma20 numeric,
  ma50 numeric,
  ma200 numeric,
  rsi numeric,
  macd numeric,
  macd_signal numeric,
  support numeric,
  resistance numeric,
  trend text,
  momentum text,
  volatility numeric,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, analysis_date)
);

create table if not exists news_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  provider text,
  source text,
  headline text not null,
  url text,
  summary text,
  sentiment text,
  impact_score numeric,
  published_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, url)
);

create index if not exists news_articles_company_published_idx on news_articles (company_id, published_at desc);
create index if not exists news_articles_sentiment_idx on news_articles (sentiment);

create table if not exists earnings_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year integer,
  fiscal_quarter integer,
  report_date date,
  period_end date,
  revenue numeric,
  revenue_estimate numeric,
  eps numeric,
  eps_estimate numeric,
  guidance text,
  management_commentary text,
  key_changes text,
  ai_summary text,
  raw_payload jsonb not null default '{}'::jsonb,
  provider text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, fiscal_year, fiscal_quarter, provider)
);

create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  document_type text not null,
  title text not null,
  url text,
  source text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  overall_score numeric,
  financial_health numeric,
  growth numeric,
  moat numeric,
  management numeric,
  innovation numeric,
  valuation numeric,
  risk numeric,
  industry_outlook numeric,
  confidence numeric,
  last_updated timestamptz not null default now(),
  unique (company_id)
);

alter table company_scores add column if not exists financial_health numeric;
alter table company_scores add column if not exists growth numeric;
alter table company_scores add column if not exists moat numeric;
alter table company_scores add column if not exists management numeric;
alter table company_scores add column if not exists innovation numeric;
alter table company_scores add column if not exists valuation numeric;
alter table company_scores add column if not exists risk numeric;
alter table company_scores add column if not exists industry_outlook numeric;
alter table company_scores add column if not exists confidence numeric;
alter table company_scores add column if not exists score_payload jsonb not null default '{}'::jsonb;

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  alert_type text,
  condition_operator text,
  threshold_value numeric,
  message text,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table alerts add column if not exists event_type text;
alter table alerts add column if not exists severity text not null default 'info';
alter table alerts add column if not exists payload jsonb not null default '{}'::jsonb;

insert into watchlists (name, description, is_default)
values
  ('Freedom 250', 'Best companies in the Freedom Terminal research universe.', true),
  ('Dividend Portfolio', 'Income-focused investment research list.', false),
  ('AI Portfolio', 'Artificial intelligence compounders and enablers.', false),
  ('ASX Growth', 'Australian growth companies.', false),
  ('US Tech', 'US-listed technology leaders.', false),
  ('Semiconductors', 'Semiconductor designers, manufacturers and equipment leaders.', false),
  ('High Conviction', 'Highest conviction active research ideas.', false)
on conflict do nothing;

insert into portfolios (name, base_currency)
values ('Freedom Portfolio', 'USD')
on conflict do nothing;
