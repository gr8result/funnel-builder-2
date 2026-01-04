// /pages/modules/affiliates/merchant/commissions.js
// Merchant Commissions & Payouts page — with banner, back button, summary, table

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import ICONS from "../../../../components/iconMap";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState([]);

  useEffect(() => {
    const fetchCommissions = async () => {
      let { data, error } = await supabase
        .from("commissions")
        .select("id, amount, status, created_at, affiliate_id, sale_id");
      if (error) {
        console.error("Error fetching commissions:", error);
        setCommissions([]);
      } else {
        setCommissions(data || []);
      }
    };
    fetchCommissions();
  }, []);

  // Totals for summary
  const total = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const pending = commissions.filter((c) => c.status === "pending").length;
  const paid = commissions.filter((c) => c.status === "paid").length;

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner with back button */}
        <div style={page.banner}>
          <span style={page.bannerIcon}>{ICONS.billing}</span>
          <div>
            <h1 style={page.bannerTitle}>Commissions & Payouts</h1>
            <p style={page.bannerDesc}>
              Track affiliate commissions, statuses and payout history.
            </p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/modules/affiliates/affiliate-marketplace">
              <button style={page.backButton}>← Back</button>
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div style={page.summaryGrid}>
          <div style={{ ...page.summaryCard, borderColor: "#22c55e" }}>
            <h3>Total Earned</h3>
            <p>${total.toFixed(2)} AUD</p>
          </div>
          <div style={{ ...page.summaryCard, borderColor: "#f59e0b" }}>
            <h3>Pending</h3>
            <p>{pending} commissions</p>
          </div>
          <div style={{ ...page.summaryCard, borderColor: "#3b82f6" }}>
            <h3>Paid</h3>
            <p>{paid} commissions</p>
          </div>
        </div>

        {/* Table */}
        {commissions.length > 0 ? (
          <table style={page.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Affiliate</th>
                <th>Sale</th>
                <th>Amount (AUD)</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td>{c.id.slice(0, 8)}</td>
                  <td>{c.affiliate_id || "Unknown"}</td>
                  <td>{c.sale_id || "-"}</td>
                  <td>${c.amount}</td>
                  <td>{c.status}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#aaa", marginTop: 20 }}>
            No commissions found yet.
          </p>
        )}
      </div>
    </div>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    display: "flex",
    justifyContent: "center",
  },
  inner: { width: "100%", maxWidth: 1320 },
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "#6366f1",
    borderRadius: 12,
    marginBottom: 24,
  },
  bannerIcon: { fontSize: 28 },
  bannerTitle: { fontSize: 20, fontWeight: 800, margin: 0 },
  bannerDesc: { margin: 0, opacity: 0.8 },
  backButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 6,
    background: "#374151",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    background: "#111827",
    border: "2px solid",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 16,
    fontSize: 14,
  },
};
