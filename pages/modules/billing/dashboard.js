// /pages/modules/billing/dashboard.js
// Billing Dashboard — Live account, payment, and subscription data
// Dark theme + same card layout as the rest of the app

import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";

export default function BillingDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [a, p, s] = await Promise.all([
          supabase.from("accounts").select("*").order("created_at", { ascending: false }),
          supabase.from("payments").select("*").order("created_at", { ascending: false }),
          supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        ]);
        if (a.error) console.warn("Accounts:", a.error.message);
        if (p.error) console.warn("Payments:", p.error.message);
        if (s.error) console.warn("Subscriptions:", s.error.message);
        setAccounts(a.data || []);
        setPayments(p.data || []);
        setSubs(s.data || []);
      } catch (err) {
        console.error("Error loading billing data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const activeSubs = subs.filter((s) => s.status === "active").length;

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      display: "flex",
      justifyContent: "center",
    },
    inner: { width: "100%", maxWidth: 1320 },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 18,
      marginBottom: 28,
    },
    card: {
      background: "#111927",
      border: "2px solid #1e293b",
      borderRadius: 14,
      padding: 20,
      transition: "all 0.25s ease",
    },
    banner: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "#0ea5e9",
      padding: "14px 18px",
      borderRadius: 14,
      marginBottom: 30,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      background: "#111927",
      borderRadius: 12,
      overflow: "hidden",
    },
    th: {
      textAlign: "left",
      padding: "10px 14px",
      background: "#1e293b",
      borderBottom: "2px solid #334155",
      fontWeight: 600,
      color: "#93c5fd",
    },
    td: {
      padding: "10px 14px",
      borderBottom: "1px solid #1e293b",
    },
  };

  if (loading) return <div style={page.wrap}><div style={page.inner}>Loading billing data...</div></div>;

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ fontSize: 42 }}>{ICONS.billing}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Billing & Subscriptions</h1>
            <p style={{ opacity: 0.85 }}>Live payment, subscription and account overview</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={page.grid}>
          <div style={page.card}>
            <h2>Total Accounts</h2>
            <p style={{ fontSize: 32, fontWeight: 700 }}>{accounts.length}</p>
          </div>
          <div style={page.card}>
            <h2>Active Subscriptions</h2>
            <p style={{ fontSize: 32, fontWeight: 700 }}>{activeSubs}</p>
          </div>
          <div style={page.card}>
            <h2>Total Revenue ($)</h2>
            <p style={{ fontSize: 32, fontWeight: 700 }}>{totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        {/* Payments Table */}
        <h2 style={{ marginTop: 30, marginBottom: 10 }}>Recent Payments</h2>
        <table style={page.table}>
          <thead>
            <tr>
              <th style={page.th}>Email</th>
              <th style={page.th}>Amount</th>
              <th style={page.th}>Status</th>
              <th style={page.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan="4" style={{ ...page.td, textAlign: "center", opacity: 0.7 }}>No payments yet</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id}>
                <td style={page.td}>{p.email}</td>
                <td style={page.td}>${Number(p.amount || 0).toFixed(2)}</td>
                <td style={page.td}>{p.status}</td>
                <td style={page.td}>{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Subscriptions Table */}
        <h2 style={{ marginTop: 40, marginBottom: 10 }}>Subscriptions</h2>
        <table style={page.table}>
          <thead>
            <tr>
              <th style={page.th}>Email</th>
              <th style={page.th}>Plan</th>
              <th style={page.th}>Status</th>
              <th style={page.th}>Period End</th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 && (
              <tr><td colSpan="4" style={{ ...page.td, textAlign: "center", opacity: 0.7 }}>No subscriptions yet</td></tr>
            )}
            {subs.map((s) => (
              <tr key={s.id}>
                <td style={page.td}>{s.customer_email}</td>
                <td style={page.td}>{s.plan}</td>
                <td style={page.td}>{s.status}</td>
                <td style={page.td}>
                  {s.current_period_end
                    ? new Date(s.current_period_end).toLocaleDateString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
