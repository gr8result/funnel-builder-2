import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

function formatCurrency(value, currency = "AUD") {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)) : "--";
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

export default function TradesPage({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [snapshot, setSnapshot] = useState({ orders: [], trades: [] });
  const [filters, setFilters] = useState({ status: "all", ticker: "", from: "", to: "", result: "all" });

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/freedom-trader/paper-account").then((response) => response.json()).then((data) => {
      if (data?.ok) setSnapshot(data);
    }).catch(() => setSnapshot({ orders: [], trades: [] }));
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

  const rows = useMemo(() => {
    const tradeRows = (snapshot.trades || []).map((trade) => ({ kind: "trade", time: trade.traded_at, ticker: trade.ticker, status: "closed", result: Number(trade.realised_profit_loss), data: trade }));
    const orderRows = (snapshot.orders || []).map((order) => ({ kind: "order", time: order.created_at, ticker: order.ticker, status: order.status, result: null, data: order }));
    return [...tradeRows, ...orderRows]
      .filter((row) => filters.status === "all" || row.status === filters.status)
      .filter((row) => !filters.ticker || row.ticker.includes(filters.ticker.trim().toUpperCase()))
      .filter((row) => !filters.from || String(row.time).slice(0, 10) >= filters.from)
      .filter((row) => !filters.to || String(row.time).slice(0, 10) <= filters.to)
      .filter((row) => filters.result === "all" || (filters.result === "profitable" ? Number(row.result) > 0 : Number(row.result) < 0))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [filters, snapshot]);

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Paper Trades | Freedom Trader</title></Head>
      <section className="platformBanner"><strong>Freedom Trader</strong><span>PAPER TRADING - NO REAL MONEY</span></section>
      <PaperAccountBar />
      <FreedomModuleNav module="trader" paper />
      <header className="hero"><h1>Paper Trade History</h1><p>Audit trail for simulated orders and trades.</p></header>
      <section className="filters">
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option><option value="filled">Filled</option></select>
        <input placeholder="Ticker" value={filters.ticker} onChange={(event) => setFilters((current) => ({ ...current, ticker: event.target.value }))} />
        <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
        <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
        <select value={filters.result} onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value }))}><option value="all">All results</option><option value="profitable">Profitable trades</option><option value="losing">Losing trades</option></select>
      </section>
      <section className="panel"><div className="tableWrap"><table><thead><tr><th>Time</th><th>Type</th><th>Ticker</th><th>Side</th><th>Order Type</th><th>Quantity</th><th>Requested</th><th>Filled/Trade Price</th><th>Status</th><th>Realised P/L</th><th>Exit Reason</th><th>Price Source</th></tr></thead><tbody>{rows.length ? rows.map((row) => {
        const item = row.data;
        return <tr key={`${row.kind}-${item.id}`}><td>{new Date(row.time).toLocaleString()}</td><td>{row.kind}</td><td><Link href={`/freedom-trader/company/${row.ticker}`}>{row.ticker}</Link></td><td>{item.side}</td><td>{item.order_type || "--"}</td><td>{item.quantity}</td><td>{formatCurrency(item.requested_price, item.currency)}</td><td>{formatCurrency(item.filled_price ?? item.price, item.currency)}</td><td>{item.status || "closed"}</td><td>{formatCurrency(item.realised_profit_loss, item.currency)}</td><td>{item.exit_reason || "--"}</td><td>{item.price_provider || item.price_source || "--"}</td></tr>;
      }) : <tr><td colSpan="12"><div className="emptyState">No matching paper trade records. <Link href="/freedom-trader/company/AVGO">Open a company page</Link> to submit a paper order.</div></td></tr>}</tbody></table></div></section>
      <PageStyles />
    </div>
  );
}

function Gate({ password, setPassword, error, onSubmit }) {
  return <div className="gateScreen"><form className="gate" onSubmit={onSubmit}><span>Private Trading Workspace</span><h1>Freedom Trader Trades</h1><p>Enter the private Freedom password.</p><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />{error ? <small>{error}</small> : null}<button type="submit">Unlock</button></form><PageStyles /></div>;
}

function PageStyles() {
  return <style jsx global>{`.boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;display:flex;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:40}.platformBanner strong,.platformBanner span{color:#fff;font-weight:950}.hero,.filters,.panel{margin:0 auto;max-width:1840px}.hero,.filters,.panel,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{padding:28px}.hero a,td a{color:#d7efff;font-weight:900;text-decoration:none}h1,p{margin:0}h1{font-size:44px;margin-top:16px}p{color:#aebdc4}.filters{display:grid;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr));margin-top:18px;padding:16px}input,select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;min-height:38px;padding:8px}.panel{margin-top:18px;overflow:hidden}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1500px;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:12px;text-align:left}th{color:#aebdc4;font-size:12px;text-transform:uppercase}.emptyState{align-items:center;color:#aebdc4;display:flex;gap:8px;min-height:48px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff;font-size:12px;font-weight:950;text-transform:uppercase}.gate input{height:48px;margin-top:22px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;border:0;border-radius:7px;color:#061014;font-weight:950;height:48px;margin-top:16px;width:100%}@media(max-width:900px){.filters{grid-template-columns:1fr}.page{padding:88px 16px 16px}}`}</style>;
}

TradesPage.disableLayout = true;
