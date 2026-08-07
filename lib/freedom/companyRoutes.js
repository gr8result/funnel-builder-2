export const ASX_TICKER_ALIASES = {
  CBA: "CBA.AX",
  BHP: "BHP.AX",
  CSL: "CSL.AX",
};

export const SUPPORTED_COMPANY_META = {
  AAPL: { companyName: "Apple", symbol: "AAPL", sector: "Technology", qualityScore: 94, exchange: "NASDAQ", currency: "USD" },
  MSFT: { companyName: "Microsoft", symbol: "MSFT", sector: "Software", qualityScore: 96, exchange: "NASDAQ", currency: "USD" },
  AVGO: { companyName: "Broadcom", symbol: "AVGO", sector: "Semiconductors", qualityScore: 92, exchange: "NASDAQ", currency: "USD" },
  NVDA: { companyName: "NVIDIA", symbol: "NVDA", sector: "Semiconductors", qualityScore: 94, exchange: "NASDAQ", currency: "USD" },
  "CBA.AX": { companyName: "Commonwealth Bank", symbol: "CBA.AX", sector: "Financials", qualityScore: 88, exchange: "ASX", currency: "AUD" },
  "BHP.AX": { companyName: "BHP Group", symbol: "BHP.AX", sector: "Materials", qualityScore: 87, exchange: "ASX", currency: "AUD" },
  "CSL.AX": { companyName: "CSL", symbol: "CSL.AX", sector: "Healthcare", qualityScore: 89, exchange: "ASX", currency: "AUD" },
};

export function normalizeCompanyTicker(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  try {
    return decodeURIComponent(String(raw || "")).trim().replace(/\s+/g, "").toUpperCase();
  } catch {
    return String(raw || "").trim().replace(/\s+/g, "").toUpperCase();
  }
}

export function canonicalCompanyTicker(value) {
  const normalized = normalizeCompanyTicker(value);
  return ASX_TICKER_ALIASES[normalized] || normalized;
}

export function isValidCompanyTicker(value) {
  return /^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(canonicalCompanyTicker(value));
}

export function investmentCompanyHref(value, query = "") {
  const suffix = query ? `?${String(query).replace(/^\?/, "")}` : "";
  return `/freedom/company/${encodeURIComponent(canonicalCompanyTicker(value))}${suffix}`;
}

export function traderCompanyHref(value, query = "") {
  const suffix = query ? `?${String(query).replace(/^\?/, "")}` : "";
  return `/freedom-trader/company/${encodeURIComponent(canonicalCompanyTicker(value))}${suffix}`;
}

export function companyMeta(value, fallback = {}) {
  const symbol = canonicalCompanyTicker(value);
  return SUPPORTED_COMPANY_META[symbol] || { symbol, companyName: symbol, sector: "Unknown", qualityScore: 0, ...fallback };
}
