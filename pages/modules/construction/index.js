// /pages/modules/construction/index.js
// Construction Hub - dashboard linking project tools and Estimate Builder workflows.

import Link from "next/link";
import Head from "next/head";
import { useEffect, useState } from "react";

export default function ConstructionHub() {
  const [estimateCredits, setEstimateCredits] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readCredits = () => {
      if (process.env.NODE_ENV !== "production" && !window.localStorage.getItem("estimate-builder-test-credits-awarded")) {
        const currentCredits = Number(window.localStorage.getItem("estimate-builder-credits") || 0);
        window.localStorage.setItem("estimate-builder-credits", String(currentCredits + 5));
        window.localStorage.setItem("estimate-builder-test-credits-awarded", "true");
      }
      setEstimateCredits(Number(window.localStorage.getItem("estimate-builder-credits") || 0));
    };
    readCredits();
    window.addEventListener("focus", readCredits);
    return () => window.removeEventListener("focus", readCredits);
  }, []);

  return (
    <>
      <Head><title>Projects Hub</title></Head>
      <div style={S.wrap}>
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <span style={S.bannerIcon}>🗂️</span>
            <div>
              <h1 style={S.bannerTitle}>Projects Hub</h1>
              <p style={S.bannerDesc}>
                Manage job boards, schedules, production flow, and estimate jobs from one place.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <button style={S.backBtn}>Back to Dashboard</button>
          </Link>
        </div>

        <section style={S.creditsBox}>
          <div>
            <div style={S.creditsEyebrow}>Estimate credits</div>
            <h2 style={S.creditsTitle}>Buy job credits for the Estimate Builder</h2>
            <p style={S.creditsText}>
              Single job credit is $59.00. Buy 5 and get 10% off per job, or buy 10 and get 15% off per job.
            </p>
          </div>
          <Link href="/modules/estimate-builder/buy-credits" style={{ textDecoration: "none" }}>
            <button style={S.creditsButton}>Buy Credits</button>
          </Link>
        </section>

        <div style={S.cardsRow}>
          <ToolCard
            href="/modules/jobboard"
            accent="#f97316"
            icon="JB"
            title="Job Board"
            description="Track every job or project across its full lifecycle, from quote and kick-off through to completion and handover."
            action="Open Job Board"
          />
          <ToolCard
            href="/modules/gantt"
            accent="#3b82f6"
            icon="GC"
            title="Gantt Charts"
            description="Visual project schedules with phases, milestones and progress tracking for construction or any multi-stage workflow."
            action="Open Gantt Charts"
          />
          <ToolCard
            href="/modules/production"
            accent="#22c55e"
            icon="PF"
            title="Production Flow"
            description="Track each job through procurement steps: quote, sample, order, delivery, install and sign-off."
            action="Open Production Flow"
          />
        </div>

        <section style={S.estimateSection}>
          <div style={S.sectionIntro}>
            <div>
              <div style={S.sectionEyebrow}>Estimate Builder</div>
              <h2 style={S.sectionTitle}>Estimate jobs, registrations and saved files</h2>
            </div>
            <div style={S.planBadge}>Subscription plus per-job workflow</div>
          </div>

          <div style={S.estimateGrid}>
            <ToolCard
              href="/modules/estimate-builder?mode=preview"
              accent="#14b8a6"
              icon="$"
              title="Estimate Builder Preview"
              description="Let users inspect the first half of the estimating workflow before paid module access is required."
              action="Open Preview"
              compact
            />
            <ToolCard
              href="/modules/estimate-builder/register-job"
              accent="#f59e0b"
              icon="+"
              title="Register New Job"
              description="Create a registered estimate job before work starts. This is the step to enforce subscription and per-job billing."
              action="Register Job"
              badge={`${estimateCredits} ${estimateCredits === 1 ? "job" : "jobs"} remaining`}
              compact
            />
            <ToolCard
              href="/modules/estimate-builder?mode=open-job"
              accent="#8b5cf6"
              icon="OP"
              title="Open Existing Job"
              description="Load a saved job estimate or quote file or return to a registered estimate already in progress."
              action="Open Job"
              compact
            />
          </div>
        </section>
      </div>
    </>
  );
}

function ToolCard({ href, accent, icon, title, description, action, badge = "", compact = false }) {
  return (
    <Link href={href} style={{ textDecoration: "none", flex: compact ? "initial" : 1 }}>
      <div
        style={compact ? S.estimateCard : S.card}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = accent;
          event.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = "#1e293b";
          event.currentTarget.style.transform = "none";
        }}
      >
        {badge ? <div style={S.cardBadge}>{badge}</div> : null}
        <div style={{ ...S.cardIconWrap, background: `${accent}14`, border: `1px solid ${accent}30` }}>
          <span style={S.cardEmoji}>{icon}</span>
        </div>
        <h3 style={S.cardTitle}>{title}</h3>
        <p style={S.cardDesc}>{description}</p>
        <div style={{ ...S.cardFooter, background: accent }}>{action}</div>
      </div>
    </Link>
  );
}

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
  creditsBox: {
    width: "100%",
    maxWidth: 1100,
    margin: "-12px 0 28px",
    background: "#0d1522",
    border: "1px solid #f59e0b55",
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  creditsEyebrow: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  creditsTitle: {
    margin: "3px 0 4px",
    color: "#f8fafc",
    fontSize: 20,
  },
  creditsText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
  },
  creditsButton: {
    background: "#f59e0b",
    color: "#111827",
    border: "1px solid #f59e0b",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
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
    fontSize: 30,
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
  },
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
    borderRadius: 12,
    padding: "28px 28px 0",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    cursor: "pointer",
    transition: "border-color 0.15s, transform 0.15s",
    overflow: "hidden",
    minWidth: 280,
  },
  estimateSection: {
    width: "100%",
    maxWidth: 1100,
    marginTop: 28,
    paddingTop: 26,
    borderTop: "1px solid #1e293b",
  },
  sectionIntro: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
  },
  sectionEyebrow: {
    color: "#14b8a6",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: "4px 0 0",
    fontSize: 28,
    lineHeight: 1.2,
    color: "#f8fafc",
  },
  planBadge: {
    border: "1px solid #334155",
    color: "#cbd5e1",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  estimateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 18,
  },
  estimateCard: {
    background: "#0d1522",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "22px 22px 0",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    cursor: "pointer",
    transition: "border-color 0.15s, transform 0.15s",
    overflow: "hidden",
    minHeight: 250,
    position: "relative",
  },
  cardBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  cardEmoji: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 800,
  },
  cardTitle: {
    margin: 0,
    fontSize: 24,
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
    fontWeight: 700,
    color: "#fff",
  },
};
