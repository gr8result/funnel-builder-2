import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase-client";

export default function EmailNodeMembersModal({ isOpen, onClose, nodeId, flowId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!isOpen || !nodeId || !flowId) return;
    loadMembers();
  }, [isOpen, nodeId, flowId]);

  async function loadMembers() {
    try {
      setLoading(true);

      // Get all flow runs for this node that haven't finished
      const { data: runs, error: runsErr } = await supabase
        .from("automation_flow_runs")
        .select("id, lead_id, status, current_node_id")
        .eq("flow_id", flowId)
        .eq("current_node_id", nodeId);

      if (runsErr) throw runsErr;

      // Get lead details for each run
      if (runs && runs.length > 0) {
        const leadIds = runs.map((r) => r.lead_id);
        const { data: leads, error: leadsErr } = await supabase
          .from("leads")
          .select("id, name, email, phone, status")
          .in("id", leadIds);

        if (leadsErr) throw leadsErr;

        // Map runs with lead data
        const withLeads = runs.map((run) => {
          const lead = leads?.find((l) => l.id === run.lead_id) || {};
          return {
            ...run,
            ...lead,
          };
        });

        setMembers(withLeads);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error("Failed to load members:", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMember(memberId, runId) {
    try {
      setBusy(memberId);

      // Delete the run
      const { error } = await supabase
        .from("automation_flow_runs")
        .delete()
        .eq("id", runId);

      if (error) throw error;

      setMembers((m) => m.filter((x) => x.id !== memberId));
    } catch (err) {
      alert(`Failed to remove member: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2>Email Node Members ({members.length})</h2>
          <button onClick={onClose} style={s.closeBtn}>
            ✕
          </button>
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>
              No members at this node
            </div>
          ) : (
            <div style={s.memberList}>
              {members.map((m) => (
                <div key={m.id} style={s.memberRow}>
                  <div style={s.memberInfo}>
                    <div style={s.memberName}>{m.name || m.email || "-"}</div>
                    <div style={s.memberEmail}>{m.email || "-"}</div>
                    {m.phone && <div style={s.memberPhone}>{m.phone}</div>}
                    <div style={s.memberStatus}>Status: {m.status || "active"}</div>
                  </div>

                  <button
                    onClick={() => deleteMember(m.id, m.id)}
                    disabled={busy === m.id}
                    style={{
                      ...s.deleteBtn,
                      opacity: busy === m.id ? 0.5 : 1,
                      cursor: busy === m.id ? "not-allowed" : "pointer",
                    }}
                    title="Remove member from flow"
                  >
                    {busy === m.id ? "..." : "🗑️ Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button onClick={onClose} style={s.closeActionBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.75)",
    zIndex: 5000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    width: "600px",
    maxHeight: "80vh",
    background: "#0f172a",
    borderRadius: 12,
    border: "1px solid #334155",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    color: "#e2e8f0",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    borderBottom: "1px solid #334155",
  },
  closeBtn: {
    fontSize: 24,
    background: "transparent",
    border: "none",
    color: "#e2e8f0",
    cursor: "pointer",
    padding: 0,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    transition: "all 0.2s",
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
  },
  memberList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  memberRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    background: "rgba(30, 41, 59, 0.6)",
    border: "1px solid #334155",
    borderRadius: 8,
    gap: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontWeight: 600,
    fontSize: 14,
    color: "#f1f5f9",
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  memberPhone: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  memberStatus: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  deleteBtn: {
    padding: "6px 12px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  footer: {
    padding: "12px 20px",
    borderTop: "1px solid #334155",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  closeActionBtn: {
    padding: "8px 16px",
    background: "#475569",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
  },
};
