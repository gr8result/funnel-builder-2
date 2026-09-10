/**
 * Freedom persistence backend selection (Stage 3).
 *
 * lib/freedom/tradeStore.js reaches storage through exactly three primitives -
 * readStore, writeStoreSnapshot and mutateStore. Every one of its twenty exports
 * goes through them. This module supplies those three primitives, so swapping
 * storage does not require rewriting a single piece of trade logic: validation,
 * enrichment, pending-order promotion and P&L all keep operating on the same
 * in-memory store shape they always have.
 *
 * That is deliberate. Reimplementing twenty functions against SQL would have been
 * twenty chances to quietly change a rounding rule or drop a sparse field.
 *
 * THE STORE SHAPE is the contract between the two backends:
 *
 *   {
 *     version, updatedAt,
 *     shortTermTrades: [], longTermHoldings: [], archivedHoldings: [],
 *     tradeImports: [], brokerPortfolioSnapshot: {} | null,
 *     brokerPortfolioSnapshotHistory: []
 *   }
 *
 * SELECTION
 *
 *   FREEDOM_STORE_BACKEND=json      (default - unchanged production behaviour)
 *   FREEDOM_STORE_BACKEND=supabase
 *
 * The default stays `json` until a migration has been verified against real data.
 * An unrecognised value is a hard error rather than a silent fallback: quietly
 * choosing a backend is how data ends up in two places.
 *
 * WRITE FAILURES ARE NEVER SWALLOWED. In supabase mode a failed write throws.
 * There is no fallback to the JSON file on write - a "saved" response that did
 * not persist is the exact bug this stage exists to remove.
 */

import { jsonBackend } from "./freedomStoreJson.js";
import { supabaseBackend } from "./freedomStoreSupabase.js";

export const BACKENDS = Object.freeze({ JSON: "json", SUPABASE: "supabase" });

/** The configured backend name. Defaults to json. */
export function backendName() {
  const raw = String(process.env.FREEDOM_STORE_BACKEND || "").trim().toLowerCase();
  if (!raw) return BACKENDS.JSON;
  if (raw === BACKENDS.JSON || raw === BACKENDS.SUPABASE) return raw;
  throw new Error(
    `FREEDOM_STORE_BACKEND must be "${BACKENDS.JSON}" or "${BACKENDS.SUPABASE}", received "${raw}".`,
  );
}

export function isSupabaseBackend() {
  return backendName() === BACKENDS.SUPABASE;
}

/**
 * The active backend. Resolved per call rather than cached at import time so a
 * test can switch backends without reloading the module graph.
 */
export function activeBackend() {
  return backendName() === BACKENDS.SUPABASE ? supabaseBackend : jsonBackend;
}

/** Shape of an empty store. Shared so both backends agree on it exactly. */
export function emptyStore() {
  return {
    version: 1,
    shortTermTrades: [],
    longTermHoldings: [],
    archivedHoldings: [],
    tradeImports: [],
    brokerPortfolioSnapshot: null,
    brokerPortfolioSnapshotHistory: [],
    updatedAt: null,
  };
}

/** Collections that carry position records, and the `kind` each maps to. */
export const POSITION_COLLECTIONS = Object.freeze({
  shortTermTrades: "short-term",
  longTermHoldings: "long-term",
  archivedHoldings: "archived",
});
