import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect } from "react";

const A = "#f59e0b";

function FunnelDemo() {
  const [count, setCount] = useState(0);
  const total = 1000;
  const stages = [
    { label: "Visitors", value: 1000, color: "#f59e0b", pct: 100 },
    { label: "Opted in", value: 342, color: "#fb923c", pct: 34.2 },
    { label: "Watched video", value: 201, color: "#f97316", pct: 20.1 },
    { label: "Clicked offer", value: 98, color: "#ef4444", pct: 9.8 },
    { label: "Purchased", value: 47, color: "#dc2626", pct: 4.7 },
  ];

  useEffect(() => {
    const t = setTimeout(() => {
      if (count < total) setCount(c => Math.min(c + 18, total));
    }, 20);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div style={{ width: "100%", maxWidth: 460, background: "#060e18", border: `1px solid ${A}33`, borderRadius: 20, padding: "28px 28px 24px", boxShadow: `0 0 80px ${A}18` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Summer Promo Funnel</div>
        <div style={{ fontSize: 12, background: "#0b1f06", border: "1px solid #16a34a", color: "#4ade80", borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}>● Live</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stages.map((s, i) => (
          <div key={s.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
                <span style={{ color: s.color, marginRight: 8 }}>{["①","②","③","④","⑤"][i]}</span>{s.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()} · {s.pct}%</div>
            </div>
            <div style={{ height: 10, background: "#0f1e30", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(count / total) * s.pct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`, borderRadius: 5, transition: "width 0.04s linear" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#0b1a0e", border: "1px solid #16a34a33", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>$8,742</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Revenue this month</div>
        </div>
        <div style={{ background: "#1a1006", border: "1px solid #f59e0b33", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: A }}>4.7%</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Conversion rate</div>
        </div>
      </div>
    </div>
  );
}

const FEATS = [
  { i: "🧱", t: "Drag & drop funnel builder", b: "Squeeze pages, sales pages, upsells, order bumps, thank you pages — build any funnel flow visually in minutes." },
  { i: "✍️", t: "AI-generated funnel copy", b: "Describe your offer. AI writes your headline, bullet points, CTA, and email sequence. Edit or publish straight away." },
  { i: "💳", t: "Stripe checkout built in", b: "Accept payments directly inside your funnel. One-click upsells. Order bumps. Subscriptions. All connected." },
  { i: "📧", t: "Auto email sequences", b: "Every opt-in triggers your follow-up sequence automatically. Welcome emails, pitch emails, deadline reminders — on autopilot." },
  { i: "📊", t: "Conversion analytics", b: "See exactly where people drop off. Visitor to opt-in to sale — every stage tracked. Know what to fix." },
  { i: "🔗", t: "Custom domains", b: "Publish your funnel on your own domain. SSL included. Looks professional, loads fast." },
];

export default function FunnelsFeaturePage() {
  return (
    <>
      <Head>
        <title>Sales Funnels — GR8 RESULT | Build funnels that sell 24 hours a day</title>
        <meta name="description" content="Drag & drop funnel builder with AI copy, Stripe checkout, email automation, and conversion analytics." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Funnels →" ctaHref="/funnels" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>🚀 Sales Funnels</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Build funnels<br />that sell for you —<br /><span style={{ color: A }}>24 hours a day.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Drag. Drop. Publish. Collect leads, take payments, trigger email sequences, and track conversions — all from one builder. Your best salesperson never calls in sick.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/funnels" style={{ background: A, color: "#000", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Build my funnel →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><FunnelDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["3.2×","Average conversion lift vs. plain websites"],["$0","Transaction fees — keep every dollar"],["∞","Email sequences run on full autopilot"],["5 min","To publish a complete funnel live"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Everything a funnel needs.<br />Nothing it doesn't.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Lead capture. Payment. Email follow-up. Analytics. All built in. No Zapier glue required.</p>
        </div>
        <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 24 }}>
          {FEATS.map(f => (
            <div key={f.t} style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 16, padding: "28px 24px" }}>
              <div style={{ fontSize: 34, marginBottom: 16 }}>{f.i}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{f.t}</h3>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 32px 100px", textAlign: "center", background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${A}12 0%, transparent 70%)` }}>
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your funnel could be<br />live in 5 minutes.</h2>
        <Link href="/funnels" style={{ background: A, color: "#000", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Start building →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>No transaction fees. Included in all plans.</div>
      </section>
    </>
  );
}
