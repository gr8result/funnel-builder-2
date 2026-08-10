import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const SCANNER_SETTINGS_KEY = "freedom-trader-scanner-settings";
const SCANNER_WATCHLIST_KEY = "freedom-trader-scanner-watchlist";
const LATEST_SCAN_KEY = "freedom-trader-latest-market-scan";

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: "",
  scanFrequency: "during-session",
};

const frequencyMs = {
  "before-open": 60 * 60 * 1000,
  "during-session": 15 * 60 * 1000,
  "after-close": 60 * 60 * 1000,
  manual: 0,
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatCurrency(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? money.format(Number(value)) : "--";
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? number.format(Number(value)) : "--";
}

function formatAge(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return "--";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
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

export default function MarketOpportunities({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [results, setResults] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanSummary, setScanSummary] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [topOpportunity, setTopOpportunity] = useState(null);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    try {
      const stored = JSON.parse(window.localStorage.getItem(SCANNER_SETTINGS_KEY) || "null");
      if (stored && typeof stored === "object") setSettings({ ...DEFAULT_SETTINGS, ...stored });
    } catch {}
    try {
      const latest = JSON.parse(window.localStorage.getItem(LATEST_SCAN_KEY) || "null");
      if (latest?.scanSummary) {
        setScanSummary(latest.scanSummary);
        setTopOpportunity(latest.topOpportunity || latest.bestCurrentTrade || latest.bestSetupToWatch || null);
        setResults(Array.isArray(latest.topFive) ? latest.topFive : []);
        setUpdatedAt(latest.updatedAt || latest.scanSummary.scanCompletedAt || "");
      }
    } catch {}
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked || settings.scanFrequency === "manual") return undefined;
    const interval = window.setInterval(() => runScan({ append: true }), frequencyMs[settings.scanFrequency] || frequencyMs["during-session"]);
    return () => window.clearInterval(interval);
  }, [unlocked, settings, offset]);

  const strongCount = useMemo(() => results.filter((row) => row.qualified || row.tradingScore >= settings.minimumScore).length, [results, settings.minimumScore]);

  async function unlock(event) {
    event.preventDefault();
    const candidateHash = await browserHashPassword(password);
    if (candidateHash !== passwordHash) {
      setError("Incorrect password.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, "true");
    setUnlocked(true);
  }

  function updateSetting(key, value) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    window.localStorage.setItem(SCANNER_SETTINGS_KEY, JSON.stringify(next));
  }

  function saveScannerWatchlist(items) {
    if (!items.length) return;
    try {
      const current = JSON.parse(window.localStorage.getItem(SCANNER_WATCHLIST_KEY) || "[]");
      const bySymbol = new Map(current.map((item) => [item.symbol, item]));
      items.forEach((item) => bySymbol.set(item.symbol, {
        symbol: item.symbol,
        companyName: item.companyName,
        sector: item.setupType,
        addedAt: new Date().toISOString(),
        reason: item.reason,
      }));
      window.localStorage.setItem(SCANNER_WATCHLIST_KEY, JSON.stringify(Array.from(bySymbol.values()).slice(-80)));
    } catch {}
  }

  function notifyNewSetups(items) {
    if (!items.length || typeof window === "undefined") return;
    const title = `${items.length} new Freedom Trader setup${items.length === 1 ? "" : "s"}`;
    const body = items.slice(0, 3).map((item) => `${item.symbol}: ${item.status} (${item.tradingScore})`).join("\n");
    setScanMessage(`${title}: ${body}`);
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body });
    else if (Notification.permission !== "denied") Notification.requestPermission().then((permission) => {
      if (permission === "granted") new Notification(title, { body });
    });
  }

  async function runScan({ append = false } = {}) {
    if (loading) return;
    try {
      setLoading(true);
      setScanMessage("Checking the supported market universe... Broad pre-screen is running before detailed analysis.");
      const response = await fetch(`/api/freedom-trader/scanner?offset=${append ? offset : 0}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, force: !append }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Market scanner is temporarily unavailable.");
      const incoming = data.topFive || data.results || [];
      setOffset(data.nextOffset || 0);
      setScanSummary(data.scanSummary || null);
      setTopOpportunity(data.topOpportunity || null);
      setResults((current) => {
        const bySymbol = new Map((append ? current : []).map((item) => [item.symbol, item]));
        incoming.forEach((item) => bySymbol.set(item.symbol, item));
        return Array.from(bySymbol.values()).sort((a, b) => b.tradingScore - a.tradingScore).slice(0, 100);
      });
      saveScannerWatchlist((data.topFive || []).filter((item) => ["READY", "WAIT"].includes(item.status)));
      notifyNewSetups((data.topFive || []).filter((item) => item.status === "READY"));
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      window.localStorage.setItem(LATEST_SCAN_KEY, JSON.stringify({ scanSummary: data.scanSummary || null, topFive: data.topFive || [], results: data.results || [], topOpportunity: data.topOpportunity || null, bestCurrentTrade: data.bestCurrentTrade || null, bestSetupToWatch: data.bestSetupToWatch || null, opportunityRanking: data.opportunityRanking || null, updatedAt: data.updatedAt || new Date().toISOString() }));
      setScanMessage(data.scanSummary?.status === "complete"
        ? `Market scan complete. Broad screened: ${data.scanSummary.broadScreenRequested}. Detailed analyses: ${data.scanSummary.requested}. READY trades: ${data.scanSummary.ready}.`
        : "Freedom could not analyse enough of the configured market reliably.");
    } catch (err) {
      setScanMessage(err.message || "Market scanner failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <div className="boot">Opening Market Opportunities...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Market Opportunities | Freedom Trader</title></Head>
      <section className="platformBanner"><strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong><span>Active Trading & Market Opportunities</span></section>
      <PaperAccountBar />
      <FreedomModuleNav module="trader" paper />
      <header className="hero">
        <div>
          <h1>Market Opportunities</h1>
          <p>The watchlist follows names you know. This scanner searches supported liquid markets for new setups you have not seen yet.</p>
        </div>
        <div className="heroStats">
          <article><span>Qualified</span><strong>{strongCount}</strong></article>
          <article><span>Last Scan</span><strong>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--"}</strong></article>
          <button type="button" onClick={() => runScan()} disabled={loading}>{loading ? "Checking Market..." : "Check Market Now"}</button>
        </div>
      </header>

      <section className="settings">
        <label>Markets scanned
          <select multiple value={settings.markets} onChange={(event) => updateSetting("markets", Array.from(event.target.selectedOptions).map((option) => option.value))}>
            <option value="US">Provider-supported US common stocks</option>
            <option value="ASX">Provider-supported Australian common stocks</option>
          </select>
        </label>
        <label>Minimum score<input type="number" value={settings.minimumScore} onChange={(event) => updateSetting("minimumScore", Number(event.target.value))} /></label>
        <label>Minimum daily volume<input type="number" value={settings.minimumDailyVolume} onChange={(event) => updateSetting("minimumDailyVolume", Number(event.target.value))} /></label>
        <label>Minimum risk/reward<input type="number" value={settings.minimumRiskReward} onChange={(event) => updateSetting("minimumRiskReward", Number(event.target.value))} /></label>
        <label>Maximum volatility<input type="number" value={settings.maximumVolatility} onChange={(event) => updateSetting("maximumVolatility", Number(event.target.value))} /></label>
        <label>Excluded industries<input value={settings.excludedIndustries} onChange={(event) => updateSetting("excludedIndustries", event.target.value)} placeholder="biotech, cannabis" /></label>
        <label>Scan frequency
          <select value={settings.scanFrequency} onChange={(event) => updateSetting("scanFrequency", event.target.value)}>
            <option value="before-open">Before market open</option>
            <option value="during-session">During trading session</option>
            <option value="after-close">After market close</option>
            <option value="manual">Manual only</option>
          </select>
        </label>
      </section>

      {scanMessage ? <section className="notice">{scanMessage}</section> : null}
      {scanSummary ? (
        <section className="scanSummary">
          <article><span>US supported universe</span><strong>{scanSummary.coverage?.US?.totalSupported ?? "--"}</strong></article>
          <article><span>US pre-screen eligible</span><strong>{scanSummary.coverage?.US?.eligibleForScreening ?? "--"}</strong></article>
          <article><span>US detailed analyses</span><strong>{scanSummary.coverage?.US?.detailedAnalyses ?? "--"}</strong></article>
          <article><span>ASX supported universe</span><strong>{scanSummary.coverage?.ASX?.totalSupported ?? "--"}</strong></article>
          <article><span>ASX pre-screen eligible</span><strong>{scanSummary.coverage?.ASX?.eligibleForScreening ?? "--"}</strong></article>
          <article><span>ASX detailed analyses</span><strong>{scanSummary.coverage?.ASX?.detailedAnalyses ?? "--"}</strong></article>
          <article><span>Total analysed</span><strong>{scanSummary.successfullyAnalysed}</strong></article>
          <article><span>Unavailable</span><strong>{scanSummary.unavailable ?? scanSummary.dataUnavailable}</strong></article>
          <article><span>Qualified</span><strong>{scanSummary.qualified ?? 0}</strong></article>
          <article><span>READY</span><strong>{scanSummary.ready ?? scanSummary.qualified}</strong></article>
          <article><span>WAIT</span><strong>{scanSummary.wait ?? 0}</strong></article>
          <article><span>Developing</span><strong>{scanSummary.developing ?? 0}</strong></article>
          <article><span>Elapsed</span><strong>{Number.isFinite(Number(scanSummary.elapsedMs)) ? `${Math.round(Number(scanSummary.elapsedMs) / 1000)}s` : "--"}</strong></article>
          <article><span>Provider calls</span><strong>{scanSummary.providerDiagnostics?.totalProviderCalls ?? scanSummary.providerDiagnostics?.historyProviderCalls ?? "--"}</strong></article>
          <article><span>Cache hits</span><strong>{scanSummary.providerDiagnostics?.totalCacheHits ?? scanSummary.providerDiagnostics?.historyCacheHits ?? "--"}</strong></article>
          <article><span>Data source</span><strong>{scanSummary.dataSource || "--"}</strong></article>
          <article><span>Oldest market-data age</span><strong>{formatAge(scanSummary.oldestMarketDataAgeMs)}</strong></article>
          <article><span>Newest market-data age</span><strong>{formatAge(scanSummary.newestMarketDataAgeMs)}</strong></article>
          <article><span>Last provider refresh</span><strong>{scanSummary.lastProviderRefresh ? new Date(scanSummary.lastProviderRefresh).toLocaleTimeString() : "--"}</strong></article>
        </section>
      ) : null}
      {scanSummary?.coverage?.ASX?.unavailableReason ? <section className="notice"><strong>ASX SCANNING UNAVAILABLE</strong> {scanSummary.coverage.ASX.unavailableReason}</section> : null}
      {scanSummary?.broadScreenLimitReason ? <section className="notice">{scanSummary.broadScreenLimitReason}</section> : null}

      {scanSummary && topOpportunity ? (
        <section className="bestOpportunity">
          <span>{topOpportunity.status === "READY" ? "BEST CURRENT TRADE" : "BEST SETUP TO WATCH"}</span>
          <h2>#{1} {topOpportunity.companyName} ({topOpportunity.symbol})</h2>
          <strong>{topOpportunity.status === "READY" ? "READY" : `${topOpportunity.status}. Do not buy yet.`}</strong>
          <p>{topOpportunity.reason}</p>
          <div>
            {(topOpportunity.whyRankedFirst || []).slice(0, 4).map((reason) => <small key={reason}>{reason}</small>)}
          </div>
          <Link href={`/freedom-trader/company/${topOpportunity.symbol}?from=scanner`}>Open #1</Link>
        </section>
      ) : scanSummary ? (
        <section className="bestOpportunity">
          <span>NO TRADE READY</span>
          <h2>Wait.</h2>
          <p>Freedom successfully analysed {scanSummary.successfullyAnalysed} companies. None currently meets all of your trading rules.</p>
        </section>
      ) : null}

      <main className="panel">
        <div className="panelHeader">
          <h2>{(scanSummary?.ready ?? 0) > 0 ? "Today's Best Opportunities" : "Best Setups To Watch"}</h2>
          <span>{results.length} shown</span>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Score</th><th>Status</th><th>Current</th>
                <th>Recent High</th><th>Pullback</th><th>Pullback Low</th><th>Reversal</th>
                <th>Preferred Buy</th><th>Distance</th><th>Safety Exit</th><th>Take Some Profit</th><th>Final Exit</th><th>Possible Loss</th><th>Possible Profit</th><th>Why</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={row.symbol}>
                  <td><Link href={`/freedom-trader/company/${row.symbol}?from=scanner`}>#{index + 1} {row.companyName}</Link><small>{row.symbol}</small></td>
                  <td>{formatNumber(row.tradingScore)}</td>
                  <td><span className={`status ${String(row.status).replace(/\s+/g, "").toLowerCase()}`}>{row.status}</span></td>
                  <td>{formatCurrency(row.currentPrice)}</td>
                  <td>{formatCurrency(row.recentHigh)}</td>
                  <td>{Number.isFinite(Number(row.pullbackPercent)) ? `${formatNumber(row.pullbackPercent)}%` : "--"}</td>
                  <td>{formatCurrency(row.pullbackLow)}</td>
                  <td>{String(row.reversalState || "").replace(/_/g, " ") || "--"}</td>
                  <td>{formatCurrency(row.recommendedEntry)}</td>
                  <td>{Number.isFinite(Number(row.distanceFromPreferredEntry ?? row.entryDistancePercent)) ? `${formatNumber(row.distanceFromPreferredEntry ?? row.entryDistancePercent)}%` : "--"}</td>
                  <td>{formatCurrency(row.stopLoss)}</td>
                  <td>{formatCurrency(row.takeSomeProfit)}</td>
                  <td>{formatCurrency(row.finalExit)}</td>
                  <td>{formatCurrency(row.possibleLossPerShare)}</td>
                  <td>{formatCurrency(row.possibleFinalProfitPerShare)}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
              {!results.length ? <tr><td colSpan="16">NO TRADE READY. Run or restore a completed scan.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </main>
      <footer>No real trades are placed. The scanner identifies opportunities and creates alerts only.</footer>
      <Styles />
    </div>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>Market Opportunities</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span><h1>Market Opportunities</h1><p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}<button type="submit">Unlock</button>
      </form><Styles />
    </div>
  );
}

function Styles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.hero,.settings,.panel,.notice,.scanSummary,.bestOpportunity,footer{margin:0 auto;max-width:1760px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.settings,.notice,.scanSummary,.bestOpportunity,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{display:flex;gap:28px;justify-content:space-between;padding:28px}.platformSwitch{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.platformSwitch a,.hero a{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#d8e5ea;font-weight:950;padding:9px 13px;text-decoration:none}.platformSwitch a.active{background:#0057d9;border-color:#0057d9;color:#fff}h1,h2,p{margin:0}h1{font-size:52px}p,footer{color:#aebdc4}.heroStats{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));min-width:360px}.heroStats article,.settings label,.scanSummary article{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}.heroStats span,label,.scanSummary span,.bestOpportunity span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.heroStats strong,.scanSummary strong{display:block;font-size:28px;margin-top:8px}.bestOpportunity{margin-top:18px;padding:20px}.bestOpportunity h2{font-size:30px;margin-top:8px}.bestOpportunity strong{color:#b8f4e6;display:block;font-size:18px;margin-top:8px}.bestOpportunity p{margin-top:8px}.bestOpportunity div{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.bestOpportunity small{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:999px;color:#d8e5ea;font-weight:850;padding:7px 10px}.bestOpportunity a{background:#ff9900;border-radius:7px;color:#061014;display:inline-flex;font-weight:950;margin-top:14px;min-height:38px;align-items:center;padding:0 12px;text-decoration:none}.settings,.scanSummary{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px;padding:16px}label{display:grid;gap:8px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:42px;padding:8px 10px}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:42px;padding:0 14px}.notice{color:#b8f4e6;font-weight:850;margin-top:18px;padding:14px 16px}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;padding:18px 20px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1920px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:13px 14px;text-align:left;vertical-align:top}th{background:rgba(255,255,255,.04);color:#aebdc4;font-size:12px;text-transform:uppercase;white-space:nowrap}td{color:#e7eef2;font-size:13px}td a{color:#d7efff;display:block;font-weight:950;text-decoration:none}td small{color:#aebdc4;display:block;font-size:11px;font-weight:900;margin-top:4px}.status{border-radius:999px;display:inline-flex;font-size:11px;font-weight:950;padding:7px 10px;white-space:nowrap}.status.ready{background:rgba(35,209,139,.16);border:1px solid rgba(35,209,139,.38);color:#b8f4e6}.status.waitforreversal,.status.reversaldeveloping{background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.34);color:#ffe98a}.status.waitforpullback,.status.overextended{background:rgba(255,153,0,.16);border:1px solid rgba(255,153,0,.38);color:#ffd7a1}.status.skip,.status.dataunavailable{background:rgba(255,92,92,.14);border:1px solid rgba(255,92,92,.38);color:#ffc8c8}footer{font-size:13px;margin-top:20px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:1100px){.hero{flex-direction:column}.settings,.scanSummary{grid-template-columns:repeat(2,minmax(0,1fr))}.heroStats{min-width:0}}@media(max-width:720px){.page{padding:88px 16px 16px}.settings,.heroStats,.scanSummary{grid-template-columns:1fr}h1{font-size:40px}}
  `}</style>;
}

MarketOpportunities.disableLayout = true;
