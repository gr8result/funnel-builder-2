// /pages/modules/construction/index.js
// Construction Hub - dashboard linking project tools and Estimate Builder workflows.

import Link from "next/link";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { estimateJobsRemainingLabel, isDeveloperAccount } from "../../../lib/estimate-builder/developerBypass";

export default function ConstructionHub() {
  const { user } = useAuth();
  const [estimateCredits, setEstimateCredits] = useState(0);
  const [recentJobs, setRecentJobs] = useState([]);
  const developerBypass = isDeveloperAccount(user?.email);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readRecent = () => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem("gr8-job-recent-files") || "[]");
        setRecentJobs(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
      } catch {
        setRecentJobs([]);
      }
    };
    readRecent();
    window.addEventListener("focus", readRecent);
    window.addEventListener("storage", readRecent);
    return () => {
      window.removeEventListener("focus", readRecent);
      window.removeEventListener("storage", readRecent);
    };
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
            <h2 style={S.creditsTitle}>{developerBypass ? "Unlimited developer estimate access" : "Buy job credits for the Estimate Builder"}</h2>
            <p style={S.creditsText}>
              {developerBypass
                ? "DEV ONLY / OWNER TESTING BYPASS: support@gr8result.com can register estimate jobs without credits or payment."
                : "Single job credit is $59.00. Buy 5 and get 10% off per job, or buy 10 and get 15% off per job."}
            </p>
          </div>
          <Link href={developerBypass ? "/modules/estimate-builder/register-job" : "/modules/estimate-builder/buy-credits"} style={{ textDecoration: "none" }}>
            <button style={S.creditsButton}>{developerBypass ? "Register New Job" : "Buy Credits"}</button>
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
              href="/modules/estimate-builder"
              accent="#14b8a6"
              icon="$"
              title="Builder Dashboard"
              description="Open the main builder workspace for estimating, takeoff, BOQ, quotations, procurement, selections, documents and project controls."
              action="Open Builder Dashboard"
              compact
            />
            <ToolCard
              href="/modules/estimate-builder/register-job"
              accent="#f59e0b"
              icon="+"
              title="Register New Job"
              description="Create a registered estimate job before work starts. This is the step to enforce subscription and per-job billing."
              action="Register Job"
              badge={estimateJobsRemainingLabel(user?.email, estimateCredits)}
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

          <div style={S.recentWrap}>
            <div style={S.recentTitle}>Recent Jobs</div>
            {!recentJobs.length ? (
              <div style={S.recentEmpty}>No recent files yet</div>
            ) : (
              <div style={S.recentList}>
                {recentJobs.slice(0, 10).map((job) => (
                  <Link
                    key={job.id}
                    href={`/modules/estimate-builder?mode=open-recent&recentId=${encodeURIComponent(job.id)}`}
                    style={S.recentRow}
                  >
                    <strong style={S.recentName}>{job.jobName || "Untitled Job"}</strong>
                    <span style={S.recentMeta}>{job.clientName || "No client"}</span>
                    <span style={S.recentMeta}>{job.lastModified ? new Date(job.lastModified).toLocaleString() : "Unknown"}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function ToolCard({ href, accent, icon, title, description, action, badge = "", compact = false }) {
  return (
    <Link href={href} style={compact ? S.estimateCardLink : S.cardLink}>
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
        <div style={{ ...(compact ? S.estimateCardFooter : S.cardFooter), background: accent }}>{action}</div>
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
  cardLink: {
    textDecoration: "none",
    flex: 1,
    display: "flex",
    minWidth: 280,
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
    alignItems: "stretch",
  },
  estimateCardLink: {
    textDecoration: "none",
    display: "flex",
    height: "100%",
    minWidth: 0,
  },
  recentWrap: {
    marginTop: 18,
    border: "1px solid #1e293b",
    borderRadius: 12,
    background: "#0d1522",
    padding: 14,
  },
  recentTitle: {
    color: "#e2e8f0",
    fontWeight: 800,
    marginBottom: 10,
  },
  recentEmpty: {
    color: "#94a3b8",
    fontSize: 14,
  },
  recentList: {
    display: "grid",
    gap: 8,
  },
  recentRow: {
    border: "1px solid #334155",
    borderRadius: 8,
    background: "#0f172a",
    padding: "10px 12px",
    display: "grid",
    gap: 2,
    textDecoration: "none",
  },
  recentName: {
    color: "#f8fafc",
    fontSize: 14,
  },
  recentMeta: {
    color: "#94a3b8",
    fontSize: 12,
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
    minHeight: 286,
    height: "100%",
    width: "100%",
    boxSizing: "border-box",
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
    marginTop: "auto",
    marginLeft: -28,
    marginRight: -28,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
  },
  estimateCardFooter: {
    marginTop: "auto",
    marginLeft: -22,
    marginRight: -22,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
  },
};
