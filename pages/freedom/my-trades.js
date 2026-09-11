import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { supabase } from "../../lib/supabaseClient";

import FreedomShell, {
  FreedomNotice,
  formatMoney,
  formatPercent,
  formatSignedMoney,
  formatTimestamp,
} from "../../components/freedom/FreedomShell.js";
import FreedomTradeChart from "../../components/freedom/FreedomTradeChart.js";
import { authenticatedHeaders, loadPortfolio } from "../../lib/freedom/portfolioClient.js";

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

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function textOrNull(value) {
  const text = String(value || "").trim();
  return text || null;
}

// Symbols the user watches closely regardless of computed distance-to-limit.
const CLOSE_WATCH_SYMBOLS = ["CMG", "CLSK"];

// How often the Pending Orders Monitor refreshes live prices and distances on its own.
const PENDING_REFRESH_INTERVAL_MS = 60_000;

/** Alert metadata for one pending order row in the monitor. */
function pendingAlertFlags(trade) {
  if (CLOSE_WATCH_SYMBOLS.includes(trade.symbol)) return { within3: true, watchlist: true };
  const distance = Math.abs(numberOrNull(trade.distanceFromLimitPercent) ?? Infinity);
  return { within3: distance <= 3, watchlist: false };
}

function dateInputValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function marketMoney(value, currency) {
  if (value == null) return "--";
  const formatted = formatMoney(value, currency);
  return currency === "USD" ? formatted.replace("$", "US$") : formatted;
}

function holdingPrice(value, currency = "AUD") {
  if (value === null || value === undefined) return "Not recorded";
  return `${currency === "USD" ? "US$" : "A$"}${Number(value).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

function chartIdentity(record = {}) {
  const marketSnapshot = record.cmcSnapshot || record.pendingSellOrders?.find(order => order.cmcSnapshot?.currency)?.cmcSnapshot;
  return {
    symbol: String(record.symbol || "").trim().toUpperCase(),
    exchange: String(record.exchange || record.cmcSnapshot?.exchange || "").trim().toUpperCase(),
    currency: String(record.nativeCurrency || marketSnapshot?.currency || record.currency || "AUD").trim().toUpperCase(),
  };
}

function validatedChartCandles(candles = []) {
  return (Array.isArray(candles) ? candles : [])
    .map((candle) => ({
      date: candle.date,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume) || 0,
    }))
    .filter((candle) => (
      candle.date
      && Number.isFinite(candle.open)
      && Number.isFinite(candle.high)
      && Number.isFinite(candle.low)
      && Number.isFinite(candle.close)
      && candle.high >= candle.low
      && candle.high >= Math.max(candle.open, candle.close)
      && candle.low <= Math.min(candle.open, candle.close)
    ))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function chartEntryPrice(record = {}) {
  if (record.brokerHoldingSnapshot) return record.nativeCurrency === (record.purchasePriceCurrency || "AUD") ? record.purchasePrice : null;
  // A broker's AUD cost basis cannot be plotted on a USD market-price chart.
  if (record.currency && record.currency.toUpperCase() !== chartIdentity(record).currency) return null;
  return numberOrNull(record.averageFilledPrice) ?? numberOrNull(record.purchasePrice) ?? numberOrNull(record.entryPrice);
}

function chartCurrentPrice(record = {}, loadedPrice = null) {
  if (record.brokerHoldingSnapshot) return record.nativeCurrentPrice;
  return numberOrNull(loadedPrice) ?? numberOrNull(record.currentPrice) ?? numberOrNull(record.cmcSnapshot?.currentPrice);
}

function chartTargets(record = {}) {
  const targets = [];
  if (Array.isArray(record.pendingSellOrders)) {
    targets.push(...record.pendingSellOrders.map((order) => numberOrNull(order.targetPrice)));
  }
  targets.push(numberOrNull(record.targetPrice));
  targets.push(numberOrNull(record.takeSomeProfit));
  targets.push(numberOrNull(record.finalExit));
  return [...new Set(targets.filter((target) => target !== null))];
}

function editableInitialState(record = {}, recordType) {
  if (!record) return {};
  if (recordType === "holding" || recordType === "shortHolding") {
    return {
      classification: record.kind === "short-term" ? "short-term" : "long-term",
      quantity: record.quantity ?? "",
      purchasePrice: record.purchasePrice ?? "",
      targetPrice: record.targetPrice ?? "",
      safetyExit: record.safetyExit ?? "",
    };
  }
  return {
    classification: record.termClassification === "long-term" ? "long-term" : "short-term",
    quantity: record.quantity ?? "",
    entryPrice: record.entryPrice ?? "",
    takeSomeProfit: record.takeSomeProfit ?? "",
    safetyExit: record.safetyExit ?? "",
    status: record.status || "pending",
    orderStatus: record.orderStatus || "",
    filledQuantity: record.filledQuantity ?? "",
    averageFilledPrice: record.averageFilledPrice ?? "",
    expiry: dateInputValue(record.expiry),
    goodTillCancelled: Boolean(record.goodTillCancelled),
  };
}

function editablePayload(record = {}, recordType, formData = {}, dirtyFields = new Set()) {
  const touched = (name) => dirtyFields.has(name);
  if (recordType === "holding" || recordType === "shortHolding") {
    const payload = { id: record.id };
    if (touched("classification")) {
      payload.kind = formData.classification;
      payload.termClassification = formData.classification;
    }
    if (touched("quantity")) payload.quantity = numberOrNull(formData.quantity);
    if (touched("purchasePrice")) payload.purchasePrice = numberOrNull(formData.purchasePrice);
    if (touched("targetPrice")) payload.targetPrice = numberOrNull(formData.targetPrice);
    if (touched("safetyExit")) payload.safetyExit = numberOrNull(formData.safetyExit);
    return payload;
  }
  const payload = { id: record.id };
  if (touched("classification")) payload.termClassification = formData.classification;
  if (touched("quantity")) payload.quantity = numberOrNull(formData.quantity);
  if (touched("entryPrice")) payload.entryPrice = numberOrNull(formData.entryPrice);
  if (touched("takeSomeProfit")) payload.takeSomeProfit = numberOrNull(formData.takeSomeProfit);
  if (touched("safetyExit")) payload.safetyExit = numberOrNull(formData.safetyExit);
  if (touched("status")) payload.status = formData.status || "pending";
  if (touched("orderStatus")) payload.orderStatus = textOrNull(formData.orderStatus);
  if (touched("filledQuantity")) payload.filledQuantity = numberOrNull(formData.filledQuantity);
  if (touched("averageFilledPrice")) payload.averageFilledPrice = numberOrNull(formData.averageFilledPrice);
  if (touched("expiry") || touched("goodTillCancelled")) {
    payload.expiry = formData.goodTillCancelled ? null : textOrNull(formData.expiry);
    payload.goodTillCancelled = Boolean(formData.goodTillCancelled);
  }
  return payload;
}

/**
 * Chart Modal - Displays full-screen chart with price levels
 */
function ChartModal({ record, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState({ candles: [], currentPrice: null, provider: null });
  const identity = useMemo(() => chartIdentity(record || {}), [record]);

  useEffect(() => {
    if (!isOpen || !record) return undefined;

    const controller = new AbortController();
    const loadChart = async () => {
      setLoading(true);
      setError(null);
      setChartData({ candles: [], currentPrice: null, provider: null });

      try {
        if (!identity.symbol) throw new Error("Chart data cannot load because this record has no ticker.");
        
        const headers = await authenticatedHeaders(supabase.auth);
        
        const params = new URLSearchParams({
          symbol: identity.symbol,
          exchange: identity.exchange,
          currency: identity.currency,
        });
        const response = await fetch(`/api/freedom/chart?${params.toString()}`, { 
          signal: controller.signal,
          headers,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Chart data could not load.");
        if (!payload.ok) throw new Error(payload.error || "Chart data could not load.");

        const candles = validatedChartCandles(payload.candles);
        if (candles.length < 2) throw new Error("Chart data could not load: not enough valid historical candles.");

        setChartData({
          candles,
          currentPrice: payload.currentPrice ?? null,
          provider: payload.provider || null,
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Chart data could not load.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadChart();
    return () => controller.abort();
  }, [identity.currency, identity.exchange, identity.symbol, isOpen, record]);

  if (!isOpen || !record) return null;

  const currency = identity.currency || "AUD";
  const targets = chartTargets(record);
  const currentPrice = chartCurrentPrice(record, chartData.currentPrice);

  return (
    <>
      <div
        className="fdChartBackdrop"
        onClick={onClose}
        role="presentation"
        style={{
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.5)",
          bottom: 0,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          left: 0,
          overflowY: "auto",
          padding: 20,
          position: "fixed",
          right: 0,
          top: 0,
          zIndex: 99,
        }}
      >
      <div className="fdChartModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="fdChartModalHeader">
          <div>
            <h2>{identity.symbol} - {record.companyName || identity.exchange}</h2>
            <p>{identity.exchange || "Exchange not recorded"} / {currency}</p>
          </div>
          <button type="button" className="fdCloseButton" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="fdChartContainer">
          {loading ? (
            <div className="fdChartStatus">Loading chart...</div>
          ) : error ? (
            <div className="fdChartError" role="alert">
              <p>{error}</p>
              <p>The selected trade has not been changed.</p>
            </div>
          ) : (
            <FreedomTradeChart
              candles={chartData.candles}
              entryPrice={chartEntryPrice(record)}
              entryLabel={record.brokerHoldingSnapshot?.fifoPrice != null ? "FIFO (rounded)" : "Entry"}
              currentPrice={currentPrice}
              safetyExit={record.safetyExit}
              targets={targets}
              height={400}
              ariaLabel={`${identity.symbol} chart`}
            />
          )}
        </div>

        {record.brokerHoldingSnapshot && record.nativeCurrency !== record.purchasePriceCurrency && <p>Average buy {holdingPrice(record.purchasePrice, record.purchasePriceCurrency)}; native execution price not supplied.</p>}
        <div className="fdChartLegend">
          <div className="fdLegendItem">
            <span className="fdLegendColor fdColorBlue" />
            <span>{record.brokerHoldingSnapshot?.fifoPrice != null ? "FIFO Price (rounded)" : "Entry/Buy Price"}</span>
          </div>
          <div className="fdLegendItem">
            <span className="fdLegendColor fdColorBlack" />
            <span>Current Price</span>
          </div>
          {targets.length > 0 && (
            <div className="fdLegendItem">
              <span className="fdLegendColor fdColorGreen" />
              <span>Target/Take-Profit</span>
            </div>
          )}
          {record.safetyExit && (
            <div className="fdLegendItem">
              <span className="fdLegendColor fdColorRed" />
              <span>Safety Exit</span>
            </div>
          )}
        </div>

        <style jsx>{`
          .fdChartBackdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow-y: auto;
            padding: 20px;
          }
          .fdChartModal {
            position: relative;
            width: 90%;
            max-width: 1000px;
            max-height: 90vh;
            background: var(--fd-panel);
            border: 1px solid var(--fd-line);
            border-radius: 14px;
            padding: 20px;
            z-index: 100;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            cursor: default;
          }
          .fdChartModalHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--fd-line);
          }
          .fdChartModalHeader h2 {
            font-size: 20px;
            font-weight: 900;
            margin: 0;
          }
          .fdChartModalHeader p {
            color: var(--fd-ink-dim);
            font-size: 12px;
            margin: 5px 0 0;
          }
          .fdCloseButton {
            background: transparent;
            border: 0;
            color: var(--fd-ink-dim);
            cursor: pointer;
            font-size: 24px;
            font-weight: 900;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background 0.2s;
          }
          .fdCloseButton:hover {
            background: var(--fd-panel-2);
            color: var(--fd-ink);
          }
          .fdChartContainer {
            background: var(--fd-panel-2);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .fdChartError {
            text-align: center;
            color: var(--fd-ink-dim);
            padding: 40px 20px;
          }
          .fdChartStatus {
            color: var(--fd-ink-dim);
            font-size: 14px;
            font-weight: 700;
          }
          .fdChartError p {
            margin: 8px 0;
            font-size: 14px;
          }
          .fdChartLegend {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            padding: 14px;
            background: var(--fd-panel-2);
            border-radius: 8px;
          }
          .fdLegendItem {
            display: flex;
            gap: 8px;
            align-items: center;
            font-size: 12px;
          }
          .fdLegendColor {
            width: 12px;
            height: 12px;
            border-radius: 2px;
          }
          .fdColorBlue { background: #3b82f6; }
          .fdColorBlack { background: #000; }
          .fdColorGreen { background: #22c55e; }
          .fdColorRed { background: #ef4444; }
        `}</style>
      </div>
      </div>
    </>
  );
}

/**
 * Edit Modal - Editable form for record
 */
function EditModal({ record, isOpen, onClose, onSave, recordType }) {
  const [formData, setFormData] = useState(() => editableInitialState(record, recordType));
  const [dirtyFields, setDirtyFields] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setFormData(editableInitialState(record, recordType));
    setDirtyFields(new Set());
    setError(null);
  }, [record, recordType]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { checked, name, type, value } = e.target;
    setDirtyFields((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = editablePayload(record, recordType, formData, dirtyFields);
      if (Object.keys(payload).length === 1) {
        onSave(recordType);
        return;
      }
      
      const headers = await authenticatedHeaders(supabase.auth, true);
      
      const endpoint = recordType === "holding" ? "/api/freedom/long-term" : "/api/freedom/trades";
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.errors?.[0] || "Failed to save");
      }

      onSave(recordType);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fdEditBackdrop"
        onClick={onClose}
        role="presentation"
        style={{
          alignItems: "center",
          background: "rgba(0, 0, 0, 0.5)",
          bottom: 0,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          left: 0,
          overflowY: "auto",
          padding: 20,
          position: "fixed",
          right: 0,
          top: 0,
          zIndex: 99,
        }}
      >
      <div className="fdEditModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="fdEditModalHeader">
          <h2>Edit {record.symbol}</h2>
          <button type="button" className="fdCloseButton" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="fdEditForm">
          {error && <div className="fdEditError">{error}</div>}

          <div className="fdFormGroup">
            <label htmlFor="classification">Classification</label>
            <select
              id="classification"
              name="classification"
              value={formData.classification || (recordType === "holding" ? "long-term" : "short-term")}
              onChange={handleChange}
            >
              <option value="short-term">Short-Term</option>
              <option value="long-term">Long-Term</option>
            </select>
          </div>

          <div className="fdFormGroup">
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              type="number"
              name="quantity"
              value={formData.quantity || ""}
              onChange={handleChange}
              step="1"
              min="0"
            />
          </div>

          {(recordType === "holding" || recordType === "shortHolding") ? (
            <>
              <div className="fdFormGroup">
                <label htmlFor="purchasePrice">{record.brokerHoldingSnapshot?.fifoPrice != null ? "FIFO Price (rounded)" : "Average Buy Price"} ({record.purchasePriceCurrency || record.currency})</label>
                <input
                  id="purchasePrice"
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="targetPrice">Target Sell Price ({record.nativeCurrency || record.currency})</label>
                <input
                  id="targetPrice"
                  type="number"
                  name="targetPrice"
                  value={formData.targetPrice || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="safetyExit">Safety Exit ({record.nativeCurrency || record.currency})</label>
                <input
                  id="safetyExit"
                  type="number"
                  name="safetyExit"
                  value={formData.safetyExit || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
            </>
          ) : (
            <>
              <div className="fdFormGroup">
                <label htmlFor="entryPrice">Buy Limit ({record.currency})</label>
                <input
                  id="entryPrice"
                  type="number"
                  name="entryPrice"
                  value={formData.entryPrice || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="takeSomeProfit">Take-Profit Target ({record.currency})</label>
                <input
                  id="takeSomeProfit"
                  type="number"
                  name="takeSomeProfit"
                  value={formData.takeSomeProfit || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="safetyExit">Safety Exit ({record.nativeCurrency || record.currency})</label>
                <input
                  id="safetyExit"
                  type="number"
                  name="safetyExit"
                  value={formData.safetyExit || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="filledQuantity">Filled Quantity</label>
                <input
                  id="filledQuantity"
                  type="number"
                  name="filledQuantity"
                  value={formData.filledQuantity || ""}
                  onChange={handleChange}
                  step="1"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="averageFilledPrice">Average Filled Price ({record.currency})</label>
                <input
                  id="averageFilledPrice"
                  type="number"
                  name="averageFilledPrice"
                  value={formData.averageFilledPrice || ""}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="fdFormGroup">
                <label htmlFor="status">Freedom Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || "pending"}
                  onChange={handleChange}
                >
                  <option value="pending">Pending</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="fdFormGroup">
                <label htmlFor="orderStatus">Order Status</label>
                <select
                  id="orderStatus"
                  name="orderStatus"
                  value={formData.orderStatus || ""}
                  onChange={handleChange}
                >
                  <option value="">Select status</option>
                  <option value="Waiting for Entry">Waiting for Entry</option>
                  <option value="Waiting for Market to Open">Waiting for Market to Open</option>
                  <option value="Open">Open</option>
                  <option value="Filled">Filled</option>
                  <option value="Expired">Expired</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="fdFormGroup">
                <label htmlFor="expiry">Expiry</label>
                <input
                  id="expiry"
                  type="date"
                  name="expiry"
                  value={formData.expiry || ""}
                  onChange={handleChange}
                  disabled={formData.goodTillCancelled}
                />
              </div>
              <label className="fdCheckboxRow" htmlFor="goodTillCancelled">
                <input
                  id="goodTillCancelled"
                  type="checkbox"
                  name="goodTillCancelled"
                  checked={Boolean(formData.goodTillCancelled)}
                  onChange={handleChange}
                />
                <span>Good Till Cancelled</span>
              </label>
            </>
          )}

          <p className="fdEditNote">
            ⚠️ Editing this record in Freedom does not amend or cancel the CMC broker order.
            Editing Freedom does not amend the CMC broker order. Changes are local only.
          </p>
        </div>

        <div className="fdEditActions">
          <button
            type="button"
            className="fdButton primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="fdButton secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          .fdEditBackdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow-y: auto;
            padding: 20px;
          }
          .fdEditModal {
            position: relative;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            background: var(--fd-panel);
            border: 1px solid var(--fd-line);
            border-radius: 14px;
            padding: 20px;
            z-index: 100;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            cursor: default;
          }
          .fdEditModalHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--fd-line);
          }
          .fdEditModalHeader h2 {
            font-size: 18px;
            font-weight: 900;
            margin: 0;
          }
          .fdCloseButton {
            background: transparent;
            border: 0;
            color: var(--fd-ink-dim);
            cursor: pointer;
            font-size: 24px;
            font-weight: 900;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background 0.2s;
          }
          .fdCloseButton:hover {
            background: var(--fd-panel-2);
            color: var(--fd-ink);
          }
          .fdEditForm {
            margin-bottom: 20px;
          }
          .fdFormGroup {
            margin-bottom: 14px;
            display: grid;
            gap: 6px;
          }
          .fdFormGroup label {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: var(--fd-ink-dim);
          }
          .fdFormGroup input,
          .fdFormGroup select {
            background: var(--fd-panel-2);
            border: 1px solid var(--fd-line);
            border-radius: 6px;
            color: var(--fd-ink);
            font-size: 14px;
            padding: 8px 10px;
            font-family: inherit;
          }
          .fdFormGroup input:focus,
          .fdFormGroup select:focus {
            outline: 0;
            border-color: var(--fd-accent);
            background: var(--fd-panel);
          }
          .fdCheckboxRow {
            align-items: center;
            color: var(--fd-ink-dim);
            display: flex;
            font-size: 12px;
            font-weight: 700;
            gap: 8px;
            margin-bottom: 14px;
          }
          .fdCheckboxRow input {
            margin: 0;
          }
          .fdEditError {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            font-size: 12px;
            padding: 10px 12px;
            border-radius: 6px;
            margin-bottom: 14px;
          }
          .fdEditNote {
            background: rgba(251, 146, 60, 0.1);
            border: 1px solid rgba(251, 146, 60, 0.3);
            color: var(--fd-ink-dim);
            font-size: 11px;
            padding: 10px 12px;
            border-radius: 6px;
            margin: 14px 0 0;
          }
          .fdEditActions {
            display: flex;
            gap: 8px;
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
          .fdButton:hover:not(:disabled) {
            background: var(--fd-line);
          }
          .fdButton.primary {
            background: var(--fd-accent);
            color: #fff;
            border-color: var(--fd-accent);
          }
          .fdButton.primary:hover:not(:disabled) {
            background: var(--fd-accent-hot);
          }
          .fdButton:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
      </div>
    </>
  );
}

const ADD_TRADE_EMPTY_FORM = {
  symbol: "", exchange: "US", broker: "", entryPrice: "", quantity: "",
  entryDate: new Date().toISOString().slice(0, 10), safetyExit: "", takeSomeProfit: "",
  finalExit: "", status: "open", currency: "USD", notes: "",
};

/**
 * Add Trade Form - restores the ability to enter a short-term trade manually.
 * Posts straight through the existing authenticated /api/freedom/trades contract.
 */
function AddTradeForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(ADD_TRADE_EMPTY_FORM);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const field = (name, label, type = "text", extra = {}) => (
    <div className="fdField">
      <label htmlFor={"fd-add-" + name}>{label}</label>
      <input
        id={"fd-add-" + name}
        type={type}
        value={form[name]}
        onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))}
        {...extra}
      />
    </div>
  );

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const res = await fetch("/api/freedom/trades", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setErrors(payload.errors || ["The trade could not be saved."]);
        return;
      }
      setForm(ADD_TRADE_EMPTY_FORM);
      onSaved?.();
    } catch (err) {
      setErrors([err.message || "The trade could not be saved."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="fdForm" onSubmit={submit}>
      <h2>Add a short-term trade</h2>
      <p className="fdFormHint">Recorded straight into My Trades. Safety Exit and profit targets are required so risk is defined before the trade goes live.</p>
      <div className="fdFormGrid">
        {field("symbol", "Ticker", "text", { placeholder: "AAPL", required: true })}
        {field("exchange", "Exchange", "text", { placeholder: "US", required: true })}
        {field("broker", "Broker", "text", { placeholder: "CMC" })}
        {field("currency", "Currency", "text", { placeholder: "USD" })}
        {field("entryPrice", "Entry / Buy Price", "number", { step: "0.001", min: "0", required: true })}
        {field("quantity", "Quantity", "number", { step: "any", min: "0", required: true })}
        {field("entryDate", "Entry Date", "date", { required: true })}
        {field("safetyExit", "Safety Exit", "number", { step: "0.001", min: "0", required: true })}
        {field("takeSomeProfit", "Take Some Profit", "number", { step: "0.001", min: "0", required: true })}
        {field("finalExit", "Final Exit", "number", { step: "0.001", min: "0", required: true })}
        <div className="fdField">
          <label htmlFor="fd-add-status">Status</label>
          <select
            id="fd-add-status"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="pending">Pending (waiting for entry)</option>
            <option value="open">Open (already holding)</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div className="fdField" style={{ marginTop: 14 }}>
        <label htmlFor="fd-add-notes">Notes</label>
        <textarea
          id="fd-add-notes"
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Trade plan, reason for entry, anything worth remembering."
        />
      </div>
      {errors.length ? (
        <div className="fdErrors"><ul>{errors.map((message, index) => <li key={index}>{message}</li>)}</ul></div>
      ) : null}
      <div className="fdFormActions">
        <button type="submit" className="fdButton" disabled={saving}>{saving ? "Saving..." : "Save Trade"}</button>
        <button type="button" className="fdButton secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
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
          <strong>{marketMoney(sellOrder.targetPrice, currency)}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Current Price</span>
          <strong>{marketMoney(sellOrder.currentPrice, currency)}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Distance to Target</span>
          <strong>{marketMoney(sellOrder.distanceToTarget, currency)} ({formatPercent(sellOrder.distanceToTargetPercent)})</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Quantity</span>
          <strong>{sellOrder.quantity}</strong>
        </div>
        <div className="fdSellOrderRow">
          <span className="fdLabel">Potential Movement</span>
          <strong>{marketMoney(sellOrder.potentialMovement, currency)}</strong>
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
function HoldingCard({ holding, onSetTarget, onSetSafetyExit, onViewChart, onEdit, onDelete }) {
  const currency = holding.valuationCurrency || holding.currency || "AUD";
  const nativeCurrency = holding.nativeCurrency || holding.currency || "AUD";
  const snapshot = holding.brokerHoldingSnapshot;
  const isStockHoldings = snapshot?.type === "stock-holdings";
  const priceChange = numberOrNull(snapshot?.nativePriceChange);
  
  return (
    <article className={"fdHoldingCard fdTone-" + holding.tone} data-record-id={holding.id} data-symbol={holding.symbol}>
      <header className="fdHoldingCardHead">
        <div>
          <h2>{holding.symbol}{holding.exchange === "US" ? ":US" : ""} <small>{holding.exchange}</small></h2>
          <p>{holding.companyName || holding.exchange || "Holding"}</p>
        </div>
        <span className="fdHoldingBadge">{isStockHoldings && snapshot.openSells > 0 ? "SELL PENDING" : "ACTIVE HOLDING"}</span>
      </header>

      <div className="fdHoldingChart">
        <FreedomTradeChart
          candles={holding.candles || []}
          entryPrice={chartEntryPrice(holding)}
          entryLabel={holding.brokerHoldingSnapshot?.fifoPrice != null ? "FIFO (rounded)" : "Entry"}
          currentPrice={chartCurrentPrice(holding)}
          safetyExit={holding.safetyExit}
          targets={chartTargets(holding)}
          height={200}
          ariaLabel={`${holding.symbol} historical price chart`}
        />
      </div>

      {holding.brokerHoldingSnapshot && nativeCurrency !== holding.purchasePriceCurrency && (
        <p className="fdHoldingStamp">Average buy {holdingPrice(holding.purchasePrice, holding.purchasePriceCurrency || "AUD")}. Native execution price{snapshot.fxRate == null ? " and FX rate were" : " was"} not supplied; the average buy price is not plotted on the {nativeCurrency} chart.</p>
      )}
      {snapshot?.costBasisSourceSnapshotId && <p className="fdHoldingStamp">Average buy price and total cost are retained from the earlier CMC snapshot.</p>}
      {holding.brokerHoldingSnapshot?.fifoPrice != null && <p className="fdHoldingStamp">Tiger Brokers position. FIFO is rounded; exact cost, execution details and AUD conversion were not supplied. Excluded from the CMC AUD summary.</p>}
      <dl className="fdHoldingStats">
        <div className="fdStat">
          <dt>Quantity Owned</dt>
          <dd>{holding.quantity}</dd>
        </div>
        <div className="fdStat">
          <dt>{holding.brokerHoldingSnapshot?.fifoPrice != null ? "FIFO Price (rounded)" : "Average Buy Price"} ({holding.purchasePriceCurrency || currency})</dt>
          <dd>{holdingPrice(holding.purchasePrice, holding.purchasePriceCurrency || currency)}</dd>
        </div>
        <div className="fdStat">
          <dt>Total Cost</dt>
          <dd>{holding.amountInvested == null ? "Not supplied" : marketMoney(holding.amountInvested, currency)}</dd>
        </div>
        <div className="fdStat">
          <dt>Current Price ({nativeCurrency})</dt>
          <dd>{holding.dataAvailable ? holdingPrice(holding.currentPrice, nativeCurrency) : "No data"}</dd>
        </div>
        <div className="fdStat">
          <dt>{isStockHoldings ? "CMC Table Value (AUD)" : "Market Value"}</dt>
          <dd>{holding.dataAvailable ? marketMoney(holding.currentValue, currency) : "--"}</dd>
        </div>
        <div className="fdStat">
          <dt>Market Status</dt>
          <dd className="fdMarketStatus">{holding.marketStatus || "Unknown"}</dd>
        </div>
      </dl>

      {isStockHoldings && <>
        <dl className="fdHoldingStats">
          <div className="fdStat">
            <dt>Price Change ({nativeCurrency})</dt>
            <dd>{priceChange == null ? "Not supplied" : `${priceChange > 0 ? "+" : priceChange < 0 ? "-" : ""}${holdingPrice(Math.abs(priceChange), nativeCurrency)}`}</dd>
          </div>
          <div className="fdStat">
            <dt>Price Change %</dt>
            <dd>{snapshot.priceChangePercent == null ? "Not supplied" : formatPercent(snapshot.priceChangePercent)}</dd>
          </div>
          <div className="fdStat">
            <dt>CMC FX Rate</dt>
            <dd>{snapshot.fxRate == null ? "Not supplied" : Number(snapshot.fxRate).toFixed(3)}</dd>
          </div>
          {[["Recent Buys", "recentBuys"], ["Recent Sells", "recentSells"], ["Open Sells", "openSells"], ["Conditional Orders", "conditionalOrders"], ["Available to Sell", "availableToSell"]].map(([label, key]) => (
            <div className="fdStat" key={key}>
              <dt>{label}</dt>
              <dd>{snapshot[key] ?? "Not supplied"}</dd>
            </div>
          ))}
        </dl>
        {snapshot.marketValueAud === 0 && snapshot.openSells > 0 && <p className="fdHoldingStamp">CMC shows a zero table value with {snapshot.openSells} shares on open sell orders. You still hold {holding.quantity} shares; execution is not confirmed.</p>}
        {snapshot.conditionalOrders !== 0 && snapshot.conditionalOrders != null && <p className="fdHoldingStamp">Conditional orders do not reduce the available-to-sell quantity until triggered.</p>}
        {holding.profitLoss == null && <p className="fdHoldingStamp">Per-holding P&amp;L and return were not supplied in this stock holdings snapshot.</p>}
      </>}

      {holding.dataAvailable && holding.profitLoss != null && (
        <div className="fdHoldingPL">
          <div>
            <span className="fdLabel">Profit/Loss</span>
            <strong className="fdAmount">
              {currency === "USD" ? formatSignedMoney(holding.profitLoss, currency).replace("$", "US$") : formatSignedMoney(holding.profitLoss, currency)}
            </strong>
          </div>
          <div>
            <span className="fdLabel">Return</span>
            <strong className="fdPercent">
              {holding.profitLossPercent == null ? "Not supplied" : formatPercent(holding.profitLossPercent)}
            </strong>
          </div>
        </div>
      )}

      {/* Display attached sell orders */}
      {holding.pendingSellOrders && holding.pendingSellOrders.length > 0 && (
        <div className="fdPendingSellOrders">
          <h4>Pending Sell Orders</h4>
          {holding.pendingSellOrders.map(sellOrder => (
            <SellOrderDisplay key={sellOrder.id} sellOrder={sellOrder} holdingCurrency={nativeCurrency} />
          ))}
        </div>
      )}

      <div className="fdHoldingTargets">
        <div className="fdTargetRow">
          <span className="fdTargetLabel">Manual Target Sell</span>
          <span className="fdTargetValue">
            {holding.targetPrice 
              ? `${marketMoney(holding.targetPrice, nativeCurrency)} (${holding.distanceToTargetPercent !== null ? formatPercent(holding.distanceToTargetPercent) : '--'} away)`
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
              ? `${marketMoney(holding.safetyExit, nativeCurrency)} (${holding.distanceToSafetyExitPercent !== null ? formatPercent(holding.distanceToSafetyExitPercent) : '--'} away)`
              : "Safety Exit not set"}
          </span>
          <button type="button" className="fdTargetButton" onClick={() => onSetSafetyExit(holding)}>
            {holding.safetyExit ? "Edit" : "Set"}
          </button>
        </div>
      </div>

      <p className="fdHoldingStamp">
        {holding.brokerHoldingSnapshot
          ? `${holding.brokerHoldingSnapshot.broker || "CMC"} snapshot - quote time not supplied - imported ${formatTimestamp(holding.brokerHoldingSnapshot.importedAt)}`
          : holding.dataAvailable && holding.dataTimestamp ? `Price as at ${formatTimestamp(holding.dataTimestamp)}` : "Market data unavailable"}
      </p>

      <div className="fdHoldingActions">
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onViewChart?.(holding); }}>
          View Full Chart
        </button>
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onEdit?.(holding); }}>
          Edit Holding
        </button>
        {onDelete ? (
          <button type="button" className="fdButton danger" onClick={(event) => { event.stopPropagation(); onDelete(holding); }}>
            Delete
          </button>
        ) : null}
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
        .fdButton.danger {
          background: transparent;
          border-color: rgba(217, 68, 68, 0.5);
          color: #ff9d9d;
          flex: 0 0 auto;
        }
      `}</style>
    </article>
  );
}

/**
 * Pending Buy Order Card - Shows unfilled buy orders (not yet owned)
 */
const IMPORT_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.csv,.txt";

/** One editable row in the import review table. Nothing is saved until Confirm is pressed. */
function ImportReviewRow({ row, onToggle, onEdit }) {
  return (
    <tr className={row.reviewStatus === "REVIEW_REQUIRED" ? "fdImportRowReview" : ""}>
      <td><input type="checkbox" checked={Boolean(row.checked)} onChange={(event) => onToggle(row, event.target.checked)} /></td>
      <td><input className="fdImportCell" value={row.symbol || ""} onChange={(event) => onEdit(row, "symbol", event.target.value.toUpperCase())} /></td>
      <td>{row.side}</td>
      <td>{row.classification}</td>
      <td><input className="fdImportCell" type="number" step="any" value={row.quantity ?? ""} onChange={(event) => onEdit(row, "quantity", event.target.value)} /></td>
      <td><input className="fdImportCell" type="number" step="any" value={row.limitPrice ?? ""} onChange={(event) => onEdit(row, "limitPrice", event.target.value)} /></td>
      <td>{row.currency}</td>
      <td>
        <select value={row.termClassification || "short-term"} onChange={(event) => onEdit(row, "termClassification", event.target.value)}>
          <option value="short-term">Short-Term</option>
          <option value="long-term">Long-Term</option>
        </select>
      </td>
      <td>{row.uncertainFields?.length ? <span className="fdImportWarning">Review: {row.uncertainFields.join(", ")}</span> : "Ready"}</td>
      <style jsx>{`
        tr.fdImportRowReview { background: rgba(251, 146, 60, 0.08); }
        td { border-bottom: 1px solid var(--fd-line); font-size: 12px; padding: 6px 8px; vertical-align: middle; }
        .fdImportCell { background: var(--fd-panel-2); border: 1px solid var(--fd-line); border-radius: 4px; color: var(--fd-ink); font-size: 12px; padding: 4px 6px; width: 100%; }
        .fdImportWarning { color: #fb923c; font-weight: 700; }
        select { background: var(--fd-panel-2); border: 1px solid var(--fd-line); border-radius: 4px; color: var(--fd-ink); font-size: 12px; padding: 4px; }
      `}</style>
    </tr>
  );
}

/**
 * Import Trades Panel - restores screenshot / CSV / pasted-text broker import.
 *
 * Nothing reaches the trade store until the user reviews the extracted rows and presses
 * Confirm. Duplicate imports are rejected by the existing workspace-scoped fingerprint
 * check in importReviewedTrades - re-importing the same source reports "already_imported".
 */
function ImportPanel({ onImported, onClose }) {
  const [sourceType, setSourceType] = useState("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [rows, setRows] = useState(null);
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reports, setReports] = useState(null);
  const fileInputRef = useRef(null);

  const loadImageBlob = useCallback((blob, name = "clipboard-image.png") => {
    setError(null);
    setRows(null);
    setReports(null);
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the clipboard image.");
    reader.onload = () => {
      setImage({ name, type: blob.type || "image/png", size: blob.size, dataUrl: reader.result });
      setSourceType("image");
      setText("");
    };
    reader.readAsDataURL(blob);
  }, []);

  const loadFile = useCallback((file) => {
    if (!file) return;
    setError(null);
    setRows(null);
    setReports(null);
    const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name || "");
    if (isImage) {
      loadImageBlob(file, file.name);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the selected file.");
    reader.onload = () => {
      setText(String(reader.result || ""));
      setImage(null);
      setSourceType("text");
    };
    reader.readAsText(file);
  }, [loadImageBlob]);

  const handleFileInputChange = (event) => {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleDragOver = (event) => event.preventDefault();

  const handlePaste = useCallback((event) => {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          loadImageBlob(blob);
          return;
        }
      }
    }
  }, [loadImageBlob]);

  const handleClipboardRead = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.clipboard?.read) throw new Error("This browser does not support reading the clipboard directly. Paste with Ctrl+V instead.");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          loadImageBlob(await item.getType(imageType));
          return;
        }
      }
      setError("No image was found on the clipboard. Copy a screenshot first.");
    } catch (err) {
      setError(err.message || "Could not read the clipboard.");
    }
  }, [loadImageBlob]);

  const extract = useCallback(async () => {
    setExtracting(true);
    setError(null);
    setReports(null);
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const body = sourceType === "image"
        ? { action: "extract", sourceType: "image", image }
        : { action: "extract", sourceType: "text", text };
      const res = await fetch("/api/freedom/import-trades", { method: "POST", headers, body: JSON.stringify(body) });
      const payload = await res.json();
      if (payload.ok === false) throw new Error(payload.error || "Could not read this source.");
      setWarning(payload.warning || null);
      setRows((payload.rows || []).map((row) => ({ ...row, checked: row.reviewStatus !== "REVIEW_REQUIRED" })));
    } catch (err) {
      setError(err.message || "Could not read this source.");
    } finally {
      setExtracting(false);
    }
  }, [image, sourceType, text]);

  const toggleRow = (row, checked) => {
    setRows((current) => current.map((item) => (item === row ? { ...item, checked } : item)));
  };

  const editRow = (row, key, value) => {
    setRows((current) => current.map((item) => {
      if (item !== row) return item;
      const nextValue = key === "quantity" || key === "limitPrice" ? numberOrNull(value) : value;
      const uncertainFields = (item.uncertainFields || []).filter((name) => name !== key);
      return { ...item, [key]: nextValue, uncertainFields, reviewStatus: uncertainFields.length ? "REVIEW_REQUIRED" : "READY" };
    }));
  };

  const confirm = useCallback(async () => {
    setConfirming(true);
    setError(null);
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const res = await fetch("/api/freedom/import-trades", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "confirm", rows }),
      });
      const payload = await res.json();
      if (!payload.reports) throw new Error(payload.error || "Import could not be saved.");
      setReports(payload.reports);
      onImported?.();
    } catch (err) {
      setError(err.message || "Import could not be saved.");
    } finally {
      setConfirming(false);
    }
  }, [onImported, rows]);

  return (
    <div className="fdForm fdImportPanel">
      <header className="fdImportHead">
        <h2>Import Trades</h2>
        <button type="button" className="fdButton secondary" onClick={onClose}>Close</button>
      </header>
      <p className="fdFormHint">
        Import CMC (or another broker&apos;s) open orders from a screenshot, CSV export, or pasted text.
        Nothing is saved until you review and confirm the rows below.
      </p>

      <div className="fdImportDropzone" onDrop={handleDrop} onDragOver={handleDragOver} onPaste={handlePaste} tabIndex={0}>
        <p>Drag a screenshot or file here, paste (Ctrl+V) a screenshot, or choose a file.</p>
        <div className="fdImportDropActions">
          <button type="button" className="fdButton secondary" onClick={() => fileInputRef.current?.click()}>Choose File</button>
          <button type="button" className="fdButton secondary" onClick={handleClipboardRead}>Paste Screenshot from Clipboard</button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.csv,.txt" onChange={handleFileInputChange} hidden />
        {image ? (
          <div className="fdImagePreview">
            <img src={image.dataUrl} alt="Broker screenshot preview" />
            <span>{image.name}</span>
            <button type="button" className="fdButton secondary" onClick={() => { setImage(null); setRows(null); }}>Remove</button>
          </div>
        ) : null}
      </div>

      {!image ? (
        <div className="fdField">
          <label htmlFor="fd-import-text">Or paste broker text / CSV</label>
          <textarea
            id="fd-import-text"
            value={text}
            onPaste={handlePaste}
            onChange={(event) => { setText(event.target.value); setSourceType("text"); }}
            placeholder="Paste open-order rows, e.g. MSFT:US - BUY - quantity 10 - limit US$470 - status Waiting for Entry"
          />
        </div>
      ) : null}

      {error ? <div className="fdErrors"><ul><li>{error}</li></ul></div> : null}
      {warning ? <p className="fdImportWarning">{warning}</p> : null}

      <div className="fdFormActions">
        <button type="button" className="fdButton" onClick={extract} disabled={extracting || (!text.trim() && !image)}>
          {extracting ? "Reading..." : "Read Orders"}
        </button>
      </div>

      {rows && rows.length ? (
        <>
          <div className="fdImportTableWrap">
            <table className="fdImportTable">
              <thead>
                <tr><th /><th>Ticker</th><th>Side</th><th>Classification</th><th>Qty</th><th>Limit</th><th>Ccy</th><th>Term</th><th>Review</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => <ImportReviewRow key={row.importFingerprint} row={row} onToggle={toggleRow} onEdit={editRow} />)}
              </tbody>
            </table>
          </div>
          <div className="fdFormActions">
            <button type="button" className="fdButton" onClick={confirm} disabled={confirming || !rows.some((row) => row.checked)}>
              {confirming ? "Saving..." : "Confirm & Save Selected"}
            </button>
          </div>
        </>
      ) : rows ? <p className="fdImportWarning">No open orders were found in this source.</p> : null}

      {reports ? (
        <div className="fdImportReports">
          <h3>Import result</h3>
          <ul>
            {reports.map((report, index) => (
              <li key={index}>{report.row?.symbol || "Row"}: {report.result}{report.reason ? " - " + report.reason : ""}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <style jsx>{`
        .fdImportPanel { margin-bottom: 26px; }
        .fdImportHead { align-items: center; display: flex; justify-content: space-between; margin-bottom: 6px; }
        .fdImportHead h2 { margin: 0; }
        .fdImportDropzone {
          background: var(--fd-panel-2);
          border: 2px dashed var(--fd-line);
          border-radius: 10px;
          margin: 14px 0;
          padding: 20px;
          text-align: center;
        }
        .fdImportDropzone p { color: var(--fd-ink-dim); font-size: 14px; margin: 0 0 12px; }
        .fdImportDropActions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .fdImagePreview { align-items: center; display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .fdImagePreview img { border-radius: 8px; max-height: 260px; max-width: 100%; }
        .fdImagePreview span { color: var(--fd-ink-dim); font-size: 12px; }
        .fdImportTableWrap { margin-top: 16px; overflow-x: auto; }
        .fdImportTable { border-collapse: collapse; width: 100%; }
        .fdImportTable th { border-bottom: 2px solid var(--fd-line); color: var(--fd-ink-dim); font-size: 11px; padding: 6px 8px; text-align: left; text-transform: uppercase; }
        .fdImportWarning { color: #fb923c; font-size: 13px; margin: 10px 0; }
        .fdImportReports { margin-top: 18px; }
        .fdImportReports h3 { font-size: 14px; margin: 0 0 8px; }
        .fdImportReports ul { margin: 0; padding-left: 20px; }
        .fdImportReports li { font-size: 13px; margin-bottom: 4px; }
      `}</style>
    </div>
  );
}

/**
 * Pending Orders Monitor - real stored pending orders only, never demo data.
 *
 * An order is not treated as a genuine, manageable broker order until it is either
 * imported from a broker source or explicitly confirmed by the user. Until then it shows
 * a Confirm control instead of the order-management actions.
 */
function PendingOrderMonitorCard({ trade, onAction, onConfirmReal, onViewChart, onEdit, onDelete }) {
  const currency = trade.currency || "USD";
  const isSell = trade.orderClassification === "PENDING_SELL_ORDER";
  const needsConfirmation = trade.importedOrder !== true && trade.manuallyConfirmedOrder !== true;
  const alert = pendingAlertFlags(trade);

  return (
    <article className={"fdMonitorCard" + (alert.within3 ? " fdMonitorAlert" : "")}>
      <header className="fdMonitorHead">
        <div>
          <h3>{trade.symbol} <small>{trade.exchange}</small></h3>
          <p>{trade.broker || "Broker not recorded"} &middot; {isSell ? "Pending SELL Order" : "Pending BUY Order"}</p>
        </div>
        {alert.within3 ? <span className="fdMonitorBadge">{alert.watchlist ? "PRIORITY WATCH" : "WITHIN 3% OF LIMIT"}</span> : null}
      </header>

      <dl className="fdMonitorStats">
        <div><dt>{isSell ? "Sell Limit" : "Buy Limit"}</dt><dd>{formatMoney(trade.entryPrice, currency)}</dd></div>
        <div><dt>Quantity</dt><dd>{trade.quantity}</dd></div>
        <div><dt>Current Price</dt><dd>{trade.dataAvailable ? formatMoney(trade.currentPrice, currency) : "No data"}</dd></div>
        <div><dt>Distance from Limit</dt><dd>{trade.distanceFromLimit == null ? "--" : `${formatMoney(Math.abs(trade.distanceFromLimit), currency)} (${formatPercent(Math.abs(trade.distanceFromLimitPercent))})`}</dd></div>
        <div><dt>Order Status</dt><dd>{trade.orderStatus || "Waiting for Entry"}</dd></div>
        <div><dt>Expiry</dt><dd>{trade.goodTillCancelled ? "Good Till Cancelled" : (trade.expiry ? new Date(trade.expiry).toLocaleDateString() : "Open")}</dd></div>
        {trade.safetyExit ? <div><dt>Safety Exit</dt><dd>{formatMoney(trade.safetyExit, currency)}</dd></div> : null}
        {trade.takeSomeProfit ? <div><dt>Take Some Profit</dt><dd>{formatMoney(trade.takeSomeProfit, currency)}</dd></div> : null}
      </dl>

      <div className="fdMonitorActions">
        <button type="button" className="fdButton secondary" onClick={() => onViewChart(trade)}>View Full Chart</button>
        <button type="button" className="fdButton secondary" onClick={() => onEdit(trade)}>Edit Order</button>
        {needsConfirmation ? (
          <button type="button" className="fdButton" onClick={() => onConfirmReal(trade)}>Confirm Real Order</button>
        ) : (
          <>
            <button type="button" className="fdButton secondary" onClick={() => onAction(trade, "change_limit")}>Record Changed Limit</button>
            <button type="button" className="fdButton secondary" onClick={() => onAction(trade, "partial_fill")}>Mark Partially Filled</button>
            <button type="button" className="fdButton danger" onClick={() => onAction(trade, "archive")}>Cancel/Archive Order</button>
          </>
        )}
        <button type="button" className="fdButton danger" onClick={() => onDelete(trade)}>Delete</button>
      </div>

      <style jsx>{`
        .fdMonitorCard { background: var(--fd-panel); border: 1px solid var(--fd-line); border-left: 4px solid var(--fd-blue); border-radius: 14px; padding: 18px 20px; }
        .fdMonitorCard.fdMonitorAlert { border-left-color: var(--fd-amber); }
        .fdMonitorHead { align-items: flex-start; display: flex; gap: 10px; justify-content: space-between; margin-bottom: 12px; }
        .fdMonitorHead h3 { font-size: 20px; font-weight: 900; margin: 0; }
        .fdMonitorHead p { color: var(--fd-ink-dim); font-size: 12px; margin: 4px 0 0; }
        .fdMonitorBadge { background: var(--fd-amber); border-radius: 6px; color: #fff; font-size: 10px; font-weight: 900; padding: 5px 8px; text-transform: uppercase; white-space: nowrap; }
        .fdMonitorStats { display: grid; gap: 8px 14px; font-size: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0 0 14px; }
        .fdMonitorStats dt { color: var(--fd-ink-dim); font-weight: 700; }
        .fdMonitorStats dd { font-weight: 800; margin: 2px 0 0; }
        .fdMonitorActions { display: flex; flex-wrap: wrap; gap: 8px; }
        .fdButton { border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; padding: 8px 10px; }
      `}</style>
    </article>
  );
}

/**
 * Portfolio Summary - Shows overview of active holdings
 */
function PortfolioSummary({ holdings, brokerPortfolioSnapshot }) {
  const stockSnapshot = brokerPortfolioSnapshot?.type === "stock-holdings" ? brokerPortfolioSnapshot : null;
  const account = stockSnapshot?.accountSummary;
  const hasStockHoldings = Boolean(stockSnapshot) || holdings.some(h => h.brokerHoldingSnapshot?.type === "stock-holdings");
  const activePriced = holdings.filter(h => h.dataAvailable);
  const activeCount = account && Array.isArray(stockSnapshot.holdings) ? stockSnapshot.holdings.length : holdings.length;
  const totalCost = holdings.every(h => h.amountInvested != null) ? holdings.reduce((sum, h) => sum + h.amountInvested, 0) : null;
  const totalValue = activePriced.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPL = !hasStockHoldings && totalCost != null && holdings.every(h => h.dataAvailable && h.profitLoss != null) ? totalValue - totalCost : null;
  const totalPLPercent = totalPL == null ? null : totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const performers = hasStockHoldings ? [] : activePriced.filter(h => h.profitLossPercent != null);
  
  const bestPerformer = performers.reduce((best, h) => {
    const hPercent = h.profitLossPercent;
    const bPercent = best?.profitLossPercent ?? -Infinity;
    return hPercent > bPercent ? h : best;
  }, null);
  
  const worstPerformer = performers.reduce((worst, h) => {
    const hPercent = h.profitLossPercent;
    const wPercent = worst?.profitLossPercent ?? Infinity;
    return hPercent < wPercent ? h : worst;
  }, null);

  const moneyValue = value => value == null ? "Not supplied" : formatMoney(value, "AUD");
  const signedValue = value => value == null ? "Not supplied" : formatSignedMoney(value, "AUD");
  const percentValue = value => value == null ? "Not supplied" : formatPercent(value);
  const summaryCards = account ? [
    { label: "Active CMC Holdings", value: activeCount },
    { label: "Total Holdings (AUD)", value: moneyValue(account.totalHoldingsAud) },
    { label: "Cash (AUD)", value: moneyValue(account.cashAud) },
    { label: "Total Portfolio (AUD)", value: moneyValue(account.totalPortfolioAud) },
    { label: "Total P&L (AUD)", value: signedValue(account.profitLossAud), signed: account.profitLossAud },
    { label: "Return", value: percentValue(account.profitLossPercent), signed: account.profitLossPercent },
    { label: "Daily P&L (AUD)", value: signedValue(account.dailyProfitLossAud), signed: account.dailyProfitLossAud },
    { label: "Holdings Table Value (AUD)", value: moneyValue(stockSnapshot.totals?.marketValueAud) },
  ] : [
    { label: "Active Holdings", value: activeCount },
    { label: hasStockHoldings ? "Earlier Total Cost" : "Total Cost", value: moneyValue(totalCost) },
    { label: hasStockHoldings ? "Holdings Table Value (AUD)" : "Market Value", value: moneyValue(totalValue) },
    { label: "P&L", value: signedValue(totalPL), signed: totalPL },
    { label: "Return", value: percentValue(totalPLPercent), signed: totalPLPercent },
    ...(!hasStockHoldings && holdings.some(row => row.dailyProfitLoss != null) ? [{
      label: "Daily P&L", value: signedValue(holdings.reduce((sum, row) => sum + (row.dailyProfitLoss || 0), 0)),
    }] : []),
    ...(bestPerformer ? [{ label: "Best Performer", value: `${bestPerformer.symbol} ${formatPercent(bestPerformer.profitLossPercent)}`, signed: bestPerformer.profitLossPercent }] : []),
    ...(worstPerformer ? [{ label: "Worst Performer", value: `${worstPerformer.symbol} ${formatPercent(worstPerformer.profitLossPercent)}`, signed: worstPerformer.profitLossPercent }] : []),
  ];

  return (
    <section className="fdPortfolioSummary">
      <h2>{account ? "CMC Portfolio Summary" : "Portfolio Summary"}</h2>
      {holdings.some(row => row.brokerHoldingSnapshot) && <p className="fdSummaryNote">CMC holdings snapshot - values in AUD</p>}
      <div className="fdSummaryGrid">
        {summaryCards.map(card => (
          <div key={card.label} className={`fdSummaryCard${card.signed == null ? "" : card.signed >= 0 ? " fdPositiveSummary" : " fdNegativeSummary"}`}>
            <span className="fdSummaryLabel">{card.label}</span>
            <strong className="fdSummaryValue">{card.value}</strong>
          </div>
        ))}
      </div>
      {account && <p className="fdSummaryNote">Account figures and the holdings table are preserved separately as displayed by CMC.</p>}
      {stockSnapshot?.totals && <dl className="fdSummaryTotals">
        {[["Shares Held", "quantity"], ["Recent Buys", "recentBuys"], ["Recent Sells", "recentSells"], ["Open Sells", "openSells"], ["Conditional Orders", "conditionalOrders"], ["Available to Sell", "availableToSell"]].map(([label, key]) => (
          <div key={key}><dt>{label}</dt><dd>{stockSnapshot.totals[key] ?? "Not supplied"}</dd></div>
        ))}
      </dl>}

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
        .fdSummaryNote {
          color: var(--fd-ink-dim);
          font-size: 12px;
          margin: 10px 0;
        }
        .fdSummaryTotals {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 24px;
          margin: 14px 0 0;
        }
        .fdSummaryTotals dt {
          color: var(--fd-ink-dim);
          font-size: 11px;
        }
        .fdSummaryTotals dd {
          font-size: 14px;
          font-weight: 800;
          margin: 4px 0 0;
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
const PORTFOLIO_COLLECTION_NAMES = ["holdings", "pendingBuyOrders", "pendingSellOrders", "shortTermHoldings", "closedShortTermTrades"];

export default function MyTradesDashboard() {
  const [collections, setCollections] = useState(() => Object.fromEntries(
    PORTFOLIO_COLLECTION_NAMES.map(name => [name, { status: "loading", data: [], error: null }])
  ));
  const [chartRecord, setChartRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editRecordType, setEditRecordType] = useState(null);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const loadControllers = useRef({});

  const reloadPortfolio = useCallback(async (onlyCollection) => {
    const names = typeof onlyCollection === "string" ? [onlyCollection] : PORTFOLIO_COLLECTION_NAMES;
    await Promise.allSettled(names.map(async name => {
      loadControllers.current[name]?.abort();
      const controller = new AbortController();
      loadControllers.current[name] = controller;
      setCollections(current => ({ ...current, [name]: { ...current[name], status: "loading", error: null } }));
      await loadPortfolio({
        auth: supabase.auth, signal: controller.signal, collections: [name],
        onCollection: (key, result) => setCollections(current => ({ ...current, [key]: result })),
      });
    }));
  }, []);

  useEffect(() => {
    let mounted = true;
    reloadPortfolio();
    const { data } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => { if (mounted) reloadPortfolio(); });
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
      Object.values(loadControllers.current).forEach(controller => controller.abort());
    };
  }, [reloadPortfolio]);

  // The Pending Orders Monitor keeps its own live-price refresh so distance-to-limit
  // stays current without the user having to reload the page.
  useEffect(() => {
    const interval = setInterval(() => {
      reloadPortfolio("pendingBuyOrders");
      reloadPortfolio("pendingSellOrders");
    }, PENDING_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reloadPortfolio]);

  const holdings = collections.holdings.data;
  const shortHoldings = collections.shortTermHoldings.data.filter(row => row.status === "open" && row.quantity > 0).map(row => ({
    ...row, purchasePrice: row.brokerHoldingSnapshot ? row.purchasePrice : row.entryPrice, currentValue: row.marketValue,
    targetPrice: row.targetPrice ?? row.takeSomeProfit, distanceToTarget: row.takeSomeProfit == null || row.currentPrice == null ? null : row.takeSomeProfit - row.currentPrice,
  }));
  const activeHoldings = [...holdings.filter(h => h.quantity > 0 && h.status !== "archived"), ...shortHoldings].sort((a, b) => (a.brokerHoldingSnapshot?.displayOrder ?? 99) - (b.brokerHoldingSnapshot?.displayOrder ?? 99));
  const pendingBuys = collections.pendingBuyOrders.data.filter(trade => trade.orderClassification === "PENDING_BUY_ORDER" && trade.status === "pending");
  const pendingSells = collections.pendingSellOrders.data.filter(trade => trade.orderClassification === "PENDING_SELL_ORDER" && trade.status === "pending");
  const closedTrades = collections.closedShortTermTrades.data;
  const collectionNotice = (name, label) => {
    const collection = collections[name];
    if (collection.status === "error") return (
      <FreedomNotice tone="red" title={`Unable to load ${label}`}>
        <span role="alert">{collection.error.message}</span>{" "}
        <button type="button" className="fdButton secondary" onClick={() => reloadPortfolio(name)}>Retry</button>
      </FreedomNotice>
    );
    if (collection.status === "loading") return <p role="status">Loading {label}...</p>;
    return null;
  };

  const handleSetTarget = useCallback(async (holding) => {
    const price = prompt(`Set target sell price for ${holding.symbol}:`, holding.targetPrice || "");
    if (price === null) return;
    
    const parsed = parseFloat(price);
    if (!Number.isFinite(parsed)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      
      const res = await fetch(holding.kind === "short-term" ? "/api/freedom/trades" : "/api/freedom/long-term", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: holding.id, [holding.kind === "short-term" ? "takeSomeProfit" : "targetPrice"]: parsed })
      });
      if (!res.ok) throw new Error("Failed to update target");
      await reloadPortfolio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, [reloadPortfolio]);

  const handleSetSafetyExit = useCallback(async (holding) => {
    const price = prompt(`Set safety exit price for ${holding.symbol}:`, holding.safetyExit || "");
    if (price === null) return;
    
    const parsed = parseFloat(price);
    if (!Number.isFinite(parsed)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      
      const res = await fetch(holding.kind === "short-term" ? "/api/freedom/trades" : "/api/freedom/long-term", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: holding.id, safetyExit: parsed })
      });
      if (!res.ok) throw new Error("Failed to update safety exit");
      await reloadPortfolio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, [reloadPortfolio]);

  const handleViewChart = useCallback((record) => {
    setChartRecord(record);
  }, []);

  const handleEditRecord = useCallback((record, type) => {
    setEditRecord(record);
    setEditRecordType(type);
  }, []);

  const handleEditHolding = useCallback((holding) => {
    handleEditRecord(holding, holding.kind === "short-term" ? (holding.brokerHoldingSnapshot ? "shortHolding" : "order") : "holding");
  }, [handleEditRecord]);

  const handleEditOrder = useCallback((order) => {
    handleEditRecord(order, "order");
  }, [handleEditRecord]);

  const handleSaveEdit = useCallback(async () => {
    setEditRecord(null);
    setEditRecordType(null);
    await reloadPortfolio();
  }, [reloadPortfolio]);

  const handleDeleteTrade = useCallback(async (trade) => {
    if (!confirm(`Delete ${trade.symbol}? This permanently removes the record and cannot be undone.`)) return;
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const res = await fetch("/api/freedom/trades", { method: "DELETE", headers, body: JSON.stringify({ id: trade.id }) });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.errors?.[0] || "Could not delete the trade.");
      await reloadPortfolio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, [reloadPortfolio]);

  const handlePendingAction = useCallback(async (trade, action) => {
    const patch = {};
    if (action === "change_limit") {
      const value = prompt(`New limit price for ${trade.symbol}:`, trade.entryPrice ?? "");
      if (value === null) return;
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) { alert("Please enter a valid price."); return; }
      patch.entryPrice = parsed;
    } else if (action === "partial_fill") {
      const value = prompt(`Filled quantity for ${trade.symbol}:`, trade.filledQuantity ?? "");
      if (value === null) return;
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed <= 0) { alert("Please enter a valid quantity."); return; }
      patch.filledQuantity = parsed;
    } else if (action === "archive") {
      if (!confirm(`Cancel/archive the pending order for ${trade.symbol}?`)) return;
    }
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const res = await fetch("/api/freedom/trades", {
        method: "PATCH", headers, body: JSON.stringify({ id: trade.id, action, ...patch }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.errors?.[0] || "Could not update the order.");
      await reloadPortfolio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, [reloadPortfolio]);

  const handleConfirmRealOrder = useCallback(async (trade) => {
    if (!confirm(`Confirm that ${trade.symbol} is a real pending order placed with your broker?`)) return;
    try {
      const headers = await authenticatedHeaders(supabase.auth, true);
      const res = await fetch("/api/freedom/trades", {
        method: "PATCH", headers, body: JSON.stringify({ id: trade.id, manuallyConfirmedOrder: true }),
      });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.errors?.[0] || "Could not confirm the order.");
      await reloadPortfolio();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }, [reloadPortfolio]);

  const handleAddTradeSaved = useCallback(async () => {
    setShowAddTrade(false);
    await reloadPortfolio();
  }, [reloadPortfolio]);

  const handleImported = useCallback(async () => {
    await reloadPortfolio();
  }, [reloadPortfolio]);

  const handleCloseChart = useCallback(() => {
    setChartRecord(null);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditRecord(null);
    setEditRecordType(null);
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseChart();
        handleCloseEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseChart, handleCloseEdit]);

  return (
    <FreedomShell
      title="My Trades"
      actions={
        <>
          <button type="button" className="fdButton secondary" onClick={() => setShowImportPanel((open) => !open)}>
            {showImportPanel ? "Close Import" : "Import Trades"}
          </button>
          <button type="button" className="fdButton" onClick={() => setShowAddTrade((open) => !open)}>
            {showAddTrade ? "Cancel" : "+ Add Trade"}
          </button>
        </>
      }
    >
      <Head>
        <title>My Trades - Freedom</title>
      </Head>

      {showAddTrade ? <AddTradeForm onSaved={handleAddTradeSaved} onCancel={() => setShowAddTrade(false)} /> : null}
      {showImportPanel ? <ImportPanel onImported={handleImported} onClose={() => setShowImportPanel(false)} /> : null}

      {/* Portfolio Summary */}
      {activeHoldings.some(row => (row.valuationCurrency || row.currency || "AUD") === "AUD") && (
        <PortfolioSummary
          holdings={activeHoldings.filter(row => (row.valuationCurrency || row.currency || "AUD") === "AUD")}
          brokerPortfolioSnapshot={collections.holdings.brokerPortfolioSnapshot}
        />
      )}

      {/* Pending Orders Monitor - real stored orders only, never counted as owned positions */}
      {(pendingBuys.length > 0 || pendingSells.length > 0 || collections.pendingBuyOrders.status !== "success" || collections.pendingSellOrders.status !== "success") && (
        <section className="fdOrdersSection">
          <h2>Pending Orders Monitor</h2>
          {collectionNotice("pendingBuyOrders", "pending orders")}
          {collectionNotice("pendingSellOrders", "pending sell orders")}
          <p className="fdSectionNote">WAITING FOR ENTRY - these orders are not yet filled and are never counted in open-position P&amp;L.</p>

          {pendingBuys.length > 0 && (
            <>
              <h3 className="fdOrdersSubhead">Pending BUY Orders</h3>
              <div className="fdOrdersGrid">
                {pendingBuys.map(trade => (
                  <PendingOrderMonitorCard
                    key={trade.id}
                    trade={trade}
                    onAction={handlePendingAction}
                    onConfirmReal={handleConfirmRealOrder}
                    onViewChart={handleViewChart}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteTrade}
                  />
                ))}
              </div>
            </>
          )}

          {pendingSells.length > 0 && (
            <>
              <h3 className="fdOrdersSubhead">Pending SELL Orders</h3>
              <div className="fdOrdersGrid">
                {pendingSells.map(trade => (
                  <PendingOrderMonitorCard
                    key={trade.id}
                    trade={trade}
                    onAction={handlePendingAction}
                    onConfirmReal={handleConfirmRealOrder}
                    onViewChart={handleViewChart}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteTrade}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Active Holdings Section */}
      {(activeHoldings.length > 0 || collections.holdings.status !== "success" || collections.shortTermHoldings.status !== "success") && (
        <section className="fdHoldingsSection">
          <h2>Active Holdings</h2>
          {collectionNotice("shortTermHoldings", "short-term holdings")}
          {collectionNotice("holdings", "long-term holdings")}
          <div className="fdHoldingsGrid">
            {activeHoldings.map(holding => (
              <HoldingCard
                key={holding.id}
                holding={holding}
                onSetTarget={handleSetTarget}
                onSetSafetyExit={handleSetSafetyExit}
                onViewChart={handleViewChart}
                onEdit={handleEditHolding}
                onDelete={holding.kind === "short-term" && !holding.brokerHoldingSnapshot ? handleDeleteTrade : null}
              />
            ))}
          </div>
        </section>
      )}

      {Object.values(collections).every(collection => collection.status === "success" && collection.data.length === 0) && (
        <FreedomNotice type="info">No active holdings or pending orders.</FreedomNotice>
      )}

      {collectionNotice("closedShortTermTrades", "closed trades")}

      {closedTrades.length > 0 && <details className="fdArchivedSection">
        <summary>Closed / Archived Short-Term Trades ({closedTrades.length})</summary>
        {closedTrades.map(trade => (
          <article key={trade.id} className="fdClosedRow">
            <div>
              <h3>{trade.symbol} <span className="fdClosedBadge">CLOSED</span></h3>
              <p>{trade.exchange} &middot; {trade.broker || "Broker not recorded"} &middot; Qty {trade.quantity}</p>
            </div>
            <p>Entry {formatMoney(trade.entryPrice, trade.currency)}{trade.averageFilledPrice != null ? ` → Exit ${formatMoney(trade.averageFilledPrice, trade.currency)}` : ""}</p>
            <button type="button" className="fdButton danger" onClick={() => handleDeleteTrade(trade)}>Delete</button>
          </article>
        ))}
      </details>}

      {collections.holdings.archivedHoldings?.length > 0 && <details className="fdArchivedSection">
        <summary>Closed / Archived Long-Term Holdings ({collections.holdings.archivedHoldings.length})</summary>
        {collections.holdings.archivedHoldings.map(row => <article key={row.id}>
          <h3>{row.symbol} - {row.companyName || row.exchange}</h3>
          <p>{row.archiveReason}</p>
          <p>Original quantity: {row.quantity}. Sale price, sale date and realised P&L: not confirmed.</p>
          <p>Original record: {row.id}. History retained ({row.orderHistory?.length || 0} events).</p>
        </article>)}
      </details>}

      {/* Modals */}
      <ChartModal record={chartRecord} isOpen={!!chartRecord} onClose={handleCloseChart} />
      <EditModal
        record={editRecord}
        isOpen={!!editRecord}
        onClose={handleCloseEdit}
        onSave={handleSaveEdit}
        recordType={editRecordType}
      />

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
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 1100px) {
          .fdOrdersGrid,
          .fdHoldingsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .fdOrdersGrid,
          .fdHoldingsGrid {
            grid-template-columns: 1fr;
          }
        }
        .fdOrdersSubhead {
          color: var(--fd-ink-dim);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.4px;
          margin: 18px 0 10px;
          text-transform: uppercase;
        }
        .fdArchivedSection {
          margin-bottom: 24px;
        }
        .fdArchivedSection summary {
          cursor: pointer;
          font-weight: 800;
          padding: 8px 0;
        }
        .fdClosedRow {
          align-items: center;
          border-top: 1px solid var(--fd-line);
          display: flex;
          gap: 16px;
          justify-content: space-between;
          padding: 12px 0;
        }
        .fdClosedRow h3 {
          font-size: 15px;
          margin: 0;
        }
        .fdClosedRow p {
          color: var(--fd-ink-dim);
          font-size: 12px;
          margin: 4px 0 0;
        }
        .fdClosedBadge {
          background: var(--fd-grey-soft);
          border-radius: 5px;
          color: var(--fd-ink-dim);
          font-size: 10px;
          font-weight: 900;
          margin-left: 8px;
          padding: 3px 7px;
        }
      `}</style>
    </FreedomShell>
  );
}
