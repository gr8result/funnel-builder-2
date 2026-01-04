// /components/crm/GlobalDialer.js
// FULL REPLACEMENT — Next.js safe (no window error) + uses @twilio/voice-sdk properly
// Fixes: "window is not defined", "TwilioObj is not defined", and reduces 20101 token loops

import { useEffect, useRef, useState } from "react";

export default function GlobalDialer() {
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [lastError, setLastError] = useState("");

  // Optional small UI — you can hide it if you want
  const [to, setTo] = useState("");

  async function fetchToken() {
    const r = await fetch("/api/telephony/voice-token", {
      method: "GET",
      headers: { "Cache-Control": "no-store" },
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error(json?.error || json?.message || "Token request failed");
    }
    if (!json?.token) throw new Error("No token returned from /api/telephony/voice-token");
    return json.token;
  }

  async function initDevice() {
    try {
      setLastError("");
      setStatus("initializing");

      // IMPORTANT: only load Voice SDK in the browser
      const mod = await import("@twilio/voice-sdk");
      const Device = mod.Device;

      // Always get a fresh token
      const token = await fetchToken();

      // Destroy any existing device
      try {
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }
      } catch (_) {}

      const device = new Device(token, {
        // good defaults
        logLevel: "error",
        codecPreferences: ["opus", "pcmu"],
        enableIceRestart: true,
        // close protection against token caching issues
        allowIncomingWhileBusy: true,
      });

      device.on("registered", () => {
        setReady(true);
        setStatus("ready");
      });

      device.on("unregistered", () => {
        setReady(false);
        setStatus("unregistered");
      });

      device.on("error", (err) => {
        setLastError(err?.message || String(err));
        setStatus("error");
      });

      // When token expires, refresh it
      device.on("tokenWillExpire", async () => {
        try {
          const newToken = await fetchToken();
          await device.updateToken(newToken);
        } catch (e) {
          setLastError(e?.message || String(e));
        }
      });

      deviceRef.current = device;

      await device.register();
    } catch (e) {
      setLastError(e?.message || String(e));
      setStatus("error");
    }
  }

  async function startCall(number) {
    try {
      setLastError("");
      if (!deviceRef.current) {
        await initDevice();
      }
      if (!deviceRef.current) throw new Error("Device not created");

      setStatus("calling");

      // PARAM NAME MUST MATCH what your TwiML expects
      // Your /api/twilio/voice-client screenshot shows it uses ?To=...
      const call = await deviceRef.current.connect({
        params: { To: String(number || "").trim() },
      });

      callRef.current = call;

      call.on("accept", () => setStatus("in-call"));
      call.on("disconnect", () => {
        callRef.current = null;
        setStatus("ready");
      });
      call.on("cancel", () => {
        callRef.current = null;
        setStatus("ready");
      });
      call.on("error", (err) => {
        setLastError(err?.message || String(err));
        callRef.current = null;
        setStatus("error");
      });
    } catch (e) {
      setLastError(e?.message || String(e));
      setStatus("error");
    }
  }

  function hangup() {
    try {
      if (callRef.current) {
        callRef.current.disconnect();
        callRef.current = null;
      }
      setStatus(ready ? "ready" : "idle");
    } catch (_) {}
  }

  function reconnect() {
    initDevice();
  }

  // Auto init once on mount (browser-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    initDevice();
    return () => {
      try {
        if (callRef.current) {
          callRef.current.disconnect();
          callRef.current = null;
        }
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If you don’t want any visible UI, return null.
  // BUT keep it mounted so your Lead modal can use it if you wire that up later.
  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 9999 }}>
      <div
        style={{
          background: "#0b1220",
          border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 12,
          padding: 12,
          width: 280,
          color: "white",
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Dialer</div>
        <div style={{ opacity: 0.8, marginBottom: 8 }}>
          Status: {status}
          {ready ? " ✅" : ""}
        </div>

        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0417... or +61417..."
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.06)",
            color: "white",
            outline: "none",
            fontSize: 16,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => startCall(to)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "#22c55e",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Call
          </button>
          <button
            onClick={hangup}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "#ef4444",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Hang up
          </button>
          <button
            onClick={reconnect}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.2)",
              background: "transparent",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Reconnect device"
          >
            ↻
          </button>
        </div>

        {lastError ? (
          <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12, lineHeight: 1.3 }}>
            {lastError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
