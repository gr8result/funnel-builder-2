// /components/automation/FlowMembersModal.js
// FULL REPLACEMENT — drop-in Flow Members modal with:
// ✅ Refresh
// ✅ + Add List (bulk enroll)
// ✅ + Add Person (search leads + enroll)
// Does NOT touch your page/banner. You control when it opens.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabase-client";

export default function FlowMembersModal({
  isOpen,
  onClose,
  flowId,
  flowName = "",
}) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");

  const [showAddList, setShowAddList] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);

  const [listsLoading, setListsLoading] = useState(false);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");

  const [leadQ, setLeadQ] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadResults, setLeadResults] = useState([]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return members;
    return (members || []).filter((m) => {
      const name = String(m?.lead?.name || `${m?.lead?.first_name || ""} ${m?.lead?.last_name || ""}` || "")
        .trim()
        .toLowerCase();
      const email = String(m?.lead?.email || "").toLowerCase();
      const phone = String(m?.lead?.phone || "").toLowerCase();
      const status = String(m?.status || "").toLowerCase();
      return (
        name.includes(q) || email.includes(q) || phone.includes(q) || status.includes(q)
      );
    });
  }, [members, search]);

  useEffect(() => {
    if (!isOpen) return;
    if (!flowId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, flowId]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function refresh() {
    if (!flowId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/automation/flow-members?flow_id=${encodeURIComponent(flowId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setMembers(j?.members || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadLists() {
    setListsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/automation/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setLists(j?.lists || []);
    } finally {
      setListsLoading(false);
    }
  }

  async function searchLeads(q) {
    const v = String(q || "").trim();
    setLeadQ(v);
    if (!v) {
      setLeadResults([]);
      return;
    }
    setLeadLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/automation/search-leads?q=${encodeURIComponent(v)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setLeadResults(j?.leads || []);
    } finally {
      setLeadLoading(false);
    }
  }

  async function enrollLead(lead_id) {
    if (!flowId || !lead_id) return;
    const token = await getToken();
    await fetch(`/api/automation/crm-transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ flow_id: flowId, lead_id, source: "manual" }),
    });
    await refresh();
  }

  async function enrollSelectedList() {
    if (!flowId || !selectedListId) return;
    const token = await getToken();
    await fetch(`/api/automation/enroll-list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ flow_id: flowId, list_id: selectedListId }),
    });
    setShowAddList(false);
    setSelectedListId("");
    await refresh();
  }

  if (!isOpen) return null;

  return (
    <div style={S.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Flow Members</div>
            <div style={S.sub}>Flow: {flowName || flowId}</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={S.toolbar}>
          <input
            style={S.search}
            placeholder="Search name, email, phone, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={S.btn} onClick={refresh} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
          <button
            style={S.btnAlt}
            onClick={async () => {
              await loadLists();
              setShowAddList(true);
              setShowAddPerson(false);
            }}
          >
            + Add List
          </button>
          <button
            style={S.btnAlt}
            onClick={() => {
              setShowAddPerson(true);
              setShowAddList(false);
              setLeadQ("");
              setLeadResults([]);
            }}
          >
            + Add Person
          </button>
        </div>

        <div style={S.body}>
          {filtered.length === 0 ? (
            <div style={S.empty}>No leads found inside this flow yet.</div>
          ) : (
            filtered.map((m) => {
              const lead = m.lead || {};
              const nm =
                lead.name ||
                `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
                "Unnamed";
              return (
                <div key={m.enrollment_id || `${m.flow_id}-${m.lead_id}`} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowTitle}>{nm}</div>
                    <div style={S.rowSub}>
                      {lead.email || "—"} {lead.phone ? ` • ${lead.phone}` : ""}
                    </div>
                  </div>
                  <div style={S.pill}>{m.status || "—"}</div>
                </div>
              );
            })
          )}
        </div>

        <div style={S.footer}>
          <button style={S.close} onClick={onClose}>Close</button>
        </div>

        {/* Add List */}
        {showAddList && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Add List</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                style={S.select}
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                <option value="">{listsLoading ? "Loading..." : "Select a list"}</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.title || l.id}
                  </option>
                ))}
              </select>
              <button
                style={S.btn}
                onClick={enrollSelectedList}
                disabled={!selectedListId}
              >
                Enroll List
              </button>
              <button style={S.btnGhost} onClick={() => setShowAddList(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Add Person */}
        {showAddPerson && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Add Person</div>
            <input
              style={S.search2}
              placeholder="Type a name or email..."
              value={leadQ}
              onChange={(e) => searchLeads(e.target.value)}
            />
            <div style={S.results}>
              {leadLoading ? (
                <div style={S.mini}>Searching...</div>
              ) : leadResults.length === 0 ? (
                <div style={S.mini}>No results.</div>
              ) : (
                leadResults.map((l) => (
                  <div key={l.id} style={S.resultRow}>
                    <div style={{ flex: 1 }}>
                      <div style={S.rowTitle}>{l.name || "Unnamed"}</div>
                      <div style={S.rowSub}>{l.email || "—"}</div>
                    </div>
                    <button style={S.btn} onClick={() => enrollLead(l.id)}>
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <button style={S.btnGhost} onClick={() => setShowAddPerson(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "min(920px, 96vw)",
    height: "min(640px, 86vh)",
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  title: { fontSize: 16, fontWeight: 800, color: "#e5e7eb" },
  sub: { fontSize: 12, color: "rgba(229,231,235,0.7)", marginTop: 2 },
  x: {
    border: "none",
    background: "transparent",
    color: "rgba(229,231,235,0.85)",
    fontSize: 18,
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    alignItems: "center",
    flexWrap: "wrap",
  },
  search: {
    flex: 1,
    minWidth: 240,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
    color: "#e5e7eb",
    padding: "0 12px",
    outline: "none",
  },
  btn: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#10b981",
    color: "#071018",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnAlt: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnGhost: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "transparent",
    color: "#e5e7eb",
    fontWeight: 700,
    cursor: "pointer",
  },
  body: { flex: 1, overflow: "auto", padding: 12 },
  empty: {
    color: "rgba(229,231,235,0.7)",
    border: "1px dashed rgba(255,255,255,0.16)",
    borderRadius: 12,
    padding: 16,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    marginBottom: 10,
  },
  rowTitle: { fontSize: 14, fontWeight: 800, color: "#e5e7eb" },
  rowSub: { fontSize: 12, color: "rgba(229,231,235,0.7)", marginTop: 2 },
  pill: {
    fontSize: 12,
    fontWeight: 800,
    color: "#e5e7eb",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.20)",
  },
  footer: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "flex-end",
  },
  close: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
  },
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 62,
    background: "#07101f",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: 12,
  },
  panelTitle: { fontSize: 13, fontWeight: 900, color: "#e5e7eb", marginBottom: 8 },
  select: {
    flex: 1,
    minWidth: 240,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    color: "#e5e7eb",
    padding: "0 10px",
    outline: "none",
  },
  search2: {
    width: "100%",
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    color: "#e5e7eb",
    padding: "0 12px",
    outline: "none",
  },
  results: {
    marginTop: 10,
    maxHeight: 220,
    overflow: "auto",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  mini: { padding: 10, color: "rgba(229,231,235,0.7)" },
};
