// /pages/modules/email/index.js
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import PRICING from "../../../data/pricing";

function classifyEmailStatus(row) {
  const st = String(row?.status || "").toLowerCase();
  const le = String(row?.last_event || "").toLowerCase();
  if (["delivered", "opened", "clicked"].includes(st)) return "delivered";
  if (le === "delivered" || le === "open" || le === "click") return "delivered";
  if (row?.bounced_at || le === "bounce" || le === "dropped") return "bounced";
  if (row?.unsubscribed || le === "unsubscribe") return "unsubscribed";
  return "sent";
}

function buildQuickReport(rows = [], usagePercent = 0) {
  const total = rows.length;
  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;
  let unsubscribed = 0;

  for (const row of rows) {
    const status = classifyEmailStatus(row);
    if (["delivered", "sent"].includes(status)) delivered += 1;
    if (Number(row?.open_count || 0) > 0) opened += 1;
    if (Number(row?.click_count || 0) > 0) clicked += 1;
    if (status === "bounced") bounced += 1;
    if (status === "unsubscribed") unsubscribed += 1;
  }

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const bouncedPct = pct(bounced);
  const deliveredPct = pct(delivered);

  let health = "Active";
  let tone = "good";
  if (!total) {
    health = "No activity";
    tone = "neutral";
  } else if (usagePercent >= 95 || bouncedPct >= 10) {
    health = "Warning";
    tone = "warning";
  } else if (usagePercent >= 80 || bouncedPct >= 5) {
    health = "Watch";
    tone = "watch";
  }

  return {
    sent: total,
    received: deliveredPct,
    opened: pct(opened),
    clicked: pct(clicked),
    bounced: bouncedPct,
    unsubscribed: pct(unsubscribed),
    health,
    tone,
  };
}

export default function EmailMarketingHub() {
  const [account, setAccount] = useState(null);
  const [usage, setUsage] = useState({ sent: 0, limit: 0, percentage: 0 });
  const [demoUsagePercent, setDemoUsagePercent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickReport, setQuickReport] = useState(() => buildQuickReport([]));

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("demoEmailUsage");
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      setDemoUsagePercent(parsed);
    }
  }, []);

  async function loadAccount() {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const { data: accountRows, error: accountErr } = await supabase
        .from("accounts")
        .select("email_plan, email_plan_price, email_plan_tier, email_emails_sent_month")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (accountErr) throw accountErr;

      setAccount(accountRows?.[0] || null);

      let currentUsagePercent = 0;

      const token = session?.session?.access_token;
      if (token) {
        const usageRes = await fetch("/api/usage/check-limits?check=email", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (usageRes.ok) {
          const usageJson = await usageRes.json();
          const emailUsage = usageJson?.stats?.email;
          if (emailUsage) {
            const numericLimit =
              typeof emailUsage.limit === "number" ? emailUsage.limit : 0;
            currentUsagePercent = Number(emailUsage.percentage) || 0;
            setUsage({
              sent: Number(emailUsage.sent) || 0,
              limit: numericLimit,
              percentage: currentUsagePercent,
            });
          }
        }
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: emailRows, error: emailErr } = await supabase
        .from("email_sends")
        .select("status, last_event, open_count, click_count, unsubscribed, bounced_at, created_at")
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(3000);

      if (emailErr) {
        console.warn("Quick email report load error:", emailErr.message || emailErr);
      } else {
        setQuickReport(buildQuickReport(emailRows || [], currentUsagePercent));
      }
    } catch (err) {
      console.error("Error loading account:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const resolvedEmailPlanTier = account?.email_plan_tier || null;
  const resolvedEmailPlanName =
    (resolvedEmailPlanTier ? PRICING[resolvedEmailPlanTier]?.name : null) ||
    account?.email_plan ||
    null;
  const resolvedEmailPlanPrice =
    (resolvedEmailPlanTier && typeof PRICING[resolvedEmailPlanTier]?.price === "number"
      ? PRICING[resolvedEmailPlanTier].price
      : null) ?? account?.email_plan_price ?? null;

  const fallbackLimit =
    resolvedEmailPlanTier && typeof PRICING[resolvedEmailPlanTier]?.limits?.monthlyEmails === "number"
      ? PRICING[resolvedEmailPlanTier].limits.monthlyEmails
      : 0;
  const sentCount = usage.sent || Number(account?.email_emails_sent_month) || 0;
  const limitCount = usage.limit || fallbackLimit;
  const usagePercent =
    limitCount > 0 ? Math.min(100, Math.round((sentCount / limitCount) * 100)) : 0;

  const displayLimit = demoUsagePercent !== null
    ? (limitCount > 0 ? limitCount : 10000)
    : limitCount;
  const displaySent = demoUsagePercent !== null
    ? Math.round((displayLimit * demoUsagePercent) / 100)
    : sentCount;
  const displayPercent = demoUsagePercent !== null ? demoUsagePercent : usagePercent;
  const usageStage =
    displayPercent >= 100
      ? {
          tone: "critical",
          title: "Hard Stop (100%)",
          text: "Sending is blocked until you upgrade your email plan.",
        }
      : displayPercent >= 95
      ? {
          tone: "critical",
          title: "Critical Warning (95%+)",
          text: "You are close to hard stop at 100%. Upgrade now to avoid interruptions.",
        }
      : displayPercent >= 80
      ? {
          tone: "warning",
          title: "Usage Notice (80%+)",
          text: "Sending is still active, but your allowance is running low.",
        }
      : null;

  return (
    <>
      <Head>
        <title>Email Marketing — Dashboard</title>
      </Head>

      <main className="wrap">
        <div className="container">
          {/* ---------- Banner ---------- */}
          <div className="banner">
            <div className="banner-left">
              <div className="banner-icon" aria-hidden>
                <span style={{ fontSize: 38, lineHeight: 1 }}>📧</span>
              </div>
              <div className="banner-text">
                <h1 className="banner-title">Email Marketing</h1>
                <p className="banner-desc">Broadcasts, autoresponders, lists.</p>
              </div>
            </div>

            <Link href="/dashboard">
              <button className="back-btn" type="button">
                ← Back
              </button>
            </Link>
          </div>

          {/* ---------- Current Plan Banner ---------- */}
          <div className="plan-banner">
            {loading ? (
              <p>Loading plan details...</p>
            ) : resolvedEmailPlanName ? (
              <div className="plan-inner">
                <div>
                  <h2 className="plan-title">Current Email Plan</h2>
                  <p className="plan-desc">
                    <strong>{resolvedEmailPlanName}</strong>{" "}
                    {resolvedEmailPlanPrice !== null
                      ? `— $${resolvedEmailPlanPrice}/month`
                      : "(Custom Plan)"}
                  </p>
                </div>
                <Link href="/modules/billing/email-plans">
                  <button className="upgrade-btn" type="button">
                    Upgrade Plan
                  </button>
                </Link>
              </div>
            ) : (
              <div className="plan-inner">
                <div>
                  <h2 className="plan-title">No Email Plan Selected</h2>
                  <p className="plan-desc">
                    Choose a plan to begin sending campaigns.
                  </p>
                </div>
                <Link href="/modules/billing/email-plans">
                  <button className="upgrade-btn" type="button">
                    Select Plan
                  </button>
                </Link>
              </div>
            )}

            <div className="usage-wrap">
              <div className="usage-head">
                <span className="usage-label">Monthly Email Usage</span>
                <span className="usage-value">
                  {displaySent.toLocaleString()} / {displayLimit > 0 ? displayLimit.toLocaleString() : "No limit yet"}
                </span>
              </div>
              <div className="usage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayPercent}>
                <div className="usage-fill" style={{ width: `${displayPercent}%` }} />
                <div className="usage-marker" aria-hidden="true" />
                <span className="usage-marker-label" aria-hidden="true">80%</span>
              </div>
              <div className="usage-scale">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
              {usageStage && (
                <div className={`usage-alert ${usageStage.tone}`}>
                  <span>
                    <strong>{usageStage.title}</strong> {usageStage.text}
                  </span>
                  <Link href="/modules/billing/email-plans">
                    <button className="usage-upgrade-btn" type="button">Upgrade Email Plan</button>
                  </Link>
                </div>
              )}
              {!resolvedEmailPlanName && (
                <p className="usage-note">Select a plan to unlock your monthly sending allowance.</p>
              )}
            </div>
          </div>

          <div className="quick-report">
            <div className="quick-report-head">
              <div>
                <h3 className="quick-report-title">Combined Email Snapshot</h3>
                <p className="quick-report-sub">This month at a glance across broadcasts, campaigns, autoresponders and automations.</p>
              </div>
              <Link href="/modules/email/reports" className="quick-report-link">
                Open full report →
              </Link>
            </div>

            <div className="quick-strip">
              <QuickMetricCell kind="count" label="Emails Sent" value={quickReport.sent} accent="#a855f7" icon="✉️" />
              <QuickMetricCell label="Received" value={quickReport.received} accent="#14b8a6" />
              <QuickMetricCell label="Opened" value={quickReport.opened} accent="#3b82f6" />
              <QuickMetricCell label="Clicks" value={quickReport.clicked} accent="#8b5cf6" />
              <QuickMetricCell label="Bounced" value={quickReport.bounced} accent="#ef4444" />
              <QuickMetricCell label="Unsubscribed" value={quickReport.unsubscribed} accent="#f59e0b" />
              <QuickStatusCell label="Status" value={quickReport.health} tone={quickReport.tone} />
            </div>
          </div>

          {/* ---------- Cards ---------- */}
          <section className="block">
            <div className="grid">
              <Card
                colour="#f59e0b"
                icon="📢"
                title="Broadcasts"
                blurb="Send one-off emails to your lists."
                actions={[
                  { href: "/modules/email/broadcast", label: "Create New" },
                  { href: "/modules/email/broadcast/view",
                    label: "Open Past Broadcasts",
                  },
                ]}
              />
              <Card
                colour="#a855f7"
                icon="⏱️"
                title="Autoresponders"
                blurb="Timed sequences and follow-ups."
                actions={[
                  { href: "/modules/email/autoresponders/open", label: "Open" },
                  { href: "/modules/email/autoresponders", label: "Create" },
                ]}
              />
              <Card
                colour="#14b8a6"
                icon="📣"
                title="campaigns"
                blurb="Manage all your active and scheduled campaigns."
                actions={[
                  { href: "/modules/email/campaigns/new", label: "New campaigns" },
                  { href: "/modules/email/campaigns", label: "Open Existing" },

                ]}
              />
              <Card
                colour="#f97316"
                icon="⚙️"
                title="Automation"
                blurb="Workflows, triggers and actions."
                actions={[
                  { href: "/modules/email/automation", label: "Open" },

                ]}
              />
              <Card
                colour="#06b6d4"
                icon="👥"
                title="Lists"
                blurb="Audiences, segments & growth."
                actions={[{ href: "/modules/email/lists", label: "Open Create, Edit" }]}
              />
              <Card
                colour="#3b82f6"
                icon="🖼️"
                title="Templates"
                blurb="Design library for campaigns."
                actions={[
                  {
                    href: "/modules/email/templates/select",
                    label: "Open  or Create an email",
                  },
                ]}

              />
              <Card
                colour="#0a5c38"
                icon="💌"
                title="Email Editor"
                blurb="Design beautiful emails with the drag-and-drop block editor."
                actions={[
                  { href: "/modules/email/editor?id=blank", label: "New Email" },
                  { href: "/modules/email/templates/select", label: "From Template" },
                ]}
              />
              <Card
                colour="#10b981"
                icon="📈"
                title="Reports & Analytics"
                blurb="Track opens, clicks and conversions."
                actions={[{ href: "/modules/email/reports", label: "Open" }]}
              />
            </div>
          </section>
        </div>
      </main>

      {/* ---------- Styles ---------- */}
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          color: #fff;
          padding: 24px 12px 36px;
        }
        .container {
          max-width: 1320px;
          margin: 0 auto;
        }

        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #facc15;
          padding: 18px 22px;
          border-radius: 14px;
          margin: 0 auto 20px;
          border: 2px solid #eab308;
          color: #1a1f29;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .banner-icon {
          width: 69px;
          height: 69px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.14);
        }

        .banner-title {
          margin: 0;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.05;
        }

        .banner-desc {
          margin: 4px 0 0 0;
          font-size: 18px;
          opacity: 0.95;
        }

        .back-btn {
          background: rgba(2, 6, 23, 0.75);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
        }

        .plan-banner {
          background: #1f2937;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 16px 20px;
          margin: 0 auto 26px;
        }

        .plan-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .plan-title {
          margin: 0;
          font-size: 36px;
          font-weight: 600;
          color: #60a5fa;
        }

        .plan-desc {
          margin: 4px 0 0 0;
          font-size: 18px;
          opacity: 0.9;
        }

        .upgrade-btn {
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 18px;
        }

        .usage-wrap {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #334155;
        }

        .usage-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .usage-label {
          font-size: 16px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .usage-value {
          font-size: 15px;
          color: #e2e8f0;
        }

        .usage-bar {
          position: relative;
          width: 100%;
          height: 28px;
          border-radius: 999px;
          background: #0f172a;
          border: 1px solid #334155;
          overflow: hidden;
        }

        .usage-fill {
          position: relative;
          z-index: 1;
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #f59e0b, #ef4444);
          transition: width 0.3s ease;
        }

        .usage-marker {
          position: absolute;
          left: 80%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #f59e0b;
          z-index: 2;
          opacity: 0.95;
        }

        .usage-marker-label {
          position: absolute;
          left: calc(80% - 18px);
          top: -18px;
          z-index: 3;
          font-size: 11px;
          color: #f59e0b;
          font-weight: 700;
        }

        .usage-scale {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          color: #94a3b8;
          font-size: 12px;
        }

        .usage-note {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .usage-alert {
          margin-top: 10px;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .usage-alert.warning {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.45);
          color: #fde68a;
        }

        .usage-alert.critical {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fecaca;
        }

        .usage-upgrade-btn {
          background: #facc15;
          color: #111827;
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .quick-report {
          margin: 0 auto 18px;
        }

        .quick-report-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .quick-report-title {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          color: #f8fafc;
        }

        .quick-report-sub {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .quick-report-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          text-decoration: none;
          background: #0f172a;
          border: 1px solid #334155;
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 700;
        }

        .quick-strip {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        @media (max-width: 1180px) {
          .quick-strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .quick-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 980px) {
          .grid {
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
}

function QuickMetricCell({ label, value, accent = "#22c55e", kind = "ring", icon = "•" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="metric-cell">
      {kind === "count" ? (
        <div className="metric-count-wrap">
          <div className="metric-icon">{icon}</div>
          <div>
            <div className="metric-big">{Number(value || 0).toLocaleString()}</div>
            <div className="metric-label">{label}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="metric-ring" style={{ background: `conic-gradient(${accent} 0 ${pct}%, #dbe4f0 ${pct}% 100%)` }}>
            <div className="metric-ring-inner">{pct}%</div>
          </div>
          <div className="metric-label centre">{label}</div>
        </>
      )}

      <style jsx>{`
        .metric-cell {
          min-height: 82px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #f8fafc;
          border-right: 1px solid #dbe4f0;
          color: #475569;
        }
        .metric-count-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .metric-icon {
          font-size: 28px;
          line-height: 1;
        }
        .metric-big {
          font-size: 28px;
          font-weight: 800;
          color: #7c3aed;
          line-height: 1;
        }
        .metric-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-top: 4px;
        }
        .metric-label.centre {
          margin-top: 0;
          text-align: center;
        }
        .metric-ring {
          width: 50px;
          height: 50px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .metric-ring-inner {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: #fff;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          color: #475569;
        }
      `}</style>
    </div>
  );
}

function QuickStatusCell({ label, value, tone = "good" }) {
  return (
    <div className={`status-cell ${tone}`}>
      <div className="status-label">{label}</div>
      <div className="status-pill">{value}</div>

      <style jsx>{`
        .status-cell {
          min-height: 82px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #f8fafc;
          color: #475569;
        }
        .status-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }
        .status-pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
          background: #dcfce7;
          color: #15803d;
        }
        .status-cell.watch .status-pill {
          background: #fef3c7;
          color: #b45309;
        }
        .status-cell.warning .status-pill {
          background: #fee2e2;
          color: #b91c1c;
        }
        .status-cell.neutral .status-pill {
          background: #e2e8f0;
          color: #475569;
        }
      `}</style>
    </div>
  );
}

/* ---------- Card ---------- */
function Card({ colour, icon, title, blurb, actions = [] }) {
  return (
    <article className="card">
      <div className="icon">{icon}</div>
      <div className="body">
        <h3 className="heading">{title}</h3>
        <p className="blurb">{blurb}</p>
        <div className="actions">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className="btn">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .card {
          display: flex;
          align-items: center;
          gap: 14px;
          border-radius: 18px;
          background: #1a1f29;
          border: 2px solid ${colour};
          transition: all 0.25s ease;
          padding: 14px;
          color: #fff;
          min-height: 92px;
        }
        .card:hover {
          background: ${colour};
          color: #fff;
        }
        .icon {
          font-size: 48px;
        }
        .heading {
          margin: 0 0 2px;
          font-weight: 700;
          font-size: 22px;
        }
        .blurb {
          margin: 0 0 8px;
          opacity: 0.95;
          font-size: 18px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 28px;
          line-height: 28px;
          padding: 0 8px;
          border-radius: 9px;
          background: rgba(0, 0, 0, 0.18);
          color: #fff;
          text-decoration: none;
          border: 2px solid rgba(255, 255, 255, 0.22);
          font-weight: 600;
          font-size: 18px;
        }
        .card:hover .btn {
          background: rgba(0, 0, 0, 0.25);
          border-color: #fff;
        }
      `}</style>
    </article>
  );
}

/* ---------- Icon ---------- */
function Icon({ name, size = 48 }) {
  const stroke = "#111827"; // dark stroke reads better on yellow
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "mail":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="20" height="14" rx="2" />
          <polyline points="3 7 12 13 21 7" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
