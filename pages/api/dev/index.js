// pages/dev/index.js
// Developer-only dashboard (guarded by middleware). Uses a simple API that you can
// later wire to real data sources (Supabase / Stripe). For now, it works with
// safe defaults if tables aren't present.

import { useEffect, useState } from "react";

function Stat({ label, value }) {
  return (
    <div style={{ padding: 16, border: "1px solid #1f2937", borderRadius: 12, background: "#0f1115" }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function DevHome() {
  const [data, setData] = useState({ usersOnline: 0, activeSubs: 0, mrr: 0, modules: [], revenueSeries: [] });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const res = await fetch("/api/dev/metrics");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load metrics");
        setData(json);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#e6edf3" }}>
      <div style={{ width: "80%", margin: "0 auto", padding: "18px 0 32px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Developer</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 0" }}>Master Dashboard</h1>
          </div>
          <a href="/dashboard" style={{ textDecoration: "none", color: "#9aa7b2" }}>â† Back to app</a>
        </header>

        {err ? <div style={{ color: "salmon", marginBottom: 10 }}>{err}</div> : null}

        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Stat label="Users online (last 10m)" value={data.usersOnline} />
          <Stat label="Active subscribers" value={data.activeSubs} />
          <Stat label="MRR (A$)" value={data.mrr.toLocaleString("en-AU")} />
          <Stat label="Paying modules" value={data.modules?.length || 0} />
        </div>

        {/* Revenue chart (simple SVG) */}
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>Monthly revenue (A$)</h2>
          <RevenueChart points={data.revenueSeries || []} />
        </section>

        {/* Module breakdown */}
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>Modules with paying subscribers</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(data.modules || []).map((m) => (
              <div key={m.name} style={{ padding: 14, border: "1px solid #1f2937", borderRadius: 12, background: "#0f1115" }}>
                <div style={{ fontWeight: 800 }}>{m.name}</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  Subscribers: <b>{m.count}</b> &nbsp;|&nbsp; MRR: <b>A${m.mrr.toLocaleString("en-AU")}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function RevenueChart({ points }) {
  const w = 800, h = 220, pad = 20;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(1, ...ys);
  const dx = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : 0;
  const scaleY = (v) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - 2 * pad);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * dx} ${scaleY(p.y)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0f1115", border: "1px solid #1f2937", borderRadius: 12 }}>
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={pad + i * dx} cy={scaleY(p.y)} r="3" fill="#60a5fa" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={"t"+i} x={pad + i * dx} y={h - 4} fontSize="10" textAnchor="middle" fill="#9aa7b2">{p.label}</text>
      ))}
    </svg>
  );
}


