import { useRouter } from "next/router";
import { useState } from "react";

export default function AnalyseStockPanel({ compact = false }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState([]);

  async function submit(event) {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;
    setLoading(true);
    setError("");
    setMatches([]);
    try {
      const response = await fetch(`/api/freedom-trader/stock-analysis?query=${encodeURIComponent(search)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Freedom could not find that company or ticker.");
      if (data.ambiguous || data.matches?.length > 1) {
        setMatches(data.matches || []);
        return;
      }
      const symbol = data.resolved?.symbol || data.analysis?.symbol;
      if (!symbol) throw new Error("Freedom could not find that company or ticker.");
      router.push(`/freedom-trader/company/${encodeURIComponent(symbol)}`);
    } catch (err) {
      setError(err.message || "Freedom could not find that company or ticker.");
    } finally {
      setLoading(false);
    }
  }

  function choose(match) {
    router.push(`/freedom-trader/company/${encodeURIComponent(match.symbol)}`);
  }

  return (
    <section className={`analyseStock ${compact ? "compact" : ""}`} aria-label="Analyse a stock">
      <form onSubmit={submit}>
        <label htmlFor={`analyse-stock-${compact ? "compact" : "main"}`}>Analyse a Stock</label>
        <div className="searchRow">
          <input
            id={`analyse-stock-${compact ? "compact" : "main"}`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticker or company name"
            value={query}
          />
          <button type="submit" disabled={loading}>{loading ? "Analysing..." : "Analyse Stock"}</button>
        </div>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {matches.length ? (
        <div className="matches" role="list" aria-label="Choose matching company">
          {matches.map((match) => (
            <button key={`${match.exchange}:${match.symbol}`} onClick={() => choose(match)} type="button">
              <strong>{match.symbol}</strong>
              <span>{match.companyName} / {match.exchange} / {match.currency}</span>
            </button>
          ))}
        </div>
      ) : null}
      <style jsx>{`
        .analyseStock { background: rgba(8,14,17,.94); border: 1px solid rgba(29,155,255,.32); border-radius: 8px; margin: 10px auto 12px; max-width: 1760px; padding: 14px 16px; }
        .analyseStock.compact { padding: 12px 14px; }
        form { align-items: end; display: grid; gap: 10px; grid-template-columns: 220px minmax(280px, 1fr); }
        label { color: #d7efff; font-size: 13px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; }
        .searchRow { display: flex; flex-wrap: wrap; gap: 10px; }
        input { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.16); border-radius: 7px; color: #fff; flex: 1 1 240px; height: 40px; min-width: 0; padding: 0 12px; }
        button { background: rgba(29,155,255,.14); border: 1px solid rgba(29,155,255,.38); border-radius: 7px; color: #d7efff; cursor: pointer; font-weight: 950; min-height: 40px; padding: 0 14px; }
        button:hover, button:focus-visible { background: rgba(29,155,255,.26); border-color: rgba(118,188,255,.7); outline: none; }
        button:disabled { cursor: wait; opacity: .7; }
        .error { color: #ffd8d3; font-weight: 850; margin: 10px 0 0; }
        .matches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .matches button { align-items: center; display: inline-flex; gap: 9px; justify-content: flex-start; }
        .matches span { color: #aebdc4; font-size: 12px; }
        @media (max-width: 680px) {
          form { align-items: stretch; grid-template-columns: 1fr; }
          .searchRow { display: grid; grid-template-columns: 1fr; }
          input, button { width: 100%; }
        }
      `}</style>
    </section>
  );
}
