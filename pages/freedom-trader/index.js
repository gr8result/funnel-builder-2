import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import { traderCompanyHref } from "../../lib/freedom/companyRoutes";
import { DesktopNotificationProvider } from "../../lib/freedom-trader/notificationProvider";
import { buildAssistantDecision, buildDailyAssistantAnswer } from "../../lib/freedom-trader/assistantDecisionEngine";
import { isFreedomScanSummaryCurrent, scanActionText } from "../../lib/freedom-trader/scanSummary";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const LATEST_SCAN_KEY = "freedom-trader-latest-market-scan";

function formatCurrency(value, currency = "USD") {
  return Number.isFinite(Number(value))
    ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
    : "--";
}

function userFacingReportError(message = "") {
  if (!message) return "";
  if (/supabase|migration|database|persist|save/i.test(message)) return "Report generated, but history could not be saved. Apply supabase/migrations/20260729_freedom_trader_action_reports.sql if this is the first run.";
  return message;
}

function scannerSettingsFromReport(settings = {}) {
  return {
    markets: ["US"],
    chunkSize: 80,
    minimumScore: 82,
    minimumDailyVolume: 1000000,
    minimumRiskReward: 2,
    maximumVolatility: 9,
    maximumPlannedLossPerTrade: settings.maximumPlannedLossPerTrade,
    maximumPositionValue: settings.maximumPositionValue,
    availableCash: settings.availableCash,
  };
}

function plannedCommittedValue(pendingOrders = []) {
  return pendingOrders.reduce((total, order) => {
    const price = Number(order.requested_price ?? order.requestedPrice);
    const quantity = Number(order.quantity);
    return total + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);
}

function confidenceStars(score) {
  const cleanScore = Number(score);
  if (!Number.isFinite(cleanScore)) return "Not enough data";
  const stars = Math.max(1, Math.min(5, Math.round(cleanScore / 20)));
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function dailyGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning Grant";
  if (hour < 18) return "Good afternoon Grant";
  return "Good evening Grant";
}

function formatDateTime(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : "unknown time";
}

function scanStatusMessage(summary = {}) {
  const action = scanActionText(summary);
  return action.body;
}

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getServerSideProps() {
  const { createHash } = await import("crypto");
  const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
  return { props: { passwordHash: createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex") } };
}

export default function FreedomTraderDashboard({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [opportunityRows, setOpportunityRows] = useState([]);
  const [scannerRows, setScannerRows] = useState([]);
  const [developingRows, setDevelopingRows] = useState([]);
  const [scanSummary, setScanSummary] = useState(null);
  const [scanMessage, setScanMessage] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [journalTrades, setJournalTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [paperAccount, setPaperAccount] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [actionAlerts, setActionAlerts] = useState([]);
  const [marketWatch, setMarketWatch] = useState({ plans: [], alerts: [], settings: { intervalSeconds: 60, maximumAlerts: 50, enableBuyAlerts: true, enableSellAlerts: true, enableStopAlerts: true, enableCancelAlerts: true }, answer: null });
  const notifiedAlertIds = useRef(new Set());
  const [desktopNotificationMessage, setDesktopNotificationMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDetailsOpen, setReportDetailsOpen] = useState(false);
  const [reportSettings, setReportSettings] = useState({
    tradingBalance: 5000,
    availableCash: 5000,
    accountCurrency: "AUD",
    currentTradeBudget: 1250,
    defaultMaximumLoss: 50,
    minimumAcceptableExpectedProfit: 25,
    maximumCapitalPerTrade: 1250,
    currencyPreference: "AUD",
    brokerageEstimate: 0,
    maximumPlannedLossPerTrade: 75,
    maximumOpenPositions: 3,
    maximumTotalMoneyCommitted: 2500,
    maximumTotalPlannedLoss: 150,
    maximumPositionValue: 1250,
    takeSomeProfitPercent: 50,
    moveSafetyExitToEntryAfterTakeProfit: true,
    target1IsCompleteExit: false,
  });
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      const [scannerResponse, alertsResponse, journalResponse, positionsResponse, paperResponse, reportResponse, watchResponse] = await Promise.allSettled([
        fetch("/api/freedom-trader/scanner?offset=0", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scannerSettingsFromReport(reportSettings)),
        }),
        fetch("/api/freedom-trader/alerts"),
        fetch("/api/freedom-trader/trade-journal"),
        fetch("/api/freedom-trader/positions"),
        fetch("/api/freedom-trader/paper-account"),
        fetch("/api/freedom-trader/action-report?reportType=now"),
        fetch("/api/freedom-trader/market-watch"),
      ]);
      if (cancelled) return;
      const scannerData = scannerResponse.status === "fulfilled" ? await scannerResponse.value.json().catch(() => null) : null;
      const alertsData = alertsResponse.status === "fulfilled" ? await alertsResponse.value.json().catch(() => null) : null;
      const journalData = journalResponse.status === "fulfilled" ? await journalResponse.value.json().catch(() => null) : null;
      const positionsData = positionsResponse.status === "fulfilled" ? await positionsResponse.value.json().catch(() => null) : null;
      const paperData = paperResponse.status === "fulfilled" ? await paperResponse.value.json().catch(() => null) : null;
      const reportData = reportResponse.status === "fulfilled" ? await reportResponse.value.json().catch(() => null) : null;
      const watchData = watchResponse.status === "fulfilled" ? await watchResponse.value.json().catch(() => null) : null;
      if (scannerData?.ok && scannerData?.scanSummary) {
        setScannerRows(Array.isArray(scannerData.decisions) ? scannerData.decisions : []);
        setOpportunityRows(Array.isArray(scannerData.results) ? scannerData.results.slice(0, 5) : []);
        setDevelopingRows(Array.isArray(scannerData.scannerStatus) ? scannerData.scannerStatus.filter((row) => row.rejectionReason).slice(0, 8) : []);
        setScanSummary(scannerData.scanSummary);
        setScanMessage(scanStatusMessage(scannerData.scanSummary));
      } else {
        setScanMessage(scannerData?.scanSummary ? scanStatusMessage(scannerData.scanSummary) : "Market scanner could not load. The last valid scan will remain visible.");
      }
      setAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts.slice(0, 5) : []);
      setJournalTrades(Array.isArray(journalData?.trades) ? journalData.trades.slice(0, 5) : []);
      setPositions(Array.isArray(positionsData?.positions) ? positionsData.positions.filter((position) => position.status !== "closed").slice(0, 10) : []);
      setPaperAccount(paperData?.account || null);
      setPendingOrders(Array.isArray(paperData?.pendingOrders) ? paperData.pendingOrders : []);
      setReport(reportData?.report || null);
      setRecentReports(Array.isArray(reportData?.recentReports) ? reportData.recentReports.slice(0, 5) : []);
      setActionAlerts(Array.isArray(reportData?.alerts) ? reportData.alerts.slice(0, 8) : []);
      if (watchData?.ok) setMarketWatch(watchData);
      setReportError(userFacingReportError(reportData?.error || ""));
      setUpdatedAt(scannerData?.updatedAt || new Date().toISOString());
      setLoading(false);
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    async function refreshWatch() {
      const data = await fetchMarketWatchStatus().catch(() => null);
      if (!cancelled && data?.ok) setMarketWatch(data);
    }
    const timer = window.setInterval(refreshWatch, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !marketWatch?.alerts?.length) return;
    const provider = new DesktopNotificationProvider();
    const active = marketWatch.alerts.filter((alert) => !alert.acknowledgedAt && !alert.completedAt && !alert.dismissedAt);
    active.forEach((alert) => {
      if (notifiedAlertIds.current.has(alert.id)) return;
      notifiedAlertIds.current.add(alert.id);
      provider.send(alert).then((result) => {
        if (result?.reason === "Desktop notifications disabled.") setDesktopNotificationMessage("Desktop notifications disabled. Continue monitoring normally.");
      }).catch(() => setDesktopNotificationMessage("Desktop notifications disabled. Continue monitoring normally."));
    });
  }, [unlocked, marketWatch?.alerts]);

  async function unlock(event) {
    event.preventDefault();
    const candidateHash = await browserHashPassword(password);
    if (candidateHash !== passwordHash) {
      setPasswordError("Incorrect password.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, "true");
    setUnlocked(true);
  }

  const bestOpportunities = useMemo(() => opportunityRows.slice(0, 5), [opportunityRows]);
  const activeWatchAlert = marketWatch?.alerts?.find((alert) => !alert.acknowledgedAt && !alert.completedAt && !alert.dismissedAt);
  const activeWatchPlanCount = marketWatch?.plans?.filter((plan) => ["WAITING_FOR_ENTRY", "ACTIVE", "PARTIAL_PROFIT"].includes(plan.state)).length || 0;
  const queuedAlertCount = marketWatch?.alerts?.filter((alert) => !alert.completedAt && !alert.dismissedAt).length || 0;

  function applyScannerData(scannerData) {
    const summary = scannerData?.scanSummary || null;
    if (scannerData?.ok && summary) {
      const decisions = Array.isArray(scannerData.decisions) ? scannerData.decisions : [];
      setScannerRows(decisions);
      setOpportunityRows(Array.isArray(scannerData.results) ? scannerData.results.slice(0, 5) : []);
      setDevelopingRows(Array.isArray(scannerData.scannerStatus) ? scannerData.scannerStatus.filter((row) => row.rejectionReason).slice(0, 8) : []);
      setScanSummary(summary);
      setUpdatedAt(scannerData.updatedAt || summary.completedAt || new Date().toISOString());
      setScanMessage(scanStatusMessage(summary));
      window.localStorage.setItem(LATEST_SCAN_KEY, JSON.stringify({ scanSummary: summary, decisions, results: scannerData.results || [], updatedAt: scannerData.updatedAt || summary.completedAt || new Date().toISOString() }));
      return { scannerRows: decisions, scanSummary: summary };
    }
    const failedSummary = scannerData?.scanSummary || {
      status: "failed",
      analysedCount: 0,
      unavailableCount: 0,
      qualifiedCount: 0,
      completedAt: new Date().toISOString(),
      dataLabel: "Unavailable",
    };
    setScanMessage(scanStatusMessage(failedSummary));
    return { scannerRows, scanSummary: failedSummary };
  }

  async function runScanner({ force = false } = {}) {
    if (scanLoading) return { scannerRows, scanSummary };
    if (!force && scannerRows.length && isFreedomScanSummaryCurrent(scanSummary)) return { scannerRows, scanSummary };
    setScanLoading(true);
    setScanMessage("Checking the US market universe...");
    try {
      const response = await fetch("/api/freedom-trader/scanner?offset=0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scannerSettingsFromReport(reportSettings), force }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Market scanner could not load.");
      return applyScannerData(data);
    } catch (error) {
      const fallback = scanSummary && scannerRows.length ? { scannerRows, scanSummary } : {
        scannerRows: [],
        scanSummary: { status: "failed", analysedCount: 0, unavailableCount: 48, qualifiedCount: 0, requestedCount: 48, completedAt: new Date().toISOString(), dataLabel: "Unavailable" },
      };
      setScanMessage(scannerRows.length ? `Market scanner failed. Keeping the last valid scan from ${formatDateTime(scanSummary?.completedAt)}.` : "Market scanner failed. Do not place a new trade from this report.");
      setReportError(userFacingReportError(error.message || ""));
      return fallback;
    } finally {
      setScanLoading(false);
    }
  }

  async function generateReport(reportType) {
    if (reportLoading || scanLoading) return;
    setReportLoading(true);
    setReportError("");
    try {
      const latestScan = await runScanner({ force: true });
      const response = await fetch("/api/freedom-trader/action-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          scannerRows: latestScan.scannerRows,
          scanSummary: latestScan.scanSummary,
          positions,
          pendingOrders,
          trades: journalTrades,
          account: paperAccount,
          settings: reportSettings,
          marketWatch,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok || !data?.report) throw new Error(data?.error || "Freedom could not generate the report right now.");
      setReport(data.report);
      setRecentReports(Array.isArray(data.recentReports) ? data.recentReports.slice(0, 5) : [data.report]);
      setActionAlerts(Array.isArray(data.alerts) ? data.alerts.slice(0, 8) : []);
      if (reportType === "morning") await registerMarketWatchPlans(data.report);
      setReportError(userFacingReportError(data.persistenceError || data.error || ""));
    } catch (error) {
      setReportError(userFacingReportError(error.message || "Freedom could not generate the report right now."));
    } finally {
      setReportLoading(false);
    }
  }

  async function fetchMarketWatchStatus() {
    const response = await fetch("/api/freedom-trader/market-watch");
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function marketWatchCommand(action, extra = {}) {
    const response = await fetch("/api/freedom-trader/market-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  async function registerMarketWatchPlans(nextReport) {
    const plans = (nextReport?.recommendations || [])
      .filter((item) => item.status === "READY TO BUY")
      .map((item) => ({
        symbol: item.symbol,
        companyName: item.companyName,
        currency: item.currency,
        entryPrice: item.entryBuyPrice,
        safetyExit: item.safetyExit,
        takeSomeProfit: item.takeSomeProfit,
        finalExit: item.finalExit,
        quantity: item.suggestedQuantity,
        maximumPlannedLoss: item.maximumPlannedLoss,
        reason: item.reason,
        confidence: item.technicalDetails?.score,
        brokerState: "PLAN PREPARED",
        source: "cmc-prepared-plan",
      }));
    if (!plans.length) return;
    const data = await marketWatchCommand("register", { plans });
    if (data?.ok) setMarketWatch(data);
  }

  async function updateWatchAlert(id, action) {
    const response = await fetch("/api/freedom-trader/market-watch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await response.json().catch(() => null);
    if (data?.ok) setMarketWatch(data);
  }

  async function updateWatchSetting(key, value) {
    const settings = { ...(marketWatch?.settings || {}), [key]: value };
    const data = await marketWatchCommand("settings", { settings });
    if (data?.ok) setMarketWatch(data);
  }

  async function runWatchCommand(action) {
    const data = await marketWatchCommand(action);
    if (data?.ok) setMarketWatch(data);
  }

  async function updateWatchPlan(planId, action) {
    const extra = {};
    if (action === "order-filled") {
      const value = window.prompt("Enter the actual filled price confirmed by CMC.");
      const actualEntryPrice = Number(value);
      if (!Number.isFinite(actualEntryPrice) || actualEntryPrice <= 0) return;
      extra.actualEntryPrice = actualEntryPrice;
    }
    const data = await marketWatchCommand(action, { planId, ...extra });
    if (data?.ok) setMarketWatch(data);
  }

  function updateReportSetting(key, value) {
    setReportSettings((current) => ({ ...current, [key]: Number(value) || 0 }));
  }

  function toggleReportSetting(key, value) {
    setReportSettings((current) => ({ ...current, [key]: Boolean(value) }));
  }

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>What Should Grant Do Today?</title></Head>
      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong>FREEDOM TRADER</strong>
        <span>Grant&apos;s Daily Trading Assistant</span>
      </section>
      <FreedomModuleNav module="trader" />

      <main className="assistantShell" id="dashboard">
        <section className="answerPanel">
          <DailyAnswer report={report} loading={reportLoading || scanLoading} settings={reportSettings} scanSummary={scanSummary} scanMessage={scanMessage} marketWatch={marketWatch} />
        </section>

        <section className="detailDrawer">
          <details>
            <summary>Market Scanner</summary>
            <p>{loading || scanLoading ? scanMessage || "Scanner is loading." : scanSummary ? `${scanSummary.analysedCount || scanSummary.symbolsAnalysed || 0} of ${scanSummary.requestedCount || scanSummary.symbolsRequested || 0} companies analysed. Status: ${String(scanSummary.status || scanSummary.scanCompletionStatus || "unknown").toUpperCase()}. ${scanSummary.dataLabel || "Delayed by 15 minutes"}.` : "No scanner summary returned."}</p>
            {scanMessage ? <p>{scanMessage}</p> : null}
            {bestOpportunities.length ? bestOpportunities.map((row) => <p key={row.symbol}>{row.symbol}: {row.companyName || "Company name unavailable"} - score {Number.isFinite(row.tradingScore) ? row.tradingScore : "--"}</p>) : <p>No candidate trades are ready on the dashboard.</p>}
            <Link href="/freedom-trader/market-opportunities">Open scanner</Link>
          </details>
          <details>
            <summary>Watchlist</summary>
            <p>Use the scanner and company research pages for watchlist details.</p>
            <Link href="/freedom-trader#watchlist">Open watchlist</Link>
          </details>
          <details>
            <summary>Trade Journal</summary>
            <p>{journalTrades.length ? `${journalTrades.length} recent broker-journal trade${journalTrades.length === 1 ? "" : "s"} loaded.` : "No broker-journal trades were returned."}</p>
            <Link href="/freedom-trader/trade-journal">Open trade journal</Link>
          </details>
          <details>
            <summary>Alerts</summary>
            <p>{marketWatch?.monitoringLabel || "Monitoring paused"}. Last market update: {marketWatch?.lastSuccessfulMarketUpdate ? formatDateTime(marketWatch.lastSuccessfulMarketUpdate) : "--"}.</p>
            <p>{activeWatchPlanCount} active watch plan{activeWatchPlanCount === 1 ? "" : "s"}. {queuedAlertCount} queued alert{queuedAlertCount === 1 ? "" : "s"}.</p>
            <p>Freedom monitors while this local application is running. CMC broker-side conditional orders remain the primary protection when Freedom is offline.</p>
            <p>Next check: {marketWatch?.nextCheck ? formatDateTime(marketWatch.nextCheck) : "--"}. Market-data quality: {marketWatch?.cycles?.[0]?.marketDataQuality || "--"}.</p>
            {marketWatch?.plans?.length ? marketWatch.plans.slice(0, 8).map((plan) => (
              <article className="instruction" key={plan.id}>
                <strong>{plan.companyName || plan.symbol}</strong>
                <span>{plan.symbol} - {plan.brokerState || "PLAN PREPARED"} - {plan.state}</span>
                <span>Buy trigger: {formatCurrency(plan.entryPrice, plan.currency || "USD")}</span>
                <span>Safety Exit: {formatCurrency(plan.safetyExit, plan.currency || "USD")}</span>
                <span>Take Some Profit: {formatCurrency(plan.takeSomeProfit, plan.currency || "USD")}</span>
                <span>Final Exit: {formatCurrency(plan.finalExit, plan.currency || "USD")}</span>
                <div className="alertButtons">
                  {plan.brokerState === "PLAN PREPARED" ? <button type="button" onClick={() => updateWatchPlan(plan.id, "order-entered")}>Order Entered in CMC</button> : null}
                  {plan.brokerState === "ORDER ENTERED IN CMC" ? <button type="button" onClick={() => updateWatchPlan(plan.id, "order-filled")}>Order Filled</button> : null}
                </div>
              </article>
            )) : null}
            {desktopNotificationMessage ? <p>{desktopNotificationMessage}</p> : null}
            <p>{marketWatch?.answer?.message || (alerts.length ? `${alerts.length} saved alert${alerts.length === 1 ? "" : "s"} loaded.` : "No saved alerts were returned.")}</p>
            {marketWatch?.alerts?.length ? marketWatch.alerts.slice(0, marketWatch.settings?.maximumAlerts || 50).map((alert) => (
              <article className="instruction" key={alert.id}>
                <strong>ACTION REQUIRED</strong>
                <span>{alert.action} {alert.companyName || alert.symbol}</span>
                <span>Current price: {formatCurrency(alert.currentPrice, alert.currency || "USD")}</span>
                <span>Trigger price: {formatCurrency(alert.triggerPrice, alert.currency || "USD")}</span>
                <span>Created: {formatDateTime(alert.createdAt)}</span>
                <div className="alertButtons">
                  <Link href={traderCompanyHref(alert.symbol)}>Open Company</Link>
                  <a href={alert.cmcUrl || "https://www.cmcmarketsstockbroking.com.au/"} target="_blank" rel="noreferrer">Open CMC</a>
                  <button type="button" onClick={() => updateWatchAlert(alert.id, "acknowledge")}>Acknowledge</button>
                  <button type="button" onClick={() => updateWatchAlert(alert.id, "dismiss")}>Dismiss</button>
                </div>
              </article>
            )) : <p>No Market Watch alerts are active.</p>}
            <Link href="/freedom-trader/alerts">Open alerts</Link>
          </details>
          <details>
            <summary>Trading Settings</summary>
            <div className="settingsGrid">
              <label>Cash available manual<input type="number" value={reportSettings.availableCash} onChange={(event) => updateReportSetting("availableCash", event.target.value)} /></label>
              <label>Trading balance manual<input type="number" value={reportSettings.tradingBalance} onChange={(event) => updateReportSetting("tradingBalance", event.target.value)} /></label>
              <label>Current trade budget<input type="number" value={reportSettings.currentTradeBudget} onChange={(event) => updateReportSetting("currentTradeBudget", event.target.value)} /></label>
              <label>Default maximum loss<input type="number" value={reportSettings.defaultMaximumLoss} onChange={(event) => updateReportSetting("defaultMaximumLoss", event.target.value)} /></label>
              <label>Minimum expected profit<input type="number" value={reportSettings.minimumAcceptableExpectedProfit} onChange={(event) => updateReportSetting("minimumAcceptableExpectedProfit", event.target.value)} /></label>
              <label>Maximum capital / trade<input type="number" value={reportSettings.maximumCapitalPerTrade} onChange={(event) => updateReportSetting("maximumCapitalPerTrade", event.target.value)} /></label>
              <label>Brokerage estimate<input type="number" value={reportSettings.brokerageEstimate} onChange={(event) => updateReportSetting("brokerageEstimate", event.target.value)} /></label>
              <label>Max loss / trade<input type="number" value={reportSettings.maximumPlannedLossPerTrade} onChange={(event) => updateReportSetting("maximumPlannedLossPerTrade", event.target.value)} /></label>
              <label>Max open positions<input type="number" value={reportSettings.maximumOpenPositions} onChange={(event) => updateReportSetting("maximumOpenPositions", event.target.value)} /></label>
              <label>Max position value<input type="number" value={reportSettings.maximumPositionValue} onChange={(event) => updateReportSetting("maximumPositionValue", event.target.value)} /></label>
              <label>Max committed<input type="number" value={reportSettings.maximumTotalMoneyCommitted} onChange={(event) => updateReportSetting("maximumTotalMoneyCommitted", event.target.value)} /></label>
              <label>Max total loss<input type="number" value={reportSettings.maximumTotalPlannedLoss} onChange={(event) => updateReportSetting("maximumTotalPlannedLoss", event.target.value)} /></label>
              <label>Take profit %<input type="number" value={reportSettings.takeSomeProfitPercent} onChange={(event) => updateReportSetting("takeSomeProfitPercent", event.target.value)} /></label>
            </div>
            <div className="managementSettings">
              <label><input checked={reportSettings.moveSafetyExitToEntryAfterTakeProfit} onChange={(event) => toggleReportSetting("moveSafetyExitToEntryAfterTakeProfit", event.target.checked)} type="checkbox" /> After Take Some Profit, move Safety Exit to the original buy price</label>
              <label><input checked={reportSettings.target1IsCompleteExit} onChange={(event) => toggleReportSetting("target1IsCompleteExit", event.target.checked)} type="checkbox" /> Treat Take Some Profit as the complete exit when no Final Exit is available</label>
              <label>Monitoring interval<select value={marketWatch?.settings?.intervalSeconds || 60} onChange={(event) => updateWatchSetting("intervalSeconds", Number(event.target.value) || 60)}><option value={30}>30 sec</option><option value={60}>60 sec</option><option value={120}>2 min</option><option value={300}>5 min</option><option value={600}>10 min</option></select></label>
              <label>Maximum alerts<input type="number" value={marketWatch?.settings?.maximumAlerts || 50} onChange={(event) => updateWatchSetting("maximumAlerts", Number(event.target.value) || 50)} /></label>
              <label><input checked={marketWatch?.settings?.enableBuyAlerts !== false} onChange={(event) => updateWatchSetting("enableBuyAlerts", event.target.checked)} type="checkbox" /> Enable BUY alerts</label>
              <label><input checked={marketWatch?.settings?.enableSellAlerts !== false} onChange={(event) => updateWatchSetting("enableSellAlerts", event.target.checked)} type="checkbox" /> Enable SELL alerts</label>
              <label><input checked={marketWatch?.settings?.enableStopAlerts !== false} onChange={(event) => updateWatchSetting("enableStopAlerts", event.target.checked)} type="checkbox" /> Enable STOP alerts</label>
              <label><input checked={marketWatch?.settings?.enableCancelAlerts !== false} onChange={(event) => updateWatchSetting("enableCancelAlerts", event.target.checked)} type="checkbox" /> Enable CANCEL alerts</label>
            </div>
          </details>
          <details>
            <summary>Technical Analysis</summary>
            {reportError ? <div className="reportWarning">{reportError}</div> : null}
            <div className="reportControls">
              <button type="button" onClick={() => generateReport("morning")} disabled={reportLoading || scanLoading}>Morning</button>
              <button type="button" onClick={() => generateReport("evening")} disabled={reportLoading || scanLoading}>Evening</button>
              <button type="button" onClick={() => generateReport(report?.reportType || "now")} disabled={reportLoading || scanLoading}>Refresh</button>
              <button type="button" onClick={() => runWatchCommand("start")}>Start Monitoring</button>
              <button type="button" onClick={() => runWatchCommand("pause")}>Pause Monitoring</button>
              <button type="button" onClick={() => runWatchCommand("run-now")}>Run Check Now</button>
              <button type="button" onClick={() => runWatchCommand("clear-completed")}>Clear Completed Alerts</button>
            </div>
            <section className="todayStatus">
              <Card label="Open trades" value={positions.length} note={positions.length ? "Review actions below." : "Nothing needs your attention."} />
              <Card label="Market Watch" value={marketWatch?.service?.enabled ? "Running" : "Paused"} note={activeWatchAlert ? `${activeWatchAlert.action} required` : marketWatch?.pausedReason || "No action required"} />
              <Card label="Active watches" value={activeWatchPlanCount} note={`${queuedAlertCount} queued alert${queuedAlertCount === 1 ? "" : "s"}`} />
              <Card label="Last check" value={marketWatch?.lastCheck ? formatDateTime(marketWatch.lastCheck) : "--"} note={marketWatch?.nextCheck ? `Next ${formatDateTime(marketWatch.nextCheck)}` : "No check scheduled"} />
            </section>
            <section className="openTradesPanel">
              <h2>Open Trades</h2>
              {positions.length ? positions.map((position) => (
                <article key={position.id || position.ticker || position.symbol}>
                  <strong>{position.companyName || position.company || position.ticker || position.symbol}</strong>
                  <span>{formatCurrency(position.unrealisedProfitLoss ?? position.unrealisedProfit ?? 0, position.currency || "AUD")} profit/loss</span>
                  <b>Hold</b>
                </article>
              )) : <p>You currently have 0 open trades. Nothing needs your attention.</p>}
            </section>
            {report ? <ReportView report={report} showDetails={reportDetailsOpen} alerts={actionAlerts} recentReports={recentReports} /> : <p>Generate today&apos;s answer to view the technical report.</p>}
            <label className="detailsToggle"><input checked={reportDetailsOpen} onChange={(event) => setReportDetailsOpen(event.target.checked)} type="checkbox" /> Show analysis details</label>
          </details>
        </section>
      </main>
      <Styles />
    </div>
  );
}

function Card({ label, value, note }) {
  return <article><span>{label}</span><strong>{value}</strong>{note ? <p>{note}</p> : null}</article>;
}

function DailyAnswer({ report, loading, settings, scanSummary, scanMessage, marketWatch }) {
  const decision = buildAssistantDecision({ report, scanSummary, marketWatch, loading, scanMessage });
  const answer = buildDailyAssistantAnswer(decision, { report, scanSummary });

  if (answer.state === "BUY_NOW" || answer.state === "SELL_NOW") {
    return (
      <div className="dailyAnswer actionAnswer">
        <span>{dailyGreeting()}</span>
        <h1>Today&apos;s Recommendation</h1>
        <strong>{answer.label}</strong>
        <h2>{answer.headline}</h2>
        <p className="assistantWhy"><b>Why?</b> {answer.why}</p>
        <p>{answer.primaryInstruction}</p>
        <dl>
          <div><dt>Company</dt><dd>{answer.companyName || answer.symbol}</dd></div>
          <div><dt>Current price</dt><dd>{formatCurrency(answer.currentPrice, answer.currency || "USD")}</dd></div>
          <div><dt>Trigger price</dt><dd>{formatCurrency(answer.triggerPrice, answer.currency || "USD")}</dd></div>
        </dl>
        <Link href={traderCompanyHref(answer.symbol)}>Open Company</Link>
      </div>
    );
  }

  if (answer.state === "PREPARE_ONE_TRADE") {
    const ready = answer.recommendation;
    return (
      <div className="dailyAnswer actionAnswer">
        <span>{dailyGreeting()}</span>
        <h1>Today&apos;s Recommendation</h1>
        <strong>{answer.headline}</strong>
        <p className="assistantWhy"><b>Why?</b> {answer.why}</p>
        <p>{answer.primaryInstruction}</p>
        <dl>
          <div><dt>Company</dt><dd>{ready.companyName} {ready.symbol ? `(${ready.symbol})` : ""}</dd></div>
          <div><dt>Buy</dt><dd>{formatCurrency(ready.entryBuyPrice, ready.currency)}</dd></div>
          <div><dt>Safety Exit</dt><dd>{formatCurrency(ready.safetyExit, ready.currency)}</dd></div>
          <div><dt>Take Some Profit</dt><dd>{formatCurrency(ready.takeSomeProfit, ready.currency)}</dd></div>
          <div><dt>Final Exit</dt><dd>{formatCurrency(ready.finalExit, ready.currency)}</dd></div>
          <div><dt>Recommended Position</dt><dd>{ready.recommendedPosition || ready.suggestedQuantity} share{(ready.recommendedPosition || ready.suggestedQuantity) === 1 ? "" : "s"}</dd></div>
          <div><dt>Capital required</dt><dd>{formatCurrency(ready.capitalRequired ?? ready.estimatedAccountPurchaseValue, ready.accountCurrency || settings.accountCurrency)}</dd></div>
          <div><dt>Maximum loss</dt><dd>{formatCurrency(ready.maximumPlannedLoss, ready.accountCurrency || settings.accountCurrency)}</dd></div>
          <div><dt>Expected profit</dt><dd>{formatCurrency(ready.expectedProfit, ready.accountCurrency || settings.accountCurrency)}</dd></div>
          <div><dt>Reward</dt><dd>{Number.isFinite(Number(ready.rewardRisk)) ? `${Number(ready.rewardRisk).toFixed(2)} : 1` : "--"}</dd></div>
        </dl>
        <p>{ready.positionSizing?.explanation || "Enter the buy, Safety Exit, Take Some Profit and Final Exit orders in CMC."}</p>
        <Link href={traderCompanyHref(ready.symbol)}>Open Company</Link>
      </div>
    );
  }

  return (
    <div className="dailyAnswer noActionAnswer">
      <span>{dailyGreeting()}</span>
      <h1>Today&apos;s Recommendation</h1>
      <strong>{answer.headline}</strong>
      <p className="assistantWhy"><b>Why?</b> {answer.why}</p>
      <p>{answer.primaryInstruction}</p>
    </div>
  );
}

function ReportView({ report, showDetails, alerts, recentReports }) {
  const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "--";
  const quality = String(report.marketDataQuality || "unavailable").toUpperCase();
  return (
    <div className="reportBody">
      <div className="reportMeta">
        <span>Generated {generatedAt}</span>
        <strong>Market data: {quality}</strong>
        {report.marketDataQuality === "delayed" ? <em>Market data is delayed. Confirm prices in CMC before entering orders.</em> : null}
      </div>
      <p className="reportGreeting">{report.greeting || "Hi Grant — here are your best options right now."}</p>
      <div className="accountSummary">
        <span>Settings used</span>
        <strong>{formatCurrency(report.accountSummary?.availableCash, report.accountSummary?.accountCurrency || "AUD")} available</strong>
        <p>{report.managementRule || "At Take Some Profit: sell 50%. After Take Some Profit: move Safety Exit to the original buy price. At Final Exit: sell the remaining position."}</p>
      </div>
      <div className="reportItems">
        {(report.recommendations || []).slice(0, 5).map((item, index) => <RecommendationCard item={item} index={index} showDetails={showDetails} key={item.symbol || index} />)}
      </div>
      <section className="reportSubsection">
        <h3>Existing positions</h3>
        {report.positionActions?.length ? report.positionActions.map((item) => <PositionAction item={item} key={item.symbol} />) : <p>No open position needs action right now.</p>}
      </section>
      <section className="reportSubsection">
        <h3>Order to enter in CMC</h3>
        {report.orderInstructions?.approvedTrades?.length ? report.orderInstructions.approvedTrades.map((item) => (
          <article className="instruction" key={item.symbol}>
            <strong>{item.symbol}</strong>
            <span>{item.brokerState || "PLAN PREPARED"}</span>
            <span>Conditional buy: {item.conditionalBuy}</span>
            {item.instructions?.length ? <ol>{item.instructions.map((line) => <li key={line}>{line}</li>)}</ol> : null}
            {(item.afterPurchase || []).map((line) => <span key={line}>{line}</span>)}
            <small>{item.disclaimer || "Freedom has not placed this order. Enter and confirm it through CMC."}</small>
          </article>
        )) : <p>No new CMC buy order is approved right now.</p>}
        <h4>Orders to prepare</h4>
        {report.orderInstructions?.ordersToPrepare?.length ? report.orderInstructions.ordersToPrepare.map((item) => <p key={`prepare-${item.symbol}`}>{item.symbol}: {item.conditionalBuy}</p>) : <p>None.</p>}
        <h4>Orders to leave active</h4>
        {report.orderInstructions?.ordersToLeaveActive?.length ? report.orderInstructions.ordersToLeaveActive.map((item, index) => <p key={`${item.symbol}-${index}`}>{item.symbol}: {item.instruction}</p>) : <p>None loaded.</p>}
        <h4>Orders to cancel</h4>
        {report.orderInstructions?.ordersToCancel?.length ? report.orderInstructions.ordersToCancel.map((item, index) => <p key={`${item.symbol}-${index}`}>{item.symbol}: {item.instruction}</p>) : <p>None.</p>}
      </section>
      {alerts?.length ? (
        <section className="reportSubsection">
          <h3>Action alerts</h3>
          {alerts.map((alert, index) => <p key={alert.id || index}><strong>{alert.action}</strong> {alert.symbol ? `${alert.symbol}: ` : ""}{alert.message}</p>)}
        </section>
      ) : null}
      {recentReports?.length ? (
        <section className="reportSubsection">
          <h3>Recent reports</h3>
          {recentReports.map((item, index) => <p key={item.id || `${item.reportType}-${index}`}>{String(item.reportType || "").toUpperCase()} - {item.generatedAt ? new Date(item.generatedAt).toLocaleString() : "--"} - {item.overallInstruction}</p>)}
        </section>
      ) : null}
      <div className="overallAction">
        <span>Your best action right now:</span>
        <strong>{report.overallInstruction}</strong>
      </div>
    </div>
  );
}

function RecommendationCard({ item, index, showDetails }) {
  if (item.status === "NO ACTION") {
    return <article className="recommendation"><span>#{index + 1}</span><h3>{item.companyName}</h3><strong>{item.status}</strong><p>{item.reason}</p></article>;
  }
  const accountCurrency = item.accountCurrency || item.currency || "AUD";
  return (
    <article className="recommendation">
      <span>#{index + 1}</span>
      <h3>{item.companyName} {item.symbol ? `- ${item.symbol}` : ""}</h3>
      <strong className={`statusPill ${String(item.status || "").replace(/\s+/g, "").toLowerCase()}`}>{item.status}</strong>
      <p>Current price: {formatCurrency(item.currentPrice, item.currency)}</p>
      <p>Market data: {String(item.marketDataQuality || "unavailable").toUpperCase()}</p>
      {item.status === "READY TO BUY" ? (
        <>
          <p>Entry / Buy Price: {formatCurrency(item.entryBuyPrice, item.currency)}</p>
          <p>Safety Exit: {formatCurrency(item.safetyExit, item.currency)}</p>
          <p>Take Some Profit: {formatCurrency(item.takeSomeProfit, item.currency)}</p>
          <p>Final Exit: {formatCurrency(item.finalExit, item.currency)}</p>
          <p>Recommended position: {item.recommendedPosition || item.suggestedQuantity} shares</p>
          <p>Capital required: {formatCurrency(item.capitalRequired ?? item.estimatedAccountPurchaseValue, accountCurrency)}</p>
          <p>Maximum loss: {formatCurrency(item.maximumPlannedLoss, accountCurrency)}</p>
          <p>Expected profit: {formatCurrency(item.expectedProfit, accountCurrency)}</p>
          <p>Reward: {Number.isFinite(Number(item.rewardRisk)) ? `${Number(item.rewardRisk).toFixed(2)} : 1` : "--"}</p>
          {item.positionSizing?.warnings?.length ? <p>{item.positionSizing.warnings.join(" ")}</p> : null}
        </>
      ) : item.status === "WAIT" ? (
        <>
          <p>Do not buy yet.</p>
          <p>Entry / Buy Price: {formatCurrency(item.entryBuyPrice, item.currency)}</p>
          <p>Safety Exit: {formatCurrency(item.safetyExit, item.currency)}</p>
          <p>Take Some Profit: {formatCurrency(item.takeSomeProfit, item.currency)}</p>
          <p>Final Exit: {formatCurrency(item.finalExit, item.currency)}</p>
        </>
      ) : (
        <>
          <p>Freedom cannot assess this share reliably right now.</p>
          <p>Do not place a new order based on this result.</p>
        </>
      )}
      <p>Why: {item.reason}</p>
      {showDetails ? <pre>{JSON.stringify(item.technicalDetails || {}, null, 2)}</pre> : null}
    </article>
  );
}

function PositionAction({ item }) {
  return (
    <article className="positionAction">
      <strong>{item.companyName} - {item.symbol} — {item.action}</strong>
      <span>Current result: approximately {formatCurrency(item.estimatedProfitLoss, item.currency)}</span>
      <span>Entry price: {formatCurrency(item.actualEntryPrice, item.currency)}</span>
      <span>Current price: {formatCurrency(item.currentPrice, item.currency)}</span>
      <span>Safety Exit: {formatCurrency(item.safetyExit, item.currency)}</span>
      <span>Take Some Profit: {formatCurrency(item.takeSomeProfit, item.currency)}</span>
      <span>Final Exit: {formatCurrency(item.finalExit, item.currency)}</span>
      <p>Action: {item.instruction}</p>
    </article>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>Freedom Trader</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span>
        <h1>Freedom Trader</h1>
        <p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
        {error ? <small>{error}</small> : null}
        <button type="submit">Unlock Trader</button>
      </form>
      <Styles />
    </div>
  );
}

function Styles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{color:#fff;font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{color:#fff;font-weight:900}.assistantShell{display:grid;gap:18px;margin:0 auto;max-width:1180px}h1,h2,h3,h4,p{margin:0}p{color:#aebdc4}.answerPanel,.todayStatus,.openTradesPanel,.detailDrawer details,.gate{background:rgba(8,14,17,.95);border:1px solid rgba(29,155,255,.18);border-radius:8px}.answerPanel{border-color:rgba(255,153,0,.48);overflow:hidden}.dailyAnswer{display:grid;gap:18px;padding:34px}.dailyAnswer span,.todayStatus span,.reportMeta span,.accountSummary span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.dailyAnswer h1{color:#fff;font-size:clamp(28px,4vw,46px)}.dailyAnswer>strong{color:#fff;font-size:clamp(32px,5.5vw,72px);line-height:1}.dailyAnswer p{font-size:20px;max-width:820px}.dailyAnswer dl{display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;max-width:900px}.dailyAnswer div{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}.dailyAnswer dt{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.dailyAnswer dd{color:#fff;font-size:22px;font-weight:950;margin:5px 0 0}.dailyAnswer a,.detailDrawer a{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;color:#d7efff;display:inline-flex;font-weight:950;justify-self:start;min-height:40px;align-items:center;padding:0 12px;text-decoration:none}.primaryReportButton{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-size:20px;font-weight:950;justify-self:start;min-height:58px;padding:0 24px}.primaryReportButton:disabled,.reportControls button:disabled{cursor:not-allowed;opacity:.65}.reportControls{align-items:center;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:10px;padding:14px 20px}.reportControls button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;color:#d7efff;cursor:pointer;font-weight:950;min-height:38px;padding:0 12px}.reportWarning{background:rgba(255,90,70,.14);border-top:1px solid rgba(255,90,70,.28);color:#ffc7be;font-weight:850;padding:12px 20px}.todayStatus{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr));padding:14px}.todayStatus article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;display:grid;gap:6px;padding:14px}.todayStatus strong{color:#fff;font-size:24px}.todayStatus p{font-size:13px}.openTradesPanel{display:grid;gap:12px;padding:20px}.openTradesPanel h2{font-size:26px}.openTradesPanel article{align-items:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;display:grid;gap:8px;grid-template-columns:1fr auto auto;padding:14px}.openTradesPanel b{background:rgba(138,100,18,.8);border-radius:7px;color:#fff;padding:7px 10px}.detailDrawer{display:grid;gap:10px}.detailDrawer details{padding:0}.detailDrawer summary{cursor:pointer;font-size:18px;font-weight:950;list-style:none;padding:18px}.detailDrawer summary::-webkit-details-marker{display:none}.detailDrawer details[open] summary{border-bottom:1px solid rgba(255,255,255,.08)}.detailDrawer details>*:not(summary){margin:14px 18px}.settingsGrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.settingsGrid label{color:#aebdc4;display:grid;font-size:12px;font-weight:900;gap:6px;text-transform:uppercase}.settingsGrid input,.settingsGrid select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;height:38px;padding:0 10px}.managementSettings{display:flex;flex-wrap:wrap;gap:10px}.managementSettings label,.detailsToggle{align-items:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:7px;color:#d7efff;display:inline-flex;font-weight:850;gap:8px;min-height:38px;padding:0 12px}.reportBody{display:grid;gap:16px;padding:0}.reportMeta{align-items:center;display:flex;flex-wrap:wrap;gap:12px}.reportMeta strong{background:rgba(255,255,255,.08);border-radius:7px;padding:8px 10px}.reportMeta em{color:#ffd7a1;font-style:normal}.reportGreeting{color:#fff;font-size:20px;font-weight:900;white-space:pre-line}.accountSummary{background:rgba(7,101,61,.16);border:1px solid rgba(13,184,109,.28);border-radius:8px;display:grid;gap:6px;padding:14px}.accountSummary strong{color:#c8ffdf;font-size:18px}.reportItems{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}.recommendation,.positionAction,.instruction{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:8px;display:grid;gap:8px;padding:14px}.recommendation h3{font-size:17px}.recommendation>span{color:#aebdc4;font-size:12px;font-weight:900}.statusPill{border-radius:7px;color:#fff;display:inline-flex;font-size:12px;font-weight:950;justify-self:start;padding:6px 8px}.statusPill.readytobuy{background:#0b8f56}.statusPill.wait,.statusPill.hold{background:#8a6412}.statusPill.dataunavailable,.statusPill.safetyexit{background:#8a2d24}.statusPill.takesomeprofit,.statusPill.finalexit{background:#0057d9}.statusPill.cancelorder{background:#7441a8}.statusPill.noaction{background:#42515a}.recommendation pre{background:#020405;border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#d7efff;font-size:12px;overflow:auto;padding:10px;white-space:pre-wrap}.reportSubsection{display:grid;gap:10px}.reportSubsection h3{font-size:18px}.reportSubsection h4{color:#f5f7f8;font-size:14px;margin-top:6px}.positionAction span,.instruction span,.instruction small{color:#aebdc4}.alertButtons{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 0}.alertButtons button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;color:#d7efff;cursor:pointer;font-weight:950;min-height:40px;padding:0 12px}.overallAction{background:rgba(255,153,0,.14);border:1px solid rgba(255,153,0,.35);border-radius:8px;display:grid;gap:6px;padding:16px}.overallAction span{color:#ffd7a1;font-weight:900}.overallAction strong{font-size:22px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;height:48px;margin-top:16px;width:100%}@media(max-width:900px){.page{padding:88px 16px 16px}.todayStatus{grid-template-columns:repeat(2,minmax(0,1fr))}.dailyAnswer dl{grid-template-columns:1fr}}@media(max-width:640px){.todayStatus,.settingsGrid{grid-template-columns:1fr}.dailyAnswer{padding:24px}.openTradesPanel article{grid-template-columns:1fr}.managementSettings label{width:100%}}
  `}</style>;
}

FreedomTraderDashboard.disableLayout = true;
