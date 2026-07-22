import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";
import PaperOrderTicket from "../../components/freedom-trader/PaperOrderTicket";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

function formatCurrency(value, currency = "AUD") {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)) : "--";
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "--";
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

export default function PaperPortfolio({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ticketPosition, setTicketPosition] = useState(null);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (unlocked) loadPortfolio();
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

  async function loadPortfolio() {
    setLoading(true);
    const response = await fetch("/api/freedom-trader/paper-account");
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) setSnapshot(data);
    setLoading(false);
  }

  async function monitor() {
    setLoading(true);
    await fetch("/api/freedom-trader/paper-monitor", { method: "POST" }).catch(() => null);
    await loadPortfolio();
  }

  const stats = useMemo(() => {
    const trades = snapshot?.trades || [];
    const sells = trades.filter((trade) => trade.side === "sell" && Number.isFinite(Number(trade.realised_profit_loss)));
    const wins = sells.map((trade) => Number(trade.realised_profit_loss)).filter((value) => value > 0);
    const losses = sells.map((trade) => Number(trade.realised_profit_loss)).filter((value) => value < 0);
    const grossWins = wins.reduce((total, value) => total + value, 0);
    const grossLosses = Math.abs(losses.reduce((total, value) => total + value, 0));
    return {
      winRate: sells.length ? (wins.length / sells.length) * 100 : null,
      averageWin: wins.length ? grossWins / wins.length : null,
      averageLoss: losses.length ? losses.reduce((total, value) => total + value, 0) / losses.length : null,
      profitFactor: grossLosses ? grossWins / grossLosses : null,
      largestGain: wins.length ? Math.max(...wins) : null,
      largestLoss: losses.length ? Math.min(...losses) : null,
    };
  }, [snapshot]);

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  const account = snapshot?.account;
  return (
    <div className="page">
      <Head><title>Paper Portfolio | Freedom Trader</title></Head>
      <section className="platformBanner"><strong>Freedom Trader</strong><span>PAPER TRADING - NO REAL MONEY</span></section>
      <PaperAccountBar />
      <FreedomModuleNav module="trader" paper />
      <header className="hero">
        <h1>Paper Trading Portfolio</h1>
        <p>Simulated orders only. No real brokerage account is connected.</p>
        <nav><Link href="/freedom-trader/trades">Trades</Link><Link href="/freedom-trader/settings">Paper Settings</Link><button type="button" onClick={monitor} disabled={loading}>{loading ? "Checking..." : "Check Stops, Targets & Limits"}</button></nav>
      </header>
      <section className="sectionTitle"><h2>ACCOUNT SUMMARY</h2></section>
      <section className="summary">
        <Card label="Available Cash" value={formatCurrency(account?.availableCash, account?.currency)} />
        <Card label="Current Invested Value" value={formatCurrency(account?.currentInvestedValue, account?.currency)} />
        <Card label="Total Account Value" value={formatCurrency(account?.totalAccountValue, account?.currency)} />
        <Card label="Unrealised Profit/Loss" value={formatCurrency(account?.openProfitLoss, account?.currency)} tone={Number(account?.openProfitLoss) >= 0 ? "profit" : "loss"} />
        <Card label="Realised Profit/Loss" value={formatCurrency(account?.closedProfitLoss, account?.currency)} tone={Number(account?.closedProfitLoss) >= 0 ? "profit" : "loss"} />
        <Card label="Daily P/L" value={formatCurrency(account?.dailyProfitLoss, account?.currency)} />
        <Card label="Total Return" value={formatPercent(account?.totalReturnPercent)} />
        <Card label="Starting Balance" value={formatCurrency(account?.startingBalance, account?.currency)} />
      </section>
      <section className="summary compact">
        <Card label="Win Rate" value={formatPercent(stats.winRate)} />
        <Card label="Average Win" value={formatCurrency(stats.averageWin, account?.currency)} />
        <Card label="Average Loss" value={formatCurrency(stats.averageLoss, account?.currency)} />
        <Card label="Profit Factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "--"} />
        <Card label="Largest Gain" value={formatCurrency(stats.largestGain, account?.currency)} />
        <Card label="Largest Loss" value={formatCurrency(stats.largestLoss, account?.currency)} />
      </section>
      <Table title="Open Positions" minWidth="1320px">
        <thead><tr><th>Ticker</th><th>Company</th><th>Quantity</th><th>Average Entry</th><th>Current Price</th><th>Market Value</th><th>Stop Loss</th><th>Target</th><th>Unrealised P/L</th><th>Return</th><th>Actions</th></tr></thead>
        <tbody>{snapshot?.positions?.length ? snapshot.positions.map((position) => (
          <tr key={position.id}>
            <td><Link href={`/freedom-trader/company/${position.ticker}`}>{position.ticker}</Link></td><td>{position.companyName}</td><td>{position.quantity}</td><td>{formatCurrency(position.averageEntry, position.currency)}</td><td>{formatCurrency(position.currentPrice, position.currency)}</td><td>{formatCurrency(position.marketValue, position.currency)}</td><td>{formatCurrency(position.stopLoss, position.currency)}</td><td>{formatCurrency(position.target, position.currency)}</td><td className={Number(position.unrealisedProfitLoss) >= 0 ? "profit" : "loss"}>{formatCurrency(position.unrealisedProfitLoss, position.currency)}</td><td>{formatPercent(position.returnPercent)}</td><td><button type="button" onClick={() => setTicketPosition(position)}>Sell</button></td>
          </tr>
        )) : <tr><td colSpan="11"><div className="emptyState">No open paper positions. <Link href="/freedom-trader/company/AVGO">Open AVGO</Link> or use the watchlist to create a paper trade.</div></td></tr>}</tbody>
      </Table>
      <Table title="Pending Orders" minWidth="980px">
        <thead><tr><th>Created</th><th>Ticker</th><th>Side</th><th>Type</th><th>Quantity</th><th>Requested Price</th><th>Status</th></tr></thead>
        <tbody>{snapshot?.pendingOrders?.length ? snapshot.pendingOrders.map((order) => <tr key={order.id}><td>{new Date(order.created_at).toLocaleString()}</td><td>{order.ticker}</td><td>{order.side}</td><td>{order.order_type}</td><td>{order.quantity}</td><td>{formatCurrency(order.requested_price, order.currency)}</td><td>{order.status}</td></tr>) : <tr><td colSpan="7"><div className="emptyState">No pending paper orders. Limit orders will appear here until filled or cancelled.</div></td></tr>}</tbody>
      </Table>
      <Table title="Completed Trades" minWidth="1100px">
        <thead><tr><th>Time</th><th>Ticker</th><th>Side</th><th>Quantity</th><th>Price</th><th>Brokerage</th><th>Realised P/L</th><th>Exit Reason</th></tr></thead>
        <tbody>{snapshot?.trades?.length ? snapshot.trades.slice(0, 20).map((trade) => <tr key={trade.id}><td>{new Date(trade.traded_at).toLocaleString()}</td><td>{trade.ticker}</td><td>{trade.side}</td><td>{trade.quantity}</td><td>{formatCurrency(trade.price, trade.currency)}</td><td>{formatCurrency(trade.brokerage_fee, trade.currency)}</td><td>{formatCurrency(trade.realised_profit_loss, trade.currency)}</td><td>{trade.exit_reason || "--"}</td></tr>) : <tr><td colSpan="8"><div className="emptyState">No completed paper trades yet. <Link href="/freedom-trader/company/AVGO">Create the first paper trade</Link>.</div></td></tr>}</tbody>
      </Table>
      {ticketPosition ? <PaperOrderTicket mode="sell" position={ticketPosition} onClose={() => setTicketPosition(null)} onSubmitted={loadPortfolio} /> : null}
      <PageStyles />
    </div>
  );
}

function Card({ label, value, tone = "" }) {
  return <article className={tone}><span>{label}</span><strong>{value}</strong></article>;
}

function Table({ title, minWidth, children }) {
  return <section className="panel"><div className="panelHeader"><h2>{title}</h2></div><div className="tableWrap"><table style={{ minWidth }}>{children}</table></div></section>;
}

function Gate({ password, setPassword, error, onSubmit }) {
  return <div className="gateScreen"><form className="gate" onSubmit={onSubmit}><span>Private Trading Workspace</span><h1>Freedom Trader</h1><p>Enter the private Freedom password.</p><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />{error ? <small>{error}</small> : null}<button type="submit">Unlock</button></form><PageStyles /></div>;
}

function PageStyles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0057d9;display:flex;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:40}.platformBanner strong,.platformBanner span{color:#fff;font-weight:950}.hero,.summary,.panel,.sectionTitle{margin:0 auto;max-width:1840px}.sectionTitle{margin-top:18px}.hero,.summary article,.panel,.gate{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{padding:28px}.hero a,.hero button,td a{color:#d7efff;font-weight:900;text-decoration:none}.hero nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}h1,h2,p{margin:0}h1{font-size:44px;margin-top:16px}p{color:#aebdc4}.summary{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:10px}.summary.compact{grid-template-columns:repeat(6,minmax(0,1fr))}.summary article{padding:16px}.summary span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong{display:block;font-size:22px;margin-top:9px}.profit{color:#8ff0c3!important}.loss{color:#ff9a9a!important}.panel{margin-top:18px;overflow:hidden}.panelHeader{border-bottom:1px solid rgba(179,199,207,.1);padding:16px 18px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:12px;text-align:left}th{color:#aebdc4;font-size:12px;text-transform:uppercase}.emptyState{align-items:center;color:#aebdc4;display:flex;gap:8px;min-height:48px}button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.34);border-radius:7px;color:#d7efff;cursor:pointer;font-weight:950;min-height:36px;padding:0 12px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff;font-size:12px;font-weight:950;text-transform:uppercase}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{background:#ff9900;color:#061014;height:48px;margin-top:16px;width:100%}@media(max-width:1100px){.summary,.summary.compact{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.page{padding:88px 16px 16px}.summary,.summary.compact{grid-template-columns:1fr}}
  `}</style>;
}

PaperPortfolio.disableLayout = true;
