import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const ALERT_TYPES = ["ENTRY REACHED", "TARGET REACHED", "STOP REACHED", "BREAKOUT", "BREAKDOWN", "VOLUME SPIKE", "RSI OVERSOLD", "RSI OVERBOUGHT", "SETUP EXPIRED"];

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

export default function TraderAlerts({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState([
    { symbol: "NVDA", alertType: "ENTRY REACHED", triggerPrice: "", priority: "high", status: "active", message: "Notify when NVDA reaches the planned swing entry. Review setup before acting." },
    { symbol: "TSLA", alertType: "VOLUME SPIKE", triggerPrice: "", priority: "medium", status: "active", message: "Relative volume exceeds configured threshold. Check for confirmed breakout or reversal." },
  ]);

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

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Alerts | Freedom Trader</title></Head>
      <header className="hero">
        <Link href="/freedom-trader">Back to Freedom Trader</Link>
        <h1>Trade Alerts</h1>
        <p>Trader-only alerts for planned entries, targets, stops, breakouts, volume and RSI events.</p>
      </header>
      <section className="cards">
        {ALERT_TYPES.map((type) => <article key={type}>{type}</article>)}
      </section>
      <main className="panel">
        <div className="panelHeader">
          <h2>Active Alert Rules</h2>
          <button type="button" onClick={() => setAlerts((current) => [...current, { symbol: "NVDA", alertType: "ENTRY REACHED", triggerPrice: "", priority: "medium", status: "active", message: "Review the planned setup. Do not execute automatically." }])}>Create Alert</button>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Symbol</th><th>Alert Type</th><th>Trigger Price</th><th>Priority</th><th>Status</th><th>Explanation</th><th>Review Action</th></tr></thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={`${alert.symbol}-${alert.alertType}-${index}`}>
                  <td>{alert.symbol}</td><td>{alert.alertType}</td><td>{alert.triggerPrice || "--"}</td><td>{alert.priority}</td><td>{alert.status}</td><td>{alert.message}</td><td>Review price, setup status and risk before acting.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <footer>Alerts explain what happened and recommend review. They do not claim certainty or place trades.</footer>
      <PageStyles />
    </div>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>Freedom Trader Alerts</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span><h1>Freedom Trader Alerts</h1><p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}<button type="submit">Unlock</button>
      </form><PageStyles />
    </div>
  );
}

function PageStyles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:radial-gradient(circle at 12% 0%,rgba(255,153,0,.2),transparent 34rem),radial-gradient(circle at 86% 8%,rgba(29,155,255,.14),transparent 30rem),#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:28px}.hero,.cards,.panel,footer{margin:0 auto;max-width:1760px}.hero,.panel,.cards article,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(179,199,207,.13);border-radius:8px}.hero{padding:28px}.hero a{color:#d7efff;font-weight:900;text-decoration:none}h1,h2,p{margin:0}h1{font-size:48px;margin-top:18px}p,footer{color:#aebdc4}.cards{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:18px}.cards article{color:#d7efff;font-weight:900;padding:16px}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;justify-content:space-between;padding:18px 20px}button{background:linear-gradient(135deg,#ff9900,#1d9bff);border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:40px;padding:0 14px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1200px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:14px;text-align:left;vertical-align:top}th{color:#aebdc4;font-size:12px;text-transform:uppercase}td{color:#e7eef2}footer{font-size:13px;margin-top:20px;padding-bottom:12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff;font-size:12px;font-weight:950;text-transform:uppercase}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:24px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:900px){.cards{grid-template-columns:1fr}.page{padding:16px}}
  `}</style>;
}

TraderAlerts.disableLayout = true;
