import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase-client";

const CARD_STYLE = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "20px 24px",
};

const STAT_CARD = {
  ...CARD_STYLE,
  flex: 1,
  minWidth: 140,
};

function StatCard({ label, value, sub }) {
  return (
    <div style={STAT_CARD}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#f9fafb" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function pct(a, b) {
  if (!b) return "—";
  return ((a / b) * 100).toFixed(1) + "%";
}

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) { setLoading(false); return; }

      const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

      const { data: rows } = await supabase
        .from("email_sends")
        .select("status, open_count, click_count, unsubscribed, sent_at, subject")
        .eq("user_id", userId)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(500);

      const r = rows || [];
      const sent = r.length;
      const delivered = r.filter((x) => x.status !== "bounced").length;
      const bounced = r.filter((x) => x.status === "bounced").length;
      const opens = r.reduce((s, x) => s + (x.open_count || 0), 0);
      const clicks = r.reduce((s, x) => s + (x.click_count || 0), 0);
      const unsubs = r.filter((x) => x.unsubscribed).length;

      setStats({ sent, delivered, bounced, opens, clicks, unsubs });
      setRecent(r.slice(0, 50));
      setLoading(false);
    })();
  }, [range]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#f9fafb" }}>Analytics</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#9ca3af" }}>
            Email performance for the last {range} days
          </p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          style={{
            background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
            color: "#f9fafb", padding: "6px 12px", fontSize: 13, cursor: "pointer",
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", textAlign: "center", padding: 60 }}>Loading…</div>
      ) : !stats ? (
        <div style={{ color: "#9ca3af", textAlign: "center", padding: 60 }}>
          Please log in to view analytics.
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Emails Sent" value={stats.sent.toLocaleString()} />
            <StatCard label="Delivered" value={stats.delivered.toLocaleString()} sub={pct(stats.delivered, stats.sent) + " delivery rate"} />
            <StatCard label="Opens" value={stats.opens.toLocaleString()} sub={pct(stats.opens, stats.delivered) + " open rate"} />
            <StatCard label="Clicks" value={stats.clicks.toLocaleString()} sub={pct(stats.clicks, stats.delivered) + " click rate"} />
            <StatCard label="Bounces" value={stats.bounced.toLocaleString()} sub={pct(stats.bounced, stats.sent) + " bounce rate"} />
            <StatCard label="Unsubscribes" value={stats.unsubs.toLocaleString()} />
          </div>

          {/* Recent sends table */}
          <div style={CARD_STYLE}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#f9fafb", margin: "0 0 16px" }}>
              Recent Email Activity
            </h2>
            {recent.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
                No emails sent in this period. Send your first campaign from the Email section.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1f2937" }}>
                      {["Subject", "Status", "Opens", "Clicks", "Sent"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #111827" }}>
                        <td style={{ padding: "8px 12px", color: "#e5e7eb", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.subject || <span style={{ color: "#4b5563" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: row.status === "bounced" ? "#7f1d1d" : row.status === "delivered" ? "#064e3b" : "#1f2937",
                            color: row.status === "bounced" ? "#fca5a5" : row.status === "delivered" ? "#6ee7b7" : "#9ca3af",
                          }}>
                            {row.status || "sent"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{row.open_count || 0}</td>
                        <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{row.click_count || 0}</td>
                        <td style={{ padding: "8px 12px", color: "#6b7280" }}>
                          {row.sent_at ? new Date(row.sent_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
