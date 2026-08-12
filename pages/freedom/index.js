import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FreedomModuleNav from "../../components/freedom/FreedomModuleNav";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-terminal-unlocked";

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

function money(value, currency = "USD") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
}

function statusClass(status) {
  return String(status || "DATA INSUFFICIENT").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function PasswordGate({ passwordHash, onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function unlock(event) {
    event.preventDefault();
    const candidateHash = await browserHashPassword(password);
    if (candidateHash !== passwordHash) {
      setError("Incorrect password.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, "true");
    onUnlock();
  }

  return (
    <div className="gateScreen">
      <Head><title>Freedom Investment</title></Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Research</span>
        <h1>Freedom Investment</h1>
        <p>Enter the private Freedom password.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />
        {error ? <small>{error}</small> : null}
        <button type="submit">Unlock Investment</button>
      </form>
      <style jsx>{styles}</style>
    </div>
  );
}

export default function FreedomInvestmentDashboard({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [scan, setScan] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChecking(false);
  }, []);

  async function loadAll({ force = false } = {}) {
    setLoading(true);
    setMessage("");
    try {
      const [scanResponse, watchlistResponse, portfolioResponse] = await Promise.all([
        fetch("/api/freedom-investment/scanner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 10, force }),
        }),
        fetch("/api/freedom-investment/watchlist"),
        fetch("/api/freedom-investment/portfolio"),
      ]);
      const [scanData, watchlistData, portfolioData] = await Promise.all([
        scanResponse.json().catch(() => null),
        watchlistResponse.json().catch(() => null),
        portfolioResponse.json().catch(() => null),
      ]);
      setScan(scanData);
      setWatchlist(watchlistData?.watchlist || []);
      setPortfolio(portfolioData?.ok ? portfolioData : null);
      if (!scanData?.ok) setMessage(scanData?.error || "Investment scan could not complete.");
    } catch (error) {
      setMessage(error?.message || "Investment scan could not complete.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadAll();
  }, [unlocked]);

  async function addToWatchlist(row) {
    const response = await fetch("/api/freedom-investment/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const data = await response.json().catch(() => null);
    setMessage(data?.ok ? `${row.symbol} added to Investment Watchlist.` : data?.error || "Unable to update watchlist.");
    await loadAll({ force: false });
  }

  const attractive = useMemo(() => scan?.attractive || [], [scan]);
  const watchCandidates = useMemo(() => scan?.watchlistCandidates || [], [scan]);
  const topFive = useMemo(() => attractive.slice(0, 5), [attractive]);

  if (checking) return <div className="boot">Opening Freedom Investment...</div>;
  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page">
      <Head><title>Freedom Investment</title></Head>
      <section className="platformBanner"><strong>Freedom Investment</strong><span>Long-Term Opportunity Scanner</span></section>
      <FreedomModuleNav module="investment" />

      <header className="hero">
        <div>
          <span>Long-Term Ownership</span>
          <h1>Best Long-Term Opportunities</h1>
          <p>Quality businesses, valuation discipline, and 5-10 year ownership logic. No trader signals.</p>
        </div>
        <button type="button" onClick={() => loadAll({ force: true })} disabled={loading}>{loading ? "Scanning..." : "Run Investment Scan"}</button>
      </header>

      {message ? <section className="notice">{message}</section> : null}

      <section className="summary">
        <article><span>Supported universe</span><strong>{scan?.scanSummary?.supportedUniverse ?? "--"}</strong></article>
        <article><span>Successfully analysed</span><strong>{scan?.scanSummary?.successfullyAnalysed ?? "--"}</strong></article>
        <article><span>Data unavailable</span><strong>{scan?.scanSummary?.dataUnavailable ?? "--"}</strong></article>
        <article><span>Attractive</span><strong>{scan?.scanSummary?.attractive ?? "--"}</strong></article>
        <article><span>Fair Value</span><strong>{scan?.scanSummary?.fairValue ?? "--"}</strong></article>
        <article><span>Watch</span><strong>{scan?.scanSummary?.watch ?? "--"}</strong></article>
        <article><span>Expensive</span><strong>{scan?.scanSummary?.expensive ?? "--"}</strong></article>
        <article><span>Avoid</span><strong>{scan?.scanSummary?.avoid ?? "--"}</strong></article>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>What Should I Consider Buying?</h2></div>
        {topFive.length ? (
          <div className="cards">
            {topFive.map((row, index) => (
              <article key={row.symbol} className="opportunity">
                <span>#{index + 1} {row.symbol}</span>
                <h3>{row.companyName}</h3>
                <strong>Investment Score: {row.investmentScore}/100</strong>
                <p>{row.reason}</p>
                <div><b>Quality {row.businessQuality?.score ?? "--"}</b><b>{row.growth?.classification}</b><b>{row.valuation?.classification}</b></div>
                <Link href={`/freedom/company/${row.symbol}`}>Open Company</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No attractive long-term purchases currently identified.</div>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>Top 10 Long-Term Opportunities</h2></div>
        <InvestmentTable rows={scan?.topTen || []} onWatch={addToWatchlist} />
      </section>

      <section className="panel" id="watchlist">
        <div className="panelHeader"><h2>Quality Companies Worth Watching</h2></div>
        <InvestmentTable rows={watchCandidates.length ? watchCandidates : watchlist} onWatch={addToWatchlist} compact />
      </section>

      <section className="panel" id="portfolio">
        <div className="panelHeader"><h2>Portfolio View</h2></div>
        {portfolio?.holdings?.length ? (
          <>
            <InvestmentPortfolio rows={portfolio.holdings} />
            {portfolio.concentrationWarnings?.length ? <div className="notice">{portfolio.concentrationWarnings.join(" ")}</div> : null}
          </>
        ) : <div className="empty">No Freedom Investment holdings recorded yet.</div>}
      </section>

      <footer>Freedom Investment uses real provider data only. Missing fundamentals become DATA INSUFFICIENT, not invented recommendations.</footer>
      <style jsx>{styles}</style>
    </div>
  );
}

function InvestmentTable({ rows = [], onWatch, compact = false }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Company</th><th>Ticker</th><th>Current Price</th><th>Investment Score</th><th>Business Quality</th><th>Growth</th><th>Financial Strength</th><th>Valuation</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.symbol}>
              <td><Link href={`/freedom/company/${row.symbol}`}>{row.companyName || row.symbol}</Link><small>{row.reason}</small></td>
              <td>{row.symbol}</td>
              <td>{money(row.currentPrice, row.currency || "USD")}</td>
              <td>{row.investmentScore ?? "--"}</td>
              <td>{row.businessQuality?.score ?? row.investmentScore ?? "--"}</td>
              <td>{row.growth?.classification || "--"}</td>
              <td>{row.financialStrength?.classification || "--"}</td>
              <td>{row.valuation?.classification || "--"}</td>
              <td><span className={`status ${statusClass(row.status)}`}>{row.status || "--"}</span></td>
              <td>{compact ? "--" : <button type="button" onClick={() => onWatch(row)}>Watch</button>}</td>
            </tr>
          )) : <tr><td colSpan="10">No rows available.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function InvestmentPortfolio({ rows = [] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr><th>Company</th><th>Shares</th><th>Average Cost</th><th>Current Value</th><th>Gain/Loss</th><th>Portfolio Weight</th><th>Investment Score</th><th>Current Status</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td>{row.companyName || row.symbol}<small>{row.symbol}</small></td>
              <td>{row.shares}</td>
              <td>{money(row.averageCost, row.currency || "USD")}</td>
              <td>{money(row.currentValue, row.currency || "USD")}</td>
              <td>{money(row.gainLoss, row.currency || "USD")}</td>
              <td>{Number.isFinite(Number(row.portfolioWeight)) ? `${row.portfolioWeight}%` : "--"}</td>
              <td>{row.investmentScore ?? "--"}</td>
              <td><span className={`status ${statusClass(row.currentStatus)}`}>{row.currentStatus}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = `
  .boot,.page,.gateScreen{background:#08100d;color:#f4f7f5;font-family:Inter,ui-sans-serif,system-ui;min-height:100vh}.boot,.gateScreen{align-items:center;display:flex;justify-content:center}.page{padding:96px 28px 28px}.platformBanner{align-items:center;background:#0f6b4f;box-shadow:0 10px 28px rgba(0,0,0,.32);display:flex;justify-content:space-between;left:0;padding:14px 28px;position:fixed;right:0;top:0;z-index:100}.platformBanner strong{font-size:clamp(24px,2.6vw,34px);font-weight:950}.platformBanner span{font-weight:900}.hero,.panel,.notice,.summary article,.gate{background:rgba(8,16,13,.94);border:1px solid rgba(145,196,174,.2);border-radius:8px}.hero,.panel,.summary,.notice,footer{margin:0 auto 18px;max-width:1760px}.hero{align-items:center;display:flex;gap:20px;justify-content:space-between;padding:28px}.hero span,.summary span,.panelHeader span,label{color:#a9bdb4;font-size:12px;font-weight:900;text-transform:uppercase}h1,h2,h3,p{margin:0}h1{font-size:48px}p,footer,small{color:#a9bdb4}.hero button,td button,.gate button{background:#d4af37;border:0;border-radius:7px;color:#07100d;cursor:pointer;font-weight:950;min-height:40px;padding:0 14px}.summary{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}.summary article{padding:16px}.summary strong{display:block;font-size:30px;margin-top:8px}.panel{overflow:hidden}.panelHeader{border-bottom:1px solid rgba(255,255,255,.08);padding:18px 20px}.cards{display:grid;gap:14px;grid-template-columns:repeat(5,minmax(0,1fr));padding:16px}.opportunity{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px}.opportunity h3{font-size:20px;margin:8px 0}.opportunity strong{color:#d7f4e6;display:block}.opportunity div{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.opportunity b{background:rgba(255,255,255,.08);border-radius:999px;font-size:12px;padding:6px 8px}.opportunity a,td a{color:#d7f4e6;font-weight:950;text-decoration:none}.tableWrap{overflow-x:auto}table{border-collapse:collapse;min-width:1260px;width:100%}th,td{border-bottom:1px solid rgba(255,255,255,.08);padding:13px 14px;text-align:left;vertical-align:top}th{color:#a9bdb4;font-size:12px;text-transform:uppercase}td small{display:block;margin-top:4px}.status{border-radius:999px;display:inline-flex;font-size:11px;font-weight:950;padding:7px 10px}.status.attractive{background:rgba(57,217,138,.16);border:1px solid rgba(57,217,138,.42);color:#bff6d9}.status.fairvalue,.status.watch{background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.34);color:#ffe98a}.status.expensive{background:rgba(255,153,0,.16);border:1px solid rgba(255,153,0,.38);color:#ffd7a1}.status.avoid,.status.datainsufficient{background:rgba(255,92,92,.14);border:1px solid rgba(255,92,92,.38);color:#ffc8c8}.empty{color:#a9bdb4;font-weight:850;padding:18px 20px}.notice{color:#d7f4e6;font-weight:850;padding:14px 16px}.gate{max-width:460px;padding:34px;width:100%}.gate h1{margin-top:8px}.gate input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#fff;height:48px;margin-top:22px;padding:0 14px;width:100%}.gate small{color:#ffb1a5;display:block;margin-top:10px}.gate button{height:48px;margin-top:16px;width:100%}@media(max-width:1100px){.summary,.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{align-items:flex-start;flex-direction:column}}@media(max-width:720px){.page{padding:88px 16px 16px}.summary,.cards{grid-template-columns:1fr}h1{font-size:38px}}
`;

FreedomInvestmentDashboard.disableLayout = true;
