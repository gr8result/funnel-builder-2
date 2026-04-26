// /pages/modules/billing/sms-plans.js
// SMS Marketing subscription plans and pricing

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SmsPlans() {
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
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const plans = [
    {
      id: "sms-starter",
      name: "Starter",
      price: 25,
      messages: 500,
      costPer: 0.05,
      color: "#94a3b8",
      features: [
        "500 SMS messages/month",
        "Multi-tenant support",
        "Scheduled campaigns (3 steps)",
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
      color: "#facc15",
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
      name: "Professional",
      price: 229,
      messages: 5000,
      costPer: 0.046,
      color: "#38bdf8",
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
      name: "Business",
      price: 429,
      messages: 10000,
      costPer: 0.043,
      color: "#10b981",
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
              {ICONS.sms({ size: 48, strokeWidth: 2.5 })}
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
        {/* Plan Cards */}
        <div style={styles.grid}>
          {standardPlans.map((plan) => (
            <div key={plan.id} style={{ ...styles.card, borderColor: plan.color, position: "relative" }}>
              <h2 style={styles.planName}>{plan.name}</h2>
              {selectedPlan === plan.id && typeof plan.price === "number" && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "#38bdf8",
                  color: "#fff",
                  borderRadius: "0 8px 0 8px",
                  padding: "6px 16px",
                  fontWeight: 700,
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
                  <span style={styles.priceUnit}>/month</span>
                )}
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
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    handleSelectPlan(plan);
                  }}
                  style={{
                    ...styles.selectBtn,
                    background: plan.recommended ? "#38bdf8" : "#1e293b",
                    borderColor: plan.recommended ? "#38bdf8" : "#334155",
                  }}
                >
                  Select {plan.name}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise + Add-Ons */}
        {customPlan && (
          <div style={styles.enterpriseAddOnsRow}>
            <div style={styles.enterpriseCol}>
              <h2 style={styles.addOnsTitle}>Custom Plan</h2>
              <div style={{ ...styles.card, borderColor: customPlan.color, position: "relative" }}>
                <h2 style={styles.planName}>{customPlan.name}</h2>
                <div style={styles.priceWrap}>
                  <span style={styles.price}>
                    {customPlan.price === "Custom" ? "Custom" : `$${customPlan.price}`}
                  </span>
                  {customPlan.price !== "Custom" && (
                    <span style={styles.priceUnit}>/month</span>
                  )}
                </div>
                <div style={styles.messagesInfo}>
                  {typeof customPlan.messages === "number"
                    ? `${customPlan.messages.toLocaleString()} messages/month`
                    : customPlan.messages}
                </div>
                <div style={styles.cardBody}>
                  <ul style={styles.featureList}>
                    {customPlan.features.map((feature, i) => (
                      <li key={i} style={styles.feature}>
                        <span style={styles.checkmark}>✓</span> {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      setSelectedPlan(customPlan.id);
                      handleSelectPlan(customPlan);
                    }}
                    style={{ ...styles.selectBtn, background: "#1e293b", borderColor: "#334155" }}
                  >
                    Select {customPlan.name}
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.addOnsSection}>
              <h2 style={styles.addOnsTitle}>Optional Add-Ons</h2>
              <div style={styles.addOnsGrid}>
                {addOns.map((addon) => (
                  <div key={addon.id} style={styles.addOnCard}>
                    <div style={styles.addOnIcon}>{addon.icon}</div>
                    <div style={styles.addOnContent}>
                      <h3 style={styles.addOnName}>{addon.name}</h3>
                      <p style={styles.addOnDesc}>{addon.description}</p>
                      <div style={styles.addOnPrice}>${addon.price}/month</div>
                    </div>
                    <button
                      onClick={() => handleSelectAddOn(addon)}
                      style={styles.addOnBtn}
                    >
                      Add to Plan
                    </button>
                  </div>
                ))}
              </div>

              {/* Info Section */}
              <div style={styles.infoBoxInRow}>
                <h3 style={styles.infoTitle}>💡 About SMS Marketing</h3>
                <p style={styles.infoPara}>
                  <strong>SMS Marketing</strong> allows you to send text messages directly
                  to your leads and customers. With industry-leading open rates (98%+),
                  SMS is one of the most effective marketing channels available.
                </p>
                <p style={styles.infoPara}>
                  All plans include multi-tenant support, scheduled campaigns, delivery
                  tracking, and our template library. Upgrade anytime as your needs grow.
                </p>
                <p style={styles.infoPara}>
                  <strong>Note:</strong> SMS requires approved sender ID registration with
                  SMSGlobal. Our team will assist you during account setup.
                </p>
              </div>
            </div>
          </div>
        )}
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
    fontSize: 12,
    borderRadius: 8,
    fontWeight: 700,
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
    fontWeight: 700,
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
    fontWeight: 800,
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
    fontSize: 13,
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
    fontWeight: 700,
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
    fontWeight: 700,
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
    fontWeight: 700,
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
    fontWeight: 700,
  },

  addOnDesc: {
    margin: "0 0 8px 0",
    fontSize: 16,
    opacity: 0.85,
  },

  addOnPrice: {
    fontSize: 20,
    fontWeight: 700,
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
    fontWeight: 700,
    color: "#38bdf8",
  },

  infoPara: {
    margin: "0 0 12px 0",
    fontSize: 16,
    lineHeight: 1.6,
    opacity: 0.9,
  },
};
