/**
 * The Supabase Freedom backend.
 *
 * Presents the same three primitives as the JSON backend - readStore,
 * writeStoreSnapshot, mutateStore - over the same in-memory store shape. Every
 * export of lib/freedom/tradeStore.js therefore keeps working unchanged: the
 * validation, enrichment, pending-order promotion and P&L logic never learns
 * which backend it is running on, and neither does any UI page.
 *
 * LOSSLESS ROUND TRIP
 *
 * Freedom's records are union-shaped and sparse - 45 distinct keys across 7
 * short-term records. Each row therefore stores the COMPLETE original record in
 * `payload` jsonb, and additionally projects the fields that need querying,
 * indexing or tenancy into real columns. A read reconstructs
 *
 *     { ...payload, ...typed columns }
 *
 * so a field nobody thought to enumerate survives via payload, while a value the
 * database itself edited wins via its column. Nothing is dropped, and nothing is
 * invented.
 *
 * NULLS ARE PRESERVED, NEVER DEFAULTED
 *
 * CLSK and TJGC are open positions whose entry price is genuinely unknown. They
 * round-trip as null. `?? null` is used rather than `||` throughout, so a real 0
 * is never converted to null and a null is never converted to 0.
 *
 * WRITES FAIL LOUDLY
 *
 * Every Supabase error is thrown. There is no fallback to the JSON file on write.
 * A success response that did not persist is precisely the production bug this
 * stage removes, so a failed write must surface as a failed write.
 *
 * TENANCY
 *
 * workspaceId and userId come from the caller - in the API that is
 * req.freedomAuth, resolved server-side from a validated token - and never from a
 * request payload. Reads and writes are always filtered by workspace_id, so this
 * module cannot see or touch another workspace's rows even with a service-role
 * client, and RLS enforces the same rule again for any user-JWT client.
 */

import { emptyStore, POSITION_COLLECTIONS } from "./freedomStoreBackend.js";

/** Per-request tenancy. Set by the API layer before the store is touched. */
let currentContext = null;

/**
 * Bind the workspace/user the store operates as. Returns a restore function so a
 * caller (or a test) can nest contexts safely.
 */
export function setFreedomStoreContext(context) {
  const previous = currentContext;
  currentContext = context ? { ...context } : null;
  return () => { currentContext = previous; };
}

export function getFreedomStoreContext() {
  return currentContext;
}

function requireContext() {
  const ctx = currentContext;
  if (!ctx?.workspaceId || !ctx?.userId) {
    throw new Error(
      "Freedom Supabase store has no tenancy context. workspace_id and user_id must be " +
      "resolved server-side from the authenticated request before the store is used.",
    );
  }
  return ctx;
}

async function client() {
  if (currentContext?.client) return currentContext.client;
  const { supabaseAdmin } = await import("../supabaseAdmin.js");
  return supabaseAdmin;
}

function fail(operation, error) {
  const detail = error?.message || error?.hint || "unknown error";
  const err = new Error(`Freedom storage ${operation} failed: ${detail}`);
  err.cause = error;
  err.code = error?.code || null;
  throw err;
}

// ---------------------------------------------------------------------------
// Record <-> row mapping
// ---------------------------------------------------------------------------

function isoOrNull(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value).length <= 10 ? `${value}T00:00:00Z` : String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** Numeric passthrough that keeps null null and 0 zero. */
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function jsonOrNull(value) {
  return value === undefined ? null : value;
}

/** A position record -> a freedom_positions row. */
export function positionToRow(record, kind, { workspaceId, userId }) {
  return {
    id: record.id,
    workspace_id: workspaceId,
    user_id: userId,
    kind,
    symbol: record.symbol ?? null,
    exchange: record.exchange ?? null,

    currency: record.currency ?? null,
    native_currency: record.nativeCurrency ?? null,
    purchase_price_currency: record.purchasePriceCurrency ?? null,
    valuation_currency: record.valuationCurrency ?? null,

    // entry_price and purchase_price are independent. CLSK/TJGC carry a
    // purchase_price with a null entry_price; that asymmetry is real data.
    entry_price: num(record.entryPrice),
    purchase_price: num(record.purchasePrice),
    quantity: num(record.quantity),

    safety_exit: num(record.safetyExit),
    take_some_profit: num(record.takeSomeProfit),
    final_exit: num(record.finalExit),
    target_price: num(record.targetPrice),

    status: record.status ?? null,
    order_classification: record.orderClassification ?? null,
    term_classification: record.termClassification ?? null,

    broker: record.broker ?? null,
    company_name: record.companyName ?? null,

    entry_date: isoOrNull(record.entryDate),
    purchase_date: isoOrNull(record.purchaseDate),

    import_fingerprint: record.importFingerprint ?? null,

    broker_holding_snapshot: jsonOrNull(record.brokerHoldingSnapshot),
    order_history: jsonOrNull(record.orderHistory),
    pending_sell_orders: jsonOrNull(record.pendingSellOrders),
    broker_snapshot_history: jsonOrNull(record.brokerSnapshotHistory),
    original_order: jsonOrNull(record.originalOrder),
    cmc_snapshot: jsonOrNull(record.cmcSnapshot),

    // The whole record, verbatim. This is what makes the round trip lossless.
    payload: record,

    created_at: isoOrNull(record.createdAt) || new Date().toISOString(),
    updated_at: isoOrNull(record.updatedAt) || new Date().toISOString(),
  };
}

/**
 * A freedom_positions row -> a position record.
 *
 * payload supplies every field; the typed columns are layered on top so a value
 * changed in the database (by a migration, a fix-up, or another writer) wins over
 * the snapshot captured in payload. Undefined column values are skipped so a
 * column that simply is not populated cannot erase a payload field.
 */
export function rowToPosition(row) {
  const base = (row.payload && typeof row.payload === "object") ? { ...row.payload } : {};

  const typed = {
    id: row.id,
    symbol: row.symbol,
    exchange: row.exchange,
    currency: row.currency,
    nativeCurrency: row.native_currency,
    purchasePriceCurrency: row.purchase_price_currency,
    valuationCurrency: row.valuation_currency,
    entryPrice: row.entry_price,
    purchasePrice: row.purchase_price,
    quantity: row.quantity,
    safetyExit: row.safety_exit,
    takeSomeProfit: row.take_some_profit,
    finalExit: row.final_exit,
    targetPrice: row.target_price,
    status: row.status,
    orderClassification: row.order_classification,
    termClassification: row.term_classification,
    broker: row.broker,
    companyName: row.company_name,
    importFingerprint: row.import_fingerprint,
    brokerHoldingSnapshot: row.broker_holding_snapshot,
    orderHistory: row.order_history,
    pendingSellOrders: row.pending_sell_orders,
    brokerSnapshotHistory: row.broker_snapshot_history,
    originalOrder: row.original_order,
    cmcSnapshot: row.cmc_snapshot,
  };

  for (const [key, value] of Object.entries(typed)) {
    if (value === undefined) continue;

    // A column that is NULL only because the record never had that field must
    // not add it. Otherwise a record with no targetPrice comes back carrying
    // `targetPrice: null`, turning "absent" into "explicitly empty" - a
    // different shape, and one the validators can read differently.
    //
    // When the key IS present in the payload the column always wins, including
    // when it is null, so a value genuinely cleared in the database is honoured
    // and a real null (CLSK's entryPrice) round-trips as null.
    if (value === null && !(key in base)) continue;

    base[key] = value;
  }

  // Dates are stored as timestamptz but the records use the original strings.
  // Only fill them in when the payload did not already carry them, so a
  // date-only value like "2026-09-01" is not rewritten into a full timestamp.
  if (base.entryDate === undefined && row.entry_date) base.entryDate = row.entry_date;
  if (base.purchaseDate === undefined && row.purchase_date) base.purchaseDate = row.purchase_date;
  if (base.createdAt === undefined && row.created_at) base.createdAt = row.created_at;
  if (base.updatedAt === undefined && row.updated_at) base.updatedAt = row.updated_at;

  return base;
}

export function importToRow(record, { workspaceId, userId }) {
  return {
    id: String(record.id),
    workspace_id: workspaceId,
    user_id: userId,
    imported_at: isoOrNull(record.at),
    row_count: Number.isFinite(Number(record.rowCount)) ? Number(record.rowCount) : null,
    reports: jsonOrNull(record.reports),
    payload: record,
  };
}

export function rowToImport(row) {
  const base = (row.payload && typeof row.payload === "object") ? { ...row.payload } : {};
  base.id = row.id;
  if (base.at === undefined && row.imported_at) base.at = row.imported_at;
  if (base.rowCount === undefined && row.row_count !== undefined) base.rowCount = row.row_count;
  if (base.reports === undefined && row.reports !== undefined) base.reports = row.reports;
  return base;
}

export function snapshotToRow(record, { workspaceId, userId, isCurrent = false }) {
  return {
    id: String(record.id),
    workspace_id: workspaceId,
    user_id: userId,
    broker: record.broker ?? null,
    snapshot_type: record.type ?? null,
    source: record.source ?? null,
    captured_at: isoOrNull(record.importedAt || record.capturedAt || record.at),
    is_current: Boolean(isCurrent),
    payload: record,
  };
}

export function rowToSnapshot(row) {
  const base = (row.payload && typeof row.payload === "object") ? { ...row.payload } : {};
  base.id = row.id;
  if (base.broker === undefined && row.broker) base.broker = row.broker;
  if (base.type === undefined && row.snapshot_type) base.type = row.snapshot_type;
  if (base.source === undefined && row.source) base.source = row.source;
  return base;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Materialise the whole workspace's Freedom data as the in-memory store shape.
 *
 * Freedom holds tens of records, not millions, so reading the workspace in full
 * keeps the store contract exact and avoids partial-state bugs. If that ever
 * stops being true, this is the single function to paginate.
 */
export async function readStore() {
  const { workspaceId } = requireContext();
  const db = await client();

  const [positions, imports, snapshots] = await Promise.all([
    db.from("freedom_positions").select("*").eq("workspace_id", workspaceId),
    db.from("freedom_trade_imports").select("*").eq("workspace_id", workspaceId).order("imported_at", { ascending: true }),
    db.from("freedom_broker_snapshots").select("*").eq("workspace_id", workspaceId),
  ]);

  if (positions.error) fail("read (positions)", positions.error);
  if (imports.error) fail("read (imports)", imports.error);
  if (snapshots.error) fail("read (snapshots)", snapshots.error);

  const store = emptyStore();

  for (const row of positions.data || []) {
    const record = rowToPosition(row);
    if (row.kind === POSITION_COLLECTIONS.shortTermTrades) store.shortTermTrades.push(record);
    else if (row.kind === POSITION_COLLECTIONS.longTermHoldings) store.longTermHoldings.push(record);
    else if (row.kind === POSITION_COLLECTIONS.archivedHoldings) store.archivedHoldings.push(record);
  }

  store.tradeImports = (imports.data || []).map(rowToImport);

  const snapshotRows = snapshots.data || [];
  store.brokerPortfolioSnapshotHistory = snapshotRows.map(rowToSnapshot);
  const current = snapshotRows.find((row) => row.is_current) || null;
  store.brokerPortfolioSnapshot = current ? rowToSnapshot(current) : null;

  store.updatedAt = new Date().toISOString();
  return store;
}

/**
 * Persist a whole store snapshot for the current workspace.
 *
 * Upserts every record present and removes rows the store no longer contains, so
 * a delete performed by tradeStore's mutator is honoured. Scoped to the caller's
 * workspace throughout - a delete can never reach another tenant's rows.
 */
export async function writeStoreSnapshot(store) {
  const { workspaceId, userId } = requireContext();
  const db = await client();

  const rows = [];
  for (const [collection, kind] of Object.entries(POSITION_COLLECTIONS)) {
    for (const record of store[collection] || []) {
      if (!record?.id) {
        throw new Error(`Freedom storage write refused: a ${kind} record has no id.`);
      }
      rows.push(positionToRow(record, kind, { workspaceId, userId }));
    }
  }

  if (rows.length) {
    const { error } = await db.from("freedom_positions").upsert(rows, { onConflict: "id" });
    if (error) fail("write (positions)", error);
  }

  const keepIds = rows.map((row) => row.id);
  const stale = await db
    .from("freedom_positions")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (stale.error) fail("write (stale scan)", stale.error);

  const toDelete = (stale.data || []).map((row) => row.id).filter((id) => !keepIds.includes(id));
  if (toDelete.length) {
    const { error } = await db
      .from("freedom_positions")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("id", toDelete);
    if (error) fail("write (deletes)", error);
  }

  const importRows = (store.tradeImports || [])
    .filter((record) => record?.id)
    .map((record) => importToRow(record, { workspaceId, userId }));
  if (importRows.length) {
    const { error } = await db.from("freedom_trade_imports").upsert(importRows, { onConflict: "id" });
    if (error) fail("write (imports)", error);
  }

  await writeSnapshots(db, store, { workspaceId, userId });

  return store;
}

async function writeSnapshots(db, store, { workspaceId, userId }) {
  const current = store.brokerPortfolioSnapshot;
  const history = Array.isArray(store.brokerPortfolioSnapshotHistory)
    ? store.brokerPortfolioSnapshotHistory
    : [];

  const byId = new Map();
  for (const record of history) if (record?.id) byId.set(String(record.id), record);
  if (current?.id) byId.set(String(current.id), current);
  if (!byId.size) return;

  // Clear the current flag first so the single-current unique index cannot be
  // violated mid-upsert.
  const clear = await db
    .from("freedom_broker_snapshots")
    .update({ is_current: false })
    .eq("workspace_id", workspaceId)
    .eq("is_current", true);
  if (clear.error) fail("write (snapshot flag)", clear.error);

  const rows = [...byId.entries()].map(([id, record]) =>
    snapshotToRow(record, { workspaceId, userId, isCurrent: current?.id != null && String(current.id) === id }));

  const { error } = await db.from("freedom_broker_snapshots").upsert(rows, { onConflict: "id" });
  if (error) fail("write (snapshots)", error);
}

/**
 * Read, mutate, write.
 *
 * Serialised per process the same way the JSON backend is, so two concurrent API
 * calls cannot interleave a read-modify-write and lose one of the two edits.
 */
let writeQueue = Promise.resolve();

export async function mutateStore(mutator) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    store.updatedAt = new Date().toISOString();
    await writeStoreSnapshot(store);
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export const supabaseBackend = Object.freeze({
  name: "supabase",
  readStore,
  writeStoreSnapshot,
  mutateStore,
});
