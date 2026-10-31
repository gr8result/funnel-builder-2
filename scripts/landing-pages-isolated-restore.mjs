// Restores an encrypted logical backup made by landing-pages-logical-recovery.mjs into a network-isolated local Supabase
// Postgres container, verifies it table by table, then validates the Landing Pages migration against the restored schema.
//
// Isolation: the container runs with --network none, so nothing inside it (pg_net, pg_cron, webhooks, email functions) can
// reach production or customers. Scheduled jobs, the pg_net queue and database-webhook hook rows are not restored at all.
// Decrypted archives exist only on a tmpfs inside that container. Output is counts and booleans; no row data is printed.
//
// Usage (key from the protected parent process): node scripts/landing-pages-isolated-restore.mjs <backup-directory>
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const IMAGE = 'public.ecr.aws/supabase/postgres:17.4.1.074';
const MAGIC = Buffer.from('GR8REC01');
const MIGRATION = 'supabase/migrations/20261014000100_landing_page_campaigns.sql';
const NOT_RESTORED = ['cron', 'net', 'pgsodium', 'supabase_functions'];
const directory = process.argv[2];
const key = Buffer.from(process.env.GR8_RECOVERY_KEY || '', 'base64');
const name = `gr8-isolated-restore-${crypto.randomUUID().slice(0, 8)}`;
const env = { ...process.env, PGPASSWORD: crypto.randomBytes(24).toString('hex') };
delete env.GR8_RECOVERY_KEY;

function decrypt(source) {
  const descriptor = fs.openSync(source, 'r');
  const size = fs.fstatSync(descriptor).size;
  const header = Buffer.alloc(MAGIC.length + 12);
  const tag = Buffer.alloc(16);
  fs.readSync(descriptor, header, 0, header.length, 0);
  fs.readSync(descriptor, tag, 0, 16, size - 16);
  fs.closeSync(descriptor);
  assert(header.subarray(0, MAGIC.length).equals(MAGIC), 'Invalid encrypted archive');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return { input: fs.createReadStream(source, { start: header.length, end: size - 17 }), decipher };
}

async function decryptToBuffer(file) {
  const { input, decipher } = decrypt(path.join(directory, file));
  const chunks = [];
  await pipeline(input, decipher, new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); } }));
  return Buffer.concat(chunks);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex');

// Runs a bash script inside the isolated container; the script arrives on stdin, never in argv.
function inContainer(script, { timeout = 600_000, allowFailure = false } = {}) {
  const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', name, 'bash', '-s'], { input: script, encoding: 'utf8', env, timeout, maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) throw new Error(`Isolated container step failed: ${(result.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 400)}`);
  return result;
}

// Streams an archive's plaintext straight into the container tmpfs; plaintext never touches the host disk.
async function copyIntoContainer(file) {
  const child = spawn('docker', ['exec', '-i', name, 'sh', '-c', `cat > /restore/${file.replace(/\.enc$/, '')}`], { stdio: ['pipe', 'ignore', 'pipe'] });
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const { input, decipher } = decrypt(path.join(directory, file));
  await pipeline(input, decipher, child.stdin);
  assert.equal(await done, 0, `Could not stage ${file} in the isolated container`);
}

const psql = (sql, { user = 'supabase_admin', allowFailure = false } = {}) => inContainer(`psql -X -q -A -t -h localhost -U ${user} -d postgres -v ON_ERROR_STOP=1 <<'GR8SQL'\n${sql}\nGR8SQL\n`, { allowFailure });

function summariseRestoreErrors(stderr) {
  const errors = stderr.split('\n').filter((line) => /^pg_restore: error:|^psql:.*ERROR:/.test(line));
  const categories = {};
  for (const line of errors) {
    const kind = /already exists/.test(line) ? 'already-exists' : /does not exist/.test(line) ? 'missing-dependency' : /must be owner|permission denied/.test(line) ? 'permission' : /reserved|cannot be altered|predefined/.test(line) ? 'reserved-role' : 'other';
    categories[kind] = (categories[kind] || 0) + 1;
  }
  const other = errors.filter((line) => !/already exists|does not exist|must be owner|permission denied|reserved|cannot be altered|predefined/.test(line))
    .map((line) => line.replace(/'[^']*'/g, "'…'").replace(/[^a-zA-Z0-9 .,:_"()\-]/g, '').slice(0, 200)).slice(0, 8);
  return { errors: errors.length, categories, otherSamples: other };
}

const report = { isolatedContainer: { network: 'none', image: IMAGE } };
try {
  assert.equal(key.length, 32, 'Recovery key must be provided through the protected parent process');
  assert(directory && fs.existsSync(path.join(directory, 'manifest.json.enc')), 'A completed encrypted backup (manifest.json.enc) is required');

  // 1. Integrity: every archive's GCM tag authenticates and matches the manifest hash and size.
  const manifest = JSON.parse((await decryptToBuffer('manifest.json.enc')).toString('utf8'));
  const archives = [manifest.roles, manifest.schema, manifest.data, manifest.largeTable, manifest.estimateSnapshots].filter(Boolean);
  for (const archive of archives) {
    assert.equal(sha256(archive.file), archive.sha256, `${archive.file} hash mismatch`);
    assert.equal(fs.statSync(path.join(directory, archive.file)).size, archive.bytes, `${archive.file} size mismatch`);
  }
  report.integrity = { archives: archives.map((archive) => archive.file), sha256AndGcmVerified: true, backupCreatedAt: manifest.createdAt };

  // 2. Network-isolated Supabase Postgres.
  const run = spawnSync('docker', ['run', '-d', '--name', name, '--network', 'none', '--memory', '3g', '--tmpfs', '/restore:rw,noexec,nosuid,size=1536m', '-e', 'POSTGRES_PASSWORD', '-e', 'PGPASSWORD', IMAGE], { encoding: 'utf8', env: { ...env, POSTGRES_PASSWORD: env.PGPASSWORD } });
  assert.equal(run.status, 0, 'Could not start the isolated restore container');
  const inspect = spawnSync('docker', ['inspect', '-f', '{{.HostConfig.NetworkMode}}', name], { encoding: 'utf8' });
  assert.equal(inspect.stdout.trim(), 'none', 'Restore container is not network-isolated');
  const ready = Date.now() + 180_000;
  while (true) {
    const probe = psql(`select count(*) from pg_roles where rolname in ('authenticator','service_role','authenticated','anon')`, { allowFailure: true });
    if (probe.status === 0 && probe.stdout.trim() === '4') break;
    assert(Date.now() < ready, 'Isolated Postgres did not finish initialising');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const outbound = inContainer(`(getent hosts supabase.co >/dev/null 2>&1 && echo dns) || echo no-dns; ip -o link 2>/dev/null | grep -vc ' lo:' || true`, { allowFailure: true }).stdout.trim().split('\n');
  report.isolatedContainer.outboundDns = outbound[0];
  assert.equal(outbound[0], 'no-dns', 'Restore container can resolve external hosts');

  // 3. Stage plaintext archives on the container tmpfs only.
  for (const archive of archives) await copyIntoContainer(archive.file);

  // 4. Replace the image's placeholder Supabase-managed schemas with production's definitions from the dump.
  psql(`drop schema if exists auth cascade; drop schema if exists storage cascade;`);
  psql(`create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;`);
  const roles = inContainer(`psql -X -q -h localhost -U supabase_admin -d postgres -f /restore/roles.sql 2>&1 >/dev/null`, { allowFailure: true });
  report.rolesRestore = summariseRestoreErrors(roles.stdout + roles.stderr);
  const schema = inContainer(`pg_restore -h localhost -U supabase_admin -d postgres --schema-only --no-comments /restore/schema.dump 2>&1 >/dev/null; true`, { allowFailure: true });
  report.schemaRestore = summariseRestoreErrors(schema.stdout + schema.stderr);

  // 5. Data, without scheduled jobs, the HTTP queue or webhook hook rows; triggers off so nothing fires during load.
  const dataFiles = archives.filter((archive) => /\.dump\.enc$/.test(archive.file) && archive !== manifest.schema).map((archive) => archive.file.replace(/\.enc$/, ''));
  const excluded = NOT_RESTORED.join('|');
  let dataStderr = '';
  for (const file of dataFiles) {
    const result = inContainer(`pg_restore -l /restore/${file} | grep -vE ' TABLE DATA (${excluded}) ' > /restore/${file}.list
pg_restore -h localhost -U supabase_admin -d postgres --data-only --disable-triggers -L /restore/${file}.list /restore/${file} 2>&1 >/dev/null; true`, { allowFailure: true });
    dataStderr += result.stdout + result.stderr;
  }
  report.dataRestore = summariseRestoreErrors(dataStderr);
  psql(`do $$ begin if to_regclass('cron.job') is not null then update cron.job set active = false; end if; end $$;`);
  report.isolatedContainer.scheduledJobsActive = Number(psql(`select case when to_regclass('cron.job') is null then 0 else (select count(*) from cron.job where active) end`).stdout.trim());

  // 6. Row-count verification: every table in the archives against the restored database.
  const archiveCounts = new Map();
  for (const file of dataFiles) {
    const counted = inContainer(`pg_restore -f - --data-only -L /restore/${file}.list /restore/${file} | awk '/^COPY /{t=$2; n=0; c=1; next} c && /^\\\\\\.$/{print t" "n; c=0; next} c{n++}'`).stdout;
    for (const line of counted.trim().split('\n').filter(Boolean)) {
      const [table, rows] = line.split(' ');
      archiveCounts.set(table, (archiveCounts.get(table) || 0) + Number(rows));
    }
  }
  const tables = [...archiveCounts.keys()];
  assert(tables.every((table) => /^[A-Za-z0-9_."]+$/.test(table)), 'Unexpected table identifier in archive');
  const restored = new Map(psql(tables.map((table) => `select '${table.replace(/'/g, "''")}', count(*) from ${table};`).join('\n'), { allowFailure: true }).stdout
    .trim().split('\n').filter(Boolean).map((line) => { const [table, rows] = line.split('|'); return [table, Number(rows)]; }));
  const mismatched = tables.filter((table) => restored.get(table) !== archiveCounts.get(table));
  const publicTables = tables.filter((table) => table.startsWith('public.'));
  report.rowVerification = {
    tablesInArchive: tables.length,
    publicTables: publicTables.length,
    archiveRows: [...archiveCounts.values()].reduce((sum, rows) => sum + rows, 0),
    restoredRows: tables.reduce((sum, table) => sum + (restored.get(table) || 0), 0),
    mismatchedTables: mismatched.map((table) => ({ table, archive: archiveCounts.get(table), restored: restored.get(table) ?? null })),
    notRestoredByDesign: NOT_RESTORED.map((schema) => `${schema}.* data`),
  };
  report.restoreVerified = mismatched.filter((table) => table.startsWith('public.')).length === 0 && publicTables.length > 0;

  // 7. Pre-migration compatibility on the restored production schema.
  const pre = JSON.parse(psql(`select json_build_object(
    'existingLandingTables', (select coalesce(json_agg(c.relname), '[]') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('landing_campaigns','landing_pages','landing_page_versions','landing_page_submissions','landing_page_events','landing_audit_log')),
    'existingLpFunctions', (select coalesce(json_agg(p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'lp\\_%'),
    'workspaceMemberColumns', (select json_agg(column_name order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'workspace_members' and column_name in ('workspace_id','user_id','role','status')),
    'leadColumns', (select json_agg(column_name order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name in ('id','user_id','workspace_id','name','email','phone','source','lead_source','tags','lead_status','notes','created_at','updated_at')),
    'leadNoteColumns', (select json_agg(column_name order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'lead_notes' and column_name in ('id','lead_id','user_id','note','created_at')),
    'workspacesIdIsUuid', (select data_type = 'uuid' from information_schema.columns where table_schema = 'public' and table_name = 'workspaces' and column_name = 'id'),
    'leadsTriggers', (select coalesce(json_agg(tgname order by tgname), '[]') from pg_trigger where tgrelid = 'public.leads'::regclass and not tgisinternal),
    'leadNotesTriggers', (select coalesce(json_agg(tgname order by tgname), '[]') from pg_trigger where tgrelid = 'public.lead_notes'::regclass and not tgisinternal),
    'leadsRequiredWithoutDefault', (select coalesce(json_agg(column_name order by column_name), '[]') from information_schema.columns where table_schema = 'public' and table_name = 'leads' and is_nullable = 'NO' and column_default is null and column_name not in ('user_id','email','workspace_id','name','phone','source','lead_source','tags','lead_status','created_at','updated_at')),
    'workspaceCount', (select count(*) from public.workspaces),
    'activeMemberships', (select count(*) from public.workspace_members where coalesce(status, 'active') = 'active')
  )`).stdout.trim());
  report.preMigration = pre;

  // 8. Apply the migration exactly as production would (as postgres), twice for re-runnability.
  const migrationSql = fs.readFileSync(MIGRATION, 'utf8');
  const apply = () => spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', name, 'psql', '-X', '-q', '-h', 'localhost', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-1'], { input: migrationSql, encoding: 'utf8', env });
  const first = apply();
  const second = apply();
  report.migration = {
    firstApply: first.status === 0 ? 'ok' : `failed: ${(first.stderr || '').split('\n').filter((line) => /ERROR/.test(line)).slice(0, 3).join(' | ').slice(0, 400)}`,
    secondApply: second.status === 0 ? 'ok' : `failed: ${(second.stderr || '').split('\n').filter((line) => /ERROR/.test(line)).slice(0, 3).join(' | ').slice(0, 400)}`,
  };
  if (first.status === 0) {
    report.migration.readiness = JSON.parse(psql(`select public.lp_readiness()`).stdout.trim());
    report.migration.existingRowsUnchanged = (() => {
      const after = new Map(psql(publicTables.map((table) => `select '${table}', count(*) from ${table};`).join('\n')).stdout.trim().split('\n').map((line) => { const [table, rows] = line.split('|'); return [table, Number(rows)]; }));
      return publicTables.every((table) => after.get(table) === restored.get(table));
    })();

    // 9. Behaviour on real restored tenants, inside a transaction that is rolled back. Only booleans/counts are returned.
    const behaviour = psql(`begin;
create temp table gr8_result (check_name text, ok boolean) on commit drop;
grant all on gr8_result to public;
do $$
declare a uuid; b uuid; ua uuid; ub uuid; camp uuid; camp_b uuid; page uuid; ver uuid; sub uuid; lead1 uuid; lead2 uuid; visible int; hidden int; ok boolean; ok2 boolean;
begin
  select m.workspace_id, m.user_id into a, ua from public.workspace_members m where coalesce(m.status,'active') = 'active' order by m.workspace_id limit 1;
  select m.workspace_id, m.user_id into b, ub from public.workspace_members m where coalesce(m.status,'active') = 'active' and m.workspace_id <> a
    and not exists (select 1 from public.workspace_members x where x.workspace_id = a and x.user_id = m.user_id) order by m.workspace_id limit 1;
  insert into gr8_result values ('two real tenants found', a is not null and b is not null);
  if a is null or b is null then return; end if;

  insert into public.landing_campaigns (workspace_id, created_by, name) values (a, ua, 'GR8 isolated validation campaign') returning id into camp;
  insert into public.landing_pages (workspace_id, campaign_id, created_by, slug, title) values (a, camp, ua, 'gr8-isolated-validation-' || substr(md5(random()::text), 1, 8), 'Validation') returning id into page;
  insert into public.landing_page_versions (workspace_id, page_id, version_no, kind, document) values (a, page, 1, 'publish', '{}') returning id into ver;
  update public.landing_pages set published_version_id = ver, status = 'published' where id = page;
  insert into public.landing_page_submissions (workspace_id, campaign_id, page_id, page_version_id, idempotency_key, name, email, phone, fields, consent)
    values (a, camp, page, ver, 'gr8-validation-0001', 'Validation Person', 'gr8-isolated-validation@example.invalid', null, '{"message":"validation"}', true) returning id into sub;
  lead1 := public.lp_sync_submission(sub);
  lead2 := public.lp_sync_submission(sub);
  insert into gr8_result values ('submission becomes a CRM lead in the same workspace', exists (select 1 from public.leads where id = lead1 and workspace_id = a));
  insert into gr8_result values ('re-sync is idempotent (same lead, one note)', lead1 = lead2 and (select count(*) from public.lead_notes where lead_id = lead1) = 1);
  insert into gr8_result values ('submission marked synced', (select status = 'synced' and lead_id = lead1 from public.landing_page_submissions where id = sub));
  begin
    insert into public.landing_pages (workspace_id, campaign_id, created_by, slug) values (b, camp, ub, 'gr8-cross-tenant');
    insert into gr8_result values ('page cannot attach to another tenant campaign', false);
  exception when foreign_key_violation then insert into gr8_result values ('page cannot attach to another tenant campaign', true);
  end;
  insert into public.landing_campaigns (workspace_id, created_by, name) values (b, ub, 'GR8 isolated validation other tenant campaign') returning id into camp_b;
  begin
    insert into public.landing_page_events (workspace_id, campaign_id, page_id, type) values (a, camp_b, page, 'visit');
    insert into gr8_result values ('event cannot attach to another tenant campaign', false);
  exception when foreign_key_violation then insert into gr8_result values ('event cannot attach to another tenant campaign', true);
  end;

  perform set_config('request.jwt.claim.sub', ua::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into visible from public.landing_campaigns where id = camp;
  reset role;
  insert into gr8_result values ('member sees own workspace campaign', visible = 1);

  perform set_config('request.jwt.claim.sub', ub::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into visible from public.landing_campaigns where id = camp;
  select count(*) into hidden from public.landing_page_submissions where id = sub;
  begin
    insert into public.landing_campaigns (workspace_id, created_by, name) values (a, ub, 'cross-tenant write');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  begin
    perform public.lp_sync_submission(sub);
    ok2 := false;
  exception when insufficient_privilege then ok2 := true;
  end;
  reset role;
  insert into gr8_result values ('other tenant cannot see campaign', visible = 0);
  insert into gr8_result values ('other tenant cannot see submission', hidden = 0);
  insert into gr8_result values ('other tenant cannot write into workspace', ok);
  insert into gr8_result values ('authenticated users cannot call lp_sync_submission', ok2);

  set local role anon;
  begin
    select count(*) into visible from public.landing_pages;
    ok := visible = 0;
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  insert into gr8_result values ('anonymous role reads no landing pages', ok);
end $$;
select coalesce(json_agg(json_build_object('check', check_name, 'ok', ok)), '[]') from gr8_result;
rollback;`);
    report.migration.behaviour = JSON.parse(behaviour.stdout.trim().split('\n').filter((line) => line.startsWith('[')).pop());
    report.migration.passed = first.status === 0 && second.status === 0 && report.migration.readiness.ready === true
      && report.migration.existingRowsUnchanged && report.migration.behaviour.length > 0 && report.migration.behaviour.every((check) => check.ok);
  } else report.migration.passed = false;

  console.log(JSON.stringify(report, null, 2));
  if (!report.restoreVerified || !report.migration.passed) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ isolatedRestoreComplete: false, error: error.message }));
  process.exitCode = 1;
} finally {
  key.fill(0);
  if (process.env.GR8_KEEP_RESTORE !== '1') spawnSync('docker', ['rm', '-f', '-v', name], { stdio: 'ignore' });
  else console.error(JSON.stringify({ keptIsolatedContainer: name }));
}
