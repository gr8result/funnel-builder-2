/**
 * The JSON-file Freedom backend.
 *
 * This is the behaviour lib/freedom/tradeStore.js has always had, moved here
 * unchanged so that the Supabase backend can stand beside it rather than replace
 * it in place. It remains the default and the rollback path.
 *
 * Its limitation is the reason Stage 3 exists: process.cwd()/tmp is read-only and
 * per-invocation on Vercel, so writes made in production do not survive. It is
 * still exactly right for local development and for restoring from the JSON file.
 *
 * The legacy market-watch merge needs tradeStore's validator, which would import
 * this module back. Rather than create that cycle, the mapper is passed in by the
 * caller; when it is absent the merge is simply skipped.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyStore } from "./freedomStoreBackend.js";

export function storePath() {
  return process.env.FREEDOM_TRADE_STORE_PATH || path.join(process.cwd(), "tmp", "freedom-trades.json");
}

function legacyPaperStorePath() {
  if (process.env.FREEDOM_PAPER_STORE_PATH) return process.env.FREEDOM_PAPER_STORE_PATH;
  if (process.env.FREEDOM_TRADE_STORE_PATH) return null;
  return path.join(process.cwd(), "tmp", "freedom-paper-local.json");
}

let writeQueue = Promise.resolve();

function hasRecord(rows = [], candidate = {}) {
  return rows.some((row) => row.id === candidate.id || (
    row.sourceLegacyId && candidate.sourceLegacyId && row.sourceLegacyId === candidate.sourceLegacyId
  ));
}

async function mergeLegacyFreedomStore(store, legacyMapper) {
  if (typeof legacyMapper !== "function") return store;
  const legacyPath = legacyPaperStorePath();
  if (!legacyPath) return store;
  try {
    const legacy = JSON.parse(await readFile(legacyPath, "utf8"));
    const legacyTrades = (Array.isArray(legacy?.marketWatch) ? legacy.marketWatch : [])
      .map(legacyMapper)
      .filter(Boolean);
    let added = 0;
    for (const trade of legacyTrades) {
      if (!hasRecord(store.shortTermTrades, trade) && !hasRecord(store.longTermHoldings, trade)) {
        store.shortTermTrades.push(trade);
        added += 1;
      }
    }
    if (added) Object.defineProperty(store, "__legacyMerged", { value: added, enumerable: false });
  } catch {}
  return store;
}

export async function readStore({ legacyMapper } = {}) {
  try {
    const parsed = JSON.parse(await readFile(storePath(), "utf8"));
    if (!parsed || !Array.isArray(parsed.shortTermTrades) || !Array.isArray(parsed.longTermHoldings)) {
      throw new Error("Invalid Freedom portfolio store: holdings and trades must be arrays.");
    }
    return await mergeLegacyFreedomStore({
      ...emptyStore(),
      ...parsed,
      shortTermTrades: Array.isArray(parsed?.shortTermTrades) ? parsed.shortTermTrades : [],
      longTermHoldings: Array.isArray(parsed?.longTermHoldings) ? parsed.longTermHoldings : [],
      tradeImports: Array.isArray(parsed?.tradeImports) ? parsed.tradeImports : [],
    }, legacyMapper);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return await mergeLegacyFreedomStore(emptyStore(), legacyMapper);
  }
}

export async function writeStoreSnapshot(store) {
  const target = storePath();
  const snapshot = { ...store, updatedAt: new Date().toISOString() };
  delete snapshot.__legacyMerged;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(snapshot, null, 2));
}

/** Serialised so concurrent API calls cannot clobber each other's writes. */
export async function mutateStore(mutator, { legacyMapper } = {}) {
  const task = writeQueue.then(async () => {
    const target = storePath();
    const store = await readStore({ legacyMapper });
    const result = await mutator(store);
    store.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(store, null, 2));
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export const jsonBackend = Object.freeze({
  name: "json",
  readStore,
  writeStoreSnapshot,
  mutateStore,
});
