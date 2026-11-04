// Quotation Builder V1 - authenticated two-user, data-isolation and concurrency acceptance.
//
// Runs against an ISOLATED local Supabase stack and a Next.js server on a non-3000 port.
// Creates its own disposable users and workspaces (emails end in @example.test); never
// touches existing rows. Refuses port 3000 and any non-local Supabase.
//
// Required env:
//   QB_ACCEPT_URL            app origin, e.g. http://127.0.0.1:3107
//   QB_SUPABASE_URL          local stack API, e.g. http://127.0.0.1:55521
//   QB_ANON_KEY / QB_SERVICE_ROLE_KEY   keys printed by `supabase status` for that stack
//
// Users: A1 = owner of workspace A, A2 = estimator in workspace A, B = owner of workspace B.
import assert from "node:assert/strict";
import fs from "node:fs";

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`${k} is required. Refusing to run.`); process.exit(2); } return v; };
const origin = need("QB_ACCEPT_URL");
const supabaseUrl = need("QB_SUPABASE_URL");
const anonKey = need("QB_ANON_KEY");
const serviceKey = need("QB_SERVICE_ROLE_KEY");
if (["3000", ""].includes(new URL(origin).port)) { console.error("QB_ACCEPT_URL must use an explicit non-3000 port."); process.exit(2); }
for (const u of [origin, supabaseUrl]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(u).hostname)) { console.error(`${u} is not local. Refusing to run.`); process.exit(2); }
}

const run = Date.now().toString(36);
const report = { startedAt: new Date().toISOString(), origin, supabaseUrl, run, checks: [] };
let failures = 0;
async function check(name, fn) {
  try { const detail = await fn(); report.checks.push({ name, result: "PASS", detail }); console.log("PASS", name); }
  catch (error) { failures += 1; report.checks.push({ name, result: "FAIL", error: error.message }); console.log("FAIL", name, "-", error.message); }
}

const admin = (path, init = {}) => fetch(`${supabaseUrl}${path}`, {
  ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
}).then(async (r) => { const body = await r.json().catch(() => null); if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(body)}`); return body; });
const asUser = (token, path) => fetch(`${supabaseUrl}${path}`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

async function createUser(label) {
  const email = `qb-${label}-${run}@example.test`;
  const password = `Qb-${run}-${label}-Pw!9`;
  const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
  const session = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  assert(session.access_token, `password sign-in failed for ${label}: ${JSON.stringify(session)}`);
  return { id: user.id || user.user?.id, email, token: session.access_token };
}

// Small synthetic quotation in the engine's calculated shape (sections of rows + summary).
function quotationPayload({ jobId, extraRows = [], rateBump = 0 }) {
  const row = (id, item, qty, rate, extra = {}) => ({ id, item, qty, unit: "item", excelRate: `$${rate}`, finalRateUsed: `$${rate}`, cost: qty * rate, sourceOfRate: "workbook", lineType: "Standard rate item", active: true, ...extra });
  const quotation = {
    "CONCRETE SLAB (16)": { title: "CONCRETE SLAB", rows: [row(`slab-${jobId}`, "TOTAL GROUND FLOOR AREA", 200, 125 + rateBump)] },
    "FRAMING (36)": { title: "FRAMING", rows: [row(`frame-${jobId}`, "Wall frames", 1, 18000), ...extraRows] },
  };
  const base = Object.values(quotation).flatMap((s) => s.rows).reduce((n, r) => n + (r.cost || 0), 0);
  Object.values(quotation).forEach((s) => { s.subtotal = s.rows.reduce((n, r) => n + (r.cost || 0), 0); });
  const gst = Math.round(base * 10) / 100;
  const summary = { baseLineItemSubtotal: base, subtotalBeforeGst: base, gstPercent: 10, gst, finalQuoteTotal: base + gst };
  const jobFileMeta = { jobId, jobName: `Acceptance ${jobId}` };
  return { workbook: { id: jobId, jobId, jobFileMeta }, calculated: { quotation, summary }, project: { jobId, jobName: jobFileMeta.jobName } };
}

async function sync(user, workspaceId, payload, extra = {}) {
  const r = await fetch(`${origin}/api/builders/sync-commercial-snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}`, "x-workspace-id": workspaceId },
    body: JSON.stringify({ workspace_id: workspaceId, ...payload, ...extra }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const rows = (table, filter) => admin(`/rest/v1/${table}?${filter}`, { method: "GET" });

try {
  const [a1, a2, b, c] = [await createUser("a1"), await createUser("a2"), await createUser("b"), await createUser("client")];
  const [wsA] = await admin("/rest/v1/workspaces", { method: "POST", body: JSON.stringify({ name: `QB Accept A ${run}`, slug: `qb-a-${run}`, owner_id: a1.id }) });
  const [wsB] = await admin("/rest/v1/workspaces", { method: "POST", body: JSON.stringify({ name: `QB Accept B ${run}`, slug: `qb-b-${run}`, owner_id: b.id }) });
  await admin("/rest/v1/workspace_members", { method: "POST", body: JSON.stringify([
    { workspace_id: wsA.id, user_id: a1.id, role: "owner", status: "active" },
    { workspace_id: wsA.id, user_id: a2.id, role: "estimator", status: "active" },
    { workspace_id: wsB.id, user_id: b.id, role: "owner", status: "active" },
    { workspace_id: wsA.id, user_id: c.id, role: "client", status: "active" },
  ]) });
  report.setup = { workspaceA: wsA.id, workspaceB: wsB.id, users: { a1: a1.email, a2: a2.email, b: b.email, clientOfA: c.email } };
  const jobA = `qb-job-a-${run}`;
  const jobB = `qb-job-b-${run}`;
  let projectA;

  await check("1. Signed-in owner A1 issues a fully priced quotation (commercial snapshot)", async () => {
    const r = await sync(a1, wsA.id, quotationPayload({ jobId: jobA }));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    projectA = r.body.project_id;
    assert(projectA && r.body.snapshot_id);
    const [snap] = await rows("builder_estimate_snapshots", `id=eq.${r.body.snapshot_id}&select=gst_total,final_quote_total,base_line_item_subtotal,status`);
    const items = await rows("builder_boq_items", `snapshot_id=eq.${r.body.snapshot_id}&select=*`);
    const itemTotal = items.reduce((n, i) => n + Number(i.total_cost ?? i.line_total ?? i.amount ?? 0), 0);
    assert.equal(Number(snap.base_line_item_subtotal), 43000);
    assert.equal(Number(snap.gst_total), 4300);
    assert.equal(Number(snap.final_quote_total), 47300);
    assert.equal(snap.status, "current");
    assert.equal(items.length, 2, "slab line named TOTAL ... must be in the BOQ");
    report.boqItemColumns = Object.keys(items[0] || {});
    return { counts: r.body.counts, snapshot: snap, boqItemTotal: itemTotal };
  });

  await check("2. Missing-price quotation is refused and writes nothing", async () => {
    const before = await rows("builder_estimate_snapshots", `project_id=eq.${projectA}&select=id`);
    const r = await sync(a1, wsA.id, quotationPayload({ jobId: jobA, extraRows: [{ id: "acc-unpriced", item: "Acceptance unpriced item", qty: 4, sourceOfRate: "rate missing" }] }));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "QUOTATION_MISSING_PRICES");
    assert.equal(r.body.blockers.length, 1);
    const after = await rows("builder_estimate_snapshots", `project_id=eq.${projectA}&select=id`);
    assert.equal(after.length, before.length, "a snapshot was written for an unpriced quotation");
    return { blockers: r.body.blockers.map((x) => x.item) };
  });

  await check("3. Unauthenticated and invalid-token requests are rejected", async () => {
    const r1 = await sync({ token: "" }, wsA.id, quotationPayload({ jobId: jobA }));
    const r2 = await sync({ token: "not-a-jwt" }, wsA.id, quotationPayload({ jobId: jobA }));
    assert.equal(r1.status, 401); assert.equal(r2.status, 401);
    return { missing: r1.status, invalid: r2.status };
  });

  await check("4. Builder B cannot write into workspace A", async () => {
    const r = await sync(b, wsA.id, quotationPayload({ jobId: jobA }));
    assert.equal(r.status, 403, JSON.stringify(r.body));
    return { status: r.status };
  });

  await check("4b. A client-role member of workspace A cannot issue a quotation", async () => {
    const r = await sync(c, wsA.id, quotationPayload({ jobId: jobA }));
    assert.equal(r.status, 403, JSON.stringify(r.body));
    return { status: r.status };
  });

  await check("5. Builder B naming A's project id in its own workspace cannot touch A's project", async () => {
    const [beforeA] = await rows("builder_commercial_projects", `id=eq.${projectA}&select=*`);
    const r = await sync(b, wsB.id, quotationPayload({ jobId: jobB, rateBump: 777 }), { commercial_project_id: projectA });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.notEqual(r.body.project_id, projectA);
    const [afterA] = await rows("builder_commercial_projects", `id=eq.${projectA}&select=*`);
    assert.equal(afterA.workspace_id, wsA.id);
    assert.equal(Number(afterA.contract_total), Number(beforeA.contract_total));
    assert.equal(afterA.updated_at, beforeA.updated_at);
    return { projectB: r.body.project_id };
  });

  await check("6. Row-level security: B and A's client see none of A's commercial rows; estimator A2 sees them", async () => {
    const out = {};
    for (const table of ["builder_commercial_projects", "builder_estimate_snapshots", "builder_boq_items", "builder_procurement_items"]) {
      const asB = await asUser(b.token, `/rest/v1/${table}?workspace_id=eq.${wsA.id}&select=id`);
      const asA2 = await asUser(a2.token, `/rest/v1/${table}?workspace_id=eq.${wsA.id}&select=id`);
      const asClient = await asUser(c.token, `/rest/v1/${table}?workspace_id=eq.${wsA.id}&select=id`);
      assert.equal(asB.status, 200, `${table} as B: ${JSON.stringify(asB.body)}`);
      assert.equal(asB.body.length, 0, `${table}: builder B can read ${asB.body.length} workspace A rows`);
      assert(asClient.status === 200 && asClient.body.length === 0, `${table}: client of A can read internal rows (${asClient.status} ${JSON.stringify(asClient.body)?.slice(0, 120)})`);
      assert.equal(asA2.status, 200, `${table} as A2: ${JSON.stringify(asA2.body)}`);
      if (table !== "builder_procurement_items") assert(asA2.body.length > 0, `${table}: estimator A2 cannot read its own workspace rows`);
      out[table] = { b: asB.body.length, client: asClient.body.length, a2: asA2.body.length };
    }
    return out;
  });

  await check("7. Simultaneous editing: A1 and A2 issue the same job at once while B works in parallel", async () => {
    const results = await Promise.all([
      sync(a1, wsA.id, quotationPayload({ jobId: jobA, rateBump: 11 }), { commercial_project_id: projectA }),
      sync(a2, wsA.id, quotationPayload({ jobId: jobA, rateBump: 22 }), { commercial_project_id: projectA }),
      sync(a1, wsA.id, quotationPayload({ jobId: jobA, rateBump: 33 }), { commercial_project_id: projectA }),
      sync(b, wsB.id, quotationPayload({ jobId: jobB, rateBump: 44 })),
    ]);
    results.forEach((r, i) => assert.equal(r.status, 200, `request ${i}: ${r.status} ${JSON.stringify(r.body)}`));
    const snaps = await rows("builder_estimate_snapshots", `project_id=eq.${projectA}&select=id,snapshot_number,status,final_quote_total,workspace_id&order=snapshot_number`);
    const numbers = snaps.map((s) => s.snapshot_number);
    assert.equal(new Set(numbers).size, numbers.length, `duplicate snapshot numbers ${numbers}`);
    const current = snaps.filter((s) => s.status === "current");
    assert.equal(current.length, 1, `expected exactly one current snapshot, got ${current.length}`);
    assert.equal(current[0].snapshot_number, Math.max(...numbers), "the newest snapshot is not the current one");
    assert(snaps.every((s) => s.workspace_id === wsA.id));
    const items = await rows("builder_boq_items", `snapshot_id=eq.${current[0].id}&select=workspace_id`);
    assert(items.length > 0 && items.every((i) => i.workspace_id === wsA.id));
    const projectsA = await rows("builder_commercial_projects", `workspace_id=eq.${wsA.id}&select=id`);
    assert.equal(projectsA.length, 1, "concurrent issues created duplicate projects");
    return { snapshots: numbers, current: current[0].snapshot_number };
  });

  await check("8. Builder configuration: B cannot read A; estimator A2 cannot change it", async () => {
    const readB = await fetch(`${origin}/api/builders/selection-foundation?workspace_id=${wsA.id}`, { headers: { Authorization: `Bearer ${b.token}` } });
    const writeA2 = await fetch(`${origin}/api/builders/selection-foundation`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a2.token}` },
      body: JSON.stringify({ workspace_id: wsA.id, resource: "configurations", record: {} }),
    });
    assert.equal(readB.status, 403); assert.equal(writeA2.status, 403);
    return { readB: readB.status, writeA2: writeA2.status };
  });
} catch (error) {
  failures += 1;
  report.setupError = error.message;
  console.log("FAIL setup -", error.message);
} finally {
  report.passed = failures === 0;
  fs.mkdirSync("artifacts/test-artifacts/quotation-acceptance", { recursive: true });
  fs.writeFileSync(`artifacts/test-artifacts/quotation-acceptance/two-user-${run}.json`, JSON.stringify(report, null, 2));
  console.log(`\n${report.checks.filter((c) => c.result === "PASS").length}/${report.checks.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
}
