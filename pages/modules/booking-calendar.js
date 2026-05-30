// /pages/modules/booking-calendar/index.js
// Booking Calendar — placeholder with correct banner, icon, sizing & back button

import Head from "next/head";
import Link from "next/link";
import ICONS from "../../components/iconMap";

export default function BookingCalendar() {
  return (
    <>
      <Head>
        <title>Booking Calendar | GR8 RESULT Digital Solutions</title>
      </Head>

      <main style={styles.wrap}>
        {/* Banner */}
        <div style={styles.banner}>
          <div style={styles.left}>
            <div style={styles.iconBox}><span style={{ fontSize: 32, lineHeight: 1 }}>📅</span></div>
            <div>
              <h1 style={styles.title}>Booking Calendar</h1>
              <p style={styles.desc}>Slots, buffers, reminders & reschedule flow.</p>
            </div>
          </div>

          {/* Back button */}
          <Link href="/dashboard">
            <button style={styles.backBtn}>← Back</button>
          </Link>
        </div>

        {/* Coming Soon */}
        <div style={styles.card}>
          <h2 style={styles.comingSoon}>🚧 Coming Soon</h2>
          <p style={styles.text}>
            Full booking & availability scheduling will be available here. Includes:
            <br />• Calendar & time slot control
            <br />• Automated confirmations and reminders
            <br />• Reschedule & cancellation workflows
            <br />• Payment integrations (Stripe / PayPal)
          </p>
        </div>
      </main>
    </>
  );
}

/* ---------- STYLES ---------- */
const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  banner: {
    width: "100%",
    maxWidth: 1320,
    background: "#84cc16",
    borderRadius: 14,
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 600,
    marginBottom: 26,
  },

  left: { display: "flex", alignItems: "center", gap: 14 },

  iconBox: {
    background: "rgba(0,0,0,0.25)",
    padding: 10,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 24, margin: 0 },
  desc: { fontSize: 16, margin: 0, opacity: 0.9, fontWeight: 400 },

  backBtn: {
    background: "#0c121a",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.25)",
    borderRadius: 8,
    padding: "8px 20px",
    fontWeight: 600,
    cursor: "pointer",
  },

  card: {
    background: "#111827",
    borderRadius: 14,
    padding: 28,
    border: "1px solid #84cc16",
    maxWidth: 900,
    textAlign: "center",
  },

  comingSoon: { fontSize: 22, marginBottom: 12 },
  text: { fontSize: 16, opacity: 0.9, lineHeight: 1.65 },
};
