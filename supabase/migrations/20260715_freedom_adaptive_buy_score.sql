create table if not exists public.freedom_score_history (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  symbol text not null,
  recommendation_date timestamptz not null default now(),
  buy_score numeric not null,
  conviction_score numeric not null,
  decision text not null,
  current_price numeric,
  fair_value numeric,
  reason text,
  score_details jsonb,
  six_month_price numeric,
  one_year_price numeric,
  two_year_price numeric,
  six_month_return numeric,
  one_year_return numeric,
  two_year_return numeric,
  accuracy numeric,
  created_at timestamptz not null default now()
);

create index if not exists freedom_score_history_symbol_date_idx
  on public.freedom_score_history (symbol, recommendation_date desc);

create index if not exists freedom_score_history_decision_idx
  on public.freedom_score_history (decision);

create table if not exists public.freedom_score_calibration (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  weights jsonb not null default '{
    "businessQuality": 30,
    "valuation": 30,
    "financialStrength": 15,
    "technicalTrend": 10,
    "industryOutlook": 10,
    "macroEnvironment": 5
  }'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists freedom_score_calibration_active_idx
  on public.freedom_score_calibration (active, updated_at desc);
