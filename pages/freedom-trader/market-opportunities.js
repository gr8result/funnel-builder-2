import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import { traderCompanyHref } from "../../lib/freedom/companyRoutes";
import { scanActionText } from "../../lib/freedom-trader/scanSummary";

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
  chunkSize: 80,
};

const V1_MARKET_SCOPE_MESSAGE = "Freedom Trader V1.0 currently analyses US markets only. ASX support is planned for the next major milestone.";

const frequencyMs = {
  "before-open": 60 * 60 * 1000,
  "during-session": 15 * 60 * 1000,
  "after-close": 60 * 60 * 1000,
  manual: 0,
};

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatCurrency(value, currency = "USD") {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value) {
  return Number.isFinite(value) ? number.format(value) : "--";
}

function qualityLabel(value, fallback = "Unavailable") {
  const clean = String(value || "").replace(/-/g, " ").trim();
  return clean ? clean.replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback;
}

function scanOutcome(summary = null) {
  if (!summary) return { heading: "No market check yet.", body: "Run Check Market Now to analyse the supported universe." };
  const action = scanActionText(summary);
  return { heading: action.heading, body: action.body };
}

function statusClassName(status) {
  return String(status || "").replace(/\s+/g, "").toLowerCase();
}

function opportunityReadiness(row) {
  if (row?.qualified === true) return { label: "QUALIFIED", className: "qualified", note: "Ready setup" };
  const status = String(row?.status || "").toUpperCase();
  if (status.includes("WAIT")) return { label: "WAIT", className: "wait", note: "Not ready" };
  if (status.includes("WATCH") || status.includes("DEVELOP")) return { label: "DEVELOPING", className: "developing", note: "Not ready" };
  return { label: "REJECTED", className: "rejected", note: "Not ready" };
}

function summarizeReason(reason) {
  const clean = String(reason || "No reason supplied.").replace(/\s+/g, " ").trim();
  if (clean.length <= 138) return clean;
  const sentence = clean.match(/^(.{60,138}?[.!?])\s/)?.[1];
  return sentence || `${clean.slice(0, 135).trim()}...`;
}

function selectTopOpportunityCards(results) {
  const qualified = results.filter((row) => row.qualified === true).slice(0, 5);
  if (qualified.length) return qualified;
  return results.filter((row) => {
    const readiness = opportunityReadiness(row);
    return readiness.className === "developing" || readiness.className === "wait";
  }).slice(0, 5);
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
  const [reasonDialog, setReasonDialog] = useState(null);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    try {
      const stored = JSON.parse(window.localStorage.getItem(SCANNER_SETTINGS_KEY) || "null");
      if (stored && typeof stored === "object") setSettings({ ...DEFAULT_SETTINGS, ...stored, markets: ["US"], chunkSize: 80 });
    } catch {}
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked || settings.scanFrequency === "manual") return undefined;
    const interval = window.setInterval(() => runScan({ append: true }), frequencyMs[settings.scanFrequency] || frequencyMs["during-session"]);
    return () => window.clearInterval(interval);
  }, [unlocked, settings, offset]);

  const strongCount = useMemo(() => results.filter((row) => row.qualified === true).length, [results]);
  const topFive = useMemo(() => selectTopOpportunityCards(results), [results]);

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
    const next = { ...settings, [key]: key === "markets" ? ["US"] : value };
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
      setScanMessage("");
      const response = await fetch(`/api/freedom-trader/scanner?offset=${append ? offset : 0}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, markets: ["US"], chunkSize: 80, force: !append }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Market scanner is temporarily unavailable.");
      const incoming = data.decisions || [];
      setOffset(data.nextOffset || 0);
      setScanSummary(data.scanSummary || null);
      setResults((current) => {
        const bySymbol = new Map((append ? current : []).map((item) => [item.symbol, item]));
        incoming.forEach((item) => bySymbol.set(item.symbol, item));
        return Array.from(bySymbol.values()).slice(0, 100);
      });
      saveScannerWatchlist((data.results || []).filter((item) => item.status === "READY TO BUY"));
      notifyNewSetups((data.results || []).filter((item) => item.status === "READY TO BUY"));
      window.localStorage.setItem(LATEST_SCAN_KEY, JSON.stringify({ scanSummary: data.scanSummary || null, decisions: incoming, results: data.results || [], updatedAt: data.updatedAt || new Date().toISOString() }));
      setUpdatedAt(data.updatedAt || new Date().toISOString());
    } catch (err) {
      setScanMessage(err.message || "Market scanner failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <div className="boot">Opening Market Opportunities...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  const outcome = scanOutcome(scanSummary);

  return (
    <div className="page">
      <Head><title>Market Opportunities | Freedom Trader</title></Head>
      <section className="platformBanner"><strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong><span>Active Trading & Market Opportunities</span></section>
      <FreedomModuleNav module="trader" />
      <header className="hero">
        <div>
          <h1>Market Opportunities</h1>
          <p>{scanSummary?.marketScopeMessage || V1_MARKET_SCOPE_MESSAGE}</p>
        </div>
        <div className="heroStats">
          <article><span>Approved Setups</span><strong>{strongCount}</strong></article>
          <article><span>Last Scan</span><strong>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--"}</strong></article>
          <button type="button" onClick={() => runScan()} disabled={loading}>{loading ? "Checking the full US market universe..." : "Check Market Now"}</button>
        </div>
      </header>

      <section className={`plainSummary ${scanSummary ? (scanSummary.scanCompletionStatus === "complete" ? "complete" : "incomplete") : ""}`}>
        <strong>{outcome.heading}</strong>
        <p style={{ whiteSpace: "pre-line" }}>{outcome.body}</p>
      </section>

      <section className="settings">
        <label>Markets scanned
          <select value="US" onChange={() => updateSetting("markets", ["US"])}>
            <option value="US">Freedom Trader V1.0 US shares (NASDAQ/NYSE)</option>
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
          <article><span>Supported universe</span><strong>{scanSummary.universe ?? scanSummary.supportedUniverseCount}</strong></article>
          <article><span>Requested this scan</span><strong>{scanSummary.requested ?? scanSummary.symbolsRequested}</strong></article>
          <article><span>Successfully analysed</span><strong>{scanSummary.successfullyAnalysed ?? scanSummary.symbolsSuccessfullyLoaded}</strong></article>
          <article><span>Data Unavailable</span><strong>{scanSummary.dataUnavailable ?? scanSummary.symbolsRejectedMissingData}</strong></article>
          <article><span>Qualified</span><strong>{scanSummary.qualified ?? scanSummary.approvedOpportunities}</strong></article>
          <article><span>Not Qualified</span><strong>{scanSummary.notQualified ?? "--"}</strong></article>
          <article><span>Provider status</span><strong>{scanSummary.providerStatus || "--"}</strong></article>
          <article><span>Elapsed</span><strong>{Number.isFinite(Number(scanSummary.elapsedMs)) ? `${Math.round(Number(scanSummary.elapsedMs) / 1000)}s` : "--"}</strong></article>
          <div className="symbolList"><span>Last market data</span><p>{scanSummary.lastMarketDataTimestamp || "--"}</p></div>
          <div className="symbolList"><span>Market scope</span><p>{scanSummary.marketScopeMessage || V1_MARKET_SCOPE_MESSAGE}</p></div>
          <div className="symbolList"><span>Symbols scanned</span><p>{scanSummary.scannedSymbols?.join(", ") || "--"}</p></div>
          <details className="scanDetails">
            <summary>Show scan details</summary>
            <div className="symbolList"><span>Provider usage</span><p>{Object.entries(scanSummary.providerUsage || {}).map(([provider, count]) => `${provider}: ${count}`).join("; ") || "--"}</p></div>
            <div className="symbolList"><span>Rejected counts (analysed, no setup)</span><p>{Object.entries(scanSummary.rejectionCounts || {}).map(([reason, count]) => `${reason}: ${count}`).join("; ") || "No rejected symbols in this scan."}</p></div>
            <div className="symbolList"><span>Why data was unavailable</span><p>{scanSummary.dataUnavailableReasons?.length ? scanSummary.dataUnavailableReasons.join("; ") : "None in this scan."}</p></div>
            {scanSummary.disabledSymbols?.length ? <div className="symbolList"><span>Disabled symbols (not scanned)</span><p>{scanSummary.disabledSymbols.map((item) => `${item.symbol}: ${item.reason}`).join(" | ")}</p></div> : null}
            <div className="symbolList"><span>Scan timing</span><p>{scanSummary.scanStartedAt || "--"} to {scanSummary.scanCompletedAt || "--"}</p></div>
          </details>
        </section>
      ) : null}

      <main className="panel">
        <div className="panelHeader">
          <h2>Highest-quality new setups</h2>
          <span>{results.length} ranked results</span>
        </div>
        <section className="topOpportunityCards">
          {topFive.length ? topFive.map((row, index) => (
            <article key={`top-${row.symbol}`}>
              <div className="cardTopline">
                <span>#{index + 1}</span>
                <em className={`readiness ${opportunityReadiness(row).className}`}>{opportunityReadiness(row).label}</em>
              </div>
              <strong>{row.companyName}</strong>
              <p className="tickerLine">{row.symbol} - {row.status} - {opportunityReadiness(row).note}</p>
              <dl>
                <div><dt>Current Price</dt><dd>{row.analysed ? formatCurrency(row.currentPrice, row.currency) : "--"}</dd></div>
                <div><dt>Recommended Entry</dt><dd>{row.analysed ? formatCurrency(row.recommendedEntry, row.currency) : "--"}</dd></div>
                <div><dt>Safety Exit</dt><dd>{row.analysed ? formatCurrency(row.stopLoss, row.currency) : "--"}</dd></div>
                <div><dt>Take Some Profit</dt><dd>{row.analysed ? formatCurrency(row.target, row.currency) : "--"}</dd></div>
                <div><dt>Final Exit</dt><dd>{row.analysed ? formatCurrency(row.finalExit, row.currency) : "--"}</dd></div>
                <div><dt>Reward/Risk</dt><dd>{row.analysed ? formatNumber(row.riskReward) : "--"}</dd></div>
              </dl>
              <p className="cardReason">{summarizeReason(row.reason)}</p>
              <Link className="prepareTradeLink" href={traderCompanyHref(row.symbol, "from=scanner&prepare=1")}>Open Analysis</Link>
            </article>
          )) : <p className="noTopCards">No qualified opportunities from the latest trustworthy scan.</p>}
        </section>
        <div className="tableWrap" data-testid="market-opportunities-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Market</th><th>Quote</th><th>History</th><th>Analysis</th><th>Trading Score</th><th>Confidence</th><th>Current Price</th>
                <th>Recommended Entry</th><th>Safety Exit</th><th>Take Some Profit</th><th>Final Exit</th><th>Reward/Risk</th><th>Status</th><th>Reason</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.symbol}>
                  <td><Link href={traderCompanyHref(row.symbol, "from=scanner")}>{row.companyName}</Link><small>{row.symbol}</small></td>
                  <td>{row.exchange || "--"}<small>{row.currency || "USD"}</small></td>
                  <td>{qualityLabel(row.quoteStatus)}<small>{row.provider || "Twelve Data"}</small></td>
                  <td>{qualityLabel(row.historyStatus, "Unavailable")}</td>
                  <td>{row.analysed ? "Ready" : "Incomplete"}<small>{row.marketDataTimestamp || row.priceTimestamp || "--"}</small></td>
                  <td>{row.analysed ? formatNumber(row.tradingScore) : "--"}</td>
                  <td>{row.analysed ? `${formatNumber(row.confidence)}%` : "--"}</td>
                  <td>{row.analysed ? formatCurrency(row.currentPrice, row.currency) : "--"}<small>{qualityLabel(row.dataQuality)}</small></td>
                  <td>{row.analysed ? formatCurrency(row.recommendedEntry, row.currency) : "--"}</td>
                  <td>{row.analysed ? formatCurrency(row.stopLoss, row.currency) : "--"}</td>
                  <td>{row.analysed ? formatCurrency(row.target, row.currency) : "--"}</td>
                  <td>{row.analysed ? formatCurrency(row.finalExit, row.currency) : "--"}</td>
                  <td>{row.analysed ? formatNumber(row.riskReward) : "--"}</td>
                  <td><span className={`status ${statusClassName(row.status)}`}>{row.status}</span></td>
                  <td><p className="reasonPreview">{summarizeReason(row.reason)}</p><button className="reasonButton" type="button" onClick={() => setReasonDialog(row)}>View reason</button></td>
                  <td>{row.analysed ? <Link className="prepareTradeLink" href={traderCompanyHref(row.symbol, "from=scanner&prepare=1")}>Open Company</Link> : <span>Do not use</span>}</td>
                </tr>
              ))}
              {!results.length ? <tr><td colSpan="16">Run Check Market Now to analyse the supported universe.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </main>
      {reasonDialog ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReasonDialog(null);
        }}>
          <section className="reasonModal" role="dialog" aria-modal="true" aria-labelledby="reasonModalTitle">
            <div>
              <span>{reasonDialog.symbol} - {reasonDialog.status}</span>
              <h2 id="reasonModalTitle">{reasonDialog.companyName}</h2>
            </div>
            <p>{reasonDialog.reason || "No reason supplied."}</p>
            <button type="button" onClick={() => setReasonDialog(null)}>Close</button>
          </section>
        </div>
      ) : null}
      <footer>No real trades are placed. The scanner identifies opportunities; use alerts, watchlists, and the trade journal to manage broker-confirmed activity. This is a rules-based trading plan, not a guarantee of profit &mdash; confirm prices and place the order through your broker.</footer>
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{overflow-x:hidden;padding:96px max(16px,calc((100vw - min(1600px,calc(100vw - 48px)))/2)) 28px}.hero,.settings,.panel,.notice,.scanSummary,footer{margin:0 auto;max-width:1600px;width:min(1600px,calc(100vw - 48px))}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.settings,.notice,.scanSummary,.scanSummary article,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{display:flex;gap:28px;justify-content:space-between;padding:28px}.platformSwitch{display:flex;flex-wrap:wrap;gap:8px;margin:0 auto 18px;max-width:1600px;width:min(1600px,calc(100vw - 48px))}.platformSwitch a,.hero a{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#d8e5ea;font-weight:950;padding:9px 13px;text-decoration:none}.platformSwitch a.active{background:#0057d9;border-color:#0057d9;color:#fff}h1,h2,p{margin:0}h1{font-size:52px}p,footer{color:#aebdc4}.heroStats{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));min-width:360px}.heroStats article,.settings label{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}.heroStats span,label,.scanSummary span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.heroStats strong,.scanSummary strong{display:block;font-size:28px;margin-top:8px}.settings,.scanSummary{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px;padding:16px}.scanSummary .symbolList{grid-column:1/-1}.scanSummary .symbolList p{font-size:12px;line-height:1.6;max-height:76px;overflow:auto}.scanSummary article{padding:14px}.scanDetails{grid-column:1/-1}.scanDetails summary{color:#d7efff;cursor:pointer;font-size:13px;font-weight:950}.scanDetails[open]{display:grid;gap:12px}label{display:grid;gap:8px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:42px;padding:8px 10px}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:42px;padding:0 14px}.notice{color:#b8f4e6;font-weight:850;margin-top:18px;padding:14px 16px}.plainSummary{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:8px;margin-top:18px;padding:16px 18px}.plainSummary.complete{border-color:rgba(35,209,139,.4)}.plainSummary.incomplete{border-color:rgba(255,153,0,.4)}.plainSummary strong{color:#fff;display:block;font-size:16px}.plainSummary p{color:#c7d4d9;margin-top:6px}.prepareTradeLink{background:rgba(35,209,139,.16);border:1px solid rgba(35,209,139,.38);border-radius:999px;color:#b8f4e6;display:inline-block;font-size:11px;font-weight:950;padding:7px 10px;text-decoration:none;white-space:nowrap}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(255,255,255,.08);display:flex;gap:16px;justify-content:space-between;padding:18px 20px}.topOpportunityCards{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr));padding:16px}.topOpportunityCards article,.noTopCards{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:8px;display:grid;gap:10px;padding:14px}.cardTopline{align-items:center;display:flex;justify-content:space-between}.topOpportunityCards span{color:#ffcc8a;font-weight:950}.topOpportunityCards strong{font-size:17px}.tickerLine{font-size:12px;font-weight:850}.topOpportunityCards dl{display:grid;gap:6px;margin:0}.topOpportunityCards div:not(.cardTopline){align-items:baseline;display:flex;justify-content:space-between;gap:10px}.topOpportunityCards dt{color:#8fa2aa;font-size:10px;font-weight:950;text-transform:uppercase}.topOpportunityCards dd{color:#f5f7f8;font-size:12px;font-weight:950;margin:0;text-align:right}.cardReason{color:#cbd8dd;display:-webkit-box;font-size:12px;line-height:1.45;min-height:52px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3}.readiness{border-radius:999px;font-size:10px;font-style:normal;font-weight:950;padding:5px 8px;white-space:nowrap}.readiness.qualified{background:rgba(35,209,139,.18);color:#b8f4e6}.readiness.wait,.readiness.developing{background:rgba(255,153,0,.16);color:#ffd7a1}.readiness.rejected{background:rgba(255,92,92,.14);color:#ffc8c8}.tableWrap{max-width:100%;overflow-x:auto;overflow-y:visible;overscroll-behavior-x:contain}table{border-collapse:separate;border-spacing:0;min-width:1830px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);box-sizing:border-box;padding:13px 14px;text-align:left;vertical-align:top}th{background:#0b1519;color:#aebdc4;font-size:12px;text-transform:uppercase;white-space:nowrap}td{background:#081013;color:#e7eef2;font-size:13px}th:nth-child(1),td:nth-child(1){box-shadow:10px 0 18px rgba(0,0,0,.22);left:0;position:sticky;z-index:4}th:nth-child(14),td:nth-child(14){background:#081013;box-shadow:-10px 0 18px rgba(0,0,0,.16);min-width:110px;position:sticky;right:120px;width:110px;z-index:3}th:nth-child(16),td:nth-child(16){background:#081013;box-shadow:-10px 0 18px rgba(0,0,0,.22);position:sticky;right:0;z-index:4}th:nth-child(1),td:nth-child(1){min-width:110px;width:110px}th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3),th:nth-child(4),td:nth-child(4),th:nth-child(7),td:nth-child(7){min-width:90px}th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6),th:nth-child(13),td:nth-child(13){min-width:100px}th:nth-child(8),td:nth-child(8),th:nth-child(10),td:nth-child(10),th:nth-child(12),td:nth-child(12){min-width:110px}th:nth-child(9),td:nth-child(9),th:nth-child(11),td:nth-child(11){min-width:130px}th:nth-child(15),td:nth-child(15){min-width:260px;width:260px}th:nth-child(16),td:nth-child(16){min-width:120px;width:120px}td a{color:#d7efff;display:block;font-weight:950;text-decoration:none}td small{color:#aebdc4;display:block;font-size:11px;font-weight:900;margin-top:4px}.reasonPreview{color:#d7e2e6;display:-webkit-box;font-size:12px;line-height:1.45;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3}.reasonButton{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.14);color:#d7efff;font-size:11px;margin-top:9px;min-height:32px;padding:0 10px}.status{border-radius:999px;display:inline-flex;font-size:11px;font-weight:950;padding:7px 10px;white-space:nowrap}.status.buynow,.status.readytobuy{background:rgba(35,209,139,.16);border:1px solid rgba(35,209,139,.38);color:#b8f4e6}.status.waitforentry,.status.wait{background:rgba(255,153,0,.16);border:1px solid rgba(255,153,0,.38);color:#ffd7a1}.status.watch,.status.developing{background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.34);color:#ffe98a}.status.notrade,.status.rejected{background:rgba(255,92,92,.14);border:1px solid rgba(255,92,92,.38);color:#ffc8c8}.modalBackdrop{align-items:center;background:rgba(0,0,0,.68);display:flex;inset:0;justify-content:center;padding:24px;position:fixed;z-index:200}.reasonModal{background:#081013;border:1px solid rgba(94,189,255,.32);border-radius:8px;box-shadow:0 28px 80px rgba(0,0,0,.55);display:grid;gap:18px;max-width:720px;padding:24px;width:min(720px,calc(100vw - 48px))}.reasonModal span{color:#ffcc8a;font-size:12px;font-weight:950;text-transform:uppercase}.reasonModal h2{margin-top:4px}.reasonModal p{color:#d7e2e6;line-height:1.65;white-space:pre-line}.reasonModal button{justify-self:end}footer{font-size:13px;margin-top:20px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:1100px){.hero{flex-direction:column}.settings,.scanSummary{grid-template-columns:repeat(2,minmax(0,1fr))}.heroStats{min-width:0}.topOpportunityCards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.page{padding:88px 16px 16px}.hero,.settings,.panel,.notice,.scanSummary,footer,.platformSwitch{width:calc(100vw - 32px)}.settings,.scanSummary,.heroStats,.topOpportunityCards{grid-template-columns:1fr}h1{font-size:40px}.platformBanner{align-items:flex-start;flex-direction:column;gap:4px;padding:12px 16px}.panelHeader{align-items:flex-start;flex-direction:column}.reasonModal{width:calc(100vw - 32px)}}
  `}</style>;
}

MarketOpportunities.disableLayout = true;
