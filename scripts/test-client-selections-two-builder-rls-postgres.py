"""Two-builder tenant isolation for Client Selections tables on REAL PostgreSQL (15-16 Nov 2026).

Same check as scripts/test-client-selections-two-builder-rls.mjs (PGlite), run inside an isolated
Docker Postgres in a FRESH database created for this run (never an existing one). Real migration files,
stub auth schema. Every probe write is rolled back.
  python scripts/test-client-selections-two-builder-rls-postgres.py <container> [docker-host]
"""
import subprocess, sys, time, json
from pathlib import Path

CONTAINER = sys.argv[1]
HOST = sys.argv[2] if len(sys.argv) > 2 else "npipe:////./pipe/dockerDesktopLinuxEngine"
DB = f"cs_rls_{int(time.time())}"
MIGRATIONS = [
    "20260813091500_estimate_builder_commercial_backbone_stage1.sql",
    "20260813091600_builder_inclusion_templates.sql",
    "20260813091800_builder_selection_books.sql",
    "20260813092100_builder_product_library.sql",
    "20260813092400_seed_gr8_standard_specifications.sql",
    "20260813093000_selection_budget_manager.sql",
    "20261003000100_builder_selection_tenant_foundation.sql",
    "20261010000100_builder_requirement_quote_mappings.sql",
    "20261011000100_requirement_mapping_product_identity.sql",
    "20261021000100_builder_commercial_internal_member_rls.sql",
    "20261028000100_workspace_members_rls_recursion_fix.sql",
]
TABLES = ["builder_commercial_projects", "builder_estimate_snapshots", "builder_selection_sessions", "builder_client_selections", "builder_selection_books", "builder_variations"]
A, B = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
USERS = {"ownerA": ("aaaaaaaa-0000-4000-8000-000000000001", [(A, "owner")]), "ownerB": ("bbbbbbbb-0000-4000-8000-000000000002", [(B, "owner")]), "clientA": ("cccccccc-0000-4000-8000-000000000003", [(A, "client")])}

def psql(db, sql):
    cmd = ["docker", "--host", HOST, "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"]
    r = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    if r.returncode: raise SystemExit(f"psql failed: {r.stderr.decode('utf-8', 'replace')[-2000:]}")
    return r.stdout.decode("utf-8", "replace")

psql("postgres", f"create database {DB};")
setup = f"""
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select 'authenticated'::text $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{{}}'::jsonb $f$;
grant usage on schema auth to authenticated, anon;
create extension if not exists pgcrypto;
create table public.workspaces (id uuid primary key, name text);
create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text);
create table public.workspace_entitlements (workspace_id uuid, entitlement text);
create table public.communities (workspace_id uuid, name text);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_entitlements enable row level security;
alter table public.communities enable row level security;
insert into workspaces values ('{A}','Builder A'),('{B}','Builder B');
"""
for name, (uid, memberships) in USERS.items():
    setup += f"insert into auth.users values ('{uid}');\n"
    for ws, role in memberships: setup += f"insert into workspace_members values ('{ws}','{uid}','{role}','active');\n"
for m in MIGRATIONS: setup += Path("supabase/migrations", m).read_text(encoding="utf-8") + "\n"
setup += "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;\n"
# Generic linked seeding (superuser) and the probe, in PL/pgSQL.
setup += r"""
create table public._cs_seed (ws uuid, tbl text, id uuid);
create or replace function public._cs_row_values(t text, w uuid, out names text, out vals text) language plpgsql as $f$
declare c record; v text; parent text;
begin
  names := 'id, workspace_id'; vals := format('%L, %L', gen_random_uuid(), w);
  for c in select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name=t and column_name not in ('id','workspace_id')
    and ((is_nullable='NO' and column_default is null) or column_name in ('project_id','snapshot_id','estimate_snapshot_id','session_id','selection_session_id')) loop
    parent := case c.column_name when 'project_id' then 'builder_commercial_projects' when 'snapshot_id' then 'builder_estimate_snapshots' when 'estimate_snapshot_id' then 'builder_estimate_snapshots'
      when 'session_id' then 'builder_selection_sessions' when 'selection_session_id' then 'builder_selection_sessions' else null end;
    if parent is not null then select quote_literal(id) into v from public._cs_seed where ws=w and tbl=parent; if v is null and c.is_nullable='YES' then continue; end if;
    elsif c.data_type ~ 'uuid' then v := quote_literal(gen_random_uuid());
    elsif c.data_type ~ 'int|numeric|double|real' then v := '1';
    elsif c.data_type ~ 'bool' then v := 'false';
    elsif c.data_type ~ 'json' then v := '''{}''';
    elsif c.data_type ~ 'ARRAY' then v := '''{}''';
    elsif c.data_type ~ 'timestamp|date' then v := 'now()';
    else v := quote_literal('seed-' || c.column_name); end if;
    names := names || ', ' || quote_ident(c.column_name); vals := vals || ', ' || v;
  end loop;
end $f$;
create or replace function public._cs_seed_table(t text, w uuid) returns void language plpgsql as $f$
declare r record; newid uuid;
begin
  select * into r from public._cs_row_values(t, w);
  execute format('insert into public.%I (%s) values (%s) returning id', t, r.names, r.vals) into newid;
  insert into public._cs_seed values (w, t, newid);
end $f$;
grant select on public._cs_seed to authenticated;
grant execute on function public._cs_row_values(text, uuid) to authenticated;
-- Runs as the caller (role switched by the caller); every write is undone by raising inside its block.
create or replace function public._cs_attempt(sql text) returns int language plpgsql as $f$
declare n int;
begin
  begin execute sql; get diagnostics n = row_count; raise exception using errcode = 'P0001', message = n::text;
  exception when sqlstate 'P0001' then return sqlerrm::int; when others then return -1; end;
end $f$;
grant execute on function public._cs_attempt(text) to authenticated;
"""
psql(DB, setup)
for t in TABLES:
    for w in (A, B): psql(DB, f"select public._cs_seed_table('{t}', '{w}');")

def probe(uid, t, own, other):
    q = f"""begin;
select set_config('request.jwt.claim.sub', '{uid}', true);
set local role authenticated;
select json_build_object(
 'readOwn', {f"(select count(*) from public.{t} where workspace_id='{own}')" if own else '0'},
 'readOther', (select count(*) from public.{t} where workspace_id='{other}'),
 'updateOwn', {f"public._cs_attempt($q$update public.{t} set workspace_id=workspace_id where workspace_id='{own}'$q$)" if own else '0'},
 'updateOther', public._cs_attempt($q$update public.{t} set workspace_id=workspace_id where workspace_id='{other}'$q$),
 'deleteOther', public._cs_attempt($q$delete from public.{t} where workspace_id='{other}'$q$),
 'moveOwnToOther', {f"public._cs_attempt($q$update public.{t} set workspace_id='{other}' where workspace_id='{own}'$q$)" if own else '0'},
 'insertOther', public._cs_attempt((select format('insert into public.{t} (%s) values (%s)', r.names, r.vals) from public._cs_row_values('{t}', '{other}') r)));
rollback;"""
    out = [line for line in psql(DB, q).splitlines() if line.startswith("{")]
    return json.loads(out[-1])

checks, failures, results = 0, [], {}
for t in TABLES:
    a = probe(USERS["ownerA"][0], t, A, B); b = probe(USERS["ownerB"][0], t, B, A); c = probe(USERS["clientA"][0], t, None, A)
    results[t] = {"ownerA": a, "ownerB": b, "clientA": c}
    for name, r in (("ownerA", a), ("ownerB", b)):
        for ok, label in ((r["readOwn"] > 0, "reads own"), (r["updateOwn"] > 0, "changes own"), (r["readOther"] == 0, "cannot read other"), (r["updateOther"] <= 0, "cannot update other"),
                          (r["deleteOther"] <= 0, "cannot delete other"), (r["insertOther"] <= 0, "cannot insert into other"), (r["moveOwnToOther"] <= 0, "cannot move own row into other")):
            checks += 1
            if not ok: failures.append(f"{t} {name}: {label} {r}")
    for ok, label in ((c["readOther"] == 0, "no read"), (c["updateOther"] <= 0 and c["deleteOther"] <= 0 and c["insertOther"] <= 0, "no write")):
        checks += 1
        if not ok: failures.append(f"{t} clientA: {label} {c}")
    print(("FAIL " if any(f.startswith(t + " ") for f in failures) else "PASS ") + t)
server = psql("postgres", "show server_version;").strip()
Path("artifacts/test-artifacts").mkdir(parents=True, exist_ok=True)
Path("artifacts/test-artifacts/client-selections-two-builder-rls-postgres.json").write_text(json.dumps({"database": DB, "server": server, "checks": checks, "failures": failures, "results": results}, indent=1))
# FORCE: a plain DROP failed on 16 Nov 2026 while a probe connection was still closing.
psql("postgres", f"drop database if exists {DB} with (force);")
assert not psql("postgres", f"select 1 from pg_database where datname = '{DB}';").strip(), f"{DB} was not dropped"
print(f"Client Selections two-builder RLS on real PostgreSQL: {checks - len(failures)}/{checks} checks passed across {len(TABLES)} tables (fresh database {DB}, dropped after).")
sys.exit(1 if failures else 0)
