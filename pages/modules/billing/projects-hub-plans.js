// /pages/modules/billing/projects-hub-plans.js
// Projects Hub tier selection — replaces the old separate Job Board & Gantt Charts plan pages

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

const TIER_ORDER  = ["projects-hub-starter", "projects-hub-growth", "projects-hub-pro", "projects-hub-agency"];
const TIER_PRICES = {
  "projects-hub-starter": 35,
  "projects-hub-growth":  59,
  "projects-hub-pro":     99,
  "projects-hub-agency":  159,
};

export default function ProjectsHubPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const asParam = (v) => (typeof v === "string" ? v : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const carry = (key) => next?.[key] || asParam(router.query[key]);
    const keys = ["basePlan","emailPlan","smsPlan","calendarPlan","socialPlan","crmPlan","funnelPlan","websitePlan","projectsHubPlan"];
    keys.forEach((k) => { const v = carry(k); if (v) params.set(k, v); });
    const q = params.toString();
    return q ? `/billing?${q}` : "/billing";
  };

  const handleSelectPlan = (plan) => {
    if (!user) { alert("Please log in to select a plan."); return; }
    router.push(buildBillingUrl({ projectsHubPlan: plan.id }));
  };

  // ── Delta pricing ─────────────────────────────────────────────────────
  const basePlanId  = asParam(router.query.basePlan) || null;
  const purchasedId = asParam(router.query.projectsHubPlan) || null;
  const includedTier = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.projectsHub : null;
  const includedId   = includedTier?.tierId || null;

  function higherTier(a, b) {
    return (TIER_ORDER.indexOf(a ?? TIER_ORDER[0]) >= TIER_ORDER.indexOf(b ?? TIER_ORDER[0])) ? a : b;
  }
  const currentTierId    = higherTier(includedId, purchasedId) || null;
  const currentTierPrice = TIER_PRICES[currentTierId] ?? 0;

  function getDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const delta = plan.price - currentTierPrice;
    if (TIER_ORDER.indexOf(plan.id) < TIER_ORDER.indexOf(currentTierId)) return "Downgrade";
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }

  function getButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    if (TIER_ORDER.indexOf(plan.id) < TIER_ORDER.indexOf(currentTierId)) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
  }

  const basePlanLabel = { starter:"Starter", growth:"Growth", scale:"Scale", professional:"Professional" }[basePlanId] || null;
  const includedFriendlyTier = {
    "projects-hub-starter": "Starter (3 jobs · 5 projects · 2 users)",
    "projects-hub-growth":  "Growth (15 jobs · 20 projects · dependencies)",
    "projects-hub-pro":     "Scale (unlimited · resource allocation · critical path)",
    "projects-hub-agency":  "Professional (unlimited · 25 users · budget tracking)",
  }[includedId] || null;
  // ──────────────────────────────────────────────────────────────────────

  const plans = [
    {
      id: "projects-hub-starter",
      name: "Starter",
      price: 35,
      color: "#6366f1",
      tagline: "Job tracking + Gantt for solo operators",
      features: [
        { label: "Active jobs",           value: "3" },
        { label: "Projects (Gantt)",      value: "5" },
        { label: "Tasks",                 value: "50" },
        { label: "Team members",          value: "2" },
        { label: "Kanban board",          value: "✓" },
        { label: "Gantt chart view",      value: "✓" },
        { label: "Milestones",            value: "✓" },
        { label: "Time tracking",         value: "—" },
        { label: "Dependencies",          value: "—" },
        { label: "Resource allocation",   value: "—" },
        { label: "Budget tracking",       value: "—" },
      ],
    },
    {
      id: "projects-hub-growth",
      name: "Growth",
      price: 59,
      color: "#22c55e",
      tagline: "Expanding teams with multi-project tracking",
      features: [
        { label: "Active jobs",           value: "15" },
        { label: "Projects (Gantt)",      value: "20" },
        { label: "Tasks",                 value: "Unlimited" },
        { label: "Team members",          value: "5" },
        { label: "Kanban board",          value: "✓" },
        { label: "Gantt chart view",      value: "✓" },
        { label: "Milestones",            value: "✓" },
        { label: "Time tracking",         value: "✓" },
        { label: "Dependencies",          value: "✓" },
        { label: "Resource allocation",   value: "—" },
        { label: "Budget tracking",       value: "—" },
      ],
    },
    {
      id: "projects-hub-pro",
      name: "Scale",
      price: 99,
      color: "#f59e0b",
      recommended: true,
      tagline: "Full project ops for established businesses",
      features: [
        { label: "Active jobs",           value: "Unlimited" },
        { label: "Projects (Gantt)",      value: "Unlimited" },
        { label: "Tasks",                 value: "Unlimited" },
        { label: "Team members",          value: "15" },
        { label: "Kanban board",          value: "✓" },
        { label: "Gantt chart view",      value: "✓" },
        { label: "Milestones",            value: "✓" },
        { label: "Time tracking",         value: "✓" },
        { label: "Dependencies",          value: "✓" },
        { label: "Resource allocation",   value: "✓" },
        { label: "Budget tracking",       value: "✓" },
      ],
    },
    {
      id: "projects-hub-agency",
      name: "Professional",
      price: 159,
      color: "#7c3aed",
      tagline: "Full-scale project ops for large teams and agencies",
      features: [
        { label: "Active jobs",           value: "Unlimited" },
        { label: "Projects (Gantt)",      value: "Unlimited" },
        { label: "Tasks",                 value: "Unlimited" },
        { label: "Team members",          value: "25" },
        { label: "Kanban board",          value: "✓" },
        { label: "Gantt chart view",      value: "✓" },
        { label: "Milestones",            value: "✓" },
        { label: "Time tracking",         value: "✓" },
        { label: "Dependencies",          value: "✓" },
        { label: "Resource allocation",   value: "✓" },
        { label: "Budget tracking",       value: "✓" },
      ],
    },
  ];

  return (
    <div className="wrap">
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon">{ICONS.projectsHub({ size: 48 })}</span>
          <div>
            <h1 className="banner-title">Projects Hub</h1>
            <p className="banner-subtitle">Job tracking + Gantt charts — all in one module.</p>
          </div>
        </div>
        <Link href={buildBillingUrl({})} className="back-btn">← Back to Billing</Link>
      </div>

      {/* What's included */}
      <div className="included-box">
        <div className="included-inner">
          <div className="included-section">
            <span className="included-icon">📋</span>
            <div>
              <p className="included-label">Job Tracking</p>
              <p className="included-value">Kanban boards, status tracking, file attachments</p>
            </div>
          </div>
          <div className="included-divider" />
          <div className="included-section">
            <span className="included-icon">📊</span>
            <div>
              <p className="included-label">Gantt Charts</p>
              <p className="included-value">
                {includedFriendlyTier
                  ? `${includedFriendlyTier} — included in your ${basePlanLabel} plan`
                  : "Milestones, dependencies, critical path — tier depends on your platform plan"}
              </p>
            </div>
          </div>
          <div className="included-divider" />
          <div className="included-section">
            <span className="included-icon">⬆️</span>
            <div>
              <p className="included-label">Upgrade</p>
              <p className="included-value">Select a higher tier below — billed monthly, cancel anytime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section header */}
      <div className="section-header">
        <h2 className="section-title">Projects Hub Plans</h2>
        <p className="section-sub">Pick the tier that fits your team. Includes both job tracking and Gantt chart views.</p>
      </div>

      {/* Plan cards */}
      <div className="packs-grid">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentTierId;
          return (
            <div
              key={plan.id}
              className={`pack-card${plan.recommended ? " recommended" : ""}${isCurrent ? " active" : ""}`}
              style={{ "--pack-color": plan.color, borderColor: plan.color + "55" }}
            >
              {plan.recommended && <span className="badge" style={{ background: plan.color }}>Best Value</span>}
              {isCurrent         && <span className="badge active-badge">✓ Current Plan</span>}

              <h2 className="pack-name" style={{ color: plan.color }}>{plan.name}</h2>

              <div className="price-row">
                <span className="price-amt" style={{ color: plan.color }}>${plan.price}</span>
                <span className="price-period">/mo</span>
              </div>

              <div className="extra-tag" style={{ background: plan.color + "22", color: plan.color, border: `1px solid ${plan.color}44` }}>
                {getDeltaLabel(plan)}
              </div>

              <p className="pack-tagline">{plan.tagline}</p>

              <div className="divider" style={{ background: plan.color }} />

              <ul className="features">
                {plan.features.map((f) => (
                  <li key={f.label} className="feature-row">
                    <span className="f-check" style={{ color: f.value === "—" ? "#4b5563" : plan.color }}>
                      {f.value === "—" ? "—" : "✓"}
                    </span>
                    <span className="f-text" style={{ color: f.value === "—" ? "#6b7280" : "#d1d5db" }}>
                      {f.label}{f.value !== "✓" && f.value !== "—" ? `: ${f.value}` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className="select-btn"
                style={{
                  background: isCurrent ? "transparent" : plan.color,
                  color: isCurrent ? plan.color : "#000",
                  border: isCurrent ? `2px solid ${plan.color}` : "none",
                }}
                disabled={isCurrent}
                onClick={() => !isCurrent && handleSelectPlan(plan)}
              >
                {isCurrent ? "Current Plan" : getButtonLabel(plan)}
              </button>
            </div>
          );
        })}
      </div>

      <p className="footnote">
        All tiers include both job tracking and Gantt chart views. Upgrade or downgrade at any time — changes apply from your next billing cycle.
      </p>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }

        /* Banner */
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #f97316; padding: 24px; border-radius: 12px; margin-bottom: 28px; width: 100%; max-width: 1320px; }
        .banner-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .banner-icon { background: rgba(255,255,255,0.2); border-radius: 50%; padding: 10px; display: flex; align-items: center; flex-shrink: 0; }
        .banner-title { font-size: 48px; font-weight: 600; margin: 0; }
        .banner-subtitle { font-size: 18px; margin: 4px 0 0; opacity: 0.9; }
        .back-btn { background: #0c121a; border: 2px solid #fff; color: #fff; font-size: 18px; font-weight: 600; cursor: pointer; padding: 8px 18px; border-radius: 20px; text-decoration: none; white-space: nowrap; transition: all 0.2s; }
        .back-btn:hover { background: #fff; color: #0c121a; }

        /* Included box */
        .included-box { width: 100%; max-width: 1100px; background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 20px 24px; margin-bottom: 32px; }
        .included-inner { display: flex; align-items: stretch; gap: 0; }
        .included-section { display: flex; align-items: center; gap: 14px; flex: 1; padding: 0 16px; }
        .included-section:first-child { padding-left: 0; }
        .included-section:last-child { padding-right: 0; }
        .included-icon { font-size: 26px; flex-shrink: 0; }
        .included-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin: 0 0 3px; }
        .included-value { font-size: 14px; font-weight: 600; color: #e5e7eb; margin: 0; }
        .included-divider { width: 1px; background: #1f2937; flex-shrink: 0; margin: 0 4px; }

        /* Section header */
        .section-header { width: 100%; max-width: 1100px; margin-bottom: 18px; }
        .section-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
        .section-sub { font-size: 14px; color: #9ca3af; margin: 0; }

        /* Plans grid */
        .packs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 1100px; align-items: start; }

        /* Plan card */
        .pack-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 22px; display: flex; flex-direction: column; background: #111827; transition: transform 0.2s, box-shadow 0.2s; }
        .pack-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
        .pack-card.recommended { box-shadow: 0 0 0 3px var(--pack-color); }
        .pack-card.active { box-shadow: 0 0 0 3px #22c55e; }

        .badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; white-space: nowrap; color: #000; }
        .active-badge { background: #22c55e !important; }

        .pack-name { font-size: 22px; font-weight: 700; margin: 10px 0 6px; }
        .price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 10px; }
        .price-amt { font-size: 38px; font-weight: 800; line-height: 1; }
        .price-period { font-size: 15px; color: #9ca3af; }

        .extra-tag { display: inline-block; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; }

        .pack-tagline { font-size: 13px; color: #9ca3af; margin: 0 0 14px; line-height: 1.5; }

        .divider { height: 2px; opacity: 0.3; border-radius: 2px; margin-bottom: 14px; }

        .features { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
        .feature-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
        .f-check { font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .f-text { color: #d1d5db; }

        .select-btn { width: 100%; padding: 11px; border-radius: 10px; font-size: 14px; font-weight: 700; margin-top: auto; transition: opacity 0.2s; cursor: pointer; }
        .select-btn:hover:not(:disabled) { opacity: 0.85; }
        .select-btn:disabled { cursor: default; }

        .footnote { font-size: 13px; color: #6b7280; margin-top: 24px; text-align: center; max-width: 600px; line-height: 1.6; }

        @media (max-width: 900px) {
          .packs-grid { grid-template-columns: repeat(2, 1fr); }
          .included-inner { flex-direction: column; gap: 14px; }
          .included-divider { display: none; }
        }
        @media (max-width: 540px) {
          .packs-grid { grid-template-columns: 1fr; }
          .banner { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
