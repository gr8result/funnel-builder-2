// /pages/modules/affiliates/vendor/manage-products/performance-reports.js 
// ✅ Vendor Sales Performance Dashboard
// Tracks vendor sales, revenue, and performance.

import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../../../../utils/supabase-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Link from "next/link";

export default function VendorPerformanceReports() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    avgSale: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const totalRevenue = data.reduce(
          (sum, s) => sum + Number(s.amount || 0),
          0
        );
        const totalSales = data.length;
        const avgSale = totalRevenue / totalSales;

        const grouped = {};
        data.forEach((s) => {
          const date = new Date(s.created_at).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "short",
          });
          grouped[date] = (grouped[date] || 0) + Number(s.amount || 0);
        });

        const chartReady = Object.entries(grouped).map(([date, amount]) => ({
          date,
          amount,
        }));

        setStats({ totalRevenue, totalSales, avgSale });
        setChartData(chartReady);
        setSales(data);
      } else {
        setStats({ totalRevenue: 0, totalSales: 0, avgSale: 0 });
      }
    } catch (err) {
      console.error("Error loading sales:", err);
    } finally {
      setLoading(false);
    }
  }

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
    inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },

    // 🔥 Updated banner to match main dashboard style
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f97316",
      borderRadius: 14,
      padding: "26px 30px",
      marginBottom: 26,
    },

    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 18,
      marginBottom: 36,
    },
    statCard: {
      background: "#111827",
      border: "1px solid #f97316",
      borderRadius: 12,
      padding: 16,
      textAlign: "center",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 20,
    },
    th: {
      textAlign: "left",
      padding: "10px",
      background: "#1f2937",
      borderBottom: "2px solid #f97316",
    },
    td: {
      padding: "10px",
      borderBottom: "1px solid #2d3748",
    },
  };

  return (
    <>
      <Head>
        <title>Vendor Performance Reports | GR8 RESULT</title>
      </Head>
      <div style={page.wrap}>
        <div style={page.inner}>
          {/* 🔶 Banner with icon + back button */}
          <div style={page.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Icon box – same bar chart icon style as main dashboard */}
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.25)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <BarChartIcon size={34} color="#fff" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: 28,
                    margin: 0,
                    fontWeight: 900,
                  }}
                >
                  Vendor Performance Reports
                </h1>
                <p
                  style={{
                    fontSize: 15,
                    opacity: 0.9,
                    margin: "4px 0 0 0",
                  }}
                >
                  Track your sales, revenue, and affiliate performance.
                </p>
              </div>
            </div>

            {/* Back button to Affiliate Marketplace */}
            <Link href="/modules/affiliates/affiliate-marketplace">
              <button
                style={{
                  background: "rgba(0,0,0,0.25)",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.45)",
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </Link>
          </div>

          {loading ? (
            <p>Loading performance data...</p>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={page.statGrid}>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 14, opacity: 0.8 }}>Total Revenue</h2>
                  <p style={{ fontSize: 26, fontWeight: 800 }}>
                    ${stats.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 14, opacity: 0.8 }}>Total Sales</h2>
                  <p style={{ fontSize: 26, fontWeight: 800 }}>
                    {stats.totalSales}
                  </p>
                </div>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 14, opacity: 0.8 }}>Average Sale</h2>
                  <p style={{ fontSize: 26, fontWeight: 800 }}>
                    ${stats.avgSale.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Line Chart */}
              <div
                style={{
                  background: "#111827",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 30,
                  border: "1px solid #f97316",
                }}
              >
                <h2 style={{ marginBottom: 10, fontSize: 16 }}>
                  Revenue (Last 30 Days)
                </h2>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                      <XAxis dataKey="date" stroke="#ccc" />
                      <YAxis stroke="#ccc" />
                      <Tooltip
                        formatter={(val) => [`$${val.toFixed(2)}`, "Revenue"]}
                        labelStyle={{ color: "#fff" }}
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #f97316",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#f97316"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No sales recorded in the last 30 days.</p>
                )}
              </div>

              {/* Sales Table */}
              <div
                style={{
                  background: "#111827",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #f97316",
                }}
              >
                <h2 style={{ marginBottom: 10, fontSize: 16 }}>Recent Sales</h2>
                {sales.length > 0 ? (
                  <table style={page.table}>
                    <thead>
                      <tr>
                        <th style={page.th}>Date</th>
                        <th style={page.th}>Amount</th>
                        <th style={page.th}>Currency</th>
                        <th style={page.th}>Link ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td style={page.td}>
                            {new Date(s.created_at).toLocaleDateString(
                              "en-AU"
                            )}
                          </td>
                          <td style={page.td}>
                            ${Number(s.amount).toFixed(2)}
                          </td>
                          <td style={page.td}>{s.currency || "AUD"}</td>
                          <td style={page.td}>
                            {s.link_id?.substring(0, 8) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No sales found.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* Local bar chart icon – matches main dashboard style */
function BarChartIcon({ size = 24, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="19" x2="20" y2="19" />
      <rect x="6" y="13" width="2" height="6" />
      <rect x="10" y="9" width="2" height="10" />
      <rect x="14" y="5" width="2" height="14" />
    </svg>
  );
}
