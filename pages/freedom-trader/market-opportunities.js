import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const SCANNER_SETTINGS_KEY = "freedom-trader-scanner-settings";
const SCANNER_WATCHLIST_KEY = "freedom-trader-scanner-watchlist";

const DEFAULT_SETTINGS = {
  markets: ["US"],
  minimumScore: 82,
  minimumDailyVolume: 1000000,
  minimumRiskReward: 2,
  maximumVolatility: 9,
  excludedIndustries: "",
  scanFrequency: "during-session",
  chunkSize: 30,
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
  return Number.isFinite(value) ? money.format(value) : "--";
}

function formatNumber(value) {
  return Number.isFinite(value) ? number.format(value) : "--";
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
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    try {
      const stored = JSON.parse(window.localStorage.getItem(SCANNER_SETTINGS_KEY) || "null");
      if (stored && typeof stored === "object") setSettings({ ...DEFAULT_SETTINGS, ...stored });
    } catch {}
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked || settings.scanFrequency === "manual") return undefined;
    const interval = window.setInterval(() => runScan({ append: true }), frequencyMs[settings.scanFrequency] || frequencyMs["during-session"]);
    return () => window.clearInterval(interval);
  }, [unlocked, settings, offset]);

  const strongCount = useMemo(() => results.filter((row) => row.tradingScore >= settings.minimumScore).length, [results, settings.minimumScore]);

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
      setScanMessage("");
      const response = await fetch(`/api/freedom-trader/scanner?offset=${append ? offset : 0}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Market scanner is temporarily unavailable.");
      const incoming = data.results || [];
      setOffset(data.nextOffset || 0);
      setResults((current) => {
        const bySymbol = new Map((append ? current : []).map((item) => [item.symbol, item]));
        incoming.forEach((item) => bySymbol.set(item.symbol, item));
        return Array.from(bySymbol.values()).sort((a, b) => b.tradingScore - a.tradingScore).slice(0, 100);
      });
      saveScannerWatchlist(incoming);
      notifyNewSetups(incoming);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      if (!incoming.length) setScanMessage(`Scanned ${data.scannedCount} of ${data.universeCount} supported symbols. No approved setup in this chunk.`);
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
          <article><span>Approved Setups</span><strong>{strongCount}</strong></article>
          <article><span>Last Scan</span><strong>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--"}</strong></article>
          <button type="button" onClick={() => runScan()} disabled={loading}>{loading ? "Scanning..." : "Run Scan Now"}</button>
        </div>
      </header>

      <section className="settings">
        <label>Markets scanned
          <select multiple value={settings.markets} onChange={(event) => updateSetting("markets", Array.from(event.target.selectedOptions).map((option) => option.value))}>
            <option value="US">S&P 500 / Nasdaq supported US shares</option>
            <option value="ASX">ASX 200 supported Australian shares</option>
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

      <main className="panel">
        <div className="panelHeader">
          <h2>Highest-quality new setups</h2>
          <span>{results.length} ranked results</span>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Trading Score</th><th>Confidence</th><th>Current Price</th>
                <th>Recommended Entry</th><th>Stop Loss</th><th>Target</th><th>Risk/Reward</th><th>Trade Type</th><th>Status</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.symbol}>
                  <td><Link href={`/freedom/company/${row.symbol}?from=scanner`}>{row.companyName}</Link><small>{row.symbol}</small></td>
                  <td>{formatNumber(row.tradingScore)}</td>
                  <td>{formatNumber(row.confidence)}%</td>
                  <td>{formatCurrency(row.currentPrice)}</td>
                  <td>{formatCurrency(row.recommendedEntry)}</td>
                  <td>{formatCurrency(row.stopLoss)}</td>
                  <td>{formatCurrency(row.target)}</td>
                  <td>{formatNumber(row.riskReward)}</td>
                  <td>{row.setupType}</td>
                  <td><span className={`status ${String(row.status).replace(/\s+/g, "").toLowerCase()}`}>{row.status}</span></td>
                  <td>{row.reason}</td>
                </tr>
              ))}
              {!results.length ? <tr><td colSpan="11">Run the scanner to find approved opportunities.</td></tr> : null}
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.hero,.settings,.panel,.notice,footer{margin:0 auto;max-width:1760px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.settings,.notice,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{display:flex;gap:28px;justify-content:space-between;padding:28px}.platformSwitch{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.platformSwitch a,.hero a{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#d8e5ea;font-weight:950;padding:9px 13px;text-decoration:none}.platformSwitch a.active{background:#0057d9;border-color:#0057d9;color:#fff}h1,h2,p{margin:0}h1{font-size:52px}p,footer{color:#aebdc4}.heroStats{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));min-width:360px}.heroStats article,.settings label{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}.heroStats span,label{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.heroStats strong{display:block;font-size:28px;margin-top:8px}.settings{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px;padding:16px}label{display:grid;gap:8px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:42px;padding:8px 10px}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:42px;padding:0 14px}.notice{color:#b8f4e6;font-weight:850;margin-top:18px;padding:14px 16px}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;padding:18px 20px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1540px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:13px 14px;text-align:left;vertical-align:top}th{background:rgba(255,255,255,.04);color:#aebdc4;font-size:12px;text-transform:uppercase;white-space:nowrap}td{color:#e7eef2;font-size:13px}td a{color:#d7efff;display:block;font-weight:950;text-decoration:none}td small{color:#aebdc4;display:block;font-size:11px;font-weight:900;margin-top:4px}.status{border-radius:999px;display:inline-flex;font-size:11px;font-weight:950;padding:7px 10px;white-space:nowrap}.status.buynow{background:rgba(35,209,139,.16);border:1px solid rgba(35,209,139,.38);color:#b8f4e6}.status.waitforentry{background:rgba(255,153,0,.16);border:1px solid rgba(255,153,0,.38);color:#ffd7a1}.status.watch{background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.34);color:#ffe98a}.status.notrade{background:rgba(255,92,92,.14);border:1px solid rgba(255,92,92,.38);color:#ffc8c8}footer{font-size:13px;margin-top:20px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:1100px){.hero{flex-direction:column}.settings{grid-template-columns:repeat(2,minmax(0,1fr))}.heroStats{min-width:0}}@media(max-width:720px){.page{padding:88px 16px 16px}.settings,.heroStats{grid-template-columns:1fr}h1{font-size:40px}}
  `}</style>;
}

MarketOpportunities.disableLayout = true;
