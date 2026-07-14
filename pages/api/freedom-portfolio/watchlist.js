const STARTING_WATCHLIST = [
  { symbol: "MSFT", company: "Microsoft", sector: "Technology" },
  { symbol: "NVDA", company: "NVIDIA", sector: "Semiconductors" },
  { symbol: "V", company: "Visa", sector: "Financial Services" },
  { symbol: "AMZN", company: "Amazon", sector: "Consumer Discretionary" },
  { symbol: "COST", company: "Costco Wholesale", sector: "Consumer Staples" },
  { symbol: "GOOGL", company: "Alphabet", sector: "Communication Services" },
  { symbol: "AVGO", company: "Broadcom", sector: "Semiconductors" },
  { symbol: "MA", company: "Mastercard", sector: "Financial Services" },
  { symbol: "ASML", company: "ASML Holding", sector: "Semiconductors" },
  { symbol: "TSM", company: "Taiwan Semiconductor", sector: "Semiconductors" },
];

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

async function getWatchlistQuote(item) {
  const [quote, metrics] = await Promise.all([
    fetchFinnhubJson("quote", { symbol: item.symbol }),
    fetchFinnhubJson("stock/metric", { symbol: item.symbol, metric: "all" }),
  ]);

  if (!quote || !Number.isFinite(Number(quote.c)) || Number(quote.c) <= 0) {
    throw new Error(`No quote data returned for ${item.symbol}.`);
  }

  const metric = metrics?.metric || {};
  const currentPrice = roundNumber(quote.c);
  const weekHigh = roundNumber(metric["52WeekHigh"] || quote.h);
  const weekLow = roundNumber(metric["52WeekLow"] || quote.l);
  const percentOffHigh =
    currentPrice && weekHigh ? roundNumber(((weekHigh - currentPrice) / weekHigh) * 100) : null;
  const score = calculateScore(currentPrice, weekHigh, weekLow);

  return {
    ...item,
    ticker: item.symbol,
    currentPrice,
    weekHigh,
    weekLow,
    percentOffHigh,
    score,
    rating: getRating(score),
    previousClose: roundNumber(quote.pc),
    updatedAt: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const settledQuotes = await Promise.allSettled(STARTING_WATCHLIST.map(getWatchlistQuote));
    const watchlist = settledQuotes
      .map((result, index) => {
        if (result.status === "fulfilled") return result.value;

        console.error(`Freedom Portfolio watchlist quote error for ${STARTING_WATCHLIST[index].symbol}:`, result.reason);
        return {
          ...STARTING_WATCHLIST[index],
          ticker: STARTING_WATCHLIST[index].symbol,
          currentPrice: null,
          weekHigh: null,
          weekLow: null,
          percentOffHigh: null,
          score: null,
          rating: "Unavailable",
          error: "Quote unavailable",
        };
      });

    const pricedRows = watchlist.filter((item) => Number.isFinite(item.currentPrice));
    const averageScore = pricedRows.length
      ? roundNumber(
          pricedRows.reduce((total, item) => total + (item.score || 0), 0) / pricedRows.length,
          1
        )
      : null;
    const portfolioValue = roundNumber(
      pricedRows.reduce((total, item) => total + item.currentPrice, 0)
    );
    const topBuyOpportunity =
      pricedRows.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;

    return res.status(200).json({
      watchlist,
      summary: {
        portfolioValue,
        watchlistCount: watchlist.length,
        averageScore,
        topBuyOpportunity: topBuyOpportunity
          ? {
              company: topBuyOpportunity.company,
              ticker: topBuyOpportunity.ticker,
              score: topBuyOpportunity.score,
              rating: topBuyOpportunity.rating,
            }
          : null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Freedom Portfolio watchlist error:", error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 500 ? error.message : "Unable to load watchlist.",
    });
  }
}
