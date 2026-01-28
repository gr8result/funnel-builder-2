// /components/telephony/BrowserDialer.js
// FULL REPLACEMENT
//
// ✅ Sends lead_id on every call so the call can be logged against the lead
// ✅ Uses Twilio Voice SDK v2 correctly (register())
// ✅ Backwards-compatible props:
//    - accepts toNumber OR phone
//    - accepts leadId OR lead_id
//
// Requires API route:
//   /api/telephony/voice-token  -> { ok:true, token:"..." } (you already have)
//
// Uses TwiML route that you already use in your project:
//   /api/twilio/voice-client?To=...&lead_id=...&record=1
//
// IMPORTANT: This file matches how your LeadDetailsModal calls it:
//   <BrowserDialer toNumber={dialToNumber} displayName={...} userId={...} leadId={lead.id} />

import { useEffect, useRef, useState } from "react";

export default function BrowserDialer({
  toNumber,
  phone,
  leadId,
  lead_id,
  displayName,
}) {
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const [status, setStatus] = useState("loading"); // loading | ready | calling | error
  const [error, setError] = useState("");

  const dialTo = String(toNumber || phone || "").trim();
  const lead = String(leadId || lead_id || "").trim();

  async function fetchToken() {
    const r = await fetch("/api/telephony/voice-token");
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.token) throw new Error(j?.error || "Token failed");
    return j.token;
  }

  async function initDevice() {
    setStatus("loading");
    setError("");

    const { Device } = await import("@twilio/voice-sdk");
    const token = await fetchToken();

    // Clean up any old device
    if (deviceRef.current) {
      try {
        deviceRef.current.destroy();
      } catch {}
      deviceRef.current = null;
    }

    const device = new Device(token, {
      logLevel: "error",
      closeProtection: false,
    });

    device.on("registered", () => setStatus("ready"));

    device.on("error", (e) => {
      console.error("Twilio Device error:", e);
      setError(e?.message || "Twilio error");
      setStatus("error");
    });

    device.on("tokenWillExpire", async () => {
      try {
        const newToken = await fetchToken();
        device.updateToken(newToken);
      } catch (e) {
        console.error("Token refresh failed:", e);
      }
    });

    deviceRef.current = device;
    await device.register(); // ✅ required
  }

  async function callNow() {
    if (!deviceRef.current || status !== "ready") return;
    if (!dialTo) return alert("No phone number to call.");

    setStatus("calling");

    try {
      // These params go to your TwiML endpoint (voice-client) via Twilio’s Voice SDK
      const params = {
        To: dialTo,
        record: "1",
      };

      // THIS is what links the call to the lead in Supabase
      if (lead) params.lead_id = lead;

      // optional: just metadata (handy for debugging / future)
      if (displayName) params.display_name = String(displayName);

      callRef.current = await deviceRef.current.connect({ params });

      callRef.current.on("disconnect", () => {
        setStatus("ready");
        callRef.current = null;
      });

      callRef.current.on("error", (e) => {
        console.error("Call error:", e);
        setError(e?.message || "Call failed");
        setStatus("error");
      });
    } catch (e) {
      console.error("Connect failed:", e);
      setError(e?.message || "Connect failed");
      setStatus("error");
    }
  }

  function hangUp() {
    try {
      callRef.current?.disconnect();
    } catch {}
    callRef.current = null;
    setStatus("ready");
  }

  useEffect(() => {
    initDevice();

    return () => {
      try {
        callRef.current?.disconnect();
        deviceRef.current?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        Status: <b>{status}</b>
      </div>

      {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={callNow}
          disabled={status !== "ready"}
          style={{
            background: "#22c55e",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 6,
            opacity: status !== "ready" ? 0.5 : 1,
            cursor: status !== "ready" ? "not-allowed" : "pointer",
          }}
        >
          Call Now
        </button>

        <button
          onClick={hangUp}
          style={{
            background: "#ef4444",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Hang Up
        </button>
      </div>
    </div>
  );
}
