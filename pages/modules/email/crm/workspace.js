// Comprehensive workspace analytics — SMS + Email combined metrics, charts & insights

import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../utils/supabase-client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
const COLORS = {
  email: "#facc15",
  sms: "#38bdf8",
  delivered: "#22c55e",
  opened: "#3b82f6",
  clicked: "#0ea5e9",
  failed: "#ef4444",
  queued: "#94a3b8",
};

/* =========================
   DATE HELPERS
========================= */
function isoDaysAgo(days) {
  if (days === null) return null;
  const d = new Date();
  if (days === 0) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toDateKey(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* =========================
   DATA FETCHING
========================= */
async function fetchEmailStats(userId, fromIso) {
  let q = supabase
    .from("email_sends")
    .select("id,status,last_event,open_count,click_count,unsubscribed,bounced_at,created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fromIso) q = q.gte("created_at", fromIso);

  const { data, error, count } = await q.limit(5000);
  
  if (error) {
    console.error("Email fetch error:", error);
    return [];
  }
  
  console.log("Fetched emails:", count, "rows");
  return data || [];
}

async function fetchSmsStats(userId, fromIso) {
  try {
    // Fetch from sms_queue (pending/queued messages)
    let qQueue = supabase
      .from("sms_queue")
      .select("id,status,created_at,sent_at,provider_message_id,last_error", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fromIso) qQueue = qQueue.gte("created_at", fromIso);

    const { data: queueData, error: queueError, count: queueCount } = await qQueue.limit(5000);

    if (queueError) {
      console.error("SMS queue fetch error:", queueError);
    }

    let historyData = [];
    let historyCount = 0;

    // Try to fetch from sms_sent_history (only if table exists)
    try {
      let qHistory = supabase
        .from("sms_sent_history")
        .select("id,status,created_at,sent_at,provider_message_id,last_error", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fromIso) qHistory = qHistory.gte("created_at", fromIso);

      const { data: hData, error: historyError, count: hCount } = await qHistory.limit(5000);

      if (historyError) {
        console.warn("SMS history table not available yet:", historyError.message);
      } else {
        historyData = hData || [];
        historyCount = hCount || 0;
      }
    } catch (e) {
      console.warn("SMS history query skipped:", e.message);
    }

    console.log(
      `Fetched SMS: ${queueCount || 0} queued + ${historyCount} history = ${(queueCount || 0) + historyCount} total rows`
    );

    return {
      queueRows: queueData || [],
      historyRows: historyData || [],
    };
  } catch (err) {
    console.error("SMS stats error:", err);
    return { queueRows: [], historyRows: [] };
  }
}

/* =========================
   METRICS CALCULATION
========================= */
function classifyEmailStatus(r) {
  const st = String(r.status || "").toLowerCase();
  const le = String(r.last_event || "").toLowerCase();
  if (["delivered", "opened", "clicked"].includes(st)) return "delivered";
  if (le === "delivered" || le === "open" || le === "click") return "delivered";
  if (r.bounced_at || le === "bounce" || le === "dropped") return "bounced";
  if (r.unsubscribed || le === "unsubscribe") return "unsubscribed";
  return "sent";
}

function classifySmsStatus(r) {
  const st = String(r.status || "").toLowerCase();
  const hasSent = !!r.sent_at || !!r.provider_message_id;
  if (st === "failed" || r.last_error) return "failed";
  if (st === "sent" || st === "delivered" || hasSent) return "sent";
  if (["queued", "pending"].includes(st)) return "queued";
  return "other";
}

function classifySmsQueueStatus(r) {
  const st = String(r.status || "").toLowerCase();
  if (st === "failed" || r.last_error) return "failed";
  return "queued";
}

/* ========================= PAGE COMPONENT
========================= */
export default function WorkspaceAnalytics() {
  const [range, setRange] = useState("d30");
  const [chartMode, setChartMode] = useState("line");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const [emailRows, setEmailRows] = useState([]);
  const [smsHistoryRows, setSmsHistoryRows] = useState([]);
  const [smsQueueRows, setSmsQueueRows] = useState([]);

  const fromIso = useMemo(() => isoDaysAgo(RANGE_TO_DAYS[range]), [range]);

  const loadData = useCallback(
    async (uid, isMounted = () => true) => {
      if (!uid) return;

      console.log("Workspace: fetching for user", uid, "from", fromIso);

      const [emails, sms] = await Promise.all([
        fetchEmailStats(uid, fromIso),
        fetchSmsStats(uid, fromIso),
      ]);

      if (!isMounted()) return;

      console.log("Workspace data loaded:", {
        emails: emails.length,
        smsHistory: sms?.historyRows?.length || 0,
        smsQueue: sms?.queueRows?.length || 0,
      });
      setEmailRows(emails);
      setSmsHistoryRows(sms?.historyRows || []);
      setSmsQueueRows(sms?.queueRows || []);
    },
    [fromIso]
  );

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
          setEmailRows([]);
          setSmsHistoryRows([]);
          setSmsQueueRows([]);
          setLoading(false);
          return;
        }

        await loadData(uid, () => mounted);

        if (!mounted) return;
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        console.error("Workspace error:", e);
        setErr(String(e?.message || e));
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [fromIso, loadData]);

  const importSmsHistory = async () => {
    if (!userId) return;
    setImportBusy(true);
    setImportMsg("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) throw new Error("Missing session token");

      const res = await fetch("/api/smsglobal/import-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || `HTTP ${res.status}`);
      }

      setImportMsg(
        `Imported ${j.inserted} new SMS (fetched ${j.totalFetched}, skipped ${j.skippedExisting} existing)`
      );
      setLoading(true);
      await loadData(userId, () => true);
      setLoading(false);
    } catch (e) {
      setImportMsg(`Import failed: ${e?.message || e}`);
    } finally {
      setImportBusy(false);
    }
  };

  /* =========================
     EMAIL METRICS
  ========================= */
  const emailMetrics = useMemo(() => {
    const total = emailRows.length;
    let delivered = 0;
    let opened = 0;
    let clicked = 0;
    let bounced = 0;
    let unsub = 0;

    emailRows.forEach((r) => {
      const status = classifyEmailStatus(r);
      if (["delivered", "sent"].includes(status)) delivered++;
      if ((r.open_count || 0) > 0) opened++;
      if ((r.click_count || 0) > 0) clicked++;
      if (status === "bounced") bounced++;
      if (status === "unsubscribed") unsub++;
    });

    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    return {
      total,
      delivered,
      opened: pct(opened),
      clicked: pct(clicked),
      bounced: pct(bounced),
      unsub: pct(unsub),
    };
  }, [emailRows]);

  /* =========================
     SMS METRICS
  ========================= */
  const smsMetrics = useMemo(() => {
    const total = smsHistoryRows.length;
    let sent = 0;
    let failed = 0;

    smsHistoryRows.forEach((r) => {
      const status = classifySmsStatus(r);
      if (status === "sent") sent++;
      else if (status === "failed") failed++;
    });

    const queued = smsQueueRows.filter((r) => classifySmsQueueStatus(r) === "queued").length;
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    return { total, sent, failed, queued, delivery_rate: pct(sent) };
  }, [smsHistoryRows, smsQueueRows]);

  /* =========================
     COMBINED CHART DATA
  ========================= */
  const combinedChartData = useMemo(() => {
    const map = {};

    emailRows.forEach((r) => {
      const key = toDateKey(r.created_at);
      if (!key) return;
      if (!map[key]) map[key] = { date: key, email_sent: 0, email_opened: 0, email_clicked: 0 };
      map[key].email_sent++;
      if ((r.open_count || 0) > 0) map[key].email_opened++;
      if ((r.click_count || 0) > 0) map[key].email_clicked++;
    });

    smsHistoryRows.forEach((r) => {
      const key = toDateKey(r.sent_at || r.created_at);
      if (!key) return;
      if (!map[key]) map[key] = { date: key, sms_sent: 0, sms_failed: 0 };
      const status = classifySmsStatus(r);
      if (status === "sent") map[key].sms_sent = (map[key].sms_sent || 0) + 1;
      else if (status === "failed") map[key].sms_failed = (map[key].sms_failed || 0) + 1;
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [emailRows, smsHistoryRows]);

  /* =========================
     PIE DATA
  ========================= */
  const emailPieData = useMemo(
    () => [
      { name: "Delivered", value: emailMetrics.delivered },
      { name: "Opened", value: emailMetrics.opened },
      { name: "Clicked", value: emailMetrics.clicked },
      { name: "Bounced", value: emailMetrics.bounced },
      { name: "Unsubscribed", value: emailMetrics.unsub },
    ].filter((x) => x.value > 0),
    [emailMetrics]
  );

  const smsPieData = useMemo(
    () => [
      { name: "Sent", value: smsMetrics.sent },
      { name: "Failed", value: smsMetrics.failed },
      { name: "Queued", value: smsMetrics.queued },
    ].filter((x) => x.value > 0),
    [smsMetrics]
  );

  const pieColors = ["#22c55e", "#3b82f6", "#facc15", "#ef4444", "#a855f7"];

  /* =========================
     SUMMARY CARDS
  ========================= */
  const SummaryCard = ({ label, value, icon, color }) => (
    <div style={{ ...styles.summaryCard, borderTop: `4px solid ${color}` }}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={{ ...styles.summaryValue, color }}>{value}</div>
      <div style={styles.summaryIcon}>{icon}</div>
    </div>
  );

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <Head>
        <title>Workspace Analytics</title>
      </Head>

      <div style={styles.page}>
        <div style={styles.container}>
          {/* Banner */}
          <div style={styles.banner}>
            <div style={styles.bannerLeft}>
              <div style={styles.bannerIconWrap}>
                <span style={styles.bannerIcon}>📊</span>
              </div>
              <div>
                <h1 style={styles.bannerTitle}>Workspace Analytics</h1>
                <p style={styles.bannerSub}>Email & SMS performance dashboard</p>
              </div>
            </div>
            <Link href="/modules/email/crm" style={styles.backBtn}>
              ← Back
            </Link>
          </div>

          {/* Range Selector */}
          <div style={styles.controls}>
            {["today", "d7", "d30", "d90", "all"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  ...styles.rangeBtn,
                  ...(range === r ? styles.rangeBtnActive : {}),
                }}
              >
                {r === "today"
                  ? "Today"
                  : r === "d7"
                  ? "7 days"
                  : r === "d30"
                  ? "30 days"
                  : r === "d90"
                  ? "90 days"
                  : "All time"}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={importSmsHistory}
              disabled={importBusy || !userId}
              style={{
                ...styles.importBtn,
                opacity: importBusy || !userId ? 0.6 : 1,
                cursor: importBusy || !userId ? "not-allowed" : "pointer",
              }}
            >
              {importBusy ? "⏳ Importing SMS..." : "⬇ Import SMS history"}
            </button>
            <button
              onClick={() => setChartMode(chartMode === "line" ? "bar" : "line")}
              style={styles.toggleBtn}>
              {chartMode === "line" ? "📊 Bar chart" : "📈 Line chart"}
            </button>
          </div>

          {importMsg && <div style={styles.importNote}>{importMsg}</div>}

          {loading && <div style={styles.loading}>Loading analytics...</div>}
          {!loading && err && <div style={styles.error}>{err}</div>}

          {!loading &&
            !err &&
            emailRows.length === 0 &&
            smsHistoryRows.length === 0 &&
            smsQueueRows.length === 0 && (
            <div style={styles.error}>
              No data found for the selected period. Make sure you have sent emails or SMS campaigns.
              <br />
              <small style={{ opacity: 0.7 }}>
                Debug: Range={range}, FromISO={fromIso || "null"}, EmailRows={emailRows.length}, SmsHistory={smsHistoryRows.length}, SmsQueue={smsQueueRows.length}
              </small>
            </div>
          )}

          {!loading && !err && (
            <>
              {/* Summary Grid */}
              <div style={styles.summaryGrid}>
                <SummaryCard
                  label="Emails Sent"
                  value={emailMetrics.total.toLocaleString()}
                  icon="📧"
                  color={COLORS.email}
                />
                <SummaryCard
                  label="Email Delivery Rate"
                  value={`${Math.round((emailMetrics.delivered / emailMetrics.total) * 100) || 0}%`}
                  icon="✅"
                  color={COLORS.delivered}
                />
                <SummaryCard
                  label="Email Open Rate"
                  value={`${emailMetrics.opened}%`}
                  icon="👁️"
                  color={COLORS.opened}
                />
                <SummaryCard
                  label="Email Click Rate"
                  value={`${emailMetrics.clicked}%`}
                  icon="🔗"
                  color={COLORS.clicked}
                />

                <SummaryCard
                  label="SMS Sent"
                  value={smsMetrics.sent.toLocaleString()}
                  icon="💬"
                  color={COLORS.sms}
                />
                <SummaryCard
                  label="SMS Delivery Rate"
                  value={`${smsMetrics.delivery_rate}%`}
                  icon="✅"
                  color={COLORS.delivered}
                />
                <SummaryCard
                  label="SMS Failed"
                  value={smsMetrics.failed}
                  icon="❌"
                  color={COLORS.failed}
                />
                <SummaryCard
                  label="SMS Queued"
                  value={smsMetrics.queued}
                  icon="⏳"
                  color={COLORS.queued}
                />
              </div>

              {/* Combined Chart */}
              <div style={styles.chartSection}>
                <h2 style={styles.chartTitle}>Combined Activity</h2>
                {chartMode === "line" ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={combinedChartData}>
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="email_sent"
                        stroke={COLORS.email}
                        dot={false}
                        strokeWidth={2}
                        name="Emails"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="sms_sent"
                        stroke={COLORS.sms}
                        dot={false}
                        strokeWidth={2}
                        name="SMS"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={combinedChartData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="email_sent" fill={COLORS.email} name="Emails" />
                      <Bar dataKey="sms_sent" fill={COLORS.sms} name="SMS" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Email & SMS Section */}
              <div style={styles.twoColumn}>
                {/* Email Analytics */}
                <div style={styles.chartSection}>
                  <h2 style={styles.chartTitle}>Email Performance</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={emailPieData} dataKey="value" outerRadius={100}>
                        {emailPieData.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={styles.stats}>
                    <div style={styles.stat}>
                      <span>Bounce Rate:</span>
                      <strong>
                        {emailMetrics.total
                          ? Math.round((emailMetrics.bounced / emailMetrics.total) * 100)
                          : 0}
                        %
                      </strong>
                    </div>
                    <div style={styles.stat}>
                      <span>Unsubscribe Rate:</span>
                      <strong>
                        {emailMetrics.total
                          ? Math.round((emailMetrics.unsub / emailMetrics.total) * 100)
                          : 0}
                        %
                      </strong>
                    </div>
                  </div>
                </div>

                {/* SMS Analytics */}
                <div style={styles.chartSection}>
                  <h2 style={styles.chartTitle}>SMS Performance</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={smsPieData} dataKey="value" outerRadius={100}>
                        {smsPieData.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={styles.stats}>
                    <div style={styles.stat}>
                      <span>Total (history):</span>
                      <strong>{smsMetrics.total.toLocaleString()}</strong>
                    </div>
                    <div style={styles.stat}>
                      <span>Error Rate:</span>
                      <strong>
                        {smsMetrics.total
                          ? Math.round((smsMetrics.failed / smsMetrics.total) * 100)
                          : 0}
                        %
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={styles.actions}>
                <Link href="/modules/email/reports" style={styles.actionBtn}>
                  📧 Email Reports
                </Link>
                <Link href="/modules/email/reports/sms" style={styles.actionBtn}>
                  💬 SMS Reports
                </Link>
                <Link href="/modules/email/crm/sms-marketing" style={styles.actionBtn}>
                  🚀 Send Campaign
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* =========================
   STYLES
========================= */
const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(15,23,42,0.9), rgba(2,6,23,1))",
    padding: "30px 20px 60px",
    color: "#e6eef8",
  },
  container: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background:  "#a855f7",
    borderRadius: 18,
    padding: "20px 24px",
    marginBottom: 20,
    boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  bannerIconWrap: {
    width: 70,
    height: 70,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "rgba(0,0,0,0.2)",
    fontSize: 40,
  },
  bannerIcon: {
    fontSize: 40,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 40,
    fontWeight: 700,
    color: "#fff",
  },
  bannerSub: {
    margin: "4px 0 0 0",
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    opacity: 0.95,
  },
  backBtn: {
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 999,
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.2)",
  },
  controls: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  rangeBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e6eef8",
    padding: "8px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  rangeBtnActive: {
    background: "#10b981",
    border: "1px solid #10b981",
    color: "#fff",
  },
  importBtn: {
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(34,197,94,0.55)",
    color: "#22c55e",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  toggleBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#e6eef8",
    padding: "8px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  importNote: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "#e2e8f0",
    fontSize: 14,
  },
  loading: {
    textAlign: "center",
    padding: "40px 20px",
    fontSize: 18,
    opacity: 0.7,
  },
  error: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#fca5a5",
    padding: "16px",
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 28,
  },
  summaryCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.75,
    marginBottom: 6,
    fontWeight: 600,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
  },
  summaryIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  chartSection: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  chartTitle: {
    margin: "0 0 16px 0",
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: 20,
    marginBottom: 28,
  },
  stats: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  stat: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  actions: {
    display: "flex",
    gap: 12,
    marginTop: 28,
    flexWrap: "wrap",
  },
  actionBtn: {
    background: "#10b981",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 10,
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
