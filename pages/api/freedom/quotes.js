const COMPANY_META = {
  MSFT: { companyName: "Microsoft", sector: "Software", qualityScore: 96 },
  NVDA: { companyName: "NVIDIA", sector: "Semiconductors", qualityScore: 94 },
  V: { companyName: "Visa", sector: "Payments", qualityScore: 95 },
  AMZN: { companyName: "Amazon", sector: "Cloud & E-commerce", qualityScore: 93 },
  COST: { companyName: "Costco", sector: "Consumer Defensive", qualityScore: 92 },
  GOOGL: { companyName: "Alphabet", sector: "Digital Advertising & AI", qualityScore: 93 },
  AVGO: { companyName: "Broadcom", sector: "Semiconductors", qualityScore: 92 },
  MA: { companyName: "Mastercard", sector: "Payments", qualityScore: 94 },
  ASML: { companyName: "ASML", sector: "Semiconductor Equipment", qualityScore: 91 },
  TSM: { companyName: "Taiwan Semiconductor", sector: "Semiconductors", qualityScore: 92 },
};

const FALLBACK_QUOTES = {
  MSFT: {
    symbol: "MSFT",
    companyName: "Microsoft",
    sector: "Software",
    currentPrice: 388.84,
    previousClose: 390,
    change: -1.16,
    changePercent: -0.3,
    dayHigh: null,
    dayLow: null,
    open: null,
    timestamp: null,
    yearHigh: 555.45,
    yearLow: 349.2,
    percentOffHigh: -30,
    qualityScore: 96,
    rating: "BUY",
    source: "fallback",
  },
};

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function parseSymbols(req) {
  const raw = req.query.symbols || req.query.symbol || "MSFT";
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value)
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean);
}

function getRating(qualityScore, percentOffHigh) {
  if (qualityScore >= 95 && percentOffHigh <= -15) return "STRONG BUY";
  if (qualityScore >= 90 && percentOffHigh <= -10) return "BUY";
  if (qualityScore >= 90) return "WATCH";
  if (qualityScore >= 80) return "HOLD OFF";
  return "AVOID";
}

function friendlyQuoteError(status, data) {
  if (status === 429) return "Finnhub rate limit reached. Try again shortly.";
  if (data?.error) return String(data.error);
  if (status) return `Finnhub quote request failed with status ${status}.`;
  return "Finnhub quote request failed.";
}

function friendlyCandleError(status, data) {
  if (status === 403) return "Historical data temporarily unavailable.";
  if (status === 429) return "Finnhub candle rate limit reached. Try again shortly.";
  if (data?.error) return String(data.error);
  if (status) return `Finnhub candle request failed with status ${status}.`;
  return "Finnhub candle request failed.";
}

function logFinnhubRequest(symbol, apiKey, response) {
  console.log("Finnhub symbol:", symbol);
  console.log("Finnhub key exists:", Boolean(apiKey));
  console.log("Finnhub key length:", apiKey?.length || 0);
  console.log("Finnhub key starts:", apiKey?.slice(0, 4));
  console.log("Finnhub key ends:", apiKey?.slice(-4));
  console.log("Finnhub response status:", response.status);
}

async function fetchFinnhubQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      status: "missing_key",
      data: null,
      error: "FINNHUB_API_KEY is not detected on the server. Add it to .env.local and restart the dev server.",
    };
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url);
    logFinnhubRequest(symbol, apiKey, response);
    const data = await response.json().catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : friendlyQuoteError(response.status, data),
    };
  } catch (error) {
    return {
      ok: false,
      status: "network_error",
      data: null,
      error: error.message || "Network error contacting Finnhub quote endpoint.",
    };
  }
}

async function fetchFinnhubCandles(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      status: "missing_key",
      data: null,
      prices: [],
      error: "FINNHUB_API_KEY is not detected on the server. Add it to .env.local and restart the dev server.",
    };
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 365);
  const url =
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}` +
    `&resolution=D&from=${encodeURIComponent(String(unixSeconds(from)))}` +
    `&to=${encodeURIComponent(String(unixSeconds(to)))}` +
    `&token=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        prices: [],
        error: friendlyCandleError(response.status, data),
      };
    }

    if (data?.s === "no_data") {
      return {
        ok: false,
        status: "no_data",
        data,
        prices: [],
        error: "Finnhub returned no candle data for this symbol.",
      };
    }

    if (data?.s !== "ok" || !Array.isArray(data.c)) {
      return {
        ok: false,
        status: data?.s || "bad_payload",
        data,
        prices: [],
        error: "Finnhub returned incomplete candle data.",
      };
    }

    const prices = data.c
      .map((close, index) => ({
        close: round(close),
        high: round(data.h?.[index]),
        low: round(data.l?.[index]),
      }))
      .filter((point) => Number.isFinite(point.close));

    return {
      ok: prices.length > 0,
      status: response.status,
      data,
      prices,
      error: prices.length > 0 ? null : "Finnhub returned no usable candle prices.",
    };
  } catch (error) {
    return {
      ok: false,
      status: "network_error",
      data: null,
      prices: [],
      error: error.message || "Network error contacting Finnhub candle endpoint.",
    };
  }
}

function getFallbackQuote(symbol, reason) {
  const fallback = FALLBACK_QUOTES[symbol];
  if (fallback) return { ...fallback, error: reason || null };

  const meta = COMPANY_META[symbol] || { companyName: symbol, sector: "Unknown", qualityScore: 0 };
  return {
    symbol,
    companyName: meta.companyName,
    sector: meta.sector,
    currentPrice: null,
    previousClose: null,
    change: null,
    changePercent: null,
    dayHigh: null,
    dayLow: null,
    open: null,
    timestamp: null,
    yearHigh: null,
    yearLow: null,
    percentOffHigh: null,
    qualityScore: meta.qualityScore,
    rating: "HOLD OFF",
    source: "unavailable",
    error: reason || "Quote unavailable.",
  };
}

async function buildQuote(symbol) {
  const meta = COMPANY_META[symbol] || { companyName: symbol, sector: "Unknown", qualityScore: 0 };
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  const diagnostics = {
    apiKeyDetected: Boolean(apiKey),
    finnhubQuoteStatus: "not_requested",
    finnhubCandleStatus: "not_requested",
    returnedSymbol: symbol,
    returnedDataCount: 0,
    friendlyErrorMessage: null,
  };

  const quoteResult = await fetchFinnhubQuote(symbol);
  diagnostics.finnhubQuoteStatus = String(quoteResult.status);

  if (!quoteResult.ok) {
    diagnostics.friendlyErrorMessage = quoteResult.error;
    return { quote: getFallbackQuote(symbol, quoteResult.error), diagnostics };
  }

  const currentPrice = round(quoteResult.data?.c);
  if (!Number.isFinite(currentPrice)) {
    const message = "Finnhub returned no current price.";
    diagnostics.friendlyErrorMessage = message;
    return { quote: getFallbackQuote(symbol, message), diagnostics };
  }

  const candleResult = await fetchFinnhubCandles(symbol);
  diagnostics.finnhubCandleStatus = String(candleResult.status);
  diagnostics.returnedDataCount = candleResult.prices?.length || 0;
  if (!candleResult.ok) diagnostics.friendlyErrorMessage = candleResult.error;

  const highs = (candleResult.prices || []).map((point) => point.high).filter(Number.isFinite);
  const lows = (candleResult.prices || []).map((point) => point.low).filter(Number.isFinite);
  const dayHigh = round(quoteResult.data?.h);
  const dayLow = round(quoteResult.data?.l);
  const yearHigh = highs.length ? round(Math.max(...highs)) : dayHigh;
  const yearLow = lows.length ? round(Math.min(...lows)) : dayLow;
  const previousClose = round(quoteResult.data?.pc);
  const change = round(quoteResult.data?.d);
  const changePercent = round(quoteResult.data?.dp);
  const percentOffHigh = yearHigh ? round(((currentPrice - yearHigh) / yearHigh) * 100) : null;

  return {
    quote: {
      symbol,
      companyName: meta.companyName,
      sector: meta.sector,
      currentPrice,
      previousClose,
      change,
      changePercent,
      dayHigh,
      dayLow,
      open: round(quoteResult.data?.o),
      timestamp: Number.isFinite(Number(quoteResult.data?.t)) ? Number(quoteResult.data.t) : null,
      yearHigh,
      yearLow,
      percentOffHigh,
      qualityScore: meta.qualityScore,
      rating: getRating(meta.qualityScore, percentOffHigh),
      source: "finnhub",
      error: candleResult.ok ? null : candleResult.error,
    },
    diagnostics,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      quotes: [],
      diagnostics: {
        apiKeyDetected: Boolean(process.env.FINNHUB_API_KEY?.trim()),
        finnhubQuoteStatus: "not_requested",
        finnhubCandleStatus: "not_requested",
        returnedSymbol: null,
        returnedDataCount: 0,
        friendlyErrorMessage: "Method not allowed.",
      },
      error: "Method not allowed.",
    });
  }

  const symbols = parseSymbols(req);

  if (!symbols.length || symbols.some((symbol) => !/^[A-Z.]{1,12}$/.test(symbol))) {
    return res.status(200).json({
      ok: false,
      quotes: [],
      diagnostics: {
        apiKeyDetected: Boolean(process.env.FINNHUB_API_KEY?.trim()),
        finnhubQuoteStatus: "not_requested",
        finnhubCandleStatus: "not_requested",
        returnedSymbol: null,
        returnedDataCount: 0,
        friendlyErrorMessage: "Provide a valid symbol or symbols query, such as MSFT.",
      },
      error: "Provide a valid symbol or symbols query, such as MSFT.",
    });
  }

  const results = await Promise.all(symbols.map(buildQuote));
  const quotes = results.map((result) => result.quote);
  const diagnosticsBySymbol = Object.fromEntries(results.map((result) => [result.quote.symbol, result.diagnostics]));
  const firstDiagnostics = results[0]?.diagnostics || null;
  const hasLiveQuote = quotes.some((quote) => quote.source === "finnhub");
  const firstError = quotes.find((quote) => quote.source !== "finnhub" && quote.error)?.error || null;

  return res.status(200).json({
    ok: hasLiveQuote,
    quotes,
    diagnostics: {
      ...firstDiagnostics,
      symbols: diagnosticsBySymbol,
    },
    error: hasLiveQuote ? null : firstError || "Finnhub quote data is unavailable.",
    updatedAt: new Date().toISOString(),
  });
}
