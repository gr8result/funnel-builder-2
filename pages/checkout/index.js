// /pages/checkout/index.js
// Confirm Your Subscription — Stripe + PayPal fully working

import { useRouter } from "next/router";
import { useState } from "react";
import ICONS from "../../components/iconMap";
import PRICING, { BASE_PLANS } from "../../data/pricing";

export default function Checkout() {
  const router = useRouter();
  const { selected = "", plan = "", emailPlan = "", smsPlan = "", calendarPlan = "", socialPlan = "" } = router.query;
  const [loading, setLoading] = useState(false);

  const selectedModules = selected.split(",").filter(Boolean);
  const basePlan = BASE_PLANS[plan] || null;

  const modulesTotal = selectedModules.reduce(
    (sum, id) => sum + (PRICING[id]?.price || 0),
    0
  );
  const totalAmount = modulesTotal + (basePlan?.price || 0);

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

      // Base plan first, then add-on modules
      const lineItems = [];
      if (basePlan) {
        lineItems.push({ name: basePlan.name, amount: basePlan.price });
      }
      selectedModules.forEach((id) => {
        lineItems.push({
          name: PRICING[id]?.name || id,
          amount: PRICING[id]?.price || 0,
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

  // ✅ PAYPAL CHECKOUT (working fine)
  const handlePayPalCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      const emailPlanParam = params.get("emailPlan") || emailPlan || "";
      const smsPlanParam = params.get("smsPlan") || smsPlan || "";
      const calendarPlanParam = params.get("calendarPlan") || calendarPlan || "";
      const socialPlanParam = params.get("socialPlan") || socialPlan || "";
      const selectedParam = params.get("selected") || selected || "";

      const items = selectedModules.map((id) => ({
        name: PRICING[id]?.name || id,
        price: PRICING[id]?.price || 0,
      }));

      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          total: totalAmount,
          metadata: {
            selected: selectedParam,
            emailPlan: emailPlanParam,
            smsPlan: smsPlanParam,
            calendarPlan: calendarPlanParam,
            socialPlan: socialPlanParam,
          },
        }),
      });

      const data = await res.json();

      if (data?.links) {
        const approveLink = data.links.find((l) => l.rel === "approve");
        if (approveLink?.href) {
          window.location.href = approveLink.href;
          return;
        }
      }

      if (data.error) alert(data.error);
      else alert("PayPal checkout failed — no approval URL returned");
    } catch (err) {
      console.error("PayPal checkout error:", err);
      alert("Something went wrong with PayPal checkout");
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
              <span style={{ color: "#22c55e" }}>A${basePlan.price.toFixed(2)}/mo</span>
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {selectedModules.map((id) => (
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
                <span>A${PRICING[id]?.price?.toFixed(2) || "0.00"}/mo</span>
              </li>
            ))}
          </ul>

          <p style={{ textAlign: "right", fontWeight: 600, fontSize: 18, marginTop: 12 }}>
            Total: A${totalAmount.toFixed(2)}/Mo
          </p>

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

            <button
              onClick={handlePayPalCheckout}
              disabled={loading}
              style={{
                width: "100%",
                background: "#facc15",
                color: "#000",
                padding: "14px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 16,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 10,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Processing..." : "Pay with PayPal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
