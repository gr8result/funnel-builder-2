// /components/telephony/BrowserDialer.js
// FULL REPLACEMENT — guaranteed correct Twilio Voice SDK v2 usage

import { useEffect, useRef, useState } from "react";

export default function BrowserDialer({ phone }) {
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const [status, setStatus] = useState("loading"); // loading | ready | calling | error
  const [error, setError] = useState("");

  async function fetchToken() {
    const r = await fetch("/api/telephony/voice-token");
    const j = await r.json();
    if (!r.ok || !j.token) throw new Error(j.error || "Token failed");
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

    device.on("registered", () => {
      setStatus("ready");
    });

    device.on("error", (e) => {
      console.error(e);
      setError(e.message || "Twilio error");
      setStatus("error");
    });

    device.on("tokenWillExpire", async () => {
      const newToken = await fetchToken();
      device.updateToken(newToken);
    });

    deviceRef.current = device;
    await device.register(); // 🔴 THIS WAS THE MISSING PART BEFORE
  }

  async function callNow() {
    if (!deviceRef.current || status !== "ready") return;

    setStatus("calling");
    callRef.current = await deviceRef.current.connect({
      params: { To: phone },
    });

    callRef.current.on("disconnect", () => {
      setStatus("ready");
      callRef.current = null;
    });
  }

  function hangUp() {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
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
  }, []);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        Status: <b>{status}</b>
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>
      )}

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
          }}
        >
          Hang Up
        </button>
      </div>
    </div>
  );
}
