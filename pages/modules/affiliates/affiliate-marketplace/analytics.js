// /pages/modules/affiliates/affiliate-marketplace/analytics.js
// Full replacement with solid banner + correct Next.js Link usage

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { supabase } from "../../../../utils/supabase-client";

export default function AffiliateAnalytics() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("affiliate_sales")
          .select("*");

        if (error) console.error(error.message);
        setRows(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalSales = 0;
    let totalUnits = 0;

    rows.forEach((r) => {
      totalRevenue += Number(r.revenue || 0);
      totalUnits += Number(r.quantity || 0);
      totalSales += 1;
    });

    return { totalRevenue, totalSales, totalUnits };
  }, [rows]);

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      display: "flex",
      justifyContent: "center",
    },
    inner: { width: "100%", maxWidth: 1320 },
    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#ec4899",
      padding: "26px 30px",
      borderRadius: 14,
      marginBottom: 28,
    },
    statsRow: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 18,
      marginBottom: 18,
    },
    statCard: {
      background: "#111827",
      borderRadius: 14,
      padding: "16px 18px",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  };

  return (
    <main style={page.wrap}>
      <div style={page.inner}>
        {/* BANNER */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                background: "rgba(0,0,0,0.25)",
                display: "grid",
                placeItems: "center",
                borderRadius: 14,
              }}
            >
              <BarChart3 size={34} color="#fff" />
            </div>

            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
                Sales & Analytics — Affiliate Products
              </h1>
              <p style={{ fontSize: 16, opacity: 0.95, marginTop: 4 }}>
                Tracking your affiliate commissions and performance metrics
              </p>
            </div>
          </div>

          {/* FIXED Next.js Link Back Button */}
          <Link
            href="/modules/affiliates/affiliate-marketplace"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "2px solid rgba(255,255,255,0.45)",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>
        </div>

        {/* DATA SUMMARY */}
        <div style={page.statsRow}>
          <div style={page.statCard}>
            <h4 style={{ fontSize: 13, opacity: 0.75 }}>TOTAL REVENUE</h4>
            <h2 style={{ fontSize: 26, fontWeight: 900 }}>
              ${summary.totalRevenue.toFixed(2)}
            </h2>
            <p style={{ fontSize: 13, opacity: 0.8 }}>All commissions earned</p>
          </div>

          <div style={page.statCard}>
            <h4 style={{ fontSize: 13, opacity: 0.75 }}>TOTAL SALES</h4>
            <h2 style={{ fontSize: 26, fontWeight: 900 }}>
              {summary.totalSales}
            </h2>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Sales with a commission</p>
          </div>

          <div style={page.statCard}>
            <h4 style={{ fontSize: 13, opacity: 0.75 }}>TOTAL UNITS MOVED</h4>
            <h2 style={{ fontSize: 26, fontWeight: 900 }}>
              {summary.totalUnits}
            </h2>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Products delivered</p>
          </div>
        </div>
      </div>
    </main>
  );
}
