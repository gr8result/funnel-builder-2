// pages/store/test-checkout.js
// Simple test page: one button that calls /api/store/create-checkout-session

import { useState } from "react";

export default function TestCheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuyNow() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/store/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
        product_id: "prod_TBn6NArYKdD9Ho",
        user_id: "cfe0a3a8-7c65-4c49-acda-0ed9eaeb8126",
        contact_id: "0d14c905-8ae0-4c65-b8d3-bb4d4b00a7f9",
        quantity: 1,
        }),

      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unknown error");
      }

      if (data.url) {
        // redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          background: "#0b1120",
          padding: "32px 40px",
          borderRadius: 16,
          boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Store Test Checkout</h1>
        <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 20 }}>
          Click the button below to create a Stripe checkout session using the
          new store API.
        </p>

        <button
          onClick={handleBuyNow}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            cursor: loading ? "default" : "pointer",
            fontWeight: 600,
            fontSize: 16,
            background: loading ? "#4b5563" : "#22c55e",
            color: "#020617",
          }}
        >
          {loading ? "Creating Checkout..." : "Test Buy Now"}
        </button>

        {error && (
          <div
            style={{
              marginTop: 16,
              fontSize: 13,
              color: "#fecaca",
              background: "#7f1d1d",
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            Error: {error}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          This is only a test page for wiring up the store checkout. You can
          delete it later.
        </div>
      </div>
    </div>
  );
}
