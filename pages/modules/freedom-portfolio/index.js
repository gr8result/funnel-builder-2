import { useEffect, useMemo, useState } from "react";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return Number.isFinite(value) ? CURRENCY_FORMATTER.format(value) : "--";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : "--";
}

function formatScore(value) {
  return Number.isFinite(value) ? value : "--";
}

function ratingClass(rating) {
  const normalized = String(rating || "").toLowerCase();
  if (normalized.includes("strong")) return "strongBuy";
  if (normalized === "buy") return "buy";
  if (normalized === "watch") return "watch";
  if (normalized === "hold" || normalized === "hold off") return "holdOff";
  if (normalized === "sell") return "sell";
  if (normalized === "avoid") return "avoid";
  return "info";
}

function ratingLabel(rating) {
  return {
    strongBuy: "STRONG BUY",
    buy: "BUY",
    watch: "WATCH",
    holdOff: "HOLD OFF",
    avoid: "AVOID",
    sell: "SELL",
    info: "INFO",
  }[ratingClass(rating)];
}

function scoreClass(score) {
  if (score >= 95) return "strongBuy";
  if (score >= 85) return "buy";
  if (score >= 70) return "watch";
  if (score >= 60) return "holdOff";
  return "avoid";
}

export default function FreedomPortfolio() {
  const [watchlist, setWatchlist] = useState([]);
  const [summary, setSummary] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadWatchlist({ silent = false } = {}) {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const response = await fetch("/api/freedom-portfolio/watchlist");
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load Freedom Portfolio data.");
      }

      setWatchlist(data.watchlist || []);
      setSummary(data.summary || null);
      setUpdatedAt(data.updatedAt || null);
    } catch (err) {
      console.error("Freedom Portfolio load error:", err);
      setError(err.message || "Unable to load Freedom Portfolio data.");
      setWatchlist([]);
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadWatchlist();
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        label: "Portfolio Value",
        value: formatCurrency(summary?.portfolioValue),
        note: "Equal-weight tracking basket",
      },
      {
        label: "Watchlist Count",
        value: summary?.watchlistCount ?? "--",
        note: "High quality names monitored",
      },
      {
        label: "Average Score",
        value: formatScore(summary?.averageScore),
        note: "Higher scores indicate better discounts",
      },
      {
        label: "Top Buy Opportunity",
        value: summary?.topBuyOpportunity?.ticker || "--",
        note: summary?.topBuyOpportunity
          ? `${summary.topBuyOpportunity.rating} · Score ${summary.topBuyOpportunity.score}`
          : "Waiting for quote data",
      },
    ],
    [summary]
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Investment Dashboard</p>
          <h1>Freedom Portfolio</h1>
        </div>
        <div className="actions">
          <span className="timestamp">
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Live quote dashboard"}
          </span>
          <button type="button" onClick={() => loadWatchlist({ silent: true })} disabled={loading || refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <section className="alert" role="alert">
          <strong>Data unavailable</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="summaryGrid" aria-label="Portfolio summary">
        {summaryCards.map((card) => (
          <article className="summaryCard" key={card.label}>
            <span>{card.label}</span>
            <strong>{loading ? "Loading..." : card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>

      <main className="panel">
        <div className="panelHeader">
          <div>
            <h2>Watchlist</h2>
            <p>Current price, 52 week range, discount from high, and opportunity score.</p>
          </div>
          <span className="count">{watchlist.length || 10} Symbols</span>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Ticker</th>
                <th>Sector</th>
                <th>Current Price</th>
                <th>52 Week High</th>
                <th>52 Week Low</th>
                <th>% Off High</th>
                <th>Score</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, index) => (
                    <tr className="skeletonRow" key={index}>
                      {Array.from({ length: 9 }).map((__, cellIndex) => (
                        <td key={cellIndex}>
                          <span />
                        </td>
                      ))}
                    </tr>
                  ))
                : watchlist.map((item) => (
                    <tr key={item.ticker}>
                      <td>
                        <div className="company">
                          <strong>{item.company}</strong>
                          {item.error ? <small>{item.error}</small> : null}
                        </div>
                      </td>
                      <td>
                        <span className="ticker">{item.ticker}</span>
                      </td>
                      <td>{item.sector}</td>
                      <td>{formatCurrency(item.currentPrice)}</td>
                      <td>{formatCurrency(item.weekHigh)}</td>
                      <td>{formatCurrency(item.weekLow)}</td>
                      <td className={Number.isFinite(item.percentOffHigh) && item.percentOffHigh >= 20 ? "positive" : ""}>
                        {formatPercent(item.percentOffHigh)}
                      </td>
                      <td>
                        <div className={`score ${scoreClass(item.score)}`}>
                          <span>{formatScore(item.score)}</span>
                          <meter min="0" max="100" value={Number.isFinite(item.score) ? item.score : 0} />
                        </div>
                      </td>
                      <td>
                        <span className={`rating ${ratingClass(item.rating)}`}>{ratingLabel(item.rating)}</span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(28, 88, 135, 0.22), transparent 34rem),
            linear-gradient(135deg, #071014 0%, #101419 46%, #14130e 100%);
          color: #edf3f7;
          padding: 32px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin: 0 auto 28px;
          max-width: 1440px;
        }

        .eyebrow {
          color: #8dd8c8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          margin: 0 0 8px;
          text-transform: uppercase;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        h1 {
          font-size: clamp(34px, 4vw, 56px);
          font-weight: 850;
          letter-spacing: 0;
        }

        .actions {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timestamp {
          color: #9baab4;
          font-size: 13px;
          white-space: nowrap;
        }

        button {
          background: #e5b95f;
          border: 0;
          border-radius: 7px;
          color: #11160e;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          min-height: 42px;
          padding: 0 18px;
          transition:
            opacity 0.18s ease,
            transform 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .alert,
        .summaryGrid,
        .panel {
          max-width: 1440px;
          margin-left: auto;
          margin-right: auto;
        }

        .alert {
          align-items: center;
          background: rgba(185, 64, 64, 0.15);
          border: 1px solid rgba(255, 123, 123, 0.34);
          border-radius: 8px;
          color: #ffd5d5;
          display: flex;
          gap: 12px;
          margin-bottom: 18px;
          padding: 14px 16px;
        }

        .summaryGrid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 20px;
        }

        .summaryCard {
          background: rgba(12, 22, 27, 0.82);
          border: 1px solid rgba(173, 195, 207, 0.13);
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
          min-height: 132px;
          padding: 20px;
        }

        .summaryCard span,
        .summaryCard small {
          color: #9baab4;
          display: block;
          font-size: 13px;
        }

        .summaryCard strong {
          color: #ffffff;
          display: block;
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 850;
          letter-spacing: 0;
          line-height: 1.05;
          margin: 16px 0 10px;
          overflow-wrap: anywhere;
        }

        .panel {
          background: rgba(10, 15, 18, 0.9);
          border: 1px solid rgba(173, 195, 207, 0.12);
          border-radius: 8px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
          overflow: hidden;
        }

        .panelHeader {
          align-items: center;
          border-bottom: 1px solid rgba(173, 195, 207, 0.1);
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px;
        }

        h2 {
          font-size: 22px;
          letter-spacing: 0;
        }

        .panelHeader p {
          color: #9baab4;
          font-size: 14px;
          margin-top: 6px;
        }

        .count {
          background: rgba(141, 216, 200, 0.11);
          border: 1px solid rgba(141, 216, 200, 0.25);
          border-radius: 999px;
          color: #b8f1e5;
          font-size: 13px;
          font-weight: 800;
          padding: 8px 12px;
          white-space: nowrap;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          border-collapse: collapse;
          min-width: 1120px;
          table-layout: fixed;
          width: 100%;
        }

        th,
        td {
          border-bottom: 1px solid rgba(173, 195, 207, 0.09);
          padding: 16px 18px;
          text-align: left;
          vertical-align: middle;
        }

        th {
          background: rgba(255, 255, 255, 0.03);
          color: #9baab4;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
          white-space: nowrap;
        }

        td {
          color: #dce6ec;
          font-size: 14px;
        }

        tr:hover td {
          background: rgba(255, 255, 255, 0.025);
        }

        .company {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .company strong {
          color: #ffffff;
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .company small {
          color: #ffb4a9;
          font-size: 12px;
        }

        .ticker {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 6px;
          color: #ffffff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 850;
          justify-content: center;
          min-width: 58px;
          padding: 7px 9px;
        }

        .positive {
          color: #8dd8c8;
          font-weight: 800;
        }

        .score {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: 34px 1fr;
          min-width: 118px;
        }

        .score span {
          color: #ffffff;
          font-weight: 850;
        }

        meter {
          background: rgba(255, 255, 255, 0.08);
          border: 0;
          border-radius: 999px;
          height: 8px;
          overflow: hidden;
          width: 100%;
        }

        meter::-webkit-meter-bar {
          background: rgba(255, 255, 255, 0.08);
          border: 0;
          border-radius: 999px;
        }

        meter::-webkit-meter-optimum-value {
          background: #2471a3;
          border-radius: 999px;
        }

        meter::-moz-meter-bar {
          background: #2471a3;
          border-radius: 999px;
        }
        .score.strongBuy meter::-webkit-meter-optimum-value,
        .score.strongBuy meter::-moz-meter-bar {
          background: #0f8f4e;
        }
        .score.buy meter::-webkit-meter-optimum-value,
        .score.buy meter::-moz-meter-bar {
          background: #1e8449;
        }
        .score.watch meter::-webkit-meter-optimum-value,
        .score.watch meter::-moz-meter-bar {
          background: #d4ac0d;
        }
        .score.holdOff meter::-webkit-meter-optimum-value,
        .score.holdOff meter::-moz-meter-bar {
          background: #e67e22;
        }
        .score.avoid meter::-webkit-meter-optimum-value,
        .score.avoid meter::-moz-meter-bar {
          background: #c0392b;
        }

        .rating {
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          justify-content: center;
          min-width: 108px;
          padding: 9px 12px;
          text-transform: uppercase;
        }

        .rating.strongBuy {
          background: #0f8f4e;
          box-shadow: inset 0 0 0 1px #2ecc71;
        }

        .rating.buy {
          background: #1e8449;
        }

        .rating.watch {
          background: #d4ac0d;
          color: #111;
        }

        .rating.holdOff {
          background: #e67e22;
          color: #111;
        }
        .rating.avoid {
          background: #c0392b;
        }
        .rating.sell {
          background: #922b21;
        }
        .rating.info {
          background: #2471a3;
        }

        .skeletonRow span {
          animation: pulse 1.2s ease-in-out infinite;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
          border-radius: 5px;
          display: block;
          height: 16px;
          width: 82%;
        }

        @keyframes pulse {
          0% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.45;
          }
        }

        @media (max-width: 1100px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 20px 14px;
          }

          .topbar,
          .panelHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .actions {
            align-items: stretch;
          }

          .timestamp {
            white-space: normal;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .summaryCard {
            min-height: 118px;
          }
        }
      `}</style>
    </div>
  );
}
