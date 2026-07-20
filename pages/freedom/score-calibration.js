import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_CALIBRATION } from "../../lib/freedom-terminal/adaptiveBuyScore";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-terminal-unlocked";

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "--";
}

export async function getServerSideProps() {
  try {
    const { createHash } = await import("crypto");
    const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
    const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");
    return { props: { passwordHash } };
  } catch (error) {
    console.error("Freedom score calibration load failed:", error);
    return { props: { passwordHash: "" } };
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
        <title>Score Calibration | Freedom Investment</title>
      </Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Admin</span>
        <h1>Score Calibration</h1>
        <p>Enter the Freedom Investment password to review scoring performance.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Calibration</button>
      </form>
      <style jsx>{`
        .gateScreen {
          align-items: center;
          background: #05080b;
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
          font-size: 38px;
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
          height: 46px;
          margin-top: 22px;
          padding: 0 14px;
          width: 100%;
        }
        small {
          color: #ff9a88;
          display: block;
          font-weight: 750;
          margin-top: 10px;
        }
        button {
          background: #d4af37;
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

export default function ScoreCalibration({ passwordHash }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [review, setReview] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_CALIBRATION);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    async function loadCalibration() {
      try {
        setLoading(true);
        const response = await fetch("/api/freedom/score-history");
        const data = await response.json().catch(() => null);
        setHistory(data?.history || []);
        setReview(data?.review || null);
        setWeights(data?.calibration || DEFAULT_CALIBRATION);
        setMessage(data?.message || "");
      } catch (error) {
        console.error("Freedom calibration load error:", error);
        setMessage("Score history is temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    loadCalibration();
  }, [unlocked]);

  async function saveWeights(event) {
    event.preventDefault();
    try {
      setMessage("");
      const response = await fetch("/api/freedom/score-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights, notes: "Manual score calibration" }),
      });
      const data = await response.json().catch(() => null);
      setMessage(data?.stored ? "Calibration saved." : data?.message || "Calibration saved locally for this review.");
    } catch (error) {
      console.error("Freedom calibration save error:", error);
      setMessage("Calibration could not be saved right now.");
    }
  }

  function updateWeight(key, value) {
    setWeights((current) => ({ ...current, [key]: Number(value) }));
  }

  if (checkingStorage) return <div className="center">Opening score calibration...</div>;
  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page">
      <Head>
        <title>Score Calibration | Freedom Investment</title>
      </Head>

      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong><span className="platformIcon" aria-hidden="true">{"\u{1F4C8}"}</span>Freedom Investment</strong>
        <span>Long-Term Wealth & Portfolio Management</span>
      </section>

      <header className="hero">
        <div>
          <Link href="/freedom">Back to Freedom Investment</Link>
          <span>Private Admin</span>
          <h1>Score Calibration</h1>
          <p>Review which evidence categories are predicting winners and tune the model over time.</p>
        </div>
      </header>

      {message ? <section className="notice">{message}</section> : null}

      <section className="summary">
        <article>
          <span>Recommendations Stored</span>
          <strong>{loading ? "..." : review?.recommendationCount ?? history.length}</strong>
        </article>
        <article>
          <span>Reviewed Outcomes</span>
          <strong>{loading ? "..." : review?.reviewedCount ?? 0}</strong>
        </article>
        <article>
          <span>Accuracy</span>
          <strong>{formatPercent(review?.accuracy)}</strong>
        </article>
        <article>
          <span>Average Return</span>
          <strong>{formatPercent(review?.averageReturn)}</strong>
        </article>
        <article>
          <span>Win Rate</span>
          <strong>{formatPercent(review?.winRate)}</strong>
        </article>
      </section>

      <main className="grid">
        <section className="panel">
          <span>Performance Review</span>
          <h2>Learning Status</h2>
          <p>{review?.predictedWinners || "Needs six months of score history before review."}</p>
          <div className="split">
            <article>
              <h3>Overestimated Companies</h3>
              {(review?.overestimated || []).length ? review.overestimated.map((row) => <p key={row.id}>{row.symbol} scored {row.buy_score} and later declined.</p>) : <p>No overestimation evidence yet.</p>}
            </article>
            <article>
              <h3>Underestimated Companies</h3>
              {(review?.underestimated || []).length ? review.underestimated.map((row) => <p key={row.id}>{row.symbol} scored {row.buy_score} and later outperformed.</p>) : <p>No underestimation evidence yet.</p>}
            </article>
          </div>
        </section>

        <form className="panel" onSubmit={saveWeights}>
          <span>Weighting Adjustments</span>
          <h2>Adaptive Score Weights</h2>
          <p>Weights are stored for calibration review. The current engine still keeps the required 100-point category structure.</p>
          <div className="weights">
            {Object.entries(weights).map(([key, value]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, " $1")}
                <input max="40" min="0" onChange={(event) => updateWeight(key, event.target.value)} type="number" value={value} />
              </label>
            ))}
          </div>
          <button type="submit">Save Calibration</button>
        </form>
      </main>

      <footer>Private research tool. Not financial advice.</footer>

      <style jsx>{`
        .page,
        .center {
          background: #06110d;
          color: #f5f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
          padding: 96px 28px 28px;
        }
        .center {
          align-items: center;
          display: flex;
          justify-content: center;
        }
        .hero,
        .notice,
        .summary,
        .grid,
        footer {
          margin-left: auto;
          margin-right: auto;
          max-width: 1760px;
        }
        .platformBanner {
          align-items: center;
          background: #0b8f55;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
          display: flex;
          gap: 14px;
          justify-content: space-between;
          left: 0;
          padding: 14px 28px;
          position: fixed;
          right: 0;
          top: 0;
          z-index: 100;
        }
        .platformBanner strong {
          align-items: center;
          color: #fff;
          display: inline-flex;
          font-size: clamp(24px, 2.6vw, 34px);
          font-weight: 950;
          gap: 10px;
        }
        .platformBanner span {
          color: #fff;
          font-size: clamp(14px, 1.4vw, 18px);
          font-weight: 900;
          margin: 0;
          text-transform: none;
        }
        .platformBanner .platformIcon {
          color: #d4af37;
          font-size: 0.9em;
          line-height: 1;
        }
        .hero,
        .panel,
        .notice,
        .summary article {
          background: rgba(6, 17, 13, 0.94);
          border: 1px solid rgba(16, 185, 129, 0.16);
          border-radius: 8px;
          padding: 24px;
        }
        a,
        span {
          color: #f4d675;
          display: inline-block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        a {
          text-decoration: none;
        }
        h1,
        h2,
        h3,
        p {
          margin: 0;
        }
        h1 {
          font-size: 44px;
        }
        h2 {
          font-size: 24px;
        }
        h3 {
          font-size: 15px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        p {
          color: #dfe7eb;
          line-height: 1.55;
          margin-top: 8px;
        }
        .notice {
          color: #ffe3a4;
          margin-top: 18px;
        }
        .summary {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          margin-top: 18px;
        }
        .summary strong {
          color: #fff;
          display: block;
          font-size: 30px;
          font-weight: 950;
        }
        .grid {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
          margin-top: 18px;
        }
        .split {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 18px;
        }
        .split article {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
        }
        .weights {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 18px;
        }
        label {
          color: #aebdc4;
          display: flex;
          flex-direction: column;
          font-size: 12px;
          font-weight: 900;
          gap: 8px;
          text-transform: uppercase;
        }
        input {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 7px;
          color: #f5f7f8;
          font: inherit;
          padding: 12px;
        }
        button {
          background: #d4af37;
          border: 0;
          border-radius: 7px;
          color: #061014;
          cursor: pointer;
          font-weight: 950;
          margin-top: 18px;
          min-height: 44px;
          padding: 0 18px;
        }
        footer {
          color: #aebdc4;
          font-size: 13px;
          margin-top: 18px;
        }
        @media (max-width: 1100px) {
          .summary,
          .grid,
          .split {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .page {
            padding: 88px 16px 16px;
          }
          .platformBanner {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

ScoreCalibration.disableLayout = true;
