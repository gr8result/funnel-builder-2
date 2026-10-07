/**
 * Round-trip fidelity for the Freedom JSON -> Supabase migration (Stage 3).
 *
 * Proves the mapping is LOSSLESS at the semantic level, not merely that row
 * counts line up. Every record in the live store is pushed through the real
 * mappers used by both the migration script and the Supabase backend:
 *
 *     JSON record -> positionToRow() -> rowToPosition() -> compared field by field
 *
 * The Supabase driver is not involved, so this runs anywhere, including CI with
 * no database. The database's own behaviour (RLS, constraints, idempotency) is
 * covered separately by test/freedom-supabase-persistence.test.mjs, which is
 * skipped unless credentials are present.
 *
 * The specific values asserted here are the ones a bad migration would quietly
 * destroy: null entry prices that must not become 0, three separate currency
 * fields that must not collapse into one, and quantities on the real holdings.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  importToRow,
  positionToRow,
  rowToImport,
  rowToPosition,
  rowToSnapshot,
  snapshotToRow,
} from "../lib/freedom/freedomStoreSupabase.js";
import { POSITION_COLLECTIONS } from "../lib/freedom/freedomStoreBackend.js";

const STORE_PATH = process.env.FREEDOM_TRADE_STORE_PATH
  || path.join(process.cwd(), "tmp", "freedom-trades.json");

const CTX = {
  workspaceId: "00000000-0000-4000-8000-0000000000aa",
  userId: "00000000-0000-4000-8000-0000000000bb",
};

const hasStore = fs.existsSync(STORE_PATH);
const store = hasStore ? JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) : null;

function allPositions() {
  const out = [];
  for (const [collection, kind] of Object.entries(POSITION_COLLECTIONS)) {
    for (const record of store?.[collection] || []) out.push({ record, kind, collection });
  }
  return out;
}

function roundTrip(record, kind) {
  return rowToPosition(positionToRow(record, kind, CTX));
}

function find(symbol) {
  const hit = allPositions().find((entry) => entry.record.symbol === symbol);
  assert.ok(hit, `expected a record for ${symbol} in the live store`);
  return hit;
}

// ---------------------------------------------------------------------------

test("live store is present and has the expected shape", { skip: !hasStore && "no live store" }, () => {
  assert.equal(store.shortTermTrades.length, 7);
  assert.equal(store.shortTermTrades.filter((t) => t.status === "pending").length, 5);
  assert.equal(store.shortTermTrades.filter((t) => t.status === "open").length, 2);
  assert.equal(store.longTermHoldings.length, 3);
  assert.equal((store.archivedHoldings || []).length, 2);
  assert.equal((store.tradeImports || []).length, 2);
  assert.ok(store.brokerPortfolioSnapshot, "expected a current broker snapshot");
});

test("every record survives the round trip with no field lost or altered", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const out = roundTrip(record, kind);

    for (const [key, value] of Object.entries(record)) {
      assert.deepEqual(
        out[key], value,
        `${record.symbol} (${kind}): field "${key}" changed across the round trip`,
      );
    }

    // And nothing invented beyond the date/id fields the row layer fills in.
    const extra = Object.keys(out).filter((key) => !(key in record));
    assert.deepEqual(extra, [], `${record.symbol}: round trip invented field(s) ${extra.join(", ")}`);
  }
});

test("CLSK and TJGC keep a NULL entry price - never 0, never inferred", { skip: !hasStore && "no live store" }, () => {
  for (const symbol of ["CLSK", "TJGC"]) {
    const { record, kind } = find(symbol);

    assert.equal(record.entryPrice, null, `${symbol} source entryPrice must be null`);

    const row = positionToRow(record, kind, CTX);
    assert.equal(row.entry_price, null, `${symbol} entry_price must be NULL in the row`);
    assert.notEqual(row.entry_price, 0, `${symbol} entry_price must not be 0`);

    const out = rowToPosition(row);
    assert.equal(out.entryPrice, null, `${symbol} entryPrice must still be null after the round trip`);
    assert.ok(!Number.isFinite(out.entryPrice), `${symbol} entryPrice must not be numeric`);

    // purchase_price is a separate, populated field. The asymmetry is real data.
    assert.ok(Number.isFinite(row.purchase_price), `${symbol} purchase_price should survive as a number`);
    assert.equal(out.purchasePrice, record.purchasePrice, `${symbol} purchasePrice changed`);
  }
});

test("a real zero is preserved as zero, not turned into null", () => {
  const row = positionToRow(
    { id: "z1", symbol: "ZERO", quantity: 0, entryPrice: 0, targetPrice: 0 },
    "short-term", CTX,
  );
  assert.equal(row.entry_price, 0);
  assert.equal(row.quantity, 0);
  assert.equal(row.target_price, 0);
  const out = rowToPosition(row);
  assert.equal(out.entryPrice, 0);
  assert.equal(out.quantity, 0);
});

test("quantities on the live holdings are exact", { skip: !hasStore && "no live store" }, () => {
  const expected = { CBA: 45, JBLU: 240, IVV: 86, WULF: 88, NWH: 1436 };
  for (const [symbol, quantity] of Object.entries(expected)) {
    const matches = allPositions().filter((entry) => entry.record.symbol === symbol);
    assert.ok(matches.length, `expected a record for ${symbol}`);
    const match = matches.find((entry) => entry.record.quantity === quantity) || matches[0];
    const out = roundTrip(match.record, match.kind);
    assert.equal(out.quantity, quantity, `${symbol} quantity must round-trip as ${quantity}`);
    assert.equal(positionToRow(match.record, match.kind, CTX).quantity, quantity);
  }
});

test("the three currency fields stay separate", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const row = positionToRow(record, kind, CTX);
    assert.equal(row.currency, record.currency ?? null, `${record.symbol}: currency`);
    assert.equal(row.native_currency, record.nativeCurrency ?? null, `${record.symbol}: nativeCurrency`);
    assert.equal(row.purchase_price_currency, record.purchasePriceCurrency ?? null, `${record.symbol}: purchasePriceCurrency`);
    assert.equal(row.valuation_currency, record.valuationCurrency ?? null, `${record.symbol}: valuationCurrency`);
  }

  // JBLU is the case that proves they are not interchangeable: a US listing
  // valued in AUD. If these ever collapse, its P&L silently changes.
  const jblu = find("JBLU").record;
  assert.equal(jblu.exchange, "US");
  assert.equal(jblu.currency, "AUD");
});

test("exchange, targets, status and classifications survive", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const out = roundTrip(record, kind);
    for (const field of [
      "exchange", "status", "orderClassification", "termClassification",
      "targetPrice", "takeSomeProfit", "finalExit", "safetyExit",
      "broker", "companyName", "importFingerprint",
    ]) {
      assert.deepEqual(out[field], record[field], `${record.symbol}: ${field} changed`);
    }
  }
});

test("nested structures survive intact", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const out = roundTrip(record, kind);
    for (const field of [
      "orderHistory", "pendingSellOrders", "brokerHoldingSnapshot",
      "brokerSnapshotHistory", "originalOrder", "cmcSnapshot",
    ]) {
      assert.deepEqual(out[field], record[field], `${record.symbol}: ${field} changed`);
    }
  }
});

test("timestamps survive unchanged", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const out = roundTrip(record, kind);
    for (const field of ["createdAt", "updatedAt", "entryDate", "purchaseDate"]) {
      assert.deepEqual(out[field], record[field], `${record.symbol}: ${field} changed`);
    }
  }
});

test("kind is assigned from the collection the record came from", { skip: !hasStore && "no live store" }, () => {
  const counts = {};
  for (const { record, kind } of allPositions()) {
    counts[kind] = (counts[kind] || 0) + 1;
    assert.equal(positionToRow(record, kind, CTX).kind, kind);
  }
  assert.deepEqual(counts, { "short-term": 7, "long-term": 3, archived: 2 });
});

test("tenancy is stamped on every row and never read from the record", { skip: !hasStore && "no live store" }, () => {
  for (const { record, kind } of allPositions()) {
    const row = positionToRow({ ...record, workspace_id: "evil", user_id: "evil" }, kind, CTX);
    assert.equal(row.workspace_id, CTX.workspaceId, "workspace_id must come from the context");
    assert.equal(row.user_id, CTX.userId, "user_id must come from the context");
  }
});

test("trade imports and broker snapshots round-trip", { skip: !hasStore && "no live store" }, () => {
  for (const record of store.tradeImports || []) {
    const out = rowToImport(importToRow(record, CTX));
    for (const [key, value] of Object.entries(record)) {
      assert.deepEqual(out[key], value, `import ${record.id}: ${key} changed`);
    }
  }

  const snapshot = store.brokerPortfolioSnapshot;
  const out = rowToSnapshot(snapshotToRow(snapshot, { ...CTX, isCurrent: true }));
  for (const [key, value] of Object.entries(snapshot)) {
    assert.deepEqual(out[key], value, `snapshot: ${key} changed`);
  }
  assert.equal(snapshotToRow(snapshot, { ...CTX, isCurrent: true }).is_current, true);
});

test("an unenumerated field still survives, via payload", () => {
  const record = {
    id: "x1", symbol: "XYZ", quantity: 1,
    aFieldNobodyPlannedFor: { nested: [1, 2, 3] },
    anotherOne: "kept",
  };
  const out = rowToPosition(positionToRow(record, "short-term", CTX));
  assert.deepEqual(out.aFieldNobodyPlannedFor, { nested: [1, 2, 3] });
  assert.equal(out.anotherOne, "kept");
});

test("a record without an id is refused rather than silently given one", () => {
  const row = positionToRow({ symbol: "NOID", quantity: 1 }, "short-term", CTX);
  assert.equal(row.id, undefined, "the mapper must not invent an id");
});
