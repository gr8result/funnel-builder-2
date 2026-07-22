import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const ALERT_TYPES = ["ENTRY REACHED", "TARGET REACHED", "STOP REACHED", "BREAKOUT", "BREAKDOWN", "RSI OVERSOLD", "RSI OVERBOUGHT", "VOLUME SPIKE", "SETUP EXPIRED"];

function formatCurrency(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(number) : "--";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number > 0 ? "+" : ""}${number.toFixed(2)}%` : "--";
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

export default function TraderAlerts({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (unlocked) loadAlerts();
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

  async function loadAlerts() {
    try {
      setLoading(true);
      const response = await fetch("/api/freedom-trader/alerts");
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to load alerts.");
      setAlerts(data.alerts || []);
      setDatabaseUnavailable(Boolean(data.databaseUnavailable));
    } catch (error) {
      console.error("Freedom Trader alerts page load failed:", error);
      setAlerts([]);
      setDatabaseUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  async function updateAlert(id, action) {
    try {
      const response = await fetch("/api/freedom-trader/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to update alert.");
      setMessage(action === "acknowledge" ? "Alert acknowledged." : "Alert disabled.");
      await loadAlerts();
    } catch (error) {
      console.error("Freedom Trader alert update UI failed:", error);
      setMessage(error.message || "Unable to update alert.");
    }
  }

  async function deleteAlert(id) {
    if (!window.confirm("Delete this alert?")) return;
    try {
      const response = await fetch(`/api/freedom-trader/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to delete alert.");
      setMessage("Alert deleted.");
      await loadAlerts();
    } catch (error) {
      console.error("Freedom Trader alert delete UI failed:", error);
      setMessage(error.message || "Unable to delete alert.");
    }
  }

  async function checkAlerts() {
    try {
      setLoading(true);
      const response = await fetch("/api/freedom-trader/check-alerts", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to check alerts.");
      setMessage(`Checked ${data.checked} alerts. Triggered ${data.triggered?.length || 0}.`);
      await loadAlerts();
    } catch (error) {
      console.error("Freedom Trader check alerts UI failed:", error);
      setMessage(error.message || "Unable to check alerts.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => ({
    active: alerts.filter((alert) => alert.status === "active").length,
    triggered: alerts.filter((alert) => alert.status === "triggered").length,
    acknowledged: alerts.filter((alert) => alert.status === "acknowledged").length,
  }), [alerts]);

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Alerts | Freedom Trader</title></Head>
      <section className="platformBanner"><strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong><span>Active Trading & Market Opportunities</span></section>
      <PaperAccountBar />
      <FreedomModuleNav module="trader" paper />
      <header className="hero">
        <h1>Trade Alerts</h1>
        <p>Trader-only alerts. Alerts do not execute trades automatically.</p>
      </header>

      {databaseUnavailable ? <section className="notice">Alerts database temporarily unavailable. The page remains available.</section> : null}
      {message ? <section className="notice">{message}</section> : null}

      <section className="summary">
        <article className="active"><span>Active Alerts</span><strong>{totals.active}</strong></article>
        <article className="triggered"><span>Triggered Alerts</span><strong>{totals.triggered}</strong></article>
        <article className="acknowledged"><span>Acknowledged Alerts</span><strong>{totals.acknowledged}</strong></article>
      </section>

      <section className="cards">
        {ALERT_TYPES.map((type) => <article key={type}>{type}</article>)}
      </section>

      <main className="panel">
        <div className="panelHeader">
          <h2>Alert Rules</h2>
          <div className="headerActions"><button type="button" onClick={checkAlerts} disabled={loading}>{loading ? "Checking..." : "Check Alerts"}</button><button type="button" onClick={loadAlerts}>Refresh</button></div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Ticker</th><th>Alert Type</th><th>Trigger Price</th><th>Current Price</th><th>Distance</th><th>Priority</th><th>Status</th><th>Created</th><th>Triggered</th><th>Action</th></tr>
            </thead>
            <tbody>
              {alerts.length ? alerts.map((alert) => (
                <tr className={alert.status} key={alert.id}>
                  <td>{alert.symbol}</td>
                  <td>{alert.alertType}</td>
                  <td>{formatCurrency(alert.triggerPrice)}</td>
                  <td>{formatCurrency(alert.currentPrice)}</td>
                  <td>{formatPercent(alert.distance)}</td>
                  <td>{alert.priority}</td>
                  <td>{alert.status}</td>
                  <td>{alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : "--"}</td>
                  <td>{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : "--"}</td>
                  <td><div className="actions"><button onClick={() => updateAlert(alert.id, "acknowledge")} type="button">Acknowledge</button><button onClick={() => updateAlert(alert.id, "disable")} type="button">Disable</button><button onClick={() => deleteAlert(alert.id)} type="button">Delete</button><Link href={`/freedom-trader/company/${alert.symbol}`}>Open Company</Link></div></td>
                </tr>
              )) : <tr><td colSpan="10">No alerts saved yet.</td></tr>}
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
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.hero,.cards,.summary,.panel,footer,.notice{margin:0 auto;max-width:1760px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.cards article,.summary article,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{padding:28px}.hero a{color:#d7efff;font-weight:900;text-decoration:none}h1,h2,p{margin:0}h1{font-size:48px;margin-top:18px}p,footer{color:#aebdc4}.notice{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.24);border-radius:8px;color:#d7efff;font-weight:850;margin-top:18px;padding:14px 16px}.summary{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:18px}.summary article{padding:18px}.summary span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong{display:block;font-size:32px;margin-top:10px}.cards{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:18px}.cards article{color:#d7efff;font-weight:900;padding:16px}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;justify-content:space-between;padding:18px 20px}.headerActions,.actions{display:flex;flex-wrap:wrap;gap:8px}button,.actions a{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:36px;padding:9px 12px;text-decoration:none}.actions button,.actions a{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);color:#d7efff}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1500px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:13px;text-align:left;vertical-align:middle}th{color:#aebdc4;font-size:12px;text-transform:uppercase}td{color:#e7eef2}tr.active td{box-shadow:inset 0 0 0 9999px rgba(29,155,255,.035)}tr.triggered td{box-shadow:inset 0 0 0 9999px rgba(255,153,0,.08)}tr.acknowledged td{opacity:.72}footer{font-size:13px;margin-top:20px;padding-bottom:12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff;font-size:12px;font-weight:950;text-transform:uppercase}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:24px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:900px){.cards,.summary{grid-template-columns:1fr}.page{padding:88px 16px 16px}}
  `}</style>;
}

TraderAlerts.disableLayout = true;
