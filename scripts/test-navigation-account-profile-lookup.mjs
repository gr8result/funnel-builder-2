import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadAccountProfile } from "../lib/accountProfileLookup.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layout = await readFile(path.join(root, "components/Layout.js"), "utf8");
assert.match(layout, /loadAccountProfile\(supabase, user\.id\)/, "Layout must pass the Supabase client to the shared account profile lookup.");
assert.match(layout, /if \(error\) \{[\s\S]*setProfileError\("We couldn't verify your account access right now\."\);[\s\S]*return;/, "Protected routes must fail closed into the visible retry state without throwing a dev runtime overlay error.");

function fakeQuery(result) {
  return {
    timeoutMs: null,
    from(table) {
      assert.equal(table, "accounts");
      return this;
    },
    select(columns) {
      assert.match(columns, /business_name/);
      return this;
    },
    eq(column, value) {
      assert.equal(column, "user_id");
      assert.equal(value, "user-1");
      return this;
    },
    abortSignal(signal) {
      this.timeoutMs = signal?.reason?.name === "TimeoutError" ? signal.reason : signal;
      return this;
    },
    maybeSingle: async () => result,
  };
}

const missing = await loadAccountProfile({ ...fakeQuery({ data: null, error: null }) }, "user-1");
assert.deepEqual(missing, { data: null, error: null }, "a missing optional account row is not treated as an auth failure");

const accountDb = fakeQuery({ data: { business_name: "Builder Co" }, error: null });
const account = await loadAccountProfile(accountDb, "user-1");
assert.equal(account.data.business_name, "Builder Co");
assert.equal(account.data.onboarding_completed, true);
assert.equal(account.data.phone_verified, true);
assert.ok(accountDb.timeoutMs, "Account profile lookup must be bounded so Layout can reach its existing retry state on network failure.");

const queryError = { code: "NETWORK_ERROR", message: "database unavailable" };
const failed = await loadAccountProfile({ ...fakeQuery({ data: null, error: queryError }) }, "user-1");
assert.equal(failed.error, queryError, "real data access errors remain visible to the access guard");

console.log("Navigation account profile lookup regression checks passed.");
