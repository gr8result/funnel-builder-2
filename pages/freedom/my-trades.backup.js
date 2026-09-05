import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";

import FreedomShell, {
  FreedomNotice,
  formatMoney,
  formatPercent,
  formatSignedMoney,
  formatTimestamp,
} from "../../components/freedom/FreedomShell.js";
import FreedomTradeChart from "../../components/freedom/FreedomTradeChart.js";

/**
 * My Trades - Holdings Dashboard with CMC Orders
 *
 * Displays real broker holdings and orders from CMC Invest:
 * - Active Holdings: owned positions with optional sell orders
 * - Pending Buy Orders: unfilled purchase orders (not yet owned)
 * - Closed Trades & Test Records: historical and paper trades
 */

function round(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(decimals));
}

/**
 * Sell Order Card - Shows pending or active sell order on a holding
 */
function SellOrderDisplay({ sellOrder, holdingCurrency }) {
  const currency = sellOrder.cmcSnapshot?.currency || holdingCurrency || "AUD";
  
  return (
    <div className="fdSellOrder">
      <div className="fdSellOrderHead">
        <span className="fdSellOrderType">{sellOrder.orderType}</span>
        <span className={"fdSellOrderStatus fdSellOrderStatus-" + (sellOrder.status === "Active" ? "active" : "pending")}>
          {sellOrder.status}
        </span>
      </div>
      
      <div className="fdSellOrderDetails">
        <div className="fdSellOrderRow">
          <span className="fdLabel">Target Price</span>
          <strong>{formatMoney(sellOrder.targetPrice, currency)}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Current Price</span>
          <strong>{formatMoney(sellOrder.currentPrice, currency)}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Distance to Target</span>
          <strong>{formatMoney(sellOrder.distanceToTarget, currency)} ({formatPercent(sellOrder.distanceToTargetPercent)})</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Quantity</span>
          <strong>{sellOrder.quantity}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Potential Movement</span>
          <strong>{formatMoney(sellOrder.potentialMovement, currency)}</strong>
        </div>
        {sellOrder.expiry && (
          <div className="fdSellOrderRow">
            <span className="fdLabel">Expires</span>
            <strong>{new Date(sellOrder.expiry).toLocaleDateString()}</strong>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .fdSellOrder {
          background: var(--fd-panel-2);
          border-left: 3px solid var(--fd-accent);
          border-radius: 8px;
          margin-top: 12px;
          padding: 12px 14px;
        }
        .fdSellOrderHead {
          display: flex;
          gap: 8px;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .fdSellOrderType {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: var(--fd-ink-dim);
        }
        .fdSellOrderStatus {
          font-size: 11px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 4px;
          background: var(--fd-panel);
        }
        .fdSellOrderStatus-active {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }
        .fdSellOrderStatus-pending {
          background: rgba(251, 146, 60, 0.1);
          color: #fb923c;
        }
        .fdSellOrderDetails {
          display: grid;
          gap: 8px;
          font-size: 12px;
        }
        .fdSellOrderRow {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .fdSellOrderRow .fdLabel {
          color: var(--fd-ink-dim);
          flex: 1;
        }
        .fdSellOrderRow strong {
          font-weight: 600;
          text-align: right;
        }
      `}</style>
    </div>
  );
}

/**
 * Active Holding Card - Shows owned position with optional sell orders
 */
function HoldingCard({ holding, onSetTarget, onSetSafetyExit, onViewChart, onEdit }) {
  const currency = holding.currency || "AUD";
  
  return (
    <article className={"fdHoldingCard fdTone-" + holding.tone}>
      <header className="fdHoldingCardHead">
        <div>
          <h2>{holding.symbol}</h2>
          <p>{holding.companyName || holding.exchange || "Holding"}</p>
        </div>
        <span className="fdHoldingBadge">ACTIVE HOLDING</span>
      </header>

      <div className="fdHoldingChart">
        <FreedomTradeChart
          candles={holding.candles || []}
          entryPrice={holding.purchasePrice}
          currentPrice={holding.currentPrice}
          safetyExit={holding.safetyExit}
          targets={holding.pendingSellOrders?.map(o => o.targetPrice) || (holding.targetPrice ? [holding.targetPrice] : [])}
          height={200}
          ariaLabel={`${holding.symbol} historical price chart`}
        />
      </div>

      <dl className="fdHoldingStats">
        <div className="fdStat">
          <dt>Quantity Owned</dt>
          <dd>{holding.quantity}</dd>
        </div>
        <div className="fdStat">
          <dt>Purchase Price</dt>
          <dd>{holding.purchasePrice ? formatMoney(holding.purchasePrice, currency) : "Not recorded"}</dd>
        </div>
        <div className="fdStat">
          <dt>Total Cost</dt>
          <dd>{holding.amountInvested ? formatMoney(holding.amountInvested, currency) : "--"}</dd>
        </div>
        <div className="fdStat">
          <dt>Current Price</dt>
          <dd>{holding.dataAvailable ? formatMoney(holding.currentPrice, currency) : "No data"}</dd>
        </div>
        <div className="fdStat">
          <dt>Market Value</dt>
          <dd>{holding.dataAvailable ? formatMoney(holding.currentValue, currency) : "--"}</dd>
        </div>
        <div className="fdStat">
          <dt>Market Status</dt>
          <dd className="fdMarketStatus">{holding.marketStatus || "Unknown"}</dd>
        </div>
      </dl>

      {holding.dataAvailable && holding.profitLoss !== null && (
        <div className="fdHoldingPL">
          <div>
            <span className="fdLabel">Profit/Loss</span>
            <strong className="fdAmount">
              {formatSignedMoney(holding.profitLoss, currency)}
            </strong>
          </div>
          <div>
            <span className="fdLabel">Return</span>
            <strong className="fdPercent">
              {formatPercent(holding.profitLossPercent)}
            </strong>
          </div>
        </div>
      )}

      {/* Display attached sell orders */}
      {holding.pendingSellOrders && holding.pendingSellOrders.length > 0 && (
        <div className="fdPendingSellOrders">
          <h4>Pending Sell Orders</h4>
          {holding.pendingSellOrders.map(sellOrder => (
            <SellOrderDisplay key={sellOrder.id} sellOrder={sellOrder} holdingCurrency={currency} />
          ))}
        </div>
      )}

      <div className="fdHoldingTargets">
        <div className="fdTargetRow">
          <span className="fdTargetLabel">Manual Target Sell</span>
          <span className="fdTargetValue">
            {holding.targetPrice 
              ? `${formatMoney(holding.targetPrice, currency)} (${holding.distanceToTargetPercent !== null ? formatPercent(holding.distanceToTargetPercent) : '--'} away)`
              : "Target not set"}
          </span>
          <button type="button" className="fdTargetButton" onClick={() => onSetTarget(holding)}>
            {holding.targetPrice ? "Edit" : "Set"}
          </button>
        </div>
        <div className="fdTargetRow">
          <span className="fdTargetLabel">Safety Exit</span>
          <span className="fdTargetValue">
            {holding.safetyExit 
              ? `${formatMoney(holding.safetyExit, currency)} (${holding.distanceToSafetyExitPercent !== null ? formatPercent(holding.distanceToSafetyExitPercent) : '--'} away)`
              : "Safety Exit not set"}
          </span>
          <button type="button" className="fdTargetButton" onClick={() => onSetSafetyExit(holding)}>
            {holding.safetyExit ? "Edit" : "Set"}
          </button>
        </div>
      </div>

      <p className="fdHoldingStamp">
        {holding.dataAvailable && holding.dataTimestamp 
          ? `Price as at ${formatTimestamp(holding.dataTimestamp)}`
          : "Market data unavailable"}
      </p>

      <div className="fdHoldingActions">
        <button type="button" className="fdButton secondary" onClick={() => onViewChart(holding)}>
          View Full Chart
        </button>
        <button type="button" className="fdButton secondary" onClick={() => onEdit(holding)}>
          Edit Holding
        </button>
      </div>

      <style jsx>{`
        .fdHoldingCard {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-top: 6px solid var(--tone);
          border-radius: 14px;
          overflow: hidden;
          padding: 20px 22px;
        }
        .fdHoldingCardHead {
          align-items: flex-start;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .fdHoldingCardHead h2 {
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
          margin: 0;
        }
        .fdHoldingCardHead p {
          color: var(--fd-ink-dim);
          font-size: 13px;
          margin: 6px 0 0;
        }
        .fdHoldingBadge {
          background: var(--tone);
          border-radius: 6px;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.5px;
          padding: 6px 10px;
          white-space: nowrap;
        }
        .fdHoldingChart {
          margin: 12px -22px 14px;
          overflow: hidden;
        }
        .fdHoldingStats {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 14px 0 0;
        }
        .fdStat {
          background: var(--fd-panel-2);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .fdStat dt {
          color: var(--fd-ink-dim);
          font-size: 10px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
        }
        .fdStat dd {
          font-size: 15px;
          font-weight: 700;
          margin: 3px 0 0;
        }
        .fdMarketStatus {
          font-size: 12px !important;
        }
        .fdHoldingPL {
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr 1fr;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--fd-line);
        }
        .fdHoldingPL > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fdLabel {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .fdAmount {
          font-size: 22px;
          font-weight: 900;
        }
        .fdPercent {
          font-size: 18px;
          font-weight: 900;
        }
        .fdPendingSellOrders {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--fd-line);
        }
        .fdPendingSellOrders h4 {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          margin: 0 0 10px;
          text-transform: uppercase;
        }
        .fdHoldingTargets {
          display: grid;
          gap: 10px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--fd-line);
        }
        .fdTargetRow {
          display: grid;
          gap: 10px;
          grid-template-columns: 140px 1fr auto;
          align-items: center;
        }
        .fdTargetLabel {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .fdTargetValue {
          font-size: 13px;
          font-weight: 600;
        }
        .fdTargetButton {
          background: var(--fd-accent);
          border: 0;
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          padding: 6px 12px;
          text-transform: uppercase;
        }
        .fdTargetButton:hover {
          background: var(--fd-accent-hot);
        }
        .fdHoldingStamp {
          color: var(--fd-ink-dim);
          font-size: 11px;
          margin: 12px 0 0;
        }
        .fdHoldingActions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .fdButton {
          background: var(--fd-panel-2);
          border: 1px solid var(--fd-line);
          border-radius: 6px;
          color: var(--fd-ink);
          cursor: pointer;
          flex: 1;
          font-size: 12px;
          font-weight: 700;
          padding: 8px 12px;
          transition: background 0.2s;
        }
        .fdButton:hover {
          background: var(--fd-line);
        }
        .fdButton.secondary {
          background: var(--fd-panel-2);
        }
      `}</style>
    </article>
  );
}

/**
 * Pending Buy Order Card - Shows unfilled buy orders (not yet owned)
 */
function PendingBuyOrderCard({ order }) {
  const currency = order.currency || "USD";
  const isLongTerm = order.termClassification === "long-term";
  const estimatedCost = order.entryPrice * order.quantity;
  const priceDistance = order.cmcSnapshot?.currentPrice ? (order.cmcSnapshot.currentPrice - order.entryPrice) : null;
  const priceDistancePercent = priceDistance && order.entryPrice ? (priceDistance / order.entryPrice) * 100 : null;
  
  return (
    <article className="fdPendingBuyCard">
      <header className="fdPendingBuyHead">
        <div>
          <h3>{order.symbol}</h3>
          <p>{order.companyName || order.exchange}</p>
        </div>
        <div className="fdPendingBuyMeta">
          <span className="fdBadge fdBadgeNotOwned">NOT YET OWNED</span>
          <span className={`fdBadge fdBadgeClass-${isLongTerm ? 'longterm' : 'shortterm'}`}>
            {isLongTerm ? 'Long-Term' : 'Short-Term'}
          </span>
        </div>
      </header>

      <div className="fdPendingBuyDetails">
        <div className="fdDetailRow">
          <span className="fdLabel">Order Status</span>
          <strong>{order.orderStatus || "Pending"}</strong>
        </div>
        <div className="fdDetailRow">
          <span className="fdLabel">Buy Limit</span>
          <strong>{formatMoney(order.entryPrice, currency)}</strong>
        </div>
        <div className="fdDetailRow">
          <span className="fdLabel">Current Price</span>
          <strong>{order.cmcSnapshot?.currentPrice ? formatMoney(order.cmcSnapshot.currentPrice, currency) : "No data"}</strong>
        </div>
        {priceDistance !== null && (
          <div className="fdDetailRow">
            <span className="fdLabel">Distance from Limit</span>
            <strong className={priceDistance >= 0 ? "fdPositive" : "fdNegative"}>
              {formatMoney(Math.abs(priceDistance), currency)} ({formatPercent(Math.abs(priceDistancePercent))})
            </strong>
          </div>
        )}
        <div className="fdDetailRow">
          <span className="fdLabel">Quantity</span>
          <strong>{order.quantity}</strong>
        </div>
        <div className="fdDetailRow">
          <span className="fdLabel">Estimated Order Value</span>
          <strong>{formatMoney(estimatedCost, currency)}</strong>
        </div>
        {order.cmcSnapshot?.filled !== undefined && (
          <div className="fdDetailRow">
            <span className="fdLabel">Filled / Unfilled</span>
            <strong>{order.cmcSnapshot.filled} / {order.cmcSnapshot.unfilled}</strong>
          </div>
        )}
        <div className="fdDetailRow">
          <span className="fdLabel">Expiry</span>
          <strong>{order.goodTillCancelled ? "Good Till Cancelled" : (order.expiry ? new Date(order.expiry).toLocaleDateString() : "Open")}</strong>
        </div>
      </div>

      {/* Display attached take-profit if present */}
      {order.takeSomeProfit && (
        <div className="fdAttachedTarget">
          <h4>Attached Take-Profit Target</h4>
          <div className="fdTargetInfo">
            <div className="fdTargetRow">
              <span className="fdLabel">Target Price</span>
              <strong>{formatMoney(order.takeSomeProfit, currency)}</strong>
            </div>
            <div className="fdTargetRow">
              <span className="fdLabel">Potential Gain Per Share</span>
              <strong className="fdPositive">
                {formatMoney(order.takeSomeProfit - order.entryPrice, currency)} ({formatPercent(((order.takeSomeProfit - order.entryPrice) / order.entryPrice) * 100)})
              </strong>
            </div>
            <div className="fdTargetRow">
              <span className="fdLabel">Potential Total Gain</span>
              <strong className="fdPositive">
                {formatMoney((order.takeSomeProfit - order.entryPrice) * order.quantity, currency)}
              </strong>
            </div>
            <p className="fdDisclasimer">? Potential gain only � order not yet filled</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .fdPendingBuyCard {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-left: 4px solid var(--fd-accent);
          border-radius: 14px;
          padding: 18px 20px;
        }
        .fdPendingBuyHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          align-items: flex-start;
        }
        .fdPendingBuyHead h3 {
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
          margin: 0;
        }
        .fdPendingBuyHead p {
          color: var(--fd-ink-dim);
          font-size: 12px;
          margin: 6px 0 0;
        }
        .fdPendingBuyMeta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .fdBadge {
          font-size: 10px;
          font-weight: 900;
          padding: 5px 9px;
          border-radius: 5px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .fdBadgeNotOwned {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        .fdBadgeClass-longterm {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }
        .fdBadgeClass-shortterm {
          background: rgba(251, 146, 60, 0.15);
          color: #fb923c;
        }
        .fdPendingBuyDetails {
          display: grid;
          gap: 10px;
          font-size: 13px;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--fd-line);
        }
        .fdDetailRow {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .fdLabel {
          color: var(--fd-ink-dim);
          font-weight: 600;
          flex: 1;
        }
        .fdDetailRow strong {
          text-align: right;
          font-weight: 700;
        }
        .fdPositive { color: #22c55e; }
        .fdNegative { color: #ef4444; }
        .fdAttachedTarget {
          background: var(--fd-panel-2);
          border-radius: 10px;
          padding: 12px 14px;
          margin-top: 12px;
        }
        .fdAttachedTarget h4 {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: var(--fd-ink-dim);
          margin: 0 0 10px;
        }
        .fdTargetInfo {
          display: grid;
          gap: 10px;
          font-size: 12px;
        }
        .fdTargetRow {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .fdTargetRow .fdLabel {
          flex: 1;
        }
        .fdTargetRow strong {
          text-align: right;
          font-weight: 700;
        }
        .fdDisclasimer {
          font-size: 11px;
          color: var(--fd-ink-dim);
          margin: 8px 0 0;
          padding-top: 8px;
          border-top: 1px solid var(--fd-line);
        }
      `}</style>
    </article>
  );
}

/**
 * Portfolio Summary - Shows overview of active holdings
 */
function PortfolioSummary({ holdings, cmaSnapshot }) {
  const activePriced = holdings.filter(h => h.dataAvailable);
  const activeCount = holdings.length;
  const totalCost = holdings.reduce((sum, h) => sum + (h.amountInvested || 0), 0);
  const totalValue = activePriced.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  
  const bestPerformer = activePriced.reduce((best, h) => {
    const hPercent = h.profitLossPercent || -Infinity;
    const bPercent = best?.profitLossPercent || -Infinity;
    return hPercent > bPercent ? h : best;
  }, null);
  
  const worstPerformer = activePriced.reduce((worst, h) => {
    const hPercent = h.profitLossPercent || Infinity;
    const wPercent = worst?.profitLossPercent || Infinity;
    return hPercent < wPercent ? h : worst;
  }, null);

  return (
    <section className="fdPortfolioSummary">
      <h2>Portfolio Summary</h2>
      <div className="fdSummaryGrid">
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Active Holdings</span>
          <strong className="fdSummaryValue">{activeCount}</strong>
        </div>
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Total Cost</span>
          <strong className="fdSummaryValue">A${totalCost.toFixed(2)}</strong>
        </div>
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Market Value</span>
          <strong className="fdSummaryValue">A${totalValue.toFixed(2)}</strong>
        </div>
        <div className={`fdSummaryCard ${totalPL >= 0 ? 'fdPositiveSummary' : 'fdNegativeSummary'}`}>
          <span className="fdSummaryLabel">P&L</span>
          <strong className="fdSummaryValue">{formatSignedMoney(totalPL, 'AUD')}</strong>
        </div>
        <div className={`fdSummaryCard ${totalPLPercent >= 0 ? 'fdPositiveSummary' : 'fdNegativeSummary'}`}>
          <span className="fdSummaryLabel">Return</span>
          <strong className="fdSummaryValue">{formatPercent(totalPLPercent)}</strong>
        </div>
        {bestPerformer && (
          <div className="fdSummaryCard fdPositiveSummary">
            <span className="fdSummaryLabel">Best Performer</span>
            <strong className="fdSummaryValue">{bestPerformer.symbol} {formatPercent(bestPerformer.profitLossPercent)}</strong>
          </div>
        )}
        {worstPerformer && (
          <div className="fdSummaryCard fdNegativeSummary">
            <span className="fdSummaryLabel">Worst Performer</span>
            <strong className="fdSummaryValue">{worstPerformer.symbol} {formatPercent(worstPerformer.profitLossPercent)}</strong>
          </div>
        )}
      </div>

      <style jsx>{`
        .fdPortfolioSummary {
          margin-bottom: 28px;
        }
        .fdPortfolioSummary h2 {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 14px;
        }
        .fdSummaryGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .fdSummaryCard {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fdSummaryCard.fdPositiveSummary {
          border-color: rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.05);
        }
        .fdSummaryCard.fdNegativeSummary {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }
        .fdSummaryLabel {
          color: var(--fd-ink-dim);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .fdSummaryValue {
          font-size: 14px;
          font-weight: 900;
        }
        .fdNegativeSummary .fdSummaryValue {
          color: #ef4444;
        }
        .fdPositiveSummary .fdSummaryValue {
          color: #22c55e;
        }
      `}</style>
    </section>
  );
}

/**
 * Main Dashboard
 */
export default function MyTradesDashboard() {
  const [holdings, setHoldings] = useState([]);
  const [pendingBuyOrders, setPendingBuyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch holdings and orders on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/freedom/long-term");
        if (!res.ok) throw new Error("Failed to fetch holdings");
        const json = await res.json();
        setHoldings(json.holdings || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch pending buy orders from short-term trades
  useEffect(() => {
    const fetchPendingBuys = async () => {
      try {
        const res = await fetch("/api/freedom/trades?type=PENDING_BUY_ORDER");
        if (!res.ok) return;
        const json = await res.json();
        setPendingBuyOrders(json.trades || []);
      } catch (err) {
        console.warn("Could not fetch pending orders", err.message);
      }
    };
    fetchPendingBuys();
  }, []);

  const activeHoldings = holdings.filter(h => h.kind === "long-term" && h.quantity > 0);
  const pendingBuys = pendingBuyOrders.filter(o => o.orderClassification === "PENDING_BUY_ORDER");

  const handleSetTarget = useCallback(async (holding) => {
    const price = prompt(`Set target sell price for ${holding.symbol}:`, holding.targetPrice || "");
    if (price === null) return;
    
    const parsed = parseFloat(price);
    if (!Number.isFinite(parsed)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      const res = await fetch("/api/freedom/long-term", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holding.id, targetPrice: parsed })
      });
      if (!res.ok) throw new Error("Failed to update target");
      const json = await res.json();
      setHoldings(json.holdings || []);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, []);

  const handleSetSafetyExit = useCallback(async (holding) => {
    const price = prompt(`Set safety exit price for ${holding.symbol}:`, holding.safetyExit || "");
    if (price === null) return;
    
    const parsed = parseFloat(price);
    if (!Number.isFinite(parsed)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      const res = await fetch("/api/freedom/long-term", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holding.id, safetyExit: parsed })
      });
      if (!res.ok) throw new Error("Failed to update safety exit");
      const json = await res.json();
      setHoldings(json.holdings || []);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, []);

  const handleViewChart = useCallback((holding) => {
    console.log("View chart:", holding.symbol);
  }, []);

  const handleEditHolding = useCallback((holding) => {
    console.log("Edit holding:", holding.symbol);
  }, []);

  if (loading) {
    return (
      <FreedomShell title="My Trades">
        <Head>
          <title>My Trades - Freedom</title>
        </Head>
        <p>Loading holdings...</p>
      </FreedomShell>
    );
  }

  return (
    <FreedomShell title="My Trades">
      <Head>
        <title>My Trades - Freedom</title>
      </Head>

      {error && <FreedomNotice type="error">{error}</FreedomNotice>}

      {/* Portfolio Summary */}
      {activeHoldings.length > 0 && (
        <PortfolioSummary holdings={activeHoldings} />
      )}

      {/* Pending Buy Orders Section */}
      {pendingBuys.length > 0 && (
        <section className="fdOrdersSection">
          <h2>Pending Buy Orders</h2>
          <p className="fdSectionNote">These orders are not yet filled. You do not yet own these securities.</p>
          <div className="fdOrdersGrid">
            {pendingBuys.map(order => (
              <PendingBuyOrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {/* Active Holdings Section */}
      {activeHoldings.length > 0 && (
        <section className="fdHoldingsSection">
          <h2>Active Holdings</h2>
          <div className="fdHoldingsGrid">
            {activeHoldings.map(holding => (
              <HoldingCard
                key={holding.id}
                holding={holding}
                onSetTarget={handleSetTarget}
                onSetSafetyExit={handleSetSafetyExit}
                onViewChart={handleViewChart}
                onEdit={handleEditHolding}
              />
            ))}
          </div>
        </section>
      )}

      {activeHoldings.length === 0 && pendingBuys.length === 0 && (
        <FreedomNotice type="info">No active holdings or pending orders.</FreedomNotice>
      )}

      <style jsx>{`
        .fdOrdersSection,
        .fdHoldingsSection {
          margin-bottom: 28px;
        }
        .fdOrdersSection h2,
        .fdHoldingsSection h2 {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 10px;
        }
        .fdSectionNote {
          color: var(--fd-ink-dim);
          font-size: 12px;
          margin: 0 0 14px;
        }
        .fdOrdersGrid,
        .fdHoldingsGrid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
        }
        @media (max-width: 1400px) {
          .fdOrdersGrid,
          .fdHoldingsGrid {
            grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          }
        }
        @media (max-width: 900px) {
          .fdOrdersGrid,
          .fdHoldingsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </FreedomShell>
  );
}

