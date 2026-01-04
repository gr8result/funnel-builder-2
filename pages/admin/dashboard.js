// /pages/admin/dashboard.js
// Real-time Admin Dashboard — live Supabase subscription + stats + recent applications.

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../utils/supabase-client";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load all dashboard data
  const loadStats = async () => {
    setLoading(true);
    const [{ count: total }, { count: approved }, { count: pending }, { data: recentData }] =
      await Promise.all([
        supabase.from("accounts").select("*", { count: "exact", head: true }),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("approved", true),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("approved", false),
        supabase
          .from("accounts")
          .select("id, name, email, business_name, created_at, approved")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
    setStats({ total, approved, pending });
    setRecent(recentData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();

    // ✅ Real-time updates whenever accounts table changes
    const channel = supabase
      .channel("accounts_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => loadStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Admin Dashboard | Gr8 Result Digital Solutions</title>
      </Head>
      <div className="wrap">
        <div className="header">
          <h1>Admin Dashboard</h1>
          <div className="nav-buttons">
            <Link href="/admin/user-approvals" className="btn">
              🧾 User Approvals
            </Link>
            <Link href="/dev/spreadsheet" className="btn purple">
              📊 Developer Dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <p>Loading dashboard data...</p>
        ) : (
          <>
            <div className="stats">
              <div className="card blue"><h3>Total Accounts</h3><p>{stats.total}</p></div>
              <div className="card green"><h3>Approved</h3><p>{stats.approved}</p></div>
              <div className="card yellow"><h3>Pending Approval</h3><p>{stats.pending}</p></div>
            </div>

            <div className="section">
              <h2>Recent Applications</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Company</th><th>Created</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan="5">No recent applications.</td></tr>
                  ) : (
                    recent.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name || "—"}</td>
                        <td>{r.email}</td>
                        <td>{r.business_name || "—"}</td>
                        <td>{new Date(r.created_at).toLocaleDateString("en-AU")}</td>
                        <td>
                          {r.approved
                            ? <span className="pill green">Approved</span>
                            : <span className="pill yellow">Pending</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .wrap { padding:30px; background:#0c121a; color:#fff; min-height:100vh;}
        .header {background:#f97316; padding:14px 20px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;}
        .nav-buttons{display:flex;gap:10px;}
        .btn{background:#111827;color:#fff;text-decoration:none;padding:8px 14px;border:1px solid #fff;border-radius:6px;font-weight:700;transition:0.2s;}
        .btn:hover{background:#1e293b;}
        .btn.purple{border-color:#8b5cf6;}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:32px;}
        .card{background:#111827;border-radius:10px;padding:20px;text-align:center;border:2px solid transparent;}
        .blue{border-color:#3b82f6;}.green{border-color:#22c55e;}.yellow{border-color:#facc15;}
        .card h3{font-size:16px;font-weight:700;opacity:0.85;} .card p{font-size:28px;font-weight:900;margin:8px 0 0;}
        .section h2{font-size:18px;font-weight:800;margin-bottom:12px;}
        table{width:100%;border-collapse:collapse;}
        th,td{padding:10px;border-bottom:1px solid #1f2937;text-align:left;}
        th{background:#111827;font-weight:700;opacity:0.9;}
        td{background:#0f172a;}
        .pill{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;}
        .pill.green{background:rgba(34,197,94,0.15);color:#86efac;border:1px solid #16a34a;}
        .pill.yellow{background:rgba(250,204,21,0.15);color:#fde047;border:1px solid #facc15;}
      `}</style>
    </>
  );
}
