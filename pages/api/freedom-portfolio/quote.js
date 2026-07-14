const COMPANY_PROFILES = {
  MSFT: { company: "Microsoft", sector: "Technology" },
  NVDA: { company: "NVIDIA", sector: "Semiconductors" },
  V: { company: "Visa", sector: "Financial Services" },
  AMZN: { company: "Amazon", sector: "Consumer Discretionary" },
  COST: { company: "Costco Wholesale", sector: "Consumer Staples" },
  GOOGL: { company: "Alphabet", sector: "Communication Services" },
  AVGO: { company: "Broadcom", sector: "Semiconductors" },
  MA: { company: "Mastercard", sector: "Financial Services" },
  ASML: { company: "ASML Holding", sector: "Semiconductors" },
  TSM: { company: "Taiwan Semiconductor", sector: "Semiconductors" },
};

function roundNumber(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(decimals));
}

function calculateScore(currentPrice, weekHigh, weekLow) {
  if (!currentPrice || !weekHigh || !weekLow || weekHigh <= weekLow) return 50;

  const discountFromHigh = Math.max(0, ((weekHigh - currentPrice) / weekHigh) * 100);
  const rangePosition = Math.max(0, Math.min(1, (currentPrice - weekLow) / (weekHigh - weekLow)));
  const discountScore = Math.min(45, discountFromHigh * 1.5);
  const rangeScore = (1 - rangePosition) * 35;
  const qualityScore = 20;

  return Math.round(Math.max(0, Math.min(100, qualityScore + discountScore + rangeScore)));
}

function getRating(score) {
  if (score >= 95) return "Strong Buy";
  if (score >= 85) return "Buy";
  if (score >= 70) return "Watch";
  if (score >= 60) return "Hold Off";
  return "Avoid";
}

async function fetchFinnhubJson(path, params) {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    const error = new Error("FINNHUB_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  Object.entries({ ...params, token: apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || "Finnhub request failed.");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function getQuote(symbol) {
  const normalizedSymbol = symbol.toUpperCase();
  const [quote, metrics] = await Promise.all([
    fetchFinnhubJson("quote", { symbol: normalizedSymbol }),
    fetchFinnhubJson("stock/metric", { symbol: normalizedSymbol, metric: "all" }),
  ]);

  if (!quote || !Number.isFinite(Number(quote.c)) || Number(quote.c) <= 0) {
    const error = new Error(`No quote data returned for ${normalizedSymbol}.`);
    error.statusCode = 404;
    throw error;
  }

  const metric = metrics?.metric || {};
  const currentPrice = roundNumber(quote.c);
  const weekHigh = roundNumber(metric["52WeekHigh"] || quote.h);
  const weekLow = roundNumber(metric["52WeekLow"] || quote.l);
  const percentOffHigh =
    currentPrice && weekHigh ? roundNumber(((weekHigh - currentPrice) / weekHigh) * 100) : null;
  const score = calculateScore(currentPrice, weekHigh, weekLow);
  const profile = COMPANY_PROFILES[normalizedSymbol] || {
    company: normalizedSymbol,
    sector: "Unknown",
  };

  return {
    symbol: normalizedSymbol,
    ticker: normalizedSymbol,
    company: profile.company,
    sector: profile.sector,
    currentPrice,
    weekHigh,
    weekLow,
    percentOffHigh,
    score,
    rating: getRating(score),
    previousClose: roundNumber(quote.pc),
    dayHigh: roundNumber(quote.h),
    dayLow: roundNumber(quote.l),
    updatedAt: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const symbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();

  if (!/^[A-Z.]{1,10}$/.test(normalizedSymbol)) {
    return res.status(400).json({ error: "A valid symbol query parameter is required." });
  }

  try {
    const quote = await getQuote(normalizedSymbol);
    return res.status(200).json({ quote });
  } catch (error) {
    console.error("Freedom Portfolio quote error:", error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 500 ? error.message : "Unable to fetch quote data.",
      detail: error.statusCode && error.statusCode < 500 ? error.message : undefined,
    });
  }
}
