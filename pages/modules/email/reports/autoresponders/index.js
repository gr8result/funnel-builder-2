// /pages/modules/email/reports/autoresponders.js
// Full report: Autoresponders — reads from email_sends (autoresponder_id OR source_type=autoresponder)

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../utils/supabase-client";

const RANGE_TO_DAYS = { today: 0, d7: 7, d30: 30, d90: 90, all: null };

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
function buildTimeFilterQuery(q, fromIso) {
  if (!fromIso) return q;
  return q.gte("created_at", fromIso);
}
function calcMetrics(rows) {
  const total = rows.length;
  const opens = rows.filter((r) => Number(r.open_count || 0) > 0).length;
  const clicks = rows.filter((r) => Number(r.click_count || 0) > 0).length;
  const bounced = rows.filter((r) => !!r.bounced_at || r.last_event === "bounce" || r.last_event === "dropped").length;
  const unsub = rows.filter((r) => !!r.unsubscribed).length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return { sent: total, opened: pct(opens), clicked: pct(clicks), bounced: pct(bounced), unsub: pct(unsub) };
}

export default function AutorespondersReport() {
  const [range, setRange] = useState("all");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [rows, setRows] = useState([]);

  const fromIso = useMemo(() => isoDaysAgo(RANGE_TO_DAYS[range]), [range]);
  const metrics = useMemo(() => calcMetrics(rows), [rows]);
  const recentRows = useMemo(() => (rows || []).slice(0, 100), [rows]);

  const hasIdentifier = useMemo(() => {
    // If ANY row has autoresponder_id or source_type, we can classify.
    return rows.some((r) => r?.autoresponder_id) || rows.some((r) => String(r?.source_type || "").toLowerCase() === "autoresponder");
  }, [rows]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setLoadErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;
        if (!mounted) return;
        setUserId(uid);

        if (!uid) {
          setRows([]);
          setLoading(false);
          return;
        }

        const base = (q) => buildTimeFilterQuery(q.eq("user_id", uid), fromIso);

        const q1 = base(
          supabase
            .from("email_sends")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5000)
        );

        const { data, error } = await q1;
        if (error) throw error;

        const filtered = (data || []).filter((r) => {
          if (r?.autoresponder_id) return true;
          const st = String(r?.source_type || "").toLowerCase();
          return st === "autoresponder";
        });

        if (!mounted) return;
        setRows(filtered);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setLoadErr(String(e?.message || e));
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [fromIso]);

  return (
    <>
      <Head><title>Autoresponder analytics</title></Head>

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ ...styles.banner, background: "#a855f7" }}>
            <div>
              <div style={styles.bannerTitle}>Autoresponders</div>
              <div style={styles.bannerSub}>Uses <code>autoresponder_id</code> or <code>source_type=autoresponder</code> if available.</div>
            </div>
            <Link href="/modules/email/reports" style={styles.backBtn}>← Back</Link>
          </div>

          <div style={styles.rangeRow}>
            <div style={styles.rangeLabel}>Time period:</div>
            <RangePill label="Today" active={range === "today"} onClick={() => setRange("today")} />
            <RangePill label="Last 7 days" active={range === "d7"} onClick={() => setRange("d7")} />
            <RangePill label="Last 30 days" active={range === "d30"} onClick={() => setRange("d30")} />
            <RangePill label="Last 90 days" active={range === "d90"} onClick={() => setRange("d90")} />
            <RangePill label="All time" active={range === "all"} onClick={() => setRange("all")} />
          </div>

          {loading ? <div style={styles.note}>Loading…</div> : null}
          {!loading && !userId ? <div style={styles.note}>You must be logged in to view analytics.</div> : null}
          {!loading && loadErr ? <div style={{ ...styles.note, border: "1px solid rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.12)" }}>Error: {loadErr}</div> : null}

          {!loading && userId && !loadErr ? (
            <>
              {!hasIdentifier && rows.length === 0 ? (
                <div style={styles.note}>
                  No autoresponder rows found. If you want autoresponder reporting, your <code>email_sends</code> rows must include
                  either <code>autoresponder_id</code> or <code>source_type = 'autoresponder'</code>.
                </div>
              ) : null}

              <div style={styles.metricsGrid}>
                <Metric title="Sent" value={metrics.sent} />
                <Metric title="Opened" value={`${metrics.opened}%`} />
                <Metric title="Clicked" value={`${metrics.clicked}%`} />
                <Metric title="Bounced" value={`${metrics.bounced}%`} />
                <Metric title="Unsubscribed" value={`${metrics.unsub}%`} />
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableHeadRow}>
                  <div style={styles.th}>When</div>
                  <div style={styles.th}>Email</div>
                  <div style={styles.th}>Identifier</div>
                  <div style={styles.th}>Open</div>
                  <div style={styles.th}>Click</div>
                  <div style={styles.th}>Last event</div>
                </div>

                {recentRows.length === 0 ? (
                  <div style={styles.tableEmpty}>No autoresponder rows found in <code>email_sends</code> for this period.</div>
                ) : (
                  recentRows.map((r) => {
                    const when = r.last_event_at || r.created_at;
                    const ident = r.autoresponder_id || (r.source_type ? String(r.source_type) : "—");
                    return (
                      <div key={r.id} style={styles.tr}>
                        <div style={styles.td}>{when ? new Date(when).toLocaleString() : "—"}</div>
                        <div style={styles.td}>{r.email || "—"}</div>
                        <div style={styles.td}>{ident}</div>
                        <div style={styles.td}>{Number(r.open_count || 0)}</div>
                        <div style={styles.td}>{Number(r.click_count || 0)}</div>
                        <div style={styles.td}>{r.last_event || "—"}</div>
                      </div>
                    );
                  })
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
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#1f0736", lineHeight: 1.05 },
  bannerSub: { fontSize: 18, marginTop: 3, color: "rgba(31,7,54,0.85)" },

  backBtn: {
    background: "rgba(2,6,23,0.75)",
    color: "#e6eef8",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 18,
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
  rangePillActive: { background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.55)" },

  note: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 18,
    opacity: 0.95,
  },

  metricsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 },
  metricBox: { padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" },
  metricTitle: { fontSize: 18, opacity: 0.85, fontWeight: 700 },
  metricValue: { fontSize: 18, fontWeight: 800, marginTop: 6 },

  tableWrap: { marginTop: 14, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" },
  tableHeadRow: { display: "grid", gridTemplateColumns: "1.4fr 2fr 1.2fr 0.6fr 0.6fr 1fr", padding: "10px 12px", background: "rgba(255,255,255,0.06)" },
  th: { fontSize: 18, fontWeight: 900, opacity: 0.9 },
  tr: { display: "grid", gridTemplateColumns: "1.4fr 2fr 1.2fr 0.6fr 0.6fr 1fr", padding: "10px 12px", background: "rgba(2,6,23,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)" },
  td: { fontSize: 18, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tableEmpty: { padding: 12, fontSize: 18, opacity: 0.85, background: "rgba(2,6,23,0.45)" },
};
