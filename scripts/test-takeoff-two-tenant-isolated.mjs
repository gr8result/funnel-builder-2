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
// jsonb stores object keys in its own order: compare content, not key order.
const canonical = (value) => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
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
  // Saved measurements and approvals as the takeoff stores them (wall runs, placed openings, approved
  // floor areas with their approval stamps, per-sheet calibration incl. one applied from another sheet).
  const takeoffSummary = (key) => ({ aiPlanTakeoffJob: { jobName: `Takeoff ${key} ${run}`, walls: 72, openings: 30, approvedRooms: [{ name: 'Bed 3', areaM2: 12.671 }],
    sheetCalibrations: { 0: { pixelsPerMm: 0.02834645669291339 }, 4: { pixelsPerMm: 0.02834645669291339, appliedFromSheet: 5 }, 5: { pixelsPerMm: 0.02834645669291339 } },
    completedWallRuns: [{ id: `w-${key}-1`, page: 5, category: 'exterior', lengthMm: 8420, confirmed: true, approvedAt: '2026-11-17T01:00:00.000Z' }],
    placedOpenings: [{ id: `o-${key}-1`, page: 5, type: 'window', widthMm: 1800, heightMm: 900, confirmed: true }],
    completedFloorplans: [{ id: `f-${key}-1`, page: 5, name: 'Bed 3', areaM2: 12.671, confirmed: true, reviewRequired: false, approvedAt: '2026-11-17T01:05:00.000Z' }] } });
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
  // 3b. Saved measurements and approvals: B's attempts left every measured element and approval of A's
  // takeoff exactly as A saved it, and B cannot approve or withdraw A's items.
  const expectedA = { ...takeoffSummary('A'), revision: 10 };
  check('A\'s saved measurements, calibrations and approvals are identical (content) after B\'s attempts', canonical(ownerView) === canonical(expectedA), { walls: ownerView.aiPlanTakeoffJob?.completedWallRuns, rooms: ownerView.aiPlanTakeoffJob?.completedFloorplans });
  const approveAttempt = await B.db.from('builder_estimate_snapshots').update({ workbook_snapshot: { ...expectedA, aiPlanTakeoffJob: { ...expectedA.aiPlanTakeoffJob, completedFloorplans: [{ ...expectedA.aiPlanTakeoffJob.completedFloorplans[0], confirmed: false, approvedAt: null }] } } }).eq('id', jobA.snapshotId).select('id');
  check('B cannot withdraw or change A\'s approvals', approveAttempt.error || approveAttempt.data.length === 0, approveAttempt.error?.message || approveAttempt.data);

  // 3c. Quotation transfer: the BOQ sections, items and procurement rows a transfer writes for each job
  // (written as /api/builders/sync-commercial-snapshot does, with the service role scoped to the job's
  // own workspace) are invisible and untouchable across tenants, and the promotion function that
  // publishes a transferred quotation cannot be called by a signed-in builder at all.
  const transfer = {};
  for (const [tenant, job] of [[A, jobA], [B, jobB]]) {
    const section = await runSetupQuery(() => admin.from('builder_boq_sections').insert({ workspace_id: tenant.workspaceId, project_id: job.projectId, snapshot_id: job.snapshotId, source_section_key: 'internal-walls', source_section_name: 'Internal walls' }).select('id').single(), `BOQ section ${tenant.key}`);
    assert(!section.error, `BOQ section ${tenant.key}: ${section.error?.message}`);
    const item = await runSetupQuery(() => admin.from('builder_boq_items').insert({ workspace_id: tenant.workspaceId, project_id: job.projectId, snapshot_id: job.snapshotId, section_id: section.data.id, item_name: `Approved floor area Bed 3 (${tenant.key})`, quantity: 12.67, unit: 'm2' }).select('id').single(), `BOQ item ${tenant.key}`);
    assert(!item.error, `BOQ item ${tenant.key}: ${item.error?.message}`);
    const proc = await runSetupQuery(() => admin.from('builder_procurement_items').insert({ workspace_id: tenant.workspaceId, project_id: job.projectId, snapshot_id: job.snapshotId, item_name: `Internal doors (${tenant.key})`, quantity: 16 }).select('id').single(), `procurement ${tenant.key}`);
    assert(!proc.error, `procurement ${tenant.key}: ${proc.error?.message}`);
    transfer[tenant.key] = { sectionId: section.data.id, itemId: item.data.id, procurementId: proc.data.id };
  }
  const ownItem = await A.db.from('builder_boq_items').select('id, quantity').eq('id', transfer.A.itemId);
  check('A reads its own transferred quotation rows', !ownItem.error && ownItem.data.length === 1 && Number(ownItem.data[0].quantity) === 12.67, ownItem.error?.message || ownItem.data);
  for (const [actor, owner] of [[B, A], [A, B]]) {
    const rows = transfer[owner.key];
    const reads = await Promise.all([
      actor.db.from('builder_boq_sections').select('id').eq('id', rows.sectionId),
      actor.db.from('builder_boq_items').select('id, item_name, quantity').eq('id', rows.itemId),
      actor.db.from('builder_procurement_items').select('id').eq('id', rows.procurementId),
      actor.db.from('builder_boq_items').select('id').eq('project_id', owner === A ? jobA.projectId : jobB.projectId),
    ]);
    check(`${actor.key} cannot read ${owner.key}'s transferred quotation (sections, items, procurement)`, reads.every((r) => r.error || r.data.length === 0), reads.map((r) => r.error?.message || r.data.length));
    const change = await actor.db.from('builder_boq_items').update({ quantity: 999 }).eq('id', rows.itemId).select('id');
    check(`${actor.key} cannot change ${owner.key}'s transferred quantities`, change.error || change.data.length === 0, change.error?.message || change.data);
    const remove = await actor.db.from('builder_procurement_items').delete().eq('id', rows.procurementId).select('id');
    check(`${actor.key} cannot delete ${owner.key}'s procurement rows`, remove.error || remove.data.length === 0, remove.error?.message || remove.data);
    const inject = await actor.db.from('builder_boq_items').insert({ workspace_id: owner.workspaceId, project_id: owner === A ? jobA.projectId : jobB.projectId, snapshot_id: owner === A ? jobA.snapshotId : jobB.snapshotId, item_name: 'Intrusion' }).select('id');
    check(`${actor.key} cannot add rows to ${owner.key}'s quotation`, Boolean(inject.error) || inject.data.length === 0, inject.error?.message || inject.data);
    const promote = await actor.db.rpc('builder_promote_quotation_snapshot', { p_workspace_id: owner.workspaceId, p_project_id: owner === A ? jobA.projectId : jobB.projectId, p_snapshot_id: owner === A ? jobA.snapshotId : jobB.snapshotId, p_sections: 1, p_items: 1, p_procurement: 1 });
    check(`${actor.key} cannot publish ${owner.key}'s quotation through the promotion function`, Boolean(promote.error), promote.error?.message || promote.data);
  }
  const afterItem = (await admin.from('builder_boq_items').select('quantity').eq('id', transfer.A.itemId).single()).data;
  const afterProc = (await admin.from('builder_procurement_items').select('id').eq('id', transfer.A.procurementId));
  const injected = (await admin.from('builder_boq_items').select('id').eq('project_id', jobA.projectId).eq('item_name', 'Intrusion'));
  check('A\'s transferred quotation is unchanged after the intrusion attempts', Number(afterItem.quantity) === 12.67 && afterProc.data.length === 1 && injected.data.length === 0, { quantity: afterItem.quantity, procurement: afterProc.data.length, injected: injected.data.length });
  const anonRows = await anon().from('builder_boq_items').select('id').in('id', [transfer.A.itemId, transfer.B.itemId]);
  check('anonymous visitors see no transferred quotation rows', anonRows.error || anonRows.data.length === 0, anonRows.error?.message || anonRows.data);
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
    // The quotation transfer endpoint: a builder can only transfer into a workspace they belong to.
    const sync = (token, workspaceId, body) => fetch(`${app}/api/builders/sync-commercial-snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) }, body: JSON.stringify({ workspace_id: workspaceId, ...body }) });
    const syncNoToken = await sync(null, A.workspaceId, { workbook: { jobId: `job-A-${run}` } });
    check('quotation transfer API refuses a request without a session', syncNoToken.status === 401, syncNoToken.status);
    const syncForeign = await sync(B.session.access_token, A.workspaceId, { workbook: { jobId: `job-A-${run}`, workspaceId: A.workspaceId }, project: { id: jobA.projectId } });
    check('quotation transfer API refuses B writing into A\'s workspace', syncForeign.status === 403, { status: syncForeign.status, body: (await syncForeign.text()).slice(0, 200) });
    const syncTampered = await sync(`${B.session.access_token.slice(0, -4)}AAAA`, B.workspaceId, { workbook: { jobId: `job-B-${run}` } });
    check('quotation transfer API refuses a tampered session token', syncTampered.status === 401, syncTampered.status);
    const syncCrossJob = await sync(B.session.access_token, B.workspaceId, { workbook: { jobId: `job-A-${run}`, workspaceId: A.workspaceId }, project: { id: jobA.projectId } });
    check('quotation transfer API refuses a workbook that belongs to another workspace', syncCrossJob.status >= 400 && syncCrossJob.status < 500, { status: syncCrossJob.status, body: (await syncCrossJob.text()).slice(0, 200) });
    const stillA = (await admin.from('builder_boq_items').select('quantity').eq('project_id', jobA.projectId));
    check('A\'s quotation rows are unchanged after the API attempts', stillA.data.length === 1 && Number(stillA.data[0].quantity) === 12.67, stillA.data);
  }
  evidence.passed = evidence.checks.every((item) => item.pass);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log(`Takeoff two-tenant isolated security: ${evidence.checks.filter((item) => item.pass).length}/${evidence.checks.length} checks passed.`);
}
