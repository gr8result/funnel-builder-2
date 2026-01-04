// /pages/modules/email/crm/index.js
import React from "react";
import Link from "next/link";

export default function CRMDashboard() {
  const CRM_COLOUR = "#ec4899";
  const CRM_BORDER = "#264516";

  return (
    <main style={styles.main}>
      {/* === Banner === */}
      <div style={styles.bannerWrap}>
        <div
          style={{
            ...styles.banner,
            background: `linear-gradient(175deg, ${CRM_COLOUR} 0%, ${shade(
              CRM_COLOUR,
              -12
            )} 100%)`,
            border: `1px solid ${CRM_BORDER}`,
          }}
        >
          <div style={styles.bannerLeft}>
            <div style={styles.iconCircle}>📊</div>
            <h1 style={styles.bannerTitle}>CRM Dashboard</h1>
          </div>

          <div style={styles.bannerRight}>
            <Link href="/modules/email" style={styles.backBtn}>
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* === Page Content (Cards Grid) === */}
      <div style={styles.container}>
        <h2 style={styles.sectionTitle}>CRM Modules</h2>

        <div style={styles.grid3}>
          <Card
            icon="📥"
            title="Subscribers"
            text="Manage all subscribers, lists, and segmentation."
            href="/modules/email/lists"
            color="#38bdf8"
          />

          <Card
            icon="🗓️"
            title="Tasks & Reminders"
            text="Stay organised with calls, meetings, and follow-ups."
            href="/modules/email/crm/tasks"
            color="#3b82f6"
          />

          <Card
            icon="📈"
            title="CRM Pipeline"
            text="Manage leads and move them between stages."
            href="/modules/email/crm/pipelines"
            color="#22c55e"
          />

          <Card
            icon="🗂️"
            title="CRM Workspace"
            text="View and control multiple pipelines across your business."
            href="/modules/email/crm/workspace"
            color="#a855f7"
          />

          <Card
            icon="📞"
            title="Calls & Voicemails"
            text="Review inbound calls, listen to recordings, and tidy your call log"
            href="/modules/email/crm/calls"
            color="#ec4899"
          />

          {/* ✅ NEW */}
          <Card
            icon="💬"
            title="SMS Marketing"
            text="Send SMS broadcasts to a list, use templates, and track delivery."
            href="/modules/email/crm/sms-marketing"
            color="#14b8a6"
          />
        </div>
      </div>
    </main>
  );
}

/* ---------- Card Component ---------- */
function Card({ icon, title, text, href, color }) {
  return (
    <Link href={href} style={{ ...styles.card, borderColor: color }}>
      <div style={styles.cardHeader}>
        <span style={{ fontSize: "36px" }}>{icon}</span>
        <h3 style={styles.cardTitle}>{title}</h3>
      </div>
      <p style={styles.cardText}>{text}</p>
      <div
        style={{
          ...styles.openBtn,
          background: color,
        }}
      >
        Open
      </div>
    </Link>
  );
}

/* ---------- Styles ---------- */
const styles = {
  main: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
  },
  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: "24px",
  },
  banner: {
    width: "1320px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderRadius: "16px",
    boxShadow: "0 8px 28px rgba(0,0,0,.35)",
  },
  bannerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  iconCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    fontSize: "20px",
    background: "rgba(0,0,0,.2)",
    border: "1px solid rgba(255,255,255,.25)",
  },
  bannerTitle: { fontSize: "22px", fontWeight: 900, margin: 0 },
  bannerRight: { display: "flex", alignItems: "center" },
  backBtn: {
    background: "rgba(0,0,0,.2)",
    border: "1px solid rgba(255,255,255,.25)",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },
  container: {
    width: "100%",
    maxWidth: "1320px",
    margin: "40px auto",
    padding: "0 20px",
  },
  sectionTitle: { fontSize: "20px", fontWeight: 900, marginBottom: "20px" },

  /* 3 wide layout */
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "22px",
  },

  card: {
    background: "#0f1622",
    border: "2px solid #263346",
    borderRadius: "16px",
    padding: "24px",
    textDecoration: "none",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: { display: "flex", gap: "12px", alignItems: "center" },
  cardTitle: { margin: 0, fontSize: "18px", fontWeight: 800 },
  cardText: { marginTop: "12px", fontSize: "15px", opacity: 0.9 },
  openBtn: {
    textAlign: "center",
    borderRadius: "8px",
    padding: "8px",
    marginTop: "16px",
    fontWeight: 700,
  },
};

function shade(hex, pct) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const t = pct < 0 ? 0 : 255,
    p = Math.abs(pct) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b)
    .toString(16)
    .slice(1)}`;
}
