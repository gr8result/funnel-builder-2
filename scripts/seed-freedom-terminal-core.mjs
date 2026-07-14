import { createClient } from "@supabase/supabase-js";

const STARTING_COMPANIES = [
  { symbol: "MSFT", companyName: "Microsoft", sector: "Software", industry: "Cloud Software", qualityScore: 96 },
  { symbol: "NVDA", companyName: "NVIDIA", sector: "Semiconductors", industry: "Graphics & AI Semiconductors", qualityScore: 94 },
  { symbol: "V", companyName: "Visa", sector: "Payments", industry: "Payment Networks", qualityScore: 95 },
  { symbol: "AMZN", companyName: "Amazon", sector: "Cloud & E-commerce", industry: "Cloud Infrastructure & E-commerce", qualityScore: 93 },
  { symbol: "COST", companyName: "Costco", sector: "Consumer Defensive", industry: "Warehouse Retail", qualityScore: 92 },
  { symbol: "GOOGL", companyName: "Alphabet", sector: "Digital Advertising & AI", industry: "Internet Content & Information", qualityScore: 93 },
  { symbol: "AVGO", companyName: "Broadcom", sector: "Semiconductors", industry: "Semiconductor Infrastructure", qualityScore: 92 },
  { symbol: "MA", companyName: "Mastercard", sector: "Payments", industry: "Payment Networks", qualityScore: 94 },
  { symbol: "ASML", companyName: "ASML", sector: "Semiconductor Equipment", industry: "Semiconductor Equipment", qualityScore: 91 },
  { symbol: "TSM", companyName: "Taiwan Semiconductor", sector: "Semiconductors", industry: "Foundry Semiconductors", qualityScore: 92 },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

async function fetchFinnhub(path, params) {
  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  Object.entries({ ...params, token: requiredEnv("FINNHUB_API_KEY") }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new Error("Finnhub rate limit reached while seeding live data.");
  }

  if (!response.ok) {
    throw new Error(data?.error || `Finnhub request failed with status ${response.status}.`);
  }

  return data;
}

async function fetchOneYearHistory(symbol) {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const candles = await fetchFinnhub("stock/candle", {
    symbol,
    resolution: "D",
    from: unixSeconds(from),
    to: unixSeconds(to),
  });

  if (candles?.s !== "ok" || !Array.isArray(candles.c)) return [];

  return candles.c
    .map((close, index) => ({
      close: round(close),
      high: round(candles.h?.[index]),
      low: round(candles.l?.[index]),
      date: candles.t?.[index] ? new Date(candles.t[index] * 1000).toISOString().slice(0, 10) : null,
    }))
    .filter((point) => point.date && Number.isFinite(point.close));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);

  for (const [index, seed] of STARTING_COMPANIES.entries()) {
    const profile = await fetchFinnhub("stock/profile2", { symbol: seed.symbol }).catch(() => null);
    const companyPayload = {
      symbol: seed.symbol,
      company_name: profile?.name || seed.companyName,
      sector: profile?.finnhubIndustry || seed.sector,
      industry: seed.industry,
      exchange: profile?.exchange || null,
      country: profile?.country || null,
      currency: profile?.currency || "USD",
      market_cap: round(profile?.marketCapitalization),
      logo_url: profile?.logo || null,
      web_url: profile?.weburl || null,
      ipo_date: profile?.ipo || null,
      source: "finnhub",
      raw_profile: profile || {},
    };

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .upsert(companyPayload, { onConflict: "symbol" })
      .select("*")
      .maybeSingle();

    if (companyError) throw companyError;

    await supabase.from("watchlists").upsert(
      {
        company_id: company.id,
        watchlist_name: "Core Watchlist",
        position: index + 1,
        is_active: true,
      },
      { onConflict: "company_id,watchlist_name" }
    );

    await supabase.from("industry_scores").upsert(
      {
        company_id: company.id,
        quality_score: seed.qualityScore,
        score_date: today,
        notes: "Initial Freedom Terminal quality score",
      },
      { onConflict: "company_id,score_date" }
    );

    const [quote, metrics, history] = await Promise.all([
      fetchFinnhub("quote", { symbol: seed.symbol }).catch(() => null),
      fetchFinnhub("stock/metric", { symbol: seed.symbol, metric: "all" }).catch(() => null),
      fetchOneYearHistory(seed.symbol).catch(() => []),
    ]);

    const currentPrice = round(quote?.c);
    const previousClose = round(quote?.pc);
    const highs = history.map((point) => point.high).filter(Number.isFinite);
    const lows = history.map((point) => point.low).filter(Number.isFinite);
    const yearHigh = round(metrics?.metric?.["52WeekHigh"]) || (highs.length ? round(Math.max(...highs)) : null);
    const yearLow = round(metrics?.metric?.["52WeekLow"]) || (lows.length ? round(Math.min(...lows)) : null);

    if (currentPrice) {
      await supabase.from("live_prices").upsert(
        {
          company_id: company.id,
          current_price: currentPrice,
          previous_close: previousClose,
          change: round(quote?.d),
          change_percent: round(quote?.dp),
          day_high: round(quote?.h),
          day_low: round(quote?.l),
          open_price: round(quote?.o),
          year_high: yearHigh,
          year_low: yearLow,
          price_timestamp: quote?.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
          provider: "finnhub",
          raw_quote: quote || {},
        },
        { onConflict: "company_id,provider" }
      );
    }

    if (metrics?.metric) {
      await supabase.from("financial_metrics").upsert(
        {
          company_id: company.id,
          metric_date: today,
          fiscal_period: "ttm",
          eps_ttm: round(metrics.metric.epsTTM),
          pe_ttm: round(metrics.metric.peTTM),
          ps_ttm: round(metrics.metric.psTTM),
          dividend_yield: round(metrics.metric.currentDividendYieldTTM),
          metrics: metrics.metric,
          provider: "finnhub",
        },
        { onConflict: "company_id,provider,metric_date,fiscal_period" }
      );
    }

    console.log(`Seeded ${seed.symbol}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
