"""Disposable databases in the dedicated Quotation container; never uses its postgres data.
Run: python scripts/test-quotation-native-postgres.py
Uses real concurrent PostgreSQL sessions, pg_dump and psql restore. Not HTTP auth acceptance.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/quotation-final-20261114'
OUT.mkdir(parents=True, exist_ok=True)
DOCKER = ['docker', '--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', 'exec', '-i', 'supabase_db_gr8-quotation-acceptance']
NAME = 'qb_accept_' + str(int(time.time()))
A, B = '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
UA, UB, UC = ['00000000-0000-4000-8000-' + str(n).zfill(12) for n in (1, 2, 3)]
P = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
IDS = ['bbbbbbbb-bbbb-4bbb-8bbb-' + str(n).zfill(12) for n in range(1, 5)]
report = {'database': NAME, 'checks': [], 'migrations': {}}

def sql(command, database=NAME, expect_error=None, timeout=45):
    r = subprocess.run(DOCKER + ['psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=command, text=True, capture_output=True, timeout=timeout)
    if expect_error:
        assert r.returncode and expect_error in r.stderr, r.stdout + r.stderr
    elif r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

def passed(name):
    report['checks'].append(name)
    print('PASS', name, flush=True)

def promotion(i, counts='0,0,0'):
    return f"select builder_promote_quotation_snapshot('{A}','{P}','{IDS[i-1]}',{counts});"

def state(database=NAME):
    return sql(f"select snapshot_number from builder_estimate_snapshots where status='current'; select contract_total from builder_commercial_projects where id='{P}';", database)

try:
    sql('create database ' + NAME, 'postgres')
    sql(f"""create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table workspaces(id uuid primary key,name text);
    create table workspace_members(workspace_id uuid,user_id uuid,role text,status text);
    create table workspace_entitlements(workspace_id uuid,entitlement text);
    create table communities(workspace_id uuid,name text);
    insert into workspaces values ('{A}','A'),('{B}','B');
    insert into auth.users values ('{UA}'),('{UB}'),('{UC}');
    insert into workspace_members values ('{A}','{UA}','owner','active'),('{B}','{UB}','owner','active'),('{A}','{UC}','client','active');
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant select on workspace_members,workspaces to authenticated;""")
    # Same dependency order as the verified in-memory suite.
    import re
    files = re.findall(r"'([0-9]{14}_[^']+\.sql)'", (ROOT/'scripts/test-quotation-snapshot-promotion.mjs').read_text())
    for name in files:
        data = (ROOT/'supabase/migrations'/name).read_bytes()
        sql(data.decode('utf-8'))
        report['migrations'][name] = hashlib.sha256(data).hexdigest()
    passed('12 migration dependencies apply in order on native PostgreSQL')
    sql(f"grant select,insert,update,delete on all tables in schema public to authenticated; insert into builder_commercial_projects(id,workspace_id,project_name) values ('{P}','{A}','Disposable');")
    for n, id in enumerate(IDS, 1):
        sql(f"insert into builder_estimate_snapshots(id,workspace_id,project_id,snapshot_number,final_quote_total) values ('{id}','{A}','{P}',{n},{n*100});")
    assert sql('set role service_role;' + promotion(1)) == 't'
    sql(promotion(2, '1,0,0'), expect_error='incomplete')
    assert state() == '1\n100.00'
    passed('incomplete candidate preserves current snapshot and project total')
    for role in ['anon', 'authenticated']:
        sql('set role ' + role + ';' + promotion(2), expect_error='permission denied')
    for user, count in [(UA, 4), (UB, 0), (UC, 0)]:
        assert sql(f"set request.jwt.claim.sub='{user}'; set role authenticated; select count(*) from builder_estimate_snapshots;") == str(count)
    sql(f"set request.jwt.claim.sub='{UB}'; set role authenticated; insert into builder_estimate_snapshots(workspace_id,project_id,snapshot_number) values ('{A}','{P}',9);", expect_error='row-level security')
    passed('two-builder and client SQL permissions enforce confidential read/write isolation')
    # Session 1 takes the project row lock before session 2 attempts promotion.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(sql, "begin; set local application_name='qb_promotion_lock'; " + promotion(2) + 'select pg_sleep(3); commit;')
        for _ in range(30):
            if sql("select count(*) from pg_stat_activity where application_name='qb_promotion_lock' and wait_event='PgSleep';") == '1':
                break
            time.sleep(0.1)
        else:
            raise AssertionError('Could not observe first session holding promotion lock')
        assert state() == '1\n100.00', 'uncommitted promotion became visible'
        second = pool.submit(sql, promotion(3))
        first.result()
        assert second.result() == 't'
    assert state() == '3\n300.00'
    assert sql(promotion(2)) == 'f'
    passed('overlapping native sessions serialize promotion; one current snapshot and latest total; stale completion rejected')
    sql('begin;' + promotion(4) + 'rollback;')
    assert state() == '3\n300.00'
    passed('promotion and project total roll back together')
    dump = subprocess.run(DOCKER + ['pg_dump', '-U', 'postgres', '-d', NAME, '--no-owner'], capture_output=True, timeout=45, check=True).stdout
    (OUT/'synthetic-quotation-backup.sql').write_bytes(dump)
    report['backup_sha256'] = hashlib.sha256(dump).hexdigest()
    restored = NAME + '_restore'
    sql('create database ' + restored, 'postgres')
    sql(dump.decode(), restored, timeout=600)  # restoring a full dump through docker exec can exceed 45 s
    assert state(restored) == state()
    inventory = "select tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname='public' order by 1;"
    assert sql(inventory, restored) == sql(inventory)
    assert sql(promotion(2), restored) == 'f'
    for user, count in [(UA, 4), (UB, 0), (UC, 0)]:
        assert sql(f"set request.jwt.claim.sub='{user}'; set role authenticated; select count(*) from builder_estimate_snapshots;", restored) == str(count)
    passed('pg_dump backup restored to second empty database; current totals, policies, promotion and tenant restrictions preserved')
    sql((ROOT/'supabase/release/quotation-v1/rollback_20261113000100.sql').read_text(), restored)
    assert sql("select to_regprocedure('public.builder_promote_quotation_snapshot(uuid,uuid,uuid,integer,integer,integer)') is null;", restored) == 't'
    assert state(restored) == '3\n300.00'
    passed('promotion migration rollback removes function without deleting quotation data')
    report['passed'] = True
finally:
    (OUT/'native-postgres.json').write_text(json.dumps(report, indent=2))
    # Leave uniquely named synthetic databases for evidence; never drop shared databases.
