import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_PATH = path.join(process.cwd(), "tmp", "freedom-investment-local.json");

function emptyStore() {
  return {
    watchlist: [],
    holdings: [],
    alerts: [],
    settings: {
      portfolioValue: 100000,
      maximumPositionPercent: 8,
      initialStagePercent: 25,
    },
  };
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(STORE_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? { ...emptyStore(), ...parsed } : emptyStore();
  } catch {
    return emptyStore();
  }
}

async function writeStore(store) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  return store;
}

export async function loadInvestmentStore() {
  return readStore();
}

export async function addInvestmentWatchlistItem(input = {}) {
  const store = await readStore();
  const symbol = String(input.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required.");
  const existing = store.watchlist.find((item) => item.symbol === symbol);
  const row = {
    symbol,
    companyName: input.companyName || symbol,
    status: input.status || "WATCH",
    investmentScore: input.investmentScore ?? null,
    targetStatus: input.targetStatus || "valuation_improvement",
    reason: input.reason || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.watchlist = existing
    ? store.watchlist.map((item) => item.symbol === symbol ? { ...item, ...row } : item)
    : [row, ...store.watchlist].slice(0, 200);
  await writeStore(store);
  return row;
}

export async function upsertInvestmentHolding(input = {}) {
  const store = await readStore();
  const symbol = String(input.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required.");
  const shares = Number(input.shares);
  const averageCost = Number(input.averageCost);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error("Shares must be positive.");
  if (!Number.isFinite(averageCost) || averageCost <= 0) throw new Error("Average cost must be positive.");
  const holding = {
    symbol,
    companyName: input.companyName || symbol,
    shares,
    averageCost,
    sector: input.sector || "Unknown",
    currency: input.currency || "USD",
    updatedAt: new Date().toISOString(),
  };
  store.holdings = store.holdings.some((item) => item.symbol === symbol)
    ? store.holdings.map((item) => item.symbol === symbol ? { ...item, ...holding } : item)
    : [holding, ...store.holdings];
  await writeStore(store);
  return holding;
}
