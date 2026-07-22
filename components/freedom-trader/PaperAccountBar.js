import Link from "next/link";
import { useEffect, useState } from "react";

function formatCurrency(value, currency = "AUD") {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)) : "--";
}

export default function PaperAccountBar() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadAccount() {
    setLoading(true);
    try {
      const response = await fetch("/api/freedom-trader/paper-account");
      const data = await response.json().catch(() => null);
      if (data?.ok) setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  const account = snapshot?.account;

  return (
    <section className="paperAccountBar">
      <div className="paperIdentity">
        <strong>{snapshot?.storageMode === "local" ? "LOCAL PAPER-TRADING MODE" : "PAPER TRADING - NO REAL MONEY"}</strong>
        <span>{account ? "Simulated account data" : "No paper account loaded"}</span>
      </div>
      {account ? (
        <div className="paperMetrics">
          <span>Virtual cash <strong>{formatCurrency(account.availableCash, account.currency)}</strong></span>
          <span>Invested <strong>{formatCurrency(account.currentInvestedValue, account.currency)}</strong></span>
          <span>Total <strong>{formatCurrency(account.totalAccountValue, account.currency)}</strong></span>
          <span>Open P/L <strong>{formatCurrency(account.openProfitLoss, account.currency)}</strong></span>
          <span>Daily P/L <strong>{formatCurrency(account.dailyProfitLoss, account.currency)}</strong></span>
        </div>
      ) : (
        <button type="button" onClick={loadAccount} disabled={loading}>{loading ? "Initialising..." : "Initialise Paper Account"}</button>
      )}
      <Link href="/freedom-trader/portfolio">Portfolio</Link>
      <style jsx>{`
        .paperAccountBar{align-items:center;background:rgba(8,14,17,.94);border:1px solid rgba(255,153,0,.26);border-radius:8px;color:#f5f7f8;display:flex;gap:14px;justify-content:space-between;margin:0 auto 18px;max-width:1840px;padding:10px 14px}.paperIdentity{display:grid;gap:2px;min-width:210px}.paperIdentity strong{color:#ffcf7a;font-size:12px;font-weight:950}.paperIdentity span,.paperMetrics span{color:#aebdc4;font-size:12px;font-weight:850}.paperMetrics{display:flex;flex:1;flex-wrap:wrap;gap:10px 18px}.paperMetrics strong{color:#fff;margin-left:4px}a,button{background:rgba(29,155,255,.12);border:1px solid rgba(29,155,255,.34);border-radius:7px;color:#d7efff;cursor:pointer;font-size:12px;font-weight:950;min-height:34px;padding:8px 10px;text-decoration:none;white-space:nowrap}@media(max-width:900px){.paperAccountBar{align-items:flex-start;flex-direction:column}.paperMetrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}}@media(max-width:560px){.paperMetrics{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}
