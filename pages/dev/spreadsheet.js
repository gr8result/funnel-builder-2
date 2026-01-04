// /pages/dev/spreadsheet.js
// Live admin spreadsheet dashboard — fixed MRR/sub mapping + drill-down details

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function DevSpreadsheet() {
  const [data, setData] = useState({
    subscribers: [],
    totals: { totalSubs: 0, activeNow: 0, mrr: 0, arpu: 0, signups7d: 0, churn: 0 },
    revenueByModule: [],
    mrrSeries: [],
    usersSeries: [],
  });
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dev/spreadsheet-data");
        const text = await res.text();
        const json = JSON.parse(text);
        if (!res.ok) throw new Error(json?.error || "Failed to load");
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return data.subscribers;
    return data.subscribers.filter(
      (u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    );
  }, [q, data.subscribers]);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#e6edf3" }}>
      <div style={{ width: "92%", margin: "0 auto", padding: "18px 0 36px" }}>
        {/* Blue Header Banner */}
        <div
          style={{
            background: "#1d4ed8",
            padding: "14px 18px",
            borderRadius: "10px 10px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
            Spreadsheet Dashboard
          </h1>
          <Link
            href="/admin/dashboard"
            style={{
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              borderRadius: 8,
              padding: "6px 14px",
              border: "1px solid #374151",
              textDecoration: "none",
            }}
          >
            ← Admin Dashboard
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#311a1a",
              border: "1px solid #512222",
              padding: 12,
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Top Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 10,
            marginTop: 14,
          }}
        >
          <Stat label="Total Subscribers" value={data.totals.totalSubs} />
          <Stat label="Active Now" value={data.totals.activeNow} />
          <Stat label="MRR (A$)" value={fmtMoney(data.totals.mrr)} />
          <Stat label="ARPU (A$/mo)" value={fmtMoney(data.totals.arpu)} />
          <Stat label="New Sign-ups (7d)" value={data.totals.signups7d} />
          <Stat label="Churn Rate (%)" value={`${data.totals.churn}%`} />
        </div>

        {/* Charts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          <ChartCard title="Users online (last 24h)">
            <LineChart points={data.usersSeries} yLabel="users" height={180} />
          </ChartCard>
          <ChartCard title="Monthly revenue (A$)">
            <LineChart points={data.mrrSeries} yLabel="A$" height={180} />
          </ChartCard>
        </div>

        {/* Revenue by module */}
        <section style={cardSec}>
          <h2 style={secH2}>Revenue by module</h2>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Module</th>
                <th style={thRight}>Subscribers</th>
                <th style={thRight}>MRR (A$)</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByModule.map((m) => (
                <tr key={m.name}>
                  <td style={td}>{m.name}</td>
                  <td style={tdRight}>{m.count}</td>
                  <td style={tdRight}>{fmtMoney(m.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Subscribers List */}
        <section style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h2 style={secH2}>Subscribers</h2>
            <input
              placeholder="Search name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={search}
            />
          </div>

          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <Row header>
              <Cell w="40%">Subscriber</Cell>
              <Cell w="20%" right>
                Monthly (A$)
              </Cell>
              <Cell w="20%" right>
                Status
              </Cell>
              <Cell w="20%" right>
                Actions
              </Cell>
            </Row>

            {filtered.map((u) => (
              <div key={u.id} style={{ borderTop: "1px solid #1f2937" }}>
                <Row>
                  <Cell w="40%">
                    <div style={{ fontWeight: 800 }}>{u.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{u.email}</div>
                  </Cell>
                  <Cell w="20%" right>
                    {fmtMoney(u.mrr)}
                  </Cell>
                  <Cell w="20%" right>
                    <ActivePill active={u.active} />
                  </Cell>
                  <Cell w="20%" right>
                    <button
                      onClick={() => setOpen({ ...open, [u.id]: !open[u.id] })}
                      style={btn}
                    >
                      {open[u.id] ? "Hide Details" : "Show Details"}
                    </button>
                  </Cell>
                </Row>

                {open[u.id] && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px 14px 10px",
                    }}
                  >
                    <table style={tblMini}>
                      <thead>
                        <tr>
                          <th style={thMini}>Module</th>
                          <th style={thMiniRight}>Price (A$)</th>
                          <th style={thMiniRight}>Subscribed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.modules.length === 0 ? (
                          <tr>
                            <td style={tdMini} colSpan="3">
                              No modules found.
                            </td>
                          </tr>
                        ) : (
                          u.modules.map((m, i) => (
                            <tr key={m.name + i}>
                              <td style={tdMini}>{m.name}</td>
                              <td style={tdMiniRight}>{fmtMoney(m.price)}</td>
                              <td style={tdMiniRight}>Active</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --- Components & Styling --- */
function Stat({ label, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function LineChart({ points = [], height = 180, yLabel = "" }) {
  const w = 560,
    h = height,
    pad = 22;
  const ys = points.map((p) => p.y);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(1, ...ys);
  const dx = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : 0;
  const scaleY = (v) =>
    h - pad - ((v - minY) / (maxY - minY || 1)) * (h - 2 * pad);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * dx} ${scaleY(p.y)}`)
    .join(" ");
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      style={{
        background: "#0f1115",
        border: "1px solid #1f2937",
        borderRadius: 10,
      }}
    >
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={pad + i * dx} cy={scaleY(p.y)} r="3" fill="#60a5fa" />
      ))}
      {points.map((p, i) => (
        <text
          key={"t" + i}
          x={pad + i * dx}
          y={h - 6}
          fontSize="10"
          textAnchor="middle"
          fill="#9aa7b2"
        >
          {p.label}
        </text>
      ))}
      <text x={6} y={12} fontSize="10" fill="#9aa7b2">
        {yLabel}
      </text>
    </svg>
  );
}

function ActivePill({ active }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: active ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
        border: `1px solid ${active ? "#16a34a" : "#475569"}`,
        color: active ? "#86efac" : "#cbd5e1",
        fontWeight: 700,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* --- Styles --- */
const card = {
  padding: 14,
  border: "1px solid #1f2937",
  borderRadius: 12,
  background: "#0f1115",
};
const cardSec = { ...card, marginTop: 16 };
const secH2 = { fontSize: 16, fontWeight: 800, margin: "0 0 8px" };
const tbl = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 12,
  opacity: 0.8,
  borderBottom: "1px solid #1f2937",
};
const thRight = { ...th, textAlign: "right" };
const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #1f2937",
};
const tdRight = { ...td, textAlign: "right" };
const tblMini = { width: "100%", borderCollapse: "collapse" };
const thMini = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 12,
  opacity: 0.8,
  borderBottom: "1px solid #1f2937",
};
const thMiniRight = { ...thMini, textAlign: "right" };
const tdMini = { padding: "6px 8px", borderBottom: "1px solid #1f2937" };
const tdMiniRight = { ...tdMini, textAlign: "right" };
const row = {
  display: "grid",
  gridTemplateColumns: "40% 20% 20% 20%",
  alignItems: "center",
};
const rowHeader = { ...row, background: "#0f1115", fontWeight: 800 };
const cell = { padding: "10px 12px", borderBottom: "none" };
const cellRight = { ...cell, textAlign: "right" };
const btn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#111827",
  color: "#e5e7eb",
  fontWeight: 700,
  cursor: "pointer",
};
const search = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0b0e12",
  color: "#e6edf3",
  width: 260,
};
function Row({ header = false, children }) {
  return <div style={header ? rowHeader : row}>{children}</div>;
}
function Cell({ w, right = false, children }) {
  return <div style={{ ...(right ? cellRight : cell), width: w }}>{children}</div>;
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 });
}
