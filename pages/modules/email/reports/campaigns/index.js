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

const RANGE_TO_DAYS = {
  today: 0,
  d7: 7,
  d30: 30,
  d90: 90,
  all: null,
};

const PIE_COLOURS = [
  "#22c55e",
  "#3b82f6",
  "#facc15",
  "#ef4444",
  "#94a3b8",
];

function isoDaysAgo(days) {
  if (days === null) return null;
  const d = new Date();
  if (days === 0) d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function CampaignsReport() {
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState("all");
  const [chartType, setChartType] = useState("line");

  const fromIso = useMemo(
    () => isoDaysAgo(RANGE_TO_DAYS[range]),
    [range]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return setRows([]);

      let q = supabase
        .from("email_campaigns_sends")
        .select(`
          id,
          campaign_id,
          status,
          created_at
        `)
        .eq("user_id", userId)
        .not("campaign_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(5000);

      if (fromIso) q = q.gte("created_at", fromIso);

      const { data } = await q;
      if (mounted) setRows(data || []);
    })();

    return () => {
      mounted = false;
    };
  }, [fromIso]);

  // ================= METRICS =================

  const metrics = useMemo(() => {
    const sent = rows.length;
    const delivered = rows.filter((r) => r.status === "sent").length;

    // opens / clicks not implemented yet
    const opened = 0;
    const clicked = 0;
    const unsub = 0;

    return { sent, delivered, opened, clicked, unsub };
  }, [rows]);

  // ================= CHART =================

  const chartData = useMemo(() => {
    const map = {};

    rows.forEach((r) => {
      const d = r.created_at.slice(0, 10);
      if (!map[d]) {
        map[d] = {
          date: d,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          unsub: 0,
        };
      }
      map[d].sent += 1;
      if (r.status === "sent") map[d].delivered += 1;
    });

    return Object.values(map).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [rows]);

  const pieData = [
    { name: "Delivered", value: metrics.delivered },
    { name: "Opened", value: metrics.opened },
    { name: "Clicked", value: metrics.clicked },
    { name: "Unsubscribed", value: metrics.unsub },
    {
      name: "Other",
      value:
        metrics.sent -
        metrics.delivered -
        metrics.opened -
        metrics.clicked -
        metrics.unsub,
    },
  ];

  return (
    <>
      <Head>
        <title>Campaigns report</title>
      </Head>

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.banner}>
            <div style={styles.bannerLeft}>
              <div style={styles.bannerIconWrap}>
                <span style={styles.bannerIcon}>📣</span>
              </div>
              <div>
                <div style={styles.bannerTitle}>Campaigns</div>
                <div style={styles.bannerSub}>
                  Delivery, opens, clicks & unsubscribes
                </div>
              </div>
            </div>
            <Link
              href="/modules/email/reports"
              style={styles.backBtn}
            >
              ← Back
            </Link>
          </div>

          <div style={styles.rangeRow}>
            {["today", "d7", "d30", "d90", "all"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  ...styles.rangeBtn,
                  ...(range === r ? styles.rangeActive : {}),
                }}
              >
                {r === "today"
                  ? "Today"
                  : r === "d7"
                  ? "Last 7 days"
                  : r === "d30"
                  ? "Last 30 days"
                  : r === "d90"
                  ? "Last 90 days"
                  : "All time"}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() =>
                setChartType(
                  chartType === "line" ? "pie" : "line"
                )
              }
              style={styles.toggleBtn}
            >
              {chartType === "line"
                ? "View pie chart"
                : "View line chart"}
            </button>
          </div>

          <div style={styles.metricsRow}>
            <Metric label="Sent" value={metrics.sent} />
            <Metric label="Delivered" value={metrics.delivered} />
            <Metric label="Opened" value={metrics.opened} />
            <Metric label="Clicked" value={metrics.clicked} />
            <Metric label="Unsubscribed" value={metrics.unsub} />
          </div>

          <div style={styles.chartWrap}>
            <div style={styles.chartTitle}>
              Campaigns performance
            </div>

            {chartType === "line" ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    dataKey="sent"
                    stroke="#94a3b8"
                    strokeWidth={2}
                  />
                  <Line
                    dataKey="delivered"
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLOURS[i]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(15,23,42,0.9), rgba(2,6,23,1))",
    padding: 20,
    color: "#e6eef8",
  },
  container: { maxWidth: 1320, margin: "0 auto" },
  banner: {
    background: "#14b8a6",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  bannerIconWrap: {
    width: 69,
    height: 69,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "rgba(0,0,0,0.18)",
  },
  bannerIcon: { fontSize: 48 },
  bannerTitle: {
    fontSize: 48,
    fontWeight: 550,
    color: "#fff",
  },
  bannerSub: {
    fontSize: 18,
    color: "#fff",
    opacity: 0.9,
  },
  backBtn: {
    background: "#052b1b",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 999,
    textDecoration: "none",
  },
  rangeRow: {
    marginTop: 12,
    display: "flex",
    gap: 8,
  },
  rangeBtn: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.6)",
    color: "#fff",
  },
  rangeActive: {
    background: "rgba(34,197,94,0.25)",
    border: "1px solid rgba(34,197,94,0.7)",
  },
  toggleBtn: {
    padding: "6px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
  },
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5,1fr)",
    gap: 10,
    marginTop: 14,
  },
  metricBox: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  metricLabel: { opacity: 0.85 },
  metricValue: {
    fontSize: 20,
    fontWeight: 600,
  },
  chartWrap: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },
};
