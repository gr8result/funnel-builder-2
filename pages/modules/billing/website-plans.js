// /pages/modules/billing/website-plans.js
// Website Builder Pricing Plans — 4 tiers with delta pricing + AI upgrade

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import {
  BASE_PLAN_INCLUDES,
  WEBSITE_FEATURES,
  WEBSITE_PLAN_FEATURES,
  WEBSITE_PRICING_PLANS,
  WEBSITE_TIER_ORDER,
  WEBSITE_TIER_PRICES,
} from "../../../data/pricing";
import PricingPlans from "../../../components/pricing/PricingPlans";
import { pricingCardStyles } from "../../../components/pricing/PricingCard";
import Link from "next/link";

export default function WebsitePlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const resolvedUser = sessionData?.session?.user;
      if (!resolvedUser) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) { router.push("/login"); return; }
        setUser(userData.user);
        return;
      }
      setUser(resolvedUser);
    };
    fetchUser();
  }, [router]);

  // ── Delta pricing ─────────────────────────────────────────────────────
  const asParam = (v) => (typeof v === "string" ? v : "");
  const basePlanId  = asParam(router.query.basePlan);
  const purchasedId = asParam(router.query.websitePlan);
  const includedId  = basePlanId ? (BASE_PLAN_INCLUDES[basePlanId]?.website?.tierId || null) : null;

  function higherTier(a, b) {
    const ai = WEBSITE_TIER_ORDER.indexOf(a || "website-starter");
    const bi = WEBSITE_TIER_ORDER.indexOf(b || "website-starter");
    return ai >= bi ? a : b;
  }
  const currentTierId    = basePlanId ? (includedId || null) : (higherTier(includedId, purchasedId) || null);
  const currentTierPrice = WEBSITE_TIER_PRICES[currentTierId] ?? 0;

  function getDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : plan.price < currentTierPrice ? `Select — save $${currentTierPrice - plan.price}/mo` : `+$${delta}/mo extra`;
  }
  function getButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : plan.price < currentTierPrice ? `Select — $${plan.price}/mo` : `Upgrade — add $${delta}/mo`;
  }
  // ─────────────────────────────────────────────────────────────────────

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const basePlan     = asParam(router.query.basePlan);
    const emailPlan    = next?.emailPlan    || asParam(router.query.emailPlan);
    const smsPlan      = next?.smsPlan      || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan   = next?.socialPlan   || asParam(router.query.socialPlan);
    const crmPlan      = next?.crmPlan      || asParam(router.query.crmPlan);
    const funnelPlan   = next?.funnelPlan   || asParam(router.query.funnelPlan);
    const websitePlan  = next?.websitePlan  || asParam(router.query.websitePlan);
    if (basePlan)      params.set("basePlan",     basePlan);
    if (emailPlan)     params.set("emailPlan",    emailPlan);
    if (smsPlan)       params.set("smsPlan",      smsPlan);
    if (calendarPlan)  params.set("calendarPlan", calendarPlan);
    if (socialPlan)    params.set("socialPlan",   socialPlan);
    if (crmPlan)       params.set("crmPlan",      crmPlan);
    if (funnelPlan)    params.set("funnelPlan",   funnelPlan);
    if (websitePlan)   params.set("websitePlan",  websitePlan);
    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const selectPlan = (tierId) => {
    router.push(buildBillingUrl({ websitePlan: tierId }));
  };

  function renderCell(planId, feature) {
    const val = WEBSITE_PLAN_FEATURES[planId]?.[feature.key];
    if (typeof val === "boolean") {
      return val
        ? <span style={{ color: "#86efac", fontWeight: 600, fontSize: 18 }}>✓</span>
        : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>—</span>;
    }
    return <span>{val ?? "—"}</span>;
  }

  const S = {
    wrap:       { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px", display: "flex", justifyContent: "center" },
    inner:      { width: "100%", maxWidth: 1320 },
    banner:     { display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#3b82f6,#6366f1)", padding: "24px 28px", borderRadius: 12, marginBottom: 30 },
    bannerLeft: { display: "flex", alignItems: "center", gap: 18 },
    bannerTitle: { fontSize: 48, fontWeight: 600, margin: 0, color: "#fff" },
    bannerDesc: { fontSize: 18, marginTop: 4, color: "rgba(255,255,255,0.75)" },
    backBtn:    { background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", color: "#fff", padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontWeight: 600 },
    aiCallout:  { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 12, padding: "16px 20px", marginBottom: 30, display: "flex", alignItems: "center", gap: 14 },
    aiIcon:     { fontSize: 28 },
    aiText:     { fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 },
    btnEl:      pricingCardStyles.btnEl,
    table:      { width: "100%", borderCollapse: "collapse", background: "#111827", borderRadius: 12, overflow: "hidden", marginBottom: 40 },
    th:         { padding: "14px 12px", background: "#1f2937", fontWeight: 600, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
    thLeft:     { textAlign: "left" },
    td:         { padding: "11px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" },
    tdLeft:     { textAlign: "left", fontWeight: 500 },
    hlTh:       { background: "rgba(245,158,11,0.25)" },
    hlTd:       { background: "rgba(245,158,11,0.08)" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        {/* Banner */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div><span style={{ fontSize: 48, lineHeight: 1 }}>🌐</span></div>
            <div>
              <h1 style={S.bannerTitle}>Website Builder Plans</h1>
              <p style={S.bannerDesc}>Build stunning websites with AI — from one-pager to full multi-site agency.</p>
            </div>
          </div>
          <Link href={buildBillingUrl({})}>
            <button style={S.backBtn}>← Back to Billing</button>
          </Link>
        </div>

        {/* AI upgrade callout */}
        <div style={S.aiCallout}>
          <span style={S.aiIcon}>🤖</span>
          <div style={S.aiText}>
            <strong>AI Website Builder</strong> — available on Scale &amp; Professional plans. Describe your business and our AI generates a complete, branded website in seconds. Includes AI copywriting, section generation, image selection and layout optimisation.
          </div>
        </div>

        {/* Plan cards */}
        <PricingPlans
          plans={WEBSITE_PRICING_PLANS}
          mode="billing"
          currentPlanId={currentTierId}
          getDeltaLabel={getDeltaLabel}
          getButtonLabel={getButtonLabel}
          onSelectPlan={selectPlan}
        />

        {/* Feature comparison table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>Feature</th>
              {WEBSITE_PRICING_PLANS.map((p) => (
                <th key={p.id} style={{ ...S.th, ...(p.id === currentTierId ? { background: `${p.color}22`, borderTop: `3px solid ${p.color}` } : {}), color: p.color }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEBSITE_FEATURES.map((f) => (
              <tr key={f.key}>
                <td style={{ ...S.td, ...S.tdLeft }}>{f.label}</td>
                {WEBSITE_PRICING_PLANS.map((p) => (
                  <td key={p.id} style={{ ...S.td, ...(p.id === currentTierId ? { background: `${p.color}0d` } : {}) }}>
                    {renderCell(p.id, f)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={S.td} />
              {WEBSITE_PRICING_PLANS.map((p) => {
                const isActive = p.id === currentTierId;
                return (
                  <td key={p.id} style={{ ...S.td, ...(p.id === currentTierId ? { background: `${p.color}0d` } : {}) }}>
                    <button
                      onClick={() => !isActive && selectPlan(p.id)}
                      disabled={isActive}
                      style={{ ...S.btnEl, background: isActive ? "transparent" : p.color, border: `2px solid ${p.color}`, color: isActive ? p.color : (p.color === "#f59e0b" ? "#000" : "#fff"), opacity: isActive ? 0.8 : 1, padding: "8px 0" }}
                    >
                      {getButtonLabel(p)}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
