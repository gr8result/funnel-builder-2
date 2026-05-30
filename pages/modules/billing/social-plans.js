// /pages/modules/billing/social-plans.js
// Social Media AI plan selection page

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import Link from "next/link";
import ICONS from "../../../components/iconMap";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

const PLANS = [
  {
    id: "social-starter",
    name: "Starter",
    price: 29,
    priceLabel: "$29 / month",
    color: "#6366f1",
    aiPosts: "50 AI posts",
    images: "10 AI images",
    platforms: "3 platforms",
    campaigns: "1 active campaign",
    scheduling: true,
    brandVoice: false,
    multiAccount: false,
    support: "Email support",
  },
  {
    id: "social-growth",
    name: "Growth",
    price: 79,
    priceLabel: "$79 / month",
    color: "#22c55e",
    aiPosts: "200 AI posts",
    images: "50 AI images",
    platforms: "All 7 platforms",
    campaigns: "5 active campaigns",
    scheduling: true,
    brandVoice: true,
    multiAccount: false,
    support: "Email support",
    recommended: true,
  },
  {
    id: "social-pro",
    name: "Scale",
    price: 149,
    priceLabel: "$149 / month",
    color: "#f59e0b",
    aiPosts: "500 AI posts",
    images: "150 AI images",
    platforms: "All 7 platforms",
    campaigns: "20 active campaigns",
    scheduling: true,
    brandVoice: true,
    multiAccount: false,
    support: "Priority support",
  },
  {
    id: "social-agency",
    name: "Professional",
    price: 299,
    priceLabel: "$299 / month",
    color: "#7c3aed",
    aiPosts: "2,000 AI posts",
    images: "500 AI images",
    platforms: "All 7 platforms",
    campaigns: "Unlimited campaigns",
    scheduling: true,
    brandVoice: true,
    multiAccount: true,
    support: "Dedicated support",
  },
];

const FEATURES = [
  { key: "aiPosts",       label: "AI Posts / month" },
  { key: "images",        label: "AI Images / month" },
  { key: "platforms",     label: "Platforms" },
  { key: "campaigns",     label: "Active Campaigns" },
  { key: "scheduling",    label: "Post Scheduling" },
  { key: "brandVoice",    label: "Brand Voice Settings" },
  { key: "multiAccount",  label: "Multi-Account / Sub-brands" },
  { key: "support",       label: "Support" },
];

export default function SocialPlans() {
  const router = useRouter();
  const [currentTier, setCurrentTier] = useState(null);

  // ── Delta pricing ─────────────────────────────────────────────────────────
  const SOCIAL_TIER_ORDER  = ["social-starter", "social-growth", "social-pro", "social-agency"];
  const SOCIAL_TIER_PRICES = { "social-starter": 29, "social-growth": 79, "social-pro": 149, "social-agency": 299 };
  const basePlanId      = typeof router.query.basePlan   === "string" ? router.query.basePlan   : null;
  const purchasedId     = currentTier || null; // from DB (fetched in useEffect below), not URL param
  const includedTier    = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.social : null;
  const includedId      = includedTier?.tierId || null;
  function higherSocialTier(a, b) {
    return (SOCIAL_TIER_ORDER.indexOf(a ?? "social-starter") >= SOCIAL_TIER_ORDER.indexOf(b ?? "social-starter")) ? a : b;
  }
  // When basePlanId is set, use the included tier (not the DB value which may be from a different plan).
  const currentTierId = basePlanId ? (includedId || null) : (higherSocialTier(includedId, purchasedId) || null);
  const currentTierPrice = SOCIAL_TIER_PRICES[currentTierId] ?? 0;
  function getSocialDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const planOrder = SOCIAL_TIER_ORDER.indexOf(plan.id);
    const curOrder  = SOCIAL_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }
  function getSocialButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const planOrder = SOCIAL_TIER_ORDER.indexOf(plan.id);
    const curOrder  = SOCIAL_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
  }
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (!user) return;
      // Skip DB tier when navigating from billing — use the base plan's included tier instead
      if (!router.query.basePlan) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("social_plan_tier")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (acc?.[0]?.social_plan_tier) setCurrentTier(acc[0].social_plan_tier);
      }
    })();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const basePlan    = asParam(router.query.basePlan);
    const emailPlan   = next?.emailPlan   || asParam(router.query.emailPlan);
    const smsPlan     = next?.smsPlan     || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan  = next?.socialPlan  || asParam(router.query.socialPlan);
    const crmPlan     = next?.crmPlan     || asParam(router.query.crmPlan);
    const funnelPlan  = next?.funnelPlan  || asParam(router.query.funnelPlan);

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

  function selectPlan(planId) {
    router.push(buildBillingUrl({ socialPlan: planId }));
  }

  function renderCell(plan, feature) {
    const val = plan[feature.key];
    if (typeof val === "boolean") {
      return val
        ? <span style={{ color: "#86efac", fontWeight: 600, fontSize: 18 }}>✓</span>
        : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>—</span>;
    }
    return <span>{val}</span>;
  }

  return (
    <div style={S.wrap}>
      {/* Banner */}
      <div style={S.banner}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={S.bannerIcon}><span style={{ fontSize: 48, lineHeight: 1 }}>📱</span></div>
          <div>
            <h1 style={S.bannerTitle}>Social Media Plans</h1>
            <p style={S.bannerDesc}>AI-powered post generation, scheduling &amp; multi-platform publishing.</p>
          </div>
        </div>
        <Link href="/billing"><button style={S.backBtn}>← Back to Billing</button></Link>
      </div>

      {/* Current plan notice */}
      {currentTier && (
        <div style={S.currentBanner}>
          <span>Current plan: <strong>{PLANS.find(p => p.id === currentTier)?.name || currentTier}</strong></span>
          <button onClick={() => router.push("/modules/social_media/dashboard")} style={S.dashBtn}>Go to Dashboard →</button>
        </div>
      )}

      {/* Comparison table */}
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: "left", width: 200 }}>Features</th>
              {PLANS.map(p => (
                <th key={p.id} style={{ ...S.th, background: `${p.color}22`, borderTop: `3px solid ${p.color}`, position: "relative" }}>
                  {currentTier === p.id && (
                    <div style={{ ...S.badge, background: p.color, color: p.color === "#f59e0b" ? "#000" : "#fff", top: -10 }}>✓ Active</div>
                  )}
                  <div style={{ fontSize: 22, fontWeight: 600, color: p.color }}>{p.name}</div>
                  <div style={{ fontSize: 16, opacity: 0.85, marginTop: 2 }}>{p.priceLabel}</div>
                  <div style={{ fontSize: 16, marginTop: 4, color: p.id === currentTierId ? p.color : "rgba(255,255,255,0.6)" }}>{getSocialDeltaLabel(p)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr key={i}>
                <td style={S.tdFeature}>{f.label}</td>
                {PLANS.map(p => (
                  <td key={p.id} style={{ ...S.td, background: `${p.color}0d` }}>
                    {renderCell(p, f)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {PLANS.map(p => (
                <td key={p.id} style={{ ...S.td, background: `${p.color}0d` }}>
                  <button
                    onClick={() => selectPlan(p.id)}
                    style={{
                      ...S.selectBtn,
                      background: currentTierId === p.id ? "transparent" : p.color,
                      border: `2px solid ${p.color}`,
                      color: currentTierId === p.id ? p.color : (p.color === "#f59e0b" ? "#000" : "#fff"),
                    }}
                  >
                    {getSocialButtonLabel(p)}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* What you get section */}
      <div style={S.infoGrid}>
        {PLANS.map(p => (
          <div key={p.id} style={{ ...S.infoCard, borderColor: p.color }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: p.color, marginBottom: 8 }}>{p.priceLabel}</div>
            <ul style={{ margin: 0, padding: "0 0 0 16px", lineHeight: 2, color: "rgba(255,255,255,0.75)", fontSize: 16 }}>
              <li>{p.aiPosts} / month</li>
              <li>{p.images} / month</li>
              <li>{p.platforms}</li>
              <li>{p.campaigns}</li>
              {p.scheduling && <li>Post scheduling</li>}
              {p.brandVoice && <li>Brand voice settings</li>}
              {p.multiAccount && <li>Multi-account / sub-brands</li>}
              <li>{p.support}</li>
            </ul>
            <button onClick={() => selectPlan(p.id)} style={{ ...S.selectBtn, background: currentTierId === p.id ? "transparent" : p.color, border: `2px solid ${p.color}`, color: currentTierId === p.id ? p.color : (p.color === "#f59e0b" ? "#000" : "#fff"), marginTop: 14, width: "100%" }}>
              {currentTierId === p.id ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto 40px", color: "rgba(255,255,255,0.4)", fontSize: 16, textAlign: "center", lineHeight: 1.8 }}>
        All plans include: AI-generated post content, platform-specific formatting (Facebook, Instagram, LinkedIn, X, Pinterest, TikTok, YouTube), 
        inline editing, approval workflow, and CSV export. Prices in AUD, billed monthly.
      </div>
    </div>
  );
}

const S = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
  },
  banner: {
    maxWidth: 1320,
    margin: "0 auto 20px",
    background: "#8126e9",
    borderRadius: 14,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
  },
  bannerIcon: {
    background: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  bannerTitle: { fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.2 },
  bannerDesc: { margin: "4px 0 0", opacity: 0.85, fontSize: 18 },
  backBtn: {
    background: "rgba(0,0,0,0.3)",
    border: "1.5px solid rgba(255,255,255,0.3)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 600,
    borderRadius: 20,
    padding: "8px 18px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  currentBanner: {
    maxWidth: 1320,
    margin: "0 auto 16px",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.35)",
    borderRadius: 10,
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#86efac",
    fontSize: 16,
    gap: 12,
  },
  dashBtn: {
    background: "rgba(34,197,94,0.2)",
    border: "1px solid rgba(34,197,94,0.5)",
    color: "#86efac",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 16,
  },
  table: {
    maxWidth: 1320,
    margin: "0 auto 32px",
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 16,
  },
  th: {
    background: "#111827",
    padding: "18px 14px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#fff",
    fontWeight: 600,
  },
  highlightTh: {
    background: "rgba(34,197,94,0.25)",
    border: "1px solid rgba(34,197,94,0.5)",
  },
  td: {
    padding: "12px 14px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.05)",
    background: "#0b1220",
    color: "rgba(255,255,255,0.75)",
  },
  highlightTd: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.2)",
  },
  tdFeature: {
    padding: "12px 14px",
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.05)",
    background: "#0b1220",
    color: "rgba(255,255,255,0.55)",
    fontWeight: 600,
    fontSize: 16,
  },
  badge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#f59e0b",
    color: "#111",
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 6,
    padding: "2px 8px",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  selectBtn: {
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 16,
    width: "auto",
  },
  infoGrid: {
    maxWidth: 1320,
    margin: "0 auto 32px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  infoCard: {
    background: "#0b1220",
    border: "2px solid",
    borderRadius: 14,
    padding: 20,
  },
};
