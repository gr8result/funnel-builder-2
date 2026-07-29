import Link from "next/link";
import { useRouter } from "next/router";

const INVESTMENT_ITEMS = [
  { icon: "🏠", label: "Dashboard", href: "/freedom-investment", match: ["/freedom", "/freedom-investment"] },
  { icon: "👁", label: "Watchlist", href: "/freedom-investment#watchlist" },
  { icon: "💼", label: "Portfolio", href: "/freedom-investment#portfolio" },
  { icon: "🔎", label: "Company Research", href: "/freedom/company/MSFT", matchPrefix: "/freedom/company" },
  { icon: "📒", label: "Trade Journal", href: "/freedom-trader/trade-journal", match: ["/freedom-trader/trade-journal"] },
];

const TRADER_ITEMS = [
  { icon: "🏠", label: "Dashboard", href: "/freedom-trader", match: ["/freedom-trader"] },
  { icon: "👁", label: "Watchlist", href: "/freedom-trader#watchlist" },
  { icon: "📊", label: "Market Opportunities", href: "/freedom-trader/market-opportunities", match: ["/freedom-trader/market-opportunities"] },
  { icon: "🔔", label: "Alerts", href: "/freedom-trader/alerts", match: ["/freedom-trader/alerts"] },
  { icon: "💼", label: "Portfolio", href: "/freedom-trader/portfolio", match: ["/freedom-trader/portfolio", "/freedom-trader/positions"] },
  { icon: "🧾", label: "Trade History", href: "/freedom-trader/trades", match: ["/freedom-trader/trades"] },
  { icon: "📒", label: "Trade Journal", href: "/freedom-trader/trade-journal", match: ["/freedom-trader/trade-journal"] },
  { icon: "⚙", label: "Settings", href: "/freedom-trader/settings", match: ["/freedom-trader/settings"] },
];

const TOP_ITEMS = [
  { icon: "📈", label: "Freedom Investment", href: "/freedom-investment", theme: "investment" },
  { icon: "⚡", label: "Freedom Trader", href: "/freedom-trader", theme: "trader" },
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
  const themeClass = isTrader ? "traderTheme" : "investmentTheme";

  return (
    <nav className={`freedomModuleNav ${themeClass}`} aria-label={`${isTrader ? "Freedom Trader" : "Freedom Investment"} navigation`}>
      <div className="freedomModuleNavTop">
        {TOP_ITEMS.map((item) => {
          const active = item.theme === "trader" ? isTrader : !isTrader;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`freedomNavButton ${active ? "active" : ""} ${item.theme}`}
              href={item.href}
              key={item.label}
              role="button"
            >
              <span className="freedomNavIcon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {paper ? <span className="paperWarning">PAPER TRADING - NO REAL MONEY</span> : null}
      </div>
      <div className="freedomModuleNavItems">
        {items.map((item) => (
          <Link
            aria-current={isActive(item, path) ? "page" : undefined}
            className={`freedomNavButton ${isActive(item, path) ? "active" : ""}`}
            href={item.href}
            key={item.label}
            role="button"
          >
            <span className="freedomNavIcon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
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
          gap: 10px;
        }
        :global(.freedomNavButton),
        .paperWarning {
          align-items: center;
          border-radius: 8px;
          box-sizing: border-box;
          display: inline-flex;
          flex: 0 0 auto;
          gap: 8px;
          font-size: 13px;
          font-weight: 950;
          justify-content: center;
          line-height: 1;
          min-height: 40px;
          padding: 0 15px;
          text-decoration: none;
          transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease;
        }
        :global(.freedomNavButton) {
          background: rgba(255, 255, 255, 0.09);
          border: 1px solid rgba(216, 229, 234, 0.24);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          color: #eef7fa;
        }
        :global(.freedomNavButton:hover) {
          background: rgba(29, 155, 255, 0.16);
          border-color: rgba(29, 155, 255, 0.44);
          color: #ffffff;
          transform: translateY(-1px);
        }
        .investmentTheme :global(.freedomNavButton:hover) {
          background: rgba(35, 209, 139, 0.16);
          border-color: rgba(35, 209, 139, 0.48);
        }
        :global(.freedomNavButton:focus-visible) {
          outline: 3px solid rgba(94, 189, 255, 0.64);
          outline-offset: 2px;
        }
        :global(.freedomNavButton.active) {
          background: #0057d9;
          border-color: #0057d9;
          color: #fff;
        }
        .investmentTheme :global(.freedomNavButton.active),
        :global(.freedomNavButton.investment.active) {
          background: #12845a;
          border-color: #23d18b;
          color: #ffffff;
        }
        .traderTheme .freedomModuleNavItems :global(.freedomNavButton.active),
        :global(.freedomNavButton.trader.active) {
          background: #0057d9;
          border-color: #0057d9;
          color: #fff;
        }
        :global(.freedomNavIcon) {
          display: inline-flex;
          font-size: 15px;
          line-height: 1;
        }
        .paperWarning {
          background: rgba(255, 153, 0, 0.14);
          border: 1px solid rgba(255, 153, 0, 0.38);
          color: #ffd7a1;
        }
        @media (max-width: 720px) {
          .freedomModuleNavTop,
          .freedomModuleNavItems {
            gap: 8px;
          }
          :global(.freedomNavButton),
          .paperWarning {
            min-height: 40px;
            padding: 0 13px;
          }
        }
      `}</style>
    </nav>
  );
}
