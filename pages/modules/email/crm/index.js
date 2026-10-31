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
              <span style={{ fontSize: 38, lineHeight: 1 }}>🗂️</span>
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
        <h2 style={styles.sectionTitle}>Builder CRM</h2>
        <div style={styles.journey} aria-label="Customer journey">
          {["New Enquiry", "Consultation", "Quote Sent", "Accepted", "Project Created"].map((step, i, all) => (
            <React.Fragment key={step}>
              <span style={styles.journeyStep}>{step}</span>
              {i < all.length - 1 ? <span aria-hidden="true">→</span> : null}
            </React.Fragment>
          ))}
        </div>

        <div style={styles.grid3}>
          <Card
            icon="📈"
            title="Enquiry Pipeline"
            text="Track enquiries from first contact through to an accepted quote."
            href="/modules/email/crm/pipelines"
            color="#22c55e"
          />

          <Card
            icon="🗓️"
            title="Activities & Follow-ups"
            text="Stay on top of calls, site meetings, and follow-ups."
            href="/modules/email/crm/tasks"
            color="#3b82f6"
          />

          <Card
            icon="📊"
            title="Reports"
            text="Pipeline, revenue, team, product, and status reports."
            href="/modules/email/crm/reports"
            color="#06b6d4"
          />

          <Card
            icon="🗂️"
            title="Messaging Analytics"
            text="Email and SMS performance across your contacts."
            href="/modules/email/crm/workspace"
            color="#a855f7"
          />
        </div>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Additional Sales Tools</h2>
        <p style={styles.sectionNote}>
          Optional tools for product, e-commerce and service sales. Construction quoting and project
          financials stay in the Quotation Builder and Project Estimate.
        </p>

        <div style={styles.grid3}>
          <Card
            icon="🧾"
            title="Sales Quotations"
            text="Quotation templates for non-construction sales linked to your leads."
            href="/modules/email/crm/quotes"
            color="#facc15"
          />

          <Card
            icon="💼"
            title="Deals & Revenue"
            text="Track opportunities and anticipated revenue for product and service sales."
            href="/modules/email/crm/deals"
            color="#f43f5e"
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
  sectionNote: { margin: "-8px 0 20px", fontSize: "16px", opacity: 0.8 },
  divider: { border: 0, borderTop: "1px solid #263346", margin: "40px 0 28px" },
  journey: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    marginBottom: "24px",
    fontSize: "16px",
  },
  journeyStep: {
    padding: "6px 14px",
    borderRadius: "999px",
    border: "1px solid #263346",
    background: "#0f1622",
    fontWeight: 600,
  },

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
