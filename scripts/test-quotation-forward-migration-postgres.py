"""Forward fix 20261116000100 on native PostgreSQL, starting from PRODUCTION's original migration files.
Disposable database in the dedicated Quotation container only. Run: python scripts/test-quotation-forward-migration-postgres.py
"""
import json, subprocess, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCKER = ['docker', '--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', 'exec', '-i', 'supabase_db_gr8-quotation-acceptance']
NAME = 'qb_forward_' + str(int(time.time()))
WS, TPL = '11111111-1111-4111-8111-111111111111', 'tpl-1'
report = {'database': NAME, 'checks': []}

def sql(command, database=NAME, expect_error=None, timeout=120):
    r = subprocess.run(DOCKER + ['psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=command, text=True, capture_output=True, timeout=timeout)
    if expect_error:
        assert r.returncode and expect_error in r.stderr, r.stdout + r.stderr
    elif r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

def production(name):
    return subprocess.run(['git', 'show', f'origin/main:supabase/migrations/{name}'], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8')

def passed(name):
    report['checks'].append(name); print('PASS', name, flush=True)

try:
    sql('create database ' + NAME, 'postgres')
    sql("""do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table workspaces(id uuid primary key,name text);
    create table workspace_members(workspace_id uuid,user_id uuid,role text,status text);
    create table workspace_entitlements(workspace_id uuid,entitlement text);
    create table communities(workspace_id uuid,name text);
    grant usage on schema public,auth to anon,authenticated,service_role;""")
    import re
    order = re.findall(r"'([0-9]{14}_[^']+\.sql)'", (ROOT / 'scripts/test-quotation-snapshot-promotion.mjs').read_text())
    for name in order:
        if name.startswith('20261113'): continue
        # The three corrected files are applied in their PRODUCTION (original) form.
        body = production(name) if name.startswith(('20261010000100', '20261011000100', '20261021000100')) else (ROOT / 'supabase/migrations' / name).read_text(encoding='utf-8')
        sql(body)
    long_rules = sql("select count(*) from pg_constraint where conrelid='public.builder_requirement_quote_mappings'::regclass and contype='u' and conname like '%location_id_key%';")
    report['beforeForwardFix'] = {'perRoomRuleStillPresent': long_rules}
    passed(f'production migration versions applied (per-room rule left behind by the original drop: {long_rules})')
    fix = (ROOT / 'supabase/migrations/20261116000100_quotation_v1_forward_fixes.sql').read_text(encoding='utf-8')
    sql(fix); sql(fix)
    passed('forward fix applies twice without error (idempotent)')
    rules = sql("select string_agg(conname, ',' order by conname) from pg_constraint where conrelid='public.builder_requirement_quote_mappings'::regclass and contype='u';")
    assert 'identity_unique' in rules and 'location_id_key' not in rules and 'location_unique' not in rules, rules
    cols = sql("select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='builder_requirement_quote_mappings';")
    report['uniqueRules'] = rules
    passed(f'exactly one product-specific identity rule remains ({rules})')
    required = sql("select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='builder_requirement_quote_mappings' and is_nullable='NO' and column_default is null and column_name not in ('id');")
    base = {'workspace_id': f"'{WS}'", 'template_id': f"'{TPL}'", 'requirement_key': "'ceiling-fan'", 'location_id': "'bed-1'"}
    def insert(product):
        values = dict(base, product_id=f"'{product}'")
        for column in [c for c in (required or '').split(',') if c and c not in values]:
            values[column] = "'x'"
        return f"insert into builder_requirement_quote_mappings({','.join(values)}) values ({','.join(values.values())});"
    sql(insert('fan-a')); sql(insert('fan-b'))
    sql(insert('fan-a'), expect_error='duplicate key')
    passed('a second product in the same room is accepted; the same product twice is refused')
    assert sql("select has_function_privilege('anon','public.builder_commercial_is_internal_member(uuid)','execute');") == 'f'
    passed('anon cannot execute builder_commercial_is_internal_member(uuid)')
    report['passed'] = True
finally:
    out = ROOT / 'artifacts/quotation-final-20261116'; out.mkdir(parents=True, exist_ok=True)
    (out / 'forward-migration-postgres.json').write_text(json.dumps(report, indent=2))
