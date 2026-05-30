import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";
import LeadDetailsModal from "../../../../components/crm/LeadDetailsModal";

const TEAM_STORAGE_KEY_PREFIX = "crm:pipeline:teams:";
const LEAD_META_KEY_PREFIX = "crm:pipeline:leadMeta:";

function s(value) {
  return String(value ?? "").trim();
}

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
    // ignore storage issues
  }
}

function parseList(value) {
  return String(value || "")
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function normaliseLeadMeta(lead, meta = {}) {
  return {
    team: s(meta.team),
    owner: s(meta.owner),
    product: s(meta.product || lead?.product),
    source: s(meta.source || lead?.source),
    status: s(meta.status || "open").toLowerCase(),
    priority: s(meta.priority || "Medium"),
    tags: s(meta.tags || lead?.tags),
    dealValue: Number(meta.dealValue || 0),
    probability: Math.max(0, Math.min(100, Number(meta.probability || 0))),
    closeDate: s(meta.closeDate),
    nextStep: s(meta.nextStep),
    outcome: s(meta.outcome),
    quoteStatus: s(meta.quoteStatus || "draft"),
    quoteNumber: s(meta.quoteNumber),
    quoteTemplateName: s(meta.quoteTemplateName),
    quoteValidUntil: s(meta.quoteValidUntil),
    quoteTaxRate: Math.max(0, Number(meta.quoteTaxRate || 0)),
    quoteItems: Array.isArray(meta.quoteItems) ? meta.quoteItems : [],
  };
}

function isClosingSoon(closeDate) {
  if (!closeDate) return false;
  const close = new Date(closeDate);
  if (Number.isNaN(close.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  close.setHours(0, 0, 0, 0);
  const diff = Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 30;
}

function getStatusTone(status) {
  switch (String(status || "").toLowerCase()) {
    case "won":
    case "paid":
    case "accepted":
      return { bg: "rgba(34,197,94,0.16)", color: "#86efac", border: "rgba(34,197,94,0.35)" };
    case "lost":
    case "declined":
    case "overdue":
    case "refunded":
      return { bg: "rgba(239,68,68,0.16)", color: "#fca5a5", border: "rgba(239,68,68,0.35)" };
    case "sent":
    case "partial":
      return { bg: "rgba(59,130,246,0.16)", color: "#93c5fd", border: "rgba(59,130,246,0.35)" };
    default:
      return { bg: "rgba(148,163,184,0.15)", color: "#cbd5e1", border: "rgba(148,163,184,0.3)" };
  }
}

function StatusPill({ value }) {
  const tone = getStatusTone(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 16,
        fontWeight: 600,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {String(value || "—").replace(/_/g, " ")}
    </span>
  );
}

export default function CRMDealsPage() {
  const [userId, setUserId] = useState("");
  const [leads, setLeads] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leadMetaMap, setLeadMetaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    team: "all",
    owner: "all",
    payment: "all",
  });

  async function loadData() {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("CRM deals auth error:", authError);
        setLoading(false);
        return;
      }

      const uid = authData?.user?.id || "";
      setUserId(uid);

      if (!uid) {
        setLeads([]);
        setTeams([]);
        setLeadMetaMap({});
        setLoading(false);
        return;
      }

      const { data: leadRows, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (leadError) {
        console.error("CRM deals leads error:", leadError);
        setLeads([]);
      } else {
        setLeads(leadRows || []);
      }

      setTeams(readStoredJson(`${TEAM_STORAGE_KEY_PREFIX}${uid}`, []));
      setLeadMetaMap(readStoredJson(`${LEAD_META_KEY_PREFIX}${uid}`, {}));
    } catch (err) {
      console.error("CRM deals load exception:", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const enrichedLeads = useMemo(
    () =>
      (leads || []).map((lead) => ({
        ...lead,
        crmMeta: normaliseLeadMeta(lead, {
          ...(leadMetaMap?.[lead.id] || {}),
          ...(lead?.crmMeta || {}),
        }),
      })),
    [leads, leadMetaMap]
  );

  const explicitDeals = useMemo(
    () =>
      enrichedLeads.filter((lead) => {
        const meta = lead.crmMeta || {};
        return Boolean(
          Number(meta.dealValue || 0) > 0 ||
            s(meta.product) ||
            s(meta.owner) ||
            s(meta.team) ||
            s(meta.closeDate) ||
            s(meta.quoteNumber) ||
            s(meta.invoiceNumber) ||
            meta.quoteStatus !== "draft" ||
            meta.invoiceStatus !== "not_sent" ||
            meta.paymentStatus !== "unpaid"
        );
      }),
    [enrichedLeads]
  );

  const rows = explicitDeals.length ? explicitDeals : enrichedLeads;

  const ownerOptions = useMemo(() => {
    const values = new Set();
    teams.forEach((team) => {
      if (team?.manager) values.add(s(team.manager));
      parseList(team?.members).forEach((member) => values.add(member));
    });
    rows.forEach((lead) => parseList(lead.crmMeta?.owner).forEach((owner) => values.add(owner)));
    return Array.from(values).filter(Boolean);
  }, [teams, rows]);

  const teamOptions = useMemo(() => {
    const values = new Set();
    teams.forEach((team) => values.add(s(team?.name)));
    rows.forEach((lead) => values.add(s(lead.crmMeta?.team)));
    return Array.from(values).filter(Boolean);
  }, [teams, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((lead) => {
      const meta = lead.crmMeta || {};
      if (filters.status !== "all" && String(meta.status || "open") !== filters.status) return false;
      if (filters.team !== "all" && (meta.team || "Unassigned") !== filters.team) return false;
      if (filters.owner !== "all" && !parseList(meta.owner).includes(filters.owner)) return false;
      if (filters.payment !== "all" && String(meta.quoteStatus || "draft") !== filters.payment) return false;
      return true;
    });
  }, [rows, filters]);

  const metrics = useMemo(() => {
    let pipelineValue = 0;
    let weightedForecast = 0;
    let wonRevenue = 0;
    let quotesSent = 0;
    let quotesAccepted = 0;
    let draftQuotes = 0;
    let closingSoon = 0;

    filteredRows.forEach((lead) => {
      const meta = lead.crmMeta || {};
      const value = Number(meta.dealValue || 0);
      const probability = Math.max(0, Math.min(100, Number(meta.probability || 0)));
      pipelineValue += value;
      weightedForecast += value * (probability / 100);
      if (meta.status === "won") wonRevenue += value;
      if (["sent", "accepted"].includes(String(meta.quoteStatus || ""))) quotesSent += 1;
      if (String(meta.quoteStatus || "") === "accepted") quotesAccepted += 1;
      if (String(meta.quoteStatus || "") === "draft") draftQuotes += 1;
      if (isClosingSoon(meta.closeDate)) closingSoon += 1;
    });

    return {
      dealCount: filteredRows.length,
      pipelineValue,
      weightedForecast,
      wonRevenue,
      quotesSent,
      quotesAccepted,
      draftQuotes,
      closingSoon,
    };
  }, [filteredRows]);

  function openLead(lead) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  }

  function closeLead() {
    setIsLeadModalOpen(false);
    setSelectedLead(null);
  }

  function handleLeadCrmMetaSave(leadId, meta) {
    setLeadMetaMap((prev) => {
      const next = { ...prev, [leadId]: meta || {} };
      if (userId) writeStoredJson(`${LEAD_META_KEY_PREFIX}${userId}`, next);
      return next;
    });

    const patch = {
      source: meta?.source || "",
      tags: meta?.tags || "",
      crmMeta: meta || {},
    };

    setLeads((prev) => (prev || []).map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)));
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, ...patch } : prev));
  }

  function handleNotesUpdated(leadId, notes) {
    setLeads((prev) => (prev || []).map((lead) => (lead.id === leadId ? { ...lead, notes } : lead)));
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, notes } : prev));
  }

  return (
    <main style={styles.main}>
      <div style={styles.bannerWrap}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>Deals & Revenue</h1>
            <p style={styles.bannerSub}>
              Track opportunities, quote progress, anticipated revenue, and closing forecasts in one place.
            </p>
          </div>
          <div style={styles.bannerActions}>
            <Link href="/modules/email/crm/pipelines" style={styles.secondaryBtn}>Open Pipeline</Link>
            <Link href="/modules/email/crm/reports" style={styles.secondaryBtn}>Reports</Link>
            <button type="button" onClick={loadData} style={styles.primaryBtn}>Refresh</button>
            <Link href="/modules/email/crm" style={styles.backBtn}>← Back</Link>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.metricsGrid}>
          <MetricCard label="Open Deals" value={String(metrics.dealCount)} accent="#38bdf8" />
          <MetricCard label="Pipeline Value" value={formatMoney(metrics.pipelineValue)} accent="#f97316" />
          <MetricCard label="Anticipated Revenue" value={formatMoney(metrics.weightedForecast)} accent="#22c55e" />
          <MetricCard label="Won Revenue" value={formatMoney(metrics.wonRevenue)} accent="#10b981" />
          <MetricCard label="Quotes Sent" value={String(metrics.quotesSent)} accent="#a855f7" />
          <MetricCard label="Accepted Quotes" value={String(metrics.quotesAccepted)} accent="#14b8a6" />
          <MetricCard label="Draft Quotes" value={String(metrics.draftQuotes)} accent="#f43f5e" />
          <MetricCard label="Closing Soon" value={String(metrics.closingSoon)} accent="#eab308" />
        </div>

        <div style={styles.filtersCard}>
          <div>
            <h2 style={styles.sectionTitle}>Opportunity Filters</h2>
            <p style={styles.sectionSub}>Use the lead modal to update quote status, template choice, and value.</p>
          </div>
          <div style={styles.filtersGrid}>
            <SelectField
              label="Deal Status"
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "all", label: "All deals" },
                { value: "open", label: "Open" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
              ]}
            />
            <SelectField
              label="Team"
              value={filters.team}
              onChange={(value) => setFilters((prev) => ({ ...prev, team: value }))}
              options={[{ value: "all", label: "All teams" }, ...teamOptions.map((team) => ({ value: team, label: team }))]}
            />
            <SelectField
              label="Owner"
              value={filters.owner}
              onChange={(value) => setFilters((prev) => ({ ...prev, owner: value }))}
              options={[{ value: "all", label: "All owners" }, ...ownerOptions.map((owner) => ({ value: owner, label: owner }))]}
            />
            <SelectField
              label="Quote Status"
              value={filters.payment}
              onChange={(value) => setFilters((prev) => ({ ...prev, payment: value }))}
              options={[
                { value: "all", label: "All quote states" },
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "accepted", label: "Accepted" },
                { value: "declined", label: "Declined" },
              ]}
            />
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeaderRow}>
            <div>
              <h2 style={styles.sectionTitle}>Deal Register</h2>
              <p style={styles.sectionSub}>Every lead can be managed here as an opportunity.</p>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading deals…</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.emptyState}>No deals match the current filters yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Lead</th>
                    <th style={styles.th}>Team / Owner</th>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Value</th>
                    <th style={styles.th}>Forecast</th>
                    <th style={styles.th}>Close</th>
                    <th style={styles.th}>Quote</th>
                    <th style={styles.th}>Template</th>
                    <th style={styles.th}>Valid Until</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((lead) => {
                    const meta = lead.crmMeta || {};
                    return (
                      <tr key={lead.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 600, color: "#fff" }}>{lead.name || lead.email || "Unnamed lead"}</div>
                          <div style={styles.subtleText}>{lead.email || lead.phone || meta.source || "—"}</div>
                        </td>
                        <td style={styles.td}>
                          <div>{meta.team || "Unassigned"}</div>
                          <div style={styles.subtleText}>{meta.owner || "No owner"}</div>
                        </td>
                        <td style={styles.td}>{meta.product || "—"}</td>
                        <td style={styles.td}>{formatMoney(meta.dealValue)}</td>
                        <td style={styles.td}>
                          <div>{meta.probability || 0}%</div>
                          <div style={styles.subtleText}>{formatMoney(Number(meta.dealValue || 0) * (Number(meta.probability || 0) / 100))}</div>
                        </td>
                        <td style={styles.td}>
                          <div>{meta.closeDate || "—"}</div>
                          {isClosingSoon(meta.closeDate) && <div style={{ ...styles.subtleText, color: "#fde68a" }}>Closing soon</div>}
                        </td>
                        <td style={styles.td}>
                          <StatusPill value={meta.quoteStatus || "draft"} />
                          {meta.quoteNumber ? <div style={styles.subtleText}>{meta.quoteNumber}</div> : null}
                        </td>
                        <td style={styles.td}>
                          <div>{meta.quoteTemplateName || "Custom"}</div>
                          <div style={styles.subtleText}>{meta.product || "Offer not set"}</div>
                        </td>
                        <td style={styles.td}>{meta.quoteValidUntil || "—"}</td>
                        <td style={styles.td}>
                          <button type="button" onClick={() => openLead(lead)} style={styles.openBtn}>Open Deal</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <LeadDetailsModal
        isOpen={isLeadModalOpen}
        lead={selectedLead}
        stages={[]}
        userId={userId}
        onClose={closeLead}
        onNotesUpdated={handleNotesUpdated}
        crmMeta={selectedLead?.crmMeta || {}}
        teamOptions={teams}
        onCrmMetaSave={handleLeadCrmMetaSave}
      />
    </main>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.metricCard, borderColor: accent }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: accent }}>{value}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#08111f",
    color: "#e5eefc",
    paddingBottom: 40,
  },
  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    paddingTop: 24,
  },
  banner: {
    width: "min(1320px, calc(100% - 32px))",
    borderRadius: 18,
    padding: "22px 24px",
    background: "linear-gradient(135deg, #be123c, #7c3aed)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    display: "flex",
    gap: 18,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },
  bannerTitle: {
    margin: 0,
    fontSize: 42,
    fontWeight: 600,
    color: "#fff",
  },
  bannerSub: {
    margin: "8px 0 0",
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 760,
  },
  bannerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 10,
    background: "#fff",
    color: "#7c2d12",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryBtn: {
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: 10,
    background: "rgba(9,9,11,0.18)",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  backBtn: {
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: 10,
    background: "rgba(9,9,11,0.18)",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  container: {
    width: "min(1320px, calc(100% - 32px))",
    margin: "22px auto 0",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  metricCard: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 16,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#94a3b8",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 600,
  },
  filtersCard: {
    marginTop: 18,
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: "#fff",
  },
  sectionSub: {
    margin: "6px 0 0",
    fontSize: 16,
    color: "#94a3b8",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#08111f",
    color: "#fff",
    padding: "0 12px",
    fontWeight: 600,
  },
  tableCard: {
    marginTop: 18,
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 18,
  },
  tableHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1080,
  },
  th: {
    textAlign: "left",
    fontSize: 16,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },
  tr: {
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  td: {
    padding: "12px",
    fontSize: 16,
    color: "#e2e8f0",
    verticalAlign: "top",
  },
  subtleText: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  openBtn: {
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    padding: "8px 10px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "26px 12px",
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 16,
  },
};
