// /pages/modules/email/crm/teams.js
// Unified Team Management — Workspace Members (with module permissions + SMS OTP)
// + Sales Teams for the CRM pipeline. Replaces /pages/settings/team.js.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";
import { useWorkspace, useApiFetch } from "../../../../hooks/useWorkspace";
import ICONS from "../../../../components/iconMap";

// ── Module access catalogue ───────────────────────────────────────────────────
const MODULE_CATEGORIES = [
  {
    label: "Core Access",
    modules: [
      { id: "dashboard",       label: "Navigation Dashboard" },
      { id: "command_centre",  label: "Command Centre" },
      { id: "funnels",         label: "Sales Funnels" },
      { id: "assets",          label: "Media Library" },
      { id: "leads",           label: "Leads" },
      { id: "account",         label: "Account Settings" },
    ],
  },
  {
    label: "Admin Access",
    ownerGrantable: true,
    modules: [
      { id: "team_members",  label: "Team Members Management" },
      { id: "billing",       label: "Billing & Modules" },
      { id: "subaccounts",   label: "Subaccounts" },
    ],
  },
  {
    label: "Marketing & Sales",
    modules: [
      { id: "email_marketing",      label: "Email Marketing" },
      { id: "sms_marketing",        label: "SMS Marketing" },
      { id: "social_media",         label: "Social Media" },
      { id: "affiliates",           label: "Affiliate Management" },
      { id: "website_builder",      label: "Website Builder" },
      { id: "business_automation",  label: "Business Automation" },
    ],
  },
  {
    label: "CRM & Pipeline",
    modules: [
      { id: "crm",        label: "CRM" },
      { id: "pipelines",  label: "Pipelines" },
      { id: "calendar",   label: "Booking Calendar" },
    ],
  },
  {
    label: "Products & Communities",
    modules: [
      { id: "courses",            label: "Online Courses" },
      { id: "physical_products",  label: "Physical Products" },
      { id: "webinars",           label: "Evergreen Webinars" },
      { id: "communities",        label: "Communities" },
    ],
  },
];

const ALL_MODULE_IDS = MODULE_CATEGORIES.flatMap((c) => c.modules.map((m) => m.id));

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  owner:     { label: "Owner",     color: "#f59e0b" },
  admin:     { label: "Admin",     color: "#3b82f6" },
  sales:     { label: "Sales",     color: "#10b981" },
  marketing: { label: "Marketing", color: "#8b5cf6" },
  support:   { label: "Support",   color: "#64748b" },
};
const INVITABLE_ROLES = ["admin", "sales", "marketing", "support"];

// ── localStorage helpers ──────────────────────────────────────────────────────
const TEAM_KEY   = "crm:pipeline:teams:";
const PERMS_KEY  = "ws:member:perms:";

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function buildDefaultTeams() {
  return [{
    id: "team_default", name: "Sales Team", manager: "Owner",
    members: "Closer, Setter", target: 25000, color: "#22c55e",
  }];
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
  } catch { return `$${Math.round(n)}`; }
}

function parseMembers(value) {
  return String(value || "").split(/,|\n|;/).map((s) => s.trim()).filter(Boolean);
}
function joinMembers(items) {
  return Array.from(new Set((items || []).map((s) => String(s || "").trim()).filter(Boolean))).join(", ");
}

// ── SMS OTP Modal ─────────────────────────────────────────────────────────────
function SmsOtpModal({ actionLabel, onVerified, onCancel }) {
  const [codeSent, setCodeSent] = useState(false);
  const [entered, setEntered]   = useState("");
  const [sending, setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError]       = useState("");

  async function sendCode() {
    setSending(true); setError("");
    try {
      const res  = await fetch("/api/account/send-otp-to-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to send SMS");
      setCodeSent(true);
    } catch (e) {
      setError(e.message);
    } finally { setSending(false); }
  }

  async function verify() {
    if (!entered.trim()) { setError("Please enter the code."); return; }
    setVerifying(true); setError("");
    try {
      const res  = await fetch("/api/account/verify-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: entered.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Verification failed");
      onVerified();
    } catch (e) {
      setError(e.message);
    } finally { setVerifying(false); }
  }

  return (
    <div style={os.overlay}>
      <div style={os.modal}>
        <h3 style={os.title}>Confirm with SMS</h3>
        <p style={os.sub}>To <strong>{actionLabel}</strong>, verify your identity via SMS code.</p>

        {!codeSent ? (
          <>
            <p style={{ color: "#94a3b8", fontSize: 18, margin: "0 0 16px" }}>
              A verification code will be sent to the phone number on your account.
            </p>
            {error && <p style={os.err}>{error}</p>}
            <div style={os.row}>
              <button onClick={onCancel} style={os.cancelBtn}>Cancel</button>
              <button onClick={sendCode} disabled={sending} style={os.primaryBtn}>
                {sending ? "Sending…" : "Send Code"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "#86efac", fontSize: 18, margin: "0 0 12px" }}>
              Code sent to your registered phone number. Enter it below.
            </p>
            <label style={os.label}>6-digit code</label>
            <input
              value={entered} onChange={(e) => setEntered(e.target.value)}
              placeholder="123456" maxLength={6}
              style={{ ...os.input, letterSpacing: 8, textAlign: "center", fontSize: 22 }}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            {error && <p style={os.err}>{error}</p>}
            <div style={os.row}>
              <button onClick={onCancel} style={os.cancelBtn}>Cancel</button>
              <button onClick={sendCode} disabled={sending} style={{ ...os.cancelBtn, color: "#93c5fd" }}>
                {sending ? "Sending…" : "Resend"}
              </button>
              <button onClick={verify} disabled={verifying} style={os.primaryBtn}>
                {verifying ? "Verifying…" : "Verify & Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const os = {
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:     { background: "#0f1622", border: "1px solid #334155", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 },
  title:     { margin: "0 0 6px", fontSize: 20, fontWeight: 600, color: "#f1f5f9" },
  sub:       { margin: "0 0 20px", color: "#94a3b8", fontSize: 18 },
  label:     { display: "block", color: "#94a3b8", fontSize: 18, marginBottom: 6 },
  input:     { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "#08101b", color: "#f1f5f9", fontSize: 18, boxSizing: "border-box", outline: "none" },
  err:       { margin: "8px 0 0", color: "#fca5a5", fontSize: 18 },
  row:       { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 },
  cancelBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 18 },
  primaryBtn:{ background: "#f97316", border: "none", color: "#fff", fontWeight: 600, padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontSize: 18 },
};

// ── Category "select all" checkbox with indeterminate support ─────────────────
function CatCheckbox({ ids, perms, setPerms, storageKey }) {
  const ref  = useRef(null);
  const all  = ids.every((id) => perms.includes(id));
  const some = ids.some((id) => perms.includes(id));
  useEffect(() => { if (ref.current) ref.current.indeterminate = some && !all; }, [all, some]);

  function handleChange() {
    setPerms((prev) => {
      const next = !all
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter((p) => !ids.includes(p));
      writeJson(storageKey, next);
      return next;
    });
  }
  return <input ref={ref} type="checkbox" checked={all} onChange={handleChange} style={pm.bigCheck} />;
}

// ── Module Permissions Panel ──────────────────────────────────────────────────
function ModulePermsPanel({ memberId, workspaceId }) {
  const key = `${PERMS_KEY}${workspaceId}:${memberId}`;
  const [perms, setPerms] = useState(() => readJson(key, ALL_MODULE_IDS));

  function toggle(id) {
    setPerms((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      writeJson(key, next);
      return next;
    });
  }

  return (
    <div style={pm.panel}>
      <p style={pm.hint}>
        Tick the modules this member can access. <strong style={{ color: "#f97316" }}>Admin Access</strong> items
        grant elevated permissions — only enable for trusted users.
      </p>
      {MODULE_CATEGORIES.map((cat) => {
        const ids = cat.modules.map((m) => m.id);
        return (
          <div key={cat.label} style={pm.cat}>
            <div style={pm.catHeader}>
              <CatCheckbox ids={ids} perms={perms} setPerms={setPerms} storageKey={key} />
              <span style={pm.catLabel}>{cat.label}</span>
              {cat.ownerGrantable && <span style={pm.ownerBadge}>Owner-level</span>}
            </div>
            <div style={pm.grid}>
              {cat.modules.map((mod) => (
                <label key={mod.id} style={pm.modRow}>
                  <input
                    type="checkbox"
                    checked={perms.includes(mod.id)}
                    onChange={() => toggle(mod.id)}
                    style={pm.bigCheck}
                  />
                  <span style={pm.modLabel}>{mod.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const pm = {
  panel:      { marginTop: 18, borderTop: "1px solid #24354f", paddingTop: 18 },
  hint:       { color: "#94a3b8", fontSize: 18, margin: "0 0 16px", lineHeight: 1.5 },
  cat:        { marginBottom: 14 },
  catHeader:  { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  catLabel:   { color: "#e2e8f0", fontWeight: 600, fontSize: 18 },
  ownerBadge: { background: "#f97316", color: "#fff", borderRadius: 99, fontSize: 16, fontWeight: 600, padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.5 },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "4px 16px", paddingLeft: 30 },
  modRow:     { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 0" },
  bigCheck:   { width: 22, height: 22, accentColor: "#f97316", cursor: "pointer", flexShrink: 0 },
  modLabel:   { color: "#cbd5e1", fontSize: 18 },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ ...s.statCard, borderColor: `${color}66` }}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color }}>{value}</div>
    </div>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = ROLE_LABELS[role] || { label: role, color: "#64748b" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 16, fontWeight: 600, background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44`, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UnifiedTeamsPage() {
  const [tab, setTab] = useState("members");

  // workspace members state
  const { workspaceId, activeWorkspace, role: myRole, loading: wsLoading } = useWorkspace();
  const apiFetch = useApiFetch();
  const [members,       setMembers]       = useState([]);
  const [membersLoad,   setMembersLoad]   = useState(false);
  const [membError,     setMembError]     = useState("");
  const [membSuccess,   setMembSuccess]   = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState("sales");
  const [inviting,      setInviting]      = useState(false);
  const [expandedId,    setExpandedId]    = useState(null);
  const [teamUsage,     setTeamUsage]     = useState(null);

  // OTP state
  const [otpModal,      setOtpModal]      = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // sales teams state
  const [userId,       setUserId]       = useState("");
  const [teams,        setTeams]        = useState([]);
  const [teamsLoad,    setTeamsLoad]    = useState(true);
  const [memberDrafts, setMemberDrafts] = useState({});

  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner   = myRole === "owner";

  // ── load workspace members ────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    setMembersLoad(true); setMembError("");
    try {
      const res  = await apiFetch("/api/workspaces/members");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load team");
      setMembers(json.members || []);
    } catch (e) { setMembError(e?.message || "Failed to load members"); }
    finally     { setMembersLoad(false); }
  }, [workspaceId, apiFetch]);

  useEffect(() => {
    if (!wsLoading && workspaceId) loadMembers();
  }, [workspaceId, wsLoading, loadMembers]);

  useEffect(() => {
    if (!workspaceId || wsLoading) return;
    apiFetch(`/api/workspaces/usage?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setTeamUsage(j); })
      .catch(() => {});
  }, [workspaceId, wsLoading, apiFetch]);

  // ── load sales teams ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || "guest";
      if (!alive) return;
      setUserId(uid);
      const stored = readJson(`${TEAM_KEY}${uid}`, []);
      setTeams(stored.length ? stored : buildDefaultTeams());
      setTeamsLoad(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  // ── sales team helpers ────────────────────────────────────────────────────
  function persistTeams(next) {
    setTeams(next);
    writeJson(`${TEAM_KEY}${userId || "guest"}`, next);
  }
  function updateTeam(i, field, value) {
    const next = [...teams]; next[i] = { ...next[i], [field]: value }; persistTeams(next);
  }
  function addTeam() {
    persistTeams([...teams, { id: `team_${Date.now()}`, name: "New Team", manager: "", members: "", target: 0, color: "#22c55e" }]);
  }
  function deleteTeam(i) { persistTeams(teams.filter((_, idx) => idx !== i)); }
  function addSalesMember(i) {
    const draft = String(memberDrafts[i] || "").trim();
    if (!draft) return;
    updateTeam(i, "members", joinMembers([...parseMembers(teams[i]?.members), draft]));
    setMemberDrafts((p) => ({ ...p, [i]: "" }));
  }
  function removeSalesMember(i, name) {
    updateTeam(i, "members", joinMembers(parseMembers(teams[i]?.members).filter((m) => m !== name)));
  }

  // ── OTP-gated action helpers ──────────────────────────────────────────────
  function gateWithOtp(action) { setPendingAction(action); setOtpModal(true); }

  async function onOtpVerified() {
    setOtpModal(false);
    if (!pendingAction) return;
    const { type, payload } = pendingAction;
    setPendingAction(null);
    if (type === "invite")     await doInvite(payload.email, payload.role);
    if (type === "changeRole") await doChangeRole(payload.memberId, payload.newRole);
    if (type === "remove")     await doRemove(payload.memberId);
  }

  function handleInviteSubmit(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    gateWithOtp({ type: "invite", payload: { email: inviteEmail.trim(), role: inviteRole } });
  }

  async function doInvite(email, role) {
    setInviting(true); setMembError(""); setMembSuccess("");
    try {
      const res  = await apiFetch("/api/workspaces/invite", {
        method: "POST", body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Invite failed");
      setMembSuccess(`${email} has been added to the workspace.`);
      setInviteEmail(""); setInviteRole("sales");
      await loadMembers();
    } catch (e) { setMembError(e?.message || "Failed to send invite"); }
    finally     { setInviting(false); }
  }

  async function doChangeRole(memberId, newRole) {
    setMembError(""); setMembSuccess("");
    try {
      const res  = await apiFetch("/api/workspaces/members", {
        method: "PATCH", body: JSON.stringify({ member_id: memberId, role: newRole }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to update role");
      setMembSuccess("Role updated.");
      await loadMembers();
    } catch (e) { setMembError(e?.message || "Failed to update role"); }
  }

  async function doRemove(memberId) {
    setMembError(""); setMembSuccess("");
    try {
      const res  = await apiFetch(`/api/workspaces/members?member_id=${memberId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to remove member");
      setMembSuccess("Member removed.");
      await loadMembers();
    } catch (e) { setMembError(e?.message || "Failed to remove member"); }
  }

  // ── sales team totals ─────────────────────────────────────────────────────
  const teamTotals = useMemo(() => ({
    teams:   teams.length,
    members: teams.reduce((sum, t) => sum + String(t.members || "").split(",").map((x) => x.trim()).filter(Boolean).length, 0),
    target:  teams.reduce((sum, t) => sum + Number(t.target || 0), 0),
  }), [teams]);

  if (wsLoading) return <div style={{ padding: 32, color: "#94a3b8" }}>Loading workspace…</div>;

  // ── Pending action label for OTP modal ─────────────────────────────────────
  const otpActionLabel =
    pendingAction?.type === "invite"     ? `add ${pendingAction.payload.email} to the workspace` :
    pendingAction?.type === "remove"     ? "remove this member from the workspace" :
    pendingAction?.type === "changeRole" ? `change this member's role to ${pendingAction.payload.newRole}` :
    "confirm this action";

  return (
    <main style={s.main}>
      {otpModal && (
        <SmsOtpModal
          actionLabel={otpActionLabel}
          onVerified={onOtpVerified}
          onCancel={() => { setOtpModal(false); setPendingAction(null); }}
        />
      )}

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div style={s.bannerWrap}>
        <div style={s.banner}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <ICONS.account color="#fff" size={48} style={{ flexShrink: 0, marginTop: 4 }} />
            <div>
              <h1 style={s.bannerTitle}>Team Management</h1>
              <p style={s.bannerSub}>Manage workspace access, module permissions, and sales team structure.</p>
            </div>
          </div>
          <div style={s.bannerActions}>
            <button
              onClick={() => setTab("members")}
              style={tab === "members" ? s.tabActive : s.tabInactive}
            >
              👥 Workspace Members
            </button>
            <button
              onClick={() => setTab("teams")}
              style={tab === "teams" ? s.tabActive : s.tabInactive}
            >
              🏆 Sales Teams
            </button>
            <Link href="/modules/email/crm" style={s.backBtn}>← Back</Link>
          </div>
        </div>
      </div>

      <div style={s.container}>

        {/* ════════════════════════════════════════════════════════════════════
            WORKSPACE MEMBERS TAB
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "members" && (
          <>
            <div style={s.statsGrid}>
              <StatCard label="Members"  value={members.length}                                         color="#f97316" />
              <StatCard label="Active"   value={members.filter((m) => m.status === "active").length}    color="#22c55e" />
              <StatCard label="Pending"  value={members.filter((m) => m.status !== "active").length}    color="#f59e0b" />
            </div>

            {membError   && <div style={s.alertErr}>{membError}</div>}
            {membSuccess && <div style={s.alertOk}>{membSuccess}</div>}

            {/* Invite form */}
            {canManage && (
              <div style={s.card}>
                <h2 style={s.cardTitle}>Invite a team member</h2>

                {/* Usage bar */}
                {teamUsage && teamUsage.limit !== null && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600 }}>Team members used</span>
                      <span style={{
                        fontSize: 16, fontWeight: 600,
                        color: teamUsage.atLimit ? "#ef4444" : teamUsage.used / teamUsage.limit >= 0.8 ? "#f59e0b" : "#10b981",
                      }}>
                        {teamUsage.used} / {teamUsage.limit}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${Math.min(100, (teamUsage.used / teamUsage.limit) * 100)}%`,
                        background: teamUsage.atLimit ? "#ef4444" : teamUsage.used / teamUsage.limit >= 0.8 ? "#f59e0b" : "#10b981",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    {teamUsage.atLimit && (
                      <p style={{ margin: "8px 0 0", fontSize: 16, color: "#f87171" }}>
                        Team member limit reached on the <strong>{teamUsage.planName}</strong> plan.{" "}
                        <a href="/billing" style={{ color: "#60a5fa", textDecoration: "underline" }}>Upgrade to add more.</a>
                      </p>
                    )}
                    {!teamUsage.atLimit && teamUsage.used / teamUsage.limit >= 0.8 && (
                      <p style={{ margin: "8px 0 0", fontSize: 16, color: "#fbbf24" }}>
                        Approaching team member limit. <a href="/billing" style={{ color: "#60a5fa", textDecoration: "underline" }}>Consider upgrading.</a>
                      </p>
                    )}
                  </div>
                )}

                <form onSubmit={handleInviteSubmit}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="email" placeholder="colleague@example.com"
                      value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      required disabled={!!teamUsage?.atLimit} style={{ ...s.input, flex: "1 1 220px", opacity: teamUsage?.atLimit ? 0.5 : 1 }}
                    />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={s.select} disabled={!!teamUsage?.atLimit}>
                      {INVITABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                      ))}
                    </select>
                    <button type="submit" disabled={inviting || !!teamUsage?.atLimit} style={{ ...s.primaryBtn, opacity: (inviting || teamUsage?.atLimit) ? 0.6 : 1 }}>
                      {inviting ? "Adding…" : teamUsage?.atLimit ? "Limit Reached" : "Send Invite"}
                    </button>
                  </div>
                  <p style={s.hint}>An SMS verification code will be sent to your phone to confirm adding this user.</p>
                </form>
              </div>
            )}

            {/* Members list */}
            {membersLoad ? (
              <p style={{ color: "#64748b", fontSize: 18 }}>Loading members…</p>
            ) : (
              <div>
                <h2 style={{ ...s.sectionTitle, marginBottom: 14 }}>
                  {activeWorkspace?.name} · {members.length} member{members.length !== 1 ? "s" : ""}
                </h2>

                {members.length === 0 && (
                  <div style={s.emptyState}>No members yet. Invite someone above.</div>
                )}

                {members.map((m) => {
                  const expanded = expandedId === m.id;
                  return (
                    <div key={m.id} style={s.memberCard}>
                      <div style={s.memberRow}>
                        {/* Avatar */}
                        <div style={s.avatar}>{(m.email || "?")[0].toUpperCase()}</div>

                        {/* Email + status */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={s.memberEmail}>{m.email || m.user_id}</div>
                          <span style={{ fontSize: 18, fontWeight: 500, color: m.status === "active" ? "#22c55e" : "#f59e0b" }}>
                            {m.status === "active" ? "Active" : "Invite sent"}
                          </span>
                        </div>

                        <RoleBadge role={m.role} />

                        {/* Role change (owner only) */}
                        {isOwner && m.role !== "owner" && (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              gateWithOtp({ type: "changeRole", payload: { memberId: m.id, newRole: e.target.value } })
                            }
                            style={s.smallSelect}
                          >
                            {INVITABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                            ))}
                          </select>
                        )}

                        {/* Toggle permissions */}
                        <button
                          onClick={() => setExpandedId(expanded ? null : m.id)}
                          style={s.permBtn}
                        >
                          {expanded ? "▲ Permissions" : "▼ Permissions"}
                        </button>

                        {/* Remove (owner only) */}
                        {isOwner && m.role !== "owner" && (
                          <button
                            onClick={() => gateWithOtp({ type: "remove", payload: { memberId: m.id } })}
                            style={s.removeBtn}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Module permissions panel */}
                      {expanded && workspaceId && (
                        <ModulePermsPanel memberId={m.id} workspaceId={workspaceId} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SALES TEAMS TAB
           ════════════════════════════════════════════════════════════════════ */}
        {tab === "teams" && (
          <>
            <div style={s.statsGrid}>
              <StatCard label="Teams"   value={`${teamTotals.teams}`}             color="#f97316" />
              <StatCard label="Members" value={`${teamTotals.members}`}           color="#22c55e" />
              <StatCard label="Target"  value={formatMoney(teamTotals.target)}    color="#3b82f6" />
            </div>

            <div style={s.toolbarRow}>
              <div>
                <h2 style={s.sectionTitle}>Sales team structure</h2>
                <p style={s.sectionSub}>These teams are shared with the pipeline board.</p>
              </div>
              <button onClick={addTeam} style={s.primaryBtn}>+ Add Team</button>
            </div>

            {teamsLoad ? (
              <div style={s.emptyState}>Loading teams…</div>
            ) : teams.length === 0 ? (
              <div style={s.emptyState}>No teams yet. Click &ldquo;+ Add Team&rdquo; to get started.</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {teams.map((team, i) => (
                  <div key={team.id} style={s.teamCard}>
                    <div style={s.teamCardTop}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ ...s.colorDot, background: team.color || "#22c55e" }} />
                        <strong style={s.teamName}>{team.name || "Untitled Team"}</strong>
                      </div>
                      <button onClick={() => deleteTeam(i)} style={s.deleteBtn}>Delete</button>
                    </div>

                    <div style={s.formGrid}>
                      <label style={s.field}>
                        <span>Team Name</span>
                        <input value={team.name || ""} onChange={(e) => updateTeam(i, "name", e.target.value)} style={s.input} />
                      </label>
                      <label style={s.field}>
                        <span>Manager</span>
                        <input value={team.manager || ""} onChange={(e) => updateTeam(i, "manager", e.target.value)} style={s.input} />
                      </label>
                      <label style={s.field}>
                        <span>Monthly Target</span>
                        <input type="number" min="0" value={team.target || 0} onChange={(e) => updateTeam(i, "target", e.target.value)} style={s.input} />
                      </label>
                    </div>

                    <div style={s.memberSection}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 18 }}>Team Members</span>
                        <span style={{ color: "#94a3b8", fontSize: 18 }}>Add one at a time below</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {parseMembers(team.members).length === 0 ? (
                          <span style={{ color: "#94a3b8", fontSize: 18 }}>No members yet.</span>
                        ) : (
                          parseMembers(team.members).map((name) => (
                            <span key={`${team.id}-${name}`} style={s.memberChip}>
                              👤 {name}
                              <button type="button" onClick={() => removeSalesMember(i, name)} style={s.memberChipBtn}>×</button>
                            </span>
                          ))
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                        <input
                          value={memberDrafts[i] || ""}
                          onChange={(e) => setMemberDrafts((p) => ({ ...p, [i]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSalesMember(i); } }}
                          style={s.input} placeholder="Type a team member name"
                        />
                        <button type="button" onClick={() => addSalesMember(i)} style={s.addMemberBtn}>+ Add Member</button>
                      </div>

                      <label style={s.field}>
                        <span>Bulk Edit Members</span>
                        <input
                          value={team.members || ""}
                          onChange={(e) => updateTeam(i, "members", e.target.value)}
                          style={s.input} placeholder="Paste names separated by commas"
                        />
                      </label>
                    </div>

                    <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1", fontSize: 18 }}>
                        <span>Team Colour</span>
                        <input
                          type="color" value={team.color || "#22c55e"}
                          onChange={(e) => updateTeam(i, "color", e.target.value)}
                          style={{ width: 48, height: 32, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                        />
                      </label>
                      <div style={{ color: "#93c5fd", fontWeight: 600 }}>Current target: {formatMoney(team.target)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  main:         { minHeight: "100vh", background: "#0c121a", color: "#fff" },
  bannerWrap:   { width: "100%", display: "flex", justifyContent: "center", paddingTop: 24 },
  banner:       { width: 1320, maxWidth: "calc(100% - 24px)", borderRadius: 16, padding: "20px 24px", background: "linear-gradient(175deg, #f97316 0%, #c2410c 100%)", border: "1px solid #7c2d12", boxShadow: "0 8px 28px rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" },
  bannerTitle:  { margin: 0, fontSize: 40, fontWeight: 600 },
  bannerSub:    { margin: "6px 0 0", fontSize: 18, opacity: 0.9 },
  bannerActions:{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  tabActive:    { background: "#fff", border: "none", color: "#c2410c", fontWeight: 600, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 18 },
  tabInactive:  { background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontWeight: 600, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontSize: 18 },
  backBtn:      { background: "rgba(0,0,0,.18)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10, padding: "10px 14px", color: "#fff", textDecoration: "none", fontWeight: 600 },
  container:    { width: "100%", maxWidth: 1320, margin: "28px auto", padding: "0 20px 48px" },
  statsGrid:    { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 24 },
  statCard:     { background: "#0f1622", border: "1px solid #24354f", borderRadius: 14, padding: 16 },
  statLabel:    { color: "#94a3b8", fontSize: 18, fontWeight: 600, marginBottom: 8 },
  statValue:    { fontSize: 28, fontWeight: 600 },
  alertErr:     { background: "#7f1d1d33", border: "1px solid #ef444488", color: "#fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 18 },
  alertOk:      { background: "#14532d33", border: "1px solid #22c55e88", color: "#86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 18 },
  card:         { background: "#0f1622", border: "1px solid #24354f", borderRadius: 14, padding: 20, marginBottom: 24 },
  cardTitle:    { margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "#e2e8f0" },
  input:        { background: "#08101b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 18, outline: "none", width: "100%", boxSizing: "border-box" },
  select:       { background: "#08101b", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 18, cursor: "pointer" },
  primaryBtn:   { background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 18, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  hint:         { margin: "10px 0 0", fontSize: 18, color: "#64748b" },
  sectionTitle: { margin: 0, fontSize: 22, fontWeight: 600 },
  sectionSub:   { margin: "6px 0 0", color: "#94a3b8", fontSize: 18 },
  memberCard:   { background: "#0f1622", border: "1px solid #24354f", borderRadius: 14, padding: "16px 20px", marginBottom: 12 },
  memberRow:    { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  avatar:       { width: 38, height: 38, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 16, fontWeight: 600, flexShrink: 0 },
  memberEmail:  { color: "#e2e8f0", fontSize: 18, fontWeight: 500 },
  smallSelect:  { background: "#08101b", border: "1px solid #334155", borderRadius: 6, padding: "5px 8px", color: "#f1f5f9", fontSize: 18, cursor: "pointer" },
  permBtn:      { background: "#1e293b", border: "1px solid #334155", color: "#93c5fd", borderRadius: 8, padding: "6px 12px", fontSize: 18, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  removeBtn:    { background: "transparent", border: "1px solid #ef444466", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 18, cursor: "pointer" },
  emptyState:   { background: "#0f1622", border: "1px solid #24354f", borderRadius: 14, padding: 20, color: "#94a3b8", fontSize: 18 },
  toolbarRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" },
  teamCard:     { background: "#0f1622", border: "1px solid #24354f", borderRadius: 16, padding: 18 },
  teamCardTop:  { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  teamName:     { fontSize: 18 },
  colorDot:     { width: 12, height: 12, borderRadius: 999, display: "inline-block", flexShrink: 0 },
  deleteBtn:    { background: "#3f1a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 10px", cursor: "pointer" },
  formGrid:     { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  field:        { display: "grid", gap: 6, color: "#cbd5e1", fontSize: 18 },
  memberSection:{ marginTop: 14, borderTop: "1px solid #24354f", paddingTop: 14, display: "grid", gap: 10 },
  memberChip:   { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#dcfce7", padding: "6px 10px", fontSize: 18, fontWeight: 600 },
  memberChipBtn:{ background: "transparent", border: "none", color: "#fecaca", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 },
  addMemberBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};
