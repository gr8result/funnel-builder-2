import { supabaseAdmin } from "../supabaseAdmin.js";

export { supabaseAdmin };

export const FREEDOM_TABLES = {
  markets: {
    table: "markets",
    searchable: ["code", "name", "country", "currency"],
    orderBy: "code",
    ascending: true,
  },
  countries: {
    table: "countries",
    searchable: ["country", "currency", "primary_exchange"],
    orderBy: "country",
    ascending: true,
  },
  sectors: {
    table: "sectors",
    searchable: ["name", "gics_code"],
    orderBy: "name",
    ascending: true,
  },
  industries: {
    table: "industries",
    searchable: ["name", "gics_code"],
    orderBy: "name",
    ascending: true,
  },
  companies: {
    table: "companies",
    searchable: ["ticker", "symbol", "isin", "company_name", "short_name", "sector", "industry", "country"],
  },
  company_import_jobs: {
    table: "company_import_jobs",
    companyScoped: true,
    orderBy: "created_at",
    ascending: false,
  },
  company_competitors: {
    table: "company_competitors",
    companyScoped: true,
    orderBy: "created_at",
  },
  company_products: {
    table: "company_products",
    companyScoped: true,
    orderBy: "name",
    ascending: true,
  },
  revenue_segments: {
    table: "revenue_segments",
    companyScoped: true,
    orderBy: "period_end",
    ascending: false,
  },
  live_prices: {
    table: "live_prices",
    companyScoped: true,
    orderBy: "updated_at",
  },
  historical_prices: {
    table: "historical_prices",
    companyScoped: true,
    orderBy: "date",
    ascending: false,
  },
  financials: {
    table: "financials",
    companyScoped: true,
    orderBy: "fiscal_year",
    ascending: false,
  },
  earnings: {
    table: "earnings",
    companyScoped: true,
    orderBy: "quarter",
    ascending: false,
  },
  earnings_reports: {
    table: "earnings_reports",
    companyScoped: true,
    orderBy: "report_date",
    ascending: false,
  },
  analyst_estimates: {
    table: "analyst_estimates",
    companyScoped: true,
    orderBy: "period_end",
    ascending: false,
  },
  valuation_models: {
    table: "valuation_models",
    companyScoped: true,
    orderBy: "updated_at",
  },
  valuation_methods: {
    table: "valuation_methods",
    companyScoped: true,
    orderBy: "updated_at",
  },
  valuation_method_outputs: {
    table: "valuation_method_outputs",
    companyScoped: true,
    orderBy: "valuation_date",
    ascending: false,
  },
  company_scores: {
    table: "company_scores",
    companyScoped: true,
    orderBy: "last_updated",
  },
  freedom250: {
    table: "freedom250",
    companyScoped: true,
    orderBy: "rank",
    ascending: true,
  },
  research_notes: {
    table: "research_notes",
    companyScoped: true,
    orderBy: "last_updated",
  },
  ai_research_reports: {
    table: "ai_research_reports",
    companyScoped: true,
    orderBy: "updated_at",
  },
  committee_reviews: {
    table: "committee_reviews",
    companyScoped: true,
    orderBy: "updated_at",
  },
  technical_analysis: {
    table: "technical_analysis",
    companyScoped: true,
    orderBy: "analysis_date",
    ascending: false,
  },
  news_articles: {
    table: "news_articles",
    companyScoped: true,
    orderBy: "published_at",
    ascending: false,
    searchable: ["headline", "summary", "source"],
  },
  watchlists: {
    table: "watchlists",
    orderBy: "updated_at",
  },
  watchlist_items: {
    table: "watchlist_items",
    companyScoped: true,
    orderBy: "created_at",
  },
  alerts: {
    table: "alerts",
    companyScoped: true,
    orderBy: "created_at",
  },
  portfolios: {
    table: "portfolios",
    orderBy: "updated_at",
  },
  portfolio: {
    table: "portfolio",
    orderBy: "updated_at",
  },
  portfolio_holdings: {
    table: "portfolio_holdings",
    companyScoped: true,
    orderBy: "updated_at",
  },
  transactions: {
    table: "transactions",
    companyScoped: true,
    orderBy: "transaction_date",
    ascending: false,
  },
  cash_balance: {
    table: "cash_balance",
    orderBy: "updated_at",
  },
  performance_history: {
    table: "performance_history",
    orderBy: "date",
    ascending: false,
  },
  company_documents: {
    table: "company_documents",
    companyScoped: true,
    orderBy: "published_at",
    ascending: false,
    searchable: ["title", "document_type", "source"],
  },
  background_jobs: {
    table: "background_jobs",
    orderBy: "updated_at",
  },
};

export function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

export const normalizeSymbol = normalizeTicker;

export function isValidTicker(ticker) {
  return /^[A-Z0-9.\-:]{1,20}$/.test(ticker);
}

export const isValidSymbol = isValidTicker;

export function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

export function getRating(qualityScore, percentOffHigh) {
  if (qualityScore >= 95 && percentOffHigh <= -15) return "STRONG BUY";
  if (qualityScore >= 90 && percentOffHigh <= -10) return "BUY";
  if (qualityScore >= 90) return "WATCH";
  if (qualityScore >= 80) return "HOLD OFF";
  return "AVOID";
}

export async function findCompanyByTicker(ticker) {
  const normalized = normalizeTicker(ticker);
  if (!isValidTicker(normalized)) return null;

  let result = await supabaseAdmin.from("companies").select("*").eq("ticker", normalized).maybeSingle();

  if (result.error?.code === "42703") {
    result = await supabaseAdmin.from("companies").select("*").eq("symbol", normalized).maybeSingle();
  }

  if (result.error) throw result.error;
  return result.data || null;
}

export const findCompanyBySymbol = findCompanyByTicker;

export async function upsertCompany(company) {
  const ticker = normalizeTicker(company.ticker || company.symbol);
  if (!isValidTicker(ticker)) {
    const error = new Error("Invalid company ticker.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    ticker,
    symbol: ticker,
    exchange: company.exchange || null,
    isin: company.isin || null,
    company_name: company.company_name || company.companyName || ticker,
    short_name: company.short_name || company.shortName || company.company_name || company.companyName || ticker,
    sector: company.sector || null,
    industry: company.industry || null,
    country: company.country || null,
    currency: company.currency || "USD",
    description: company.description || null,
    website: company.website || company.web_url || company.webUrl || null,
    web_url: company.website || company.web_url || company.webUrl || null,
    logo_url: company.logo_url || company.logoUrl || company.logo || null,
    colour_primary: company.colour_primary || company.primaryColor || null,
    colour_secondary: company.colour_secondary || company.secondaryColor || null,
    colour_accent: company.colour_accent || company.accentColor || null,
    ceo: company.ceo || null,
    head_office: company.head_office || company.headOffice || null,
    market_cap: company.market_cap || company.marketCap || null,
    ipo_date: company.ipo_date || company.ipoDate || null,
    status: company.status || "active",
    employees: company.employees || null,
    is_active: company.is_active ?? true,
  };

  let result = await supabaseAdmin
    .from("companies")
    .upsert(payload, { onConflict: "ticker" })
    .select("*")
    .maybeSingle();

  if (result.error?.code === "42703" || result.error?.message?.includes("ticker")) {
    const legacyPayload = {
      symbol: ticker,
      company_name: payload.company_name,
      sector: payload.sector,
      industry: payload.industry,
      exchange: payload.exchange,
      country: payload.country,
      currency: payload.currency,
      isin: payload.isin,
      logo_url: payload.logo_url,
      web_url: payload.website,
      market_cap: payload.market_cap,
      ipo_date: payload.ipo_date,
      is_active: payload.is_active,
      source: company.source || "freedom-terminal",
      raw_profile: company.raw_profile || company.rawProfile || {},
    };

    result = await supabaseAdmin
      .from("companies")
      .upsert(legacyPayload, { onConflict: "symbol" })
      .select("*")
      .maybeSingle();
  }

  if (result.error) throw result.error;
  return result.data;
}

export const upsertCompanySeed = upsertCompany;

export async function ensureCompany(ticker) {
  const normalized = normalizeTicker(ticker);
  const existing = await findCompanyByTicker(normalized);
  if (existing) return existing;

  return upsertCompany({
    ticker: normalized,
    company_name: normalized,
    is_active: true,
  });
}

export async function getCompanyIdFromRequest({ companyId, ticker, symbol }) {
  if (companyId) return companyId;
  const normalized = normalizeTicker(ticker || symbol);
  if (!normalized) return null;
  const company = await ensureCompany(normalized);
  return company.id;
}

export async function getLatestQualityScore(companyId) {
  const { data, error } = await supabaseAdmin
    .from("company_scores")
    .select("overall_score")
    .eq("company_id", companyId)
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.overall_score || 0);
}

export function mapCompanyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticker: row.ticker || row.symbol,
    symbol: row.ticker || row.symbol,
    companyName: row.company_name,
    shortName: row.short_name,
    sector: row.sector,
    industry: row.industry,
    exchange: row.exchange,
    isin: row.isin,
    country: row.country,
    currency: row.currency,
    description: row.description,
    website: row.website || row.web_url,
    logoUrl: row.logo_url,
    primaryColor: row.colour_primary,
    secondaryColor: row.colour_secondary,
    accentColor: row.colour_accent,
    ceo: row.ceo,
    headOffice: row.head_office,
    marketCap: row.market_cap,
    employees: row.employees,
    ipoDate: row.ipo_date,
    status: row.status || (row.is_active ? "active" : "inactive"),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
