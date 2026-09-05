import test from "node:test";
import assert from "node:assert/strict";
import { DEVELOPER_EMAILS } from "../lib/adminUsers.js";
import { authoriseFreedomRequest, withFreedomApi } from "../platform-core/api-guards/freedomApiGuard.js";

function deps(user, entitled = false) {
  return {
    getUserFromToken: async token => token === "valid" ? user : null,
    listWorkspaceIdsForUser: async () => ["workspace"],
    listModuleCodesForUser: async () => entitled ? ["freedom"] : [],
    listModuleCodesForWorkspaces: async () => [],
    listFreedomHolders: async () => ({ userIds: entitled ? [user.id] : [], workspaceIds: [] }),
  };
}
const req = { headers: { authorization: "Bearer valid" } };
const admin = { id: "existing-admin", email: DEVELOPER_EMAILS[0], emailConfirmedAt: "2026-09-01" };

test("existing verified platform admin gains Freedom access without a seeded subscription", async () => {
  const result = await authoriseFreedomRequest(req, { deps: deps(admin) });
  assert.equal(result.ok, true);
  assert.equal(result.auth.platformAdmin, true);
  assert.equal(result.auth.userId, admin.id);
});
test("anonymous, invalid-token and unverified-email requests cannot use admin access", async () => {
  assert.equal((await authoriseFreedomRequest({ headers: {} }, { deps: deps(admin) })).status, 401);
  assert.equal((await authoriseFreedomRequest({ headers: { authorization: "Bearer invalid" } }, { deps: deps(admin) })).status, 401);
  assert.equal((await authoriseFreedomRequest(req, { deps: deps({ ...admin, emailConfirmedAt: null }) })).status, 403);
});
test("customer subscription and owner checks remain protected; forged identity is ignored", async () => {
  const customer = { id: "customer", email: "customer@example.net", emailConfirmedAt: "2026-09-01" };
  const forged = { ...req, headers: { ...req.headers, email: admin.email, "x-dev-mode": "true" }, body: { email: admin.email, role: "admin" } };
  assert.equal((await authoriseFreedomRequest(forged, { deps: deps(customer) })).status, 403);
  assert.equal((await authoriseFreedomRequest(req, { deps: deps(customer, true) })).ok, true);
  const multipleOwners = { ...deps(customer, true), listFreedomHolders: async () => ({ userIds: ["customer", "another-customer"], workspaceIds: [] }) };
  assert.equal((await authoriseFreedomRequest(req, { deps: multipleOwners })).status, 503);
});
test("auth database and handler failures become JSON 500 responses, never unhandled exceptions", async () => {
  for (const failInHandler of [false, true]) {
    const dependencies = deps(admin);
    if (!failInHandler) dependencies.getUserFromToken = async () => { throw new Error("database unavailable"); };
    let status, body;
    const response = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
    await withFreedomApi(async () => { throw new Error("store unavailable"); }, { deps: dependencies })(req, response);
    assert.equal(status, 500);
    assert.equal(body.ok, false);
    assert.match(body.error, /retry/);
  }
});
