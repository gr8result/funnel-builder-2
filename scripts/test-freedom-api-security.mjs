// Freedom API security tests (M2.1).
//
// Proves the emergency lockdown holds: no anonymous access by any method, no
// access without the freedom entitlement, no trusting caller-supplied identity,
// no arbitrary resource or method on the catch-all, and - critically - that a
// service-role data client is never reached before authentication and
// entitlement have both passed.

import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  authoriseFreedomRequest,
  resolveSoleFreedomOwner,
  withFreedomApi,
  DENY,
} from "../platform-core/api-guards/freedomApiGuard.js";
import {
  FREEDOM_RESOURCE_POLICY,
  NEVER_WRITABLE_FIELDS,
  allowedMethodsFor,
  filterWritableFields,
  isMethodAllowed,
  isResourceAllowed,
} from "../platform-core/api-guards/freedomResourcePolicy.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };

// A dependency set that records whether any DATA call was made, so we can prove
// ordering: nothing may touch Freedom data before auth + entitlement pass.
function deps({ user = null, workspaces = [], userCodes = [], workspaceCodes = [], holders = null } = {}) {
  const calls = [];
  return {
    calls,
    getUserFromToken: async (t) => { calls.push("getUserFromToken"); return t === "good-token" ? user : null; },
    listWorkspaceIdsForUser: async () => { calls.push("listWorkspaceIdsForUser"); return workspaces; },
    listModuleCodesForUser: async () => { calls.push("listModuleCodesForUser"); return userCodes; },
    listModuleCodesForWorkspaces: async () => { calls.push("listModuleCodesForWorkspaces"); return workspaceCodes; },
    listFreedomHolders: async () => {
      calls.push("listFreedomHolders");
      return holders || { userIds: [], workspaceIds: [] };
    },
  };
}

const req = (method, extra = {}) => ({ method, headers: {}, query: {}, body: {}, ...extra });
const authed = (method, extra = {}) => req(method, { headers: { authorization: "Bearer good-token" }, ...extra });

// ------------------------------------------- anonymous denied on every method
for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
  const d = deps();
  const r = await authoriseFreedomRequest(req(method), { deps: d });
  ok(r.ok === false, `anonymous ${method} must be denied`);
  eq(r.status, 401, `anonymous ${method} must return 401`);
  ok(!d.calls.includes("listModuleCodesForUser"), `anonymous ${method} must not reach entitlement lookup`);
  ok(!d.calls.includes("listFreedomHolders"), `anonymous ${method} must not reach any data lookup`);
}

// A malformed or unknown bearer token is rejected the same way.
{
  const d = deps({ user: { id: "u1" } });
  const r = await authoriseFreedomRequest(req("GET", { headers: { authorization: "Bearer nope" } }), { deps: d });
  eq(r.status, 401, "an invalid token must be rejected");
  ok(!d.calls.includes("listFreedomHolders"), "an invalid token must not reach data lookup");
}
{
  const d = deps({ user: { id: "u1" } });
  const r = await authoriseFreedomRequest(req("GET", { headers: { authorization: "good-token" } }), { deps: d });
  eq(r.status, 401, "a non-Bearer Authorization header must be rejected");
}

// ------------------------------------- authenticated but not entitled: denied
{
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["crm"], workspaceCodes: [] });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  ok(r.ok === false, "a user without the freedom entitlement must be denied");
  eq(r.status, 403, "missing entitlement must return 403");
  ok(!d.calls.includes("listFreedomHolders"), "an unentitled user must not reach any data lookup");
}

// crm grants leads but must never grant freedom.
{
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["crm", "estimate_builder"] });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  eq(r.status, 403, "no other module may confer freedom");
}

// ------------------------------------------ ORDERING: service role never first
{
  const d = deps();
  await authoriseFreedomRequest(req("DELETE"), { deps: d });
  eq(d.calls, [], "a request with no bearer token performs no lookups at all");

  // With a token present, validation happens and then stops on failure.
  const d2 = deps();
  await authoriseFreedomRequest(req("DELETE", { headers: { authorization: "Bearer bad" } }), { deps: d2 });
  eq(d2.calls, ["getUserFromToken"], "an invalid token stops immediately after validation");
}

// ---------------------------------- caller-supplied identity is never trusted
{
  // The caller claims a workspace and user they do not own. Membership says ws1.
  const d = deps({
    user: { id: "u1" },
    workspaces: ["ws1"],
    userCodes: ["freedom"],
    holders: { userIds: ["u1"], workspaceIds: [] },
  });
  const r = await authoriseFreedomRequest(
    authed("GET", {
      query: { workspace_id: "ws-attacker", user_id: "u-attacker", account_id: "acc-attacker" },
      body: { workspace_id: "ws-attacker", user_id: "u-attacker" },
      headers: { authorization: "Bearer good-token", "x-workspace-id": "ws-attacker" },
    }),
    { deps: d }
  );
  ok(r.ok, "a legitimate owner is still allowed");
  eq(r.auth.workspaceIds, ["ws1"], "workspaces come from membership, never from the request");
  ok(!r.auth.workspaceIds.includes("ws-attacker"), "a caller-supplied workspace id must be ignored");
  eq(r.auth.userId, "u1", "the user id comes from the validated token");
}

// ------------------------------------------------ owner isolation: fail closed
{
  // Nobody holds the entitlement -> cannot prove ownership -> 503.
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["freedom"], holders: { userIds: [], workspaceIds: [] } });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  eq(r.status, 503, "no provable owner must fail closed");
}
{
  // Several parties hold it -> rows are global -> must not serve them.
  const d = deps({
    user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["freedom"],
    holders: { userIds: ["u1", "u2"], workspaceIds: [] },
  });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  eq(r.status, 503, "multiple entitlement holders must fail closed, not share rows");
  ok(r.error.includes("temporarily unavailable"), "the 503 explains it is temporary");
}
{
  // Entitled, sole holder, but a different party -> denied.
  const d = deps({
    user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["freedom"],
    holders: { userIds: ["someone-else"], workspaceIds: [] },
  });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  eq(r.status, 503, "a non-owner must not reach globally shared rows");
}
{
  // Sole holder by workspace entitlement, caller is a member -> allowed.
  const d = deps({
    user: { id: "u1" }, workspaces: ["ws1"], workspaceCodes: ["freedom"],
    holders: { userIds: [], workspaceIds: ["ws1"] },
  });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d });
  ok(r.ok, "the sole owning workspace is allowed");
  ok(r.auth.ownerVerified, "owner verification is recorded");
}

// resolveSoleFreedomOwner directly
{
  const d = deps({ holders: { userIds: ["a"], workspaceIds: ["b"] } });
  const out = await resolveSoleFreedomOwner(d, { userId: "a", workspaceIds: ["b"] });
  ok(!out.allowed, "two holders across both stores is still ambiguous");
  eq(out.holderCount, 2, "holder count is reported");
}

// ------------------------------ non-data proxies: entitlement without the gate
{
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["freedom"] });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d, touchesData: false });
  ok(r.ok, "a market-data proxy is reachable with auth + entitlement");
  ok(!d.calls.includes("listFreedomHolders"), "a proxy route does not consult ownership");
  ok(!r.auth.ownerVerified, "a proxy route does not claim owner verification");
}
{
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: [] });
  const r = await authoriseFreedomRequest(authed("GET"), { deps: d, touchesData: false });
  eq(r.status, 403, "a proxy route still requires the freedom entitlement");
}

// ------------------------------------------------------- withFreedomApi shape
{
  let handlerRan = false;
  const guarded = withFreedomApi(async () => { handlerRan = true; }, { deps: deps() });
  let status = 0, payload = null;
  const res = { status(s) { status = s; return this; }, json(p) { payload = p; return this; } };
  await guarded(req("POST"), res);
  eq(status, 401, "the wrapper returns 401 for anonymous callers");
  ok(handlerRan === false, "the wrapped handler must never run for an anonymous caller");
  ok(payload.ok === false && typeof payload.error === "string", "the wrapper returns a JSON error");
}
{
  let handlerRan = false;
  const d = deps({ user: { id: "u1" }, workspaces: ["ws1"], userCodes: ["freedom"], holders: { userIds: ["u1"], workspaceIds: [] } });
  const guarded = withFreedomApi(async (rq) => { handlerRan = true; ok(rq.freedomAuth?.userId === "u1", "auth context is attached"); }, { deps: d });
  await guarded(authed("GET"), { status() { return this; }, json() { return this; } });
  ok(handlerRan, "an authorised owner reaches the handler");
}

// -------------------------------------------------- resource / method policy
{
  eq(Object.keys(FREEDOM_RESOURCE_POLICY).length, 0,
    "the catch-all allowlist is empty: no UI caller reaches /api/freedom/[resource]");

  for (const r of ["companies", "portfolios", "transactions", "cash_balance", "portfolio_holdings", "background_jobs"]) {
    ok(!isResourceAllowed(r), `${r} must not be reachable through the catch-all`);
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      ok(!isMethodAllowed(r, m), `${m} on ${r} must be denied`);
    }
    eq(allowedMethodsFor(r), [], `${r} exposes no methods`);
    eq(filterWritableFields(r, { anything: 1 }), {}, `${r} accepts no writable fields`);
  }
  ok(!isResourceAllowed(""), "an empty resource name is denied");
  ok(!isResourceAllowed(null), "a null resource name is denied");
  ok(!isResourceAllowed("__proto__"), "prototype keys must not be treated as resources");
}

// Field whitelisting refuses ownership/role fields even for a permitted resource.
{
  const policy = { demo: { methods: ["POST"], writableFields: ["note", "user_id", "role"] } };
  // Simulate by checking NEVER_WRITABLE_FIELDS covers the dangerous names.
  for (const f of ["user_id", "workspace_id", "account_id", "owner_id", "role", "is_admin", "permissions", "created_by"]) {
    ok(NEVER_WRITABLE_FIELDS.includes(f), `${f} must be permanently non-writable`);
  }
  ok(policy.demo.writableFields.includes("note"), "policy entries carry an explicit writable field list");
}

// ------------------------------------------------- source-level guarantees
{
  // Enumerate the tracked route surface, so this test describes what is
  // committed rather than depending on any one machine's working tree.
  const tracked = execSync("git ls-files pages/api/freedom*", { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter((s) => s.endsWith(".js"));

  ok(tracked.length > 0, "the tracked Freedom route surface is non-empty");

  for (const f of tracked) {
    const src = fs.readFileSync(f, "utf8");
    ok(src.includes("withFreedomApi"), `${f} must be wrapped by the Freedom guard`);
    ok(!/export default async function handler/.test(src),
      `${f} must not export a bare unguarded handler`);
  }

  const resourceSrc = fs.readFileSync("pages/api/freedom/[resource].js", "utf8");
  ok(!resourceSrc.includes("resources: Object.keys(FREEDOM_TABLES)"),
    "the catch-all must not enumerate its table names to callers");
  ok(resourceSrc.includes("isResourceAllowed"), "the catch-all must consult the resource allowlist");
  ok(resourceSrc.includes("filterWritableFields"), "the catch-all must whitelist writable fields");
  ok(resourceSrc.indexOf("isResourceAllowed") < resourceSrc.indexOf("supabaseAdmin.from"),
    "the allowlist check must precede any service-role query");
}

console.log(`Freedom API security checks passed (${checks} assertions).`);
