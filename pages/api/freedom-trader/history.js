import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import { fetchSharedHistory } from "../../../lib/freedom-trader/marketDataService.js";
import { normalizeTwelveDataInterval } from "../../../lib/freedom-trader/twelveData.js";

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRange(value) {
  const aliases = {
    "1d": "1d",
    "5d": "5d",
    "1m": "1mo",
    "1mo": "1mo",
    "3m": "3mo",
    "3mo": "3mo",
    "6m": "6mo",
    "6mo": "6mo",
    "1y": "1y",
    "3y": "3y",
    "5y": "5y",
    "max": "max",
  };
  return aliases[String(value || "1y").trim().toLowerCase()] || "1y";
}

export async function fetchTraderHistory(symbol, range = "1y", requestedInterval = null) {
  const normalizedRange = normalizeRange(range);
  const interval = normalizeTwelveDataInterval(requestedInterval, normalizedRange);
  return fetchSharedHistory(normalizeSymbol(symbol), normalizedRange, interval);
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const symbol = normalizeSymbol(Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol || "NVDA");
  const range = normalizeRange(Array.isArray(req.query.range) ? req.query.range[0] : req.query.range);
  const interval = Array.isArray(req.query.interval) ? req.query.interval[0] : req.query.interval;

  if (!/^[A-Z.]{1,12}$/.test(symbol)) {
    return res.status(200).json({ ok: false, symbol, range, error: "Provide a valid symbol, such as NVDA." });
  }

  const result = await fetchTraderHistory(symbol, range, interval);
  return res.status(200).json({ ...result, updatedAt: new Date().toISOString() });
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
