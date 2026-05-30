import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../utils/supabase-client";

const RANGE_TO_DAYS = { today: 0, d7: 7, d30: 30, d90: 90, all: null };

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

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function fmtDuration(secs) {
  if (!secs) return "—";
  const n = Number(secs);
  if (!Number.isFinite(n)) return "—";
  if (n < 60) return `${n}s`;
  const mins = Math.floor(n / 60);
  const remainder = n % 60;
  return `${mins}m ${remainder}s`;
}

export default function CallsReport() {
  const [range, setRange] = useState("all");
  const [chartMode, setChartMode] = useState("line");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [calls, setCalls] = useState([]);

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
          setCalls([]);
          setLoading(false);
          return;
        }

        let q = supabase
          .from("crm_calls")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(10000);

        if (fromIso) q = q.gte("created_at", fromIso);

        const { data, error } = await q;
        if (error) throw error;
        if (!mounted) return;
        setCalls(data || []);
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
    const total = calls.length;
    let outbound = 0;
    let inbound = 0;
    let withRecording = 0;
    let totalDuration = 0;

    for (const c of calls) {
      const dir = String(c?.direction || "").toLowerCase();
      if (dir === "outbound") outbound += 1;
      else if (dir === "inbound") inbound += 1;

      if (c?.recording_url || c?.recording_sid) withRecording += 1;
      if (Number.isFinite(Number(c?.recording_duration))) {
        totalDuration += Number(c?.recording_duration);
      }
    }

    const avgDuration = outbound > 0 ? Math.round(totalDuration / outbound) : 0;
    return { total, outbound, inbound, withRecording, totalDuration, avgDuration };
  }, [calls]);

  const chartData = useMemo(() => {
    const map = {};
    for (const c of calls) {
      const key = toDateKey(c.created_at);
      if (!key) continue;
      if (!map[key]) map[key] = { date: key, outbound: 0, inbound: 0 };
      const dir = String(c?.direction || "").toLowerCase();
      if (dir === "outbound") map[key].outbound += 1;
      else if (dir === "inbound") map[key].inbound += 1;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [calls]);

  const recent = useMemo(
    () => [...calls].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100),
    [calls]
  );

  return (
    <>
      <Head>
        <title>Calls Report</title>
      </Head>

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ ...styles.banner, background: "#8b5cf6" }}>
            <div style={styles.bannerLeft}>
              <div style={styles.bannerIconWrap} aria-hidden="true">
                <span style={styles.bannerIcon}>📞</span>
              </div>
              <div>
                <div style={styles.bannerTitle}>Calls report</div>
                <div style={styles.bannerSub}>Call history, recordings, duration and analytics.</div>
              </div>
            </div>
            <Link href="/modules/email/reports" style={styles.backBtn}>
              ← Back
            </Link>
          </div>

          <div style={styles.rangeRow}>
            <div style={styles.rangeLabel}>Time period:</div>
            {["today", "d7", "d30", "d90", "all"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  ...styles.rangePill,
                  ...(range === r ? styles.rangePillActive : {}),
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
          </div>

          {loading ? <div style={styles.note}>Loading…</div> : null}
          {!loading && !userId ? <div style={styles.note}>You must be logged in to view calls.</div> : null}
          {!loading && err ? <div style={{ ...styles.note, border: "1px solid #ef4444" }}>{err}</div> : null}

          {!loading && userId && !err ? (
            <>
              <div style={styles.metricsGrid}>
                <div style={styles.metricBox}>
                  <div style={styles.metricTitle}>Total calls</div>
                  <div style={styles.metricValue}>{metrics.total}</div>
                </div>
                <div style={styles.metricBox}>
                  <div style={styles.metricTitle}>Outbound</div>
                  <div style={styles.metricValue}>{metrics.outbound}</div>
                </div>
                <div style={styles.metricBox}>
                  <div style={styles.metricTitle}>Inbound (voicemail)</div>
                  <div style={styles.metricValue}>{metrics.inbound}</div>
                </div>
                <div style={styles.metricBox}>
                  <div style={styles.metricTitle}>With recordings</div>
                  <div style={styles.metricValue}>{metrics.withRecording}</div>
                </div>
                <div style={styles.metricBox}>
                  <div style={styles.metricTitle}>Avg duration</div>
                  <div style={styles.metricValue}>{fmtDuration(metrics.avgDuration)}</div>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableHeadRow}>
                  <div style={styles.th}>When</div>
                  <div style={styles.th}>Direction</div>
                  <div style={styles.th}>Number</div>
                  <div style={styles.th}>Duration</div>
                  <div style={styles.th}>Recording</div>
                </div>

                {recent.length === 0 ? (
                  <div style={styles.tableEmpty}>No calls found for this period.</div>
                ) : (
                  recent.map((c) => {
                    const recUrl = c.recording_url || (c.recording_sid ? `/api/twilio/recording?sid=${encodeURIComponent(c.recording_sid)}` : null);
                    const dir = String(c?.direction || "").toLowerCase();
                    const dirLabel = dir === "outbound" ? "📤 Outbound" : dir === "inbound" ? "📥 Inbound" : "—";
                    const number = dir === "outbound" ? c.to_number || c.from_number : c.from_number || c.to_number;

                    return (
                      <div key={c.id} style={styles.tr}>
                        <div style={styles.td}>{fmtDate(c.created_at)}</div>
                        <div style={styles.td}>{dirLabel}</div>
                        <div style={styles.td}>{number || "—"}</div>
                        <div style={styles.td}>{fmtDuration(c.recording_duration)}</div>
                        <div style={styles.td}>
                          {recUrl ? (
                            <audio controls preload="none" src={recUrl} style={{ height: 28, maxWidth: 240 }} />
                          ) : (
                            <span style={{ opacity: 0.7 }}>No recording</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {recent.length > 0 && (
                <div style={styles.note}>
                  Showing {recent.length} most recent calls. Recordings hosted on Twilio servers.
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(15,23,42,0.9) 0%, rgba(2,6,23,1) 55%, rgba(2,6,23,1) 100%)",
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
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#f0e5ff", lineHeight: 1.05 },
  bannerSub: { fontSize: 18, marginTop: 3, color: "rgba(240,229,255,0.90)" },

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
  rangePillActive: { background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.55)" },

  note: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 16,
    opacity: 0.95,
  },

  metricsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  metricBox: { padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" },
  metricTitle: { fontSize: 16, opacity: 0.85, fontWeight: 600 },
  metricValue: { fontSize: 24, fontWeight: 600, marginTop: 6, color: "#a78bfa" },

  tableWrap: { marginTop: 14, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" },
  tableHeadRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1fr 2fr",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
  },
  th: { fontSize: 16, fontWeight: 600, opacity: 0.9 },
  tr: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1fr 2fr",
    padding: "10px 12px",
    background: "rgba(2,6,23,0.45)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  td: { fontSize: 16, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tableEmpty: { padding: 12, fontSize: 16, opacity: 0.85, background: "rgba(2,6,23,0.45)" },
};
