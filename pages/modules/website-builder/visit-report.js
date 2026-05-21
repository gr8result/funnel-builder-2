import React, { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function StatCard({ label, value, sub, color = "#0ea5e9" }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 14, padding: "20px 24px", minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1.1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.visits), 1);
  const barWidth = Math.max(4, Math.floor(560 / data.length) - 2);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${data.length * (barWidth + 2)} 80`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 80, display: "block" }}
      >
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.visits / max) * 72));
          const x = i * (barWidth + 2);
          const y = 78 - h;
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barWidth} height={h} rx={2} fill={isToday ? "#38bdf8" : "#0ea5e9"} opacity={0.85} />
              {d.visits > 0 && (
                <title>{d.date}: {d.visits} visit{d.visits !== 1 ? "s" : ""}</title>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#475569" }}>
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function BrowserBadge({ browser }) {
  const colors = {
    Chrome: "#4285f4", Firefox: "#ff7139", Safari: "#0fb5ee", Edge: "#0078d4",
    Opera: "#ff1b2d", Bot: "#9ca3af", IE: "#1ebbee", Other: "#6b7280", Unknown: "#374151",
  };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      background: (colors[browser] || "#374151") + "22",
      color: colors[browser] || "#6b7280",
      fontSize: 12, fontWeight: 600,
    }}>
      {browser}
    </span>
  );
}

export default function VisitReportPage() {
  const router = useRouter();
  const { projectId, days: daysParam } = router.query;
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    if (daysParam) setDays(Number(daysParam) || 30);
  }, [daysParam]);

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/website/visit-report?projectId=${encodeURIComponent(projectId)}&days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, days]);

  useEffect(() => { load(); }, [load]);

  const title = data?.projectName ? `Visitors — ${data.projectName}` : "Visitor Report";

  return (
    <>
      <Head>
        <title>{title} | GR8 Website Studio</title>
      </Head>
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link href="/modules/website-builder" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
            ← Website Builder
          </Link>
          {projectId && (
            <Link href={`/modules/website-builder/visual-builder?projectId=${projectId}`} style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
              ← Back to Editor
            </Link>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
            📊 {data?.projectName || "Visitor Report"}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setDays(o.value)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: days === o.value ? "#0ea5e9" : "#334155",
                  color: days === o.value ? "#fff" : "#94a3b8",
                }}
              >{o.label}</button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#334155", color: "#94a3b8" }}
          >{loading ? "..." : "↻ Refresh"}</button>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
          {!projectId && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "60px 0" }}>
              No project selected. Open this page from the Website Builder.
            </div>
          )}

          {error && (
            <div style={{ background: "#7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
              {error}
            </div>
          )}

          {loading && !data && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "60px 0" }}>Loading…</div>
          )}

          {data && (
            <>
              {/* Stat cards */}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
                <StatCard label="TOTAL VISITS" value={data.totalVisits.toLocaleString()} sub="All time" color="#0ea5e9" />
                <StatCard label="UNIQUE VISITORS" value={data.uniqueVisitors.toLocaleString()} sub="By browser cookie" color="#a78bfa" />
                <StatCard label="TODAY" value={data.todayVisits.toLocaleString()} color="#34d399" />
                <StatCard label="LAST 7 DAYS" value={data.weekVisits.toLocaleString()} color="#f59e0b" />
              </div>

              {/* Daily chart */}
              <div style={{ background: "#1e293b", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 14, letterSpacing: "0.06em" }}>
                  VISITS PER DAY — LAST {days} DAYS
                </div>
                <MiniBarChart data={data.dailyChart} />
              </div>

              {/* Recent visits table */}
              <div style={{ background: "#1e293b", borderRadius: 14, padding: "20px 24px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 16, letterSpacing: "0.06em" }}>
                  RECENT VISITS (last {data.recentVisits.length})
                </div>
                {data.recentVisits.length === 0 ? (
                  <div style={{ color: "#475569", textAlign: "center", padding: "30px 0" }}>No visits recorded yet.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          {["Date & Time", "IP Address", "Browser", "Page", "Referrer", "Type"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentVisits.map((v, i) => (
                          <React.Fragment key={v.id}>
                            <tr
                              onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                              style={{
                                borderBottom: "1px solid #1e293b",
                                cursor: "pointer",
                                background: expandedRow === i ? "#0f172a" : i % 2 === 0 ? "transparent" : "#172033",
                              }}
                            >
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#94a3b8" }}>
                                {new Date(v.time).toLocaleString()}
                              </td>
                              <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#e2e8f0" }}>
                                {v.ipMasked || "—"}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <BrowserBadge browser={v.browser} />
                              </td>
                              <td style={{ padding: "9px 12px", color: "#93c5fd", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {v.page || "/"}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {v.referrer ? <a href={v.referrer} target="_blank" rel="noopener noreferrer" style={{ color: "#64748b" }}>{v.referrer}</a> : "—"}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                {v.isReturning
                                  ? <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>↩ RETURNING</span>
                                  : <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>✦ NEW</span>}
                              </td>
                            </tr>
                            {expandedRow === i && (
                              <tr style={{ background: "#0f172a" }}>
                                <td colSpan={6} style={{ padding: "10px 16px 14px" }}>
                                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                                    <strong style={{ color: "#94a3b8" }}>User-Agent:</strong>{" "}
                                    <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{v.userAgent || "—"}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, fontSize: 11, color: "#334155", textAlign: "center" }}>
                IP addresses are partially masked for privacy. Click any row to see the full user-agent string.
                Unique visitors are identified by a persistent browser cookie (wbv_visitor_id).
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
