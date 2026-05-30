// /pages/modules/billing/crm-plans.js
// CRM subscription plans and pricing

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

const CRM_TIER_ORDER  = ["crm-starter", "crm-growth", "crm-pro", "crm-agency"];
const CRM_TIER_PRICES = { "crm-starter": 19, "crm-growth": 29, "crm-pro": 79, "crm-agency": 199 };

export default function CrmPlans() {
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
    const basePlan     = asParam(router.query.basePlan);

    if (basePlan)     params.set("basePlan",     basePlan);
    if (emailPlan)    params.set("emailPlan",    emailPlan);
    if (smsPlan)      params.set("smsPlan",      smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);
    if (socialPlan)   params.set("socialPlan",   socialPlan);
    if (crmPlan)      params.set("crmPlan",      crmPlan);
    if (funnelPlan)   params.set("funnelPlan",   funnelPlan);

    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const handleSelectPlan = (plan) => {
    if (!user) { alert("Please log in to select a plan."); return; }
    router.push(buildBillingUrl({ crmPlan: plan.id }));
  };

  // ── Delta pricing ────────────────────────────────────────────────────
  const basePlanId     = typeof router.query.basePlan === "string" ? router.query.basePlan : null;
  const purchasedId    = typeof router.query.crmPlan  === "string" ? router.query.crmPlan  : null;
  const includedTier   = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.crm : null;
  const includedId     = includedTier?.tierId || null;

  function higherCrmTier(a, b) {
    return (CRM_TIER_ORDER.indexOf(a ?? "crm-starter") >= CRM_TIER_ORDER.indexOf(b ?? "crm-starter")) ? a : b;
  }
  const currentTierId    = higherCrmTier(includedId, purchasedId) || null;
  const currentTierPrice = CRM_TIER_PRICES[currentTierId] ?? 0;

  function getCrmDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const planOrder = CRM_TIER_ORDER.indexOf(plan.id);
    const curOrder  = CRM_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }

  function getCrmButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const planOrder = CRM_TIER_ORDER.indexOf(plan.id);
    const curOrder  = CRM_TIER_ORDER.indexOf(currentTierId);
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
    "crm-starter": "Starter (1 pipeline, 500 contacts)",
    "crm-growth":  "Growth (unlimited pipelines, 5,000 contacts)",
    "crm-pro":     "Scale (unlimited pipelines, 25,000 contacts)",
    "crm-agency":  "Professional (unlimited everything)",
  }[includedId] || null;
  // ────────────────────────────────────────────────────────────────────

  const plans = [
    {
      id: "crm-starter",
      name: "Starter",
      price: 19,
      priceLabel: "$19 / month",
      color: "#6366f1",
      tagline: "Get started with basic pipeline management",
      features: [
        { label: "Pipelines",             value: "1" },
        { label: "Contacts / leads",      value: "500" },
        { label: "Pipeline stages",       value: "✓" },
        { label: "Deal tracking",         value: "✓" },
        { label: "Activity log (notes)",  value: "✓" },
        { label: "Tasks",                 value: "✓" },
        { label: "Send to workflow",      value: "—" },
        { label: "Lead reports",          value: "—" },
      ],
    },
    {
      id: "crm-growth",
      name: "Growth",
      price: 29,
      color: "#22c55e",
      tagline: "Scale your sales with unlimited pipelines",
      features: [
        { label: "Pipelines",             value: "3" },
        { label: "Contacts / leads",      value: "5,000" },
        { label: "Pipeline stages",       value: "✓" },
        { label: "Deal tracking",         value: "✓" },
        { label: "Activity log (notes)",  value: "✓" },
        { label: "Tasks",                 value: "✓" },
        { label: "Send to workflow",      value: "✓" },
        { label: "Lead reports",          value: "✓" },
      ],
    },
    {
      id: "crm-pro",
      name: "Scale",
      price: 79,
      color: "#f59e0b",
      recommended: true,
      tagline: "Advanced CRM for growing teams",
      features: [
        { label: "Pipelines",             value: "10" },
        { label: "Contacts / leads",      value: "25,000" },
        { label: "Pipeline stages",       value: "✓" },
        { label: "Deal tracking",         value: "✓" },
        { label: "Activity log (notes)",  value: "✓" },
        { label: "Tasks",                 value: "✓" },
        { label: "Send to workflow",      value: "✓" },
        { label: "Lead reports",          value: "✓" },
      ],
    },
    {
      id: "crm-agency",
      name: "Professional",
      price: 199,
      color: "#7c3aed",
      tagline: "Unlimited scale for agencies and enterprise teams",
      features: [
        { label: "Pipelines",             value: "Unlimited" },
        { label: "Contacts / leads",      value: "Unlimited" },
        { label: "Pipeline stages",       value: "✓" },
        { label: "Deal tracking",         value: "✓" },
        { label: "Activity log (notes)",  value: "✓" },
        { label: "Tasks",                 value: "✓" },
        { label: "Send to workflow",      value: "✓" },
        { label: "Lead reports",          value: "✓" },
      ],
    },
  ];

  return (
    <div className="wrap">
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon"><span style={{ fontSize: 42, lineHeight: 1 }}>🗂️</span></span>
          <div>
            <h1 className="banner-title">CRM Plans</h1>
            <p className="banner-subtitle">Manage leads, deals, and pipelines — choose the tier that fits your team.</p>
          </div>
        </div>
        <Link href={buildBillingUrl({})} className="back-btn">← Back to Billing</Link>
      </div>

      {/* Delta pricing context banner */}
      {basePlanLabel && includedFriendlyTier && (
        <div className="context-banner">
          <span className="context-icon">ℹ️</span>
          <p>
            Your <strong>{basePlanLabel}</strong> platform plan includes CRM up to the{" "}
            <strong>{includedFriendlyTier}</strong> level.{" "}
            You only pay the <em>difference</em> when upgrading beyond that.
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="plans-grid">
        {plans.map((plan) => {
          const delta    = getCrmDeltaLabel(plan);
          const btnLabel = getCrmButtonLabel(plan);
          const isCurrent = plan.id === currentTierId;
          const isDowngrade = CRM_TIER_ORDER.indexOf(plan.id) < CRM_TIER_ORDER.indexOf(currentTierId);

          return (
            <div
              key={plan.id}
              className={`plan-card${plan.recommended ? " recommended" : ""}${isCurrent ? " current" : ""}`}
              style={{ "--plan-color": plan.color, borderColor: plan.color + "55" }}
            >
              {plan.recommended && <span className="badge" style={{ background: plan.color }}>Most Popular</span>}
              {isCurrent       && <span className="badge current-badge">✓ Current Plan</span>}

              <h2 className="plan-name" style={{ color: plan.color }}>{plan.name}</h2>

              <div className="price-row">
                <span className="price-amt" style={{ color: plan.color }}>${plan.price}</span>
                <span className="price-period">/mo</span>
              </div>

              {!isCurrent && !isDowngrade && (
                <div className="delta-tag" style={{ background: plan.color + "22", color: plan.color, border: `1px solid ${plan.color}44` }}>
                  {delta}
                </div>
              )}

              <p className="plan-tagline">{plan.tagline}</p>

              <div className="divider" style={{ background: plan.color }} />

              <ul className="features">
                {plan.features.map((f) => (
                  <li key={f.label} className="feature-row">
                    <span className="f-label">{f.label}</span>
                    <span className="f-value" style={{ color: f.value === "—" ? "#4b5563" : plan.color }}>{f.value}</span>
                  </li>
                ))}
              </ul>

              <button
                className="select-btn"
                style={{
                  background: isCurrent ? "transparent" : plan.color,
                  color: isCurrent ? plan.color : "#000",
                  border: isCurrent ? `2px solid ${plan.color}` : "none",
                  opacity: isDowngrade ? 0.45 : 1,
                  cursor: isDowngrade ? "not-allowed" : "pointer",
                }}
                disabled={isCurrent || isDowngrade}
                onClick={() => !isCurrent && !isDowngrade && handleSelectPlan(plan)}
              >
                {btnLabel}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }

        /* Banner */
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #ec4899; padding: 24px; border-radius: 12px; margin-bottom: 28px; width: 100%; max-width: 1320px; }
        .banner-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .banner-icon { background: rgba(255,255,255,0.2); border-radius: 50%; padding: 10px; display: flex; align-items: center; flex-shrink: 0; }
        .banner-title { font-size: 48px; font-weight: 700; margin: 0; }
        .banner-subtitle { font-size: 16px; margin: 4px 0 0; opacity: 0.9; }
        .back-btn { background: #0c121a; border: 2px solid #fff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; padding: 8px 18px; border-radius: 20px; text-decoration: none; white-space: nowrap; transition: all 0.2s; }
        .back-btn:hover { background: #fff; color: #0c121a; }

        /* Context banner */
        .context-banner { display: flex; align-items: flex-start; gap: 12px; background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px; width: 100%; max-width: 1320px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .context-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }

        /* Plans grid */
        .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 1320px; align-items: start; }

        /* Plan card */
        .plan-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 22px; display: flex; flex-direction: column; background: #111827; transition: transform 0.2s, box-shadow 0.2s; }
        .plan-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
        .plan-card.recommended { box-shadow: 0 0 0 3px var(--plan-color); }
        .plan-card.current { box-shadow: 0 0 0 3px var(--plan-color); }

        .badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; white-space: nowrap; color: #000; }
        .current-badge { background: var(--plan-color) !important; color: #fff !important; }

        .plan-name { font-size: 22px; font-weight: 700; margin: 10px 0 6px; }
        .price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 10px; }
        .price-amt { font-size: 38px; font-weight: 800; line-height: 1; }
        .price-label { font-size: 26px; font-weight: 700; }
        .price-period { font-size: 15px; color: #9ca3af; }

        .delta-tag { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; }

        .plan-tagline { font-size: 13px; color: #9ca3af; margin: 0 0 14px; line-height: 1.5; }

        .divider { height: 2px; opacity: 0.3; border-radius: 2px; margin-bottom: 14px; }

        .features { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 7px; }
        .feature-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .f-label { color: #d1d5db; }
        .f-value { font-weight: 600; font-size: 12px; }

        .select-btn { width: 100%; padding: 11px; border-radius: 10px; font-size: 14px; font-weight: 700; margin-top: auto; transition: opacity 0.2s; }
        .select-btn:hover:not(:disabled) { opacity: 0.85; }

        @media (max-width: 900px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .plans-grid { grid-template-columns: 1fr; }
          .banner { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
