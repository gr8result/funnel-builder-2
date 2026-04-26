// /pages/modules/billing/social-plans.js
// Social Media AI plan selection page

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import Link from "next/link";
import ICONS from "../../../components/iconMap";

const PLANS = [
  {
    id: "social-starter",
    name: "Starter",
    price: 29,
    priceLabel: "A$29 / month",
    color: "#8126e9",
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
    priceLabel: "A$79 / month",
    color: "#7c3aed",
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
    name: "Pro",
    price: 149,
    priceLabel: "A$149 / month",
    color: "#6d28d9",
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
    name: "Agency",
    price: 299,
    priceLabel: "A$299 / month",
    color: "#4c1d95",
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (!user) return;
      const { data: acc } = await supabase
        .from("accounts")
        .select("social_plan_tier")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (acc?.[0]?.social_plan_tier) setCurrentTier(acc[0].social_plan_tier);
    })();
  }, []);

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const emailPlan = next?.emailPlan || asParam(router.query.emailPlan);
    const smsPlan = next?.smsPlan || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan = next?.socialPlan || asParam(router.query.socialPlan);

    if (emailPlan) params.set("emailPlan", emailPlan);
    if (smsPlan) params.set("smsPlan", smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);
    if (socialPlan) params.set("socialPlan", socialPlan);

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
        ? <span style={{ color: "#86efac", fontWeight: 700, fontSize: 18 }}>✓</span>
        : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>—</span>;
    }
    return <span>{val}</span>;
  }

  return (
    <div style={S.wrap}>
      {/* Banner */}
      <div style={S.banner}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={S.bannerIcon}>{ICONS.social({ size: 42 })}</div>
          <div>
            <h1 style={S.bannerTitle}>Social Media AI Plans</h1>
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
                <th key={p.id} style={{ ...S.th, ...(p.recommended ? S.highlightTh : {}), position: "relative" }}>
                  {p.recommended && (
                    <div style={S.badge}>Best Value</div>
                  )}
                  {currentTier === p.id && (
                    <div style={{ ...S.badge, background: "rgba(34,197,94,0.85)", color: "#000", top: -10 }}>✓ Active</div>
                  )}
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 15, opacity: 0.85, marginTop: 2 }}>{p.priceLabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr key={i}>
                <td style={S.tdFeature}>{f.label}</td>
                {PLANS.map(p => (
                  <td key={p.id} style={{ ...S.td, ...(p.recommended ? S.highlightTd : {}) }}>
                    {renderCell(p, f)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {PLANS.map(p => (
                <td key={p.id} style={{ ...S.td, ...(p.recommended ? S.highlightTd : {}) }}>
                  <button
                    onClick={() => selectPlan(p.id)}
                    style={{
                      ...S.selectBtn,
                      background: currentTier === p.id ? "rgba(34,197,94,0.2)" : p.color,
                      border: currentTier === p.id ? "2px solid #86efac" : "none",
                      color: currentTier === p.id ? "#86efac" : "#fff",
                    }}
                  >
                    {currentTier === p.id ? "Current Plan" : currentTier ? "Switch Plan" : "Select Plan"}
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
            <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: p.color, marginBottom: 8 }}>{p.priceLabel}</div>
            <ul style={{ margin: 0, padding: "0 0 0 16px", lineHeight: 2, color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
              <li>{p.aiPosts} / month</li>
              <li>{p.images} / month</li>
              <li>{p.platforms}</li>
              <li>{p.campaigns}</li>
              {p.scheduling && <li>Post scheduling</li>}
              {p.brandVoice && <li>Brand voice settings</li>}
              {p.multiAccount && <li>Multi-account / sub-brands</li>}
              <li>{p.support}</li>
            </ul>
            <button onClick={() => selectPlan(p.id)} style={{ ...S.selectBtn, background: p.color, marginTop: 14, width: "100%" }}>
              {currentTier === p.id ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto 40px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
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
  bannerTitle: { fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  bannerDesc: { margin: "4px 0 0", opacity: 0.85, fontSize: 15 },
  backBtn: {
    background: "rgba(0,0,0,0.3)",
    border: "1.5px solid rgba(255,255,255,0.3)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
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
    fontSize: 15,
    gap: 12,
  },
  dashBtn: {
    background: "rgba(34,197,94,0.2)",
    border: "1px solid rgba(34,197,94,0.5)",
    color: "#86efac",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  table: {
    maxWidth: 1320,
    margin: "0 auto 32px",
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
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
    background: "rgba(129,38,233,0.25)",
    border: "1px solid rgba(129,38,233,0.5)",
  },
  td: {
    padding: "12px 14px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.05)",
    background: "#0b1220",
    color: "rgba(255,255,255,0.75)",
  },
  highlightTd: {
    background: "rgba(129,38,233,0.1)",
    border: "1px solid rgba(129,38,233,0.2)",
  },
  tdFeature: {
    padding: "12px 14px",
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.05)",
    background: "#0b1220",
    color: "rgba(255,255,255,0.55)",
    fontWeight: 600,
    fontSize: 13,
  },
  badge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#f59e0b",
    color: "#111",
    fontSize: 10,
    fontWeight: 800,
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
    fontWeight: 700,
    fontSize: 14,
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
