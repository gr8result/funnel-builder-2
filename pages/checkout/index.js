// /pages/checkout/index.js
// Confirm Your Subscription — Stripe subscription checkout

import { useRouter } from "next/router";
import { useState } from "react";
import ICONS from "../../components/iconMap";
import PRICING, { BASE_PLAN_INCLUDES, BASE_PLANS } from "../../data/pricing";

const getBasePlanModuleKey = (moduleId) => {
  if (moduleId === "website-builder") return "website";
  if (moduleId === "projects-hub") return "projectsHub";
  return moduleId;
};

export default function Checkout() {
  const router = useRouter();
  const { selected = "", plan = "", emailPlan = "", smsPlan = "", calendarPlan = "", socialPlan = "", annual = "" } = router.query;
  const [loading, setLoading] = useState(false);

  const selectedModules = selected.split(",").filter(Boolean);
  const basePlan = BASE_PLANS[plan] || null;
  const isAnnual = annual === "1";
  const billableModules = selectedModules.filter((id) => !basePlan || !BASE_PLAN_INCLUDES[basePlan.id]?.[getBasePlanModuleKey(id)]);

  const monthlyModulesTotal = billableModules.reduce(
    (sum, id) => sum + (PRICING[id]?.price || 0),
    0
  );
  const moduleBillingTotal = isAnnual ? monthlyModulesTotal * 12 * 0.80 : monthlyModulesTotal;
  const basePlanBillingAmount = basePlan
    ? (isAnnual ? basePlan.price * 12 * 0.80 : basePlan.price)
    : 0;
  const totalAmount = moduleBillingTotal + basePlanBillingAmount;
  const introDiscountPercent = !isAnnual ? (basePlan?.introDiscountPercent || 0) : 0;
  const introMonths = basePlan?.introMonths || 0;
  const trialDays = basePlan?.trialDays || 14;
  const introBasePlanAmount = introDiscountPercent > 0 && basePlan
    ? basePlan.price * (1 - introDiscountPercent / 100)
    : (basePlan?.price || 0);
  const introTotalAmount = monthlyModulesTotal + introBasePlanAmount;
  const introPrepaidTotalAmount = introMonths > 0 ? introTotalAmount * introMonths : introTotalAmount;

  // ✅ STRIPE CHECKOUT (fixed payload)
  const handleStripeCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!basePlan && selectedModules.length === 0) {
        alert("No plan or modules selected");
        return;
      }

      // ✅ This structure matches /api/billing/create-session.js
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      const emailPlanParam = params.get("emailPlan") || emailPlan || "";
      const smsPlanParam = params.get("smsPlan") || smsPlan || "";
      const calendarPlanParam = params.get("calendarPlan") || calendarPlan || "";
      const socialPlanParam = params.get("socialPlan") || socialPlan || "";
      const selectedParam = params.get("selected") || selected || "";
      const planParam = params.get("plan") || plan || "";
      const annualParam = params.get("annual") || annual || "";

      // Base plan first, then add-on modules
      const lineItems = [];
      if (basePlan) {
        lineItems.push({ name: basePlan.name, amount: basePlanBillingAmount });
      }
      billableModules.forEach((id) => {
        lineItems.push({
          name: PRICING[id]?.name || id,
          amount: isAnnual ? (PRICING[id]?.price || 0) * 12 * 0.80 : (PRICING[id]?.price || 0),
        });
      });

      const res = await fetch("/api/billing/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems,
          metadata: {
            selected: selectedParam,
            plan: planParam,
            emailPlan: emailPlanParam,
            smsPlan: smsPlanParam,
            calendarPlan: calendarPlanParam,
            socialPlan: socialPlanParam,
            annual: annualParam,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Stripe checkout failed");
      }
    } catch (err) {
      console.error("Stripe checkout error:", err);
      alert("Something went wrong with Stripe checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            background: "#f59e0b",
            borderRadius: 10,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>{ICONS.billing({ size: 24 })}</span>
          <h1 style={{ color: "#000", fontWeight: 600 }}>Confirm Your Subscription</h1>
        </div>

        <div
          style={{
            background: "#111827",
            borderRadius: 10,
            marginTop: 30,
            padding: 28,
            border: "1px solid #333",
          }}
        >
          <h2>Order Summary:</h2>
          {basePlan && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b", fontWeight: 600 }}>
              <span>📦 {basePlan.name}</span>
              <span style={{ color: "#22c55e" }}>A${basePlanBillingAmount.toFixed(2)}/{isAnnual ? "yr" : "mo"}</span>
            </div>
          )}
          {basePlan && introDiscountPercent > 0 && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.45)", borderRadius: 8, padding: 12, margin: "12px 0", color: "#d1fae5" }}>
              <strong style={{ color: "#22c55e" }}>Onboarding offer:</strong> To take advantage of the {trialDays}-day free trial and {introDiscountPercent}% off your first {introMonths} months, your first {introMonths} paid months are billed upfront as one onboarding payment. No payment is processed today. If you do not cancel before the trial ends, <strong>A${introPrepaidTotalAmount.toFixed(2)}</strong> will be charged after the trial, then your account continues at <strong>A${totalAmount.toFixed(2)}/mo</strong> after the prepaid onboarding period.
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {billableModules.map((id) => (
              <li
                key={id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <span>{PRICING[id]?.name || id}</span>
                <span>A${(isAnnual ? (PRICING[id]?.price || 0) * 12 * 0.80 : (PRICING[id]?.price || 0)).toFixed(2)}/{isAnnual ? "yr" : "mo"}</span>
              </li>
            ))}
          </ul>

          <p style={{ textAlign: "right", fontWeight: 600, fontSize: 18, marginTop: 12 }}>
            {introDiscountPercent > 0
              ? <>First Payment After Trial: A${introPrepaidTotalAmount.toFixed(2)}</>
              : <>Total: A${totalAmount.toFixed(2)}/{isAnnual ? "Yr" : "Mo"}</>}
          </p>
          {introDiscountPercent > 0 && (
            <p style={{ textAlign: "right", color: "#9ca3af", marginTop: -6 }}>
              Covers your first {introMonths} paid months. Ongoing after that: A${totalAmount.toFixed(2)}/Mo
            </p>
          )}

          <div style={{ marginTop: 26 }}>
            <button
              onClick={handleStripeCheckout}
              disabled={loading}
              style={{
                width: "100%",
                background: "#22c55e",
                color: "#000",
                padding: "14px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 16,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Processing..." : "Proceed with Stripe"}
            </button>

            <div style={{ marginTop: 12, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
              Secure subscription billing is currently processed by Stripe.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
