import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect } from "react";

const A = "#10b981";

function EarningsCalc() {
  const [price, setPrice] = useState(97);
  const [units, setUnits] = useState(12);
  const [displayRev, setDisplayRev] = useState(0);
  const target = price * units;

  useEffect(() => {
    if (displayRev === target) return;
    const diff = target - displayRev;
    const step = Math.max(1, Math.abs(Math.round(diff / 8)));
    const t = setTimeout(() => setDisplayRev(v => diff > 0 ? Math.min(v + step, target) : Math.max(v - step, target)), 30);
    return () => clearTimeout(t);
  }, [displayRev, target]);

  const platformFee = Math.round(target * 0.05);
  const ourFee = 0;

  return (
    <div style={{ width: "100%", maxWidth: 460, background: "#060e18", border: `1px solid ${A}33`, borderRadius: 20, padding: "28px", boxShadow: `0 0 80px ${A}18` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#94a3b8", marginBottom: 24 }}>Revenue Calculator</div>

      <label style={{ display: "block", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 14, color: "#64748b", fontWeight: 600 }}>
          <span>Product price</span><span style={{ color: A, fontWeight: 800 }}>${price}</span>
        </div>
        <input type="range" min={9} max={997} step={1} value={price}
          onChange={e => { setPrice(Number(e.target.value)); setDisplayRev(0); }}
          style={{ width: "100%", accentColor: A }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#334155" }}><span>$9</span><span>$997</span></div>
      </label>

      <label style={{ display: "block", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 14, color: "#64748b", fontWeight: 600 }}>
          <span>Monthly sales</span><span style={{ color: A, fontWeight: 800 }}>{units} sales</span>
        </div>
        <input type="range" min={1} max={200} step={1} value={units}
          onChange={e => { setUnits(Number(e.target.value)); setDisplayRev(0); }}
          style={{ width: "100%", accentColor: A }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#334155" }}><span>1</span><span>200</span></div>
      </label>

      <div style={{ background: "#0a1a12", border: `1px solid ${A}22`, borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>Monthly revenue</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: A, letterSpacing: "-0.03em", lineHeight: 1 }}>
          ${displayRev.toLocaleString()}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#1a0a08", border: "1px solid #ef444422", borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Competitor fee (5%)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>-${platformFee.toLocaleString()}</div>
        </div>
        <div style={{ background: "#0a1a12", border: `1px solid ${A}22`, borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>GR8 RESULT fee</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: A }}>$0</div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: "#334155", textAlign: "center" }}>
        You keep 100% of every sale. Always.
      </div>
    </div>
  );
}

const FEATS = [
  { i: "🛒", t: "Digital & physical products", b: "Sell ebooks, courses, templates, software, merch, physical goods — all from one storefront with one Stripe account." },
  { i: "$0", t: "Zero platform fees", b: "Other platforms take 3–10% of every sale. We take nothing. What you earn is what you keep, forever." },
  { i: "🤝", t: "Built-in affiliate program", b: "Turn your buyers into promoters. Automatic commission tracking, affiliate dashboards, and payout management." },
  { i: "📦", t: "Instant digital delivery", b: "Files, download links, and license keys sent automatically the moment payment clears. Zero manual effort." },
  { i: "⭐", t: "Reviews and social proof", b: "Collect and display verified buyer reviews on every product listing. More trust. Higher conversions." },
  { i: "📊", t: "Revenue analytics", b: "Top products, revenue by day/week/month, refund rates, affiliate performance. Every number you need." },
];

export default function MarketplaceFeaturePage() {
  return (
    <>
      <Head>
        <title>Marketplace — GR8 RESULT | Sell anything. Keep every dollar.</title>
        <meta name="description" content="Digital products, physical listings, built-in affiliate program, Stripe checkout, zero platform fees." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Marketplace →" ctaHref="/modules/vendor/courses" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>🏪 Marketplace</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Sell anything.<br />Reach anyone.<br /><span style={{ color: A }}>Keep every dollar.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Digital products. Physical goods. Courses. Templates. Subscriptions. All with one Stripe account, zero platform fees, and a built-in affiliate program that turns buyers into promoters.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/vendor/courses" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>List my first product →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><EarningsCalc /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["$0","Platform fees — you keep 100% of sales"],["∞","Products you can list — digital or physical"],["Auto","Affiliate commissions tracked & paid"],["Instant","Digital product delivery on payment"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Other platforms take a cut.<br />We don't.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>Gumroad takes 10%. Teachable takes 5%. Shopify takes transaction fees. GR8 RESULT charges zero percent. On every sale. Forever.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Start selling today.<br />Keep everything you make.</h2>
        <Link href="/modules/vendor/courses" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>List my first product →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>No transaction fees. No listing fees. Included in all plans.</div>
      </section>
    </>
  );
}
