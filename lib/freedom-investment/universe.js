export const INVESTMENT_UNIVERSE = [
  { symbol: "MSFT", companyName: "Microsoft", sector: "Software", country: "United States", currency: "USD" },
  { symbol: "AAPL", companyName: "Apple", sector: "Consumer Technology", country: "United States", currency: "USD" },
  { symbol: "GOOGL", companyName: "Alphabet", sector: "Digital Advertising & AI", country: "United States", currency: "USD" },
  { symbol: "AMZN", companyName: "Amazon", sector: "Cloud & E-commerce", country: "United States", currency: "USD" },
  { symbol: "NVDA", companyName: "NVIDIA", sector: "Semiconductors", country: "United States", currency: "USD" },
  { symbol: "META", companyName: "Meta Platforms", sector: "Digital Platforms", country: "United States", currency: "USD" },
  { symbol: "V", companyName: "Visa", sector: "Payments", country: "United States", currency: "USD" },
  { symbol: "MA", companyName: "Mastercard", sector: "Payments", country: "United States", currency: "USD" },
  { symbol: "COST", companyName: "Costco Wholesale", sector: "Consumer Defensive", country: "United States", currency: "USD" },
  { symbol: "AVGO", companyName: "Broadcom", sector: "Semiconductors", country: "United States", currency: "USD" },
  { symbol: "JPM", companyName: "JPMorgan Chase", sector: "Financial Services", country: "United States", currency: "USD" },
  { symbol: "UNH", companyName: "UnitedHealth Group", sector: "Healthcare", country: "United States", currency: "USD" },
  { symbol: "JNJ", companyName: "Johnson & Johnson", sector: "Healthcare", country: "United States", currency: "USD" },
  { symbol: "PG", companyName: "Procter & Gamble", sector: "Consumer Defensive", country: "United States", currency: "USD" },
  { symbol: "HD", companyName: "Home Depot", sector: "Consumer Cyclical", country: "United States", currency: "USD" },
  { symbol: "ASML", companyName: "ASML Holding", sector: "Semiconductor Equipment", country: "Netherlands", currency: "USD" },
  { symbol: "TSM", companyName: "Taiwan Semiconductor", sector: "Semiconductors", country: "Taiwan", currency: "USD" },
  { symbol: "NESN.SW", companyName: "Nestle", sector: "Consumer Defensive", country: "Switzerland", currency: "CHF" },
  { symbol: "CSL.AX", companyName: "CSL", sector: "Healthcare", country: "Australia", currency: "AUD" },
  { symbol: "CBA.AX", companyName: "Commonwealth Bank", sector: "Financial Services", country: "Australia", currency: "AUD" },
];

export function supportedInvestmentUniverse() {
  return INVESTMENT_UNIVERSE;
}

export function resolveInvestmentUniverse(input = {}) {
  const requested = Array.isArray(input.symbols)
    ? input.symbols
    : String(input.symbols || "").split(",");
  const symbols = requested.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean);
  const universe = supportedInvestmentUniverse();
  if (!symbols.length) return universe;
  const bySymbol = new Map(universe.map((row) => [row.symbol, row]));
  return symbols.map((symbol) => bySymbol.get(symbol) || { symbol, companyName: symbol, sector: "Unknown", country: null, currency: "USD" });
}
