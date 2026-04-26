// /pages/modules/calendar/dashboard.js

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import ICONS from "../../../components/iconMap";

export default function CalendarDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [username, setUsername] = useState(null);
  const [calendarTier, setCalendarTier] = useState(null);

  useEffect(() => {
    init();
  }, []);

  function parseLegacyCalendarStatus(status) {
    if (typeof status !== "string" || !status) {
      return { hasAccess: false, tier: null };
    }
    if (status === "active") {
      return { hasAccess: true, tier: "calendar-starter" };
    }
    if (status.startsWith("active:")) {
      const tier = status.slice("active:".length) || null;
      if (tier && tier.startsWith("calendar-")) {
        return { hasAccess: true, tier };
      }
      return { hasAccess: true, tier: "calendar-starter" };
    }
    return { hasAccess: false, tier: null };
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("calendar_plan_tier")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, calendar_subscription_status")
      .eq("user_id", userId)
      .maybeSingle();

    const account = accountRows?.[0] || null;
    const parsedLegacy = parseLegacyCalendarStatus(profile?.calendar_subscription_status);
    const hasCalendarPlan = !!account?.calendar_plan_tier;
    const hasLegacyCalendarAccess = parsedLegacy.hasAccess;
    const hasCalendarAccess = hasCalendarPlan || hasLegacyCalendarAccess;

    if (accountError && !hasLegacyCalendarAccess) {
      setLoading(false);
      return;
    }

    if (!hasCalendarPlan) {
      if (!hasCalendarAccess) {
        window.location.href = "/billing?module=calendar";
        return;
      }
    }

    if (!hasCalendarAccess) {
      window.location.href = "/billing?module=calendar";
      return;
    }

    setSubscriptionStatus("active");
    setUsername(profile?.username || null);
    const resolvedTier = account?.calendar_plan_tier || parsedLegacy.tier;
    setCalendarTier(resolvedTier);

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("start_datetime", { ascending: true });

    setBookings(data || []);
    setLoading(false);
  }

  const now = new Date();

  const upcoming = bookings.filter(b =>
    new Date(b.start_datetime) > now && b.status !== "cancelled"
  );

  const today = bookings.filter(b =>
    new Date(b.start_datetime).toDateString() === now.toDateString()
  );

  const week = bookings.filter(b => {
    const diff = (new Date(b.start_datetime) - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const revenue = bookings
    .filter(b => b.status === "confirmed")
    .reduce((sum, b) => sum + (b.amount_paid || 0), 0);

  const formatTierLabel = (tier) => {
    if (!tier) return "No plan";
    return tier
      .replace("calendar-", "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const styles = {
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
      justifyContent: "space-between",
      alignItems: "center",
      background: "#84cc16",
      padding: "22px 28px",
      borderRadius: 16,
      marginBottom: 30,
    },
    title: { fontSize: 48, fontWeight: 600 },
    navBtn: {
      background: "#111827",
      border: "1px solid #333",
      padding: "10px 18px",
      borderRadius: 8,
      fontSize: 18,
      cursor: "pointer",
      color: "#fff",
    },
    statusBanner: {
      background: subscriptionStatus === "active" ? "#14532d" : "#7f1d1d",
      padding: 16,
      borderRadius: 12,
      marginBottom: 30,
      border: "1px solid #243047",
    },
    statusMeta: {
      marginTop: 10,
      fontSize: 16,
      color: "#d1fae5",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    grid4: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 20,
      marginBottom: 30,
    },
    statCard: {
      background: "#161e2b",
      padding: 24,
      borderRadius: 14,
      border: "1px solid #243047",
    },
    statTitle: { fontSize: 16, opacity: 0.7 },
    statValue: { fontSize: 34, fontWeight: 600, marginTop: 10 },
    navGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      gap: 14,
      marginBottom: 30,
    },
    navLink: {
      textDecoration: "none",
      display: "flex",
      height: "100%",
    },
    navCard: {
      background: "#161e2b",
      border: "1px solid #243047",
      borderRadius: 14,
      padding: "20px 18px",
      cursor: "pointer",
      textAlign: "left",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
    },
    navIcon: { fontSize: 26, marginBottom: 4 },
    navLabel: { fontSize: 16, fontWeight: 600, color: "#fff" },
    navDesc: { fontSize: 16, color: "#6B7280", lineHeight: 1.4, flex: 1 },
    section: {
      background: "#161e2b",
      padding: 24,
      borderRadius: 14,
      border: "1px solid #243047",
    },
    bookingRow: {
      padding: 16,
      borderBottom: "1px solid #243047",
      display: "flex",
      justifyContent: "space-between",
      fontSize: 16,
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>

        <div style={styles.banner}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {ICONS.calendar({ size: 40, color: "#fff" })}
            <div>
              <div style={styles.title}>Calendar Dashboard</div>
              <div style={{ fontSize: 18 }}>Manage bookings, availability and revenue.</div>
            </div>
          </div>
          <Link href="/dashboard">
            <button style={styles.navBtn}>← Back</button>
          </Link>
        </div>

        <div style={styles.statusBanner}>
          {subscriptionStatus === "active" ? (
            <>
              <div>Subscription Active</div>
              <div style={styles.statusMeta}>
                <span style={{ fontSize: 16 }}>Current Tier: <strong>{formatTierLabel(calendarTier)}</strong></span>
                <Link href="/modules/billing/calendar-plans">
                  <button style={{ background: "#059669", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    Manage Plan
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <span>Subscription Inactive — Upgrade Required</span>
              <Link href="/modules/billing/calendar-plans">
                <button style={{ background: "#ef4444", border: "none", color: "#fff", padding: "10px 22px", borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
                  Upgrade Now →
                </button>
              </Link>
            </div>
          )}
        </div>

        <div style={styles.grid4}>
          <div style={styles.statCard}>
            <div style={styles.statTitle}>Upcoming</div>
            <div style={styles.statValue}>{upcoming.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statTitle}>Today</div>
            <div style={styles.statValue}>{today.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statTitle}>Next 7 Days</div>
            <div style={styles.statValue}>{week.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statTitle}>Revenue</div>
            <div style={styles.statValue}>
              ${(revenue / 100).toFixed(2)}
            </div>
          </div>
        </div>

        <div style={styles.navGrid}>
          {[
            { icon: '📋', label: 'All Bookings',      desc: 'View, search and manage all booking records',          href: '/modules/calendar/bookings' },
            { icon: '🎁', label: 'Services',           desc: 'Create and manage your bookable services',             href: '/modules/calendar/services' },
            { icon: '⚙️', label: 'Settings & Availability', desc: 'Set working hours and configure booking rules',     href: '/modules/calendar/settings' },
            { icon: '📊', label: 'Analytics',         desc: 'Revenue, booking trends and performance stats',        href: '/modules/calendar/analytics' },
            { icon: '💳', label: 'Stripe Pricing',    desc: 'Create Stripe prices for paid booking services',       href: '/modules/calendar/create-stripe-price' },
            { icon: '🌐', label: 'Booking Page',      desc: 'Customise your public page and copy share links',      href: '/modules/calendar/booking-page' },
          ].filter(Boolean).map(n => (
            <Link key={n.label} href={n.href} style={styles.navLink}>
              <div style={styles.navCard}>
                <div style={styles.navIcon}>{n.icon}</div>
                <div style={styles.navLabel}>{n.label}</div>
                <div style={styles.navDesc}>{n.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Prominent booking URL banner */}
        {username && (
          <div style={{ background: "#161e2b", border: "1px solid #243047", borderRadius: 14, padding: "20px 24px", marginBottom: 30, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ fontSize: 16, color: "#9CA3AF", marginBottom: 6 }}>Your public booking URL — share this in ads, posts, and your bio</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#84cc16", fontFamily: "monospace" }}>
                {(process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com")}/u/{username}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com"}/u/${username}`)}
                style={{ padding: "10px 22px", background: "#22c55e", border: "none", borderRadius: 9, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
              >
                Copy Link
              </button>
              <a href={`/u/${username}`} target="_blank" rel="noopener noreferrer">
                <button style={{ padding: "10px 22px", background: "#374151", border: "1px solid #4b5563", borderRadius: 9, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                  Preview ↗
                </button>
              </a>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <h3 style={{ marginBottom: 20 }}>Upcoming Bookings</h3>
          {loading ? (
            <div>Loading...</div>
          ) : upcoming.length === 0 ? (
            <div>No upcoming bookings.</div>
          ) : (
            upcoming.slice(0, 8).map(b => (
              <div key={b.id} style={styles.bookingRow}>
                <div>
                  <strong>{b.client_name}</strong><br />
                  {new Date(b.start_datetime).toLocaleString()}
                </div>
                <div>{b.status}</div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}