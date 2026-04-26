// /pages/modules/email/crm/index.js
import React from "react";
import Link from "next/link";
import ICONS from "../../../../components/iconMap";

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
            <div style={styles.iconCircle}>
              {/* Use ICONS.account for CRM icon */}
              {ICONS.account({ size: 48 })}
            </div>

            {/* ✅ Title + Subtitle on LEFT next to icon */}
            <div style={styles.titleStack}>
              <h1 style={styles.bannerTitle}>CRM Dashboard</h1>
              <div style={styles.bannerSubtitle}>
                Manage leads, conversations, pipelines, and customer activity in
                one place
              </div>
            </div>
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
            icon="👥"
            title="Sales Teams"
            text="Set up teams, managers, members, and revenue targets."
            href="/modules/email/crm/teams"
            color="#f97316"
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
            icon="💼"
            title="Deals & Revenue"
            text="Track opportunities, anticipated revenue, and quote progress."
            href="/modules/email/crm/deals"
            color="#f43f5e"
          />

          <Card
            icon="🧾"
            title="Quotations"
            text="Use quotation templates and manage the quotes linked to your leads."
            href="/modules/email/crm/quotes"
            color="#facc15"
          />

          <Card
            icon="📊"
            title="CRM Reports"
            text="Generate forecasting, revenue, team, product, and status reports."
            href="/modules/email/crm/reports"
            color="#06b6d4"
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

  bannerLeft: { display: "flex", alignItems: "center", gap: "14px" },

  // ✅ BIGGER icon: 48px
  iconCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    fontSize: "48px",
    lineHeight: "1",
    background: "rgba(0,0,0,.2)",
    border: "1px solid rgba(255,255,255,.25)",
  },

  // ✅ Title/subtitle stack stays LEFT next to icon (not centered)
  titleStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    lineHeight: 1.05,
  },

  bannerTitle: { fontSize: "48px", fontWeight: 600, margin: 0 },

  // ✅ Subtitle 18px
  bannerSubtitle: {
    fontSize: "18px",
    fontWeight: 400,
    opacity: 0.9,
    marginTop: "6px",
  },

  bannerRight: { display: "flex", alignItems: "center" },
  backBtn: {
    background: "rgba(0,0,0,.2)",
    border: "1px solid rgba(255,255,255,.25)",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
  },
  container: {
    width: "100%",
    maxWidth: "1320px",
    margin: "40px auto",
    padding: "0 20px",
  },
  sectionTitle: { fontSize: "30px", fontWeight: 600, marginBottom: "20px" },

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
  cardTitle: { margin: 0, fontSize: "28px", fontWeight: 500 },
  cardText: { marginTop: "12px", fontSize: "18px", opacity: 0.9 },
  openBtn: {
    textAlign: "center",
    borderRadius: "8px",
    padding: "8px",
    marginTop: "16px",
    fontWeight: 600,
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
