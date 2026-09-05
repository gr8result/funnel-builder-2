import { calculateVolatility } from "../../lib/freedom-trader/volatility.js";

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return Number(value).toFixed(2) + "%";
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return Number(value).toFixed(2);
}

export function volatilityFromCandles(candles = []) {
  return calculateVolatility(candles);
}

export default function FreedomVolatilityPanel({ volatility = null, candles = [], compact = false }) {
  const summary = volatility || volatilityFromCandles(candles);
  const rating = summary?.rating || "UNKNOWN";
  const tone = summary?.tone || "grey";
  const rangeLabel = formatNumber(summary?.averageDailyRange);

  return (
    <section className={"fdVolPanel fdTone-" + tone + (compact ? " compact" : "")} aria-label="Volatility">
      <div className="fdVolHead">
        <span>VOLATILITY</span>
        <strong>{rating}</strong>
      </div>
      <div className="fdVolStats">
        <div><span>Avg daily move</span><strong>{formatPercent(summary?.averageDailyMovementPercent)}</strong></div>
        <div><span>Avg high-low range</span><strong>{rangeLabel}</strong></div>
        <div><span>ATR</span><strong>{formatNumber(summary?.atr)} ({formatPercent(summary?.atrPercent)})</strong></div>
        <div><span>Largest day</span><strong>{formatPercent(summary?.largestDailyMovementPercent)}</strong></div>
        <div><span>Days over 3%</span><strong>{summary?.daysOver3Percent ?? "--"}</strong></div>
      </div>
      <p>{summary?.assessment || "Volatility cannot be assessed from the available candles."}</p>

      <style jsx>{`
        .fdVolPanel {
          background: var(--tone-soft);
          border: 1px solid var(--tone);
          border-radius: 10px;
          color: var(--fd-ink);
          margin: 14px 0 10px;
          padding: 13px 15px;
        }
        .fdVolPanel.compact {
          margin: 10px 0 8px;
          padding: 11px 12px;
        }
        .fdVolHead {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }
        .fdVolHead span {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }
        .fdVolHead strong {
          color: var(--tone);
          font-size: ${compact ? "15px" : "18px"};
          font-weight: 950;
        }
        .fdVolStats {
          display: grid;
          gap: 9px 12px;
          grid-template-columns: repeat(auto-fit, minmax(${compact ? "120px" : "150px"}, 1fr));
          margin-top: 10px;
        }
        .fdVolStats span {
          color: var(--fd-ink-dim);
          display: block;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.35px;
          text-transform: uppercase;
        }
        .fdVolStats strong {
          display: block;
          font-size: ${compact ? "14px" : "17px"};
          font-weight: 900;
          margin-top: 3px;
        }
        .fdVolPanel p {
          color: var(--fd-ink);
          font-size: ${compact ? "13px" : "15px"};
          font-weight: 750;
          line-height: 1.35;
          margin: 10px 0 0;
        }
      `}</style>
    </section>
  );
}
