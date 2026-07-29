import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import { traderCompanyHref } from "../../lib/freedom/companyRoutes";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const WATCHLIST = ["MSFT", "AAPL", "AVGO", "NVDA", "CBA.AX", "BHP.AX", "CSL.AX", "AMD", "TSLA", "AMZN", "META", "PLTR"];

function formatCurrency(value, currency = "USD") {
  return Number.isFinite(Number(value))
    ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
    : "--";
}

function marketState(timeZone, openHour, closeHour) {
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone,
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const weekday = parts.weekday;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return isWeekday && minutes >= openHour * 60 && minutes < closeHour * 60 ? "Open" : "Closed";
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
      setReportError(reportData?.error || "");
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
      setReportError(data.persistenceError || data.error || "");
    } catch (error) {
      setReportError(error.message || "Freedom could not generate the report right now.");
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
      <Head><title>Freedom Trader</title></Head>
      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong>FREEDOM TRADER</strong>
        <span>Market Research, Opportunities & Trade Plans</span>
      </section>
      <FreedomModuleNav module="trader" />

      <header className="hero" id="dashboard">
        <div>
          <span>Trade-opportunity workspace</span>
          <h1>Freedom Trader</h1>
          <p>Market scanner, watchlist, alerts, charts and proposed trade plans. Orders are placed manually through your broker.</p>
        </div>
        <Link href="/freedom-trader/trade-journal">Open Trade Journal</Link>
      </header>

      <section className="panel reportPanel">
        <div className="reportTop">
          <div>
            <span>Plain-English trade report</span>
            <h2>What Should I Do Now?</h2>
            <p>Freedom assesses the loaded scanner, trade-plan, market-data and open-position data. CMC remains the place where orders are entered.</p>
          </div>
          <button className="primaryReportButton" type="button" onClick={() => generateReport("now")} disabled={reportLoading}>
            {reportLoading ? "Analysing..." : "What Should I Do Now?"}
          </button>
        </div>
        <div className="reportControls">
          <button type="button" onClick={() => generateReport("morning")} disabled={reportLoading}>Morning Report</button>
          <button type="button" onClick={() => generateReport("evening")} disabled={reportLoading}>Evening Report</button>
          <button type="button" onClick={() => generateReport(report?.reportType || "now")} disabled={reportLoading}>Refresh</button>
          <label><input checked={reportDetailsOpen} onChange={(event) => setReportDetailsOpen(event.target.checked)} type="checkbox" /> Show analysis details</label>
        </div>
        <div className="settingsGrid">
          <label>Trading balance<input type="number" value={reportSettings.tradingBalance} onChange={(event) => updateReportSetting("tradingBalance", event.target.value)} /></label>
          <label>Available cash<input type="number" value={reportSettings.availableCash} onChange={(event) => updateReportSetting("availableCash", event.target.value)} /></label>
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
        </div>
        {paperAccount ? <p className="accountNote">Paper account loaded: {formatCurrency(paperAccount.availableCash, paperAccount.currency || "AUD")} available. Report settings above control this decision report.</p> : null}
        {reportError ? <div className="reportWarning">{reportError}</div> : null}
        {report ? <ReportView report={report} showDetails={reportDetailsOpen} alerts={actionAlerts} recentReports={recentReports} /> : <div className="emptyState">Click the main button to generate the current action report.</div>}
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>TODAY&apos;S BEST OPPORTUNITIES</h2><Link href="/freedom-trader/market-opportunities">Run / Resume Scanner</Link></div>
        {loading ? <div className="emptyState">Scanning the supported universe...</div> : null}
        {!loading && !bestOpportunities.length ? <div className="noTrades">NO QUALIFYING TRADES TODAY</div> : null}
        <div className="tableWrap">
          <table>
            <thead><tr><th>Rank</th><th>Ticker</th><th>Company</th><th>Exchange</th><th>Current Price</th><th>Status</th><th>Score</th><th>Confidence</th><th>Timeframe</th><th>Entry Zone</th><th>Stop</th><th>Target 1</th><th>Risk/Reward</th><th>Why</th><th>Data Timestamp</th><th>Action</th></tr></thead>
            <tbody>
              {bestOpportunities.length ? bestOpportunities.map((row, index) => (
                <tr key={row.symbol}>
                  <td>{index + 1}</td>
                  <td>{row.symbol}</td>
                  <td>{row.companyName}</td>
                  <td>{row.exchange || "--"}</td>
                  <td>{formatCurrency(row.currentPrice, row.currency || "USD")}</td>
                  <td>{row.status || "--"}</td>
                  <td>{Number.isFinite(row.tradingScore) ? row.tradingScore : "--"}</td>
                  <td>{Number.isFinite(row.confidence) ? `${row.confidence}%` : row.opportunity?.confidence || "--"}</td>
                  <td>{row.opportunity?.timeframe || "1D"}</td>
                  <td>{formatCurrency(row.recommendedEntry, row.currency || "USD")} - {formatCurrency(row.entryZoneHigh, row.currency || "USD")}</td>
                  <td>{formatCurrency(row.stopLoss, row.currency || "USD")}</td>
                  <td>{formatCurrency(row.target, row.currency || "USD")}</td>
                  <td>{Number.isFinite(row.riskReward) ? row.riskReward.toFixed(2) : "--"}</td>
                  <td>{row.reason || row.opportunity?.reasonsFor?.[0] || "--"}</td>
                  <td>{row.opportunity?.priceTimestamp || row.dataStatus?.latestTimestamp || "--"}</td>
                  <td><Link href={traderCompanyHref(row.symbol)}>Open Analysis</Link></td>
                </tr>
              )) : <tr><td colSpan="16">No approved opportunity passed all mandatory conditions.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>DEVELOPING WATCHLIST</h2><span>{scanSummary ? `${scanSummary.symbolsRequested} scanned this run` : ""}</span></div>
        <div className="developingGrid">
          {developingRows.length ? developingRows.map((row) => (
            <article key={row.symbol}>
              <strong>{row.symbol} {row.companyName ? `- ${row.companyName}` : ""}</strong>
              <span>{row.rejectionReason || row.dataStatus?.status || "Waiting for confirmation"}</span>
            </article>
          )) : <p>No developing setups loaded yet.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>SCAN COVERAGE</h2>{loading ? <span>Loading...</span> : null}</div>
        <div className="summaryGrid">
          <Card label="Universe Configured" value={scanSummary?.supportedUniverseCount ?? "--"} />
          <Card label="Symbols Requested" value={scanSummary?.symbolsRequested ?? "--"} />
          <Card label="Loaded" value={scanSummary?.symbolsSuccessfullyLoaded ?? "--"} />
          <Card label="Approved" value={scanSummary?.approvedOpportunities ?? "--"} />
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>MARKET STATUS</h2></div>
        <div className="summaryGrid">
          <Card label="ASX" value={marketState("Australia/Sydney", 10, 16)} />
          <Card label="US Market" value={marketState("America/New_York", 9.5, 16)} />
          <Card label="Data Provider" value="Finnhub / Twelve Data" />
          <Card label="Last Update" value={updatedAt ? new Date(updatedAt).toLocaleString() : "--"} />
        </div>
      </section>

      <section className="panel" id="watchlist">
        <div className="panelHeader"><h2>WATCHLIST</h2></div>
        <div className="quickActions">
          {WATCHLIST.map((symbol) => <Link href={traderCompanyHref(symbol)} key={symbol}>{symbol}</Link>)}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>ALERTS</h2><Link href="/freedom-trader/alerts">View Alerts</Link></div>
        <div className="alertList">
          {alerts.length ? alerts.map((alert) => (
            <article key={alert.id || `${alert.symbol}-${alert.alertType}`}>
              <strong>{alert.symbol} {alert.alertType}</strong>
              <span>{alert.status || "active"} at {formatCurrency(alert.triggerPrice)}</span>
            </article>
          )) : <p>No recent alerts.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>RECENT JOURNAL TRADES</h2><Link href="/freedom-trader/trade-journal">Record Broker Trade</Link></div>
        <div className="alertList">
          {journalTrades.length ? journalTrades.map((trade) => (
            <article key={trade.id}>
              <strong>{trade.ticker} {trade.side}</strong>
              <span>{trade.status} · {formatCurrency(trade.actualFillPrice, trade.currency || "USD")} · {trade.broker || "Broker not set"}</span>
            </article>
          )) : <p>No broker trades recorded yet.</p>}
        </div>
      </section>
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{color:#fff;font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{color:#fff;font-weight:900}.hero,.panel,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero,.panel{margin:0 auto 18px;max-width:1840px}.hero{align-items:center;display:flex;gap:24px;justify-content:space-between;padding:28px}.hero span,.panelHeader span,.summaryGrid span,.reportTop span,.accountSummary span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}h1,h2,h3,h4,p{margin:0}h1{font-size:48px}p{color:#aebdc4}.hero a,.panelHeader a,td a,.quickActions a{color:#d7efff;font-weight:950;text-decoration:none}.panel{overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;justify-content:space-between;padding:16px 18px}.summaryGrid{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));padding:16px}.summaryGrid article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px}.summaryGrid strong{display:block;font-size:24px;margin-top:8px}.noTrades,.emptyState{background:rgba(255,153,0,.12);border-bottom:1px solid rgba(255,153,0,.28);color:#ffd7a1;font-size:22px;font-weight:950;padding:20px;text-align:center}.emptyState{color:#d7efff;font-size:15px}.reportPanel{border-color:rgba(255,153,0,.38)}.reportTop{align-items:center;display:flex;gap:18px;justify-content:space-between;padding:20px}.reportTop h2{font-size:32px;margin:4px 0}.primaryReportButton{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-size:18px;font-weight:950;min-height:58px;padding:0 22px}.primaryReportButton:disabled,.reportControls button:disabled{cursor:not-allowed;opacity:.65}.reportControls{align-items:center;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:10px;padding:14px 20px}.reportControls button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;color:#d7efff;cursor:pointer;font-weight:950;min-height:38px;padding:0 12px}.reportControls button:hover,.quickActions a:hover,.hero a:hover,.panelHeader a:hover{background:rgba(29,155,255,.22);border-color:rgba(94,189,255,.55)}.reportControls label{align-items:center;color:#d7efff;display:inline-flex;font-weight:850;gap:8px}.settingsGrid{border-top:1px solid rgba(255,255,255,.08);display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));padding:14px 20px}.settingsGrid label{color:#aebdc4;display:grid;font-size:12px;font-weight:900;gap:6px;text-transform:uppercase}.settingsGrid input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;height:38px;padding:0 10px}.managementSettings{align-items:center;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:10px;padding:0 20px 14px}.managementSettings label{align-items:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:7px;color:#d7efff;display:inline-flex;font-weight:850;gap:8px;min-height:38px;padding:0 12px}.accountNote{padding:0 20px 14px}.reportWarning{background:rgba(255,90,70,.14);border-top:1px solid rgba(255,90,70,.28);color:#ffc7be;font-weight:850;padding:12px 20px}.reportBody{border-top:1px solid rgba(255,255,255,.08);display:grid;gap:16px;padding:18px 20px}.reportMeta{align-items:center;display:flex;flex-wrap:wrap;gap:12px}.reportMeta strong{background:rgba(255,255,255,.08);border-radius:7px;padding:8px 10px}.reportMeta em{color:#ffd7a1;font-style:normal}.reportGreeting{color:#fff;font-size:20px;font-weight:900;white-space:pre-line}.accountSummary{background:rgba(7,101,61,.16);border:1px solid rgba(13,184,109,.28);border-radius:8px;display:grid;gap:6px;padding:14px}.accountSummary strong{color:#c8ffdf;font-size:18px}.reportItems{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(180px,1fr))}.recommendation,.positionAction,.instruction{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:8px;display:grid;gap:8px;padding:14px}.recommendation h3{font-size:17px}.recommendation>span{color:#aebdc4;font-size:12px;font-weight:900}.statusPill{border-radius:7px;color:#fff;display:inline-flex;font-size:12px;font-weight:950;justify-self:start;padding:6px 8px}.statusPill.readytobuy{background:#0b8f56}.statusPill.wait,.statusPill.hold{background:#8a6412}.statusPill.dataunavailable,.statusPill.safetyexit{background:#8a2d24}.statusPill.takesomeprofit,.statusPill.finalexit{background:#0057d9}.statusPill.cancelorder{background:#7441a8}.statusPill.noaction{background:#42515a}.recommendation pre{background:#020405;border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#d7efff;font-size:12px;overflow:auto;padding:10px;white-space:pre-wrap}.reportSubsection{display:grid;gap:10px}.reportSubsection h3{font-size:18px}.reportSubsection h4{color:#f5f7f8;font-size:14px;margin-top:6px}.positionAction span,.instruction span,.instruction small{color:#aebdc4}.overallAction{background:rgba(255,153,0,.14);border:1px solid rgba(255,153,0,.35);border-radius:8px;display:grid;gap:6px;padding:16px}.overallAction span{color:#ffd7a1;font-weight:900}.overallAction strong{font-size:22px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1640px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:12px;text-align:left;vertical-align:top}th{color:#aebdc4;font-size:12px;text-transform:uppercase}.developingGrid,.alertList{display:grid;gap:10px;padding:16px}.developingGrid article,.alertList article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;display:flex;justify-content:space-between;padding:12px}.developingGrid span,.alertList span{color:#aebdc4}.quickActions{display:flex;flex-wrap:wrap;gap:10px;padding:16px}.quickActions a,.hero a,.panelHeader a{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;display:inline-flex;min-height:38px;align-items:center;padding:0 12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;height:48px;margin-top:16px;width:100%}@media(max-width:1200px){.reportItems{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero,.reportTop{align-items:flex-start;flex-direction:column}.page{padding:88px 16px 16px}.primaryReportButton{width:100%}}@media(max-width:640px){.summaryGrid,.reportItems,.settingsGrid{grid-template-columns:1fr}.alertList article,.developingGrid article{display:grid;gap:5px}.managementSettings label{width:100%}}
  `}</style>;
}

FreedomTraderDashboard.disableLayout = true;
