-- Freedom canonical persistence layer (Stage 3).
--
-- Freedom's production data currently lives in tmp/freedom-trades.json. On Vercel
-- that path is read-only and per-invocation ephemeral, so every save, edit and
-- import made in production is lost. These tables replace that file.
--
-- WHY NEW TABLES INSTEAD OF THE 2026-08 FREEDOM TABLES
--
-- The existing portfolio / portfolios / portfolio_holdings / transactions /
-- cash_balance / performance_history / pending_trades / open_positions family is
-- deliberately NOT reused and NOT modified by this migration. Three reasons, each
-- of which would have cost real data:
--
--   1. open_positions.purchase_price is NOT NULL. Two live open positions (CLSK
--      and TJGC) are broker-snapshot rows with a genuinely unknown entry price.
--      Storing them there would force a fabricated number. entry_price here is
--      nullable and must stay that way.
--   2. portfolio_holdings is keyed (company_id, portfolio_name) and requires a
--      companies row per symbol. Freedom records symbols the companies table has
--      never heard of.
--   3. One logical Freedom position would be split across three tables, none of
--      which carries exchange, currency or tenancy.
--
-- Those tables also still hold rows (portfolio=1, portfolios=1, pending_trades=1,
-- open_positions=1, closed_trades=1), so they are left completely alone.
--
-- LOSSLESS BY CONSTRUCTION
--
-- Freedom's JSON records are union-shaped and sparse: 45 distinct keys across 7
-- short-term records, 46 across 3 long-term ones. Rather than guess which will
-- matter later, every row keeps the COMPLETE original record in `payload` jsonb,
-- and the fields that need querying, indexing or tenancy are ALSO projected into
-- real columns. Reads reconstruct as { ...payload, ...typed columns }, so a field
-- nobody enumerated can never be silently dropped, while the typed columns stay
-- authoritative for anything the database itself edits.
--
-- TENANCY
--
-- Freedom rows were global before this migration - the reason freedomApiGuard.js
-- fails closed with 503 NO_PROVABLE_OWNER. Every row here carries workspace_id and
-- user_id, both resolved server-side from the caller's validated token and never
-- from a request payload, and RLS enforces workspace membership at the database.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- freedom_positions - short-term trades, long-term holdings and archived rows
-- ---------------------------------------------------------------------------
create table if not exists public.freedom_positions (
  -- The existing JSON id is preserved verbatim (e.g. lt_CBA_159.174_45). Other
  -- records reference it via sourceTradeId, so it is text, not a new uuid.
  id                        text primary key,

  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  user_id                   uuid not null references auth.users(id) on delete cascade,

  -- 'short-term' | 'long-term' | 'archived'. Archiving is a kind change, never a delete.
  kind                      text not null,

  symbol                    text not null,
  exchange                  text,

  -- Three distinct currencies, deliberately NOT collapsed: a holding can be
  -- priced natively in one currency, bought in another and valued in a third
  -- (JBLU is exchange US, valuation AUD). Collapsing these breaks P&L totals.
  currency                  text,
  native_currency           text,
  purchase_price_currency   text,
  valuation_currency        text,

  -- NULLABLE ON PURPOSE. CLSK and TJGC are open positions with no known entry
  -- price. Never default this to 0 and never infer it.
  entry_price               numeric,
  purchase_price            numeric,
  quantity                  numeric,

  safety_exit               numeric,
  take_some_profit          numeric,
  final_exit                numeric,
  target_price              numeric,

  status                    text,
  order_classification      text,
  term_classification       text,

  broker                    text,
  company_name              text,

  entry_date                timestamptz,
  purchase_date             timestamptz,

  import_fingerprint        text,

  broker_holding_snapshot   jsonb,
  order_history             jsonb,
  pending_sell_orders       jsonb,
  broker_snapshot_history   jsonb,
  original_order            jsonb,
  cmc_snapshot              jsonb,

  -- The complete original record. Guarantees a lossless round trip for every
  -- field, including ones no column above enumerates.
  payload                   jsonb not null default '{}'::jsonb,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists freedom_positions_workspace_idx
  on public.freedom_positions (workspace_id, kind);
create index if not exists freedom_positions_user_idx
  on public.freedom_positions (user_id);
create index if not exists freedom_positions_symbol_idx
  on public.freedom_positions (workspace_id, symbol);

-- Import de-duplication is per workspace, matching the existing importFingerprint
-- behaviour in lib/freedom/tradeStore.js. Partial so the many rows with no
-- fingerprint do not collide with each other.
create unique index if not exists freedom_positions_fingerprint_uidx
  on public.freedom_positions (workspace_id, import_fingerprint)
  where import_fingerprint is not null;

-- ---------------------------------------------------------------------------
-- freedom_position_events - order history / lifecycle events
-- ---------------------------------------------------------------------------
create table if not exists public.freedom_position_events (
  id            uuid primary key default gen_random_uuid(),
  position_id   text not null references public.freedom_positions(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  event_type    text,
  occurred_at   timestamptz,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists freedom_position_events_position_idx
  on public.freedom_position_events (position_id, occurred_at desc);
create index if not exists freedom_position_events_workspace_idx
  on public.freedom_position_events (workspace_id);

-- ---------------------------------------------------------------------------
-- freedom_trade_imports - the import audit trail (tradeImports[] in the JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.freedom_trade_imports (
  id            text primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  imported_at   timestamptz,
  row_count     integer,
  reports       jsonb,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists freedom_trade_imports_workspace_idx
  on public.freedom_trade_imports (workspace_id, imported_at desc);

-- ---------------------------------------------------------------------------
-- freedom_broker_snapshots - broker portfolio snapshots (CMC / Tiger)
--
-- History is kept rather than overwritten: is_current marks the active one, so a
-- new snapshot never destroys the previous valuation basis.
-- ---------------------------------------------------------------------------
create table if not exists public.freedom_broker_snapshots (
  id            text primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  broker        text,
  snapshot_type text,
  source        text,
  captured_at   timestamptz,
  is_current    boolean not null default false,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists freedom_broker_snapshots_workspace_idx
  on public.freedom_broker_snapshots (workspace_id, is_current);

-- Exactly one current snapshot per workspace.
create unique index if not exists freedom_broker_snapshots_current_uidx
  on public.freedom_broker_snapshots (workspace_id)
  where is_current;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.freedom_positions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists freedom_positions_set_updated_at on public.freedom_positions;
create trigger freedom_positions_set_updated_at
before update on public.freedom_positions
for each row execute function public.freedom_positions_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- Applied to these four NEW tables only. The legacy Freedom tables are left
-- without RLS in this migration on purpose: orphaned routes still read them, and
-- turning RLS on there would break them silently. That is a separate decision.
--
-- The predicate matches the pattern already used by standard_inclusions_*:
-- membership of the row's workspace, with status 'active'.
--
-- The service-role key used by the API bypasses RLS by design; the API's own
-- tenancy comes from freedomApiGuard.js, which resolves workspace_id from the
-- caller's validated token. RLS here is the second, independent line of defence
-- for any client that reaches the database with a user JWT.
-- ---------------------------------------------------------------------------

alter table public.freedom_positions        enable row level security;
alter table public.freedom_position_events  enable row level security;
alter table public.freedom_trade_imports    enable row level security;
alter table public.freedom_broker_snapshots enable row level security;

-- Force RLS so even the table owner is subject to it.
alter table public.freedom_positions        force row level security;
alter table public.freedom_position_events  force row level security;
alter table public.freedom_trade_imports    force row level security;
alter table public.freedom_broker_snapshots force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'freedom_positions',
    'freedom_position_events',
    'freedom_trade_imports',
    'freedom_broker_snapshots'
  ]
  loop
    execute format('drop policy if exists %I_member_select on public.%I', t, t);
    execute format($f$
      create policy %I_member_select on public.%I
        for select
        using (
          exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = %I.workspace_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
    $f$, t, t, t);

    execute format('drop policy if exists %I_member_insert on public.%I', t, t);
    execute format($f$
      create policy %I_member_insert on public.%I
        for insert
        with check (
          exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = %I.workspace_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
    $f$, t, t, t);

    -- USING gates which rows may be updated; WITH CHECK stops an update from
    -- moving a row into a workspace the caller is not a member of.
    execute format('drop policy if exists %I_member_update on public.%I', t, t);
    execute format($f$
      create policy %I_member_update on public.%I
        for update
        using (
          exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = %I.workspace_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
        with check (
          exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = %I.workspace_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
    $f$, t, t, t, t);

    execute format('drop policy if exists %I_member_delete on public.%I', t, t);
    execute format($f$
      create policy %I_member_delete on public.%I
        for delete
        using (
          exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = %I.workspace_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
    $f$, t, t, t);
  end loop;
end $$;
