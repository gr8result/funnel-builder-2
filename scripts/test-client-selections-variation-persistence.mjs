import assert from "node:assert/strict";
import { register } from "node:module";
import { persistSelectionVariationDecision } from "../lib/builders/selectionVariationPersistence.js";
import { CLIENT_APPROVED_SOURCE } from "../lib/builders/contractLock.js";

register("./fake-supabase-admin-loader.mjs", import.meta.url);
const { supabaseAdmin: db } = await import("../lib/supabaseAdmin.js");
const handler = (await import("../pages/api/builders/selection-variation.js")).default;
const payload = { id: "variation", workspace_id: "workspace", project_id: "project", status: "submitted", client_status: "approved", total: 110, subtotal: 100, gst_total: 10, created_by: "original", updated_by: "owner", metadata: { source: CLIENT_APPROVED_SOURCE, builderReviewStatus: "pending" } };
let stored, race, readError, writes, role;
function reset(record = null) {
  stored = record && structuredClone(record); race = null; readError = null; writes = 0; role = "owner";
}
const versioned = () => ({ ...structuredClone(payload), updated_at: "2026-11-14T01:00:00.000Z" });
globalThis.__fakeSupabase = {
  calls: [], users: { owner: { id: "owner" } },
  resolve(table, query) {
    if (table === "workspace_members") return { data: { role, status: "active" } };
    if (table === "workspaces") return { data: { id: "workspace", is_demo: false } };
    assert.equal(table, "builder_variations");
    const filters = query.ops.filter(([op]) => op === "eq");
    const matches = () => stored && filters.every(([, key, value]) => stored[key] === value);
    const write = query.ops.find(([op]) => ["update", "insert", "upsert"].includes(op));
    if (!write) return { data: matches() ? structuredClone(stored) : null, error: readError };
    writes += 1;
    if (race) { race(); race = null; }
    assert.notEqual(write[0], "upsert", "never overwrite a concurrently inserted variation");
    if (write[0] === "insert") {
      if (stored) return { error: { code: "23505" } };
      stored = { ...structuredClone(write[1]), updated_at: "2026-11-14T02:00:00.000Z" };
    } else {
      if (!matches()) return { data: null };
      stored = { ...stored, ...structuredClone(write[1]), updated_at: "2026-11-14T02:00:00.000Z" };
    }
    return { data: structuredClone(stored) };
  },
};
reset();
await persistSelectionVariationDecision(db, payload);
assert.equal(stored.status, "submitted");
reset(versioned());
await persistSelectionVariationDecision(db, { ...payload, total: 220, created_by: "different" });
assert.equal(stored.total, 220);
assert.equal(stored.created_by, "original");
reset(versioned());
await persistSelectionVariationDecision(db, payload, "pending");
assert.equal(stored.status, "void");
assert.equal(stored.client_status, "not_issued");
await persistSelectionVariationDecision(db, payload);
assert.equal(stored.status, "submitted", "re-approval reuses the record");
await persistSelectionVariationDecision(db, payload, "declined");
assert.equal(stored.client_status, "declined");
reset();
assert.equal(await persistSelectionVariationDecision(db, payload, "pending"), null);
assert.equal(writes, 0, "withdrawal without a cloud record creates nothing");
for (const status of ["approved", "invoiced"]) {
  reset({ ...versioned(), status });
  await assert.rejects(persistSelectionVariationDecision(db, payload), /Reload/);
  assert.equal(writes, 0);
}
reset(versioned()); readError = new Error("read unavailable");
await assert.rejects(persistSelectionVariationDecision(db, payload), /read unavailable/);
assert.equal(writes, 0);
for (const decision of ["accepted", "pending", "declined"]) {
  reset(versioned());
  race = () => { stored.status = "approved"; };
  await assert.rejects(persistSelectionVariationDecision(db, payload, decision), /Reload/);
  assert.equal(stored.status, "approved", "concurrent sign-off survives");
}
reset(versioned());
race = () => { stored.total = 330; stored.updated_at = "2026-11-14T01:30:00.000Z"; };
await assert.rejects(persistSelectionVariationDecision(db, payload), /Reload/);
assert.equal(stored.total, 330, "same-status concurrent price edit survives");
reset(); race = () => { stored = { ...versioned(), status: "approved" }; };
await assert.rejects(persistSelectionVariationDecision(db, payload), /Reload/);
assert.equal(stored.status, "approved");

async function call(action = "sign_off", expectedUpdatedAt = stored?.updated_at, reason = "") {
  let response;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { response = { status: this.statusCode, body }; return this; } };
  await handler({ method: "POST", headers: { authorization: "Bearer owner" }, body: { workspace_id: "workspace", projectId: "project", variationId: "variation", action, invoiceNumber: "INV-1", expectedUpdatedAt, reason } }, res);
  return response;
}
// Builder rejection -> client revision / resubmission (15 Nov 2026).
reset(versioned());
assert.equal((await call("reject", stored.updated_at, "")).status, 409, "a rejection needs a reason for the client");
assert.equal(stored.status, "submitted");
assert.equal((await call("reject", stored.updated_at, "Supplier has discontinued this tapware")).status, 200);
assert.equal(stored.status, "rejected");
assert.equal(stored.metadata.builderReviewStatus, "rejected");
assert.equal(stored.metadata.builderRejection.reason, "Supplier has discontinued this tapware");
assert.equal((await call("sign_off")).status, 409, "a rejected variation cannot be signed off");
assert.equal((await call("invoice")).status, 409, "or invoiced");
// The client approves again (resubmission): same record, back to the builder, history kept.
await persistSelectionVariationDecision(db, { ...payload, total: 150, metadata: { ...payload.metadata, clientApprovedAt: "2026-11-15T03:00:00.000Z" } });
assert.equal(stored.status, "submitted", "resubmitted to the builder");
assert.equal(stored.total, 150);
assert.equal(stored.metadata.builderRejection, undefined, "the live rejection is cleared");
assert.equal(stored.metadata.rejectionHistory.length, 1, "the rejection stays on record");
assert.equal(stored.metadata.rejectionHistory[0].reason, "Supplier has discontinued this tapware");
assert.equal(stored.metadata.resubmittedAt, "2026-11-15T03:00:00.000Z");
assert.equal((await call()).status, 200, "the builder can sign off the resubmission");
assert.equal(stored.status, "approved");
// Or, after a rejection, the client withdraws instead.
reset({ ...versioned(), status: "rejected", metadata: { ...payload.metadata, builderRejection: { reason: "No" } } });
await persistSelectionVariationDecision(db, payload, "pending");
assert.equal(stored.status, "void");
assert.equal(stored.metadata.builderRejection, null);
assert.equal(stored.metadata.rejectionHistory[0].reason, "No");
reset(versioned());
assert.equal((await call()).status, 200);
assert.equal(stored.status, "approved");
assert.equal((await call("invoice")).status, 200);
assert.equal(stored.status, "invoiced");
reset(versioned());
assert.equal((await call("sign_off", "old-revision")).status, 409);
assert.equal(writes, 0, "stale browser cannot sign off a newly edited price");
assert.equal((await call("sign_off", "")).status, 400);
assert.equal(writes, 0);
reset(versioned());
race = () => { stored.total = 440; stored.updated_at = "2026-11-14T01:30:00.000Z"; };
assert.equal((await call()).status, 409);
assert.equal(stored.status, "submitted", "builder cannot sign off an unseen amount");
assert.equal(stored.total, 440);
reset({ ...versioned(), project_id: "other-project" });
assert.equal((await call()).status, 404);
assert.equal(writes, 0);
reset(versioned()); role = "client";
assert.equal((await call()).status, 403);
assert.equal(writes, 0);
console.log("PASS selection variation persistence: insert/update, withdrawal, re-approval, read failure, concurrent insert/sign-off/amount edits, API version guard and access scope");
