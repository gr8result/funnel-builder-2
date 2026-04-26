// /pages/booking-success.js
// FULL FILE — Stripe Booking Success Page

import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function BookingSuccess() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c121a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
        color: "white",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          width: "100%",
          background: "#111827",
          padding: 50,
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <CheckCircle size={64} color="#22c55e" />

        <h1 style={{ fontSize: 36, marginTop: 20 }}>
          Booking Confirmed
        </h1>

        <p style={{ fontSize: 18, marginTop: 15, opacity: 0.8 }}>
          Your payment was successful and your booking has been
          secured.
        </p>

        <Link href="/">
          <button
            style={{
              marginTop: 30,
              padding: "14px 28px",
              background: "#22c55e",
              border: "none",
              borderRadius: 8,
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Return to Home
          </button>
        </Link>
      </div>
    </div>
  );
}