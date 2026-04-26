// /pages/modules/calendar/analytics.js
// FULL FILE — Calendar Analytics Dashboard (Optimized)
// Read-only. Safe. No Stripe changes.
// All heavy calculations moved to database level.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import ICONS from "../../../components/iconMap";

export default function CalendarAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    revenueThisMonth: 0,
    cancelledBookings: 0,
    topService: null,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;
    const nowISO = new Date().toISOString();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthISO = startOfMonth.toISOString();

    // TOTAL BOOKINGS
    const { count: totalBookings } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // UPCOMING CONFIRMED
    const { count: upcomingBookings } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gt("start_datetime", nowISO);

    // CANCELLED
    const { count: cancelledBookings } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "cancelled");

    // REVENUE THIS MONTH
    const { data: revenueRows } = await supabase
      .from("bookings")
      .select("price")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("start_datetime", startOfMonthISO)
      .not("stripe_session_id", "is", null);

    const revenueThisMonth = (revenueRows || []).reduce(
      (sum, row) => sum + (row.price || 0),
      0
    );

    // TOP SERVICE
    const { data: serviceRows } = await supabase
      .from("bookings")
      .select("service_id")
      .eq("user_id", userId)
      .not("service_id", "is", null);

    let topService = null;

    if (serviceRows && serviceRows.length > 0) {
      const counts = {};
      serviceRows.forEach((r) => {
        counts[r.service_id] = (counts[r.service_id] || 0) + 1;
      });

      topService = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b
      );
    }

    setStats({
      totalBookings: totalBookings || 0,
      upcomingBookings: upcomingBookings || 0,
      revenueThisMonth,
      cancelledBookings: cancelledBookings || 0,
      topService,
    });

    setLoading(false);
  }

  const S = {
    page:        { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 48px", fontFamily: "system-ui,sans-serif" },
    shell:       { maxWidth: 1320, margin: "0 auto" },
    banner:      { maxWidth: 1320, margin: "16px auto 28px", background: "#84cc16", borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
    bannerLeft:  { display: "flex", alignItems: "center", gap: 16 },
    bannerTitle: { fontSize: 48, fontWeight: 600, color: "#fff", margin: 0 },
    bannerSub:   { fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 },
    backBtn:     { fontSize: 18, fontWeight: 600, background: "rgb(0, 0, 0)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" },
    grid:        { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 },
    statCard:    { background: "#161e2b", border: "1px solid #243047", borderTop: "3px solid #84cc16", borderRadius: 16, padding: "22px 20px" },
    statTitle:   { fontSize: 16, color: "#9CA3AF", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 },
    statValue:   { fontSize: 36, fontWeight: 600, color: "#fff" },
  };

  return (
    <div style={S.page}>
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          {ICONS.analytics({ size: 42, color: "#fff" })}
          <div>
            <h1 style={S.bannerTitle}>Calendar Analytics</h1>
            <div style={S.bannerSub}>Booking performance overview</div>
          </div>
        </div>
        <Link href="/modules/calendar/dashboard">
          <button style={S.backBtn}>← Calendar Dashboard</button>
        </Link>
      </div>

      <div style={S.shell}>
        {loading ? (
          <div style={{ fontSize: 16, color: "#6B7280", padding: "40px 0", textAlign: "center" }}>Loading…</div>
        ) : (
          <div style={S.grid}>
            <StatCard S={S} title="Total Bookings"        value={stats.totalBookings} />
            <StatCard S={S} title="Upcoming Confirmed"    value={stats.upcomingBookings} />
            <StatCard S={S} title="Revenue This Month"    value={`$${stats.revenueThisMonth.toFixed(2)}`} />
            <StatCard S={S} title="Cancelled Bookings"    value={stats.cancelledBookings} />
            <StatCard S={S} title="Top Service (ID)"      value={stats.topService || "N/A"} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ S, title, value }) {
  return (
    <div style={S.statCard}>
      <div style={S.statTitle}>{title}</div>
      <div style={S.statValue}>{value}</div>
    </div>
  );
}