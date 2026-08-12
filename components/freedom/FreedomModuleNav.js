import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, Bell, Briefcase, Eye, FileClock, Home, LineChart, Search, Settings } from "lucide-react";

const INVESTMENT_ITEMS = [
  { label: "Dashboard", href: "/freedom-investment", match: ["/freedom", "/freedom-investment"], Icon: Home },
  { label: "Watchlist", href: "/freedom-investment#watchlist", Icon: Eye },
  { label: "Portfolio", href: "/freedom-investment#portfolio", Icon: Briefcase },
  { label: "Company Research", href: "/freedom/company/MSFT", matchPrefix: "/freedom/company", Icon: Search },
];

const TRADER_ITEMS = [
  { label: "Dashboard", href: "/freedom-trader", match: ["/freedom-trader"], Icon: Home },
  { label: "Watchlist", href: "/freedom-trader#watchlist", Icon: Eye },
  { label: "Market Opportunities", href: "/freedom-trader/market-opportunities", match: ["/freedom-trader/market-opportunities"], Icon: LineChart },
  { label: "Alerts", href: "/freedom-trader/alerts", match: ["/freedom-trader/alerts"], Icon: Bell },
  { label: "Portfolio", href: "/freedom-trader/portfolio", match: ["/freedom-trader/portfolio", "/freedom-trader/positions"], Icon: Briefcase },
  { label: "Trade History", href: "/freedom-trader/trades", match: ["/freedom-trader/trades"], Icon: FileClock },
  { label: "Settings", href: "/freedom-trader/settings", match: ["/freedom-trader/settings"], Icon: Settings },
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
    <nav className={`freedomModuleNav ${isTrader ? "traderNav" : "investmentNav"}`} aria-label={`${isTrader ? "Freedom Trader" : "Freedom Investment"} navigation`}>
      <div className="freedomModuleNavTop">
        <Link className={!isTrader ? "active investmentActive" : ""} href="/freedom-investment" aria-current={!isTrader ? "page" : undefined}><BarChart3 aria-hidden="true" size={15} strokeWidth={2.4} />Freedom Investment</Link>
        <Link className={isTrader ? "active traderActive" : ""} href="/freedom-trader" aria-current={isTrader ? "page" : undefined}><LineChart aria-hidden="true" size={15} strokeWidth={2.4} />Freedom Trader</Link>
        {paper ? <span className="paperWarning">PAPER TRADING - NO REAL MONEY</span> : null}
      </div>
      <div className="freedomModuleNavItems">
        {items.map((item) => {
          const active = isActive(item, path);
          const Icon = item.Icon;
          return (
          <Link className={active ? "active" : ""} href={item.href} key={item.label} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" size={15} strokeWidth={2.4} />
            <span>{item.label}</span>
          </Link>
          );
        })}
      </div>
      <style jsx global>{`
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
          gap: 9px;
        }
        .freedomModuleNav a,
        .freedomModuleNav .paperWarning {
          align-items: center;
          border-radius: 8px;
          display: inline-flex;
          gap: 8px;
          font-size: 13px;
          font-weight: 950;
          justify-content: center;
          line-height: 1;
          min-height: 40px;
          padding: 0 16px;
          text-decoration: none;
          transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, transform 0.16s ease;
          white-space: nowrap;
        }
        .freedomModuleNav a {
          background: rgba(255, 255, 255, 0.065);
          border: 1px solid rgba(216, 229, 234, 0.22);
          color: #d8e5ea;
        }
        .freedomModuleNav a:hover {
          background: rgba(255, 255, 255, 0.105);
          border-color: rgba(216, 229, 234, 0.42);
          color: #fff;
          transform: translateY(-1px);
        }
        .freedomModuleNav a:focus-visible {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22), 0 0 0 5px rgba(0, 87, 217, 0.48);
          outline: none;
        }
        .freedomModuleNav a.traderActive {
          background: #0057d9;
          border-color: #0057d9;
          color: #fff;
        }
        .freedomModuleNav a.investmentActive {
          background: #18a058;
          border-color: #18a058;
          color: #fff;
        }
        .traderNav .freedomModuleNavItems a.active {
          background: #0057d9;
          border-color: #5ebdff;
          box-shadow: 0 0 0 1px rgba(94, 189, 255, 0.24), 0 10px 24px rgba(0, 87, 217, 0.25);
          color: #fff;
        }
        .investmentNav .freedomModuleNavItems a.active {
          background: #18a058;
          border-color: #62d88f;
          box-shadow: 0 0 0 1px rgba(98, 216, 143, 0.24), 0 10px 24px rgba(24, 160, 88, 0.23);
          color: #fff;
        }
        .freedomModuleNav .paperWarning {
          background: rgba(255, 153, 0, 0.14);
          border: 1px solid rgba(255, 153, 0, 0.38);
          color: #ffd7a1;
          margin-left: auto;
        }
        @media (max-width: 760px) {
          .freedomModuleNav {
            padding: 10px;
          }
          .freedomModuleNavTop,
          .freedomModuleNavItems {
            gap: 8px;
          }
          .freedomModuleNav a,
          .freedomModuleNav .paperWarning {
            min-height: 38px;
            padding: 0 12px;
          }
          .freedomModuleNav .paperWarning {
            margin-left: 0;
          }
        }
      `}</style>
    </nav>
  );
}
