import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../utils/supabase-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const RANGE_TO_DAYS = { today: 0, d7: 7, d30: 30, d90: 90, all: null };
const PIE_COLORS = ["#22c55e", "#3b82f6", "#facc15", "#ef4444", "#94a3b8"];

function isoDaysAgo(days) {
  if (days === null || days === undefined) return null;
  const d = new Date();
  if (days === 0) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function classifyStatus(row) {
  const st = String(row?.status || "").toLowerCase();
  const source = row?.source || "history";
  const hasSent = !!row?.sent_at || !!row?.provider_message_id || !!row?.provider_id;

  if (source === "queue") {
    if (st === "failed" || row?.last_error || row?.error) return "failed";
    return "queued";
  }

  if (st === "failed" || row?.last_error || row?.error) return "failed";
  if (st === "sent" || st === "delivered" || hasSent) return "sent";
  return "other";
}

function toDateKey(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default function SmsReports() {
  const [range, setRange] = useState("all");
  const [chartMode, setChartMode] = useState("line");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [queueRows, setQueueRows] = useState([]);

  const fromIso = useMemo(() => isoDaysAgo(RANGE_TO_DAYS[range]), [range]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!mounted) return;
        setUserId(uid);

        if (!uid) {
          setHistoryRows([]);
          setQueueRows([]);
          setLoading(false);
          return;
        }

        let qHistory = supabase
          .from("sms_sent_history")
          .select(
            "id,user_id,to_phone,body,status,created_at,sent_at,provider_message_id,last_error"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .limit(10000);

        let qQueue = supabase
          .from("sms_queue")
          .select(
            "id,user_id,lead_id,to_phone,body,status,created_at,scheduled_for,available_at,sent_at,provider_message_id,provider_id,last_error,error"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .limit(10000);

        if (fromIso) {
          qHistory = qHistory.gte("created_at", fromIso);
          qQueue = qQueue.gte("created_at", fromIso);
        }

        const [historyRes, queueRes] = await Promise.all([qHistory, qQueue]);
        if (historyRes.error) throw historyRes.error;
        if (queueRes.error) throw queueRes.error;
        if (!mounted) return;
        setHistoryRows(historyRes.data || []);
        setQueueRows(queueRes.data || []);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [fromIso]);

  const metrics = useMemo(() => {
    const total = historyRows.length;
    let sent = 0;
    let failed = 0;
    let other = 0;

    for (const r of historyRows) {
      const s = classifyStatus({ ...r, source: "history" });
      if (s === "sent") sent += 1;
      else if (s === "failed") failed += 1;
      else other += 1;
    }

    let queued = 0;
    for (const r of queueRows) {
      const s = classifyStatus({ ...r, source: "queue" });
      if (s === "queued") queued += 1;
    }

    return { total, sent, failed, queued, other };
  }, [historyRows, queueRows]);

  const chartData = useMemo(() => {
    const map = {};

    for (const r of historyRows) {
      const key = toDateKey(r.sent_at || r.created_at);
      if (!key) continue;
      if (!map[key]) map[key] = { date: key, sent: 0, failed: 0, queued: 0 };
      const s = classifyStatus({ ...r, source: "history" });
      if (s === "sent") map[key].sent += 1;
      else if (s === "failed") map[key].failed += 1;
    }

    for (const r of queueRows) {
      const key = toDateKey(r.created_at || r.scheduled_for || r.available_at);
      if (!key) continue;
      if (!map[key]) map[key] = { date: key, sent: 0, failed: 0, queued: 0 };
      const s = classifyStatus({ ...r, source: "queue" });
      if (s === "queued") map[key].queued += 1;
      else if (s === "failed") map[key].failed += 1;
    }

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [historyRows, queueRows]);

  const pieData = useMemo(
    () => [
      { name: "Sent", value: metrics.sent },
      { name: "Queued", value: metrics.queued },
      { name: "Failed", value: metrics.failed },
      { name: "Other", value: metrics.other },
    ].filter((x) => x.value > 0),
    [metrics]
  );

  const recent = useMemo(() => {
    const combined = [
      ...historyRows.map((r) => ({ ...r, source: "history" })),
      ...queueRows.map((r) => ({ ...r, source: "queue" })),
    ];

    return combined
      .sort((a, b) => {
        const aTime = new Date(a.sent_at || a.created_at || a.scheduled_for || a.available_at || 0).getTime();
        const bTime = new Date(b.sent_at || b.created_at || b.scheduled_for || b.available_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 100);
  }, [historyRows, queueRows]);

  return (
    <>
      <Head>
        <title>SMS analytics</title>
      </Head>

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ ...styles.banner, background: "#14b8a6" }}>
            <div style={styles.bannerLeft}>
              <div style={styles.bannerIconWrap} aria-hidden="true">
                <span style={styles.bannerIcon}>💬</span>
              </div>
              <div>
                <div style={styles.bannerTitle}>SMS analytics</div>
                <div style={styles.bannerSub}>Delivery, queues, failures and recent SMS activity.</div>
              </div>
            </div>
            <Link href="/modules/email/reports" style={styles.backBtn}>
              ← Back
            </Link>
          </div>

          <div style={styles.rangeRow}>
            <div style={styles.rangeLabel}>Time period:</div>
            <RangePill label="Today" active={range === "today"} onClick={() => setRange("today")} />
            <RangePill label="Last 7 days" active={range === "d7"} onClick={() => setRange("d7")} />
            <RangePill label="Last 30 days" active={range === "d30"} onClick={() => setRange("d30")} />
            <RangePill label="Last 90 days" active={range === "d90"} onClick={() => setRange("d90")} />
            <RangePill label="All time" active={range === "all"} onClick={() => setRange("all")} />
            <div style={{ flex: 1 }} />
            <button style={styles.toggleBtn} onClick={() => setChartMode(chartMode === "line" ? "pie" : "line")}>
              {chartMode === "line" ? "View pie chart" : "View line graph"}
            </button>
          </div>

          {loading ? <div style={styles.note}>Loading…</div> : null}
          {!loading && !userId ? <div style={styles.note}>You must be logged in to view analytics.</div> : null}
          {!loading && err ? <div style={{ ...styles.note, border: "1px solid #ef4444" }}>{err}</div> : null}

          {!loading && userId && !err ? (
            <>
              <div style={styles.metricsGrid}>
                <Metric title="Total (history)" value={metrics.total} />
                <Metric title="Sent" value={metrics.sent} />
                <Metric title="Queued" value={metrics.queued} />
                <Metric title="Failed" value={metrics.failed} />
                <Metric title="Other" value={metrics.other} />
              </div>

              <div style={styles.chartWrap}>
                {chartMode === "line" ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line dataKey="sent" stroke="#22c55e" strokeWidth={2} />
                      <Line dataKey="queued" stroke="#facc15" strokeWidth={2} />
                      <Line dataKey="failed" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={120}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableHeadRow}>
                  <div style={styles.th}>When</div>
                  <div style={styles.th}>To</div>
                  <div style={styles.th}>Message</div>
                  <div style={styles.th}>Status</div>
                  <div style={styles.th}>Source</div>
                  <div style={styles.th}>Error</div>
                </div>

                {recent.length === 0 ? (
                  <div style={styles.tableEmpty}>No SMS rows found for this period.</div>
                ) : (
                  recent.map((r) => (
                    <div key={`${r.source}-${r.id}`} style={styles.tr}>
                      <div style={styles.td}>
                        {r.sent_at || r.created_at
                          ? new Date(r.sent_at || r.created_at).toLocaleString()
                          : "—"}
                      </div>
                      <div style={styles.td}>{r.to_phone || "—"}</div>
                      <div style={styles.td}>{r.body || "—"}</div>
                      <div style={styles.td}>{classifyStatus(r)}</div>
                      <div style={styles.td}>{r.source === "history" ? "History" : "Queue"}</div>
                      <div style={styles.td}>{r.last_error || r.error || "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function RangePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.rangePill, ...(active ? styles.rangePillActive : null) }}>
      {label}
    </button>
  );
}

function Metric({ title, value }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(15,23,42,0.9) 0%, rgba(2,6,23,1) 55%, rgba(2,6,23,1) 100%)",
    padding: "30px 20px 40px",
    color: "#e6eef8",
    fontSize: 18,
  },
  container: { maxWidth: 1320, margin: "0 auto" },

  banner: {
    width: "100%",
    borderRadius: 18,
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  bannerLeft: { display: "flex", alignItems: "center", gap: 14 },
  bannerIconWrap: { width: 69, height: 69, display: "grid", placeItems: "center", borderRadius: 10, background: "rgba(0,0,0,0.18)" },
  bannerIcon: { fontSize: 48, lineHeight: 1 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#052b1b", lineHeight: 1.05 },
  bannerSub: { fontSize: 18, marginTop: 3, color: "rgba(5,43,27,0.90)" },

  backBtn: {
    background: "rgba(2,6,23,0.75)",
    color: "#e6eef8",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 16,
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 600,
  },

  rangeRow: { marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rangeLabel: { fontSize: 18, opacity: 0.9 },
  rangePill: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(2,6,23,0.55)",
    color: "#e6eef8",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 600,
  },
  rangePillActive: { background: "rgba(20,184,166,0.18)", border: "1px solid rgba(20,184,166,0.55)" },

  toggleBtn: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(2,6,23,0.75)",
    color: "#e6eef8",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 16,
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  note: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 16,
    opacity: 0.95,
  },

  metricsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 },
  metricBox: { padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" },
  metricTitle: { fontSize: 16, opacity: 0.85, fontWeight: 600 },
  metricValue: { fontSize: 16, fontWeight: 600, marginTop: 6 },

  chartWrap: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  tableWrap: { marginTop: 14, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" },
  tableHeadRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 2fr .8fr .8fr 1.4fr",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
  },
  th: { fontSize: 16, fontWeight: 600, opacity: 0.9 },
  tr: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 2fr .8fr .8fr 1.4fr",
    padding: "10px 12px",
    background: "rgba(2,6,23,0.45)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  td: { fontSize: 16, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tableEmpty: { padding: 12, fontSize: 16, opacity: 0.85, background: "rgba(2,6,23,0.45)" },
};
