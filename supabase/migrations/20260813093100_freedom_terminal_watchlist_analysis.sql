create extension if not exists pgcrypto;

create table if not exists freedom_companies (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  company_name text,
  exchange text,
  sector text,
  industry text,
  currency text,
  country text,
  website text,
  description text,
  logo_url text,
  primary_colour text,
  secondary_colour text,
  accent_colour text,
  raw_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists freedom_research (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references freedom_companies(id) on delete cascade,
  business_summary text,
  investment_thesis text,
  why_we_like_it text,
  competitive_advantage text,
  key_risks text,
  bull_case text,
  bear_case text,
  research_status text,
  source_notes text,
  last_updated timestamptz not null default now()
);

create table if not exists freedom_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references freedom_companies(id) on delete cascade,
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
  score_explanations jsonb not null default '{}'::jsonb,
  last_updated timestamptz not null default now()
);

create table if not exists freedom_valuations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references freedom_companies(id) on delete cascade,
  valuation_method text,
  current_eps numeric,
  expected_eps_growth numeric,
  terminal_pe numeric,
  required_return numeric,
  fair_value numeric,
  buy_below numeric,
  strong_buy_below numeric,
  expensive_above numeric,
  expected_five_year_return numeric,
  margin_of_safety numeric,
  valuation_rating text,
  assumptions_source text,
  last_updated timestamptz not null default now()
);

create table if not exists freedom_committee_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references freedom_companies(id) on delete cascade,
  overall_decision text,
  committee_score numeric,
  confidence numeric,
  value_investor jsonb,
  growth_investor jsonb,
  risk_analyst jsonb,
  industry_expert jsonb,
  portfolio_manager jsonb,
  final_summary text,
  last_updated timestamptz not null default now()
);

create table if not exists freedom_watchlists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists freedom_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references freedom_watchlists(id) on delete cascade,
  company_id uuid not null references freedom_companies(id) on delete cascade,
  position integer,
  target_buy_price numeric,
  alert_drop_percent numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, company_id)
);

create index if not exists freedom_watchlist_items_watchlist_idx on freedom_watchlist_items (watchlist_id);
create index if not exists freedom_watchlist_items_company_idx on freedom_watchlist_items (company_id);

insert into freedom_watchlists (name, description, is_default)
values ('Core Watchlist', 'Freedom Terminal core quality watchlist.', true)
on conflict (name) do update set
  description = excluded.description,
  is_default = excluded.is_default,
  updated_at = now();

create or replace function freedom_analysis_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists freedom_companies_set_updated_at on freedom_companies;
create trigger freedom_companies_set_updated_at
before update on freedom_companies
for each row execute function freedom_analysis_set_updated_at();

drop trigger if exists freedom_watchlists_set_updated_at on freedom_watchlists;
create trigger freedom_watchlists_set_updated_at
before update on freedom_watchlists
for each row execute function freedom_analysis_set_updated_at();
