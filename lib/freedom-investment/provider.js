function apiKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

async function fetchFinnhub(path, params = {}) {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "FINNHUB_API_KEY is not configured.", data: null, status: 0 };
  }
  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  Object.entries({ ...params, token: key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  });
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Freedom Investment" } });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, data, error: data?.error || `Finnhub request failed with status ${response.status}.` };
    return { ok: true, status: response.status, data, error: null };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error?.message || "Finnhub request failed." };
  }
}

export async function fetchInvestmentCompanyData(company = {}) {
  const symbol = String(company.symbol || "").toUpperCase();
  const [profileResult, quoteResult, metricsResult] = await Promise.all([
    fetchFinnhub("stock/profile2", { symbol }),
    fetchFinnhub("quote", { symbol }),
    fetchFinnhub("stock/metric", { symbol, metric: "all" }),
  ]);
  const quoteData = quoteResult.data || {};
  const currentPrice = round(quoteData.c);
  const profile = profileResult.data || {};
  const metrics = metricsResult.data?.metric || {};
  const warnings = [
    profileResult.ok ? null : `Profile unavailable: ${profileResult.error}`,
    quoteResult.ok ? null : `Quote unavailable: ${quoteResult.error}`,
    metricsResult.ok ? null : `Fundamentals unavailable: ${metricsResult.error}`,
    Number.isFinite(currentPrice) ? null : "Current price unavailable.",
  ].filter(Boolean);
  return {
    symbol,
    companyName: profile.name || company.companyName || symbol,
    sector: profile.finnhubIndustry || company.sector || "Unknown",
    country: profile.country || company.country || null,
    currency: profile.currency || company.currency || "USD",
    quote: {
      currentPrice,
      previousClose: round(quoteData.pc),
      change: round(quoteData.d),
      changePercent: round(quoteData.dp),
      timestamp: Number.isFinite(Number(quoteData.t)) ? Number(quoteData.t) : null,
    },
    metrics,
    profile,
    sourceStatus: {
      profile: profileResult.ok && Boolean(profile.name),
      quote: quoteResult.ok && Number.isFinite(currentPrice),
      fundamentals: metricsResult.ok && Object.keys(metrics).length > 0,
    },
    warnings,
  };
}

export function providerCapability() {
  return {
    provider: "Finnhub",
    hasApiKey: Boolean(apiKey()),
    supportsQuotes: true,
    supportsFundamentalMetrics: true,
    limitations: [
      "Financial metric availability varies by company and exchange.",
      "Forward estimates, dividend history and full historical valuation ranges are not guaranteed for every symbol.",
      "When fundamentals are unavailable, Freedom Investment returns DATA INSUFFICIENT instead of fabricating values.",
    ],
  };
}
