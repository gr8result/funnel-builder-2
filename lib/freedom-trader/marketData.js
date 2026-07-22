import { TRADER_WATCHLIST } from "../../pages/api/freedom-trader/watchlist.js";
import { cleanNumber, normalizeSymbol, roundMoney } from "./paperTrading.js";

export function marketMeta(symbol) {
  const normalized = normalizeSymbol(symbol);
  const row = TRADER_WATCHLIST.find((item) => item.symbol === normalized);
  const isAsx = normalized.endsWith(".AX") || row?.exchange === "ASX";
  return {
    symbol: normalized,
    companyName: row?.companyName || normalized,
    exchange: row?.exchange || (isAsx ? "ASX" : "NASDAQ"),
    currency: isAsx ? "AUD" : "USD",
  };
}

export async function fetchTradeQuote(symbol) {
  const meta = marketMeta(symbol);
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      ...meta,
      price: null,
      provider: "Finnhub",
      delayed: true,
      lastUpdated: null,
      source: "Finnhub quote",
      error: "FINNHUB_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(meta.symbol)}&token=${encodeURIComponent(apiKey)}`);
    const data = await response.json().catch(() => null);
    const price = roundMoney(data?.c);
    const lastUpdated = cleanNumber(data?.t) ? new Date(Number(data.t) * 1000).toISOString() : null;
    if (!response.ok || !Number.isFinite(price)) {
      return { ok: false, ...meta, price: null, provider: "Finnhub", delayed: true, lastUpdated, source: "Finnhub quote", error: "Finnhub did not return a valid price." };
    }
    return { ok: true, ...meta, price, provider: "Finnhub", delayed: true, lastUpdated, source: "Finnhub quote", error: null };
  } catch (error) {
    console.error("Freedom Trader paper quote failed:", error);
    return { ok: false, ...meta, price: null, provider: "Finnhub", delayed: true, lastUpdated: null, source: "Finnhub quote", error: "Quote request failed." };
  }
}
