import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

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
    totalInvestmentCapital: 100000,
    tradingAllocationPercent: 10,
    maxRiskPercent: 1,
    defaultQuantityMode: "calculated",
    relativeVolumeThreshold: 2,
    rsiOversold: 30,
    rsiOverbought: 70,
  });

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
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

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  const tradingCapital = (settings.totalInvestmentCapital * settings.tradingAllocationPercent) / 100;
  const maxRisk = (settings.totalInvestmentCapital * settings.maxRiskPercent) / 100;

  return (
    <div className="page">
      <Head><title>Settings | Freedom Trader</title></Head>
      <header className="hero">
        <Link href="/freedom-trader">Back to Freedom Trader</Link>
        <h1>Trader Settings</h1>
        <p>Separate trading capital, risk rules, alert thresholds and sizing preferences.</p>
      </header>
      <section className="summary">
        <article><span>Trading Capital</span><strong>${tradingCapital.toLocaleString()}</strong></article>
        <article><span>Max Risk / Trade</span><strong>${maxRisk.toLocaleString()}</strong></article>
        <article><span>Allocation</span><strong>{settings.tradingAllocationPercent}%</strong></article>
        <article><span>Risk Rule</span><strong>{settings.maxRiskPercent}%</strong></article>
      </section>
      <main className="panel">
        <h2>Risk Configuration</h2>
        <div className="formGrid">
          <label>Total investment capital<input type="number" value={settings.totalInvestmentCapital} onChange={(event) => updateSetting("totalInvestmentCapital", Number(event.target.value))} /></label>
          <label>Trading allocation %<input type="number" value={settings.tradingAllocationPercent} onChange={(event) => updateSetting("tradingAllocationPercent", Number(event.target.value))} /></label>
          <label>Max risk per trade %<input type="number" value={settings.maxRiskPercent} onChange={(event) => updateSetting("maxRiskPercent", Number(event.target.value))} /></label>
          <label>Position sizing<select value={settings.defaultQuantityMode} onChange={(event) => updateSetting("defaultQuantityMode", event.target.value)}><option value="calculated">Calculated from risk</option><option value="one-share">Trade only 1 share</option><option value="two-shares">Trade only 2 shares</option></select></label>
          <label>Relative volume threshold<input type="number" value={settings.relativeVolumeThreshold} onChange={(event) => updateSetting("relativeVolumeThreshold", Number(event.target.value))} /></label>
          <label>RSI oversold level<input type="number" value={settings.rsiOversold} onChange={(event) => updateSetting("rsiOversold", Number(event.target.value))} /></label>
          <label>RSI overbought level<input type="number" value={settings.rsiOverbought} onChange={(event) => updateSetting("rsiOverbought", Number(event.target.value))} /></label>
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
    .boot,.page,.gateScreen{background:radial-gradient(circle at 12% 0%,rgba(255,153,0,.2),transparent 34rem),radial-gradient(circle at 86% 8%,rgba(29,155,255,.14),transparent 30rem),#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:28px}.hero,.summary,.panel,footer{margin:0 auto;max-width:1500px}.hero,.panel,.summary article,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(179,199,207,.13);border-radius:8px}.hero,.panel{padding:28px}.hero a{color:#d7efff;font-weight:900;text-decoration:none}h1,h2,p{margin:0}h1{font-size:48px;margin-top:18px}p,footer{color:#aebdc4}.summary{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px}.summary article{padding:18px}.summary span,label{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong{display:block;font-size:30px;margin-top:10px}.panel{margin-top:18px}.formGrid{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px}label{display:grid;gap:8px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:44px;padding:0 12px}button{background:linear-gradient(135deg,#ff9900,#1d9bff);border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:40px;padding:0 14px}footer{font-size:13px;margin-top:20px;padding-bottom:12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:900px){.summary,.formGrid{grid-template-columns:1fr}.page{padding:16px}}
  `}</style>;
}

TraderSettings.disableLayout = true;
