import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";

const TEAM_STORAGE_KEY_PREFIX = "crm:pipeline:teams:";

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function buildDefaultTeams() {
  return [
    {
      id: "team_default",
      name: "Sales Team",
      manager: "Owner",
      members: "Closer, Setter",
      target: 25000,
      color: "#22c55e",
    },
  ];
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function parseMembers(value) {
  return String(value || "")
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinMembers(items) {
  return Array.from(new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))).join(", ");
}

export default function CRMSalesTeamsPage() {
  const [userId, setUserId] = useState("");
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberDrafts, setMemberDrafts] = useState({});

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || "guest";
      if (!alive) return;
      setUserId(uid);

      const key = `${TEAM_STORAGE_KEY_PREFIX}${uid}`;
      const stored = readStoredJson(key, []);
      if (stored.length) {
        setTeams(stored);
      } else {
        const defaults = buildDefaultTeams();
        setTeams(defaults);
        writeStoredJson(key, defaults);
      }
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  function persist(next) {
    setTeams(next);
    writeStoredJson(`${TEAM_STORAGE_KEY_PREFIX}${userId || "guest"}`, next);
  }

  function updateTeam(index, field, value) {
    const next = [...teams];
    next[index] = { ...next[index], [field]: value };
    persist(next);
  }

  function addTeam() {
    persist([
      ...teams,
      {
        id: `team_${Date.now()}`,
        name: "New Team",
        manager: "",
        members: "",
        target: 0,
        color: "#22c55e",
      },
    ]);
  }

  function deleteTeam(index) {
    persist(teams.filter((_, i) => i !== index));
  }

  function addMember(index) {
    const draft = String(memberDrafts[index] || "").trim();
    if (!draft) return;
    const nextMembers = [...parseMembers(teams[index]?.members), draft];
    updateTeam(index, "members", joinMembers(nextMembers));
    setMemberDrafts((prev) => ({ ...prev, [index]: "" }));
  }

  function removeMember(index, memberName) {
    const nextMembers = parseMembers(teams[index]?.members).filter((member) => member !== memberName);
    updateTeam(index, "members", joinMembers(nextMembers));
  }

  const totals = useMemo(() => {
    const target = teams.reduce((sum, team) => sum + Number(team.target || 0), 0);
    const memberCount = teams.reduce((sum, team) => {
      const count = String(team.members || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean).length;
      return sum + count;
    }, 0);

    return {
      teams: teams.length,
      members: memberCount,
      target,
    };
  }, [teams]);

  return (
    <main style={styles.main}>
      <div style={styles.bannerWrap}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>Sales Teams</h1>
            <p style={styles.bannerSub}>
              Organise managers, members, and targets from one clear CRM entry point.
            </p>
          </div>
          <div style={styles.bannerActions}>
            <Link href="/modules/email/crm/pipelines" style={styles.secondaryBtn}>
              Open Pipeline
            </Link>
            <Link href="/modules/email/crm" style={styles.backBtn}>
              ← Back
            </Link>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.statsGrid}>
          <StatCard label="Teams" value={`${totals.teams}`} color="#f97316" />
          <StatCard label="Members" value={`${totals.members}`} color="#22c55e" />
          <StatCard label="Target" value={formatMoney(totals.target)} color="#3b82f6" />
        </div>

        <div style={styles.toolbarRow}>
          <div>
            <h2 style={styles.sectionTitle}>Manage your team structure</h2>
            <p style={styles.sectionSub}>These teams are shared with the pipeline board.</p>
          </div>
          <button onClick={addTeam} style={styles.addBtn}>+ Add Team</button>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading teams…</div>
        ) : teams.length === 0 ? (
          <div style={styles.emptyState}>No teams yet.</div>
        ) : (
          <div style={styles.teamList}>
            {teams.map((team, index) => (
              <div key={team.id} style={styles.teamCard}>
                <div style={styles.teamCardTop}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ ...styles.colorDot, background: team.color || "#22c55e" }} />
                    <strong style={styles.teamName}>{team.name || "Untitled Team"}</strong>
                  </div>
                  <button onClick={() => deleteTeam(index)} style={styles.deleteBtn}>Delete</button>
                </div>

                <div style={styles.formGrid}>
                  <label style={styles.field}>
                    <span>Team Name</span>
                    <input
                      value={team.name || ""}
                      onChange={(e) => updateTeam(index, "name", e.target.value)}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span>Manager</span>
                    <input
                      value={team.manager || ""}
                      onChange={(e) => updateTeam(index, "manager", e.target.value)}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span>Monthly Target</span>
                    <input
                      type="number"
                      min="0"
                      value={team.target || 0}
                      onChange={(e) => updateTeam(index, "target", e.target.value)}
                      style={styles.input}
                    />
                  </label>
                </div>

                <div style={styles.memberSection}>
                  <div style={styles.memberHeaderRow}>
                    <span style={styles.memberSectionTitle}>Team Members</span>
                    <span style={styles.memberHint}>Add one person at a time below</span>
                  </div>

                  <div style={styles.memberList}>
                    {parseMembers(team.members).length === 0 ? (
                      <span style={styles.memberEmpty}>No team members added yet.</span>
                    ) : (
                      parseMembers(team.members).map((member) => (
                        <span key={`${team.id}-${member}`} style={styles.memberChip}>
                          <span style={styles.memberAvatar} role="img" aria-label="Team member">
                            👤
                          </span>
                          {member}
                          <button
                            type="button"
                            onClick={() => removeMember(index, member)}
                            style={styles.memberChipBtn}
                            title={`Remove ${member}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div style={styles.memberAddRow}>
                    <input
                      value={memberDrafts[index] || ""}
                      onChange={(e) => setMemberDrafts((prev) => ({ ...prev, [index]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addMember(index);
                        }
                      }}
                      style={styles.input}
                      placeholder="Type a team member name"
                    />
                    <button type="button" onClick={() => addMember(index)} style={styles.memberAddBtn}>
                      + Add Member
                    </button>
                  </div>

                  <label style={{ ...styles.field, marginTop: 8 }}>
                    <span>Bulk Edit Members</span>
                    <input
                      value={team.members || ""}
                      onChange={(e) => updateTeam(index, "members", e.target.value)}
                      style={styles.input}
                      placeholder="Paste names separated by commas"
                    />
                  </label>
                </div>

                <div style={styles.footerRow}>
                  <label style={styles.colorField}>
                    <span>Team Colour</span>
                    <input
                      type="color"
                      value={team.color || "#22c55e"}
                      onChange={(e) => updateTeam(index, "color", e.target.value)}
                      style={styles.colorInput}
                    />
                  </label>
                  <div style={styles.targetNote}>Current target: {formatMoney(team.target)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderColor: `${color}66` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
    </div>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
  },
  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    paddingTop: 24,
  },
  banner: {
    width: 1320,
    maxWidth: "calc(100% - 24px)",
    borderRadius: 16,
    padding: "20px 24px",
    background: "linear-gradient(175deg, #f97316 0%, #c2410c 100%)",
    border: "1px solid #7c2d12",
    boxShadow: "0 8px 28px rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  bannerTitle: { margin: 0, fontSize: 48, fontWeight: 600 },
  bannerSub: { margin: "6px 0 0", fontSize: 18, opacity: 0.9 },
  bannerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  backBtn: {
    background: "rgba(0,0,0,.18)",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
  },
  secondaryBtn: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
  },
  container: {
    width: "100%",
    maxWidth: 1320,
    margin: "28px auto",
    padding: "0 20px 32px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 16,
  },
  statLabel: { color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 800 },
  toolbarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  sectionTitle: { margin: 0, fontSize: 28, fontWeight: 600 },
  sectionSub: { margin: "6px 0 0", color: "#94a3b8", fontSize: 15 },
  addBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  teamList: { display: "grid", gap: 14 },
  teamCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 16,
    padding: 18,
  },
  teamCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  teamName: { fontSize: 18 },
  colorDot: { width: 12, height: 12, borderRadius: 999 },
  deleteBtn: {
    background: "#3f1a1a",
    color: "#fecaca",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
    color: "#cbd5e1",
    fontSize: 14,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#08101b",
    color: "#fff",
  },
  memberSection: {
    marginTop: 14,
    borderTop: "1px solid #24354f",
    paddingTop: 14,
    display: "grid",
    gap: 10,
  },
  memberHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  memberSectionTitle: {
    color: "#e2e8f0",
    fontWeight: 700,
    fontSize: 15,
  },
  memberHint: {
    color: "#94a3b8",
    fontSize: 12,
  },
  memberList: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  memberChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "#dcfce7",
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 600,
  },
  memberAvatar: {
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.25)",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 800,
  },
  memberChipBtn: {
    background: "transparent",
    border: "none",
    color: "#fecaca",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: 0,
  },
  memberEmpty: {
    color: "#94a3b8",
    fontSize: 13,
  },
  memberAddRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
  },
  memberAddBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  footerRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  colorField: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#cbd5e1",
    fontSize: 14,
  },
  colorInput: {
    width: 48,
    height: 32,
    border: "none",
    background: "transparent",
    padding: 0,
  },
  targetNote: { color: "#93c5fd", fontWeight: 600 },
  emptyState: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 20,
    color: "#cbd5e1",
  },
};
