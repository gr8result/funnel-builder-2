// /pages/modules/billing/projects-hub-plans.js
// Projects Hub tier selection — replaces the old separate Job Board & Gantt Charts plan pages

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
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
    "projects-hub-agency":  "Professional (unlimited · white-label · API)",
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
        { label: "Client portal",         value: "—" },
        { label: "White-label / API",     value: "—" },
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
        { label: "Client portal",         value: "—" },
        { label: "White-label / API",     value: "—" },
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
        { label: "Client portal",         value: "✓" },
        { label: "White-label / API",     value: "—" },
      ],
    },
    {
      id: "projects-hub-agency",
      name: "Professional",
      price: 159,
      color: "#7c3aed",
      tagline: "Enterprise project management with white-label & API",
      features: [
        { label: "Active jobs",           value: "Unlimited" },
        { label: "Projects (Gantt)",      value: "Unlimited" },
        { label: "Tasks",                 value: "Unlimited" },
        { label: "Team members",          value: "Unlimited" },
        { label: "Kanban board",          value: "✓" },
        { label: "Gantt chart view",      value: "✓" },
        { label: "Milestones",            value: "✓" },
        { label: "Time tracking",         value: "✓" },
        { label: "Dependencies",          value: "✓" },
        { label: "Resource allocation",   value: "✓" },
        { label: "Budget tracking",       value: "✓" },
        { label: "Client portal",         value: "✓" },
        { label: "White-label / API",     value: "✓" },
      ],
    },
  ];

  return (
    <div className="wrap">
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <span style={{ fontSize: 36 }}>🏗️</span>
          <div>
            <h1 className="banner-title">Projects Hub Plans</h1>
            <p className="banner-subtitle">Job tracking + Gantt charts — all in one module.</p>
          </div>
        </div>
        <Link href={buildBillingUrl({})} className="back-btn">← Back to Billing</Link>
      </div>

      {basePlanLabel && (
        <div className="info-bar" style={{ background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 10, padding: "12px 20px", marginBottom: 24, color: "#c7d2fe", fontSize: 14 }}>
          <strong>Your {basePlanLabel} plan</strong> includes{" "}
          {includedFriendlyTier ? <strong>{includedFriendlyTier}</strong> : "no Projects Hub tier"}.
          {includedFriendlyTier && " Upgrade pricing below shows the additional cost above that."}
        </div>
      )}

      <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20, marginBottom: 40 }}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentTierId;
          return (
            <div key={plan.id} style={{
              background: "rgba(255,255,255,0.04)",
              border: `2px solid ${isCurrent ? plan.color : "rgba(255,255,255,0.1)"}`,
              borderRadius: 14,
              padding: 24,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}>
              {plan.recommended && (
                <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  Best Value
                </span>
              )}
              {isCurrent && (
                <span style={{ position: "absolute", top: 12, right: 12, background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                  ✓ Current Plan
                </span>
              )}
              <h3 style={{ color: plan.color, margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{plan.name}</h3>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 12px" }}>{plan.tagline}</p>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9" }}>A${plan.price}</span>
                <span style={{ color: "#64748b", fontSize: 14 }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, color: plan.color, fontWeight: 600, marginBottom: 16 }}>
                {getDeltaLabel(plan)}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: f.value === "—" ? "#4b5563" : "#e2e8f0" }}>
                    <span>{f.label}</span>
                    <span style={{ fontWeight: 600 }}>{f.value}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={isCurrent}
                style={{
                  background: isCurrent ? "rgba(255,255,255,0.05)" : plan.color,
                  color: isCurrent ? "#6b7280" : "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isCurrent ? "default" : "pointer",
                  width: "100%",
                }}
              >
                {getButtonLabel(plan)}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .banner { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .banner-left { display: flex; align-items: center; gap: 14px; }
        .banner-title { font-size: 26px; font-weight: 800; color: #f1f5f9; margin: 0; }
        .banner-subtitle { color: #94a3b8; margin: 4px 0 0; font-size: 14px; }
        .back-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 14px; }
        .back-btn:hover { background: rgba(255,255,255,0.14); }
      `}</style>
    </div>
  );
}
