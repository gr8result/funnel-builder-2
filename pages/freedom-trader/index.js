import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import AnalyseStockPanel from "../../components/freedom-trader/AnalyseStockPanel";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const LATEST_SCAN_KEY = "freedom-trader-latest-market-scan";
const WATCHLIST = ["MSFT", "AVGO", "NVDA", "AMD", "TSLA", "AMZN", "META", "PLTR"];

function formatCurrency(value, currency = "USD") {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
    : "--";
}

function bestAction(topOpportunity, tradePlan) {
  if (tradePlan?.cmcOrder) return "PREPARE ONE TRADE";
  if (topOpportunity) return "WAIT";
  return "NO TRADE READY";
}

function dashboardAction(marketWatch, journal, topOpportunity, tradePlan) {
  const active = (marketWatch || []).find((item) => ["WAITING_FOR_ENTRY", "POSITION_ACTIVE"].includes(item.state));
  const lastEvent = active?.events?.[active.events.length - 1];
  if (["ENTRY_CONDITION_REACHED", "TAKE_SOME_PROFIT", "ONE_SHARE_EXIT_CHOICE_REQUIRED", "FINAL_EXIT", "SAFETY_EXIT", "REVIEW_DATA_UNAVAILABLE"].includes(lastEvent?.type)) {
    return { label: "ACTION REQUIRED", text: lastEvent.reason || String(lastEvent.type).replace(/_/g, " "), item: active };
  }
  if (active?.state === "WAITING_FOR_ENTRY") return { label: "MONITORING", text: "No action required.", item: active };
  if (active?.state === "POSITION_ACTIVE") return { label: "MONITORING", text: "No action required.", item: active };
  if ((journal || []).length) return { label: "TRADE COMPLETE", text: `Result: ${formatCurrency(journal[0].netProfit, journal[0].currency || "USD")}`, item: null };
  return { label: bestAction(topOpportunity, tradePlan), text: tradePlan?.cmcOrder ? "Enter this order in CMC." : topOpportunity ? "Do not buy yet." : "Do nothing.", item: null };
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
  const [snapshot, setSnapshot] = useState(null);
  const [analysisRows, setAnalysisRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [scanSummary, setScanSummary] = useState(null);
  const [topFive, setTopFive] = useState([]);
  const [topOpportunity, setTopOpportunity] = useState(null);
  const [bestTradePlan, setBestTradePlan] = useState(null);
  const [marketWatch, setMarketWatch] = useState([]);
  const [journal, setJournal] = useState([]);
  const [fillForm, setFillForm] = useState({ actualFillPrice: "", quantity: "", filledAt: "" });
  const [saleForm, setSaleForm] = useState({ quantitySold: "", salePrice: "", soldAt: "", reason: "manual" });
  const [watchMessage, setWatchMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      try {
        const cachedScan = JSON.parse(window.localStorage.getItem(LATEST_SCAN_KEY) || "null");
        if (cachedScan?.scanSummary) {
          setScanSummary(cachedScan.scanSummary);
          setTopFive(Array.isArray(cachedScan.topFive) ? cachedScan.topFive : []);
          setTopOpportunity(cachedScan.topOpportunity || cachedScan.bestCurrentTrade || cachedScan.bestSetupToWatch || null);
          setBestTradePlan(cachedScan.bestTradePlan || null);
        }
      } catch {}
      const [paperResponse, analysisResponse, alertsResponse, scannerResponse, watchResponse] = await Promise.allSettled([
        fetch("/api/freedom-trader/paper-account"),
        fetch(`/api/freedom-trader/analysis?symbols=${WATCHLIST.join(",")}`),
        fetch("/api/freedom-trader/alerts"),
        fetch("/api/freedom-trader/scanner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markets: ["US"], force: false }),
        }),
        fetch("/api/freedom-trader/watchlist"),
      ]);
      if (cancelled) return;
      const paperData = paperResponse.status === "fulfilled" ? await paperResponse.value.json().catch(() => null) : null;
      const analysisData = analysisResponse.status === "fulfilled" ? await analysisResponse.value.json().catch(() => null) : null;
      const alertsData = alertsResponse.status === "fulfilled" ? await alertsResponse.value.json().catch(() => null) : null;
      const scannerData = scannerResponse.status === "fulfilled" ? await scannerResponse.value.json().catch(() => null) : null;
      const watchData = watchResponse.status === "fulfilled" ? await watchResponse.value.json().catch(() => null) : null;
      const watchlistSymbols = Array.from(new Set((Array.isArray(watchData?.watchlist) && watchData.watchlist.length ? watchData.watchlist : WATCHLIST.map((symbol) => ({ symbol }))).map((item) => item.symbol).filter(Boolean)));
      let resolvedAnalysisData = analysisData;
      if (watchlistSymbols.some((symbol) => !WATCHLIST.includes(symbol))) {
        resolvedAnalysisData = await fetch(`/api/freedom-trader/analysis?symbols=${watchlistSymbols.slice(0, 20).join(",")}`).then((response) => response.json()).catch(() => analysisData);
      }
      setSnapshot(paperData?.ok ? paperData : null);
      setAnalysisRows(Array.isArray(resolvedAnalysisData?.analysis) ? resolvedAnalysisData.analysis : []);
      setAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts.slice(0, 5) : []);
      setMarketWatch(Array.isArray(watchData?.marketWatch) ? watchData.marketWatch : []);
      setJournal(Array.isArray(watchData?.journal) ? watchData.journal : []);
      if (scannerData?.ok && scannerData.scanSummary) {
        setScanSummary(scannerData.scanSummary);
        setTopFive(Array.isArray(scannerData.topFive) ? scannerData.topFive : []);
        setTopOpportunity(scannerData.topOpportunity || scannerData.bestCurrentTrade || scannerData.bestSetupToWatch || null);
        setBestTradePlan(scannerData.bestTradePlan || null);
        window.localStorage.setItem(LATEST_SCAN_KEY, JSON.stringify({
          scanSummary: scannerData.scanSummary,
          topFive: scannerData.topFive || [],
          results: scannerData.results || [],
          topOpportunity: scannerData.topOpportunity || null,
          bestCurrentTrade: scannerData.bestCurrentTrade || null,
          bestTradePlan: scannerData.bestTradePlan || null,
          bestSetupToWatch: scannerData.bestSetupToWatch || null,
          opportunityRanking: scannerData.opportunityRanking || null,
          updatedAt: scannerData.updatedAt || new Date().toISOString(),
        }));
      }
      setLoading(false);
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [unlocked]);

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

  async function submitFill(item) {
    const response = await fetch("/api/freedom-trader/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, actualFillPrice: Number(fillForm.actualFillPrice), quantity: Number(fillForm.quantity), filledAt: fillForm.filledAt || new Date().toISOString() }),
    });
    const data = await response.json().catch(() => null);
    setWatchMessage(response.ok && data?.ok ? "Actual fill recorded." : data?.error || "Unable to record fill.");
    if (data?.marketWatchItem) setMarketWatch((current) => current.map((row) => row.id === data.marketWatchItem.id ? data.marketWatchItem : row));
  }

  async function submitSale(item) {
    const response = await fetch("/api/freedom-trader/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_sale", id: item.id, quantitySold: Number(saleForm.quantitySold), salePrice: Number(saleForm.salePrice), soldAt: saleForm.soldAt || new Date().toISOString(), reason: saleForm.reason }),
    });
    const data = await response.json().catch(() => null);
    setWatchMessage(response.ok && data?.ok ? data.message : data?.error || "Unable to record sale.");
    if (data?.marketWatchItem) {
      setMarketWatch((current) => current.map((row) => row.id === data.marketWatchItem.id ? data.marketWatchItem : row));
      const refreshed = await fetch("/api/freedom-trader/watchlist").then((res) => res.json()).catch(() => null);
      setJournal(Array.isArray(refreshed?.journal) ? refreshed.journal : []);
    }
  }

  const account = snapshot?.account;
  const positions = useMemo(() => snapshot?.positions || [], [snapshot]);
  const primary = dashboardAction(marketWatch, journal, topOpportunity, bestTradePlan);
  const capitalFlow = scanSummary?.capitalFlow || {};
  const topCapitalFlow = capitalFlow.top?.[0] || null;

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Freedom Trader</title></Head>
      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong>FREEDOM TRADER</strong>
        <span>Active Trading & Market Opportunities</span>
      </section>
      <FreedomModuleNav module="trader" paper />
      <AnalyseStockPanel />
      <PaperAccountBar />

      <header className="hero" id="dashboard">
        <div>
          <span>Paper trading workspace</span>
          <h1>Freedom Trader</h1>
          <p>Paper trading, active setups, alerts and trade management. No real money is used.</p>
        </div>
        <Link href="/freedom-investment">Open Freedom Investment</Link>
      </header>

      <section className="panel">
        <div className="panelHeader"><h2>PAPER ACCOUNT SUMMARY</h2>{loading ? <span>Loading...</span> : null}</div>
        <div className="summaryGrid">
          <Card label="Virtual Cash" value={formatCurrency(account?.availableCash, account?.currency || "AUD")} />
          <Card label="Invested Value" value={formatCurrency(account?.currentInvestedValue, account?.currency || "AUD")} />
          <Card label="Total Value" value={formatCurrency(account?.totalAccountValue, account?.currency || "AUD")} />
          <Card label="Open Profit/Loss" value={formatCurrency(account?.openProfitLoss, account?.currency || "AUD")} tone={Number(account?.openProfitLoss) >= 0 ? "profit" : "loss"} />
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>WHAT SHOULD I DO?</h2></div>
        <div className="bestLine">
          <span>{primary.label}</span>
          <strong>{primary.text}</strong>
          {primary.item ? <p>{primary.item.plan?.companyName} ({primary.item.plan?.symbol}) is {String(primary.item.state).replace(/_/g, " ")}.</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>MARKET ACTIVITY</h2></div>
        <div className="summaryGrid">
          <Card label="Scanning" value={`${capitalFlow.scanning ?? scanSummary?.requested ?? "--"} companies`} />
          <Card label="Strong Buying Pressure" value={capitalFlow.strongBuyingPressure ?? "--"} />
          <Card label="Developing" value={capitalFlow.developing ?? "--"} />
          <Card label="Review Now" value={capitalFlow.reviewNow ?? "--"} tone={Number(capitalFlow.reviewNow) > 0 ? "profit" : ""} />
        </div>
        {topCapitalFlow ? (
          <div className="bestLine">
            <span>TOP CAPITAL FLOW</span>
            <strong>{topCapitalFlow.symbol} - Capital Flow {topCapitalFlow.capitalFlowScore ?? "--"}</strong>
            <p>{Number.isFinite(Number(topCapitalFlow.priceChangePercent)) ? `${Number(topCapitalFlow.priceChangePercent) > 0 ? "+" : ""}${Number(topCapitalFlow.priceChangePercent).toFixed(2)}%` : "--"} / {topCapitalFlow.relativeVolume ?? "--"}x normal activity / {topCapitalFlow.state}</p>
          </div>
        ) : null}
      </section>

      <section className="panel" id="market-scan">
        <div className="panelHeader"><h2>TODAY'S BEST OPPORTUNITIES</h2><Link href="/freedom-trader/market-opportunities">Open Market Opportunities</Link></div>
        <div className="summaryGrid">
          <Card label="US Supported" value={scanSummary?.coverage?.US?.totalSupported ?? "--"} />
          <Card label="US Pre-screen Eligible" value={scanSummary?.coverage?.US?.eligibleForScreening ?? "--"} />
          <Card label="Detailed Analyses" value={scanSummary?.successfullyAnalysed ?? "--"} />
          <Card label="Unavailable" value={scanSummary?.unavailable ?? "--"} tone={Number(scanSummary?.unavailable) > 0 ? "loss" : "profit"} />
        </div>
        {scanSummary?.coverage?.ASX?.unavailableReason ? <div className="bestLine"><span>ASX SCANNING UNAVAILABLE</span><p>{scanSummary.coverage.ASX.unavailableReason}</p></div> : null}
        {topOpportunity ? (
          <div className="bestLine">
            <span>{bestAction(topOpportunity, bestTradePlan)}</span>
            <strong>#{1} {topOpportunity.companyName} ({topOpportunity.symbol})</strong>
            <em>{bestTradePlan?.cmcOrder ? "READY. Prepare this CMC trade." : `${topOpportunity.status}. Do not buy yet.`}</em>
            <p>{topOpportunity.reason}</p>
            {bestTradePlan?.cmcOrder ? (
              <div className="planMini">
                <b>Buy only at: {formatCurrency(bestTradePlan.buyTrigger, bestTradePlan.currency)}</b>
                <b>Safety Exit: {formatCurrency(bestTradePlan.safetyExit, bestTradePlan.currency)}</b>
                <b>Final Exit: {formatCurrency(bestTradePlan.finalExit, bestTradePlan.currency)}</b>
                <b>Quantity: {bestTradePlan.positionSizing?.quantity ?? "--"} shares</b>
              </div>
            ) : null}
          </div>
        ) : scanSummary ? (
          <div className="bestLine">
            <span>NO TRADE READY</span>
            <strong>Wait.</strong>
            <p>Freedom analysed {scanSummary.successfullyAnalysed} companies. None currently meets all trading rules.</p>
          </div>
        ) : null}
        <div className="tableWrap">
          <table>
            <thead><tr><th>Company</th><th>Ticker</th><th>Score</th><th>Status</th><th>Current</th><th>Preferred Buy</th><th>Safety Exit</th><th>Reason</th></tr></thead>
            <tbody>
              {topFive.length ? topFive.map((row, index) => (
                <tr key={row.symbol}>
                  <td><Link href={`/freedom-trader/company/${row.symbol}?from=dashboard`}>#{index + 1} {row.companyName}</Link></td>
                  <td>{row.symbol}</td>
                  <td>{Number.isFinite(Number(row.tradingScore)) ? Number(row.tradingScore).toFixed(2) : "--"}</td>
                  <td>{row.status || "--"}</td>
                  <td>{formatCurrency(row.currentPrice, row.currency || "USD")}</td>
                  <td>{formatCurrency(row.preferredBuy ?? row.recommendedEntry, row.currency || "USD")}</td>
                  <td>{formatCurrency(row.safetyExit ?? row.stopLoss, row.currency || "USD")}</td>
                  <td>{row.reason || "--"}</td>
                </tr>
              )) : <tr><td colSpan="8">No completed market scan is available yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="watchlist">
        <div className="panelHeader"><h2>CURRENT WATCHLIST</h2><Link href="/freedom-trader/market-opportunities">Open Scanner</Link></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Ticker</th><th>Current Signal</th><th>Timeframe</th><th>Current Price</th><th>Action</th></tr></thead>
            <tbody>
              {analysisRows.length ? analysisRows.map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{row.signalResult?.overallSignal || row.status || "--"}</td>
                  <td>{row.signalResult?.timeframe || "1D"}</td>
                  <td>{formatCurrency(row.currentPrice, row.currency || "USD")}</td>
                  <td><Link href={`/freedom-trader/company/${row.symbol}`}>Open Company</Link></td>
                </tr>
              )) : <tr><td colSpan="5">Watchlist analysis is loading or temporarily unavailable.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>OPEN PAPER POSITIONS</h2><Link href="/freedom-trader/portfolio">View Portfolio</Link></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Ticker</th><th>Quantity</th><th>Entry</th><th>Current Price</th><th>Profit/Loss</th></tr></thead>
            <tbody>
              {positions.length ? positions.map((position) => (
                <tr key={position.id}>
                  <td><Link href={`/freedom-trader/company/${position.ticker}`}>{position.ticker}</Link></td>
                  <td>{position.quantity}</td>
                  <td>{formatCurrency(position.averageEntry, position.currency)}</td>
                  <td>{formatCurrency(position.currentPrice, position.currency)}</td>
                  <td className={Number(position.unrealisedProfitLoss) >= 0 ? "profit" : "loss"}>{formatCurrency(position.unrealisedProfitLoss, position.currency)}</td>
                </tr>
              )) : <tr><td colSpan="5">No open paper positions.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>MARKET WATCH</h2></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Company</th><th>Symbol</th><th>State</th><th>Entry</th><th>Safety Exit</th><th>Targets</th><th>Record</th></tr></thead>
            <tbody>
              {marketWatch.length ? marketWatch.slice(0, 8).map((item) => (
                <tr key={item.id}>
                  <td>{item.plan?.companyName}</td>
                  <td>{item.plan?.symbol}</td>
                  <td>{String(item.state || "").replace(/_/g, " ")}</td>
                  <td>{formatCurrency(item.actualFillPrice || item.plan?.buyTrigger, item.plan?.currency)}</td>
                  <td>{formatCurrency(item.plan?.safetyExit, item.plan?.currency)}</td>
                  <td>{formatCurrency(item.plan?.takeSomeProfit, item.plan?.currency)} / {formatCurrency(item.plan?.finalExit, item.plan?.currency)}</td>
                  <td>
                    {item.state === "WAITING_FOR_ENTRY" ? <div className="inlineForm"><input placeholder="Fill price" value={fillForm.actualFillPrice} onChange={(event) => setFillForm((current) => ({ ...current, actualFillPrice: event.target.value }))} /><input placeholder="Quantity" value={fillForm.quantity} onChange={(event) => setFillForm((current) => ({ ...current, quantity: event.target.value }))} /><input placeholder="Date/time" value={fillForm.filledAt} onChange={(event) => setFillForm((current) => ({ ...current, filledAt: event.target.value }))} /><button type="button" onClick={() => submitFill(item)}>ORDER FILLED</button></div> : null}
                    {item.state === "POSITION_ACTIVE" ? <div className="inlineForm"><input placeholder="Qty sold" value={saleForm.quantitySold} onChange={(event) => setSaleForm((current) => ({ ...current, quantitySold: event.target.value }))} /><input placeholder="Sale price" value={saleForm.salePrice} onChange={(event) => setSaleForm((current) => ({ ...current, salePrice: event.target.value }))} /><input placeholder="Date/time" value={saleForm.soldAt} onChange={(event) => setSaleForm((current) => ({ ...current, soldAt: event.target.value }))} /><input placeholder="Reason" value={saleForm.reason} onChange={(event) => setSaleForm((current) => ({ ...current, reason: event.target.value }))} /><button type="button" onClick={() => submitSale(item)}>RECORD SALE</button></div> : null}
                  </td>
                </tr>
              )) : <tr><td colSpan="7">No Market Watch plans.</td></tr>}
            </tbody>
          </table>
        </div>
        {watchMessage ? <div className="bestLine"><p>{watchMessage}</p></div> : null}
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>TRADE JOURNAL</h2></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Company</th><th>Symbol</th><th>Entry</th><th>Exit</th><th>Quantity</th><th>Net P/L</th><th>Reason</th></tr></thead>
            <tbody>
              {journal.length ? journal.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td>{row.companyName}</td>
                  <td>{row.symbol}</td>
                  <td>{formatCurrency(row.entryPrice, row.currency || "USD")}</td>
                  <td>{formatCurrency(row.exitPrice, row.currency || "USD")}</td>
                  <td>{row.quantity}</td>
                  <td className={Number(row.netProfit) >= 0 ? "profit" : "loss"}>{formatCurrency(row.netProfit, row.currency || "USD")}</td>
                  <td>{row.exitReason}</td>
                </tr>
              )) : <tr><td colSpan="7">No completed trades in the journal.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>RECENT ALERTS</h2><Link href="/freedom-trader/alerts">View Alerts</Link></div>
        <div className="alertList">
          {alerts.length ? alerts.map((alert) => (
            <article key={alert.id || `${alert.symbol}-${alert.alertType}`}>
              <strong>{alert.symbol} {alert.alertType}</strong>
              <span>{alert.status || "active"} at {formatCurrency(alert.triggerPrice)}</span>
            </article>
          )) : <p>No recent alerts.</p>}
        </div>
      </section>

      <Styles />
    </div>
  );
}

function Card({ label, value, tone = "" }) {
  return <article className={tone}><span>{label}</span><strong>{value}</strong></article>;
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{color:#fff;font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{color:#fff;font-weight:900}.hero,.panel,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero,.panel{margin:0 auto 18px;max-width:1840px}.hero{align-items:center;display:flex;gap:24px;justify-content:space-between;padding:28px}.hero span,.panelHeader span,.summaryGrid span,.bestLine span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}h1,h2,p{margin:0}h1{font-size:48px}p{color:#aebdc4}.hero a,.panelHeader a,td a{color:#d7efff;font-weight:950;text-decoration:none}.panel{overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;justify-content:space-between;padding:16px 18px}.summaryGrid{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));padding:16px}.summaryGrid article,.bestLine{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px}.summaryGrid strong{display:block;font-size:26px;margin-top:8px}.bestLine{margin:0 16px 16px}.bestLine strong{display:block;font-size:24px;margin-top:6px}.bestLine em{color:#b8f4e6;display:block;font-style:normal;font-weight:950;margin-top:6px}.bestLine p{margin-top:6px}.planMini{display:grid;gap:8px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:12px}.planMini b{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:10px}.profit{color:#8ff0c3!important}.loss{color:#ff9a9a!important}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:760px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:12px;text-align:left;vertical-align:top}th{color:#aebdc4;font-size:12px;text-transform:uppercase}.inlineForm{display:grid;gap:8px;grid-template-columns:repeat(4,minmax(90px,1fr));min-width:520px}.inlineForm input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:36px;padding:0 10px}.inlineForm button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:36px;padding:0 10px}.alertList{display:grid;gap:10px;padding:16px}.alertList article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;display:flex;justify-content:space-between;padding:12px}.alertList span{color:#aebdc4}.hero a,.panelHeader a{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);border-radius:7px;display:inline-flex;min-height:38px;align-items:center;padding:0 12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;height:48px;margin-top:16px;width:100%}@media(max-width:900px){.summaryGrid,.planMini{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{align-items:flex-start;flex-direction:column}.page{padding:88px 16px 16px}}@media(max-width:640px){.summaryGrid,.planMini{grid-template-columns:1fr}.inlineForm{grid-template-columns:1fr;min-width:260px}}
  `}</style>;
}

FreedomTraderDashboard.disableLayout = true;
