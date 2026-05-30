import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import { supabase } from "../../../../utils/supabase-client";

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

function shortMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}m`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
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
    closeDate: s(meta.closeDate),
    dealValue: Number(meta.dealValue || 0),
    probability: Math.max(0, Math.min(100, Number(meta.probability || 0))),
  };
}

function groupRevenueRows(leads, getLabels, splitAcrossLabels = false) {
  const map = new Map();

  for (const lead of leads) {
    const value = Number(lead.crmMeta?.dealValue || 0);
    const labels = (getLabels(lead) || []).filter(Boolean);
    const effectiveLabels = labels.length ? labels : ["Unassigned"];
    const share = splitAcrossLabels ? value / effectiveLabels.length : value;

    for (const label of effectiveLabels) {
      const current = map.get(label) || { label, deals: 0, revenue: 0, wonRevenue: 0 };
      current.deals += 1;
      current.revenue += share;
      if (String(lead.crmMeta?.status || "open") === "won") current.wonRevenue += share;
      map.set(label, current);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export default function CRMReportsPage() {
  const [userId, setUserId] = useState("");
  const [leads, setLeads] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leadMetaMap, setLeadMetaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState("");
  const [filters, setFilters] = useState({
    team: "all",
    member: "all",
    product: "all",
    status: "all",
    timeline: "all",
  });

  async function loadReportData() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || "guest";
      setUserId(uid);

      const { data: leadRows, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("load report leads error:", error);
        setLeads([]);
      } else {
        setLeads(leadRows || []);
      }

      setTeams(readStoredJson(`${TEAM_STORAGE_KEY_PREFIX}${uid}`, []));
      setLeadMetaMap(readStoredJson(`${LEAD_META_KEY_PREFIX}${uid}`, {}));
      setGeneratedAt(new Date().toLocaleString("en-AU"));
    } catch (err) {
      console.error("load report data exception:", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReportData();
  }, []);

  const enrichedLeads = useMemo(
    () =>
      leads.map((lead) => ({
        ...lead,
        crmMeta: normaliseLeadMeta(lead, leadMetaMap?.[lead.id] || {}),
      })),
    [leads, leadMetaMap]
  );

  const teamOptions = useMemo(() => {
    const values = new Set();
    teams.forEach((team) => values.add(s(team?.name)));
    enrichedLeads.forEach((lead) => values.add(s(lead.crmMeta?.team)));
    return Array.from(values).filter(Boolean);
  }, [teams, enrichedLeads]);

  const memberOptions = useMemo(() => {
    const values = new Set();
    teams.forEach((team) => {
      if (team?.manager) values.add(s(team.manager));
      parseList(team?.members).forEach((member) => values.add(member));
    });
    enrichedLeads.forEach((lead) => parseList(lead.crmMeta?.owner).forEach((member) => values.add(member)));
    return Array.from(values).filter(Boolean);
  }, [teams, enrichedLeads]);

  const productOptions = useMemo(() => {
    const values = new Set();
    enrichedLeads.forEach((lead) => values.add(s(lead.crmMeta?.product)));
    return Array.from(values).filter(Boolean);
  }, [enrichedLeads]);

  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter((lead) => {
      const meta = lead.crmMeta || {};
      if (filters.team !== "all" && (meta.team || "Unassigned") !== filters.team) return false;
      if (filters.member !== "all" && !parseList(meta.owner).includes(filters.member)) return false;
      if (filters.product !== "all" && (meta.product || "Unassigned") !== filters.product) return false;
      if (filters.status !== "all" && String(meta.status || "open") !== filters.status) return false;

      if (filters.timeline !== "all") {
        const rawDate = lead.created_at || meta.closeDate || lead.updated_at;
        const d = rawDate ? new Date(rawDate) : null;
        if (d && !Number.isNaN(d.getTime())) {
          const now = new Date();
          const cutoff = new Date();
          const days = filters.timeline === "7d" ? 7 : filters.timeline === "30d" ? 30 : 90;
          cutoff.setHours(0, 0, 0, 0);
          cutoff.setDate(now.getDate() - (days - 1));
          if (d < cutoff) return false;
        }
      }

      return true;
    });
  }, [enrichedLeads, filters]);

  const totals = useMemo(() => {
    let revenue = 0;
    let weighted = 0;
    let wonRevenue = 0;
    let lostCount = 0;

    for (const lead of filteredLeads) {
      const value = Number(lead.crmMeta?.dealValue || 0);
      const probability = Math.max(0, Math.min(100, Number(lead.crmMeta?.probability || 0)));
      revenue += value;
      weighted += value * (probability / 100);
      if (lead.crmMeta?.status === "won") wonRevenue += value;
      if (lead.crmMeta?.status === "lost") lostCount += 1;
    }

    return {
      leads: filteredLeads.length,
      revenue,
      weighted,
      wonRevenue,
      lostCount,
    };
  }, [filteredLeads]);

  const revenueByTeam = useMemo(
    () => groupRevenueRows(filteredLeads, (lead) => [lead.crmMeta?.team || "Unassigned"]),
    [filteredLeads]
  );

  const revenueByMember = useMemo(
    () => groupRevenueRows(filteredLeads, (lead) => parseList(lead.crmMeta?.owner), true),
    [filteredLeads]
  );

  const revenueByProduct = useMemo(
    () => groupRevenueRows(filteredLeads, (lead) => [lead.crmMeta?.product || "Unassigned"]),
    [filteredLeads]
  );

  const stackedStatusData = useMemo(() => {
    const map = new Map();
    for (const lead of filteredLeads) {
      const meta = lead.crmMeta || {};
      const label = meta.team || "Unassigned";
      const value = Number(meta.dealValue || 0);
      const status = String(meta.status || "open").toLowerCase();
      const row = map.get(label) || { name: label, open: 0, won: 0, lost: 0 };
      if (status === "won") row.won += value;
      else if (status === "lost") row.lost += value;
      else row.open += value;
      map.set(label, row);
    }
    return Array.from(map.values()).sort((a, b) => (b.open + b.won + b.lost) - (a.open + a.won + a.lost)).slice(0, 8);
  }, [filteredLeads]);

  const lineForecastData = useMemo(() => {
    const rows = [];
    const now = new Date();

    for (let i = 0; i < 6; i += 1) {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      rows.push({
        stamp: month.getTime(),
        name: month.toLocaleString("en-AU", { month: "short", year: "2-digit" }),
        pipeline: 0,
        anticipated: 0,
        won: 0,
      });
    }

    for (const lead of filteredLeads) {
      const meta = lead.crmMeta || {};
      const rawDate = meta.closeDate || lead.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const stamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const row = rows.find((entry) => entry.stamp === stamp);
      if (!row) continue;
      const value = Number(meta.dealValue || 0);
      const probability = Math.max(0, Math.min(100, Number(meta.probability || 0)));
      row.pipeline += value;
      row.anticipated += value * (probability / 100);
      if (String(meta.status || "open") === "won") row.won += value;
    }

    return rows;
  }, [filteredLeads]);

  const pieStatusData = useMemo(() => {
    const rows = [
      { name: "Open", value: 0, fill: "#3b82f6" },
      { name: "Won", value: 0, fill: "#22c55e" },
      { name: "Lost", value: 0, fill: "#ef4444" },
    ];
    const map = { open: rows[0], won: rows[1], lost: rows[2] };

    for (const lead of filteredLeads) {
      const status = String(lead.crmMeta?.status || "open").toLowerCase();
      const key = status === "won" ? "won" : status === "lost" ? "lost" : "open";
      map[key].value += 1;
    }

    return rows.filter((row) => row.value > 0);
  }, [filteredLeads]);

  const winRateStats = useMemo(() => {
    const won = filteredLeads.filter((lead) => String(lead.crmMeta?.status || "open") === "won").length;
    const lost = filteredLeads.filter((lead) => String(lead.crmMeta?.status || "open") === "lost").length;
    const open = filteredLeads.filter((lead) => String(lead.crmMeta?.status || "open") === "open").length;
    const total = filteredLeads.length || 1;
    const rate = (won / total) * 100;

    return {
      won,
      lost,
      open,
      total,
      rate,
      label: `${Math.round(rate)}%`,
      basis: "of all enquiries",
    };
  }, [filteredLeads]);

  const comboRevenueData = useMemo(() => {
    const map = new Map();
    for (const lead of filteredLeads) {
      const meta = lead.crmMeta || {};
      const label = meta.product || "Unassigned";
      const value = Number(meta.dealValue || 0);
      const probability = Math.max(0, Math.min(100, Number(meta.probability || 0)));
      const row = map.get(label) || { name: label, pipeline: 0, anticipated: 0 };
      row.pipeline += value;
      row.anticipated += value * (probability / 100);
      map.set(label, row);
    }
    return Array.from(map.values()).sort((a, b) => b.pipeline - a.pipeline).slice(0, 6);
  }, [filteredLeads]);

  return (
    <main style={styles.main}>
      <div style={styles.bannerWrap}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>CRM Reports</h1>
            <p style={styles.bannerSub}>
              Generate live reports by team, member, product, revenue, and deal status.
            </p>
            <div style={styles.bannerMeta}>Last refreshed: {generatedAt || "—"}</div>
          </div>
          <div style={styles.bannerActions}>
            <button type="button" onClick={loadReportData} style={styles.primaryBtn}>
              Generate Report
            </button>
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
        <div style={styles.filtersCard}>
          <div>
            <h2 style={styles.sectionTitle}>Filters</h2>
            <p style={styles.sectionSub}>Narrow reports by the dimensions you want to review.</p>
          </div>
          <div style={styles.filtersGrid}>
            <select value={filters.timeline} onChange={(e) => setFilters((prev) => ({ ...prev, timeline: e.target.value }))} style={styles.select}>
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <select value={filters.team} onChange={(e) => setFilters((prev) => ({ ...prev, team: e.target.value }))} style={styles.select}>
              <option value="all">All teams</option>
              {teamOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select value={filters.member} onChange={(e) => setFilters((prev) => ({ ...prev, member: e.target.value }))} style={styles.select}>
              <option value="all">All members</option>
              {memberOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select value={filters.product} onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))} style={styles.select}>
              <option value="all">All products</option>
              {productOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={styles.select}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <StatCard label="Deals" value={`${totals.leads}`} color="#f97316" />
          <StatCard label="Pipeline Revenue" value={formatMoney(totals.revenue)} color="#22c55e" />
          <StatCard label="Anticipated Revenue" value={formatMoney(totals.weighted)} color="#3b82f6" />
          <StatCard label="Won Revenue" value={formatMoney(totals.wonRevenue)} color="#a855f7" />
        </div>

        {loading ? (
          <div style={styles.emptyState}>Generating report…</div>
        ) : filteredLeads.length === 0 ? (
          <div style={styles.emptyState}>No leads match the current report filters.</div>
        ) : (
          <>
            <div style={styles.chartGrid}>
              <ChartCard title="Stacked Bar • Revenue by Team Status">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stackedStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24354f" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={shortMoney} />
                    <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ background: "#08101b", border: "1px solid #24354f", color: "#fff" }} />
                    <Legend />
                    <Bar dataKey="open" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="won" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lost" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Line Graph • Pipeline Trend">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineForecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24354f" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={shortMoney} />
                    <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ background: "#08101b", border: "1px solid #24354f", color: "#fff" }} />
                    <Legend />
                    <Line type="monotone" dataKey="pipeline" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="anticipated" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="won" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Pie Chart • Deal Status Mix">
                <div style={styles.winRateBanner}>
                  <div>
                    <div style={styles.winRateLabel}>Win rate</div>
                    <div style={styles.winRateSub}>{winRateStats.won} won • {winRateStats.open} open • {winRateStats.lost} lost • {winRateStats.basis}</div>
                  </div>
                  <div style={styles.winRateValue}>{winRateStats.label}</div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      labelLine={false}
                      label={({ percent = 0 }) => `${Math.round(percent * 100)}%`}
                    >
                      {pieStatusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const total = pieStatusData.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1;
                        const percent = Math.round((Number(value || 0) / total) * 100);
                        return [`${value} deals (${percent}%)`, name];
                      }}
                      contentStyle={{ background: "#08101b", border: "1px solid #24354f", color: "#fff" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Combined Graph • Pipeline vs Anticipated by Product">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={comboRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24354f" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={shortMoney} />
                    <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ background: "#08101b", border: "1px solid #24354f", color: "#fff" }} />
                    <Legend />
                    <Bar dataKey="pipeline" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="anticipated" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div style={styles.tableGrid}>
              <ReportTable title="Revenue by Team" rows={revenueByTeam} accent="#22c55e" />
              <ReportTable title="Revenue by Member" rows={revenueByMember} accent="#3b82f6" />
              <ReportTable title="Revenue by Product" rows={revenueByProduct} accent="#a855f7" />
            </div>

            <div style={styles.detailsCard}>
              <div style={styles.detailsHeaderRow}>
                <h3 style={styles.detailsTitle}>Lead Report Detail</h3>
                <span style={styles.detailsMeta}>{totals.lostCount} lost deals in this view</span>
              </div>

              <div style={styles.detailTableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Lead</th>
                      <th style={styles.th}>Team</th>
                      <th style={styles.th}>Member</th>
                      <th style={styles.th}>Product</th>
                      <th style={styles.th}>Revenue</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.slice(0, 100).map((lead) => (
                      <tr key={lead.id}>
                        <td style={styles.td}>{lead.name || lead.email || "Unnamed"}</td>
                        <td style={styles.td}>{lead.crmMeta?.team || "Unassigned"}</td>
                        <td style={styles.td}>{lead.crmMeta?.owner || "Unassigned"}</td>
                        <td style={styles.td}>{lead.crmMeta?.product || "Unassigned"}</td>
                        <td style={styles.td}>{formatMoney(lead.crmMeta?.dealValue)}</td>
                        <td style={styles.td}>{String(lead.crmMeta?.status || "open").toUpperCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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

function ChartCard({ title, children }) {
  return (
    <div style={styles.chartCard}>
      <div style={styles.chartTitle}>{title}</div>
      <div style={styles.chartWrap}>{children}</div>
    </div>
  );
}

function ReportTable({ title, rows, accent }) {
  return (
    <div style={styles.reportCard}>
      <div style={{ ...styles.reportTitle, color: accent }}>{title}</div>
      <div style={styles.reportRows}>
        {rows.length === 0 ? (
          <div style={styles.reportEmpty}>No report rows yet.</div>
        ) : (
          rows.slice(0, 8).map((row) => (
            <div key={row.label} style={styles.reportRow}>
              <div>
                <div style={styles.reportLabel}>{row.label}</div>
                <div style={styles.reportSub}>{row.deals} deals</div>
              </div>
              <div style={styles.reportValue}>{formatMoney(row.revenue)}</div>
            </div>
          ))
        )}
      </div>
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
    background: "linear-gradient(175deg, #3b82f6 0%, #1d4ed8 100%)",
    border: "1px solid #1e3a8a",
    boxShadow: "0 8px 28px rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  bannerTitle: { margin: 0, fontSize: 48, fontWeight: 600 },
  bannerSub: { margin: "6px 0 0", fontSize: 18, opacity: 0.92 },
  bannerMeta: { marginTop: 8, fontSize: 16, opacity: 0.88 },
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
  primaryBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#04120a",
    fontWeight: 600,
    cursor: "pointer",
  },
  container: {
    width: "100%",
    maxWidth: 1320,
    margin: "28px auto",
    padding: "0 20px 32px",
  },
  filtersCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { margin: 0, fontSize: 26, fontWeight: 600 },
  sectionSub: { margin: "6px 0 0", color: "#94a3b8", fontSize: 16 },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#08101b",
    color: "#fff",
    fontSize: 16,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 16,
  },
  statLabel: { color: "#94a3b8", fontSize: 16, fontWeight: 600, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 600 },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  chartCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 16,
    minHeight: 340,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 12,
    color: "#e2e8f0",
  },
  chartWrap: {
    width: "100%",
    height: 280,
  },
  winRateBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    marginBottom: 8,
    borderRadius: 10,
    background: "#08101b",
    border: "1px solid #24354f",
  },
  winRateLabel: {
    fontSize: 16,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  winRateValue: {
    fontSize: 28,
    fontWeight: 600,
    color: "#22c55e",
  },
  winRateSub: {
    marginTop: 4,
    fontSize: 16,
    color: "#cbd5e1",
  },
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  reportCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 16,
  },
  reportTitle: { fontSize: 18, fontWeight: 600, marginBottom: 12 },
  reportRows: { display: "grid", gap: 10 },
  reportRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#08101b",
  },
  reportLabel: { fontWeight: 600, fontSize: 16 },
  reportSub: { color: "#94a3b8", fontSize: 16, marginTop: 2 },
  reportValue: { fontWeight: 600, fontSize: 16 },
  reportEmpty: { color: "#94a3b8", fontSize: 16 },
  detailsCard: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 16,
  },
  detailsHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  detailsTitle: { margin: 0, fontSize: 20 },
  detailsMeta: { color: "#94a3b8", fontSize: 16 },
  detailTableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 16,
    color: "#94a3b8",
    borderBottom: "1px solid #24354f",
    padding: "10px 8px",
  },
  td: {
    fontSize: 16,
    padding: "10px 8px",
    borderBottom: "1px solid rgba(36,53,79,.55)",
    verticalAlign: "top",
  },
  emptyState: {
    background: "#0f1622",
    border: "1px solid #24354f",
    borderRadius: 14,
    padding: 20,
    color: "#94a3b8",
    fontSize: 16,
  },
};
