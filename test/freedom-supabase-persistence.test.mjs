/**
 * Freedom Supabase persistence, tenancy and RLS (Stage 3).
 *
 * This is the test that reproduces the production failure: a record is saved, the
 * request context is thrown away and rebuilt, and the record is read back. On the
 * JSON backend in production that second read comes back empty, because the file
 * lived in an ephemeral per-invocation /tmp. Here it must come back.
 *
 * It deliberately drives the REAL tradeStore exports against a REAL database.
 * There is no in-memory mock: a mock cannot fail the way the production bug fails.
 *
 * It is skipped unless the environment can actually reach a database:
 *
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   FREEDOM_TEST_WORKSPACE_ID   a workspace the test may write to
 *   FREEDOM_TEST_USER_ID        a member of that workspace
 *
 * Every row it creates is prefixed `sttest_` and removed afterwards, so it never
 * disturbs migrated records.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const WORKSPACE_ID = process.env.FREEDOM_TEST_WORKSPACE_ID;
const USER_ID = process.env.FREEDOM_TEST_USER_ID;

const configured = Boolean(URL_ && SERVICE_KEY && WORKSPACE_ID && USER_ID);
const SKIP = configured ? false : "Supabase test credentials not configured";

const TEST_PREFIX = "sttest_";
let createClient;
let db;
let setFreedomStoreContext;
let tradeStore;
let restoreContext = () => {};
let previousBackend;

before(async () => {
  if (!configured) return;
  ({ createClient } = await import("@supabase/supabase-js"));
  db = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

  previousBackend = process.env.FREEDOM_STORE_BACKEND;
  process.env.FREEDOM_STORE_BACKEND = "supabase";

  ({ setFreedomStoreContext } = await import("../lib/freedom/freedomStoreSupabase.js"));
  tradeStore = await import("../lib/freedom/tradeStore.js");
  restoreContext = setFreedomStoreContext({ workspaceId: WORKSPACE_ID, userId: USER_ID });
});

after(async () => {
  if (!configured) return;
  restoreContext();
  if (previousBackend === undefined) delete process.env.FREEDOM_STORE_BACKEND;
  else process.env.FREEDOM_STORE_BACKEND = previousBackend;
  await db.from("freedom_positions").delete().eq("workspace_id", WORKSPACE_ID).like("id", `${TEST_PREFIX}%`);
});

/** Simulate a brand-new serverless invocation: no cached store, fresh context. */
async function newRequestContext() {
  restoreContext();
  restoreContext = setFreedomStoreContext({ workspaceId: WORKSPACE_ID, userId: USER_ID });
}

function sampleTrade(overrides = {}) {
  return {
    id: `${TEST_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    symbol: "TSTX", exchange: "US", currency: "USD",
    entryPrice: 100, quantity: 10, entryDate: "2026-09-01",
    safetyExit: 90, takeSomeProfit: 110, finalExit: 130,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

test("the four Freedom tables exist", { skip: SKIP }, async () => {
  for (const table of ["freedom_positions", "freedom_position_events", "freedom_trade_imports", "freedom_broker_snapshots"]) {
    const { error } = await db.from(table).select("id").limit(1);
    assert.equal(error, null, `${table} should exist and be readable by the service role`);
  }
});

test("the Supabase backend is the one under test", { skip: SKIP }, async () => {
  const { backendName } = await import("../lib/freedom/freedomStoreBackend.js");
  assert.equal(backendName(), "supabase");
});

// --- the production bug -----------------------------------------------------

test("CREATE -> new request -> the record is still there", { skip: SKIP }, async () => {
  const trade = sampleTrade();
  const created = await tradeStore.addShortTermTrade(trade);
  assert.equal(created.ok, true, `create should succeed: ${JSON.stringify(created.errors)}`);

  await newRequestContext();

  const reloaded = await tradeStore.listShortTermTrades();
  const found = reloaded.find((row) => row.id === trade.id);
  assert.ok(found, "the record must survive a new request context - this is the production bug");
  assert.equal(found.symbol, "TSTX");
  assert.equal(found.quantity, 10);
});

test("EDIT -> save -> new request -> the edit persists", { skip: SKIP }, async () => {
  const trade = sampleTrade();
  await tradeStore.addShortTermTrade(trade);

  // Stays below finalExit (130): the store rejects an incoherent price plan, and
  // this test is about persistence, not about defeating that rule.
  const updated = await tradeStore.updateShortTermTrade(trade.id, { takeSomeProfit: 115 });
  assert.equal(updated.ok, true, `update should succeed: ${JSON.stringify(updated.errors)}`);

  await newRequestContext();

  const found = (await tradeStore.listShortTermTrades()).find((row) => row.id === trade.id);
  assert.ok(found, "edited record must still exist");
  assert.equal(found.takeSomeProfit, 115, "the edited value must survive the reload");
});

test("an incoherent edit is still rejected on the Supabase backend", { skip: SKIP }, async () => {
  const trade = sampleTrade();
  await tradeStore.addShortTermTrade(trade);

  // finalExit is 130, so a take-profit above it is not a coherent plan.
  const rejected = await tradeStore.updateShortTermTrade(trade.id, { takeSomeProfit: 175 });
  assert.equal(rejected.ok, false, "validation must still apply when storage is Supabase");
  assert.match(rejected.errors.join(" "), /Final Exit must be at or above Take Some Profit/);

  await newRequestContext();

  const found = (await tradeStore.listShortTermTrades()).find((row) => row.id === trade.id);
  assert.equal(found.takeSomeProfit, 110, "a rejected edit must not have been persisted");
});

test("DELETE -> new request -> the record is gone", { skip: SKIP }, async () => {
  const trade = sampleTrade();
  await tradeStore.addShortTermTrade(trade);

  const removed = await tradeStore.removeShortTermTrade(trade.id);
  assert.equal(removed.ok, true);

  await newRequestContext();

  const found = (await tradeStore.listShortTermTrades()).find((row) => row.id === trade.id);
  assert.equal(found, undefined, "a deleted record must not come back");
});

test("a long-term holding persists across a new request", { skip: SKIP }, async () => {
  const id = `${TEST_PREFIX}lt_${Date.now().toString(36)}`;
  const created = await tradeStore.addLongTermHolding({
    id, symbol: "TSTLT", exchange: "NASDAQ", currency: "USD",
    purchasePrice: 50, quantity: 4, purchaseDate: "2026-08-01",
    reason: "persistence check",
  });
  assert.equal(created.ok, true, `create should succeed: ${JSON.stringify(created.errors)}`);

  await newRequestContext();

  const found = (await tradeStore.listLongTermHoldings()).find((row) => row.symbol === "TSTLT");
  assert.ok(found, "long-term holding must persist");
  assert.equal(found.quantity, 4);
  assert.equal(found.purchasePrice, 50);
});

test("a NULL entry price survives a real database round trip", { skip: SKIP }, async () => {
  const id = `${TEST_PREFIX}null_${Date.now().toString(36)}`;
  const { error } = await db.from("freedom_positions").insert({
    id, workspace_id: WORKSPACE_ID, user_id: USER_ID, kind: "short-term",
    symbol: "TSTNULL", quantity: 5, entry_price: null, purchase_price: 12.5, status: "open",
    payload: { id, symbol: "TSTNULL", quantity: 5, entryPrice: null, purchasePrice: 12.5, status: "open" },
  });
  assert.equal(error, null, "insert with a null entry price must be accepted");

  await newRequestContext();

  const found = (await tradeStore.listShortTermTrades()).find((row) => row.id === id);
  assert.ok(found, "the record must load");
  assert.equal(found.entryPrice, null, "entry price must still be null, not 0");
  assert.equal(found.purchasePrice, 12.5);
});

// --- write failures are real ------------------------------------------------

test("a failing write throws instead of reporting success", { skip: SKIP }, async () => {
  const { setFreedomStoreContext: setCtx } = await import("../lib/freedom/freedomStoreSupabase.js");
  const broken = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        then(resolve) { return resolve({ data: null, error: { message: "simulated outage", code: "XX000" } }); },
      };
    },
  };
  const restore = setCtx({ workspaceId: WORKSPACE_ID, userId: USER_ID, client: broken });
  try {
    await assert.rejects(
      () => tradeStore.listShortTermTrades(),
      /Freedom storage read .* failed: simulated outage/,
      "a database failure must surface, never be swallowed into an empty-but-successful result",
    );
  } finally {
    restore();
    await newRequestContext();
  }
});

// --- tenancy ----------------------------------------------------------------

test("the store cannot see another workspace's rows", { skip: SKIP }, async () => {
  const otherWorkspace = "00000000-0000-4000-8000-000000000001"; // demo company
  const trade = sampleTrade({ symbol: "TSTISO" });
  await tradeStore.addShortTermTrade(trade);

  const restore = setFreedomStoreContext({ workspaceId: otherWorkspace, userId: USER_ID });
  try {
    const rows = await tradeStore.listShortTermTrades();
    assert.equal(
      rows.find((row) => row.id === trade.id), undefined,
      "a store bound to another workspace must not see these rows",
    );
  } finally {
    restore();
    await newRequestContext();
  }
});

test("tenancy must be supplied; the store refuses to run without it", { skip: SKIP }, async () => {
  const restore = setFreedomStoreContext(null);
  try {
    await assert.rejects(
      () => tradeStore.listShortTermTrades(),
      /no tenancy context/i,
      "reading with no workspace context must fail closed",
    );
  } finally {
    restore();
    await newRequestContext();
  }
});

test("a client-supplied workspace_id cannot escape server-resolved tenancy", { skip: SKIP }, async () => {
  const trade = sampleTrade({ symbol: "TSTESC" });
  // A hostile payload naming someone else's workspace.
  trade.workspace_id = "00000000-0000-4000-8000-000000000001";
  trade.workspaceId = "00000000-0000-4000-8000-000000000001";
  trade.user_id = "00000000-0000-0000-0000-000000000000";

  await tradeStore.addShortTermTrade(trade);
  await newRequestContext();

  const { data } = await db.from("freedom_positions").select("workspace_id,user_id").eq("id", trade.id).maybeSingle();
  assert.ok(data, "the row should have been written");
  assert.equal(data.workspace_id, WORKSPACE_ID, "workspace_id must come from the server context, not the payload");
  assert.equal(data.user_id, USER_ID, "user_id must come from the server context, not the payload");
});

// --- RLS --------------------------------------------------------------------

test("RLS blocks an unauthenticated client entirely", { skip: SKIP || (!ANON_KEY && "no anon key") }, async () => {
  const anon = createClient(URL_, ANON_KEY, { auth: { persistSession: false } });

  for (const table of ["freedom_positions", "freedom_trade_imports", "freedom_broker_snapshots"]) {
    const { data, error } = await anon.from(table).select("*");
    // RLS with no auth.uid() yields no rows (or an outright error). Either is a
    // pass; rows coming back would mean the policies are not enforcing.
    assert.equal((data || []).length, 0, `${table}: an anonymous client must read no rows (error: ${error?.message || "none"})`);
  }
});

test("RLS blocks an unauthenticated insert", { skip: SKIP || (!ANON_KEY && "no anon key") }, async () => {
  const anon = createClient(URL_, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await anon.from("freedom_positions").insert({
    id: `${TEST_PREFIX}anon_${Date.now().toString(36)}`,
    workspace_id: WORKSPACE_ID, user_id: USER_ID, kind: "short-term", symbol: "TSTANON", quantity: 1,
  });
  assert.ok(error, "an anonymous insert must be rejected by RLS");
});
