import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import { traderCompanyHref } from "../../lib/freedom/companyRoutes";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

function formatCurrency(value, currency = "USD") {
  return Number.isFinite(Number(value))
    ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
    : "--";
}

function userFacingReportError(message = "") {
  if (!message) return "";
  if (/supabase|migration|database|persist|save/i.test(message)) return "Report history is unavailable right now. Today's answer can still be generated from the loaded account data.";
  return message;
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
  const [developingRows, setDevelopingRows] = useState([]);
  const [scanSummary, setScanSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [journalTrades, setJournalTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [paperAccount, setPaperAccount] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [actionAlerts, setActionAlerts] = useState([]);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDetailsOpen, setReportDetailsOpen] = useState(false);
  const [reportSettings, setReportSettings] = useState({
    tradingBalance: 5000,
    availableCash: 5000,
    accountCurrency: "AUD",
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
      const [scannerResponse, alertsResponse, journalResponse, positionsResponse, paperResponse, reportResponse] = await Promise.allSettled([
        fetch("/api/freedom-trader/scanner?offset=0", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markets: ["US"], chunkSize: 10, minimumScore: 82, minimumDailyVolume: 1000000, minimumRiskReward: 2, maximumVolatility: 9 }),
        }),
        fetch("/api/freedom-trader/alerts"),
        fetch("/api/freedom-trader/trade-journal"),
        fetch("/api/freedom-trader/positions"),
        fetch("/api/freedom-trader/paper-account"),
        fetch("/api/freedom-trader/action-report?reportType=now"),
      ]);
      if (cancelled) return;
      const scannerData = scannerResponse.status === "fulfilled" ? await scannerResponse.value.json().catch(() => null) : null;
      const alertsData = alertsResponse.status === "fulfilled" ? await alertsResponse.value.json().catch(() => null) : null;
      const journalData = journalResponse.status === "fulfilled" ? await journalResponse.value.json().catch(() => null) : null;
      const positionsData = positionsResponse.status === "fulfilled" ? await positionsResponse.value.json().catch(() => null) : null;
      const paperData = paperResponse.status === "fulfilled" ? await paperResponse.value.json().catch(() => null) : null;
      const reportData = reportResponse.status === "fulfilled" ? await reportResponse.value.json().catch(() => null) : null;
      setOpportunityRows(Array.isArray(scannerData?.results) ? scannerData.results.slice(0, 5) : []);
      setDevelopingRows(Array.isArray(scannerData?.scannerStatus) ? scannerData.scannerStatus.filter((row) => row.rejectionReason).slice(0, 8) : []);
      setScanSummary(scannerData?.scanSummary || null);
      setAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts.slice(0, 5) : []);
      setJournalTrades(Array.isArray(journalData?.trades) ? journalData.trades.slice(0, 5) : []);
      setPositions(Array.isArray(positionsData?.positions) ? positionsData.positions.filter((position) => position.status !== "closed").slice(0, 10) : []);
      setPaperAccount(paperData?.account || null);
      setPendingOrders(Array.isArray(paperData?.pendingOrders) ? paperData.pendingOrders : []);
      setReport(reportData?.report || null);
      setRecentReports(Array.isArray(reportData?.recentReports) ? reportData.recentReports.slice(0, 5) : []);
      setActionAlerts(Array.isArray(reportData?.alerts) ? reportData.alerts.slice(0, 8) : []);
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
    if (!paperAccount) return;
    setReportSettings((current) => ({
      ...current,
      tradingBalance: Number(paperAccount.startingBalance ?? paperAccount.tradingBalance) || current.tradingBalance,
      availableCash: Number(paperAccount.availableCash) || current.availableCash,
      accountCurrency: paperAccount.currency || current.accountCurrency,
    }));
  }, [paperAccount]);

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

  const bestOpportunities = useMemo(() => opportunityRows
    .sort((a, b) => (b.tradingScore || 0) - (a.tradingScore || 0))
    .slice(0, 5), [opportunityRows]);

  async function generateReport(reportType) {
    setReportLoading(true);
    setReportError("");
    try {
      const response = await fetch("/api/freedom-trader/action-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          scannerRows: bestOpportunities,
          positions,
          pendingOrders,
          trades: journalTrades,
          account: paperAccount,
          settings: reportSettings,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok || !data?.report) throw new Error(data?.error || "Freedom could not generate the report right now.");
      setReport(data.report);
      setRecentReports(Array.isArray(data.recentReports) ? data.recentReports.slice(0, 5) : [data.report]);
      setActionAlerts(Array.isArray(data.alerts) ? data.alerts.slice(0, 8) : []);
      setReportError(userFacingReportError(data.persistenceError || data.error || ""));
    } catch (error) {
      setReportError(userFacingReportError(error.message || "Freedom could not generate the report right now."));
    } finally {
      setReportLoading(false);
    }
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
      <header className="todayHero">
        <div>
          <span>Today&apos;s decision</span>
          <h1>What should Grant do today?</h1>
          <p>Uses only loaded account, position, broker-journal, scanner and saved report data. Manual inputs below are labelled as manual settings.</p>
        </div>
        <button className="primaryReportButton" type="button" onClick={() => generateReport("now")} disabled={reportLoading}>
          {reportLoading ? "Checking today..." : "Answer Now"}
        </button>
      </header>

      <section className="decisionPanel">
        <div className="reportControls">
          <button type="button" onClick={() => generateReport("morning")} disabled={reportLoading}>Morning Report</button>
          <button type="button" onClick={() => generateReport("evening")} disabled={reportLoading}>Evening Report</button>
          <button type="button" onClick={() => generateReport(report?.reportType || "now")} disabled={reportLoading}>Refresh</button>
          <label><input checked={reportDetailsOpen} onChange={(event) => setReportDetailsOpen(event.target.checked)} type="checkbox" /> Show analysis details</label>
        </div>
        {reportError ? <div className="reportWarning">{reportError}</div> : null}
        {report ? <ReportView report={report} showDetails={reportDetailsOpen} alerts={actionAlerts} recentReports={recentReports} /> : (
          <div className="assistantEmpty">
            <strong>No daily answer has been generated yet.</strong>
            <p>Click Answer Now to assess the real data currently loaded for Grant&apos;s account.</p>
          </div>
        )}
      </section>

      <section className="panel accountPanel">
        <div className="panelHeader">
          <div>
            <span>Real account inputs</span>
            <h2>Grant&apos;s Account Today</h2>
          </div>
          <Link href="/freedom-trader/portfolio">Open Portfolio</Link>
        </div>
        <div className="summaryGrid">
          <Card label="Available cash from account" value={paperAccount ? formatCurrency(paperAccount.availableCash, paperAccount.currency || "AUD") : "Account not connected"} />
          <Card label="Trading balance from account" value={paperAccount ? formatCurrency(paperAccount.startingBalance ?? paperAccount.tradingBalance, paperAccount.currency || "AUD") : "Account not connected"} />
          <Card label="Open positions loaded" value={positions.length} />
          <Card label="Pending orders loaded" value={pendingOrders.length} />
        </div>
        {paperAccount ? <p className="accountNote">Account values above came from Grant&apos;s saved account record. Manual limits below still control the assistant&apos;s sizing and risk rules.</p> : <p className="accountNote">No saved account record was returned. The assistant can still run, but it will use the clearly labelled manual settings below.</p>}
      </section>

      <section className="panel manualPanel">
        <div className="panelHeader">
          <div>
            <span>Manual settings</span>
            <h2>Grant&apos;s Risk Limits</h2>
          </div>
        </div>
        <div className="settingsGrid">
          <label>Manual trading balance<input type="number" value={reportSettings.tradingBalance} onChange={(event) => updateReportSetting("tradingBalance", event.target.value)} /></label>
          <label>Manual available cash<input type="number" value={reportSettings.availableCash} onChange={(event) => updateReportSetting("availableCash", event.target.value)} /></label>
          <label>Manual max loss / trade<input type="number" value={reportSettings.maximumPlannedLossPerTrade} onChange={(event) => updateReportSetting("maximumPlannedLossPerTrade", event.target.value)} /></label>
          <label>Manual max open positions<input type="number" value={reportSettings.maximumOpenPositions} onChange={(event) => updateReportSetting("maximumOpenPositions", event.target.value)} /></label>
          <label>Manual max position value<input type="number" value={reportSettings.maximumPositionValue} onChange={(event) => updateReportSetting("maximumPositionValue", event.target.value)} /></label>
          <label>Manual max committed<input type="number" value={reportSettings.maximumTotalMoneyCommitted} onChange={(event) => updateReportSetting("maximumTotalMoneyCommitted", event.target.value)} /></label>
          <label>Manual max total loss<input type="number" value={reportSettings.maximumTotalPlannedLoss} onChange={(event) => updateReportSetting("maximumTotalPlannedLoss", event.target.value)} /></label>
          <label>Manual take profit %<input type="number" value={reportSettings.takeSomeProfitPercent} onChange={(event) => updateReportSetting("takeSomeProfitPercent", event.target.value)} /></label>
        </div>
        <div className="managementSettings">
          <label><input checked={reportSettings.moveSafetyExitToEntryAfterTakeProfit} onChange={(event) => toggleReportSetting("moveSafetyExitToEntryAfterTakeProfit", event.target.checked)} type="checkbox" /> After Take Some Profit, move Safety Exit to the original buy price</label>
          <label><input checked={reportSettings.target1IsCompleteExit} onChange={(event) => toggleReportSetting("target1IsCompleteExit", event.target.checked)} type="checkbox" /> Treat Take Some Profit as the complete exit when no Final Exit is available</label>
        </div>
      </section>

      <section className="panel inputPanel">
        <div className="panelHeader">
          <div>
            <span>Loaded trading data</span>
            <h2>What Freedom Checked</h2>
          </div>
          <Link href="/freedom-trader/market-opportunities">Open Scanner</Link>
        </div>
        {loading ? <div className="emptyState">Loading Grant&apos;s trading inputs...</div> : null}
        <div className="supportGrid">
          <article>
            <span>Scanner opportunities</span>
            <strong>{bestOpportunities.length}</strong>
            <p>{scanSummary ? `${scanSummary.symbolsRequested} symbols checked in the latest loaded scan.` : "No scan summary returned."}</p>
          </article>
          <article>
            <span>Developing setups</span>
            <strong>{developingRows.length}</strong>
            <p>{developingRows.length ? "These did not pass every rule yet." : "No developing setups were returned."}</p>
          </article>
          <article>
            <span>Alerts loaded</span>
            <strong>{alerts.length}</strong>
            <p>{alerts.length ? "Recent saved alerts are available below." : "No saved alerts were returned."}</p>
          </article>
          <article>
            <span>Journal trades loaded</span>
            <strong>{journalTrades.length}</strong>
            <p>{updatedAt ? `Last dashboard refresh: ${new Date(updatedAt).toLocaleString()}` : "No refresh timestamp returned."}</p>
          </article>
        </div>
      </section>

      {bestOpportunities.length ? (
        <section className="panel">
          <div className="panelHeader"><h2>Candidate Trades Checked Today</h2></div>
          <div className="opportunityList">
            {bestOpportunities.map((row, index) => (
              <article key={row.symbol}>
                <span>#{index + 1}</span>
                <strong>{row.symbol} {row.companyName ? `- ${row.companyName}` : ""}</strong>
                <p>{formatCurrency(row.currentPrice, row.currency || "USD")} current price. Score {Number.isFinite(row.tradingScore) ? row.tradingScore : "--"}.</p>
                <Link href={traderCompanyHref(row.symbol)}>Open analysis</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      </main>
      <Styles />
    </div>
  );
}

function Card({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
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
            <span>Conditional buy: {item.conditionalBuy}</span>
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
          <p>Suggested quantity: {item.suggestedQuantity} shares</p>
          <p>Estimated purchase value: {formatCurrency(item.estimatedPurchaseValue, item.currency)}</p>
          <p>Maximum planned loss: {formatCurrency(item.maximumPlannedLoss, accountCurrency)} plus costs</p>
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{color:#fff;font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{color:#fff;font-weight:900}.assistantShell{display:grid;gap:18px;margin:0 auto;max-width:1540px}.todayHero,.decisionPanel,.panel,.gate{background:rgba(8,14,17,.94);border:1px solid rgba(29,155,255,.18);border-radius:8px}.todayHero{align-items:center;border-color:rgba(255,153,0,.42);display:grid;gap:22px;grid-template-columns:minmax(0,1fr) auto;padding:34px}.todayHero span,.panelHeader span,.summaryGrid span,.supportGrid span,.accountSummary span,.reportMeta span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}h1,h2,h3,h4,p{margin:0}h1{font-size:clamp(38px,5vw,76px);line-height:.96;max-width:920px}h2{font-size:22px}h3{font-size:16px}p{color:#aebdc4}.todayHero p{font-size:18px;max-width:820px}.primaryReportButton{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-size:20px;font-weight:950;min-height:64px;padding:0 26px}.primaryReportButton:disabled,.reportControls button:disabled{cursor:not-allowed;opacity:.65}.decisionPanel{border-color:rgba(255,153,0,.38);overflow:hidden}.assistantEmpty{background:rgba(255,153,0,.1);display:grid;gap:8px;padding:26px}.assistantEmpty strong{font-size:24px}.reportControls{align-items:center;display:flex;flex-wrap:wrap;gap:10px;padding:14px 20px}.reportControls button,.panelHeader a,.opportunityList a{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;color:#d7efff;cursor:pointer;display:inline-flex;font-weight:950;min-height:38px;align-items:center;padding:0 12px;text-decoration:none}.reportControls button:hover,.panelHeader a:hover,.opportunityList a:hover{background:rgba(29,155,255,.22);border-color:rgba(94,189,255,.55)}.reportControls label{align-items:center;color:#d7efff;display:inline-flex;font-weight:850;gap:8px}.panel{overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;gap:14px;justify-content:space-between;padding:16px 18px}.summaryGrid,.supportGrid,.opportunityList,.activityGrid{display:grid;gap:14px;padding:16px}.summaryGrid{grid-template-columns:repeat(4,minmax(0,1fr))}.supportGrid,.activityGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.summaryGrid article,.supportGrid article,.opportunityList article,.activityGrid article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;display:grid;gap:8px;padding:16px}.summaryGrid strong,.supportGrid strong{display:block;font-size:24px}.supportGrid article strong{font-size:36px}.activityGrid>div{display:grid;gap:10px}.activityGrid span,.opportunityList span{color:#aebdc4}.settingsGrid{border-top:1px solid rgba(255,255,255,.08);display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));padding:14px 20px}.settingsGrid label{color:#aebdc4;display:grid;font-size:12px;font-weight:900;gap:6px;text-transform:uppercase}.settingsGrid input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;height:38px;padding:0 10px}.managementSettings{align-items:center;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:10px;padding:14px 20px}.managementSettings label{align-items:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:7px;color:#d7efff;display:inline-flex;font-weight:850;gap:8px;min-height:38px;padding:0 12px}.accountNote{padding:0 20px 16px}.reportWarning{background:rgba(255,90,70,.14);border-top:1px solid rgba(255,90,70,.28);color:#ffc7be;font-weight:850;padding:12px 20px}.emptyState{background:rgba(255,153,0,.12);border-bottom:1px solid rgba(255,153,0,.28);color:#ffd7a1;font-size:15px;font-weight:950;padding:20px;text-align:center}.reportBody{border-top:1px solid rgba(255,255,255,.08);display:grid;gap:16px;padding:18px 20px}.reportMeta{align-items:center;display:flex;flex-wrap:wrap;gap:12px}.reportMeta strong{background:rgba(255,255,255,.08);border-radius:7px;padding:8px 10px}.reportMeta em{color:#ffd7a1;font-style:normal}.reportGreeting{color:#fff;font-size:20px;font-weight:900;white-space:pre-line}.accountSummary{background:rgba(7,101,61,.16);border:1px solid rgba(13,184,109,.28);border-radius:8px;display:grid;gap:6px;padding:14px}.accountSummary strong{color:#c8ffdf;font-size:18px}.reportItems{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}.recommendation,.positionAction,.instruction{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:8px;display:grid;gap:8px;padding:14px}.recommendation h3{font-size:17px}.recommendation>span{color:#aebdc4;font-size:12px;font-weight:900}.statusPill{border-radius:7px;color:#fff;display:inline-flex;font-size:12px;font-weight:950;justify-self:start;padding:6px 8px}.statusPill.readytobuy{background:#0b8f56}.statusPill.wait,.statusPill.hold{background:#8a6412}.statusPill.dataunavailable,.statusPill.safetyexit{background:#8a2d24}.statusPill.takesomeprofit,.statusPill.finalexit{background:#0057d9}.statusPill.cancelorder{background:#7441a8}.statusPill.noaction{background:#42515a}.recommendation pre{background:#020405;border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#d7efff;font-size:12px;overflow:auto;padding:10px;white-space:pre-wrap}.reportSubsection{display:grid;gap:10px}.reportSubsection h3{font-size:18px}.reportSubsection h4{color:#f5f7f8;font-size:14px;margin-top:6px}.positionAction span,.instruction span,.instruction small{color:#aebdc4}.overallAction{background:rgba(255,153,0,.14);border:1px solid rgba(255,153,0,.35);border-radius:8px;display:grid;gap:6px;padding:16px}.overallAction span{color:#ffd7a1;font-weight:900}.overallAction strong{font-size:22px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;height:48px;margin-top:16px;width:100%}@media(max-width:900px){.page{padding:88px 16px 16px}.todayHero{grid-template-columns:1fr}.primaryReportButton{width:100%}.summaryGrid,.supportGrid,.activityGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.summaryGrid,.supportGrid,.activityGrid,.settingsGrid{grid-template-columns:1fr}.panelHeader{align-items:flex-start;flex-direction:column}.managementSettings label{width:100%}}
  `}</style>;
}

FreedomTraderDashboard.disableLayout = true;
