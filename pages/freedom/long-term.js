import { supabase } from "../../lib/supabaseClient";
import { portfolioHeaders } from "../../lib/freedom/portfolioClient.js";
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";

import FreedomShell, {
  FreedomNotice,
  WhyThisResult,
  formatMoney,
  formatPercent,
  formatSignedMoney,
  formatTimestamp,
} from "../../components/freedom/FreedomShell.js";
import FreedomTradeChart from "../../components/freedom/FreedomTradeChart.js";

/**
 * Long-Term Portfolio.
 *
 * Microsoft and other long-term investments, tracked entirely separately from the
 * short-term trades on My Trades. Shows purchase price, quantity, current value, profit
 * or loss and the original investment reason.
 */

const EMPTY_FORM = {
  symbol: "", exchange: "NASDAQ", currency: "USD", companyName: "",
  purchasePrice: "", quantity: "", purchaseDate: "", reason: "",
};

function HoldingCard({ holding, onDelete }) {
  const currency = holding.valuationCurrency || holding.currency || "USD";
  const nativeCurrency = holding.nativeCurrency || holding.currency || "USD";
  return (
    <article className={"fdHolding fdTone-" + holding.tone}>
      <header className="fdHoldingHead">
        <div>
          <h2>{holding.symbol}</h2>
          <p>{holding.companyName || holding.exchange} &middot; {currency}</p>
        </div>
        <div className="fdHoldingValue">
          <span>Current value</span>
          <strong>{holding.currentValue === null ? "No data" : formatMoney(holding.currentValue, currency)}</strong>
        </div>
      </header>

      <FreedomTradeChart
        candles={holding.candles}
        entryPrice={holding.brokerHoldingSnapshot && nativeCurrency !== "AUD" ? null : holding.purchasePrice}
        currentPrice={holding.currentPrice}
        targets={[...(holding.pendingSellOrders || []).map(row => row.targetPrice), holding.targetPrice].filter(value => value != null)}
        height={180}
        ariaLabel={holding.symbol + " long-term price chart"}
      />

      <dl className="fdHoldingFacts">
        <div><dt>Average buy price ({holding.purchasePriceCurrency || currency})</dt><dd>{holding.purchasePrice == null ? "Not recorded" : `${holding.purchasePriceCurrency || currency} ${Number(holding.purchasePrice).toFixed(3)}`}</dd></div>
        <div><dt>Quantity</dt><dd>{holding.quantity}</dd></div>
        <div><dt>Amount invested</dt><dd>{formatMoney(holding.amountInvested, currency)}</dd></div>
        <div><dt>Current price</dt><dd>{holding.dataAvailable ? formatMoney(holding.currentPrice, nativeCurrency) : "No data"}</dd></div>
        <div>
          <dt>Profit / loss</dt>
          <dd className="fdPL">{holding.profitLoss === null ? "No data" : formatSignedMoney(holding.profitLoss, currency)}</dd>
        </div>
        <div>
          <dt>Return</dt>
          <dd className="fdPL">{holding.profitLossPercent === null ? "No data" : formatPercent(holding.profitLossPercent)}</dd>
        </div>
      </dl>

      <div className="fdReasonBlock">
        <h3>Why this investment was made</h3>
        <p>{holding.reason}</p>
      </div>

      <WhyThisResult>
        <dl>
          <dt>Purchase date</dt><dd>{formatTimestamp(holding.purchaseDate)}</dd>
          <dt>Exchange</dt><dd>{holding.exchange}</dd>
          <dt>Market data available</dt><dd>{String(holding.dataAvailable)}</dd>
          <dt>Price timestamp</dt><dd>{formatTimestamp(holding.dataTimestamp)}</dd>
          <dt>Chart candles</dt><dd>{holding.candles?.length || 0}</dd>
        </dl>
        {holding.marketDataError ? <p>{holding.marketDataError}</p> : null}
      </WhyThisResult>

      <div className="fdHoldingActions">
        <button type="button" className="fdButton danger" onClick={() => onDelete(holding)}>Remove holding</button>
      </div>

      <style jsx>{`
        .fdHolding {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-top: 6px solid var(--tone);
          border-radius: 14px;
          padding: 22px 24px;
        }
        .fdHoldingHead {
          align-items: flex-start;
          display: flex;
          gap: 18px;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .fdHoldingHead h2 { font-size: 32px; font-weight: 900; line-height: 1; margin: 0; }
        .fdHoldingHead p { color: var(--fd-ink-dim); font-size: 15px; margin: 7px 0 0; }
        .fdHoldingValue { text-align: right; }
        .fdHoldingValue span {
          color: var(--fd-ink-dim);
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .fdHoldingValue strong { color: var(--tone); font-size: 26px; font-weight: 900; }
        .fdHoldingFacts {
          display: grid;
          gap: 14px 18px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 18px 0 0;
        }
        .fdHoldingFacts dt {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .fdHoldingFacts dd { font-size: 17px; font-weight: 800; margin: 4px 0 0; }
        .fdPL { color: var(--tone) !important; }
        .fdReasonBlock {
          background: var(--fd-panel-2);
          border-radius: 10px;
          margin-top: 20px;
          padding: 14px 18px;
        }
        .fdReasonBlock h3 {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          margin: 0 0 8px;
          text-transform: uppercase;
        }
        .fdReasonBlock p { font-size: 16px; line-height: 1.5; margin: 0; }
        .fdHoldingActions { margin-top: 18px; }
        @media (max-width: 560px) {
          .fdHoldingFacts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </article>
  );
}

export default function LongTermPortfolio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/freedom/long-term", { headers: await portfolioHeaders(supabase.auth), cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !Array.isArray(payload.holdings)) throw new Error(payload.error || payload.errors?.[0] || "Could not load the portfolio.");
      setData(payload);
    } catch (error) {
      setLoadError(error?.message || "Could not load the portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const response = await fetch("/api/freedom/long-term", {
        method: "POST",
        headers: await portfolioHeaders(supabase.auth, true),
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setErrors(payload.errors || ["The holding could not be saved."]);
        return;
      }
      setData(payload);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch (error) {
      setErrors([error?.message || "The holding could not be saved."]);
    } finally {
      setSaving(false);
    }
  }, [form]);

  const remove = useCallback(async (holding) => {
    try {
      const response = await fetch("/api/freedom/long-term?id=" + encodeURIComponent(holding.id), { method: "DELETE", headers: await portfolioHeaders(supabase.auth) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || payload.errors?.[0] || "Could not delete holding.");
      setData(payload);
    } catch (error) { setLoadError(error.message); }
  }, []);

  const holdings = data?.holdings || [];
  const totals = data?.totals;

  const field = (name, label, type = "text", extra = {}) => (
    <div className="fdField">
      <label htmlFor={"fd-" + name}>{label}</label>
      <input
        id={"fd-" + name}
        type={type}
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        {...extra}
      />
    </div>
  );

  return (
    <>
      <Head><title>Long-Term Portfolio | Freedom</title></Head>
      <FreedomShell
        title="Long-Term Portfolio"
        subtitle="Long-term investments tracked separately from short-term trades."
        actions={
          <>
            <button type="button" className="fdButton secondary" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh prices"}
            </button>
            <button type="button" className="fdButton" onClick={() => setFormOpen((open) => !open)}>
              {formOpen ? "Cancel" : "Add an investment"}
            </button>
          </>
        }
      >
        {formOpen ? (
          <form className="fdForm" onSubmit={submit}>
            <h2>Add a long-term investment</h2>
            <p className="fdFormHint">Record what you bought, when, and why. The reason is kept with the holding permanently.</p>
            <div className="fdFormGrid">
              {field("symbol", "Ticker", "text", { placeholder: "MSFT", required: true })}
              {field("exchange", "Exchange", "text", { placeholder: "NASDAQ", required: true })}
              {field("currency", "Currency", "text", { placeholder: "USD" })}
              {field("companyName", "Company name (optional)", "text", { placeholder: "Microsoft Corporation" })}
              {field("purchasePrice", "Purchase price", "number", { step: "0.01", min: "0", required: true })}
              {field("quantity", "Quantity", "number", { step: "any", min: "0", required: true })}
              {field("purchaseDate", "Purchase date", "date", { required: true })}
            </div>
            <div className="fdField" style={{ marginTop: 14 }}>
              <label htmlFor="fd-reason">Investment reason</label>
              <textarea
                id="fd-reason"
                required
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder="Why you bought this and what would make you sell."
              />
            </div>
            {errors.length ? (
              <div className="fdErrors"><ul>{errors.map((message, index) => <li key={index}>{message}</li>)}</ul></div>
            ) : null}
            <div className="fdFormActions">
              <button type="submit" className="fdButton" disabled={saving}>{saving ? "Saving..." : "Save investment"}</button>
              <button type="button" className="fdButton secondary" onClick={() => { setFormOpen(false); setErrors([]); }}>Cancel</button>
            </div>
          </form>
        ) : null}

        {loadError ? <FreedomNotice tone="red" title="Unable to load long-term holdings" message={loadError}>
          <button type="button" className="fdButton secondary" onClick={load}>Retry</button>
        </FreedomNotice> : null}

        {data?.marketDataFailure ? (
          <FreedomNotice
            tone="red"
            title="Market data failure"
            message={data.marketDataError || "Freedom could not obtain live prices. Purchase details below are correct; current values are unavailable."}
          />
        ) : null}

        {totals && holdings.length ? (
          <section className="fdTotals" aria-label="Portfolio totals">
            <div><span>Holdings</span><strong>{totals.holdings}</strong></div>
            <div><span>Amount invested</span><strong>{formatMoney(totals.amountInvested, "AUD")}</strong></div>
            <div><span>Current value</span><strong>{formatMoney(totals.currentValue, "AUD")}</strong></div>
            <div className={totals.profitLoss >= 0 ? "fdTone-green" : "fdTone-red"}>
              <span>Profit / loss</span><strong>{formatSignedMoney(totals.profitLoss, "AUD")}</strong>
            </div>
            <div className={totals.profitLoss >= 0 ? "fdTone-green" : "fdTone-red"}>
              <span>Return</span><strong>{formatPercent(totals.profitLossPercent)}</strong>
            </div>
            {totals.unpricedHoldings ? (
              <div className="fdTone-grey"><span>No market data</span><strong>{totals.unpricedHoldings}</strong></div>
            ) : null}
          </section>
        ) : null}

        {!loading && !loadError && data?.ok && !holdings.length ? (
          <FreedomNotice
            tone="grey"
            title="No long-term investments yet"
            message="Add Microsoft or any other long-term holding with the button above."
          />
        ) : null}

        <div className="fdHoldingGrid">
          {holdings.map((holding) => (
            <HoldingCard key={holding.id} holding={holding} onDelete={remove} />
          ))}
        </div>

        <style jsx>{`
          .fdHoldingGrid {
            display: grid;
            gap: 22px;
            grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          }
          .fdTotals { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
          .fdTotals div {
            background: var(--fd-panel);
            border: 1px solid var(--fd-line);
            border-left: 5px solid var(--tone, var(--fd-line));
            border-radius: 10px;
            min-width: 160px;
            padding: 14px 18px;
          }
          .fdTotals span {
            color: var(--fd-ink-dim);
            display: block;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.4px;
            text-transform: uppercase;
          }
          .fdTotals strong { font-size: 24px; font-weight: 900; }
          @media (max-width: 620px) {
            .fdHoldingGrid { grid-template-columns: 1fr; }
          }
        `}</style>
      </FreedomShell>
    </>
  );
}
