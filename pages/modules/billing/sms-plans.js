// /pages/modules/billing/sms-plans.js
// SMS Marketing subscription plans and pricing

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

const SMS_TIER_ORDER  = ["sms-starter", "sms-growth", "sms-professional", "sms-business", "sms-enterprise"];
const SMS_TIER_PRICES = { "sms-starter": 25, "sms-growth": 120, "sms-professional": 229, "sms-business": 429, "sms-enterprise": null };

export default function SmsPlans() {
    const asParam = (value) => (typeof value === "string" ? value : "");

    const buildBillingUrl = (next) => {
      const params = new URLSearchParams();
      const basePlan    = asParam(router.query.basePlan);
      const emailPlan   = next?.emailPlan    || asParam(router.query.emailPlan);
      const smsPlan     = next?.smsPlan      || asParam(router.query.smsPlan);
      const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
      const socialPlan  = next?.socialPlan   || asParam(router.query.socialPlan);
      const crmPlan     = next?.crmPlan      || asParam(router.query.crmPlan);
      const funnelPlan  = next?.funnelPlan   || asParam(router.query.funnelPlan);

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

    // Stripe Checkout handler
    const handleSelectPlan = async (plan) => {
      try {
        if (!user) {
          alert("Please log in to select a plan.");
          return;
        }
        if (!plan.stripePriceId) {
          alert("Contact sales for custom pricing.");
          return;
        }
        // Map plan id to correct tier key
        router.push(buildBillingUrl({ smsPlan: plan.id }));
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const u = session?.session?.user || null;
      setUser(u);
    })();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delta pricing ─────────────────────────────────────────────────────
  const basePlanId     = typeof router.query.basePlan === "string" ? router.query.basePlan : null;
  const includedTier   = basePlanId ? BASE_PLAN_INCLUDES[basePlanId]?.sms : null;
  const includedId     = includedTier?.tierId || null;
  function higherSmsTier(a, b) {
    return (SMS_TIER_ORDER.indexOf(a ?? "sms-starter") >= SMS_TIER_ORDER.indexOf(b ?? "sms-starter")) ? a : b;
  }
  const currentTierId = includedId || null;
  const currentTierPrice = SMS_TIER_PRICES[currentTierId] ?? 0;
  function getSmsDeltaLabel(plan) {
    if (plan.id === currentTierId) return "✓ Your Current Level";
    const planOrder = SMS_TIER_ORDER.indexOf(plan.id);
    const curOrder  = SMS_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    if (plan.price === "Custom" || plan.price == null) return "Contact Sales";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Included" : `+$${delta}/mo extra`;
  }
  function getSmsButtonLabel(plan) {
    if (plan.id === currentTierId) return "Current Plan";
    const planOrder = SMS_TIER_ORDER.indexOf(plan.id);
    const curOrder  = SMS_TIER_ORDER.indexOf(currentTierId);
    if (planOrder < curOrder) return "Downgrade";
    if (plan.price === "Custom" || plan.price == null) return "Contact Sales";
    const delta = plan.price - currentTierPrice;
    return delta === 0 ? "Upgrade (included)" : `Upgrade — add $${delta}/mo`;
  }
  // ────────────────────────────────────────────────────────────

  const plans = [
    {
      id: "sms-starter",
      name: "Starter",
      price: 25,
      messages: 500,
      costPer: 0.05,
      color: "#6366f1",
      features: [
        "500 SMS messages/month",
        "Multi-tenant support",
        "Single SMS sending",
        "Lead-based targeting",
        "Delivery tracking",
        "Template library",
        "Emoji support",
      ],
      stripePriceId: "price_1SyhQn0KNC1tosndOrQpqQ77", // /v1/prices/price_1SyhQn0KNC1tosndOrQpqQ77
    },
    {
      id: "sms-growth",
      name: "Growth",
      price: 120,
      messages: 2500,
      costPer: 0.048,
      color: "#22c55e",
      features: [
        "2,500 SMS messages/month",
        "Multi-tenant support",
        "Scheduled campaigns (3 steps)",
        "Single SMS sending",
        "Lead-based targeting",
        "Delivery tracking",
        "Template library",
        "Emoji support",
        "Priority delivery",
        "Advanced analytics",
      ],
      stripePriceId: "price_1TCCgC0KNC1tosndLUcS9W4I", // /v1/prices/price_1TCCgC0KNC1tosndLUcS9W4I
    },
    {
      id: "sms-professional",
      name: "Scale",
      price: 229,
      messages: 5000,
      costPer: 0.046,
      color: "#f59e0b",
      recommended: true,
      features: [
        "5,000 SMS messages/month",
        "Multi-tenant support",
        "Scheduled campaigns (3 steps)",
        "Single SMS sending",
        "Lead-based targeting",
        "Delivery tracking",
        "Template library",
        "Emoji support",
        "Priority delivery",
        "Advanced analytics",
        "Dedicated support",
      ],
      stripePriceId: "price_1TCCgd0KNC1tosndtpEnOcQy", // /v1/prices/price_1TCCgd0KNC1tosndtpEnOcQy
    },
    {
      id: "sms-business",
      name: "Professional",
      price: 429,
      messages: 10000,
      costPer: 0.043,
      color: "#7c3aed",
      features: [
        "10,000 SMS messages/month",
        "Multi-tenant support",
        "Scheduled campaigns (3 steps)",
        "Single SMS sending",
        "Lead-based targeting",
        "Delivery tracking",
        "Template library",
        "Emoji support",
        "Priority delivery",
        "Advanced analytics",
        "Dedicated support",
        "Custom sender ID",
        "API access",
      ],
      stripePriceId: "price_1TCCgw0KNC1tosndi8wM5NuJ", // /v1/prices/price_1TCCgw0KNC1tosndi8wM5NuJ
    },
    {
      id: "sms-enterprise",
      name: "Enterprise",
      price: "Custom",
      messages: "Unlimited",
      costPer: "Negotiable",
      color: "#a855f7",
      features: [
        "Unlimited SMS messages",
        "Multi-tenant support",
        "Scheduled campaigns (unlimited steps)",
        "Single SMS sending",
        "Lead-based targeting",
        "Delivery tracking",
        "Template library",
        "Emoji support",
        "Priority delivery",
        "Advanced analytics",
        "Dedicated support",
        "Custom sender ID",
        "API access",
        "White-label options",
        "Custom integrations",
      ],
      stripePriceId: null,
    },
    // ...existing code...
  ];

  const addOns = [
    {
      id: "dedicated-number",
      name: "Dedicated Phone Number",
      price: 35,
      description: "Get your own dedicated Australian phone number for SMS",
      icon: "📞",
      stripePriceId: "price_1TCDvM0KNC1tosndbeVwdU1F", // /v1/prices/price_1TCDvM0KNC1tosndbeVwdU1F
    },
    {
      id: "extra-messages-1k",
      name: "Extra 1,000 Messages",
      price: 50,
      description: "Add-on pack for when you exceed your monthly limit",
      icon: "📨",
      stripePriceId: "price_1TCDww0KNC1tosndAJh4jwyr", // /v1/prices/price_1TCDww0KNC1tosndAJh4jwyr
    },
  ];

  const customPlan = plans.find((plan) => plan.id === "sms-enterprise");
  const standardPlans = plans.filter((plan) => plan.id !== "sms-enterprise");


  async function handleSelectAddOn(addon) {
    try {
      if (!user) {
        alert("Please log in to add this feature.");
        return;
      }

      alert(`✅ ${addon.name} add-on will be added to your next invoice.`);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        {/* Banner */}
        <div style={styles.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={styles.iconBox}>
              <span style={{ fontSize: 42, lineHeight: 1 }}>💬</span>
            </div>
            <div>
              <h1 style={styles.title}>SMS Marketing Plans</h1>
              <p style={styles.subtitle}>
                Reach your customers instantly — upgrade anytime.
              </p>
            </div>
          </div>
          <Link href="/billing">
            <button style={styles.backBtn}>← Back</button>
          </Link>
        </div>
        {/* Base plan context banner */}
        {currentTierId !== "sms-starter" && (
          <div style={{ marginBottom: 20, padding: "10px 16px", background: "#111827", borderRadius: 10, border: "1px solid #1f2937", color: "#9ca3af", fontSize: 16 }}>
            {basePlanId
              ? <><strong style={{ color: "#fff" }}>{basePlanId.charAt(0).toUpperCase() + basePlanId.slice(1)}</strong> plan includes SMS up to the <strong style={{ color: "#38bdf8" }}>{currentTierId.replace("sms-", "").charAt(0).toUpperCase() + currentTierId.replace("sms-", "").slice(1)}</strong> tier (${currentTierPrice}/mo value). You only pay the <strong style={{ color: "#22c55e" }}>extra difference</strong> to upgrade beyond that.</>
              : <><strong style={{ color: "#38bdf8" }}>Current tier: {currentTierId}</strong> (${currentTierPrice}/mo). Upgrade cost shown is the additional monthly charge.</>}
          </div>
        )}
        {/* Plan Cards */}
        <div style={styles.grid}>
          {standardPlans.map((plan) => (
            <div key={plan.id} style={{ ...styles.card, borderColor: plan.color, position: "relative" }}>
              <h2 style={{ ...styles.planName, color: plan.color }}>{plan.name}</h2>
              {selectedPlan === plan.id && typeof plan.price === "number" && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: plan.color,
                  color: plan.color === "#f59e0b" ? "#000" : "#fff",
                  borderRadius: "0 8px 0 8px",
                  padding: "6px 16px",
                  fontWeight: 600,
                  fontSize: 16,
                  zIndex: 2,
                }}>
                  Selected: ${plan.price}/mo
                </div>
              )}
              <div style={styles.priceWrap}>
                <span style={styles.price}>
                  {plan.price === "Custom" ? "Custom" : `$${plan.price}`}
                </span>
                {plan.price !== "Custom" && (
                  <span style={styles.priceUnit}>/month full price</span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: plan.id === currentTierId ? plan.color : SMS_TIER_ORDER.indexOf(plan.id) < SMS_TIER_ORDER.indexOf(currentTierId) ? "#6b7280" : "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                {getSmsDeltaLabel(plan)}
              </div>
              <div style={styles.messagesInfo}>
                {typeof plan.messages === "number"
                  ? `${plan.messages.toLocaleString()} messages/month`
                  : plan.messages}
              </div>
              {typeof plan.costPer === "number" && (
                <div style={styles.costPerMsg}>
                  ${plan.costPer.toFixed(3)} per message
                </div>
              )}
              <div style={styles.cardBody}>
                <ul style={styles.featureList}>
                  {plan.features.map((feature, i) => (
                    <li key={i} style={styles.feature}>
                      <span style={styles.checkmark}>✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={plan.id === currentTierId}
                  onClick={() => {
                    if (plan.id === currentTierId) return;
                    setSelectedPlan(plan.id);
                    handleSelectPlan(plan);
                  }}
                  style={{
                    ...styles.selectBtn,
                    background: plan.id === currentTierId ? "transparent" : plan.color,
                    border: `2px solid ${plan.color}`,
                    color: plan.id === currentTierId ? plan.color : (plan.color === "#f59e0b" ? "#000" : "#fff"),
                    opacity: plan.id === currentTierId ? 0.8 : 1,
                    cursor: plan.id === currentTierId ? "default" : "pointer",
                  }}
                >
                  {getSmsButtonLabel(plan)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },

  // Banner (matching spec: #38bdf8, 48px titles, 18px subtitle/button)
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#06b6d6", // CRM cyan for consistency
    color: "#fff",
    padding: "20px 28px",
    borderRadius: 14,
    marginBottom: 32,
    boxShadow: "0 8px 24px rgba(6,182,214,0.3)",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    background: "rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: 18,
    fontWeight: 500,
    opacity: 0.95,
  },
  backBtn: {
    background: "rgba(0,0,0,0.2)",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.3)",
    borderRadius: 10,
    padding: "8px 16px",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // Pricing Cards Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginBottom: 40,
  },

  card: {
    background: "#111827",
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,0.1)",
    overflow: "hidden",
    position: "relative",
    transition: "transform 0.2s, box-shadow 0.2s",
  },

  recommendedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    background: "#06b6d6",
    color: "#fff",
    padding: "6px 12px",
    fontSize: 16,
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 2,
    boxShadow: "0 4px 12px rgba(6,182,214,0.5)",
  },

  cardHeader: {
    padding: "24px 20px",
    color: "#fff",
    textAlign: "center",
  },

  planName: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 8,
  },

  priceWrap: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
    marginBottom: 8,
  },

  price: {
    fontSize: 42,
    fontWeight: 600,
    lineHeight: 1,
  },

  priceUnit: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.9,
  },

  messagesInfo: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.95,
    marginBottom: 4,
  },

  costPerMsg: {
    fontSize: 16,
    fontWeight: 500,
    opacity: 0.85,
  },

  cardBody: {
    padding: "24px 20px",
  },

  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 20px 0",
  },

  feature: {
    padding: "8px 0",
    fontSize: 16,
    fontWeight: 500,
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  },

  checkmark: {
    color: "#38bdf8",
    fontWeight: 600,
    fontSize: 16,
    flexShrink: 0,
  },

  selectBtn: {
    width: "100%",
    padding: "12px 20px",
    border: "2px solid",
    borderRadius: 10,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Add-Ons Section
  enterpriseAddOnsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
    marginBottom: 32,
    alignItems: "start",
  },

  enterpriseCol: {
    minWidth: 0,
    maxWidth: 360,
    width: "100%",
  },

  addOnsSection: {
    marginTop: 0,
    marginBottom: 0,
  },

  addOnsTitle: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 20,
    color: "#38bdf8",
  },

  addOnsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
  },


  card: {
    background: "#111827",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 12,
    padding: "24px 24px 20px 24px", // Add left/right padding
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 280,
  },

  addOnCard: {
    background: "#111827",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 12,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  addOnIcon: {
    fontSize: 40,
    flexShrink: 0,
  },

  addOnContent: {
    flex: 1,
  },

  addOnName: {
    margin: "0 0 6px 0",
    fontSize: 18,
    fontWeight: 600,
  },

  addOnDesc: {
    margin: "0 0 8px 0",
    fontSize: 16,
    opacity: 0.85,
  },

  addOnPrice: {
    fontSize: 20,
    fontWeight: 600,
    color: "#38bdf8",
  },

  addOnBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // Info Box
  infoBox: {
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 12,
    padding: 24,
    marginTop: 32,
  },

  infoBoxInRow: {
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 12,
    padding: 24,
    marginTop: 20,
  },

  infoTitle: {
    margin: "0 0 16px 0",
    fontSize: 22,
    fontWeight: 600,
    color: "#38bdf8",
  },

  infoPara: {
    margin: "0 0 12px 0",
    fontSize: 16,
    lineHeight: 1.6,
    opacity: 0.9,
  },
};
