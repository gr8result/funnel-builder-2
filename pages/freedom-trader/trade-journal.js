import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const EMPTY_FORM = {
  broker: "",
  ticker: "",
  company: "",
  exchange: "",
  currency: "USD",
  side: "buy",
  tradeDateTime: "",
  quantity: "",
  actualFillPrice: "",
  brokerageFees: "0",
  stopLoss: "",
  target: "",
  status: "open",
  closingPrice: "",
  closingDate: "",
  exitReason: "",
  notes: "",
  documentReference: "",
};

function money(value, currency = "USD") {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)) : "--";
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

export default function TradeJournal({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, tradeDateTime: new Date().toISOString().slice(0, 16) });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (unlocked) loadTrades();
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

  async function loadTrades() {
    const response = await fetch("/api/freedom-trader/trade-journal");
    const data = await response.json().catch(() => null);
    setTrades(Array.isArray(data?.trades) ? data.trades : []);
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveTrade(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/freedom-trader/trade-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      setMessage(data?.error || "Unable to save trade.");
      return;
    }
    setMessage("Broker trade recorded.");
    setForm({ ...EMPTY_FORM, tradeDateTime: new Date().toISOString().slice(0, 16) });
    await loadTrades();
  }

  async function closeTrade(trade) {
    const closingPrice = window.prompt(`Closing price for ${trade.ticker}`, trade.closingPrice || trade.actualFillPrice || "");
    if (!closingPrice) return;
    const exitReason = window.prompt("Exit reason", trade.exitReason || "Manual close") || "";
    await fetch("/api/freedom-trader/trade-journal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: trade.id, status: "closed", closingPrice: Number(closingPrice), closingDate: new Date().toISOString(), exitReason }),
    });
    await loadTrades();
  }

  const totals = useMemo(() => ({
    open: trades.filter((trade) => trade.status === "open").length,
    closed: trades.filter((trade) => trade.status === "closed").length,
    realised: trades.reduce((total, trade) => total + (Number(trade.realisedProfitLoss) || 0), 0),
    fees: trades.reduce((total, trade) => total + (Number(trade.totalFees) || 0), 0),
  }), [trades]);

  if (checking) return <div className="boot">Opening Trade Journal...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Trade Journal | Freedom Trader</title></Head>
      <section className="platformBanner"><strong>TRADE JOURNAL</strong><span>Manually Recorded Broker Trades</span></section>
      <FreedomModuleNav module="trader" />
      <header className="hero">
        <h1>Trade Journal</h1>
        <p>Record trades actually placed through your external regulated broker. Creating a plan never means an order was filled.</p>
      </header>
      {message ? <section className="notice">{message}</section> : null}
      <section className="summary">
        <article><span>Open Trades</span><strong>{totals.open}</strong></article>
        <article><span>Closed Trades</span><strong>{totals.closed}</strong></article>
        <article><span>Realised P/L</span><strong>{money(totals.realised)}</strong></article>
        <article><span>Total Fees</span><strong>{money(totals.fees)}</strong></article>
      </section>
      <form className="panel formGrid" onSubmit={saveTrade}>
        <h2>Record Broker Trade</h2>
        {[
          ["broker", "Broker"], ["ticker", "Ticker"], ["company", "Company"], ["exchange", "Exchange"], ["currency", "Currency"],
          ["tradeDateTime", "Trade date and time", "datetime-local"], ["quantity", "Quantity", "number"], ["actualFillPrice", "Actual fill price", "number"],
          ["brokerageFees", "Brokerage and fees", "number"], ["stopLoss", "Stop loss", "number"], ["target", "Target", "number"],
          ["closingPrice", "Closing price", "number"], ["closingDate", "Closing date", "datetime-local"], ["exitReason", "Exit reason"],
          ["documentReference", "Screenshot or document reference"],
        ].map(([key, label, type = "text"]) => (
          <label key={key}>{label}<input type={type} value={form[key]} onChange={(event) => updateForm(key, event.target.value)} /></label>
        ))}
        <label>Buy or sell<select value={form.side} onChange={(event) => updateForm("side", event.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
        <label>Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)}><option value="open">Open</option><option value="closed">Closed</option></select></label>
        <label className="wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
        <button type="submit">Record Broker Trade</button>
      </form>
      <main className="panel">
        <div className="panelHeader"><h2>Journal Entries</h2><button type="button" onClick={loadTrades}>Refresh</button></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Broker</th><th>Ticker</th><th>Side</th><th>Status</th><th>Qty</th><th>Fill</th><th>Entry Value</th><th>Exit Value</th><th>Realised P/L</th><th>Unrealised P/L</th><th>Return</th><th>Fees</th><th>Risk/Reward</th><th>Action</th></tr></thead>
            <tbody>{trades.length ? trades.map((trade) => (
              <tr key={trade.id}>
                <td>{trade.broker || "--"}</td><td>{trade.ticker}<small>{trade.company}</small></td><td>{trade.side}</td><td>{trade.status}</td><td>{trade.quantity}</td>
                <td>{money(trade.actualFillPrice, trade.currency)}</td><td>{money(trade.totalEntryValue, trade.currency)}</td><td>{money(trade.totalExitValue, trade.currency)}</td>
                <td>{money(trade.realisedProfitLoss, trade.currency)}</td><td>{money(trade.unrealisedProfitLoss, trade.currency)}</td><td>{Number.isFinite(trade.returnPercent) ? `${trade.returnPercent}%` : "--"}</td>
                <td>{money(trade.totalFees, trade.currency)}</td><td>{Number.isFinite(trade.riskRewardAchieved) ? trade.riskRewardAchieved.toFixed(2) : "--"}</td>
                <td>{trade.status === "open" ? <button type="button" onClick={() => closeTrade(trade)}>Close</button> : trade.exitReason || "--"}</td>
              </tr>
            )) : <tr><td colSpan="14">No broker trades recorded yet.</td></tr>}</tbody>
          </table>
        </div>
      </main>
      <Styles />
    </div>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen"><Head><title>Trade Journal</title></Head><form className="gate" onSubmit={onSubmit}><span>Private Trading Workspace</span><h1>Trade Journal</h1><p>Enter the private Freedom password.</p><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />{error ? <small>{error}</small> : null}<button type="submit">Unlock</button></form><Styles /></div>
  );
}

function Styles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{color:#fff;font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{color:#fff;font-weight:900}.hero,.panel,.notice,.summary,.gate{margin:0 auto 18px;max-width:1760px}.hero,.panel,.summary article,.notice,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero,.panel,.notice{padding:24px}h1,h2,p{margin:0}h1{font-size:48px}p{color:#aebdc4}.summary{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr))}.summary article{padding:16px}.summary span,label{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong{display:block;font-size:26px;margin-top:8px}.formGrid{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}.formGrid h2,.formGrid .wide{grid-column:1/-1}label{display:grid;gap:7px}input,select,textarea{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:40px;padding:8px 10px}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:40px;padding:0 12px}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;justify-content:space-between;margin:-24px -24px 16px;padding:16px 18px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1500px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:12px;text-align:left}th{color:#aebdc4;font-size:12px;text-transform:uppercase}td small{color:#aebdc4;display:block}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff}.gate input{height:48px;margin-top:22px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:16px;width:100%}@media(max-width:1000px){.summary,.formGrid{grid-template-columns:1fr}.page{padding:88px 16px 16px}}
  `}</style>;
}

TradeJournal.disableLayout = true;
