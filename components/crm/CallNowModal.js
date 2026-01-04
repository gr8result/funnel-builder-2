// /components/crm/CallNowModal.js
// FULL REPLACEMENT — fixes Twilio Voice SDK v2 registration + uses identity from body
// ✅ device.register() (this is what stops the “tiny noise then dead”)
// ✅ token fetched with POST body identity
// ✅ clean teardown

import React, { useEffect, useRef, useState } from "react";

export default function CallNowModal({ isOpen, lead, onClose }) {
  const [status, setStatus] = useState("Ready");
  const [isCalling, setIsCalling] = useState(false);

  const deviceRef = useRef(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    return () => {
      try {
        if (connectionRef.current) {
          connectionRef.current.disconnect();
          connectionRef.current = null;
        }
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }
      } catch (e) {
        console.error("Twilio cleanup error", e);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStatus("Ready to call");
      setIsCalling(false);
    }
  }, [isOpen]);

  async function getToken(identity) {
    const res = await fetch("/api/telephony/voice-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ identity }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || "Failed to get Twilio token.");
    return data.token;
  }

  async function getOrCreateDevice() {
    if (deviceRef.current) return deviceRef.current;

    setStatus("Connecting to Twilio…");

    const { Device } = await import("@twilio/voice-sdk");

    const identity = `gr8-web-${lead?.id || "user"}`;
    const token = await getToken(identity);

    const device = new Device(token, {
      codecPreferences: ["opus", "pcmu"],
      logLevel: "error",
      enableIceRestart: true,
      allowIncomingWhileBusy: true,
    });

    device.on("error", (e) => {
      console.error("Twilio Device error", e);
      setStatus(e?.message || "Device error");
      setIsCalling(false);
    });

    device.on("disconnect", () => {
      setStatus("Call ended");
      setIsCalling(false);
      connectionRef.current = null;
    });

    device.on("tokenWillExpire", async () => {
      try {
        const newToken = await getToken(identity);
        await device.updateToken(newToken);
      } catch (e) {
        console.error("updateToken error", e);
      }
    });

    deviceRef.current = device;

    // ✅ REQUIRED in Voice SDK v2 for reliable outbound behaviour
    await device.register();

    setStatus("Ready to call");
    return device;
  }

  async function handleCall() {
    if (!lead) return;

    const to = (lead.phone || lead.phone_number || lead.mobile || "").toString().trim();
    if (!to) {
      setStatus("This contact has no phone number.");
      return;
    }

    try {
      setIsCalling(true);
      setStatus(`Dialling ${to}…`);

      const device = await getOrCreateDevice();

      const connection = await device.connect({
        params: { To: String(to).trim() },
      });

      connectionRef.current = connection;

      connection.on("accept", () => setStatus("On call"));
      connection.on("disconnect", () => {
        setStatus("Call ended");
        setIsCalling(false);
        connectionRef.current = null;
      });
      connection.on("error", (err) => {
        console.error("Twilio connection error", err);
        setStatus(err?.message || "Call error");
        setIsCalling(false);
        connectionRef.current = null;
      });
    } catch (err) {
      console.error("handleCall error", err);
      setStatus(err?.message || "Error starting call.");
      setIsCalling(false);
    }
  }

  function handleHangup() {
    try {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      } else if (deviceRef.current) {
        deviceRef.current.disconnectAll();
      }
    } catch (e) {
      console.error("Hangup error", e);
    } finally {
      setStatus("Call ended");
      setIsCalling(false);
    }
  }

  function handleClose() {
    handleHangup();
    if (onClose) onClose();
  }

  if (!isOpen) return null;

  const leadName = lead?.name || "Unknown lead";
  const leadPhone = lead?.phone || lead?.phone_number || lead?.mobile || "No phone";

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={titleStyle}>Call from GR8 RESULT</div>
            <div style={subTitleStyle}>
              {leadName} • {leadPhone}
            </div>
          </div>
          <button onClick={handleClose} style={closeIconBtnStyle}>
            ×
          </button>
        </div>

        <div style={statusRowStyle}>
          <span style={statusLabelStyle}>Status:</span>
          <span style={statusTextStyle}>{status}</span>
        </div>

        <p style={hintTextStyle}>Uses your computer’s microphone and speakers via Twilio.</p>

        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={handleCall}
            disabled={isCalling}
            style={{ ...primaryBtnStyle, opacity: isCalling ? 0.7 : 1 }}
          >
            {isCalling ? "Calling…" : "Call now"}
          </button>

          <button
            type="button"
            onClick={handleHangup}
            disabled={!isCalling}
            style={{ ...dangerBtnStyle, opacity: !isCalling ? 0.5 : 1 }}
          >
            Hang up
          </button>

          <button type="button" onClick={handleClose} style={secondaryBtnStyle}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};

const modalStyle = {
  width: 480,
  maxWidth: "90vw",
  background: "linear-gradient(160deg,#020617,#020617 40%,#0b1220)",
  borderRadius: 18,
  padding: 20,
  border: "1px solid rgba(148,163,184,0.6)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.9)",
  color: "#e5e7eb",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  fontSize: 16,
};

const headerRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const titleStyle = { fontSize: 20, fontWeight: 700 };
const subTitleStyle = { fontSize: 16, opacity: 0.85, marginTop: 2 };

const closeIconBtnStyle = {
  border: "none",
  background: "rgba(15,23,42,0.9)",
  color: "#e5e7eb",
  fontSize: 22,
  width: 32,
  height: 32,
  borderRadius: "999px",
  cursor: "pointer",
  lineHeight: "28px",
  textAlign: "center",
};

const statusRowStyle = { display: "flex", alignItems: "center", gap: 8, marginTop: 10 };
const statusLabelStyle = { fontWeight: 600, fontSize: 16 };
const statusTextStyle = { fontSize: 16 };

const hintTextStyle = { fontSize: 16, marginTop: 10, marginBottom: 18, opacity: 0.85 };

const buttonRowStyle = { display: "flex", gap: 10, justifyContent: "flex-end" };

const baseBtn = {
  borderRadius: 999,
  padding: "8px 16px",
  fontSize: 16,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const primaryBtnStyle = {
  ...baseBtn,
  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 40%, #22c55e 100%)",
  color: "#0f172a",
};

const dangerBtnStyle = {
  ...baseBtn,
  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 40%, #ef4444 100%)",
  color: "#f9fafb",
};

const secondaryBtnStyle = {
  ...baseBtn,
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(148,163,184,0.8)",
  color: "#e5e7eb",
};
