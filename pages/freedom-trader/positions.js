import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";
import PaperAccountBar from "../../components/freedom-trader/PaperAccountBar";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function formatCurrency(value) {
  return Number.isFinite(value) ? money.format(value) : "--";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "--";
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

export default function TraderPositions({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [positions, setPositions] = useState([]);
  const [pendingSetups, setPendingSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  useEffect(() => {
    if (unlocked) loadPositions();
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return undefined;
    const interval = window.setInterval(loadPositions, 60_000);
    return () => window.clearInterval(interval);
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

  async function loadPositions() {
    try {
      setLoading(true);
      const response = await fetch("/api/freedom-trader/positions");
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to load positions.");
      setPositions(data.positions || []);
      setDatabaseUnavailable(Boolean(data.databaseUnavailable));
    } catch (error) {
      console.error("Freedom Trader positions page load failed:", error);
      setPositions([]);
      setDatabaseUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  function openModal(type, position) {
    setMessage("");
    setActiveModal({ type, position });
    setForm({
      targetPrice: position?.targetPrice || "",
      stopPrice: position?.stopPrice || "",
      notes: position?.notes || "",
      exitPrice: position?.currentPrice || "",
      sharesSold: position?.quantity || "",
      exitDate: new Date().toISOString().slice(0, 16),
      brokerageSell: 0,
    });
  }

  async function saveUpdate() {
    if (!activeModal?.position) return;
    const position = activeModal.position;
    if (activeModal.type === "raise-stop" && Number(form.stopPrice) < Number(position.stopPrice)) {
      const confirmed = window.confirm("This lowers the stop. Confirm you deliberately want to increase risk.");
      if (!confirmed) return;
    }
    const payload = { id: position.id, action: activeModal.type, notes: form.notes };
    if (activeModal.type === "edit-target") payload.targetPrice = Number(form.targetPrice);
    if (activeModal.type === "raise-stop") payload.stopPrice = Number(form.stopPrice);
    if (activeModal.type === "close") {
      payload.exitPrice = Number(form.exitPrice);
      payload.sharesSold = Number(form.sharesSold);
      payload.exitDate = form.exitDate;
      payload.brokerageSell = Number(form.brokerageSell || 0);
    }
    try {
      const response = await fetch("/api/freedom-trader/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to update position.");
      setMessage(activeModal.type === "close" ? "Position closed." : "Position updated.");
      setActiveModal(null);
      await loadPositions();
    } catch (error) {
      console.error("Freedom Trader position update UI failed:", error);
      setMessage(error.message || "Unable to update position.");
    }
  }

  const totals = useMemo(() => {
    const open = positions.filter((position) => position.status === "open");
    const closed = positions.filter((position) => position.status === "closed");
    const winning = closed.filter((position) => Number(position.netProfit ?? position.realisedProfit) > 0).length;
    const losing = closed.filter((position) => Number(position.netProfit ?? position.realisedProfit) < 0).length;
    const realised = closed.reduce((total, position) => total + (Number(position.netProfit ?? position.realisedProfit) || 0), 0);
    const unrealised = open.reduce((total, position) => total + (Number(position.unrealisedProfit) || 0), 0);
    const invested = open.reduce((total, position) => total + (Number(position.investedAmount) || 0), 0);
    const gains = closed.map((position) => Number(position.netProfit ?? position.realisedProfit)).filter((value) => value > 0);
    const losses = closed.map((position) => Number(position.netProfit ?? position.realisedProfit)).filter((value) => value < 0);
    const startingCapital = 50000;
    const decided = winning + losing;
    return {
      open: open.length,
      closed: closed.length,
      invested,
      unrealised,
      realised,
      winning,
      losing,
      winRate: decided ? (winning / decided) * 100 : null,
      averageGain: gains.length ? gains.reduce((total, value) => total + value, 0) / gains.length : null,
      averageLoss: losses.length ? losses.reduce((total, value) => total + value, 0) / losses.length : null,
      largestWin: gains.length ? Math.max(...gains) : null,
      largestLoss: losses.length ? Math.min(...losses) : null,
      currentCapital: startingCapital + realised + unrealised,
      portfolioReturn: startingCapital ? ((realised + unrealised) / startingCapital) * 100 : null,
    };
  }, [positions]);

  useEffect(() => {
    if (!unlocked) return;
    loadPendingSetups();
  }, [unlocked]);

  async function loadPendingSetups() {
    try {
      const response = await fetch("/api/freedom-trader/setups");
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) setPendingSetups(data.setups || []);
    } catch (error) {
      console.error("Freedom Trader pending setups load failed:", error);
      setPendingSetups([]);
    }
  }

  function positionTone(position) {
    if (Number(position.unrealisedProfit) < 0 || (Number.isFinite(position.distanceToStop) && position.distanceToStop <= 2)) return "red";
    if (Number.isFinite(position.distanceToTarget) && position.distanceToTarget <= 5) return "amber";
    return "green";
  }

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate password={password} setPassword={setPassword} error={passwordError} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Positions | Freedom Trader</title></Head>
      <section className="platformBanner"><strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong><span>Active Trading & Market Opportunities</span></section>
      <PaperAccountBar />
      <FreedomModuleNav module="trader" paper />
      <header className="hero">
        <h1>Open Positions</h1>
        <p>Trader-only swing positions. Separate from Freedom Investment.</p>
      </header>

      {databaseUnavailable ? <section className="notice">Positions database temporarily unavailable. The page remains available.</section> : null}
      {message ? <section className="notice">{message}</section> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2>Pending Trades</h2>
          <span>Saved chart setups waiting for entry or manual buy</span>
        </div>
        <div className="tableWrap">
          <table className="pendingTable">
            <thead>
              <tr>
                <th>Ticker</th><th>Entry</th><th>Stop Loss</th><th>Target</th><th>Risk/Reward</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingSetups.length ? pendingSetups.map((setup) => (
                <tr key={setup.id || `${setup.symbol}-${setup.createdAt}`}>
                  <td><Link href={`/freedom-trader/company/${setup.symbol}`}>{setup.symbol}</Link></td>
                  <td>{formatCurrency(setup.entryPrice)}</td>
                  <td>{formatCurrency(setup.stopPrice)}</td>
                  <td>{formatCurrency(setup.targetPrice)}</td>
                  <td>{Number.isFinite(setup.riskRewardRatio) ? setup.riskRewardRatio.toFixed(2) : "--"}</td>
                  <td>{setup.status || "Pending"}</td>
                  <td><Link href={`/freedom-trader/company/${setup.symbol}`}>Open Chart</Link></td>
                </tr>
              )) : <tr><td colSpan="7">No pending trades saved yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="summary">
        <Card label="Open Positions" value={totals.open} />
        <Card label="Total Invested" value={formatCurrency(totals.invested)} />
        <Card label="Unrealised Profit/Loss" value={formatCurrency(totals.unrealised)} tone={totals.unrealised >= 0 ? "profit" : "loss"} />
        <Card label="Realised Profit/Loss" value={formatCurrency(totals.realised)} tone={totals.realised >= 0 ? "profit" : "loss"} />
        <Card label="Winning Trades" value={totals.winning} />
        <Card label="Losing Trades" value={totals.losing} />
        <Card label="Win Rate" value={Number.isFinite(totals.winRate) ? `${totals.winRate.toFixed(1)}%` : "--"} />
        <Card label="Current Capital" value={formatCurrency(totals.currentCapital)} tone={totals.currentCapital >= 50000 ? "profit" : "loss"} />
        <Card label="Portfolio Return" value={formatPercent(totals.portfolioReturn)} tone={totals.portfolioReturn >= 0 ? "profit" : "loss"} />
      </section>

      <main className="panel">
        <div className="panelHeader">
          <h2>Open Positions</h2>
          <button type="button" onClick={loadPositions} disabled={loading}>{loading ? "Refreshing..." : "Refresh Prices"}</button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Ticker</th><th>Quantity</th><th>Entry</th><th>Current Price</th><th>Invested Amount</th><th>Profit / Loss</th><th>Return %</th><th>Target</th><th>Stop</th><th>Distance to Target</th><th>Distance to Stop</th><th>Holding Time</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.filter((position) => position.status === "open").length ? positions.filter((position) => position.status === "open").map((position) => {
                const nearTarget = Number.isFinite(position.distanceToTarget) && position.distanceToTarget <= 2;
                const nearStop = Number.isFinite(position.distanceToStop) && position.distanceToStop <= 2;
                return (
                  <tr className={`positionRow ${positionTone(position)} ${nearTarget ? "nearTarget" : nearStop ? "nearStop" : ""}`} key={position.id}>
                    <td>{position.companyName}</td>
                    <td><Link href={`/freedom-trader/company/${position.symbol}`}>{position.symbol}</Link></td>
                    <td>{position.quantity}</td>
                    <td>{formatCurrency(position.entryPrice)}</td>
                    <td>{formatCurrency(position.currentPrice)}</td>
                    <td>{formatCurrency(position.investedAmount)}</td>
                    <td className={position.unrealisedProfit >= 0 ? "profit" : "loss"}>{formatCurrency(position.unrealisedProfit)}</td>
                    <td>{formatPercent(position.profitPercent)}</td>
                    <td>{formatCurrency(position.targetPrice)}</td>
                    <td>{formatCurrency(position.stopPrice)}</td>
                    <td>{formatPercent(position.distanceToTarget)}</td>
                    <td>{formatPercent(position.distanceToStop)}</td>
                    <td>{position.daysHeld ?? "--"}</td>
                    <td>{position.status}</td>
                    <td><div className="actions"><button onClick={() => openModal("edit-target", position)} type="button">Edit Target</button><button onClick={() => openModal("raise-stop", position)} type="button">Raise Stop</button><button onClick={() => openModal("note", position)} type="button">Add Note</button><button onClick={() => openModal("close", position)} type="button">Record Sell</button></div></td>
                  </tr>
                );
              }) : <tr><td colSpan="15">No open swing positions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>

      <section className="panel performancePanel">
        <div className="panelHeader">
          <h2>Performance</h2>
          <span>Closed trades and portfolio risk statistics</span>
        </div>
        <div className="performanceGrid">
          <Card label="Win %" value={Number.isFinite(totals.winRate) ? `${totals.winRate.toFixed(1)}%` : "--"} />
          <Card label="Average Gain" value={formatCurrency(totals.averageGain)} tone="profit" />
          <Card label="Average Loss" value={formatCurrency(totals.averageLoss)} tone="loss" />
          <Card label="Largest Win" value={formatCurrency(totals.largestWin)} tone="profit" />
          <Card label="Largest Loss" value={formatCurrency(totals.largestLoss)} tone="loss" />
          <Card label="Current Capital" value={formatCurrency(totals.currentCapital)} />
          <Card label="Portfolio Return" value={formatPercent(totals.portfolioReturn)} />
          <Card label="Risk Statistics" value={`${totals.open} open / ${totals.closed} closed`} />
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Closed Trades</h2>
          <span>{totals.closed} completed trades</span>
        </div>
        <div className="tableWrap">
          <table className="closedTable">
            <thead>
              <tr>
                <th>Company</th><th>Ticker</th><th>Shares</th><th>Entry</th><th>Sell</th><th>Gross P/L</th><th>Total Brokerage</th><th>Net P/L</th><th>Return %</th><th>Holding Days</th><th>Win/Loss</th>
              </tr>
            </thead>
            <tbody>
              {positions.filter((position) => position.status === "closed").length ? positions.filter((position) => position.status === "closed").map((position) => (
                <tr className={Number(position.netProfit ?? position.realisedProfit) >= 0 ? "green" : "red"} key={position.id}>
                  <td>{position.companyName}</td>
                  <td><Link href={`/freedom-trader/company/${position.symbol}`}>{position.symbol}</Link></td>
                  <td>{position.quantity}</td>
                  <td>{formatCurrency(position.entryPrice)}</td>
                  <td>{formatCurrency(position.exitPrice)}</td>
                  <td>{formatCurrency(position.grossProfit)}</td>
                  <td>{formatCurrency(position.totalBrokerage)}</td>
                  <td className={Number(position.netProfit ?? position.realisedProfit) >= 0 ? "profit" : "loss"}>{formatCurrency(position.netProfit ?? position.realisedProfit)}</td>
                  <td>{formatPercent(position.percentageReturn)}</td>
                  <td>{position.daysHeld ?? "--"}</td>
                  <td>{position.winLoss || "Closed"}</td>
                </tr>
              )) : <tr><td colSpan="11">No closed trades yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {activeModal ? (
        <div className="modalBackdrop">
          <section className="modal">
            <h2>{activeModal.type === "close" ? "Record Sell" : "Update Position"}</h2>
            {activeModal.type === "edit-target" ? <label>Target price<input value={form.targetPrice} onChange={(event) => setForm((current) => ({ ...current, targetPrice: event.target.value }))} type="number" /></label> : null}
            {activeModal.type === "raise-stop" ? <label>Stop price<input value={form.stopPrice} onChange={(event) => setForm((current) => ({ ...current, stopPrice: event.target.value }))} type="number" /></label> : null}
            {activeModal.type === "close" ? (
              <>
                <label>Actual sale price<input value={form.exitPrice} onChange={(event) => setForm((current) => ({ ...current, exitPrice: event.target.value }))} type="number" /></label>
                <label>Shares sold<input value={form.sharesSold} onChange={(event) => setForm((current) => ({ ...current, sharesSold: event.target.value }))} type="number" /></label>
                <label>Brokerage cost<input value={form.brokerageSell} onChange={(event) => setForm((current) => ({ ...current, brokerageSell: event.target.value }))} type="number" /></label>
                <label>Sale date and time<input value={form.exitDate} onChange={(event) => setForm((current) => ({ ...current, exitDate: event.target.value }))} type="datetime-local" /></label>
              </>
            ) : null}
            <label>Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="modalActions"><button onClick={saveUpdate} type="button">Save</button><button onClick={() => setActiveModal(null)} type="button">Cancel</button></div>
          </section>
        </div>
      ) : null}

      <footer>Do not place trades automatically. Every trade requires entry, target and stop.</footer>
      <PageStyles />
    </div>
  );
}

function Card({ label, value, tone = "" }) {
  return <article className={tone}><span>{label}</span><strong>{value}</strong></article>;
}

function Gate({ password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>Freedom Trader Positions</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span><h1>Freedom Trader Positions</h1><p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}<button type="submit">Unlock</button>
      </form><PageStyles />
    </div>
  );
}

function PageStyles() {
  return <style jsx global>{`
    .boot,.page,.gateScreen{background:#05080b;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.hero,.summary,.panel,footer,.notice{margin:0 auto;max-width:1840px}.platformBanner{align-items:center;background:#0057d9;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;gap:14px;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{align-items:center;color:#fff;display:inline-flex;font-size:clamp(24px,2.6vw,34px);font-weight:950;gap:10px}.platformBanner span{color:#fff;font-size:clamp(14px,1.4vw,18px);font-weight:900}.platformBanner .platformIcon{color:#ff9900;font-size:.9em;line-height:1}.hero,.panel,.summary article,.performanceGrid article,.gate,.modal{background:rgba(8,14,17,.92);border:1px solid rgba(29,155,255,.16);border-radius:8px}.hero{padding:28px}.hero a{color:#d7efff;font-weight:900;text-decoration:none}h1,h2,p{margin:0}h1{font-size:48px;margin-top:18px}p,footer{color:#aebdc4}.notice{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.24);border-radius:8px;color:#d7efff;font-weight:850;margin-top:18px;padding:14px 16px}.summary,.performanceGrid{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px}.performanceGrid{padding:16px}.summary article,.performanceGrid article{padding:18px}.summary span,.performanceGrid span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}.summary strong,.performanceGrid strong{display:block;font-size:26px;margin-top:10px}.profit{color:#8ff0c3!important}.loss{color:#ff9a9a!important}.panel{margin-top:18px;overflow:hidden}.panelHeader{align-items:center;border-bottom:1px solid rgba(179,199,207,.1);display:flex;gap:12px;justify-content:space-between;padding:18px 20px}.panelHeader span{color:#aebdc4;font-size:12px;font-weight:900;text-transform:uppercase}button{background:#ff9900;border:0;border-radius:7px;color:#061014;cursor:pointer;font-weight:950;min-height:36px;padding:0 12px}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1900px;width:100%}.pendingTable{min-width:980px}.closedTable{min-width:1280px}th,td{border-bottom:1px solid rgba(179,199,207,.09);padding:13px;text-align:left;vertical-align:middle}th{color:#aebdc4;font-size:12px;text-transform:uppercase}td{color:#e7eef2}td a{color:#d7efff;font-weight:900;text-decoration:none}.actions{display:flex;flex-wrap:wrap;gap:7px}.actions button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.3);color:#d7efff}.positionRow.green td,.closedTable tr.green td{box-shadow:inset 4px 0 0 rgba(35,209,139,.9)}.positionRow.amber td{box-shadow:inset 4px 0 0 rgba(255,153,0,.95)}.positionRow.red td,.closedTable tr.red td{box-shadow:inset 4px 0 0 rgba(255,92,92,.95)}.nearTarget td{background:rgba(255,153,0,.08)}.nearStop td{background:rgba(255,92,92,.07)}footer{font-size:13px;margin-top:20px;padding-bottom:12px}.modalBackdrop{align-items:center;background:rgba(0,0,0,.72);display:flex;inset:0;justify-content:center;padding:24px;position:fixed;z-index:50}.modal{display:grid;gap:14px;max-width:520px;padding:22px;width:100%}label{color:#aebdc4;display:grid;font-size:12px;font-weight:900;gap:8px;text-transform:uppercase}input,textarea{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;padding:10px}textarea{min-height:100px}.modalActions{display:flex;gap:10px}.gate{max-width:460px;padding:34px;width:100%}.gate span{color:#5ebdff;font-size:12px;font-weight:950;text-transform:uppercase}.gate input{height:48px;margin-top:24px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:18px;width:100%}@media(max-width:1100px){.summary,.performanceGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.page{padding:88px 16px 16px}.summary,.performanceGrid{grid-template-columns:1fr}}
  `}</style>;
}

TraderPositions.disableLayout = true;
