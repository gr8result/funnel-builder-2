// ============================================
// /pages/modules/email/reports/broadcasts/index.js
// ============================================
// FULL DROP-IN REPLACEMENT
// UI / LAYOUT / STYLES: UNCHANGED
// DATA LOGIC: FIXED (REAL DATA ONLY, UTC SAFE)
// ============================================

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../utils/supabase-client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const RANGE_TO_DAYS = { today: 0, d7: 7, d30: 30, d90: 90, all: null };
const PIE_COLORS = ["#22c55e", "#3b82f6", "#facc15", "#ef4444", "#a855f7", "#94a3b8"];

/* =========================
   DATE HELPERS (UTC SAFE)
========================= */
function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function isoDaysAgoUTC(days) {
  if (days === null) return null;
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}
function ymdUTC(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function addDaysUTC(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/* =========================
   STATUS NORMALISATION
========================= */
function normalizeStatus(r) {
  const st = String(r.status || "").toLowerCase();
  const le = String(r.last_event || "").toLowerCase();
  if (["delivered", "opened", "clicked", "bounced", "unsubscribe"].includes(st)) return st;
  if (le === "delivered") return "delivered";
  if (le === "open") return "opened";
  if (le === "click") return "clicked";
  if (le === "bounce") return "bounced";
  if (le === "unsubscribe") return "unsubscribe";
  return "sent";
}

/* =========================
   PAGINATED FETCH
========================= */
async function fetchAllSends(uid, fromIso) {
  const PAGE = 1000;
  let out = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from("email_sends")
      .select(`
        id,
        email,
        status,
        last_event,
        open_count,
        click_count,
        unsubscribed,
        bounced_at,
        created_at,
        last_event_at,
        broadcast_id,
        sent_at,
        delivered_at,
        opened_at,
        clicked_at,
        ab_enabled,
        ab_variant
      `)
      .eq("user_id", uid)
      .not("broadcast_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (fromIso) q = q.gte("created_at", fromIso);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    out = out.concat(data);
    from += PAGE;
  }

  return out;
}

/* =========================
   PAGE
========================= */
export default function BroadcastsReport() {
  const [range, setRange] = useState("today");
  const [chartMode, setChartMode] = useState("line");
  const [rows, setRows] = useState([]);
  const [nameMap, setNameMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const fromIso = useMemo(
    () => isoDaysAgoUTC(RANGE_TO_DAYS[range]),
    [range]
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!alive) return;

        if (!uid) {
          setRows([]);
          setNameMap({});
          setLoading(false);
          return;
        }

        const raw = await fetchAllSends(uid, fromIso);
        if (!alive) return;

        const cleaned = raw.map((r) => ({
          ...r,
          status: normalizeStatus(r),
        }));

        setRows(cleaned);

        const ids = Array.from(
          new Set(cleaned.map((r) => r.broadcast_id).filter(Boolean))
        );

        if (ids.length) {
          const { data: bcasts } = await supabase
            .from("email_broadcasts")
            .select("id,name,title,subject")
            .in("id", ids);

          const m = {};
          (bcasts || []).forEach((b) => {
            m[b.id] = b.name || b.title || b.subject || "Broadcast";
          });
          setNameMap(m);
        } else {
          setNameMap({});
        }

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setErr(String(e.message || e));
        setLoading(false);
      }
    }

    run();
    return () => (alive = false);
  }, [fromIso]);

  /* =========================
     METRICS
  ========================= */
  const metrics = useMemo(() => {
    const sent = rows.length;
    const delivered = rows.filter((r) => !!r.delivered_at).length;
    const opened = rows.filter((r) => !!r.opened_at).length;
    const clicked = rows.filter((r) => !!r.clicked_at).length;
    const bounced = rows.filter((r) => r.status === "bounced").length;
    const unsub = rows.filter((r) => r.unsubscribed).length;
    return { sent, delivered, opened, clicked, bounced, unsub };
  }, [rows]);

  /* =========================
     CHART DATA
  ========================= */
  const chartData = useMemo(() => {
    if (!rows.length) return [];

    let start;
    if (range === "all") {
      const min = new Date(
        Math.min(...rows.map((r) => new Date(r.sent_at || r.created_at).getTime()))
      );
      start = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate()));
    } else {
      start = startOfTodayUTC();
      start.setUTCDate(start.getUTCDate() - RANGE_TO_DAYS[range]);
    }

    const end = startOfTodayUTC();
    const map = {};
    let cur = new Date(start);

    while (cur <= end) {
      const k = ymdUTC(cur);
      map[k] = {
        date: k,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsub: 0,
      };
      cur = addDaysUTC(cur, 1);
    }

    rows.forEach((r) => {
      const k = ymdUTC(r.sent_at || r.created_at);
      if (!map[k]) return;
      map[k].sent++;
      if (r.delivered_at) map[k].delivered++;
      if (r.opened_at) map[k].opened++;
      if (r.clicked_at) map[k].clicked++;
      if (r.status === "bounced") map[k].bounced++;
      if (r.unsubscribed) map[k].unsub++;
    });

    return Object.values(map);
  }, [rows, range]);

  /* =========================
     PIE DATA
  ========================= */
  const pieData = [
    { name: "Delivered", value: metrics.delivered },
    { name: "Opened", value: metrics.opened },
    { name: "Clicked", value: metrics.clicked },
    { name: "Bounced", value: metrics.bounced },
    { name: "Unsubscribed", value: metrics.unsub },
  ].filter((x) => x.value > 0);

  const recent = useMemo(
    () =>
      [...rows]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 250),
    [rows]
  );

  /* =========================
     RENDER (UNCHANGED UI)
  ========================= */

  return (
    <>
      <Head><title>Broadcast analytics</title></Head>
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ ...styles.banner, background: "#f59e0b" }}>
            <div style={styles.bannerLeft}>
              <div style={styles.bannerIconWrap}><span style={styles.bannerIcon}>📢</span></div>
              <div>
                <div style={styles.bannerTitle}>Broadcasts</div>
                <div style={styles.bannerSub}>Delivery, opens, clicks & unsubscribes</div>
              </div>
            </div>
            <Link href="/modules/email/reports" style={styles.backBtn}>← Back</Link>
          </div>

          <div style={styles.rangeRow}>
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

          {loading && <div style={styles.note}>Loading…</div>}
          {!loading && err && <div style={{ ...styles.note, border: "1px solid #ef4444" }}>{err}</div>}

          {!loading && !err && (
            <>
              <div style={styles.metricsGrid}>
                <Metric title="Sent" value={metrics.sent} />
                <Metric title="Delivered" value={metrics.delivered} />
                <Metric title="Opened" value={metrics.opened} />
                <Metric title="Clicked" value={metrics.clicked} />
                <Metric title="Unsubscribed" value={metrics.unsub} />
              </div>

              <div style={styles.chartWrap}>
                {chartMode === "line" ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line dataKey="sent" stroke="#94a3b8" dot={false} />
                      <Line dataKey="delivered" stroke="#22c55e" dot={false} />
                      <Line dataKey="opened" stroke="#3b82f6" dot={false} />
                      <Line dataKey="clicked" stroke="#facc15" dot={false} />
                      <Line dataKey="bounced" stroke="#ef4444" dot={false} />
                      <Line dataKey="unsub" stroke="#a855f7" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={pieData} dataKey="value" outerRadius={120}>
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
                  <div style={styles.th}>Email</div>
                  <div style={styles.th}>Broadcast</div>
                  <div style={styles.th}>Delivered</div>
                  <div style={styles.th}>Open</div>
                  <div style={styles.th}>Click</div>
                  <div style={styles.th}>Unsub</div>
                  <div style={styles.th}>Status</div>
                </div>

                {recent.map((r) => {
                  const when = r.last_event_at || r.sent_at || r.created_at;
                  const deliveredYes = !!r.delivered_at;
                  const bName = nameMap[r.broadcast_id] || "Broadcast";

                  return (
                    <div key={r.id} style={styles.tr}>
                      <div style={styles.td}>{new Date(when).toLocaleString()}</div>
                      <div style={styles.td}>{r.email}</div>
                      <div style={styles.td}>{bName}</div>
                      <div style={styles.td}>{deliveredYes ? "Yes" : "—"}</div>
                      <div style={styles.td}>{r.opened_at ? 1 : 0}</div>
                      <div style={styles.td}>{r.clicked_at ? 1 : 0}</div>
                      <div style={styles.td}>{r.unsubscribed ? "Yes" : "—"}</div>
                      <div style={styles.td}>{r.status}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* =========================
   UI COMPONENTS + STYLES
========================= */

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
  page:{minHeight:"100vh",background:"radial-gradient(circle at top, rgba(15,23,42,0.9) 0%, rgba(2,6,23,1) 55%, rgba(2,6,23,1) 100%)",padding:"30px 20px 40px",color:"#e6eef8",fontSize:16},
  container:{maxWidth:1320,margin:"0 auto"},
  banner:{width:"100%",borderRadius:18,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 18px 40px rgba(0,0,0,0.45)",border:"1px solid rgba(255,255,255,0.10)"},
  bannerLeft:{display:"flex",alignItems:"center",gap:14},
  bannerIconWrap:{width:69,height:69,display:"grid",placeItems:"center",borderRadius:10,background:"rgba(0,0,0,0.18)"},
  bannerIcon:{fontSize:48,lineHeight:1},
  bannerTitle:{fontSize:48,fontWeight:600,color:"#241a00",lineHeight:1.05},
  bannerSub:{fontSize:18,marginTop:3,color:"rgba(36,26,0,0.80)"},
  backBtn:{background:"rgba(2,6,23,0.75)",color:"#e6eef8",borderRadius:999,padding:"10px 16px",fontSize:16,textDecoration:"none",border:"1px solid rgba(255,255,255,0.18)",fontWeight:600},
  rangeRow:{marginTop:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  rangePill:{border:"1px solid rgba(255,255,255,0.18)",background:"rgba(2,6,23,0.55)",color:"#e6eef8",borderRadius:999,padding:"7px 12px",fontSize:16,cursor:"pointer",fontWeight:600},
  rangePillActive:{background:"rgba(250,204,21,0.20)",border:"1px solid rgba(250,204,21,0.55)"},
  toggleBtn:{border:"1px solid rgba(255,255,255,0.18)",background:"rgba(2,6,23,0.75)",color:"#e6eef8",borderRadius:999,padding:"10px 16px",fontSize:16,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"},
  note:{marginTop:10,padding:"10px 12px",borderRadius:12,background:"rgba(2,6,23,0.55)",border:"1px solid rgba(255,255,255,0.10)",fontSize:16},
  metricsGrid:{marginTop:14,display:"grid",gridTemplateColumns:"repeat(5, minmax(0, 1fr))",gap:10},
  metricBox:{padding:12,borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)"},
  metricTitle:{fontSize:16,opacity:0.85,fontWeight:600},
  metricValue:{fontSize:16,fontWeight:600,marginTop:6},
  chartWrap:{marginTop:14,padding:14,borderRadius:14,background:"rgba(2,6,23,0.55)",border:"1px solid rgba(255,255,255,0.10)"},
  tableWrap:{marginTop:14,borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.10)"},
  tableHeadRow:{display:"grid",gridTemplateColumns:"1.4fr 2fr 2fr .8fr .6fr .6fr .6fr 1fr",padding:"10px 12px",background:"rgba(255,255,255,0.06)"},
  th:{fontSize:16,fontWeight:600,opacity:0.9},
  tr:{display:"grid",gridTemplateColumns:"1.4fr 2fr 2fr .8fr .6fr .6fr .6fr 1fr",padding:"10px 12px",background:"rgba(2,6,23,0.45)",borderTop:"1px solid rgba(255,255,255,0.08)"},
  td:{fontSize:16,opacity:0.92,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
};
