import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-terminal-unlocked";
const WATCHLIST_SYMBOLS = ["MSFT", "NVDA", "V", "AMZN", "COST", "GOOGL", "AVGO", "MA", "ASML", "TSM"];

const COMPANY_STYLES = {
  MSFT: { companyName: "Microsoft", logoText: "MS", primaryColor: "#00A4EF", secondaryColor: "#7FBA00", accentColor: "#FFB900" },
  NVDA: { companyName: "NVIDIA", logoText: "NV", primaryColor: "#76B900", secondaryColor: "#0B3D02", accentColor: "#B7FF4A" },
  V: { companyName: "Visa", logoText: "V", primaryColor: "#1A1F71", secondaryColor: "#F7B600", accentColor: "#4D8DFF" },
  AMZN: { companyName: "Amazon", logoText: "A", primaryColor: "#FF9900", secondaryColor: "#232F3E", accentColor: "#FFD15C" },
  COST: { companyName: "Costco", logoText: "C", primaryColor: "#E31837", secondaryColor: "#005DAA", accentColor: "#FFFFFF" },
  GOOGL: { companyName: "Alphabet", logoText: "G", primaryColor: "#4285F4", secondaryColor: "#EA4335", accentColor: "#FBBC05" },
  AVGO: { companyName: "Broadcom", logoText: "B", primaryColor: "#CC092F", secondaryColor: "#7A0019", accentColor: "#FF6B6B" },
  MA: { companyName: "Mastercard", logoText: "M", primaryColor: "#EB001B", secondaryColor: "#F79E1B", accentColor: "#FFCA4D" },
  ASML: { companyName: "ASML", logoText: "AS", primaryColor: "#0073CF", secondaryColor: "#00A3E0", accentColor: "#9BE7FF" },
  TSM: { companyName: "Taiwan Semiconductor", logoText: "TS", primaryColor: "#D71920", secondaryColor: "#1B2A57", accentColor: "#64B5F6" },
};

const FALLBACK_STYLE = {
  companyName: "Company",
  logoText: "--",
  primaryColor: "#79D9C5",
  secondaryColor: "#334155",
  accentColor: "#E4B85D",
};

const STARTING_ROWS = [
  { companyName: "Microsoft", symbol: "MSFT", sector: "Software", qualityScore: 96, healthScore: 96 },
  { companyName: "NVIDIA", symbol: "NVDA", sector: "Semiconductors", qualityScore: 94 },
  { companyName: "Visa", symbol: "V", sector: "Payments", qualityScore: 95 },
  { companyName: "Amazon", symbol: "AMZN", sector: "Cloud & E-commerce", qualityScore: 93 },
  { companyName: "Costco", symbol: "COST", sector: "Consumer Defensive", qualityScore: 92 },
  { companyName: "Alphabet", symbol: "GOOGL", sector: "Digital Advertising & AI", qualityScore: 93 },
  { companyName: "Broadcom", symbol: "AVGO", sector: "Semiconductors", qualityScore: 92 },
  { companyName: "Mastercard", symbol: "MA", sector: "Payments", qualityScore: 94 },
  { companyName: "ASML", symbol: "ASML", sector: "Semiconductor Equipment", qualityScore: 91 },
  { companyName: "Taiwan Semiconductor", symbol: "TSM", sector: "Semiconductors", qualityScore: 92 },
];

const HEALTH_SCORES = {
  MSFT: 96,
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function getCompanyStyle(symbol) {
  return COMPANY_STYLES[symbol] || { ...FALLBACK_STYLE, logoText: String(symbol || "--").slice(0, 2) };
}

function styleVars(style) {
  return {
    "--company-primary": style.primaryColor,
    "--company-secondary": style.secondaryColor,
    "--company-accent": style.accentColor,
  };
}

function formatCurrency(value) {
  return Number.isFinite(value) ? money.format(value) : "--";
}

function formatPercent(value, signed = false) {
  if (!Number.isFinite(value)) return "--";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getRating(qualityScore, percentOffHigh) {
  if (qualityScore >= 95 && percentOffHigh <= -15) return "STRONG BUY";
  if (qualityScore >= 90 && percentOffHigh <= -10) return "BUY";
  if (qualityScore >= 90) return "WATCH";
  if (qualityScore >= 80) return "HOLD OFF";
  return "AVOID";
}

function investmentStatus(rating) {
  const normalized = String(rating || "").trim().toUpperCase();
  if (normalized.includes("STRONG BUY")) return "strongBuy";
  if (normalized === "BUY" || normalized === "BUY WATCH") return "buy";
  if (normalized === "WATCH" || normalized === "FAIR VALUE") return "watch";
  if (normalized === "HOLD" || normalized === "HOLD OFF" || normalized === "WAIT" || normalized === "EXPENSIVE") return "holdOff";
  if (normalized === "SELL") return "sell";
  if (normalized === "AVOID") return "avoid";
  return "info";
}

function ratingLabel(rating) {
  return {
    strongBuy: "STRONG BUY",
    buy: "BUY",
    watch: "WATCH",
    holdOff: "HOLD OFF",
    avoid: "AVOID",
    sell: "SELL",
    info: "INFO",
  }[investmentStatus(rating)];
}

function ratingClass(rating) {
  return investmentStatus(rating);
}

function getBuyMeter(rating) {
  const status = investmentStatus(rating);
  if (status === "strongBuy") return 96;
  if (status === "buy") return 88;
  if (status === "watch") return 76;
  if (status === "holdOff") return 64;
  return 45;
}

function buyScoreClass(score) {
  if (score >= 95) return "strongBuy";
  if (score >= 85) return "buy";
  if (score >= 70) return "watch";
  if (score >= 60) return "holdOff";
  return "avoid";
}

function getHealthScore(row) {
  const directScore = row.healthScore?.overallScore ?? row.healthScore;
  if (Number.isFinite(directScore)) return directScore;
  if (Number.isFinite(HEALTH_SCORES[row.symbol])) return HEALTH_SCORES[row.symbol];
  return null;
}

function dashboardRowError(message) {
  const text = String(message || "").trim();
  if (!text) return "";
  if (/historical candle data is unavailable on the current finnhub plan/i.test(text)) return "";
  return text;
}

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildSummary(rows) {
  const priced = rows.filter((row) => Number.isFinite(row.percentOffHigh));
  const bestBuy =
    priced
      .slice()
      .sort((a, b) => {
        const ratingGap = (["STRONG BUY", "BUY"].includes(ratingLabel(b.rating)) ? 1 : 0) - (["STRONG BUY", "BUY"].includes(ratingLabel(a.rating)) ? 1 : 0);
        return ratingGap || b.qualityScore - a.qualityScore || a.percentOffHigh - b.percentOffHigh;
      })[0] || null;
  const biggestDrop = priced.slice().sort((a, b) => a.percentOffHigh - b.percentOffHigh)[0] || null;
  const averageScore = rows.length
    ? rows.reduce((total, row) => total + (row.qualityScore || 0), 0) / rows.length
    : 0;

  return {
    watchlistCount: rows.length,
    averageScore: Number(averageScore.toFixed(1)),
    bestBuy,
    biggestDrop,
  };
}

export async function getServerSideProps() {
  try {
    const { createHash } = await import("crypto");
    const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
    const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");

    return {
      props: {
        passwordHash,
      },
    };
  } catch (error) {
    console.error("Freedom dashboard load failed:", error);
    return {
      props: {
        passwordHash: "",
      },
    };
  }
}

function PasswordGate({ passwordHash, onUnlock }) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function unlock(event) {
    event.preventDefault();
    const candidateHash = await browserHashPassword(password);
    if (candidateHash !== passwordHash) {
      setPasswordError("Incorrect password.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, "true");
    onUnlock();
  }

  return (
    <div className="gateScreen">
      <Head>
        <title>Freedom Terminal</title>
      </Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Research</span>
        <h1>Freedom Terminal</h1>
        <p>Enter the temporary password to open the standalone investment terminal.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Terminal</button>
      </form>
      <style jsx>{`
        .gateScreen {
          align-items: center;
          background: radial-gradient(circle at 18% 8%, rgba(0, 164, 239, 0.22), transparent 34rem), #05080b;
          color: #f6f8f9;
          display: flex;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .gate {
          background: rgba(8, 14, 17, 0.94);
          border: 1px solid rgba(178, 198, 207, 0.16);
          border-radius: 8px;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.45);
          max-width: 460px;
          padding: 34px;
          width: 100%;
        }
        span {
          color: #79d9c5;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        h1,
        p {
          margin: 0;
        }
        h1 {
          font-size: 42px;
          letter-spacing: 0;
        }
        p {
          color: #aab8be;
          line-height: 1.55;
          margin-top: 10px;
        }
        input {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 7px;
          color: #fff;
          font-size: 16px;
          height: 48px;
          margin-top: 24px;
          padding: 0 14px;
          width: 100%;
        }
        small {
          color: #ffb1a5;
          display: block;
          font-weight: 750;
          margin-top: 10px;
        }
        button {
          background: linear-gradient(135deg, #00a4ef, #ffb900);
          border: 0;
          border-radius: 7px;
          color: #061014;
          cursor: pointer;
          font-size: 15px;
          font-weight: 950;
          height: 48px;
          margin-top: 18px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}

function FreedomTerminal({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [rows, setRows] = useState(
    STARTING_ROWS.map((row) => ({ ...row, rating: getRating(row.qualityScore, null) }))
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisModal, setAnalysisModal] = useState({
    open: false,
    running: false,
    currentSymbol: "",
    currentStage: "",
    completed: [],
    failed: [],
  });
  const [error, setError] = useState("");
  const [analysisWarning, setAnalysisWarning] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setCheckingStorage(false);
  }, []);

  async function loadQuotes({ silent = false } = {}) {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await fetch(`/api/freedom/quotes?symbols=${WATCHLIST_SYMBOLS.join(",")}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to load market data.");

      setRows(
        (data.quotes || []).map((row) => ({
          ...row,
          error: dashboardRowError(row.error),
          healthScore: getHealthScore(row),
          rating: row.rating || getRating(row.qualityScore, row.percentOffHigh),
        }))
      );
      setUpdatedAt(data.updatedAt || "");
    } catch (err) {
      console.error("Freedom Terminal load error:", err);
      setError(err.message || "Unable to load market data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadQuotes();
  }, [unlocked]);

  async function analyseSymbols(symbols = WATCHLIST_SYMBOLS) {
    const targetSymbols = (Array.isArray(symbols) ? symbols : WATCHLIST_SYMBOLS).filter(Boolean);
    if (!targetSymbols.length || analysisModal.running) return;

    const completed = [];
    const failed = [];
    setAnalysisWarning("");
    setAnalysisModal({
      open: true,
      running: true,
      currentSymbol: targetSymbols[0],
      currentStage: "queued",
      completed,
      failed,
    });

    for (const symbol of targetSymbols) {
      setAnalysisModal((current) => ({
        ...current,
        currentSymbol: symbol,
        currentStage: "requesting",
      }));

      try {
        const response = await fetch("/api/freedom/analyse-company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Analysis request failed.");
        }

        completed.push(symbol);
        setAnalysisWarning("");
        setAnalysisModal((current) => ({
          ...current,
          currentStage: "completed",
          completed: [...completed],
          failed: [...failed],
        }));
      } catch (err) {
        failed.push({ symbol, error: err.message || "Analysis request failed." });
        setAnalysisWarning("Company analysis is temporarily unavailable. Live quotes remain active.");
        setAnalysisModal((current) => ({
          ...current,
          currentStage: "failed",
          completed: [...completed],
          failed: [...failed],
        }));
      }
    }

    setAnalysisModal((current) => ({
      ...current,
      running: false,
      currentSymbol: "",
      currentStage: failed.length ? "completed with issues" : "completed",
      completed: [...completed],
      failed: [...failed],
    }));

    if (!failed.length) {
      setAnalysisWarning("");
      loadQuotes({ silent: true });
    }
  }

  function retryFailedAnalysis() {
    const failedSymbols = analysisModal.failed.map((item) => item.symbol).filter(Boolean);
    analyseSymbols(failedSymbols);
  }

  const summary = useMemo(() => buildSummary(rows), [rows]);

  if (checkingStorage) {
    return (
      <div className="center">
        Opening Freedom Terminal...
        <style jsx>{`
          .center {
            align-items: center;
            background: #05080b;
            color: #aab8be;
            display: flex;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-weight: 800;
            justify-content: center;
            min-height: 100vh;
          }
        `}</style>
      </div>
    );
  }

  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page">
      <Head>
        <title>Freedom Terminal</title>
      </Head>

      <header className="hero">
        <div>
          <span className="eyebrow">Private Terminal</span>
          <h1>Freedom Terminal</h1>
          <p>Private investment research dashboard</p>
        </div>
        <div className="heroActions">
          <span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Waiting for live market data"}</span>
          <button className="legendButton" type="button" onClick={() => setLegendOpen((open) => !open)}>
            Investment Colours
          </button>
          {legendOpen ? (
            <div className="legendPanel">
              <span className="statusPill buy">BUY</span>
              <span className="statusPill watch">WATCH</span>
              <span className="statusPill holdOff">HOLD OFF</span>
              <span className="statusPill avoid">AVOID</span>
              <span className="statusPill info">INFO</span>
            </div>
          ) : null}
          <button type="button" onClick={() => analyseSymbols(WATCHLIST_SYMBOLS)} disabled={analysisModal.running}>
            {analysisModal.running ? "Analysing..." : "Analyse All Companies"}
          </button>
          <button type="button" onClick={() => loadQuotes({ silent: true })} disabled={loading || refreshing}>
            {refreshing ? "Refreshing..." : "Refresh Quotes"}
          </button>
        </div>
      </header>

      {analysisWarning ? (
        <section className="analysisWarning" role="status">
          {analysisWarning}
        </section>
      ) : null}

      {error ? (
        <section className="alert" role="alert">
          <strong>Market data issue</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="summary">
        <article className="summaryCard blue">
          <span>Watchlist Count</span>
          <strong>{summary.watchlistCount}</strong>
          <small>Core quality watchlist</small>
        </article>
        <article className="summaryCard green">
          <span>Average Score</span>
          <strong>{summary.averageScore}</strong>
          <small>Internal quality score</small>
        </article>
        <article className="summaryCard gold">
          <span>Best Buy Opportunity</span>
          <strong>{summary.bestBuy?.symbol || "--"}</strong>
          <small>{summary.bestBuy ? `${ratingLabel(summary.bestBuy.rating)} at ${formatPercent(summary.bestBuy.percentOffHigh)}` : "No quote data yet"}</small>
        </article>
        <article className="summaryCard red">
          <span>Biggest Drop From High</span>
          <strong>{summary.biggestDrop?.symbol || "--"}</strong>
          <small>{summary.biggestDrop ? formatPercent(summary.biggestDrop.percentOffHigh) : "No quote data yet"}</small>
        </article>
      </section>

      <main className="panel">
        <div className="panelHeader">
          <div>
            <h2>Watchlist</h2>
            <p>Live quotes, 52-week range, private quality scoring, and research readiness.</p>
          </div>
          <span className="pill">{loading ? "Loading quotes..." : `${rows.length} Symbols`}</span>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Ticker</th>
                <th>Sector</th>
                <th>Current Price</th>
                <th>Daily Change %</th>
                <th>52W High</th>
                <th>52W Low</th>
                <th>% Off High</th>
                <th>Quality Score</th>
                <th>Health Score</th>
                <th>Buy Meter</th>
                <th>Rating</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const healthScore = getHealthScore(row);
                const buyMeter = getBuyMeter(row.rating);
                const companyStyle = getCompanyStyle(row.symbol);

                return (
                  <tr key={row.symbol} style={styleVars(companyStyle)}>
                    <td>
                      <Link className="companyLink" href={`/freedom/company/${row.symbol}`}>
                        <span className="logoBadge">{companyStyle.logoText}</span>
                        <span className="companyText">
                          <strong>{row.companyName || companyStyle.companyName}</strong>
                          {row.error ? <small>{row.error}</small> : null}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link className="ticker" href={`/freedom/company/${row.symbol}`}>
                        {row.symbol}
                      </Link>
                    </td>
                    <td>{row.sector}</td>
                    <td>{loading ? <span className="skeleton" /> : formatCurrency(row.currentPrice)}</td>
                    <td className={Number.isFinite(row.changePercent) && row.changePercent >= 0 ? "up" : "down"}>
                      {loading ? <span className="skeleton" /> : formatPercent(row.changePercent, true)}
                    </td>
                    <td>{loading ? <span className="skeleton" /> : formatCurrency(row.yearHigh)}</td>
                    <td>{loading ? <span className="skeleton" /> : formatCurrency(row.yearLow)}</td>
                    <td className={Number.isFinite(row.percentOffHigh) && row.percentOffHigh <= -15 ? "drop" : ""}>
                      {loading ? <span className="skeleton" /> : formatPercent(row.percentOffHigh)}
                    </td>
                    <td>
                      <div className="meterCell">
                        <span>{row.qualityScore ?? "--"}</span>
                        <div className="miniBar">
                          <i style={{ width: `${Math.max(0, Math.min(row.qualityScore || 0, 100))}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="meterCell">
                        <span>{Number.isFinite(healthScore) ? healthScore : "--"}</span>
                        <div className="miniBar health">
                          <i style={{ width: `${Number.isFinite(healthScore) ? Math.max(0, Math.min(healthScore, 100)) : 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="meterCell">
                        <span>{buyMeter}</span>
                        <div className={`miniBar buy ${buyScoreClass(buyMeter)}`}>
                          <i style={{ width: `${buyMeter}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`rating statusPill ${ratingClass(row.rating)}`}>{ratingLabel(row.rating)}</span>
                    </td>
                    <td>
                      <Link className="action" href={`/freedom/company/${row.symbol}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {analysisModal.open ? (
        <div className="modalBackdrop" role="presentation">
          <section className="progressModal" role="dialog" aria-modal="true" aria-label="Company analysis progress">
            <div className="modalHeader">
              <div>
                <span>Analyse All Companies</span>
                <h2>{analysisModal.running ? "Analysis running" : "Analysis complete"}</h2>
              </div>
              <button type="button" onClick={() => setAnalysisModal((current) => ({ ...current, open: false }))} disabled={analysisModal.running}>
                Close
              </button>
            </div>
            <div className="progressGrid">
              <article>
                <span>Current ticker</span>
                <strong>{analysisModal.currentSymbol || "--"}</strong>
              </article>
              <article>
                <span>Current stage</span>
                <strong>{analysisModal.currentStage || "--"}</strong>
              </article>
              <article>
                <span>Completed</span>
                <strong>{analysisModal.completed.length}</strong>
              </article>
              <article>
                <span>Failed</span>
                <strong>{analysisModal.failed.length}</strong>
              </article>
            </div>
            <div className="progressList">
              {WATCHLIST_SYMBOLS.map((symbol) => {
                const failed = analysisModal.failed.find((item) => item.symbol === symbol);
                const done = analysisModal.completed.includes(symbol);
                const active = analysisModal.currentSymbol === symbol;
                return (
                  <div className={active ? "active" : done ? "done" : failed ? "failed" : ""} key={symbol}>
                    <strong>{symbol}</strong>
                    <span>{done ? "completed" : failed ? failed.error : active ? analysisModal.currentStage : "queued"}</span>
                  </div>
                );
              })}
            </div>
            {analysisModal.failed.length ? (
              <button type="button" onClick={retryFailedAnalysis} disabled={analysisModal.running}>
                Retry Failed Companies
              </button>
            ) : null}
          </section>
        </div>
      ) : null}

      <footer>Private research tool. Not financial advice.</footer>

      <style jsx>{`
        .page {
          background:
            radial-gradient(circle at 12% 0%, rgba(0, 164, 239, 0.22), transparent 34rem),
            radial-gradient(circle at 86% 8%, rgba(255, 185, 0, 0.12), transparent 30rem),
            #05080b;
          color: #f5f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
          padding: 28px;
        }
        .hero,
        .alert,
        .summary,
        .panel,
        footer {
          margin-left: auto;
          margin-right: auto;
          max-width: 1760px;
        }
        .hero {
          align-items: flex-end;
          background:
            linear-gradient(135deg, rgba(0, 164, 239, 0.2), rgba(127, 186, 0, 0.12) 46%, rgba(255, 185, 0, 0.16)),
            rgba(8, 14, 17, 0.96);
          border: 1px solid rgba(0, 164, 239, 0.26);
          border-radius: 8px;
          box-shadow: 0 24px 90px rgba(0, 164, 239, 0.12);
          display: flex;
          justify-content: space-between;
          min-height: 210px;
          padding: 34px;
        }
        .eyebrow {
          color: #ffdf7a;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        h1,
        h2,
        p {
          margin: 0;
        }
        h1 {
          color: #fff;
          font-size: clamp(44px, 5vw, 78px);
          letter-spacing: 0;
          line-height: 0.95;
          text-shadow: 0 0 28px rgba(0, 164, 239, 0.22);
        }
        .hero p {
          color: #d8e5ea;
          font-size: 18px;
          margin-top: 16px;
        }
        .heroActions {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: relative;
        }
        .heroActions span,
        footer {
          color: #aebdc4;
          font-size: 13px;
        }
        button {
          background: linear-gradient(135deg, #00a4ef, #7fba00 50%, #ffb900);
          border: 0;
          border-radius: 7px;
          color: #051014;
          cursor: pointer;
          font-weight: 950;
          min-height: 42px;
          padding: 0 18px;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .legendButton {
          background: #2471a3;
          color: #fff;
        }
        .legendPanel {
          background: rgba(5, 8, 11, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          max-width: 320px;
          padding: 10px;
          position: absolute;
          right: 0;
          top: 58px;
          z-index: 2;
        }
        .alert {
          background: rgba(178, 73, 73, 0.16);
          border: 1px solid rgba(255, 137, 124, 0.28);
          border-radius: 8px;
          color: #ffd8d3;
          display: flex;
          gap: 12px;
          margin-top: 18px;
          padding: 14px 16px;
        }
        .analysisWarning {
          background: rgba(228, 184, 93, 0.13);
          border: 1px solid rgba(228, 184, 93, 0.28);
          border-radius: 8px;
          color: #ffe6a3;
          font-size: 13px;
          font-weight: 850;
          margin-top: 18px;
          padding: 12px 16px;
        }
        .modalBackdrop {
          align-items: center;
          background: rgba(0, 0, 0, 0.72);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 24px;
          position: fixed;
          z-index: 50;
        }
        .progressModal {
          background: #081013;
          border: 1px solid rgba(121, 217, 197, 0.24);
          border-radius: 8px;
          box-shadow: 0 30px 120px rgba(0, 0, 0, 0.62);
          max-height: calc(100vh - 48px);
          max-width: 760px;
          overflow: auto;
          padding: 20px;
          width: 100%;
        }
        .modalHeader {
          align-items: center;
          display: flex;
          gap: 16px;
          justify-content: space-between;
        }
        .modalHeader span,
        .progressGrid span {
          color: #aebdc4;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .progressGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 18px;
        }
        .progressGrid article,
        .progressList div {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px;
        }
        .progressGrid strong {
          color: #fff;
          font-size: 24px;
        }
        .progressList {
          display: grid;
          gap: 8px;
          margin: 18px 0;
        }
        .progressList div {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .progressList strong {
          color: #fff;
        }
        .progressList span {
          color: #aebdc4;
          font-size: 13px;
          text-align: right;
        }
        .progressList .active {
          border-color: rgba(228, 184, 93, 0.5);
        }
        .progressList .done {
          border-color: rgba(121, 217, 197, 0.42);
        }
        .progressList .failed {
          border-color: rgba(255, 137, 124, 0.45);
        }
        .summary {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 18px;
        }
        .summaryCard,
        .panel {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
        }
        .summaryCard {
          min-height: 120px;
          overflow: hidden;
          padding: 18px;
          position: relative;
        }
        .summaryCard:before {
          content: "";
          inset: 0;
          opacity: 0.16;
          position: absolute;
        }
        .summaryCard.blue:before {
          background: linear-gradient(135deg, #00a4ef, transparent 70%);
        }
        .summaryCard.green:before {
          background: linear-gradient(135deg, #76b900, transparent 70%);
        }
        .summaryCard.gold:before {
          background: linear-gradient(135deg, #ffb900, transparent 70%);
        }
        .summaryCard.red:before {
          background: linear-gradient(135deg, #e31837, transparent 70%);
        }
        .summary span,
        .summary small,
        .summary strong {
          position: relative;
        }
        .summary span,
        .summary small {
          color: #aebdc4;
          display: block;
          font-size: 13px;
        }
        .summary strong {
          color: #fff;
          display: block;
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 950;
          margin: 14px 0 10px;
        }
        .panel {
          margin-top: 18px;
          overflow: hidden;
        }
        .panelHeader {
          align-items: center;
          border-bottom: 1px solid rgba(179, 199, 207, 0.1);
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 22px;
        }
        .panelHeader p {
          color: #aebdc4;
          margin-top: 5px;
        }
        .pill {
          background: rgba(121, 217, 197, 0.11);
          border: 1px solid rgba(121, 217, 197, 0.22);
          border-radius: 999px;
          color: #b8f4e6;
          font-size: 13px;
          font-weight: 850;
          padding: 8px 12px;
          white-space: nowrap;
        }
        .tableWrap {
          overflow-x: auto;
        }
        table {
          border-collapse: collapse;
          min-width: 1740px;
          table-layout: fixed;
          width: 100%;
        }
        th,
        td {
          border-bottom: 1px solid rgba(179, 199, 207, 0.09);
          padding: 15px 16px;
          text-align: left;
          vertical-align: middle;
        }
        th {
          background: rgba(255, 255, 255, 0.04);
          color: #aebdc4;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
        }
        td {
          color: #e7eef2;
          font-size: 14px;
        }
        tr {
          transition: background 160ms ease, box-shadow 160ms ease;
        }
        tr:hover td {
          background: color-mix(in srgb, var(--company-primary) 12%, transparent);
          box-shadow: inset 3px 0 0 var(--company-primary);
        }
        .companyLink {
          align-items: center;
          color: #fff;
          display: grid;
          gap: 12px;
          grid-template-columns: 44px minmax(0, 1fr);
          text-decoration: none;
        }
        .logoBadge {
          align-items: center;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--company-primary) 78%, #fff 8%), var(--company-secondary));
          border: 1px solid color-mix(in srgb, var(--company-accent) 72%, #fff 8%);
          border-radius: 999px;
          box-shadow: 0 0 24px color-mix(in srgb, var(--company-primary) 36%, transparent);
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          height: 44px;
          justify-content: center;
          letter-spacing: 0;
          width: 44px;
        }
        .companyText {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .companyText small {
          color: #ffb1a5;
          font-size: 12px;
        }
        .ticker,
        .action {
          color: #fff;
          text-decoration: none;
        }
        .ticker {
          background: color-mix(in srgb, var(--company-primary) 16%, transparent);
          border: 1px solid var(--company-primary);
          border-radius: 6px;
          box-shadow: 0 0 18px color-mix(in srgb, var(--company-primary) 22%, transparent);
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          justify-content: center;
          min-width: 58px;
          padding: 7px 9px;
        }
        .action {
          color: var(--company-accent);
          font-weight: 950;
        }
        .up {
          color: #87dfc2;
          font-weight: 850;
        }
        .down,
        .drop {
          color: #ffb15d;
          font-weight: 850;
        }
        .meterCell {
          display: grid;
          gap: 8px;
          min-width: 108px;
        }
        .meterCell span {
          color: #fff;
          font-weight: 900;
        }
        .miniBar {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          height: 8px;
          overflow: hidden;
          width: 100%;
        }
        .miniBar i {
          background: linear-gradient(90deg, var(--company-primary), var(--company-accent));
          border-radius: inherit;
          display: block;
          height: 100%;
        }
        .miniBar.health i {
          background: linear-gradient(90deg, var(--company-secondary), var(--company-primary));
        }
        .miniBar.buy.strongBuy i {
          background: #0f8f4e;
        }
        .miniBar.buy.buy i {
          background: #1e8449;
        }
        .miniBar.buy.watch i {
          background: #d4ac0d;
        }
        .miniBar.buy.holdOff i {
          background: #e67e22;
        }
        .miniBar.buy.avoid i {
          background: #c0392b;
        }
        .rating,
        .statusPill {
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          justify-content: center;
          min-width: 108px;
          padding: 9px 12px;
          text-transform: uppercase;
        }
        .strongBuy {
          background: #0f8f4e;
          box-shadow: inset 0 0 0 1px #2ecc71;
        }
        .buy {
          background: #1e8449;
        }
        .watch {
          background: #d4ac0d;
          color: #111;
        }
        .holdOff {
          background: #e67e22;
          color: #111;
        }
        .avoid {
          background: #c0392b;
        }
        .sell {
          background: #922b21;
        }
        .info {
          background: #2471a3;
        }
        .skeleton {
          animation: pulse 1.15s ease-in-out infinite;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
          border-radius: 5px;
          display: block;
          height: 16px;
          width: 84%;
        }
        footer {
          margin-top: 18px;
        }
        @keyframes pulse {
          50% {
            opacity: 0.55;
          }
        }
        @media (max-width: 1100px) {
          .summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .hero {
            align-items: flex-start;
            flex-direction: column;
          }
          .heroActions {
            align-items: flex-start;
          }
        }
        @media (max-width: 720px) {
          .page {
            padding: 16px;
          }
          .summary {
            grid-template-columns: 1fr;
          }
          .progressGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .hero,
          .panelHeader {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

FreedomTerminal.disableLayout = true;

export default FreedomTerminal;
