// /pages/modules/construction/index.js
// Construction Hub — dashboard linking Job Board and Gantt Charts

import Link from "next/link";
import Head from "next/head";

export default function ConstructionHub() {
  return (
    <>
      <Head><title>Projects Hub</title></Head>
      <div style={S.wrap}>

        {/* ── Banner ──────────────────────────────────────────────────── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <span style={S.bannerIcon}>🗂️</span>
            <div>
              <h1 style={S.bannerTitle}>Projects Hub</h1>
              <p style={S.bannerDesc}>
                Manage your Job Board and work schedules from one place.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <button style={S.backBtn}>← Back to Dashboard</button>
          </Link>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div style={S.cardsRow}>

          {/* Job Board */}
          <Link href="/modules/jobboard" style={{ textDecoration: "none", flex: 1 }}>
            <div style={S.card} onMouseEnter={e => { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ ...S.cardIconWrap, background: "#f9731614", border: "1px solid #f9731630" }}>
                <span style={S.cardEmoji}>🗂️</span>
              </div>
              <h2 style={S.cardTitle}>Job Board</h2>
              <p style={S.cardDesc}>
                Track every job or project across its full lifecycle — from quote and
                kick-off through to completion and handover. Sticky-note task columns
                for every stage.
              </p>
              <div style={{ ...S.cardFooter, background: "#f97316" }}>
                Open Job Board →
              </div>
            </div>
          </Link>

          {/* Gantt Charts */}
          <Link href="/modules/gantt" style={{ textDecoration: "none", flex: 1 }}>
            <div style={S.card} onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ ...S.cardIconWrap, background: "#3b82f614", border: "1px solid #3b82f630" }}>
                <span style={S.cardEmoji}>📊</span>
              </div>
              <h2 style={S.cardTitle}>Gantt Charts</h2>
              <p style={S.cardDesc}>
                Visual project schedules with phases, milestones and progress tracking.
                Works for construction, production planning, or any multi-stage workflow.
              </p>
              <div style={{ ...S.cardFooter, background: "#3b82f6" }}>
                Open Gantt Charts →
              </div>
            </div>
          </Link>

          {/* Production Flow */}
          <Link href="/modules/production" style={{ textDecoration: "none", flex: 1 }}>
            <div style={S.card} onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ ...S.cardIconWrap, background: "#22c55e14", border: "1px solid #22c55e30" }}>
                <span style={S.cardEmoji}>🏭</span>
              </div>
              <h2 style={S.cardTitle}>Production Flow</h2>
              <p style={S.cardDesc}>
                Track every job through procurement steps — quote, sample, order, delivery,
                install and sign-off. A sticky-note grid board for production management.
              </p>
              <div style={{ ...S.cardFooter, background: "#22c55e" }}>
                Open Production Flow →
              </div>
            </div>
          </Link>

        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "34px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "inherit",
  },

  // Banner
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    padding: "24px 28px",
    borderRadius: 16,
    marginBottom: 32,
    width: "100%",
    maxWidth: 1100,
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  bannerIcon: {
    fontSize: 48,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    width: 72,
    height: 72,
    flexShrink: 0,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.1,
  },
  bannerDesc: {
    margin: "4px 0 0",
    fontSize: 18,
    opacity: 0.92,
  },
  backBtn: {
    background: "rgba(15,23,42,0.85)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
    padding: "9px 18px",
    fontSize: 18,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  },

  // Cards row
  cardsRow: {
    display: "flex",
    gap: 24,
    width: "100%",
    maxWidth: 1100,
    flexWrap: "wrap",
  },
  card: {
    background: "#0d1522",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: "28px 28px 0",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    cursor: "pointer",
    transition: "border-color 0.15s, transform 0.15s",
    overflow: "hidden",
    minWidth: 280,
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  cardEmoji: {
    fontSize: 32,
    lineHeight: 1,
  },
  cardTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  cardDesc: {
    margin: 0,
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 1.65,
    flexGrow: 1,
  },
  cardFooter: {
    marginTop: 8,
    marginLeft: -28,
    marginRight: -28,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "0.02em",
  },
};
