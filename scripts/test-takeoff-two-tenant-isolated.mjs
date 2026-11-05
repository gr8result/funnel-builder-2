// AI Takeoff two-tenant security against the ISOLATED Supabase stack (never production: refuses any
// Supabase URL that is not the local isolated stack). Two real users signed in with passwords in two
// separate workspaces; every query below runs as that user, so the production row-level security
// policies from the real migrations decide what each can see and change.
//
//   TAKEOFF_ISOLATED_ENV=<json with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY>
//   [TAKEOFF_ISOLATED_APP=http://127.0.0.1:3122]   isolated app server for the API checks
//   [--out <file>]  writes the evidence JSON
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (!process.env.TAKEOFF_ISOLATED_ENV) { console.log('SKIPPED Takeoff two-tenant security: TAKEOFF_ISOLATED_ENV (isolated stack) not set.'); process.exit(0); }
const env = JSON.parse(fs.readFileSync(process.env.TAKEOFF_ISOLATED_ENV, 'utf8'));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
assert(/^http:\/\/(127\.0\.0\.1|localhost):556\d\d$/.test(url), `Refusing a non-isolated Supabase URL: ${url}`);
const app = process.env.TAKEOFF_ISOLATED_APP || '';
if (app) assert(/^http:\/\/(127\.0\.0\.1|localhost):(?!3000\b)\d+$/.test(app), `Refusing app URL ${app}`);
const outArg = process.argv.indexOf('--out'); const outFile = outArg > 0 ? process.argv[outArg + 1] : null;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const run = `T${Date.now().toString(36)}`;
const evidence = { run, url, checks: [] };
const check = (name, ok, detail) => { evidence.checks.push({ name, pass: Boolean(ok), detail }); assert.ok(ok, `${name}: ${JSON.stringify(detail)}`); };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTransient = (error) => Number(error?.status) >= 500 || /timed? out|timeout|upstream|schema cache|retrying/i.test(error?.message || '');

async function runSetupQuery(operation, label) {
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = await operation();
    if (!result.error || !isTransient(result.error)) return result;
    if (attempt < 3) {
      console.warn(`${label}: isolated database was temporarily unavailable; retrying (${attempt}/3).`);
      await delay(attempt * 2000);
    }
  }
  return result;
}

async function signInWithRetry(client, credentials, label) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await client.auth.signInWithPassword(credentials);
    if (!result.error && result.data.session) return result.data;
    if (!isTransient(result.error) || attempt === 3) assert.fail(`${label}: ${result.error?.message || 'no session returned'}`);
    console.warn(`${label}: isolated Auth was temporarily unavailable; retrying (${attempt}/3).`);
    await delay(attempt * 2000);
  }
  assert.fail(`${label}: sign-in retries exhausted`);
}

// ---- Two builders, two workspaces (seeded with the service role on the isolated stack only) ----
export async function seedTenants() {
  const password = crypto.randomBytes(18).toString('base64url');
  const tenants = {};
  for (const key of ['A', 'B']) {
    const email = `takeoff-builder-${key.toLowerCase()}@example.test`;
    let user = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((item) => item.email === email);
    if (!user) user = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user;
    else await admin.auth.admin.updateUserById(user.id, { password });
    assert(user?.id, `user ${key} created`);
    const workspaceId = key === 'A' ? 'aaaaaaaa-0000-4000-8000-00000000000a' : 'bbbbbbbb-0000-4000-8000-00000000000b';
    for (const [table, row, conflict] of [
      ['accounts', { user_id: user.id, email, full_name: `Takeoff Builder ${key}`, business_name: `Builder ${key} Pty Ltd`, approved: true, is_approved: true, status: 'active', subscription_status: 'active', onboarding_completed: true }, 'user_id'],
      ['workspaces', { id: workspaceId, name: `Builder ${key} workspace`, slug: `takeoff-builder-${key.toLowerCase()}`, owner_id: user.id }, 'id'],
    ]) {
      const existing = await runSetupQuery(() => admin.from(table).select('*').eq(conflict, row[conflict]).maybeSingle(), `${table} ${key} lookup`);
      const result = existing.data
        ? await runSetupQuery(() => admin.from(table).update(row).eq(conflict, row[conflict]), `${table} ${key} update`)
        : await runSetupQuery(() => admin.from(table).insert(row), `${table} ${key} insert`);
      assert(!result.error, `${table} ${key}: ${result.error?.message}`);
    }
    const member = await runSetupQuery(() => admin.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle(), `workspace member ${key} lookup`);
    if (!member.data) {
      const added = await runSetupQuery(() => admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: user.id, role: 'owner', status: 'active' }), `workspace member ${key} insert`);
      assert(!added.error, added.error?.message);
    }
    const client = anon();
    const signed = await signInWithRetry(client, { email, password }, `user ${key} signs in`);
    tenants[key] = { key, email, password, userId: user.id, workspaceId, db: client, session: signed.session };
  }
  return tenants;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('test-takeoff-two-tenant-isolated.mjs')) {
  const tenants = await seedTenants();
  const { A, B } = tenants;
  // A takeoff job as the app registers it: the commercial project plus an estimate snapshot carrying the
  // takeoff summary (walls, openings, approved room) for that job.
  const takeoffSummary = (key) => ({ aiPlanTakeoffJob: { jobName: `Takeoff ${key} ${run}`, walls: 72, openings: 30, approvedRooms: [{ name: 'Bed 3', areaM2: 12.671 }], sheetCalibrations: { 1: 0.02834645669291339 } } });
  const register = async (tenant) => {
    const project = await tenant.db.from('builder_commercial_projects').insert({ workspace_id: tenant.workspaceId, project_name: `Takeoff job ${tenant.key} ${run}`, client_name: `Client ${tenant.key}`, source_workbook_job_id: `job-${tenant.key}-${run}`, created_by: tenant.userId }).select('id').single();
    assert(!project.error, `${tenant.key} registers a job: ${project.error?.message}`);
    const snapshot = await tenant.db.from('builder_estimate_snapshots').insert({ workspace_id: tenant.workspaceId, project_id: project.data.id, snapshot_label: 'Takeoff', workbook_snapshot: takeoffSummary(tenant.key), created_by: tenant.userId }).select('id').single();
    assert(!snapshot.error, `${tenant.key} saves a takeoff snapshot: ${snapshot.error?.message}`);
    return { projectId: project.data.id, snapshotId: snapshot.data.id };
  };
  // 1. Both builders register and save their own takeoff job at the same time.
  const [jobA, jobB] = await Promise.all([register(A), register(B)]);
  check('two tenants register and save separate takeoff jobs concurrently', jobA.projectId && jobB.projectId && jobA.projectId !== jobB.projectId, { jobA, jobB });
  // 2. Concurrent edits of their own jobs, 10 rounds each, interleaved.
  await Promise.all([A, B].map(async (tenant) => {
    const job = tenant === A ? jobA : jobB;
    for (let round = 1; round <= 10; round++) {
      const saved = await tenant.db.from('builder_estimate_snapshots').update({ workbook_snapshot: { ...takeoffSummary(tenant.key), revision: round } }).eq('id', job.snapshotId).select('id');
      assert(!saved.error && saved.data.length === 1, `${tenant.key} round ${round}: ${saved.error?.message}`);
    }
  }));
  const finalA = (await A.db.from('builder_estimate_snapshots').select('workbook_snapshot').eq('id', jobA.snapshotId).single()).data.workbook_snapshot;
  const finalB = (await B.db.from('builder_estimate_snapshots').select('workbook_snapshot').eq('id', jobB.snapshotId).single()).data.workbook_snapshot;
  check('concurrent edits keep each tenant\'s own job intact', finalA.revision === 10 && finalB.revision === 10 && finalA.aiPlanTakeoffJob.jobName.includes(' A ') && finalB.aiPlanTakeoffJob.jobName.includes(' B '), { finalA: finalA.aiPlanTakeoffJob.jobName, finalB: finalB.aiPlanTakeoffJob.jobName });
  // 3. Cross-tenant attempts by B on A's job (and the reverse), each as the signed-in user.
  for (const [actor, owner, job] of [[B, A, jobA], [A, B, jobB]]) {
    const readProject = await actor.db.from('builder_commercial_projects').select('id').eq('id', job.projectId);
    check(`${actor.key} cannot read ${owner.key}'s takeoff job`, !readProject.error ? readProject.data.length === 0 : true, readProject.error?.message || readProject.data);
    const readSnapshot = await actor.db.from('builder_estimate_snapshots').select('id, workbook_snapshot').eq('id', job.snapshotId);
    check(`${actor.key} cannot read ${owner.key}'s takeoff snapshot`, !readSnapshot.error ? readSnapshot.data.length === 0 : true, readSnapshot.error?.message || readSnapshot.data);
    const update = await actor.db.from('builder_estimate_snapshots').update({ workbook_snapshot: { intrusion: actor.key } }).eq('id', job.snapshotId).select('id');
    check(`${actor.key} cannot change ${owner.key}'s takeoff`, update.error || update.data.length === 0, update.error?.message || update.data);
    const del = await actor.db.from('builder_commercial_projects').delete().eq('id', job.projectId).select('id');
    check(`${actor.key} cannot delete ${owner.key}'s job`, del.error || del.data.length === 0, del.error?.message || del.data);
    const insert = await actor.db.from('builder_commercial_projects').insert({ workspace_id: owner.workspaceId, project_name: 'Intrusion', created_by: actor.userId }).select('id');
    check(`${actor.key} cannot create a job in ${owner.key}'s workspace`, Boolean(insert.error), insert.error?.message || insert.data);
    const listed = await actor.db.from('builder_commercial_projects').select('id, workspace_id');
    const ownJob = actor === A ? jobA : jobB;
    check(`${actor.key}'s job list holds its own job and only its own workspace`, !listed.error && listed.data.some((row) => row.id === ownJob.projectId) && listed.data.every((row) => row.workspace_id === actor.workspaceId), listed.data?.map((row) => row.workspace_id));
  }
  const ownerView = (await A.db.from('builder_estimate_snapshots').select('workbook_snapshot').eq('id', jobA.snapshotId).single()).data.workbook_snapshot;
  check('the owner\'s takeoff is unchanged after the intrusion attempts', ownerView.revision === 10 && !ownerView.intrusion, ownerView);
  const anonymous = await anon().from('builder_commercial_projects').select('id').in('id', [jobA.projectId, jobB.projectId]);
  check('anonymous visitors see no takeoff jobs', !anonymous.error ? anonymous.data.length === 0 : true, anonymous.error?.message || anonymous.data);
  // 4. The application's own takeoff API, when an isolated app server is given (no paid call: the server
  // runs with no provider key, and these requests fail authentication or validation before any call).
  if (app) {
    const post = (token, body) => fetch(`${app}/api/ai/takeoff-analyse`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const noToken = await post(null, { action: 'inspect' });
    check('takeoff API refuses a request without a session', noToken.status === 401, noToken.status);
    const foreign = await post(`${A.session.access_token.slice(0, -4)}AAAA`, { action: 'inspect' });
    check('takeoff API refuses a tampered session token', foreign.status === 401, foreign.status);
    const signed = await post(A.session.access_token, { action: 'not-an-action' });
    check('takeoff API accepts a signed-in builder (request then rejected as invalid, before any provider call)', signed.status !== 401 && signed.status < 500, { status: signed.status, body: (await signed.text()).slice(0, 200) });
  }
  evidence.passed = evidence.checks.every((item) => item.pass);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log(`Takeoff two-tenant isolated security: ${evidence.checks.filter((item) => item.pass).length}/${evidence.checks.length} checks passed.`);
}
