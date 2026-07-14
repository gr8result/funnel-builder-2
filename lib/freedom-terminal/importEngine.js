import { normalizeTicker, round, supabaseAdmin, upsertCompany } from "./core.js";

function getFinnhubApiKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
}

function getSupabaseSourceError(error) {
  return error?.message || "Unable to save Freedom Terminal data.";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Freedom Terminal Internal Research Engine",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}.`);
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function fetchFinnhub(path, params) {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    const error = new Error("FINNHUB_API_KEY is missing on the server.");
    error.statusCode = 500;
    throw error;
  }

  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  Object.entries({ ...params, token: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  return fetchJson(url.toString());
}

export async function searchCompanies(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const payload = await fetchFinnhub("search", { q });
  return (payload?.result || [])
    .filter((item) => item?.symbol)
    .slice(0, 25)
    .map((item) => ({
      ticker: normalizeTicker(item.symbol),
      description: item.description || item.displaySymbol || item.symbol,
      displaySymbol: item.displaySymbol || item.symbol,
      type: item.type || null,
      source: "Finnhub",
    }));
}

export async function fetchYahooHistory(ticker, range = "10y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(
    range
  )}&interval=${encodeURIComponent(interval)}&events=history`;
  const payload = await fetchJson(url);
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};

  return timestamps
    .map((timestamp, index) => {
      const open = round(quote.open?.[index]);
      const high = round(quote.high?.[index]);
      const low = round(quote.low?.[index]);
      const close = round(quote.close?.[index]);
      if (![open, high, low, close].every(Number.isFinite)) return null;

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(Number(quote.volume?.[index])) ? Number(quote.volume[index]) : null,
        provider: "yahoo",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function previewCompany(ticker) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) throw new Error("Ticker is required.");

  const warnings = [];
  const [profile, quote, metrics, peers, estimates] = await Promise.all([
    fetchFinnhub("stock/profile2", { symbol: normalized }).catch((error) => {
      warnings.push(`Company profile unavailable: ${error.message}`);
      return null;
    }),
    fetchFinnhub("quote", { symbol: normalized }).catch((error) => {
      warnings.push(`Live quote unavailable: ${error.message}`);
      return null;
    }),
    fetchFinnhub("stock/metric", { symbol: normalized, metric: "all" }).catch((error) => {
      warnings.push(`Financial metrics unavailable: ${error.message}`);
      return null;
    }),
    fetchFinnhub("stock/peers", { symbol: normalized }).catch((error) => {
      warnings.push(`Competitor list unavailable: ${error.message}`);
      return [];
    }),
    fetchFinnhub("stock/eps-estimate", { symbol: normalized, freq: "quarterly" }).catch((error) => {
      warnings.push(`Analyst estimates unavailable: ${error.message}`);
      return null;
    }),
  ]);

  return {
    ticker: normalized,
    profile: profile || null,
    quote: quote || null,
    metrics: metrics?.metric || null,
    peers: Array.isArray(peers) ? peers.filter(Boolean).slice(0, 20) : [],
    estimates: estimates?.data || [],
    warnings,
    providerStatus: {
      profile: Boolean(profile),
      quote: Boolean(quote?.c),
      metrics: Boolean(metrics?.metric),
      peers: Array.isArray(peers) && peers.length > 0,
      analystEstimates: Array.isArray(estimates?.data) && estimates.data.length > 0,
    },
  };
}

async function insertHistoricalPrices(companyId, ticker, warnings) {
  const history = await fetchYahooHistory(ticker).catch((error) => {
    warnings.push(`Historical prices unavailable: ${error.message}`);
    return [];
  });

  for (let index = 0; index < history.length; index += 500) {
    const rows = history.slice(index, index + 500).map((row) => ({ ...row, company_id: companyId }));
    const { error } = await supabaseAdmin
      .from("historical_prices")
      .upsert(rows, { onConflict: "company_id,date,provider" });
    if (error) throw error;
  }

  return history.length;
}

export async function importCompany(ticker) {
  const normalized = normalizeTicker(ticker);
  const startedAt = new Date().toISOString();
  const preview = await previewCompany(normalized);
  const warnings = [...preview.warnings];
  const profile = preview.profile || {};
  const quote = preview.quote || {};
  const metrics = preview.metrics || {};

  const { data: job } = await supabaseAdmin
    .from("company_import_jobs")
    .insert({
      ticker: normalized,
      status: "running",
      provider_status: preview.providerStatus,
      warnings,
      started_at: startedAt,
    })
    .select("*")
    .maybeSingle();

  try {
    const company = await upsertCompany({
      ticker: normalized,
      exchange: profile.exchange || null,
      company_name: profile.name || normalized,
      short_name: profile.name || normalized,
      sector: profile.finnhubIndustry || null,
      industry: profile.finnhubIndustry || null,
      country: profile.country || null,
      currency: profile.currency || "USD",
      website: profile.weburl || null,
      logo_url: profile.logo || null,
      market_cap: round(profile.marketCapitalization),
      ipo_date: profile.ipo || null,
      status: "active",
      source: "finnhub",
      raw_profile: profile,
    });

    if (quote?.c) {
      const { error } = await supabaseAdmin.from("live_prices").upsert(
        {
          company_id: company.id,
          current_price: round(quote.c),
          previous_close: round(quote.pc),
          change: round(quote.d),
          change_percent: round(quote.dp),
          day_high: round(quote.h),
          day_low: round(quote.l),
          open_price: round(quote.o),
          price_timestamp: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
          provider: "finnhub",
          raw_quote: quote,
        },
        { onConflict: "company_id,provider" }
      );
      if (error) throw error;
    }

    if (metrics && Object.keys(metrics).length) {
      const { error } = await supabaseAdmin.from("financials").upsert(
        {
          company_id: company.id,
          period_end: new Date().toISOString().slice(0, 10),
          period_type: "ttm",
          eps: round(metrics.epsTTM),
          free_cash_flow: round(metrics.freeCashFlowPerShareTTM),
          revenue: round(metrics.revenuePerShareTTM),
          gross_margin: round(metrics.grossMarginTTM),
          operating_margin: round(metrics.operatingMarginTTM),
          net_margin: round(metrics.netProfitMarginTTM),
          return_on_equity: round(metrics.roeTTM),
          debt_to_equity: round(metrics["totalDebt/totalEquityQuarterly"]),
          raw_payload: metrics,
          provider: "finnhub",
        },
        { onConflict: "company_id,period_end,period_type,provider" }
      );
      if (error) throw error;
    }

    const historyCount = await insertHistoricalPrices(company.id, normalized, warnings);

    for (const peerTicker of preview.peers.filter((peer) => peer !== normalized)) {
      const { data: peerCompany, error: peerError } = await supabaseAdmin
        .from("companies")
        .upsert({ ticker: normalizeTicker(peerTicker), symbol: normalizeTicker(peerTicker), company_name: normalizeTicker(peerTicker), status: "candidate" }, { onConflict: "ticker" })
        .select("*")
        .maybeSingle();
      if (!peerError && peerCompany?.id) {
        await supabaseAdmin.from("company_competitors").upsert(
          {
            company_id: company.id,
            competitor_company_id: peerCompany.id,
            relationship_type: "peer",
            source: "finnhub",
          },
          { onConflict: "company_id,competitor_company_id" }
        );
      }
    }

    for (const estimate of preview.estimates.slice(0, 16)) {
      const { error } = await supabaseAdmin.from("analyst_estimates").upsert(
        {
          company_id: company.id,
          period_end: estimate.period || null,
          period_type: "quarterly",
          eps_avg: round(estimate.epsAvg),
          eps_high: round(estimate.epsHigh),
          eps_low: round(estimate.epsLow),
          revenue_avg: round(estimate.revenueAvg),
          revenue_high: round(estimate.revenueHigh),
          revenue_low: round(estimate.revenueLow),
          analyst_count: estimate.numberAnalysts || null,
          raw_payload: estimate,
          provider: "finnhub",
        },
        { onConflict: "company_id,provider,period_end,period_type" }
      );
      if (error) throw error;
    }

    if (job?.id) {
      await supabaseAdmin
        .from("company_import_jobs")
        .update({
          company_id: company.id,
          status: "completed",
          provider_status: { ...preview.providerStatus, historicalPrices: historyCount > 0 },
          warnings,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return {
      ok: true,
      company,
      imported: {
        profile: Boolean(preview.profile),
        liveQuote: Boolean(quote?.c),
        historicalPriceRows: historyCount,
        competitors: preview.peers.length,
        analystEstimateRows: preview.estimates.length,
      },
      warnings,
    };
  } catch (error) {
    if (job?.id) {
      await supabaseAdmin
        .from("company_import_jobs")
        .update({
          status: "failed",
          error_message: getSupabaseSourceError(error),
          warnings,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
    throw error;
  }
}
