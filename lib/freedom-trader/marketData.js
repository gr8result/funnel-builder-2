import { TRADER_WATCHLIST } from "../../pages/api/freedom-trader/watchlist.js";
import { getCurrentPrice } from "./marketDataService.js";
import { normalizeSymbol, roundMoney } from "./paperTrading.js";

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
  try {
    const quote = await getCurrentPrice(meta.symbol);
    const price = roundMoney(quote?.price);
    if (!Number.isFinite(price)) {
      return { ok: false, ...meta, price: null, provider: "Market Data Manager", delayed: true, lastUpdated: quote?.timestamp || null, source: "Shared market-data snapshot", error: quote?.error || "Market Data Manager did not return a valid price." };
    }
    return { ok: true, ...meta, price, provider: "Market Data Manager", delayed: Boolean(quote?.delayed), lastUpdated: quote?.timestamp || null, source: "Shared market-data snapshot", error: null };
  } catch (error) {
    console.error("Freedom Trader paper quote failed:", error);
    return { ok: false, ...meta, price: null, provider: "Market Data Manager", delayed: true, lastUpdated: null, source: "Shared market-data snapshot", error: "Quote request failed." };
  }
}
