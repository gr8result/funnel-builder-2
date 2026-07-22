import { useEffect, useMemo, useState } from "react";

const moneyByCurrency = new Map();

function formatCurrency(value, currency = "AUD") {
  if (!moneyByCurrency.has(currency)) {
    moneyByCurrency.set(currency, new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }));
  }
  return Number.isFinite(Number(value)) ? moneyByCurrency.get(currency).format(Number(value)) : "--";
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "--";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function PaperOrderTicket({ mode = "buy", company, setup, position, onClose, onSubmitted }) {
  const [account, setAccount] = useState(null);
  const [side, setSide] = useState(mode);
  const [orderType, setOrderType] = useState("market");
  const [quantity, setQuantity] = useState(mode === "sell" && position?.quantity ? position.quantity : 1);
  const [limitPrice, setLimitPrice] = useState(setup?.entry || setup?.currentPrice || position?.currentPrice || "");
  const [stopLoss, setStopLoss] = useState(setup?.stop || position?.stopLoss || "");
  const [targetPrice, setTargetPrice] = useState(setup?.target || position?.target || "");
  const [brokerageFee, setBrokerageFee] = useState(9.5);
  const [confirmation, setConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/freedom-trader/paper-account")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.ok) setAccount(data.account);
      })
      .catch(() => {
        if (!cancelled) setMessage("Paper account is temporarily unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ticker = company?.symbol || setup?.symbol || position?.ticker || "";
  const currency = setup?.marketData?.currency || position?.currency || company?.currency || "USD";
  const exchange = setup?.marketData?.exchange || position?.exchange || company?.exchange || "NASDAQ";
  const currentPrice = numberValue(setup?.currentPrice ?? position?.currentPrice);
  const lastUpdated = setup?.marketData?.quoteTimestamp
    ? new Date(Number(setup.marketData.quoteTimestamp) * 1000).toISOString()
    : setup?.marketData?.latestCandleDate || position?.priceData?.lastUpdated || null;
  const requestedPrice = orderType === "limit" ? numberValue(limitPrice) : currentPrice;
  const qty = Math.floor(numberValue(quantity) || 0);
  const fee = Math.max(0, numberValue(brokerageFee) || 0);
  const orderValue = Number.isFinite(requestedPrice) ? requestedPrice * qty : null;
  const totalRequiredCash = side === "buy" && Number.isFinite(orderValue) ? orderValue + fee : null;
  const entryPrice = side === "buy" ? requestedPrice : numberValue(position?.averageEntry);
  const riskPerShare = side === "buy" && Number.isFinite(entryPrice) && Number.isFinite(numberValue(stopLoss)) ? entryPrice - numberValue(stopLoss) : null;
  const totalRisk = Number.isFinite(riskPerShare) ? riskPerShare * qty : null;
  const percentAtRisk = account?.availableCash && Number.isFinite(totalRisk) ? (totalRisk / account.availableCash) * 100 : null;
  const estimatedProfitLoss = side === "sell" && Number.isFinite(currentPrice) && Number.isFinite(numberValue(position?.averageEntry))
    ? (currentPrice - Number(position.averageEntry)) * qty - fee
    : null;
  const sellReturn = side === "sell" && Number.isFinite(estimatedProfitLoss) && Number(position?.averageEntry) * qty
    ? (estimatedProfitLoss / (Number(position.averageEntry) * qty)) * 100
    : null;

  const blockers = useMemo(() => {
    const errors = [];
    if (!ticker) errors.push("Ticker is required.");
    if (qty < 1) errors.push("Quantity must be greater than zero.");
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) errors.push("Current price data is unavailable.");
    if (orderType === "limit" && (!Number.isFinite(numberValue(limitPrice)) || Number(limitPrice) <= 0)) errors.push("Limit price is invalid.");
    if (side === "buy" && Number.isFinite(numberValue(stopLoss)) && Number.isFinite(requestedPrice) && Number(stopLoss) >= requestedPrice) errors.push("Stop loss must be below the buy price.");
    if (side === "buy" && Number.isFinite(totalRequiredCash) && account?.availableCash < totalRequiredCash) errors.push("Available paper cash is insufficient.");
    if (side === "sell" && qty > Number(position?.quantity || 0)) errors.push("Cannot sell more shares than currently owned.");
    return errors;
  }, [account, currency, currentPrice, limitPrice, orderType, position, qty, requestedPrice, side, stopLoss, ticker, totalRequiredCash]);

  async function submitOrder() {
    if (!confirmation) {
      setConfirmation(true);
      return;
    }
    if (blockers.length) {
      setMessage(blockers[0]);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/freedom-trader/paper-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          orderType,
          ticker,
          companyName: company?.companyName || position?.companyName || ticker,
          quantity: qty,
          limitPrice: orderType === "limit" ? Number(limitPrice) : undefined,
          brokerageFee: fee,
          stopLoss: stopLoss === "" ? null : Number(stopLoss),
          targetPrice: targetPrice === "" ? null : Number(targetPrice),
          exitReason: side === "sell" ? "manual" : null,
          priceSnapshot: {
            price: currentPrice,
            provider: setup?.marketData?.quoteSource || setup?.marketData?.provider || position?.priceData?.provider || "Freedom Trader analysis",
            exchange,
            currency,
            lastUpdated,
            delayed: true,
            source: "Freedom Trader validated company analysis",
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to submit paper order.");
      setMessage(data.order?.status === "filled" ? "Paper order filled. No real money was used." : "Paper order submitted as pending.");
      onSubmitted?.(data);
    } catch (error) {
      setMessage(error.message || "Unable to submit paper order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="paperBackdrop">
      <section className="paperTicket">
        <div className="paperHeader">
          <div>
            <span>PAPER TRADING - NO REAL MONEY</span>
            <h2>{side === "buy" ? "Buy Order Ticket" : "Sell Order Ticket"}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="paperMeta">
          <strong>{company?.companyName || position?.companyName || ticker}</strong>
          <span>{ticker} / {exchange} / {currency}</span>
          <span>Provider: {setup?.marketData?.quoteSource || setup?.marketData?.provider || position?.priceData?.provider || "Finnhub"} / {lastUpdated || "last update unavailable"} / delayed</span>
          {account?.currency && currency !== account.currency ? <span className="currencyNotice">Instrument currency is {currency}; paper account display currency is {account.currency}. No live FX conversion or broker settlement is performed.</span> : null}
        </div>
        <div className="ticketGrid">
          <label>Side<select value={side} onChange={(event) => setSide(event.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
          <label>Order type<select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option value="market">Market</option><option value="limit">Limit</option></select></label>
          <label>Current price<input readOnly value={formatCurrency(currentPrice, currency)} /></label>
          {orderType === "limit" ? <label>Limit price<input value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} type="number" /></label> : null}
          <label>Quantity<input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" /></label>
          <label>Brokerage fee<input value={brokerageFee} onChange={(event) => setBrokerageFee(event.target.value)} type="number" /></label>
          {side === "buy" ? <label>Optional stop loss<input value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} type="number" /></label> : null}
          {side === "buy" ? <label>Optional profit target<input value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} type="number" /></label> : null}
        </div>
        <div className="summaryGrid">
          <Metric label="Estimated order value" value={formatCurrency(orderValue, currency)} />
          <Metric label="Total required cash" value={side === "buy" ? formatCurrency(totalRequiredCash, currency) : "--"} />
          <Metric label="Risk per share" value={formatCurrency(riskPerShare, currency)} />
          <Metric label="Total risk" value={formatCurrency(totalRisk, currency)} />
          <Metric label="Account at risk" value={formatPercent(percentAtRisk)} />
          <Metric label="Estimated P/L" value={formatCurrency(estimatedProfitLoss, currency)} />
          <Metric label="Return" value={formatPercent(sellReturn)} />
          <Metric label="Available cash" value={formatCurrency(account?.availableCash, account?.currency || "AUD")} />
        </div>
        {blockers.length ? <div className="ticketWarning">{blockers[0]}</div> : null}
        {confirmation ? <div className="ticketConfirm">Confirm this simulated paper order. It will not place a broker trade or use real money.</div> : null}
        {message ? <div className="ticketMessage">{message}</div> : null}
        <div className="paperActions">
          <button type="button" onClick={submitOrder} disabled={loading || blockers.length}>{loading ? "Submitting..." : confirmation ? "Confirm Paper Order" : "Review Order"}</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </section>
      <style jsx>{`
        .paperBackdrop{align-items:center;background:rgba(0,0,0,.74);display:flex;inset:0;justify-content:center;padding:24px;position:fixed;z-index:80}.paperTicket{background:#081016;border:1px solid rgba(255,153,0,.34);border-radius:8px;color:#f5f7f8;display:grid;gap:14px;max-height:92vh;max-width:920px;overflow:auto;padding:20px;width:100%}.paperHeader{align-items:center;display:flex;justify-content:space-between}.paperHeader span{color:#ffcf7a;font-size:12px;font-weight:950}.paperHeader h2{margin:4px 0 0}.paperMeta,.ticketWarning,.ticketConfirm,.ticketMessage{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:8px;display:grid;gap:5px;padding:12px}.paperMeta span{color:#aebdc4;font-size:12px}.paperMeta .currencyNotice{color:#ffcf7a}.ticketGrid,.summaryGrid{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}label{color:#aebdc4;display:grid;font-size:12px;font-weight:900;gap:7px;text-transform:uppercase}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:38px;padding:8px}.summaryGrid article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px}.summaryGrid span{color:#aebdc4;font-size:11px;font-weight:900;text-transform:uppercase}.summaryGrid strong{display:block;margin-top:6px}.ticketWarning{border-color:rgba(255,92,92,.34);color:#ffc8c8}.ticketConfirm{border-color:rgba(35,209,139,.32);color:#b8f4e6}.ticketMessage{color:#d7efff}.paperActions{display:flex;gap:10px;justify-content:flex-end}button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.34);border-radius:7px;color:#d7efff;cursor:pointer;font-weight:950;min-height:38px;padding:0 12px}button:first-child{background:#ff9900;border-color:#ff9900;color:#061014}button:disabled{cursor:not-allowed;opacity:.45}@media(max-width:760px){.ticketGrid,.summaryGrid{grid-template-columns:1fr}.paperBackdrop{padding:12px}}
      `}</style>
    </div>
  );
}

function Metric({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}
