// /pages/cancel/[token].js
// FULL FILE — Public booking cancellation page
// - Token based
// - No login required
// - Handles invalid token
// - Clean confirmation UI

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function CancelBookingPage() {

  const router = useRouter();
  const { token } = router.query;

  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle"); 
  // idle | cancelling | success | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCancel() {

    if (!token) return;

    setStatus("cancelling");

    try {
      const res = await fetch("/api/calendar/cancel-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Cancellation failed");
        return;
      }

      setStatus("success");

    } catch (err) {
      setStatus("error");
      setErrorMessage("Unexpected error occurred");
    }
  }

  if (status === "success") {
    return (
      <div style={{ padding: 40, maxWidth: 600, margin: "auto" }}>
        <h1>Booking Cancelled</h1>
        <p>Your appointment has been successfully cancelled.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "auto" }}>

      <h1>Cancel Booking</h1>

      <p>
        If you would like to cancel your booking, you may optionally provide a reason below.
      </p>

      {status === "error" && (
        <div style={{ color: "red", marginBottom: 20 }}>
          {errorMessage}
        </div>
      )}

      <textarea
        placeholder="Reason for cancellation (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{
          width: "100%",
          height: 120,
          padding: 10,
          marginBottom: 20,
          borderRadius: 6,
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={handleCancel}
        disabled={status === "cancelling"}
        style={{
          padding: "12px 24px",
          background: "#ef4444",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          opacity: status === "cancelling" ? 0.6 : 1,
        }}
      >
        {status === "cancelling" ? "Cancelling..." : "Confirm Cancellation"}
      </button>

    </div>
  );
}