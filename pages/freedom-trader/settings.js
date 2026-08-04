import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const SCANNER_SETTINGS_KEY = "freedom-trader-scanner-settings";
const V1_MARKET_SCOPE_MESSAGE = "Freedom Trader V1.0 currently analyses US markets only. ASX support is planned for the next major milestone.";

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

export default function TraderSettings({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({
    riskAmount: 1000,
    referenceCapital: 100000,
    tradingAllocationPercent: 10,
    maxRiskPercent: 1,
    defaultQuantityMode: "calculated",
    relativeVolumeThreshold: 2,
    rsiOversold: 30,
    rsiOverbought: 70,
    alertPreference: "browser",
    chartPreference: "candles-volume",
  });
  const [scannerSettings, setScannerSettings] = useState({
    markets: ["US"],
    minimumScore: 82,
    minimumDailyVolume: 1000000,
    minimumRiskReward: 2,
    maximumVolatility: 9,
    excludedIndustries: "",
    scanFrequency: "during-session",
    chunkSize: 80,
  });
  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    try {
      const stored = JSON.parse(window.localStorage.getItem(SCANNER_SETTINGS_KEY) || "null");
      if (stored && typeof stored === "object") setScannerSettings((current) => ({ ...current, ...stored, markets: ["US"], chunkSize: 80 }));
    } catch {}
    setChecking(false);
  }, []);

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
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateScannerSetting(key, value) {
    setScannerSettings((current) => {
      const next = { ...current, [key]: key === "markets" ? ["US"] : value };
      window.localStorage.setItem(SCANNER_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  const maxRisk = (settings.referenceCapital * settings.maxRiskPercent) / 100;

  return (
    <div className="page">
      <Head><title>Settings | Freedom Trader</title></Head>
      <section className="platformBanner"><strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong><span>Active Trading & Market Opportunities</span></section>
      <FreedomModuleNav module="trader" />
      <header className="hero">
        <h1>Trader Settings</h1>
        <p>Risk amount, preferred markets, scanner thresholds, alert preferences and chart preferences.</p>
      </header>
      <main className="panel">
        <h2>A. Risk Management</h2>
        <p>Maximum risk per trade: ${maxRisk.toLocaleString()} based on {settings.referenceCapital.toLocaleString()} reference capital and {settings.maxRiskPercent}% risk.</p>
        <div className="formGrid">
          <label>Risk amount per trade<input type="number" value={settings.riskAmount} onChange={(event) => updateSetting("riskAmount", Number(event.target.value))} /></label>
          <label>Reference capital<input type="number" value={settings.referenceCapital} onChange={(event) => updateSetting("referenceCapital", Number(event.target.value))} /></label>
          <label>Maximum risk per trade %<input type="number" value={settings.maxRiskPercent} onChange={(event) => updateSetting("maxRiskPercent", Number(event.target.value))} /></label>
          <label>Maximum allocation per position %<input type="number" value={settings.tradingAllocationPercent} onChange={(event) => updateSetting("tradingAllocationPercent", Number(event.target.value))} /></label>
          <label>Position-sizing method<select value={settings.defaultQuantityMode} onChange={(event) => updateSetting("defaultQuantityMode", event.target.value)}><option value="calculated">Calculated from risk</option><option value="one-share">Trade only 1 share</option><option value="two-shares">Trade only 2 shares</option></select></label>
        </div>
      </main>
      <main className="panel">
        <h2>B. Signal Settings</h2>
        <div className="formGrid">
          <label>RSI oversold level<input type="number" value={settings.rsiOversold} onChange={(event) => updateSetting("rsiOversold", Number(event.target.value))} /></label>
          <label>RSI overbought level<input type="number" value={settings.rsiOverbought} onChange={(event) => updateSetting("rsiOverbought", Number(event.target.value))} /></label>
          <label>Relative-volume threshold<input type="number" value={settings.relativeVolumeThreshold} onChange={(event) => updateSetting("relativeVolumeThreshold", Number(event.target.value))} /></label>
        </div>
      </main>
      <main className="panel">
        <h2>C. Scanner Settings</h2>
        <p>{V1_MARKET_SCOPE_MESSAGE}</p>
        <div className="formGrid">
          <label>Markets scanned<select value="US" onChange={() => updateScannerSetting("markets", ["US"])}><option value="US">Freedom Trader V1.0 US shares (NASDAQ/NYSE)</option></select></label>
          <label>Minimum score<input type="number" value={scannerSettings.minimumScore} onChange={(event) => updateScannerSetting("minimumScore", Number(event.target.value))} /></label>
          <label>Minimum daily volume<input type="number" value={scannerSettings.minimumDailyVolume} onChange={(event) => updateScannerSetting("minimumDailyVolume", Number(event.target.value))} /></label>
          <label>Minimum risk/reward<input type="number" value={scannerSettings.minimumRiskReward} onChange={(event) => updateScannerSetting("minimumRiskReward", Number(event.target.value))} /></label>
          <label>Maximum volatility<input type="number" value={scannerSettings.maximumVolatility} onChange={(event) => updateScannerSetting("maximumVolatility", Number(event.target.value))} /></label>
          <label>Excluded industries<input value={scannerSettings.excludedIndustries} onChange={(event) => updateScannerSetting("excludedIndustries", event.target.value)} placeholder="biotech, cannabis" /></label>
        </div>
        <Link className="scannerLink" href="/freedom-trader/market-opportunities">Open Scanner</Link>
      </main>
      <main className="panel">
        <h2>D. Alerts and Charts</h2>
        <div className="formGrid">
          <label>Alert preference<select value={settings.alertPreference} onChange={(event) => updateSetting("alertPreference", event.target.value)}><option value="browser">Browser notifications</option><option value="in-app">In-app only</option><option value="email-later">Email later</option></select></label>
          <label>Chart preference<select value={settings.chartPreference} onChange={(event) => updateSetting("chartPreference", event.target.value)}><option value="candles-volume">Candles with volume</option><option value="line-simple">Simple line</option><option value="compact">Compact view</option></select></label>
        </div>
      </main>
      <footer>Settings are local UI controls for now. Trades are never placed automatically.</footer>
      <PageStyles />
    </div>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>Freedom Trader Settings</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span><h1>Freedom Trader Settings</h1><p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}<button type="submit">Unlock</button>
      </form><PageStyles />
    </div>
  );
}

function PageStyles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.hero,.summary,.panel,footer{margin:0 auto;max-width:1500px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.summary article,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero,.panel{padding:28px}.hero a,.scannerLink{color:#d7efff;font-weight:900;text-decoration:none}.scannerLink{display:inline-flex;margin-top:18px}h1,h2,p{margin:0}h1{font-size:48px;margin-top:18px}p,footer{color:#aebdc4}.panel p{margin-top:8px}.summary{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px}.summary article{padding:18px}.summary span,label{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong{display:block;font-size:30px;margin-top:10px}.panel{margin-top:18px}.formGrid{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px}label{display:grid;gap:8px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:44px;padding:0 12px}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:40px;padding:0 14px}footer{font-size:13px;margin-top:20px;padding-bottom:12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:900px){.summary,.formGrid{grid-template-columns:1fr}.page{padding:88px 16px 16px}}
  `}</style>;
}

TraderSettings.disableLayout = true;
