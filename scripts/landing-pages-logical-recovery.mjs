import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';

const IMAGE = 'public.ecr.aws/supabase/postgres:17.4.1.074';
const SOURCE = 'bvtxfphktypdqmlnveqf';
const MAGIC = Buffer.from('GR8REC01');
const mode = process.argv[2];
const directory = process.argv[3];
const key = mode === 'self-test' ? crypto.randomBytes(32) : Buffer.from(process.env.GR8_RECOVERY_KEY || '', 'base64');

async function encrypt(readable, destination) {
  assert.equal(key.length, 32, 'A private recovery key is required');
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(MAGIC);
  const output = fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, nonce]));
  await pipeline(readable, cipher, output);
  fs.appendFileSync(destination, cipher.getAuthTag());
}

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

async function resolvePoolerAddress(host) {
  const supplied = process.env.GR8_RECOVERY_HOSTADDR;
  if (supplied && isIPv4(supplied)) return supplied;
  try { return (await lookup(host, { family: 4 })).address; } catch {}
  const endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`;
  const response = await fetch(endpoint, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Read-only DNS fallback failed for the Supabase pooler');
  const answer = (await response.json()).Answer?.find((entry) => entry.type === 1 && isIPv4(entry.data));
  if (!answer) throw new Error('No IPv4 address returned for the Supabase pooler');
  return answer.data;
}

async function authenticate(source) {
  const { input, decipher } = decrypt(source);
  await pipeline(input, decipher, new Writable({ write(chunk, encoding, done) { done(); } }));
}

const exportValue = (prefix, name) => prefix.match(new RegExp(`^export ${name}=(?:'([^']*)'|"([^"]*)"|([^\\s]*))$`, 'm'))?.slice(1).find((value) => value !== undefined) ?? null;

// The CLI mints a temporary cli_login_postgres.<ref> role per call (rotating its password). When minting fails it silently
// falls back to postgres.<ref> with a prompted password, which reads empty from a non-TTY stdin. Only a matched pair is accepted:
// the minted CLI role, or postgres.<ref> when the wrapper explicitly hands the database password over via SUPABASE_DB_PASSWORD.
function parseCliPlan(generated, explicitPassword) {
  const command = /^pg_dump(?:\s|$)/m.exec(generated);
  assert(command, 'Unsupported CLI dump plan');
  const prefix = generated.slice(0, command.index);
  for (const name of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) assert(new RegExp(`(?:export\\s+)?${name}=`).test(prefix), `Missing connection variable ${name}`);
  const user = exportValue(prefix, 'PGUSER');
  const expectedUser = explicitPassword ? `postgres.${SOURCE}` : `cli_login_postgres.${SOURCE}`;
  if (user !== expectedUser) {
    throw new Error(explicitPassword
      ? 'CLI did not pair the supplied database password with the postgres pooler user'
      : 'Supabase CLI could not mint its temporary login role and fell back to a database password prompt; retry, or rerun the wrapper with -UseDatabasePassword');
  }
  assert(exportValue(prefix, 'PGPASSWORD'), 'CLI produced an empty database password');
  assert.equal(exportValue(prefix, 'PGDATABASE'), 'postgres', 'Unexpected database name in CLI connection metadata');
  return { prefix, user };
}

function mintCliCredentials() {
  const explicitPassword = Boolean(process.env.SUPABASE_DB_PASSWORD);
  for (let attempt = 1; ; attempt += 1) {
    const result = spawnSync('supabase', ['db', 'dump', '--linked', '--dry-run'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1_000_000, timeout: 60_000 });
    if (result.status !== 0) throw new Error('Supabase CLI database authorization is unavailable (supabase login / supabase link required)');
    try { return parseCliPlan(result.stdout, explicitPassword); } catch (error) {
      // A role-minting fallback is transient; a mismatched explicit password is not.
      if (explicitPassword || attempt >= 3) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
  }
}

let credentials = null;
async function connectionPrefix({ refresh = false } = {}) {
  // The minted role is short-lived; open sessions (such as the snapshot holder) survive a refresh, new connections need a live one.
  if (!credentials || refresh || Date.now() - credentials.mintedAt > 240_000) credentials = { ...mintCliCredentials(), mintedAt: Date.now() };
  const { prefix } = credentials;
  const linked = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  assert.equal(linked, SOURCE, 'Linked database target mismatch');
  const direct = process.env.GR8_RECOVERY_DIRECT === '1';
  const host = direct ? `db.${SOURCE}.supabase.co` : exportValue(prefix, 'PGHOST');
  assert(host, 'Missing PostgreSQL host in CLI connection metadata');
  const address = await resolvePoolerAddress(host);
  const certificate = fs.existsSync(path.join(directory, 'root-ca.crt')) ? '/opt/gr8-root-ca.crt' : '/etc/ssl/certs/ca-certificates.crt';
  const directSettings = direct ? `\nexport PGHOST=${host}\nexport PGPORT=5432\nexport PGUSER=${credentials.user.split('.')[0]}` : '';
  return prefix + `${directSettings}\nexport PGHOSTADDR=${address}\nexport PGSSLMODE=verify-full\nexport PGSSLROOTCERT=${certificate}\nexport PGCONNECT_TIMEOUT=${direct ? 12 : 20}\nexport PGOPTIONS="-c default_transaction_read_only=on"\n`;
}

async function probeDirect(directory) {
  const certificate = path.join(directory, 'root-ca.crt');
  const mounts = fs.existsSync(certificate) ? ['--mount', `type=bind,source=${certificate},target=/opt/gr8-root-ca.crt,readonly`] : [];
  const shell = `${await connectionPrefix()}\nresult=$(psql -X -v ON_ERROR_STOP=1 -A -t -c "select json_build_object('database',current_database(),'server_version',current_setting('server_version'))::text")\nprintf '%s\\n' "$result"\n`;
  const result = spawnSync('docker', ['run', '--rm', '-i', '--network', 'bridge', '--memory', '192m', '--cpus', '1', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', ...mounts, '--entrypoint', '/bin/bash', IMAGE, '-s'], { input: shell, encoding: 'utf8', timeout: 25_000, maxBuffer: 4096 });
  if (result.status !== 0) {
    const text = result.stderr || '';
    const reason = /password authentication failed/i.test(text) ? 'Temporary CLI-role authentication failed on the direct database host' : /certificate verify failed|SSL|certificate/i.test(text) ? 'Verified TLS failed on the direct database host' : /timeout|could not translate host|could not connect/i.test(text) ? 'Direct database endpoint is not reachable from this network' : 'Read-only direct connection probe failed';
    throw new Error(reason);
  }
  const response = JSON.parse(result.stdout.trim());
  assert.equal(response.database, 'postgres');
  console.log(JSON.stringify({ directConnection: 'verified', database: response.database, postgresVersion: response.server_version, readOnly: true }));
}

const failureKind = (text) => /permission denied|must be owner/i.test(text) ? 'permission' : /certificate verify failed|unable to get local issuer|root certificate file/i.test(text) ? 'tls' : /password authentication failed|authentication failed|no password supplied|EAUTHQUERY|invalid secret format/i.test(text) ? 'authentication' : /could not translate host|name resolution/i.test(text) ? 'dns' : /SSL connection has been closed|server closed|PQgetCopyData|connection.*(?:closed|reset)|SSL SYSCALL|timed out|timeout expired/i.test(text) ? 'connection-dropped' : 'other';
const FAILURE_REASON = { permission: 'PostgreSQL backup permission denied', tls: 'PostgreSQL TLS verification failed', authentication: 'PostgreSQL backup authentication failed', dns: 'Supabase pooler DNS resolution failed', 'connection-dropped': 'PostgreSQL connection dropped during export', other: 'PostgreSQL export failed' };

async function exportOnce(command, encrypted, diagnosticsFile) {
  const name = `gr8-logical-export-${crypto.randomUUID().slice(0, 8)}`;
  const certificate = path.join(directory, 'root-ca.crt');
  const mounts = fs.existsSync(certificate) ? ['--mount', `type=bind,source=${certificate},target=/opt/gr8-root-ca.crt,readonly`] : [];
  const prefix = await connectionPrefix();
  const child = spawn('docker', ['run', '--rm', '-i', '--name', name, '--memory', '384m', '--cpus', '1', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--network', 'bridge', ...mounts, '--entrypoint', '/bin/bash', IMAGE, '-s'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const diagnostics = [];
  let diagnosticBytes = 0;
  child.stderr.on('data', (chunk) => { if (diagnosticBytes < 262144) { diagnostics.push(chunk); diagnosticBytes += chunk.length; } });
  const completion = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code) => resolve(code)); });
  child.stdin.on('error', () => {});
  child.stdin.end(prefix + `
exec ${command}
`);
  await encrypt(child.stdout, encrypted);
  const status = await completion;
  await encrypt(Readable.from(Buffer.concat(diagnostics)), diagnosticsFile);
  return { status, text: Buffer.concat(diagnostics).toString('utf8') };
}

async function exportEncrypted(command, filename, { attempts = 3 } = {}) {
  const encrypted = path.join(directory, filename);
  for (let attempt = 1; ; attempt += 1) {
    const diagnosticsFile = path.join(directory, `${filename}.diagnostics.enc`);
    const { status, text } = await exportOnce(command, encrypted, diagnosticsFile);
    if (status === 0) break;
    const kind = failureKind(text);
    const lastTables = [...text.matchAll(/(?:dumping contents of table|contents of table)\s+"?([a-zA-Z0-9_.-]+)"?/gi)].slice(-4).map((match) => match[1]);
    console.error(JSON.stringify({ backupStep: filename, attempt, exitCode: status, failure: kind, lastProgressTables: lastTables }));
    // Keep each failed attempt's encrypted diagnostics; drop the incomplete encrypted archive so the retry can write afresh.
    fs.renameSync(diagnosticsFile, path.join(directory, `${filename}.attempt${attempt}.diagnostics.enc`));
    fs.rmSync(encrypted, { force: true });
    if (attempt >= attempts || !['authentication', 'connection-dropped', 'dns'].includes(kind)) throw new Error(`${FAILURE_REASON[kind]}; encrypted diagnostics retained (exit ${status})`);
    if (kind === 'authentication') await connectionPrefix({ refresh: true });
    await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
  }
  await authenticate(encrypted);
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(encrypted)) hash.update(chunk);
  return { file: filename, bytes: fs.statSync(encrypted).size, sha256: hash.digest('hex') };
}

async function exportTable(directory, table) {
  assert(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(table), 'Expected a qualified table name');
  const filename = `${table.replace('.', '_')}.dump.enc`;
  const archive = await exportEncrypted(`pg_dump --format=custom --compress=5 --no-tablespaces --no-password --role=postgres --serializable-deferrable --lock-wait-timeout=30000 --table=${table}`, filename);
  console.log(JSON.stringify({ encryptedTableExportComplete: true, table, archive }));
}

async function openSnapshot(directory) {
  const certificate = path.join(directory, 'root-ca.crt');
  const mounts = fs.existsSync(certificate) ? ['--mount', `type=bind,source=${certificate},target=/opt/gr8-root-ca.crt,readonly`] : [];
  const prefix = await connectionPrefix();
  const connectionVariables = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGHOSTADDR', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGCONNECT_TIMEOUT', 'PGOPTIONS'];
  const environmentArgs = connectionVariables.flatMap((name) => {
    const value = exportValue(prefix, name);
    return value === null ? [] : ['--env', `${name}=${value}`];
  });
  const password = exportValue(prefix, 'PGPASSWORD');
  assert(password, 'Supabase CLI produced an empty database password');
  const child = spawn('docker', ['run', '--rm', '-i', '--name', `gr8-readonly-snapshot-${crypto.randomUUID().slice(0, 8)}`, '--memory', '192m', '--cpus', '1', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '--network', 'bridge', ...mounts, ...environmentArgs, '--env', 'PGPASSWORD', '--entrypoint', '/bin/bash', IMAGE, '-c', 'exec psql -X -q -A -t -v ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PGPASSWORD: password } });
  let output = '';
  let errors = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { if (errors.length < 16384) errors += chunk; });
  child.stdin.on('error', () => {});
  child.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n');
  const deadline = Date.now() + 35_000;
  let snapshot = null;
  while (Date.now() < deadline && !snapshot && child.exitCode === null) {
    snapshot = output.match(/\b\d{8}-[0-9A-Fa-f]+-\d+\b/)?.[0] || null;
    if (!snapshot) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!snapshot) {
    child.stdin.destroy();
    if (!child.killed) child.kill();
    const category = /certificate|SSL/i.test(errors) ? 'tls' : /password authentication failed/i.test(errors) ? 'password-authentication' : /role .* does not exist/i.test(errors) ? 'role-missing' : /authentication/i.test(errors) ? 'authentication' : /could not translate host|name resolution|temporary failure/i.test(errors) ? 'dns' : /permission denied/i.test(errors) ? 'permission' : /does not support exporting snapshots|unsupported/i.test(errors) ? 'snapshot-capability' : /timed out|timeout/i.test(errors) ? 'timeout' : /password/i.test(errors) ? 'password-configuration' : /syntax error|unrecognized option|invalid command/i.test(errors) ? 'shell-command' : 'connection';
    const safeDetail = /server closed/i.test(errors) ? 'server-closed' : /connection refused/i.test(errors) ? 'connection-refused' : /no password supplied/i.test(errors) ? 'password-missing' : /password authentication failed/i.test(errors) ? 'password-authentication-failed' : /role .* does not exist/i.test(errors) ? 'role-not-found' : /invalid snapshot|snapshot .* does not exist/i.test(errors) ? 'snapshot-invalid' : /could not translate host/i.test(errors) ? 'dns-resolution-failed' : null;
    console.error(JSON.stringify({ snapshotProbe: category, detail: safeDetail, psqlExitCode: child.exitCode, stderrBytes: Buffer.byteLength(errors) }));
    throw new Error(`Could not open a consistent read-only PostgreSQL snapshot (${category})`);
  }
  return {
    id: snapshot,
    async close() {
      try { child.stdin.end('ROLLBACK;\\q\n'); } catch {}
      await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else { child.once('close', resolve); setTimeout(() => { if (!child.killed) child.kill(); resolve(); }, 3000).unref(); } });
    },
  };
}

try {
  if (mode === 'self-test') {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gr8-crypto-test-'));
    const archive = path.join(temporary, 'sample.enc');
    try {
      const sample = Buffer.from('Synthetic recovery test; no customer data');
      await encrypt(Readable.from(sample), archive);
      await authenticate(archive);
      const { input, decipher } = decrypt(archive);
      const chunks = [];
      await pipeline(input, decipher, new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); } }));
      assert(Buffer.concat(chunks).equals(sample));
      const tampered = fs.readFileSync(archive);
      tampered[MAGIC.length + 12] ^= 1;
      fs.writeFileSync(archive, tampered);
      await assert.rejects(authenticate(archive));
      console.log('PASS encrypted stream round-trip and tamper rejection; no plaintext backup files');
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
    const plan = (user, password) => `#!/usr/bin/env bash\nexport PGHOST="aws-1-ap-southeast-2.pooler.supabase.com"\nexport PGPORT="5432"\nexport PGUSER="${user}"\nexport PGPASSWORD="${password}"\nexport PGDATABASE="postgres"\npg_dump \\\n`;
    assert.equal(parseCliPlan(plan(`cli_login_postgres.${SOURCE}`, 'synthetic'), false).user, `cli_login_postgres.${SOURCE}`);
    assert.throws(() => parseCliPlan(plan(`postgres.${SOURCE}`, ''), false), /could not mint/, 'role-minting fallback with an empty prompted password is rejected');
    assert.throws(() => parseCliPlan(plan(`cli_login_postgres.${SOURCE}`, ''), false), /empty database password/);
    assert.equal(parseCliPlan(plan(`postgres.${SOURCE}`, 'synthetic'), true).user, `postgres.${SOURCE}`);
    assert.throws(() => parseCliPlan(plan(`cli_login_postgres.${SOURCE}`, 'synthetic'), true), /did not pair/, 'a database password is never paired with the CLI login role');
    assert.throws(() => parseCliPlan(plan('postgres.otherprojectref', 'synthetic'), true), /did not pair/, 'another project is rejected');
    assert.equal(failureKind('FATAL:  password authentication failed for user "cli_login_postgres"'), 'authentication');
    assert.equal(failureKind('pg_dump: error: Dumping the contents of table "x" failed: PQgetCopyData() failed.\npg_dump: detail: Error message from server: SSL connection has been closed unexpectedly'), 'connection-dropped');
    assert.equal(failureKind('pg_dump: error: query failed: ERROR:  permission denied for table x'), 'permission');
    assert.equal(failureKind('pg_dump: error: connection to server at 1.2.3.4, port 5432 failed: FATAL:  (EAUTHQUERY) unsupported or invalid secret format'), 'authentication', 'an expired CLI login role is re-minted');
    console.log('PASS CLI credential pairing: minted role accepted, prompt fallback / empty / mismatched / wrong-project credentials rejected; failure classification');
  } else if (mode === 'probe-direct') {
    process.env.GR8_RECOVERY_DIRECT = '1';
    await probeDirect(directory);
  } else if (mode === 'probe-snapshot') {
    const snapshot = await openSnapshot(directory);
    await snapshot.close();
    console.log(JSON.stringify({ readOnlyRepeatableSnapshot: 'opened-and-closed' }));
  } else if (mode === 'table') {
    assert.equal(key.length, 32, 'Recovery key must be provided through the protected parent process');
    assert(directory && fs.existsSync(path.join(directory, 'key.dpapi')), 'A private directory with a DPAPI-protected key is required');
    await exportTable(directory, process.argv[4] || 'public.builder_boq_items');
  } else if (mode === 'diagnose') {
    const filename = process.argv[4] || 'roles.sql.enc.diagnostics.enc';
    if (!/^(roles\.sql|schema\.dump|database(?:-data)?\.dump|public_[a-z0-9_]+\.dump)\.enc(?:\.attempt\d+)?\.diagnostics\.enc$/.test(filename)) throw new Error('Choose a supported encrypted recovery diagnostic artifact.');
    const { input, decipher } = decrypt(path.join(directory, filename));
    const chunks = [];
    await pipeline(input, decipher, new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); } }));
    const text = Buffer.concat(chunks).toString('utf8');
    const failedTables = [...text.matchAll(/Dumping the contents of table "([A-Za-z0-9_.-]+)" failed/g)].map((match) => match[1]);
    const safeMessages = text.split(/\r?\n/).filter((line) => /error|fatal|killed|oom|no space|not found|invalid|warning/i.test(line)).map((line) => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection redacted]').replace(/password[^,; ]*\s+\S+/gi, 'password [redacted]').replace(/COPY [^\s]+/gi, 'COPY [redacted]').replace(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b.*/i, '[SQL redacted]').replace(/[^a-zA-Z0-9 .,:_\-\[\]()]/g, '').slice(0, 180)).slice(0, 6);
    const lastDumpedTables = [...text.matchAll(/dumping contents of table\s+"?([a-zA-Z0-9_.-]+)"?/gi)].slice(-8).map((match) => match[1]);
    console.log(JSON.stringify({ diagnosticBytes: Buffer.byteLength(text), pgDumpErrors: (text.match(/pg_dump(?:all)?: error:/g) || []).length, dockerOrProcessFailure: /command not found|no such file|container.*(?:killed|exited)|out of memory|cannot allocate|exec format/i.test(text), certificateVerificationFailed: /certificate verify failed|unable to get local issuer|self-signed certificate/i.test(text), rootCertificateMissing: /root certificate file.*does not exist/i.test(text), permissionDenied: /permission denied|must be owner/i.test(text), authenticationFailed: /authentication failed|password/i.test(text), networkEof: /SSL SYSCALL error: EOF detected/i.test(text), unexpectedConnectionClose: /connection.*closed|server closed/i.test(text), snapshotError: /snapshot/i.test(text), transactionError: /transaction/i.test(text), timeout: /timed out|timeout/i.test(text), cancellation: /canceling statement|cancelled/i.test(text), readOnlyViolation: /read-only transaction/i.test(text), failedTables, lastDumpedTables, safeMessages }));
  } else if (mode === 'backup') {
    assert.equal(key.length, 32, 'Recovery key must be provided through the protected parent process');
    assert(directory && fs.existsSync(path.join(directory, 'key.dpapi')), 'A private directory with a DPAPI-protected key is required');
    const roles = await exportEncrypted('pg_dumpall --roles-only --no-role-passwords --no-password --role=postgres', 'roles.sql.enc');
    let snapshot;
    try { snapshot = await openSnapshot(directory); } catch (error) {
      if (!/authentication|dns|connection|timeout/.test(error.message)) throw error;
      await connectionPrefix({ refresh: true });
      snapshot = await openSnapshot(directory);
    }
    try {
      const schema = await exportEncrypted(`pg_dump --verbose --format=custom --compress=5 --schema-only --no-tablespaces --no-password --role=postgres --snapshot=${snapshot.id} --lock-wait-timeout=30000`, 'schema.dump.enc');
      const data = await exportEncrypted(`pg_dump --verbose --format=custom --compress=5 --data-only --no-tablespaces --no-password --role=postgres --snapshot=${snapshot.id} --lock-wait-timeout=30000 --exclude-table-data=cron.job_run_details --exclude-table-data=public.builder_boq_items --exclude-table-data=public.builder_estimate_snapshots`, 'database-data.dump.enc');
      const largeTable = await exportEncrypted(`pg_dump --verbose --format=custom --compress=5 --data-only --no-tablespaces --no-password --role=postgres --snapshot=${snapshot.id} --lock-wait-timeout=30000 --table=public.builder_boq_items`, 'public_builder_boq_items.dump.enc');
      const estimateSnapshots = await exportEncrypted(`pg_dump --verbose --format=custom --compress=5 --data-only --no-tablespaces --no-password --role=postgres --snapshot=${snapshot.id} --lock-wait-timeout=30000 --table=public.builder_estimate_snapshots`, 'public_builder_estimate_snapshots.dump.enc');
      const manifest = { sourceProject: SOURCE, image: IMAGE, createdAt: new Date().toISOString(), snapshot: 'One exported PostgreSQL repeatable-read read-only snapshot shared by schema and all table-data archives; not the October 15 physical backup', excludedData: ['cron.job_run_details: scheduler execution history only; table definition and active job definitions retained in offline test archive'], splitTables: ['public.builder_boq_items', 'public.builder_estimate_snapshots'], encryption: 'AES-256-GCM; key protected by Windows DPAPI CurrentUser', roles, schema, data, largeTable, estimateSnapshots };
      await encrypt(Readable.from(JSON.stringify(manifest)), path.join(directory, 'manifest.json.enc'));
      console.log(JSON.stringify({ encryptedBackupComplete: true, consistentReadOnlySnapshot: true, sourceProject: SOURCE, location: directory, encryptedBytes: roles.bytes + schema.bytes + data.bytes + largeTable.bytes + estimateSnapshots.bytes }));
    } finally { await snapshot.close(); }
  } else throw new Error('Supported modes: self-test, diagnose, backup');
} catch (error) {
  console.error(JSON.stringify({ recoveryComplete: false, error: error.message }));
  process.exitCode = 1;
} finally { key.fill(0); }