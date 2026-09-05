// Freedom trader watchlist data (B2).
//
// This list previously lived inside pages/api/freedom-trader/watchlist.js, and
// lib/freedom-trader/marketData.js imported it from there - a library reaching
// into a Next.js API route. That inverts the dependency direction, ties the
// library to the routing layer, and breaks any standalone Freedom build, since
// the route cannot exist without Next.
//
// The data now lives here and both the route and the library import it. Per
// PLATFORM_MODULARISATION_MASTER_PLAN.md this is the destination the Freedom
// module package (modules/freedom/data/) will keep after M5C.

export const TRADER_WATCHLIST = [
  { symbol: "NVDA", companyName: "NVIDIA", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "AMD", companyName: "Advanced Micro Devices", exchange: "NASDAQ", sector: "Semiconductors" },
  { symbol: "TSLA", companyName: "Tesla", exchange: "NASDAQ", sector: "EV & Energy" },
  { symbol: "PLTR", companyName: "Palantir", exchange: "NASDAQ", sector: "AI Software" },
  { symbol: "META", companyName: "Meta Platforms", exchange: "NASDAQ", sector: "Digital Advertising & AI" },
  { symbol: "AMZN", companyName: "Amazon", exchange: "NASDAQ", sector: "Cloud & E-commerce" },
  { symbol: "SMCI", companyName: "Super Micro Computer", exchange: "NASDAQ", sector: "AI Infrastructure" },
  { symbol: "COIN", companyName: "Coinbase", exchange: "NASDAQ", sector: "Crypto Infrastructure" },
  { symbol: "MSTR", companyName: "MicroStrategy", exchange: "NASDAQ", sector: "Bitcoin Treasury" },
  { symbol: "AVGO", companyName: "Broadcom", exchange: "NASDAQ", sector: "Semiconductors" },
];
