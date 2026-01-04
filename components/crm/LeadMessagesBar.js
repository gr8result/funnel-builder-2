// components/crm/LeadMessagesBar.js
// Small call / voicemail badge + button for the Lead modal.
// - Safely loads call data (no crashes if API fails)
// - Shows "View calls (N)" and opens the call log for this lead.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function LeadMessagesBar({ lead }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // ---------- LOAD CALLS / VOICEMAILS COUNT ----------
  useEffect(() => {
    if (!lead?.id) return;

    let cancelled = false;

    async function loadCalls() {
      setLoading(true);
      try {
        // TODO: adjust this endpoint if your API path is different
        const url = `/api/telephony/lead-calls?leadId=${encodeURIComponent(
          lead.id
        )}`;

        const res = await fetch(url, { method: "GET" });

        let data = {};
        try {
          data = await res.json().catch(() => ({}));
        } catch {
          data = {};
        }

        if (!res.ok) {
          console.error(
            "LeadMessagesBar loadCalls error:",
            data.error || res.status
          );
          if (!cancelled) setUnreadCount(0);
          return;
        }

        const calls = Array.isArray(data.calls) ? data.calls : [];
        // If you track read/unread, change this line accordingly.
        const count = calls.length;

        if (!cancelled) setUnreadCount(count);
      } catch (err) {
        console.error("LeadMessagesBar loadCalls exception:", err);
        if (!cancelled) setUnreadCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCalls();

    return () => {
      cancelled = true;
    };
  }, [lead?.id]);

  // ---------- OPEN CALL LOG PAGE ----------
  const handleOpenLog = () => {
    if (!lead?.phone) {
      alert("This contact does not have a phone number yet.");
      return;
    }

    router.push(
      `/modules/email/crm/call-log?phone=${encodeURIComponent(lead.phone)}`
    );
  };

  const label = loading
    ? "Loading calls…"
    : `View calls (${unreadCount || 0})`;

  return (
    <button
      type="button"
      onClick={handleOpenLog}
      style={styles.button}
    >
      <span style={styles.icon} aria-hidden="true">
        📞
      </span>
      <span>{label}</span>
    </button>
  );
}

const styles = {
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.9)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.9))",
    boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  icon: {
    fontSize: 18,
    lineHeight: 1,
  },
};
