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
import { loadPortfolio, portfolioHeaders } from "../../lib/freedom/portfolioClient.js";

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
  if (record.brokerHoldingSnapshot) return record.nativeCurrency === "AUD" ? record.purchasePrice : null;
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
        
        const headers = await portfolioHeaders(supabase.auth);
        
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
              currentPrice={currentPrice}
              safetyExit={record.safetyExit}
              targets={targets}
              height={400}
              ariaLabel={`${identity.symbol} chart`}
            />
          )}
        </div>

        {record.brokerHoldingSnapshot && record.nativeCurrency !== "AUD" && <p>Average buy {holdingPrice(record.purchasePrice, "AUD")}; native execution price not supplied.</p>}
        <div className="fdChartLegend">
          <div className="fdLegendItem">
            <span className="fdLegendColor fdColorBlue" />
            <span>Entry/Buy Price</span>
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
      
      const headers = await portfolioHeaders(supabase.auth, true);
      
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
                <label htmlFor="purchasePrice">Average Buy Price ({record.purchasePriceCurrency || record.currency})</label>
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
function HoldingCard({ holding, onSetTarget, onSetSafetyExit, onViewChart, onEdit }) {
  const currency = holding.valuationCurrency || holding.currency || "AUD";
  const nativeCurrency = holding.nativeCurrency || holding.currency || "AUD";
  
  return (
    <article className={"fdHoldingCard fdTone-" + holding.tone} data-record-id={holding.id} data-symbol={holding.symbol}>
      <header className="fdHoldingCardHead">
        <div>
          <h2>{holding.symbol}{holding.exchange === "US" ? ":US" : ""} <small>{holding.exchange}</small></h2>
          <p>{holding.companyName || holding.exchange || "Holding"}</p>
        </div>
        <span className="fdHoldingBadge">ACTIVE HOLDING</span>
      </header>

      <div className="fdHoldingChart">
        <FreedomTradeChart
          candles={holding.candles || []}
          entryPrice={chartEntryPrice(holding)}
          currentPrice={holding.currentPrice}
          safetyExit={holding.safetyExit}
          targets={chartTargets(holding)}
          height={200}
          ariaLabel={`${holding.symbol} historical price chart`}
        />
      </div>

      {holding.brokerHoldingSnapshot && nativeCurrency !== "AUD" && (
        <p className="fdHoldingStamp">Average buy {holdingPrice(holding.purchasePrice, "AUD")}. USD execution price and FX rate not supplied; no AUD buy line is plotted on the USD chart.</p>
      )}
      <dl className="fdHoldingStats">
        <div className="fdStat">
          <dt>Quantity Owned</dt>
          <dd>{holding.quantity}</dd>
        </div>
        <div className="fdStat">
          <dt>Average Buy Price ({holding.purchasePriceCurrency || currency})</dt>
          <dd>{holdingPrice(holding.purchasePrice, holding.purchasePriceCurrency || currency)}</dd>
        </div>
        <div className="fdStat">
          <dt>Total Cost</dt>
          <dd>{holding.amountInvested ? formatMoney(holding.amountInvested, currency) : "--"}</dd>
        </div>
        <div className="fdStat">
          <dt>Current Price ({nativeCurrency})</dt>
          <dd>{holding.dataAvailable ? holdingPrice(holding.currentPrice, nativeCurrency) : "No data"}</dd>
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
          ? `CMC snapshot - quote time not supplied - imported ${formatTimestamp(holding.brokerHoldingSnapshot.importedAt)}`
          : holding.dataAvailable && holding.dataTimestamp ? `Price as at ${formatTimestamp(holding.dataTimestamp)}` : "Market data unavailable"}
      </p>

      <div className="fdHoldingActions">
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onViewChart?.(holding); }}>
          View Full Chart
        </button>
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onEdit?.(holding); }}>
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
function PendingBuyOrderCard({ order, onViewChart, onEdit }) {
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
            <p className="fdDisclasimer">⚠ Potential gain only – order not yet filled</p>
          </div>
        </div>
      )}

      <div className="fdPendingBuyActions">
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onViewChart?.(order); }}>
          View Full Chart
        </button>
        <button type="button" className="fdButton secondary" onClick={(event) => { event.stopPropagation(); onEdit?.(order); }}>
          Edit Order
        </button>
      </div>

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
        .fdPendingBuyActions {
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
 * Portfolio Summary - Shows overview of active holdings
 */
function PortfolioSummary({ holdings }) {
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
      {holdings.some(row => row.brokerHoldingSnapshot) && <p>CMC holdings snapshot - values in AUD</p>}
      <div className="fdSummaryGrid">
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Active Holdings</span>
          <strong className="fdSummaryValue">{activeCount}</strong>
        </div>
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Total Cost</span>
          <strong className="fdSummaryValue">{formatMoney(totalCost, "AUD")}</strong>
        </div>
        <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Market Value</span>
          <strong className="fdSummaryValue">{formatMoney(totalValue, "AUD")}</strong>
        </div>
        <div className={`fdSummaryCard ${totalPL >= 0 ? 'fdPositiveSummary' : 'fdNegativeSummary'}`}>
          <span className="fdSummaryLabel">P&L</span>
          <strong className="fdSummaryValue">{formatSignedMoney(totalPL, 'AUD')}</strong>
        </div>
        <div className={`fdSummaryCard ${totalPLPercent >= 0 ? 'fdPositiveSummary' : 'fdNegativeSummary'}`}>
          <span className="fdSummaryLabel">Return</span>
          <strong className="fdSummaryValue">{formatPercent(totalPLPercent)}</strong>
        </div>
        {holdings.some(row => row.dailyProfitLoss != null) && <div className="fdSummaryCard">
          <span className="fdSummaryLabel">Daily P&L</span>
          <strong className="fdSummaryValue">{formatSignedMoney(holdings.reduce((sum, row) => sum + (row.dailyProfitLoss || 0), 0), "AUD")}</strong>
        </div>}
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
  const [collections, setCollections] = useState(() => Object.fromEntries(
    ["holdings", "pendingBuyOrders", "shortTermHoldings"].map(name => [name, { status: "loading", data: [], error: null }])
  ));
  const [chartRecord, setChartRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editRecordType, setEditRecordType] = useState(null);
  const loadControllers = useRef({});

  const reloadPortfolio = useCallback(async (onlyCollection) => {
    const names = typeof onlyCollection === "string" ? [onlyCollection] : ["holdings", "pendingBuyOrders", "shortTermHoldings"];
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

  const holdings = collections.holdings.data;
  const pendingBuyOrders = collections.pendingBuyOrders.data;
  const shortHoldings = collections.shortTermHoldings.data.filter(row => row.status === "open" && row.quantity > 0).map(row => ({
    ...row, purchasePrice: row.brokerHoldingSnapshot ? row.purchasePrice : row.entryPrice, currentValue: row.marketValue,
    targetPrice: row.targetPrice ?? row.takeSomeProfit, distanceToTarget: row.takeSomeProfit == null || row.currentPrice == null ? null : row.takeSomeProfit - row.currentPrice,
  }));
  const activeHoldings = [...holdings.filter(h => h.quantity > 0 && h.status !== "archived"), ...shortHoldings].sort((a, b) => (a.brokerHoldingSnapshot?.displayOrder ?? 99) - (b.brokerHoldingSnapshot?.displayOrder ?? 99));
  const pendingBuys = pendingBuyOrders.filter(o => o.orderClassification === "PENDING_BUY_ORDER" && o.status === "pending");
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
      const headers = await portfolioHeaders(supabase.auth, true);
      
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
      const headers = await portfolioHeaders(supabase.auth, true);
      
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
    <FreedomShell title="My Trades">
      <Head>
        <title>My Trades - Freedom</title>
      </Head>

      {/* Portfolio Summary */}
      {activeHoldings.length > 0 && (
        <PortfolioSummary holdings={activeHoldings} />
      )}

      {/* Pending Buy Orders Section */}
      {(pendingBuys.length > 0 || collections.pendingBuyOrders.status !== "success") && (
        <section className="fdOrdersSection">
          <h2>Pending Buy Orders</h2>
          {collectionNotice("pendingBuyOrders", "pending orders")}
          <p className="fdSectionNote">These orders are not yet filled. You do not yet own these securities.</p>
          <div className="fdOrdersGrid">
            {pendingBuys.map(order => (
              <PendingBuyOrderCard
                key={order.id}
                order={order}
                onViewChart={handleViewChart}
                onEdit={handleEditOrder}
              />
            ))}
          </div>
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
              />
            ))}
          </div>
        </section>
      )}

      {Object.values(collections).every(collection => collection.status === "success" && collection.data.length === 0) && (
        <FreedomNotice type="info">No active holdings or pending orders.</FreedomNotice>
      )}

      {collections.holdings.archivedHoldings?.length > 0 && <details className="fdArchivedSection">
        <summary>Closed / Archived ({collections.holdings.archivedHoldings.length})</summary>
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
      `}</style>
    </FreedomShell>
  );
}
