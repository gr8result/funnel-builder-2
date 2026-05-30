// /pages/modules/billing/calendar-plans.js
// Calendar Booking Pricing Plans â€” 4 tiers with delta pricing

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";
import Link from "next/link";

const CALENDAR_TIER_ORDER  = ["calendar-starter", "calendar-growth", "calendar-pro", "calendar-agency"];
const CALENDAR_TIER_PRICES = {
  "calendar-starter": 19,
  "calendar-growth":  29,
  "calendar-pro":     79,
  "calendar-agency":  149,
};

const PLANS = [
  {
    id: "calendar-starter",
    name: "Starter",
    price: 19,
    priceLabel: "$19 / month",
    color: "#6366f1",
    features: ["1 calendar", "28 bookings / month", "1 booking page", "2 team members", "Email reminders"],
  },
  {
    id: "calendar-growth",
    name: "Growth",
    price: 29,
    priceLabel: "$29 / month",
    color: "#22c55e",
    features: ["5 calendars", "Unlimited bookings", "5 booking pages", "3 team members", "Email reminders", "Group booking", "Payments"],
  },
  {
    id: "calendar-pro",
    name: "Scale",
    price: 79,
    priceLabel: "$79 / month",
    color: "#f59e0b",
    recommended: true,
    features: ["Unlimited calendars", "Unlimited bookings", "Unlimited booking pages", "10 team members", "Email & SMS reminders", "Group booking", "Payments", "Custom branding", "Automations", "Advanced analytics"],
  },
  {
    id: "calendar-agency",
    name: "Professional",
    price: 149,
    priceLabel: "$149 / month",
    color: "#7c3aed",
    features: ["Everything in Scale", "25 team members", "Full analytics", "API access", "Priority support"],
  },
];

const FEATURES = [
  { label: "Calendars",        key: "calendars" },
  { label: "Bookings / month", key: "bookingsPerMonth" },
  { label: "Booking pages",    key: "bookingPages" },
  { label: "Team members",     key: "teamMembers" },
  { label: "Email reminders",  key: "emailReminders" },
  { label: "SMS reminders",    key: "smsReminders" },
  { label: "Group booking",    key: "groupBooking" },
  { label: "Payments",         key: "payments" },
  { label: "Custom branding",  key: "customBranding" },
  { label: "Automations",      key: "automations" },
  { label: "Analytics",        key: "analytics" },
  { label: "API access",       key: "apiAccess" },
];

const PLAN_FEATURES = {
  "calendar-starter": { calendars:"1", bookingsPerMonth:"28", bookingPages:"1", teamMembers:"2", emailReminders:true, smsReminders:false, groupBooking:false, payments:false, customBranding:false, automations:false, analytics:"Basic", apiAccess:false },
  "calendar-growth":  { calendars:"5", bookingsPerMonth:"Unlimited", bookingPages:"5", teamMembers:"3", emailReminders:true, smsReminders:false, groupBooking:true, payments:true, customBranding:false, automations:false, analytics:"Standard", apiAccess:false },
  "calendar-pro":     { calendars:"Unlimited", bookingsPerMonth:"Unlimited", bookingPages:"Unlimited", teamMembers:"10", emailReminders:true, smsReminders:true, groupBooking:true, payments:true, customBranding:true, automations:true, analytics:"Advanced", apiAccess:false },
  "calendar-agency":  { calendars:"Unlimited", bookingsPerMonth:"Unlimited", bookingPages:"Unlimited", teamMembers:"25", emailReminders:true, smsReminders:true, groupBooking:true, payments:true, customBranding:true, automations:true, analytics:"Full", apiAccess:true },
};

export default function CalendarPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [dbCalendarTier, setDbCalendarTier] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    const fetchUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      let resolvedUser = sessionData?.session?.user;
      if (!resolvedUser) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) { router.push("/login"); return; }
        resolvedUser = userData.user;
      }
      setUser(resolvedUser);
      // Skip DB tier when navigating from billing — use the base plan's included tier instead
      if (!router.query.basePlan) {
        const { data: acc } = await supabase.from("accounts")
          .select("calendar_plan_tier")
          .eq("user_id", resolvedUser.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (acc?.[0]?.calendar_plan_tier) setDbCalendarTier(acc[0].calendar_plan_tier);
      }
    };
    fetchUser();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Delta pricing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const asParam = (v) => (typeof v === "string" ? v : "");
  const basePlanId   = asParam(router.query.basePlan);
  const purchasedId  = dbCalendarTier || null; // from DB, not URL param
  const includedId   = basePlanId ? (BASE_PLAN_INCLUDES[basePlanId]?.calendar?.tierId || null) : null;

  function higherTier(a, b) {
    const ai = CALENDAR_TIER_ORDER.indexOf(a || "calendar-starter");
    const bi = CALENDAR_TIER_ORDER.indexOf(b || "calendar-starter");
    return ai >= bi ? a : b;
  }
  // When basePlanId is set, use the included tier (not the DB value which may be from a different plan).
  const currentTierId = basePlanId ? (includedId || null) : (higherTier(includedId, purchasedId) || null);
  const currentTierPrice = CALENDAR_TIER_PRICES[currentTierId] ?? 0;

  function getDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const planOrder = CALENDAR_TIER_ORDER.indexOf(plan.id);
    const curOrder  = CALENDAR_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }
  function getButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const planOrder = CALENDAR_TIER_ORDER.indexOf(plan.id);
    const curOrder  = CALENDAR_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
  }
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const basePlan     = asParam(router.query.basePlan);
    const emailPlan    = next?.emailPlan    || asParam(router.query.emailPlan);
    const smsPlan      = next?.smsPlan      || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan   = next?.socialPlan   || asParam(router.query.socialPlan);
    const crmPlan      = next?.crmPlan      || asParam(router.query.crmPlan);
    const funnelPlan   = next?.funnelPlan   || asParam(router.query.funnelPlan);
    if (basePlan)      params.set("basePlan",     basePlan);
    if (emailPlan)     params.set("emailPlan",    emailPlan);
    if (smsPlan)       params.set("smsPlan",      smsPlan);
    if (calendarPlan)  params.set("calendarPlan", calendarPlan);
    if (socialPlan)    params.set("socialPlan",   socialPlan);
    if (crmPlan)       params.set("crmPlan",      crmPlan);
    if (funnelPlan)    params.set("funnelPlan",   funnelPlan);
    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const selectPlan = (tierId) => {
    router.push(buildBillingUrl({ calendarPlan: tierId }));
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
    wrap:    { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px", display: "flex", justifyContent: "center" },
    inner:   { width: "100%", maxWidth: 1320 },
    banner:  { display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#84cc16,#4ade80)", padding: "24px 28px", borderRadius: 12, marginBottom: 30 },
    bannerLeft: { display: "flex", alignItems: "center", gap: 18 },
    bannerTitle: { fontSize: 48, fontWeight: 600, margin: 0, color: "#0c121a" },
    bannerDesc: { fontSize: 16, marginTop: 4, color: "rgba(12,18,26,0.75)" },
    backBtn: { background: "rgba(0,0,0,0.25)", border: "2px solid rgba(0,0,0,0.4)", color: "#0c121a", padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontWeight: 600 },
    grid:    { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 40 },
    card:    { background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" },
    cardActive: { border: "2px solid #86efac" },
    cardRec: { border: "2px solid #f59e0b" },
    recBadge: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20 },
    activeBadge: { position: "absolute", top: -12, right: 14, background: "rgba(34,197,94,0.85)", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20 },
    planName:  { fontSize: 22, fontWeight: 600, marginBottom: 4 },
    planPrice: { fontSize: 28, fontWeight: 600 },
    planDelta: { fontSize: 16, marginTop: 4, opacity: 0.7, minHeight: 18 },
    featureList: { listStyle: "none", padding: 0, margin: "16px 0 0", textAlign: "left", width: "100%", fontSize: 16, lineHeight: 2 },
    btn:    { marginTop: "auto", paddingTop: 20, width: "100%" },
    btnEl:  { width: "100%", padding: "10px 0", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer" },
    table:  { width: "100%", borderCollapse: "collapse", background: "#111827", borderRadius: 12, overflow: "hidden", marginBottom: 40 },
    th:     { padding: "14px 12px", background: "#1f2937", fontWeight: 600, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
    thLeft: { textAlign: "left" },
    td:     { padding: "11px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "center" },
    tdLeft: { textAlign: "left", fontWeight: 500 },
    hlTh:   { background: "rgba(245,158,11,0.25)" },
    hlTd:   { background: "rgba(245,158,11,0.08)" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        {/* Banner */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div><span style={{ fontSize: 48, lineHeight: 1 }}>📅</span></div>
            <div>
              <h1 style={S.bannerTitle}>Booking Calendar Plans</h1>
              <p style={S.bannerDesc}>Online scheduling, team booking &amp; automated reminders.</p>
            </div>
          </div>
          <Link href={buildBillingUrl({})}>
            <button style={S.backBtn}>← Back to Billing</button>
          </Link>
        </div>

        {/* Plan cards */}
        <div style={S.grid}>
          {PLANS.map((plan) => {
            const isActive = plan.id === currentTierId;
            const cardStyle = { ...S.card, ...(isActive ? { ...S.cardActive, border: `2px solid ${plan.color}`, boxShadow: `0 0 16px ${plan.color}44` } : {}) };
            const btnBg = isActive ? "transparent" : plan.color;
            const btnBorder = `2px solid ${plan.color}`;
            const btnColor = isActive ? plan.color : (plan.color === "#f59e0b" ? "#000" : "#fff");
            return (
              <div key={plan.id} style={cardStyle}>
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
