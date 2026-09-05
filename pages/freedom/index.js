import { supabase } from "../../lib/supabaseClient";
import { portfolioHeaders } from "../../lib/freedom/portfolioClient.js";
﻿import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRef } from "react";
import { useRouter } from "next/router";

import FreedomChartModal from "../../components/freedom/FreedomChartModal.js";
import FreedomShell, {
  ActionBadge,
  FreedomNotice,
  WhyThisResult,
  formatMoney,
  formatPercent,
  formatTimestamp,
} from "../../components/freedom/FreedomShell.js";
import { defaultMarketSelection, marketSessionSnapshot, marketsForSelection } from "../../lib/freedom/marketSessions.js";

/**
 * Today's Opportunities.
 *
 * Scans the configured market automatically on load and shows the best genuine
 * opportunities. Every result carries its action, price, buy trigger, Safety Exit,
 * targets, risk/reward, timeframe, data timestamp and a plain-English reason. Technical
 * detail is kept behind "Why this result?".
 */

const TONE_FOR_ACTION = { BUY: "green", WAIT: "blue", WATCH: "amber", AVOID: "red", UNAVAILABLE: "grey" };
const MARKET_OPTIONS = [
  { value: "ASX", label: "Australian Market (ASX)" },
  { value: "US", label: "US Markets" },
  { value: "BOTH", label: "Both Markets" },
];
const ASX_UNIVERSE_OPTIONS = [
  { value: "ASX_LIQUID", label: "ASX liquidity-filter candidates" },
  { value: "ASX_200", label: "ASX 200" },
  { value: "ASX_300", label: "ASX 300" },
  { value: "CMC_IMPORTED", label: "CMC imported candidates" },
  { value: "CUSTOM", label: "Custom watchlist" },
];

function formatDistancePercent(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return Math.abs(Number(value)).toFixed(2) + "%";
}

function CountPill({ label, value, tone }) {
  return (
    <span className={"fdCount fdTone-" + tone}>
      <strong>{value}</strong> {label}
    </span>
  );
}

function MarketSelector({ value, onChange, sessions, universeSelection, onUniverseChange, expectedUniverseSize }) {
  return (
    <section className="fdMarketPanel" aria-label="Market selection and session status">
      <div className="fdMarketChoices">
        {MARKET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={"fdMarketChoice" + (value === option.value ? " active" : "")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === "ASX" ? (
        <div className="fdUniverseRow">
          <label>
            <span>Australian scan universe</span>
            <select value={universeSelection} onChange={(event) => onUniverseChange(event.target.value)}>
              {ASX_UNIVERSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <strong>{expectedUniverseSize ?? "--"} securities selected</strong>
        </div>
      ) : null}
      <div className="fdMarketSessions">
        <div>
          <strong>ASX: {sessions?.ASX?.status || "--"}</strong>
          <span>{sessions?.ASX?.localTime || "--"}</span>
        </div>
        <div>
          <strong>US: {sessions?.US?.status || "--"}</strong>
          <span>{sessions?.US?.localTime || "--"}</span>
        </div>
        <div>
          <strong>Your time</strong>
          <span>{sessions?.userTime || "--"}</span>
        </div>
      </div>
      <style jsx>{`
        .fdMarketPanel {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 12px;
          display: grid;
          gap: 16px;
          margin-bottom: 18px;
          padding: 18px;
        }
        .fdMarketChoices {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .fdMarketChoice {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          color: var(--fd-ink);
          cursor: pointer;
          font: inherit;
          font-weight: 850;
          padding: 10px 14px;
        }
        .fdMarketChoice.active {
          background: rgba(43, 108, 224, 0.22);
          border-color: #8ab4ff;
          color: #ffffff;
        }
        .fdUniverseRow {
          align-items: end;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: space-between;
        }
        .fdUniverseRow label {
          display: grid;
          gap: 6px;
          min-width: min(100%, 280px);
        }
        .fdUniverseRow span {
          color: var(--fd-ink-dim);
          font-size: 12px;
          font-weight: 850;
          text-transform: uppercase;
        }
        .fdUniverseRow select {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          color: var(--fd-ink);
          font: inherit;
          font-weight: 850;
          padding: 10px 12px;
        }
        .fdUniverseRow strong {
          color: var(--fd-ink);
          font-size: 15px;
        }
        .fdMarketSessions {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .fdMarketSessions div {
          border-left: 3px solid var(--fd-line);
          display: grid;
          gap: 4px;
          padding-left: 12px;
        }
        .fdMarketSessions strong {
          color: var(--fd-ink);
          font-size: 15px;
          font-weight: 900;
        }
        .fdMarketSessions span {
          color: var(--fd-ink-dim);
          font-size: 13px;
          font-weight: 750;
        }
      `}</style>
    </section>
  );
}

function CmcImportPanel({ rows, setRows, onAnalyse, universeSelection }) {
  const [sourceType, setSourceType] = useState("text");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  const importRows = useCallback(async () => {
    try {
    setMessage("Reading CMC candidates...");
    const response = await fetch("/api/freedom/cmc-market-import", {
      method: "POST",
      headers: await portfolioHeaders(supabase.auth, true),
      body: JSON.stringify({ sourceType, text, csv: sourceType === "csv" ? text : "" }),
    });
    const payload = await response.json();
    if (!payload.ok) {
      setMessage(payload.error || "CMC import failed.");
      return;
    }
    setRows(payload.candidates || []);
    setMessage(payload.warning || `${payload.candidates?.length || 0} CMC candidates ready for review.`);
    } catch (error) { setMessage(error.message || "CMC import failed."); }
  }, [sourceType, text, setRows]);

  const readFile = useCallback(async (event) => {
    try {
    const file = event.target.files?.[0];
    if (!file) return;
    if (/image\//.test(file.type)) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setMessage("Reading screenshot text...");
      const response = await fetch("/api/freedom/cmc-market-import", {
        method: "POST",
        headers: await portfolioHeaders(supabase.auth, true),
        body: JSON.stringify({ sourceType: "image", image: { name: file.name, type: file.type, dataUrl } }),
      });
      const payload = await response.json();
      setRows(payload.candidates || []);
      setMessage(payload.ok ? payload.warning || `${payload.candidates?.length || 0} screenshot candidates ready for review.` : payload.error);
      return;
    }
    setSourceType(file.name.toLowerCase().endsWith(".csv") ? "csv" : "text");
    setText(await file.text());
    setMessage("File loaded. Review or import the rows.");
    } catch (error) { setMessage(error.message || "Could not read the file."); }
  }, [setRows]);

  const updateRow = (index, key, value) => {
    setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  return (
    <section className="fdImportPanel">
      <div className="fdImportHeader">
        <div>
          <h2>CMC Imported Candidates</h2>
          <p>Use CMC rows as candidates only. Freedom still validates ASX identity and daily OHLCV independently.</p>
        </div>
        <div className="fdImportActions">
          <button type="button" className="fdButton secondary" onClick={() => setSourceType("text")}>Paste rows</button>
          <button type="button" className="fdButton secondary" onClick={() => setSourceType("csv")}>CSV rows</button>
          <label className="fdButton secondary">
            Screenshot
            <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.csv,.txt" onChange={readFile} hidden />
          </label>
        </div>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste CMC Movers, Gainers, Losers or theScreener rows here." />
      <div className="fdImportActions">
        <button type="button" className="fdButton" onClick={importRows}>Extract for review</button>
        <button type="button" className="fdButton secondary" onClick={onAnalyse} disabled={!rows.length || universeSelection !== "CMC_IMPORTED"}>Analyse reviewed candidates</button>
      </div>
      {message ? <p className="fdImportMessage">{message}</p> : null}
      {rows.length ? (
        <div className="fdReviewTable">
          <table>
            <thead><tr><th>Code</th><th>Company</th><th>CMC price</th><th>Move %</th><th>Volume</th><th>CMC rating</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td><input value={row.symbol || ""} onChange={(event) => updateRow(index, "symbol", event.target.value.toUpperCase())} /></td>
                  <td><input value={row.companyName || ""} onChange={(event) => updateRow(index, "companyName", event.target.value)} /></td>
                  <td><input value={row.cmcPrice ?? ""} onChange={(event) => updateRow(index, "cmcPrice", event.target.value)} /></td>
                  <td><input value={row.cmcMovePercent ?? ""} onChange={(event) => updateRow(index, "cmcMovePercent", event.target.value)} /></td>
                  <td><input value={row.volume ?? ""} onChange={(event) => updateRow(index, "volume", event.target.value)} /></td>
                  <td><input value={row.importedRating || row.importedValuation || ""} onChange={(event) => updateRow(index, "importedRating", event.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <style jsx>{`
        .fdImportPanel {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 12px;
          display: grid;
          gap: 14px;
          margin-bottom: 18px;
          padding: 18px;
        }
        .fdImportHeader {
          align-items: start;
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: space-between;
        }
        .fdImportHeader h2 { font-size: 20px; margin: 0; }
        .fdImportHeader p, .fdImportMessage { color: var(--fd-ink-dim); margin: 6px 0 0; }
        .fdImportActions { display: flex; flex-wrap: wrap; gap: 10px; }
        textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          color: var(--fd-ink);
          min-height: 110px;
          padding: 12px;
          resize: vertical;
          width: 100%;
        }
        .fdReviewTable { overflow-x: auto; }
        table { border-collapse: collapse; min-width: 820px; width: 100%; }
        th, td { border-bottom: 1px solid var(--fd-line); padding: 8px; text-align: left; }
        th { color: var(--fd-ink-dim); font-size: 12px; text-transform: uppercase; }
        input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--fd-line);
          border-radius: 6px;
          color: var(--fd-ink);
          padding: 7px;
          width: 100%;
        }
      `}</style>
    </section>
  );
}

function OpportunityCard({ opportunity, onAddToTrades, onViewChart }) {
  const currency = opportunity.currency || "USD";
  const range = opportunity.entryRange;
  const detail = opportunity.detail || {};
  const trigger = opportunity.triggerStatus || {};
  const distance = trigger.distance || {};
  const belowTrigger = distance.state === "below";
  const triggerPrefix = belowTrigger ? "CURRENTLY WAITING" : trigger.label ? trigger.label.toUpperCase() : "TRIGGER STATUS";
  const triggerLine = belowTrigger && distance.dollars !== null && distance.percent !== null && range
    ? `${opportunity.symbol} must rise at least ${formatMoney(distance.dollars, currency)} / ${formatDistancePercent(distance.percent)} before the entry can trigger. Do not buy yet based on this setup.`
    : trigger.howToRead || "No reliable market dataâ€”do not buy from this setup.";
  const actionLabel = trigger.canConfirmPurchase ? "Confirm Purchase" : "Add to Watchlist";
  const cmc = opportunity.cmcComparison || null;
  const primaryInstruction = opportunity.action === "BUY" && range
    ? opportunity.opportunityType === "BUY NOW"
      ? `BUY NOW within ${formatMoney(range.low, currency)}-${formatMoney(range.high, currency)}`
      : `READY AT MARKET OPEN within ${formatMoney(range.low, currency)}-${formatMoney(range.high, currency)}`
    : trigger.distance?.state === "above"
    ? "DO NOT BUY YET - entry range has been missed"
    : range
    ? `DO NOT BUY YET - wait for ${formatMoney(range.preferred || range.low, currency)}`
    : opportunity.primaryInstruction;

  return (
    <article className={"fdCard fdTone-" + TONE_FOR_ACTION[opportunity.action]}>
      <header className="fdCardHead">
        <div className="fdCardIdentity">
          <h2>{opportunity.symbol}</h2>
          <p>{opportunity.companyName || "Unknown company"}</p>
          <p className="fdCardVenue">
            {opportunity.exchange || "Unknown exchange"} &middot; {currency}
          </p>
        </div>
        <ActionBadge action={opportunity.action} />
      </header>

      <p className="fdCardHeadline">{opportunity.actionHeadline}</p>
      <p className="fdPrimaryInstruction">{primaryInstruction}</p>
      {opportunity.opportunityType === "READY AT MARKET OPEN" ? (
        <p className="fdOpenGuard">Market is closed. Revalidate the price when the market opens before entering any order.</p>
      ) : null}
      {opportunity.missingCondition ? (
        <p className="fdOpenGuard">Missing condition: {opportunity.missingCondition}</p>
      ) : null}
      {range ? (
        <div className="fdTriggerCallout">
          <strong>BUY TRIGGER: {formatMoney(range.low, currency)}â€“{formatMoney(range.high, currency)}</strong>
          <span>{triggerPrefix}: {triggerLine}</span>
        </div>
      ) : null}
      <p className="fdHowToRead">How to read this: {trigger.howToRead || "No reliable market dataâ€”do not buy from this setup."}</p>

      <dl className="fdFacts">
        <div>
          <dt>Current price</dt>
          <dd className="fdBig">{formatMoney(opportunity.currentPrice, currency)}</dd>
        </div>
        <div>
          <dt>Market status</dt>
          <dd>{opportunity.marketStatus || "--"}</dd>
        </div>
        <div>
          <dt>Price session</dt>
          <dd>{opportunity.priceSession || "--"}</dd>
        </div>
        <div>
          <dt>Quote type</dt>
          <dd>{opportunity.quoteMode || "--"}</dd>
        </div>
        <div>
          <dt>Data source</dt>
          <dd>{opportunity.dataSource || "--"}</dd>
        </div>
        {cmc ? (
          <div>
            <dt>CMC comparison</dt>
            <dd className={cmc.material ? "fdRed" : ""}>
              {formatMoney(cmc.cmcPrice, currency)} / {formatPercent(cmc.discrepancyPercent)}
            </dd>
          </div>
        ) : null}
        {opportunity.importedRating || opportunity.importedValuation ? (
          <div>
            <dt>CMC rating</dt>
            <dd>{opportunity.importedRating || opportunity.importedValuation}</dd>
          </div>
        ) : null}
        <div>
          <dt>Buy Trigger</dt>
          <dd>{range ? formatMoney(range.low, currency) + " - " + formatMoney(range.high, currency) : "--"}</dd>
        </div>
        <div>
          <dt>Distance to trigger</dt>
          <dd>{distance.dollars === null || distance.dollars === undefined ? "--" : formatMoney(distance.dollars, currency) + " / " + formatDistancePercent(distance.percent)}</dd>
        </div>
        <div>
          <dt>Safety Exit</dt>
          <dd className="fdRed">{formatMoney(opportunity.safetyExit, currency)}</dd>
        </div>
        <div>
          <dt>Targets</dt>
          <dd className="fdGreen">
            {opportunity.targets.length
              ? opportunity.targets.map((value) => formatMoney(value, currency)).join("  /  ")
              : "--"}
          </dd>
        </div>
        <div>
          <dt>Risk / reward</dt>
          <dd>{opportunity.riskRewardLabel || "--"}</dd>
        </div>
        <div>
          <dt>Potential profit</dt>
          <dd className="fdGreen">{formatPercent(opportunity.potentialProfitPercent)}</dd>
        </div>
        <div>
          <dt>Max planned loss</dt>
          <dd className="fdRed">{formatPercent(opportunity.maximumPlannedLossPercent)}</dd>
        </div>
        <div>
          <dt>Volatility</dt>
          <dd>{detail.volatility?.rating || opportunity.volatility?.rating || "--"}</dd>
        </div>
        <div>
          <dt>Timeframe</dt>
          <dd>{opportunity.timeframe}</dd>
        </div>
      </dl>

      <p className="fdReason">{opportunity.reason}</p>
      {!opportunity.chartValidated ? (
        <p className="fdChartGuard">Historical chart data is not validated. Freedom will not enable a purchase from this setup.</p>
      ) : null}

      <p className="fdStamp">Market data as at {formatTimestamp(opportunity.dataTimestamp)}</p>

      <div className="fdCardActions">
        <button type="button" className="fdButton fdViewChart" onClick={() => onViewChart(opportunity)}>
          View Chart
        </button>
        <button type="button" className="fdButton secondary" onClick={() => onAddToTrades(opportunity)} disabled={trigger.canConfirmPurchase && !opportunity.chartValidated}>
          {actionLabel}
        </button>
      </div>

      <WhyThisResult>
        <dl>
          <dt>Internal status</dt>
          <dd>{detail.internalStatus || "--"}</dd>
          <dt>Setup type</dt>
          <dd>{detail.setupType || "--"}</dd>
          <dt>Reversal state</dt>
          <dd>{detail.reversalState || "--"}</dd>
          <dt>Trading score</dt>
          <dd>{detail.tradingScore ?? "--"}</dd>
          <dt>Opportunity score</dt>
          <dd>{detail.opportunityScore ?? "--"}</dd>
          <dt>Confidence</dt>
          <dd>{detail.confidence ?? "--"}</dd>
          <dt>Capital flow</dt>
          <dd>{detail.capitalFlowState || "--"} ({detail.capitalFlowScore ?? "--"})</dd>
          <dt>Buying / selling pressure</dt>
          <dd>{detail.buyingSellingPressure || "--"}</dd>
          <dt>Relative volume</dt>
          <dd>{detail.relativeVolume ?? "--"}</dd>
          <dt>Volatility</dt>
          <dd>{detail.volatility?.rating || opportunity.volatility?.rating || "--"}</dd>
          <dt>Avg daily move</dt>
          <dd>{detail.volatility?.averageDailyMovementPercent === null || detail.volatility?.averageDailyMovementPercent === undefined ? "--" : formatPercent(detail.volatility.averageDailyMovementPercent)}</dd>
          <dt>ATR</dt>
          <dd>{detail.volatility?.atr === null || detail.volatility?.atr === undefined ? "--" : detail.volatility.atr + " (" + formatPercent(detail.volatility.atrPercent) + ")"}</dd>
          <dt>Recent high</dt>
          <dd>{formatMoney(detail.recentHigh, currency)}</dd>
          <dt>Pullback low</dt>
          <dd>{formatMoney(detail.pullbackLow, currency)}</dd>
          <dt>Pullback</dt>
          <dd>{detail.pullbackPercent === null || detail.pullbackPercent === undefined ? "--" : formatPercent(detail.pullbackPercent)}</dd>
          <dt>Distance from entry</dt>
          <dd>{detail.entryDistancePercent === null || detail.entryDistancePercent === undefined ? "--" : formatPercent(detail.entryDistancePercent)}</dd>
          <dt>Trigger rule status</dt>
          <dd>{trigger.label || "--"}</dd>
          {cmc ? (
            <>
              <dt>CMC timestamp</dt>
              <dd>{cmc.cmcTimestamp ? formatTimestamp(cmc.cmcTimestamp) : "--"}</dd>
              <dt>Freedom timestamp</dt>
              <dd>{cmc.freedomTimestamp ? formatTimestamp(cmc.freedomTimestamp) : "--"}</dd>
              <dt>Price discrepancy</dt>
              <dd>{cmc.discrepancyPercent === null || cmc.discrepancyPercent === undefined ? "--" : formatPercent(cmc.discrepancyPercent)}{cmc.material ? " material" : ""}</dd>
            </>
          ) : null}
          <dt>Setup expiry</dt>
          <dd>{detail.setupExpiryDate ? formatTimestamp(detail.setupExpiryDate) : "--"}</dd>
        </dl>

        {detail.calculations?.length ? (
          <>
            <strong>Calculations</strong>
            <ul>{detail.calculations.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </>
        ) : null}

        {detail.plainEnglish?.length ? (
          <>
            <strong>Setup detail</strong>
            <ul>{detail.plainEnglish.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </>
        ) : null}

        {detail.eligibilityReasons?.length ? (
          <>
            <strong>Rules not yet met</strong>
            <ul>{detail.eligibilityReasons.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </>
        ) : null}

        {detail.whyRankedFirst?.length ? (
          <>
            <strong>Why this ranked first</strong>
            <ul>{detail.whyRankedFirst.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </>
        ) : null}
      </WhyThisResult>

      <style jsx>{`
        .fdCard {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-left: 8px solid var(--tone);
          border-radius: 14px;
          padding: 24px 26px;
        }
        .fdCardHead {
          align-items: flex-start;
          display: flex;
          gap: 20px;
          justify-content: space-between;
        }
        .fdCardIdentity h2 {
          font-size: 38px;
          font-weight: 900;
          letter-spacing: -0.5px;
          line-height: 1;
          margin: 0;
        }
        .fdCardIdentity p {
          color: var(--fd-ink-dim);
          font-size: 17px;
          margin: 7px 0 0;
        }
        .fdCardVenue { font-size: 14px !important; }
        .fdCardHeadline {
          color: var(--tone);
          font-size: 20px;
          font-weight: 800;
          line-height: 1.35;
          margin: 18px 0 0;
        }
        .fdPrimaryInstruction {
          color: #ffffff;
          font-size: 26px;
          font-weight: 950;
          line-height: 1.2;
          margin: 14px 0 0;
        }
        .fdOpenGuard {
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.45);
          border-radius: 10px;
          color: #ffd899;
          font-size: 15px;
          font-weight: 850;
          line-height: 1.45;
          margin: 12px 0 0;
          padding: 12px 14px;
        }
        .fdTriggerCallout {
          background: rgba(43, 108, 224, 0.14);
          border: 1px solid rgba(43, 108, 224, 0.55);
          border-radius: 10px;
          display: grid;
          gap: 8px;
          margin: 18px 0 0;
          padding: 14px 18px;
        }
        .fdTriggerCallout strong {
          color: #8ab4ff;
          font-size: 18px;
          font-weight: 950;
        }
        .fdTriggerCallout span {
          color: var(--fd-ink);
          font-size: 16px;
          font-weight: 850;
          line-height: 1.35;
        }
        .fdHowToRead {
          color: var(--fd-ink-dim);
          font-size: 14px;
          font-weight: 750;
          margin: 12px 0 0;
        }
        .fdFacts {
          display: grid;
          gap: 16px 22px;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          margin: 22px 0 0;
        }
        .fdFacts dt {
          color: var(--fd-ink-dim);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .fdFacts dd {
          font-size: 20px;
          font-weight: 800;
          margin: 5px 0 0;
        }
        .fdBig { font-size: 26px !important; }
        .fdRed { color: #ff8f8f; }
        .fdGreen { color: #6fd99b; }
        .fdReason {
          background: var(--tone-soft);
          border-radius: 10px;
          font-size: 17px;
          line-height: 1.5;
          margin: 22px 0 0;
          padding: 14px 18px;
        }
        .fdChartGuard {
          background: rgba(198, 40, 40, 0.15);
          border: 1px solid rgba(198, 40, 40, 0.45);
          border-radius: 10px;
          color: #ffb0b0;
          font-size: 15px;
          font-weight: 850;
          line-height: 1.45;
          margin: 14px 0 0;
          padding: 12px 14px;
        }
        .fdStamp {
          color: var(--fd-ink-dim);
          font-size: 13px;
          margin: 14px 0 0;
        }
        .fdCardActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }
      `}</style>
    </article>
  );
}

function OpportunitySection({ title, rows, emptyMessage, onAddToTrades, onViewChart }) {
  return (
    <section className="fdOpportunitySection">
      <h2>{title}</h2>
      {rows.length ? rows.map((opportunity) => (
        <OpportunityCard
          key={opportunity.market + ":" + opportunity.symbol + ":" + title}
          opportunity={opportunity}
          onAddToTrades={onAddToTrades}
          onViewChart={onViewChart}
        />
      )) : (
        <FreedomNotice tone="grey" title={title} message={emptyMessage} />
      )}
      <style jsx>{`
        .fdOpportunitySection {
          display: grid;
          gap: 18px;
        }
        .fdOpportunitySection h2 {
          color: var(--fd-ink);
          font-size: 24px;
          font-weight: 950;
          margin: 10px 0 0;
        }
      `}</style>
    </section>
  );
}

function DiagnosticReport({ diagnostics, scan }) {
  const rejected = diagnostics?.rejected || [];
  if (!rejected.length && !scan?.perSymbolDiagnostics?.length) return null;
  return (
    <details className="fdDiagnostics">
      <summary>Diagnostic report: rejected and unavailable securities</summary>
      <div className="fdDiagnosticGrid">
        <span>Rejected: {diagnostics?.counts?.avoid ?? 0}</span>
        <span>No data: {diagnostics?.counts?.unavailable ?? 0}</span>
        <span>Provider failures: {scan?.providerFailures ?? scan?.failed ?? 0}</span>
        <span>Rate limited: {scan?.rateLimited ?? 0}</span>
      </div>
      {rejected.length ? (
        <ul>
          {rejected.slice(0, 40).map((item) => (
            <li key={item.market + ":" + item.symbol}>{item.symbol} - {item.reason}</li>
          ))}
        </ul>
      ) : null}
      <style jsx>{`
        .fdDiagnostics {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          margin-top: 24px;
          padding: 16px 18px;
        }
        .fdDiagnostics summary {
          color: var(--fd-ink);
          cursor: pointer;
          font-weight: 900;
        }
        .fdDiagnosticGrid {
          color: var(--fd-ink-dim);
          display: flex;
          flex-wrap: wrap;
          gap: 10px 18px;
          margin-top: 14px;
        }
        .fdDiagnostics ul {
          color: var(--fd-ink-dim);
          display: grid;
          gap: 7px;
          margin: 14px 0 0;
          padding-left: 18px;
        }
      `}</style>
    </details>
  );
}

export default function TodaysOpportunities() {
  const router = useRouter();
  const [marketSelection, setMarketSelection] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("freedom.marketSelection");
      if (stored && MARKET_OPTIONS.some((option) => option.value === stored)) return stored;
    }
    return defaultMarketSelection();
  });
  const [sessions, setSessions] = useState(() => marketSessionSnapshot());
  const [universeSelection, setUniverseSelection] = useState(() => {
    if (typeof window !== "undefined") return window.localStorage.getItem("freedom.asxUniverse") || "ASX_LIQUID";
    return "ASX_LIQUID";
  });
  const [cmcRows, setCmcRows] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartOpportunity, setChartOpportunity] = useState(null);
  const scanInFlightRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem("freedom.marketSelection", marketSelection);
  }, [marketSelection]);
  useEffect(() => {
    window.localStorage.setItem("freedom.asxUniverse", universeSelection);
  }, [universeSelection]);

  const runScan = useCallback(async (force = false) => {
    const diagnosticSymbols = process.env.NODE_ENV !== "production" ? ["CBA", "BHP", "CSL"] : null;
    const scanKey = JSON.stringify({ marketSelection, universeSelection, force, diagnosticSymbols, cmcSymbols: cmcRows.map((row) => row.symbol).filter(Boolean) });
    if (scanInFlightRef.current?.key === scanKey) return scanInFlightRef.current.promise;
    setLoading(true);
    setError("");
    const promise = (async () => {
      const markets = marketsForSelection(marketSelection);
      const body = diagnosticSymbols
        ? { marketSelection: "ASX", markets: ["ASX"], universeSelection: "DIAGNOSTIC", symbols: diagnosticSymbols, force }
        : { marketSelection, markets, universeSelection, force };
      if (universeSelection === "CMC_IMPORTED") {
        body.importedCandidates = cmcRows;
        body.symbols = cmcRows.map((row) => row.symbol).filter(Boolean);
      }
      const response = await fetch("/api/freedom/opportunities", {
        method: "POST",
        headers: await portfolioHeaders(supabase.auth, true),
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Freedom request failed.");
      setData(payload);
      setSessions(payload?.scan?.sessions || marketSessionSnapshot());
    })();
    scanInFlightRef.current = { key: scanKey, promise };
    try {
      await promise;
    } catch (fetchError) {
      // A transport failure is a market-data failure, never "no trades found".
      setData({
        ok: false,
        outcome: "market-data-failure",
        headline: "Market data failure",
        message: "Freedom could not reach the market scanner: " + (fetchError?.message || "network error") + ".",
        opportunities: [],
        counts: { buy: 0, wait: 0, watch: 0, avoid: 0, unavailable: 0 },
        scan: { sessions: marketSessionSnapshot(), marketSelection, requestedMarkets: marketsForSelection(marketSelection) },
      });
      setSessions(marketSessionSnapshot());
    } finally {
      if (scanInFlightRef.current?.promise === promise) scanInFlightRef.current = null;
      setLoading(false);
    }
  }, [marketSelection, universeSelection, cmcRows]);

  useEffect(() => {
    runScan(false);
  }, [runScan]);

  /** Hand the opportunity to My Trades with the plan pre-filled. */
  const addToTrades = useCallback((opportunity) => {
      const query = {
      symbol: opportunity.symbol,
      exchange: opportunity.exchange || "",
      currency: opportunity.currency || "USD",
      companyName: opportunity.companyName || "",
      entryPrice: opportunity.entryRange?.preferred ?? opportunity.currentPrice ?? "",
      safetyExit: opportunity.safetyExit ?? "",
      takeSomeProfit: opportunity.targets?.[0] ?? "",
      finalExit: opportunity.targets?.[1] ?? "",
    };
    router.push({ pathname: "/freedom/my-trades", query });
  }, [router]);

  const counts = data?.counts || { buy: 0, wait: 0, watch: 0, avoid: 0, unavailable: 0 };
  const scan = data?.scan;
  const sections = data?.sections || { buyNow: [], readyAtMarketOpen: [], waitingForBuyTrigger: [], closestOpportunities: [] };

  return (
    <>
      <Head><title>Today&apos;s Opportunities | Freedom</title></Head>
      <FreedomShell
        title="Today's Opportunities"
        subtitle="Freedom scans the whole configured market and shows only genuine, validated setups."
        actions={
          <button type="button" className="fdButton" onClick={() => runScan(true)} disabled={loading}>
            {loading ? "Scanning market..." : "Run a fresh scan"}
          </button>
        }
      >
        <MarketSelector
          value={marketSelection}
          onChange={setMarketSelection}
          sessions={sessions}
          universeSelection={universeSelection}
          onUniverseChange={setUniverseSelection}
          expectedUniverseSize={universeSelection === "CMC_IMPORTED" ? cmcRows.length : data?.scan?.expectedUniverseSize}
        />

        {marketSelection === "ASX" && universeSelection === "CMC_IMPORTED" ? (
          <CmcImportPanel rows={cmcRows} setRows={setCmcRows} onAnalyse={() => runScan(true)} universeSelection={universeSelection} />
        ) : null}

        {loading && !data ? (
          <FreedomNotice tone="blue" title="Scanning the market" message="Freedom is checking the configured universe with live market data. This can take a minute." />
        ) : null}

        {data?.outcome === "market-data-failure" ? (
          <FreedomNotice tone="red" title="Market data failure" message={data.message}>
            <button type="button" className="fdButton secondary" onClick={() => runScan(true)}>Retry</button>
            <p className="fdNoticeExtra">
              This is <strong>not</strong> the same as finding no trades. Freedom could not read the market
              reliably, so no recommendation can be trusted right now.
            </p>
          </FreedomNotice>
        ) : null}

        {data?.outcome === "scan-incomplete" ? (
          <FreedomNotice tone="red" title="SCAN INCOMPLETE—NO MARKET CONCLUSION AVAILABLE" message={data.message}>
            <p className="fdNoticeExtra">
              Freedom did not analyse enough of the selected universe to make a market conclusion. This is not the same as finding no trades.
            </p>
          </FreedomNotice>
        ) : null}

        {data?.outcome === "no-qualifying-trades" ? (
          <FreedomNotice tone="amber" title="No qualifying trades today" message={data.message}>
            <p className="fdNoticeExtra">
              The market data was read successfully. Nothing currently meets the trading rules, and Freedom
              will not relax the rules to manufacture a result.
            </p>
          </FreedomNotice>
        ) : null}

        {data && !loading ? (
          <FreedomNotice
            tone="blue"
            title="Freedom waits for confirmation"
            message="Freedom waits for confirmation that a falling price has begun recovering. The buy trigger may therefore be above the current price."
          />
        ) : null}

        {data && !loading ? (
          <section className="fdScanBar" aria-label="Scan summary">
            <div className="fdCounts">
              <CountPill label="BUY" value={counts.buy} tone="green" />
              <CountPill label="WAITING" value={counts.wait + counts.watch} tone="blue" />
              <CountPill label="NO DATA" value={counts.unavailable} tone="grey" />
            </div>
            {scan ? (
              <>
              <p className="fdScanMeta">
                {scan.companiesChecked ?? "?"} companies checked &middot; {scan.successfullyAnalysed ?? "?"} analysed &middot;{" "}
                {scan.unavailable ?? "?"} unavailable &middot; {scan.dataProvider}
                {scan.feed ? " (" + scan.feed + " feed)" : ""} &middot; completed {formatTimestamp(scan.scanCompletedAt)}
                {data.fromCache ? " Â· cached result" : ""}
                {data.stale ? " Â· STALE" : ""}
              </p>
              <p className="fdScanMeta">
                Universe: {scan.selectedUniverse || "--"} &middot; expected {scan.expectedUniverseSize ?? scan.universeCount ?? "?"} &middot; attempted {scan.attempted ?? "?"} &middot; loaded {scan.marketDataLoaded ?? "?"} &middot; fully analysed {scan.fullyAnalysed ?? "?"} &middot; rejected {scan.rejectedByStrategy ?? "?"} &middot; provider failures {scan.providerFailures ?? scan.failed ?? 0} &middot; rate limited {scan.rateLimited ?? 0}
              </p>
              <p className="fdScanMeta">
                Completed {scan.completedPercentage ?? 0}% of selected universe.
              </p>
              </>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="fdError">{error}</p> : null}

        <div className="fdCards">
          <OpportunitySection
            title="BUY NOW"
            rows={sections.buyNow || []}
            emptyMessage="No share currently satisfies every entry and risk requirement while the market is open."
            onAddToTrades={addToTrades}
            onViewChart={setChartOpportunity}
          />
          <OpportunitySection
            title="READY AT MARKET OPEN"
            rows={sections.readyAtMarketOpen || []}
            emptyMessage="No closed-market setup currently satisfies every rule. Any previous close must be revalidated at the open."
            onAddToTrades={addToTrades}
            onViewChart={setChartOpportunity}
          />
          <OpportunitySection
            title="WAITING FOR BUY TRIGGER"
            rows={sections.waitingForBuyTrigger || []}
            emptyMessage="No strong setup is close enough to show a defined trigger right now."
            onAddToTrades={addToTrades}
            onViewChart={setChartOpportunity}
          />
          <OpportunitySection
            title="CLOSEST OPPORTUNITIES"
            rows={sections.closestOpportunities || []}
            emptyMessage="No near-miss opportunities were available from this scan."
            onAddToTrades={addToTrades}
            onViewChart={setChartOpportunity}
          />
        </div>

        <DiagnosticReport diagnostics={data?.diagnostics} scan={scan} />

        {chartOpportunity ? (
          <FreedomChartModal opportunity={chartOpportunity} onClose={() => setChartOpportunity(null)} />
        ) : null}

        <style jsx>{`
          .fdScanBar {
            background: var(--fd-panel);
            border: 1px solid var(--fd-line);
            border-radius: 12px;
            margin-bottom: 24px;
            padding: 18px 22px;
          }
          .fdCounts { display: flex; flex-wrap: wrap; gap: 10px; }
          .fdScanMeta {
            color: var(--fd-ink-dim);
            font-size: 14px;
            margin: 14px 0 0;
          }
          .fdCards {
            display: grid;
            gap: 22px;
            grid-template-columns: 1fr;
          }
          .fdMarketResults {
            display: grid;
            gap: 18px;
          }
          .fdMarketResults h2 {
            color: var(--fd-ink);
            font-size: 22px;
            font-weight: 950;
            margin: 8px 0 0;
          }
          .fdError { color: #ff9d9d; font-size: 16px; }
          @media (max-width: 640px) {
            .fdCards { grid-template-columns: 1fr; }
          }
        `}</style>
        <style jsx global>{`
          .fdCount {
            background: var(--tone-soft);
            border: 1px solid var(--tone);
            border-radius: 999px;
            color: var(--fd-ink);
            font-size: 14px;
            font-weight: 700;
            padding: 8px 16px;
          }
          .fdCount strong { color: var(--tone); font-size: 17px; font-weight: 900; }
          .fdNoticeExtra {
            color: var(--fd-ink-dim) !important;
            font-size: 15px !important;
            margin-top: 12px !important;
          }
        `}</style>
      </FreedomShell>
    </>
  );
}
