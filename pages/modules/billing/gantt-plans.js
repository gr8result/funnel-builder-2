// /pages/modules/billing/gantt-plans.js
// Gantt Charts subscription tier selection page

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

const GANTT_TIER_ORDER  = ["gantt-starter", "gantt-growth", "gantt-pro", "gantt-agency"];
const GANTT_TIER_PRICES = {
  "gantt-starter": 19,
  "gantt-growth":  39,
  "gantt-pro":     79,
  "gantt-agency":  129,
};

export default function GanttPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const emailPlan    = next?.emailPlan    || asParam(router.query.emailPlan);
    const smsPlan      = next?.smsPlan      || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan   = next?.socialPlan   || asParam(router.query.socialPlan);
    const crmPlan      = next?.crmPlan      || asParam(router.query.crmPlan);
    const funnelPlan   = next?.funnelPlan   || asParam(router.query.funnelPlan);
    const websitePlan  = next?.websitePlan  || asParam(router.query.websitePlan);
    const jobBoardPlan = next?.jobBoardPlan || asParam(router.query.jobBoardPlan);
    const ganttPlan    = next?.ganttPlan    || asParam(router.query.ganttPlan);
    const basePlan     = asParam(router.query.basePlan);

    if (basePlan)     params.set("basePlan",     basePlan);
    if (emailPlan)    params.set("emailPlan",    emailPlan);
    if (smsPlan)      params.set("smsPlan",      smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);
    if (socialPlan)   params.set("socialPlan",   socialPlan);
    if (crmPlan)      params.set("crmPlan",      crmPlan);
    if (funnelPlan)   params.set("funnelPlan",   funnelPlan);
    if (websitePlan)  params.set("websitePlan",  websitePlan);
    if (jobBoardPlan) params.set("jobBoardPlan", jobBoardPlan);
    if (ganttPlan)    params.set("ganttPlan",    ganttPlan);

    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const handleSelectPlan = (plan) => {
    if (!user) { alert("Please log in to select a plan."); return; }
    router.push(buildBillingUrl({ ganttPlan: plan.id }));
  };

  // ── Delta pricing ────────────────────────────────────────────────────
  const basePlanId   = typeof router.query.basePlan === "string" ? router.query.basePlan : null;
  const purchasedId  = typeof router.query.ganttPlan === "string" ? router.query.ganttPlan : null;
  const includedTier = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.gantt : null;
  const includedId   = includedTier?.tierId || null;

  function higherTier(a, b) {
    return (GANTT_TIER_ORDER.indexOf(a ?? "gantt-starter") >= GANTT_TIER_ORDER.indexOf(b ?? "gantt-starter")) ? a : b;
  }
  const currentTierId    = higherTier(includedId, purchasedId) || null;
  const currentTierPrice = GANTT_TIER_PRICES[currentTierId] ?? 0;

  function getDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const planOrder = GANTT_TIER_ORDER.indexOf(plan.id);
    const curOrder  = GANTT_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }

  function getButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const planOrder = GANTT_TIER_ORDER.indexOf(plan.id);
    const curOrder  = GANTT_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
  }

  const basePlanLabel = {
    starter: "Starter",
    growth: "Growth",
    scale: "Scale",
    professional: "Professional",
  }[basePlanId] || null;

  const includedFriendlyTier = {
    "gantt-starter": "Starter (5 projects, 30 tasks each, 2 users)",
    "gantt-growth":  "Growth (20 projects, unlimited tasks, dependencies)",
    "gantt-pro":     "Scale (unlimited projects, resource allocation, critical path, client portal)",
    "gantt-agency":  "Professional (unlimited everything, white-label & API)",
  }[includedId] || null;
  // ────────────────────────────────────────────────────────────────────

  const plans = [
    {
      id: "gantt-starter",
      name: "Starter",
      price: 19,
      color: "#6366f1",
      tagline: "Schedule and track small construction projects",
      features: [
        { label: "Projects",                value: "5" },
        { label: "Tasks per project",       value: "30" },
        { label: "Team members",            value: "2" },
        { label: "Milestones",              value: "✓" },
        { label: "Task dependencies",       value: "—" },
        { label: "Resource allocation",     value: "—" },
        { label: "Budget tracking",         value: "—" },
        { label: "Critical path",           value: "—" },
        { label: "Client portal",           value: "—" },
        { label: "White-label / API",       value: "—" },
      ],
    },
    {
      id: "gantt-growth",
      name: "Growth",
      price: 39,
      color: "#22c55e",
      tagline: "Multi-project scheduling with dependency mapping",
      features: [
        { label: "Projects",                value: "20" },
        { label: "Tasks per project",       value: "Unlimited" },
        { label: "Team members",            value: "5" },
        { label: "Milestones",              value: "✓" },
        { label: "Task dependencies",       value: "✓" },
        { label: "Resource allocation",     value: "—" },
        { label: "Budget tracking",         value: "—" },
        { label: "Critical path",           value: "—" },
        { label: "Client portal",           value: "—" },
        { label: "White-label / API",       value: "—" },
      ],
    },
    {
      id: "gantt-pro",
      name: "Scale",
      price: 79,
      color: "#10b981",
      recommended: true,
      tagline: "Full project operations for growing construction firms",
      features: [
        { label: "Projects",                value: "Unlimited" },
        { label: "Tasks per project",       value: "Unlimited" },
        { label: "Team members",            value: "15" },
        { label: "Milestones",              value: "✓" },
        { label: "Task dependencies",       value: "✓" },
        { label: "Resource allocation",     value: "✓" },
        { label: "Budget tracking",         value: "✓" },
        { label: "Critical path",           value: "✓" },
        { label: "Client portal",           value: "✓" },
        { label: "White-label / API",       value: "—" },
      ],
    },
    {
      id: "gantt-agency",
      name: "Professional",
      price: 149,
      color: "#7c3aed",
      tagline: "Enterprise project management with white-label & API",
      features: [
        { label: "Projects",                value: "Unlimited" },
        { label: "Tasks per project",       value: "Unlimited" },
        { label: "Team members",            value: "Unlimited" },
        { label: "Milestones",              value: "✓" },
        { label: "Task dependencies",       value: "✓" },
        { label: "Resource allocation",     value: "✓" },
        { label: "Budget tracking",         value: "✓" },
        { label: "Critical path",           value: "✓" },
        { label: "Client portal",           value: "✓" },
        { label: "White-label / API",       value: "✓" },
      ],
    },
  ];

  return (
    <div className="wrap">
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon"><span style={{ fontSize: 48, lineHeight: 1 }}>📊</span></span>
          <div>
            <h1 className="banner-title">Gantt Charts Plans</h1>
            <p className="banner-subtitle">Construction project schedules with phases, milestones, and critical paths — choose your tier.</p>
          </div>
        </div>
        <Link href={buildBillingUrl({})} className="back-btn">← Back to Billing</Link>
      </div>

      {/* Delta pricing context banner */}
      {basePlanLabel && includedFriendlyTier && (
        <div className="context-banner">
          <span className="context-icon">ℹ️</span>
          <p>
            Your <strong>{basePlanLabel}</strong> platform plan includes Gantt Charts up to the{" "}
            <strong>{includedFriendlyTier}</strong> level.{" "}
            You only pay the <em>difference</em> when upgrading beyond that.
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="plans-grid">
        {plans.map((plan) => {
          const isCurrent  = plan.id === currentTierId;
          const planOrder  = GANTT_TIER_ORDER.indexOf(plan.id);
          const curOrder   = GANTT_TIER_ORDER.indexOf(currentTierId);
          const isDowngrade = curOrder > -1 && planOrder < curOrder;
          const delta = plan.price - currentTierPrice;
          return (
            <div
              key={plan.id}
              className={`plan-card${plan.recommended ? " recommended" : ""}${isCurrent ? " current" : ""}`}
              style={{ borderColor: plan.color }}
            >
              {plan.recommended && (
                <div className="popular-badge" style={{ background: plan.color, color: "#000" }}>
                  ★ Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="popular-badge" style={{ background: "#22c55e", color: "#000" }}>
                  ✓ Current Plan
                </div>
              )}
              <h2 className="plan-name" style={{ color: plan.color }}>{plan.name}</h2>
              <div className="plan-price">
                <span className="plan-amount" style={{ color: plan.color }}>${plan.price}</span>
                <span className="plan-period">/mo</span>
              </div>
              {currentTierId && !isCurrent && !isDowngrade && (
                <div className="delta-badge" style={{ color: plan.color }}>
                  {delta === 0 ? "Included in your plan" : `+$${delta}/mo above your plan`}
                </div>
              )}
              <p className="plan-tagline">{plan.tagline}</p>
              <ul className="feature-list">
                {plan.features.map((f, i) => (
                  <li key={i} className="feature-row">
                    <span className="feature-label">{f.label}</span>
                    <span
                      className="feature-value"
                      style={{
                        color: f.value === "✓" ? plan.color : f.value === "—" ? "#4b5563" : "#f9fafb",
                      }}
                    >
                      {f.value}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="select-btn"
                disabled={isCurrent || isDowngrade}
                style={{
                  background: isCurrent ? "#374151" : isDowngrade ? "#1f2937" : plan.color,
                  color: isCurrent || isDowngrade ? "#6b7280" : "#fff",
                  cursor: isCurrent || isDowngrade ? "default" : "pointer",
                }}
                onClick={() => !isCurrent && !isDowngrade && handleSelectPlan(plan)}
              >
                {getButtonLabel(plan)}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #10b981; color: #fff; padding: 24px; border-radius: 12px; margin-bottom: 32px; width: 100%; max-width: 1320px; }
        .banner-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .banner-icon { background: rgba(0,0,0,0.12); border-radius: 50%; padding: 10px; display: flex; align-items: center; flex-shrink: 0; }
        .banner-title { font-size: 48px; font-weight: 600; margin: 0; color: #000; }
        .banner-subtitle { font-size: 19px; margin: 4px 0 0; opacity: 0.8; color: #000; }
        .back-btn { background: rgba(0,0,0,0.15); border: 2px solid #000; color: #000; font-size: 18px; font-weight: 600; cursor: pointer; padding: 8px 18px; border-radius: 20px; text-decoration: none; flex-shrink: 0; transition: all 0.2s; }
        .back-btn:hover { background: #000; color: #10b981; }
        .context-banner { display: flex; gap: 12px; align-items: flex-start; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); border-radius: 10px; padding: 16px 20px; width: 100%; max-width: 1100px; margin-bottom: 28px; font-size: 18px; line-height: 1.6; }
        .context-icon { font-size: 22px; flex-shrink: 0; }
        .context-banner p { margin: 0; }
        .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 1320px; align-items: start; }
        .plan-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 24px; display: flex; flex-direction: column; background: #111827; transition: transform 0.2s; }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-card.recommended { border-width: 3px; }
        .popular-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; white-space: nowrap; }
        .plan-name { font-size: 26px; font-weight: 700; margin: 12px 0 4px; }
        .plan-price { display: flex; align-items: baseline; gap: 3px; margin-bottom: 6px; }
        .plan-amount { font-size: 46px; font-weight: 700; line-height: 1; }
        .plan-period { font-size: 19px; color: #9ca3af; }
        .delta-badge { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        .plan-tagline { font-size: 15px; color: #9ca3af; margin: 0 0 16px; line-height: 1.5; min-height: 40px; }
        .feature-list { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .feature-row { display: flex; justify-content: space-between; align-items: center; font-size: 15px; gap: 8px; }
        .feature-label { color: #d1d5db; }
        .feature-value { font-weight: 600; white-space: nowrap; }
        .select-btn { width: 100%; padding: 14px; border-radius: 10px; font-size: 17px; font-weight: 700; border: none; transition: opacity 0.2s; }
        .select-btn:not([disabled]):hover { opacity: 0.85; }
        @media (max-width: 900px) { .plans-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .plans-grid { grid-template-columns: 1fr; } .banner-title { font-size: 28px; } }
      `}</style>
    </div>
  );
}
