import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export default function TraderPositions({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [positions, setPositions] = useState([]);

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

  const totals = useMemo(() => {
    return positions.reduce((acc, position) => {
      const pnl = ((position.currentPrice || position.entryPrice) - position.entryPrice) * position.quantity;
      return { open: acc.open + 1, pnl: acc.pnl + pnl };
    }, { open: 0, pnl: 0 });
  }, [positions]);

  if (checking) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <Gate title="Freedom Trader Positions" password={password} setPassword={setPassword} error={error} onSubmit={unlock} />;

  return (
    <div className="page">
      <Head><title>Positions | Freedom Trader</title></Head>
      <header className="hero">
        <Link href="/freedom-trader">Back to Freedom Trader</Link>
        <h1>Open Positions</h1>
        <p>Trader-only swing positions. This is separate from the Freedom Investment portfolio.</p>
      </header>
      <section className="summary">
        <article><span>Open Positions</span><strong>{totals.open}</strong></article>
        <article><span>Unrealised P/L</span><strong>{totals.pnl >= 0 ? "+" : ""}${totals.pnl.toFixed(2)}</strong></article>
        <article><span>Max Allocation Rule</span><strong>10%</strong></article>
        <article><span>Max Single Trade Risk</span><strong>1%</strong></article>
      </section>
      <main className="panel">
        <div className="panelHeader">
          <h2>Position Ledger</h2>
          <button type="button" onClick={() => setPositions((current) => [...current, { symbol: "NVDA", quantity: 1, entryPrice: 0, currentPrice: 0, target: 0, stop: 0, entryDate: new Date().toISOString().slice(0, 10), status: "planned" }])}>Record Buy</button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Symbol</th><th>Quantity</th><th>Average Entry</th><th>Current Price</th><th>Unrealised P/L</th><th>Target</th><th>Stop</th><th>Distance To Target</th><th>Distance To Stop</th><th>Days Held</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {positions.length ? positions.map((position, index) => {
                const pnl = ((position.currentPrice || position.entryPrice) - position.entryPrice) * position.quantity;
                return (
                  <tr key={`${position.symbol}-${index}`}>
                    <td>{position.symbol}</td><td>{position.quantity}</td><td>${position.entryPrice}</td><td>${position.currentPrice}</td><td>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td><td>${position.target}</td><td>${position.stop}</td><td>--</td><td>--</td><td>0</td><td>{position.status}</td><td>Adjust target / raise stop / close</td>
                  </tr>
                );
              }) : <tr><td colSpan="12">No open swing positions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
      <footer>Do not place trades automatically. Every trade requires entry, target and stop.</footer>
      <PageStyles />
    </div>
  );
}

function Gate({ title, password, setPassword, error, onSubmit }) {
  return (
    <div className="gateScreen">
      <Head><title>{title}</title></Head>
      <form className="gate" onSubmit={onSubmit}>
        <span>Private Trading Workspace</span><h1>{title}</h1><p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}<button type="submit">Unlock</button>
      </form><PageStyles />
    </div>
  );
}

function PageStyles() {
  return <style jsx global>{`
    .boot, .page, .gateScreen { background: radial-gradient(circle at 12% 0%, rgba(255,153,0,.2), transparent 34rem), radial-gradient(circle at 86% 8%, rgba(29,155,255,.14), transparent 30rem), #05080b; color: #f5f7f8; font-family: Inter, ui-sans-serif, system-ui; min-height: 100vh; }
    .boot, .gateScreen { align-items: center; display: flex; justify-content: center; }
    .page { padding: 28px; }
    .hero, .summary, .panel, footer { margin: 0 auto; max-width: 1760px; }
    .hero, .panel, .summary article, .gate { background: rgba(8,14,17,.92); border: 1px solid rgba(179,199,207,.13); border-radius: 8px; }
    .hero { padding: 28px; }
    .hero a { color: #d7efff; font-weight: 900; text-decoration: none; }
    h1, h2, p { margin: 0; } h1 { font-size: 48px; margin-top: 18px; } p, footer { color: #aebdc4; }
    .summary { display: grid; gap: 14px; grid-template-columns: repeat(4,minmax(0,1fr)); margin-top: 18px; }
    .summary article { padding: 18px; } .summary span { color: #aebdc4; font-size: 12px; font-weight: 900; text-transform: uppercase; } .summary strong { display: block; font-size: 30px; margin-top: 10px; }
    .panel { margin-top: 18px; overflow: hidden; } .panelHeader { align-items: center; border-bottom: 1px solid rgba(179,199,207,.1); display: flex; justify-content: space-between; padding: 18px 20px; }
    button { background: linear-gradient(135deg,#ff9900,#1d9bff); border: 0; border-radius: 7px; color: #061014; cursor: pointer; font-weight: 950; min-height: 40px; padding: 0 14px; }
    .tableWrap { overflow-x: auto; } table { border-collapse: collapse; min-width: 1400px; width: 100%; } th, td { border-bottom: 1px solid rgba(179,199,207,.09); padding: 14px; text-align: left; } th { color: #aebdc4; font-size: 12px; text-transform: uppercase; } td { color: #e7eef2; }
    footer { font-size: 13px; margin-top: 20px; padding-bottom: 12px; }
    .gate { max-width: 460px; padding: 34px; width: 100%; } .gate span { color: #5ebdff; font-size: 12px; font-weight: 950; text-transform: uppercase; } .gate input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #fff; height: 48px; margin-top: 24px; padding: 0 14px; width: 100%; } .gate small { color: #ffb1a5; display: block; margin-top: 10px; } .gate button { width: 100%; margin-top: 18px; height: 48px; }
    @media (max-width: 900px) { .summary { grid-template-columns: 1fr; } .page { padding: 16px; } }
  `}</style>;
}

TraderPositions.disableLayout = true;
