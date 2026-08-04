const WATCHLIST = [
  { symbol: "MSFT", companyName: "Microsoft", exchange: "NASDAQ", sector: "Software" },
  { symbol: "AAPL", companyName: "Apple", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "AVGO", companyName: "Broadcom", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "NVDA", companyName: "NVIDIA", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "CBA.AX", companyName: "Commonwealth Bank", exchange: "ASX", sector: "Financials" },
  { symbol: "BHP.AX", companyName: "BHP Group", exchange: "ASX", sector: "Materials" },
  { symbol: "CSL.AX", companyName: "CSL", exchange: "ASX", sector: "Healthcare" },
  { symbol: "AMD", companyName: "Advanced Micro Devices", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "TSLA", companyName: "Tesla", exchange: "NASDAQ", sector: "EV & Energy" },
  { symbol: "PLTR", companyName: "Palantir", exchange: "NASDAQ", sector: "AI Software" },
  { symbol: "META", companyName: "Meta Platforms", exchange: "NASDAQ", sector: "Digital Advertising & AI" },
  { symbol: "AMZN", companyName: "Amazon", exchange: "NASDAQ", sector: "Cloud & E-commerce" },
  { symbol: "SMCI", companyName: "Super Micro Computer", exchange: "NASDAQ", sector: "AI Infrastructure" },
  { symbol: "COIN", companyName: "Coinbase", exchange: "NASDAQ", sector: "Crypto Infrastructure" },
  { symbol: "MSTR", companyName: "MicroStrategy", exchange: "NASDAQ", sector: "Bitcoin Treasury" },
];

export const TRADER_WATCHLIST = WATCHLIST;

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, watchlist: [], error: "Method not allowed." });
  }

  return res.status(200).json({
    ok: true,
    watchlist: WATCHLIST,
    count: WATCHLIST.length,
    updatedAt: new Date().toISOString(),
  });
}
