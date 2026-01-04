// /components/crm/SendToAutomationPanel.js
import React, { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client"; // ✅ adjust if your folder differs

export default function SendToAutomationPanel({ leadId, onSent }) {
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [toast, setToast] = useState("");

  const toastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const loadFlows = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;

      const resp = await fetch("/api/automation/crm-flows", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);

      setFlows(json?.flows || []);
      // auto select first if none picked
      if (!selectedFlowId && json?.flows?.length) {
        setSelectedFlowId(json.flows[0].id);
      }
    } catch (e) {
      console.error(e);
      toastMsg(e.message || "Failed to load flows");
    }
  };

  useEffect(() => {
    loadFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    try {
      if (!leadId) return toastMsg("No lead selected");
      if (!selectedFlowId) return toastMsg("Select a flow first");

      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Not logged in");

      const resp = await fetch("/api/automation/crm-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          flow_id: selectedFlowId,
          lead_id: leadId,
          payload: { note: "Sent from CRM lead screen" },
        }),
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);

      if (json?.duplicate) {
        toastMsg("Already queued for this flow");
        onSent && onSent({ duplicate: true, data: json });
        return;
      }

      toastMsg("Lead sent to automation ✅");
      onSent && onSent({ queued: true, data: json });
    } catch (e) {
      console.error(e);
      toastMsg(e.message || "Failed to send lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Automation</div>

      <div style={styles.row}>
        <select
          value={selectedFlowId}
          onChange={(e) => setSelectedFlowId(e.target.value)}
          style={styles.select}
        >
          {flows.length === 0 && <option value="">No CRM flows found</option>}
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.is_standard ? " (Template)" : ""}
            </option>
          ))}
        </select>

        <button onClick={loadFlows} style={styles.refreshBtn} title="Refresh">
          ↻
        </button>
      </div>

      <button
        onClick={send}
        disabled={loading || !leadId || !selectedFlowId}
        style={{
          ...styles.sendBtn,
          opacity: loading || !leadId || !selectedFlowId ? 0.6 : 1,
        }}
      >
        {loading ? "Sending..." : "Send to Automation"}
      </button>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

const styles = {
  wrap: {
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: 900,
    color: "#cbd5e1",
    letterSpacing: 0.3,
  },
  row: { display: "flex", gap: 8, alignItems: "center" },
  select: {
    flex: 1,
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(2,6,23,0.65)",
    color: "#e5e7eb",
    outline: "none",
    fontSize: 14,
  },
  refreshBtn: {
    width: 44,
    height: 42,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(2,6,23,0.65)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 18,
  },
  sendBtn: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "none",
    background: "#22c55e",
    color: "#052e12",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  },
  toast: {
    fontSize: 13,
    color: "#e5e7eb",
    background: "rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.18)",
    padding: "8px 10px",
    borderRadius: 12,
  },
};
