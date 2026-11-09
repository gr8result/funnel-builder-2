// Client Selections authorisation: the client / builder screen switch is a display preference, never an
// authorisation boundary. Builder data (estimator measurements, supplier costs, builder prices, builder
// approvals, commercial reconciliation) is protected server-side by workspace membership role
// (lib/withWorkspace.js), by row-level security on the commercial tables, and by the Client Portal's
// client-safe projection. This test drives the real route handlers with an in-memory database and tries
// every bypass a client has: browser storage, forged headers / body / query fields and a spoofed role.
//   node --import ./scripts/register-fake-supabase-admin.mjs --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-authorisation.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";

// The in-memory database replaces lib/supabaseAdmin.js for every route imported below; the test refuses
// to run if it is not active, so it can never reach a real database.
register("./fake-supabase-admin-loader.mjs", import.meta.url);
assert.equal((await import("../lib/supabaseAdmin.js")).__isFakeSupabaseAdmin, true, "fake database active");

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const OTHER_WORKSPACE = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const users = {
  builder: { id: "u-builder", email: "estimator@builder.test" },
  clientMember: { id: "u-client-member", email: "client@home.test" },
  portalClient: { id: "u-portal-client", email: "portal@home.test" },
  outsider: { id: "u-outsider", email: "nobody@else.test" },
};
const memberships = { "u-builder": "estimator", "u-client-member": "client" };
const SECRETS = ["selectionPricingReviews", "unitPriceSecret", "supplierCostSecret", "estimatorRunSecret", "cabinetrySelection", "boqLines", "builderPriceOverride"];

globalThis.__fakeSupabase = {
  users: Object.fromEntries(Object.entries(users).map(([key, user]) => [`token-${key}`, user])),
  calls: [],
  resolve(table, query) {
    const eq = Object.fromEntries(query.ops.filter(([op]) => op === "eq").map(([, column, value]) => [column, value]));
    if (table === "workspace_members") {
      const role = eq.workspace_id === WORKSPACE ? memberships[eq.user_id] : null;
      return { data: role ? { role, status: "active" } : null, error: null };
    }
    if (table === "workspaces") return { data: { id: WORKSPACE, is_demo: false }, error: null };
    if (table === "builder_commercial_projects") return { data: { id: PROJECT, workspace_id: WORKSPACE, project_name: "Protected job", currency: "AUD" }, error: null };
    if (table === "client_portal_settings") return { data: { id: "settings", workspace_id: WORKSPACE, project_id: PROJECT, portal_enabled: true }, error: null };
    if (table === "client_portal_clients") return { data: [{ id: "client-1", user_id: users.portalClient.id, client_email: users.portalClient.email, status: "active", accepted_at: "2026-11-01" }], error: null };
    if (table === "builder_client_selections") return { data: [{
      id: "sel-1", category: "Cabinetry", product_name: "Kitchen cabinetry", supplier: "Builder Cabinetmaker", colour: "Oak", image_url: "", status: "selected", is_active: true, client_visible: true,
      metadata: { clientVisible: true, quantity: 1, supplierCostSecret: 1234.5, builderPriceOverride: 999, selectionPricingReviews: { "pricing-review:x": { unitPrice: "unitPriceSecret" } } },
      selected_details: { cabinetrySelection: { schedule: [{ runs: [{ lengthMm: "estimatorRunSecret" }] }] }, boqLines: ["boqLines"] },
    }], error: null };
    return { data: query.ops.some(([op]) => op === "maybeSingle" || op === "single") ? null : [], error: null };
  },
};

function call(handler, { token, method = "POST", query = {}, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; }, json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
      send(payload) { resolve({ status: this.statusCode, body: payload }); return this; }, end(payload) { resolve({ status: this.statusCode, body: payload }); return this; } };
    const req = { method, query, body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } };
    Promise.resolve(handler(req, res)).catch((error) => resolve({ status: 599, body: { error: error.message } }));
  });
}
const writesSince = (start) => globalThis.__fakeSupabase.calls.slice(start).filter((query) => query.write && query.table !== "client_portal_audit_log" && query.table !== "client_portal_clients" && query.table !== "client_portal_settings");

// Every Client Selections route that reads or writes builder commercial data.
const routes = {
  "final-inclusions-schedule/generate": "../pages/api/builders/final-inclusions-schedule/generate.js",
  "publish-client-selections": "../pages/api/builders/publish-client-selections.js",
  "selection-foundation": "../pages/api/builders/selection-foundation.js",
  "sync-commercial-snapshot": "../pages/api/builders/sync-commercial-snapshot.js",
  "project-inclusions": "../pages/api/builders/project-inclusions.js",
  "convert-to-live-project": "../pages/api/builders/convert-to-live-project.js",
  "standard-inclusions/upgrade-variation": "../pages/api/standard-inclusions/upgrade-variation.js",
};
// What a client can forge from the browser: the screen switch in storage, headers, body and query fields.
const forgeries = [
  { label: "plain request", headers: {}, body: {}, query: {} },
  { label: "estimator view cookie / storage flag", headers: { cookie: "gr8.clientSelections.estimatorView=1" }, body: { estimatorView: true, "gr8.clientSelections.estimatorView": "1" }, query: {} },
  { label: "forged role headers and fields", headers: { "x-member-role": "owner", "x-user-role": "estimator", "x-role": "admin" }, body: { role: "owner", memberRole: "owner", access: "builder" }, query: { role: "owner" } },
  { label: "other workspace id", headers: { "x-workspace-id": OTHER_WORKSPACE }, body: { workspace_id: OTHER_WORKSPACE }, query: { workspace_id: OTHER_WORKSPACE } },
];

const results = [];
for (const [name, modulePath] of Object.entries(routes)) {
  const handler = (await import(modulePath)).default;
  assert.equal(typeof handler, "function", `${name} exports a handler`);
  for (const who of ["clientMember", "portalClient", "outsider"]) {
    for (const forgery of forgeries) {
      const start = globalThis.__fakeSupabase.calls.length;
      const response = await call(handler, { token: `token-${who}`, query: { workspace_id: WORKSPACE, projectId: PROJECT, ...forgery.query }, body: { workspace_id: WORKSPACE, projectId: PROJECT, selectionBookId: "book", action: "useCurrentStandard", confirmed: true, ...forgery.body }, headers: { "x-workspace-id": WORKSPACE, ...forgery.headers } });
      assert(response.status === 403 || (forgery.label === "other workspace id" && [400, 403].includes(response.status)), `${name}: ${who} (${forgery.label}) must be refused, got ${response.status}`);
      assert.deepEqual(writesSince(start), [], `${name}: ${who} (${forgery.label}) wrote nothing`);
    }
  }
  const anonymous = await call(handler, { query: { workspace_id: WORKSPACE }, body: { workspace_id: WORKSPACE } });
  assert.equal(anonymous.status, 401, `${name}: no token is refused`);
  results.push(name);
}

// The legitimate builder workflow still passes the guard (the handler's own validation answers).
for (const name of ["publish-client-selections", "project-inclusions"]) {
  const handler = (await import(routes[name])).default;
  const response = await call(handler, { token: "token-builder", query: { workspace_id: WORKSPACE }, body: { workspace_id: WORKSPACE }, headers: { "x-workspace-id": WORKSPACE } });
  assert.notEqual(response.status, 401, `${name}: builder authenticated`);
  assert.notEqual(response.status, 403, `${name}: builder (estimator role) is allowed`);
}

// The Client Portal returns a client-safe projection: no builder measurements, prices, reviews or approvals.
const portal = (await import("../client-portal/serverProject.js")).default;
const portalResponse = await call(portal, { token: "token-portalClient", method: "GET", query: { projectId: PROJECT }, headers: { cookie: "gr8.clientSelections.estimatorView=1", "x-member-role": "owner" } });
assert.equal(portalResponse.status, 200, `portal client can open their portal (${JSON.stringify(portalResponse.body).slice(0, 200)})`);
const portalText = JSON.stringify(portalResponse.body);
assert(portalText.includes("Kitchen cabinetry"), "the client sees their published selection");
SECRETS.forEach((secret) => assert(!portalText.includes(secret), `portal response must not contain ${secret}`));
// Forging builder preview mode as a client does not give builder access.
const previewForge = await call(portal, { token: "token-portalClient", method: "GET", query: { projectId: PROJECT, mode: "preview" } });
assert.notEqual(JSON.stringify(previewForge.body).includes('"access":"builder"'), true, "a client cannot request builder preview access");
const outsiderPortal = await call(portal, { token: "token-outsider", method: "GET", query: { projectId: PROJECT } });
assert.equal(outsiderPortal.status, 403, "a stranger cannot open the portal");

// Row-level security keeps client-role members out of every commercial table, including the
// Selections Book (where builder pricing reviews and cabinetry measurements are stored).
const rls = fs.readFileSync(path.resolve("supabase/migrations/20261021000100_builder_commercial_internal_member_rls.sql"), "utf8");
["builder_selection_books", "builder_client_selections", "builder_variations", "builder_supplier_price_items", "builder_supplier_price_books", "builder_quote_approvals", "builder_boq_items", "builder_estimate_snapshots"].forEach((table) => assert(rls.includes(`'${table}'`), `RLS covers ${table}`));
assert(/as restrictive for all to authenticated using \(public\.builder_commercial_is_internal_member\(workspace_id\)\) with check/.test(rls), "restrictive read and write policy");
const roleList = rls.match(/wm\.role in \(([\s\S]*?)\)/)[1];
assert(!/'client'|'viewer'|'portal'/.test(roleList), "client roles are not internal members");

// The screen switch is read only by the browser UI; no server code trusts it.
const serverFiles = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(js|mjs|ts)$/.test(entry.name)) serverFiles.push(full); });
["pages/api", "client-portal", "lib/withWorkspace.js", "lib/commercialAccess.js"].forEach((entry) => (fs.statSync(entry).isDirectory() ? walk(entry) : serverFiles.push(entry)));
serverFiles.forEach((file) => assert(!/estimatorView/.test(fs.readFileSync(file, "utf8")), `${file} must not read the estimator view switch`));

console.log(`client selections authorisation: ${results.length} routes refuse client members, portal clients and outsiders under ${forgeries.length} forgeries; portal projection leaks none of ${SECRETS.length} builder fields; RLS and switch checks pass`);
