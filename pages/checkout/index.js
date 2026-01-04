// /pages/checkout/index.js
// Confirm Your Subscription — Stripe + PayPal fully working

import { useRouter } from "next/router";
import { useState } from "react";
import ICONS from "../../components/iconMap";
import PRICING from "../../data/pricing";

export default function Checkout() {
  const router = useRouter();
  const { selected = "" } = router.query;
  const [loading, setLoading] = useState(false);

  const selectedModules = selected.split(",").filter(Boolean);
  const totalAmount = selectedModules.reduce(
    (sum, id) => sum + (PRICING[id]?.price || 0),
    0
  );

  // ✅ STRIPE CHECKOUT (fixed payload)
  const handleStripeCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (selectedModules.length === 0) {
        alert("No modules selected");
        return;
      }

      // ✅ This structure matches /api/billing/create-session.js
      const lineItems = selectedModules.map((id) => ({
        name: PRICING[id]?.name || id,
        amount: PRICING[id]?.price || 0,
      }));

      const res = await fetch("/api/billing/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems }),
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
      const items = selectedModules.map((id) => ({
        name: PRICING[id]?.name || id,
        price: PRICING[id]?.price || 0,
      }));

      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total: totalAmount }),
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
          <h1 style={{ color: "#000", fontWeight: 800 }}>Confirm Your Subscription</h1>
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
          <h2>Selected Modules:</h2>
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
                <span>A${PRICING[id]?.price?.toFixed(2) || "0.00"}/Mo</span>
              </li>
            ))}
          </ul>

          <p style={{ textAlign: "right", fontWeight: 800, fontSize: 18, marginTop: 12 }}>
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
                fontWeight: 800,
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
                fontWeight: 800,
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
