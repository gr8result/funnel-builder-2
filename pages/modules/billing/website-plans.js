// /pages/modules/billing/website-plans.js
// Website Builder Pricing Plans — 4 tiers with delta pricing + AI upgrade

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";
import Link from "next/link";

const WEBSITE_TIER_ORDER  = ["website-starter", "website-growth", "website-pro", "website-agency"];
const WEBSITE_TIER_PRICES = {
  "website-starter": 29,
  "website-growth":  59,
  "website-pro":     79,
  "website-agency":  149,
};

const PLANS = [
  {
    id: "website-starter",
    name: "Starter",
    price: 29,
    priceLabel: "$29 / month",
    color: "#6366f1",
    features: [
      "1 website",
      "Drag-and-drop builder",
      "5 pages",
      "Free subdomain",
      "Basic templates",
      "Basic SEO tools",
    ],
  },
  {
    id: "website-growth",
    name: "Growth",
    price: 59,
    priceLabel: "$59 / month",
    color: "#22c55e",
    features: [
      "2 websites",
      "Custom domain",
      "10 pages",
      "AI content generation",
      "Blog & landing pages",
      "Contact forms",
      "Google Analytics",
    ],
  },
  {
    id: "website-pro",
    name: "Scale",
    price: 79,
    priceLabel: "$79 / month",
    color: "#f59e0b",
    recommended: true,
    features: [
      "3 websites",
      "Custom domains",
      "Full AI website builder",
      "AI generate entire site from prompt",
      "Ecommerce & product pages",
      "Advanced analytics",
      "Custom code injection",
      "Priority support",
    ],
  },
  {
    id: "website-agency",
    name: "Professional",
    price: 149,
    priceLabel: "$149 / month",
    color: "#7c3aed",
    features: [
      "5 websites",
      "All Scale features",
      "AI site generation (unlimited)",
      "Client management",
      "API access",
      "Dedicated support",
    ],
  },
];

const FEATURES = [
  { label: "Websites",                  key: "websites" },
  { label: "Pages",                     key: "pages" },
  { label: "Custom domain",             key: "customDomain" },
  { label: "Drag-and-drop builder",     key: "dragDrop" },
  { label: "Blog",                      key: "blog" },
  { label: "AI content generation",     key: "aiContent" },
  { label: "Full AI site builder",      key: "aiBuilder" },
  { label: "Ecommerce",                 key: "ecommerce" },
  { label: "Custom code injection",     key: "customCode" },
  { label: "Analytics",                 key: "analytics" },
  { label: "API access",                key: "apiAccess" },
];

const PLAN_FEATURES = {
  "website-starter": {
    websites: "1", pages: "5", customDomain: false, dragDrop: true, blog: false,
    aiContent: false, aiBuilder: false, ecommerce: false, abTesting: false,
    customCode: false, analytics: "Basic", apiAccess: false,
  },
  "website-growth": {
    websites: "2", pages: "10", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: false, ecommerce: false, abTesting: false,
    customCode: false, analytics: "Standard", apiAccess: false,
  },
  "website-pro": {
    websites: "3", pages: "Unlimited", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: true, ecommerce: true, abTesting: true,
    customCode: true, analytics: "Advanced", apiAccess: false,
  },
  "website-agency": {
    websites: "5", pages: "Unlimited", customDomain: true, dragDrop: true, blog: true,
    aiContent: true, aiBuilder: true, ecommerce: true, abTesting: true,
    customCode: true, analytics: "Full", apiAccess: true,
  },
};

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
    const val = PLAN_FEATURES[planId]?.[feature.key];
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
    grid:       { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 40 },
    card:       { background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" },
    cardActive: { border: "2px solid #86efac" },
    cardRec:    { border: "2px solid #f59e0b" },
    recBadge:   { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap" },
    activeBadge: { position: "absolute", top: -12, right: 14, background: "rgba(34,197,94,0.85)", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20 },
    planName:   { fontSize: 22, fontWeight: 600, marginBottom: 4 },
    planPrice:  { fontSize: 28, fontWeight: 600 },
    planDelta:  { fontSize: 16, marginTop: 4, minHeight: 18 },
    featureList: { listStyle: "none", padding: 0, margin: "16px 0 0", textAlign: "left", width: "100%", fontSize: 16, lineHeight: 2 },
    btn:        { marginTop: "auto", paddingTop: 20, width: "100%" },
    btnEl:      { width: "100%", padding: "10px 0", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer" },
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
        <div style={S.grid}>
          {PLANS.map((plan) => {
            const isActive  = plan.id === currentTierId;
            const cardStyle = { ...S.card, ...(isActive ? S.cardActive : {}), ...(plan.recommended && !isActive ? S.cardRec : {}) };
            const btnBg     = isActive ? "transparent" : plan.color;
            const btnBorder = `2px solid ${plan.color}`;
            const btnColor  = isActive ? plan.color : (plan.color === "#f59e0b" ? "#000" : "#fff");
            return (
              <div key={plan.id} style={cardStyle}>
                {plan.recommended && !isActive && <div style={S.recBadge}>⭐ Best Value</div>}
                {isActive && <div style={S.activeBadge}>✓ Active</div>}
                <div style={{ ...S.planName, color: plan.color }}>{plan.name}</div>
                <div style={S.planPrice}>{plan.priceLabel}</div>
                <div style={{ ...S.planDelta, color: isActive ? plan.color : "rgba(255,255,255,0.55)" }}>{getDeltaLabel(plan)}</div>
                <ul style={S.featureList}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ color: "rgba(255,255,255,0.8)" }}>✓ {f}</li>
                  ))}
                </ul>
                <div style={S.btn}>
                  <button
                    onClick={() => !isActive && selectPlan(plan.id)}
                    disabled={isActive}
                    style={{ ...S.btnEl, background: btnBg, border: btnBorder, color: btnColor, opacity: isActive ? 0.8 : 1 }}
                  >
                    {getButtonLabel(plan)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>Feature</th>
              {PLANS.map((p) => (
                <th key={p.id} style={{ ...S.th, ...(p.id === currentTierId ? { background: `${p.color}22`, borderTop: `3px solid ${p.color}` } : {}), color: p.color }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.key}>
                <td style={{ ...S.td, ...S.tdLeft }}>{f.label}</td>
                {PLANS.map((p) => (
                  <td key={p.id} style={{ ...S.td, ...(p.id === currentTierId ? { background: `${p.color}0d` } : {}) }}>
                    {renderCell(p.id, f)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={S.td} />
              {PLANS.map((p) => {
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
