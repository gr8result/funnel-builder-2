import Link from "next/link";
import { useRouter } from "next/router";

const INVESTMENT_ITEMS = [
  { label: "Dashboard", href: "/freedom-investment", match: ["/freedom", "/freedom-investment"] },
  { label: "Watchlist", href: "/freedom-investment#watchlist" },
  { label: "Portfolio", href: "/freedom-investment#portfolio" },
  { label: "Company Research", href: "/freedom/company/MSFT", matchPrefix: "/freedom/company" },
];

const TRADER_ITEMS = [
  { label: "Dashboard", href: "/freedom-trader", match: ["/freedom-trader"] },
  { label: "Watchlist", href: "/freedom-trader#watchlist" },
  { label: "Scanner", href: "/freedom-trader/market-opportunities", match: ["/freedom-trader/market-opportunities"] },
  { label: "Alerts", href: "/freedom-trader/alerts", match: ["/freedom-trader/alerts"] },
  { label: "Portfolio", href: "/freedom-trader/portfolio", match: ["/freedom-trader/portfolio", "/freedom-trader/positions"] },
  { label: "Trade History", href: "/freedom-trader/trades", match: ["/freedom-trader/trades"] },
  { label: "Settings", href: "/freedom-trader/settings", match: ["/freedom-trader/settings"] },
];

function isActive(item, path) {
  if (item.matchPrefix && path.startsWith(item.matchPrefix)) return true;
  if (item.match?.includes(path)) return true;
  return path === item.href;
}

export default function FreedomModuleNav({ module = "trader", paper = false }) {
  const router = useRouter();
  const path = router.pathname;
  const isTrader = module === "trader";
  const items = isTrader ? TRADER_ITEMS : INVESTMENT_ITEMS;

  return (
    <nav className="freedomModuleNav" aria-label={`${isTrader ? "Freedom Trader" : "Freedom Investment"} navigation`}>
      <div className="freedomModuleNavTop">
        <Link className={!isTrader ? "active" : ""} href="/freedom-investment">Freedom Investment</Link>
        <Link className={isTrader ? "active" : ""} href="/freedom-trader">Freedom Trader</Link>
        {paper ? <span className="paperWarning">PAPER TRADING - NO REAL MONEY</span> : null}
      </div>
      <div className="freedomModuleNavItems">
        {items.map((item) => (
          <Link className={isActive(item, path) ? "active" : ""} href={item.href} key={item.label}>
            {item.label}
          </Link>
        ))}
      </div>
      <style jsx>{`
        .freedomModuleNav {
          background: rgba(8, 14, 17, 0.95);
          border: 1px solid rgba(179, 199, 207, 0.16);
          border-radius: 8px;
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.22);
          display: grid;
          gap: 10px;
          margin: 0 auto 18px;
          max-width: 1840px;
          padding: 12px;
        }
        .freedomModuleNavTop,
        .freedomModuleNavItems {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        a,
        .paperWarning {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          min-height: 34px;
          padding: 0 13px;
          text-decoration: none;
        }
        a {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d8e5ea;
        }
        a.active {
          background: #0057d9;
          border-color: #0057d9;
          color: #fff;
        }
        .freedomModuleNavItems a.active {
          background: #ff9900;
          border-color: #ff9900;
          color: #061014;
        }
        .paperWarning {
          background: rgba(255, 153, 0, 0.14);
          border: 1px solid rgba(255, 153, 0, 0.38);
          color: #ffd7a1;
          margin-left: auto;
        }
        @media (max-width: 760px) {
          .paperWarning {
            margin-left: 0;
          }
        }
      `}</style>
    </nav>
  );
}
