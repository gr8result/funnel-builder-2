import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect } from "react";

const A = "#ec4899";

function ABDemo() {
  const [conversion, setConversion] = useState({ diy: 2.1, gr8: 2.1 });
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setAnimated(true);
      let frame = 0;
      const target = 11.4;
      const start = 2.1;
      const interval = setInterval(() => {
        frame++;
        const progress = Math.min(frame / 60, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setConversion({ diy: 2.1, gr8: parseFloat((start + (target - start) * eased).toFixed(1)) });
        if (progress >= 1) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 500 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* DIY version */}
        <div style={{ background: "#080e18", border: "1px solid #1e293b", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "#0f1520", padding: "10px 14px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>Generic DIY page</span>
            <span style={{ fontSize: 10, background: "#1a1a20", color: "#334155", borderRadius: 4, padding: "2px 8px" }}>Before</span>
          </div>
          <div style={{ padding: "16px 14px" }}>
            <div style={{ height: 10, background: "#1e293b", borderRadius: 4, width: "75%", marginBottom: 8 }} />
            <div style={{ height: 8, background: "#1e293b", borderRadius: 4, width: "55%", marginBottom: 16, opacity: 0.6 }} />
            <div style={{ background: "#1e293b", borderRadius: 8, height: 72, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "#334155" }}>Hero image</span>
            </div>
            <div style={{ height: 7, background: "#1e293b", borderRadius: 4, marginBottom: 6, opacity: 0.7 }} />
            <div style={{ height: 7, background: "#1e293b", borderRadius: 4, marginBottom: 6, opacity: 0.5, width: "85%" }} />
            <div style={{ height: 7, background: "#1e293b", borderRadius: 4, marginBottom: 16, opacity: 0.4, width: "70%" }} />
            <div style={{ background: "#1e293b", borderRadius: 6, padding: "8px 14px", textAlign: "center" }}>
              <span style={{ fontSize: 11, color: "#475569" }}>Click here</span>
            </div>
            <div style={{ marginTop: 14, padding: "10px", background: "#0c1218", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#334155", marginBottom: 4 }}>Conversion rate</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#475569" }}>2.1%</div>
            </div>
          </div>
        </div>

        {/* GR8 RESULT optimised */}
        <div style={{ background: "#080e18", border: `1px solid ${A}44`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 40px ${A}14` }}>
          <div style={{ background: `${A}12`, padding: "10px 14px", borderBottom: `1px solid ${A}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: A, fontWeight: 700 }}>GR8 RESULT optimised</span>
            <span style={{ fontSize: 10, background: `${A}22`, color: A, borderRadius: 4, padding: "2px 8px" }}>After</span>
          </div>
          <div style={{ padding: "16px 14px" }}>
            <div style={{ height: 10, background: `${A}44`, borderRadius: 4, width: "90%", marginBottom: 6 }} />
            <div style={{ height: 8, background: `${A}22`, borderRadius: 4, width: "65%", marginBottom: 14, opacity: 0.8 }} />
            <div style={{ background: `linear-gradient(135deg, ${A}33, #0c0820)`, borderRadius: 8, height: 72, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${A}33` }}>
              <span style={{ fontSize: 10, color: `${A}aa` }}>Hero — mobile optimised</span>
            </div>
            <div style={{ height: 7, background: "#2a1a28", borderRadius: 4, marginBottom: 6, opacity: 0.8 }} />
            <div style={{ height: 7, background: "#2a1a28", borderRadius: 4, marginBottom: 6, opacity: 0.6, width: "85%" }} />
            <div style={{ height: 7, background: "#2a1a28", borderRadius: 4, marginBottom: 14, opacity: 0.5, width: "60%" }} />
            <div style={{ background: A, borderRadius: 6, padding: "8px 14px", textAlign: "center", boxShadow: `0 4px 16px ${A}44` }}>
              <span style={{ fontSize: 11, color: "#fff", fontWeight: 800 }}>Get started — Free</span>
            </div>
            <div style={{ marginTop: 14, padding: "10px", background: `${A}10`, border: `1px solid ${A}33`, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: `${A}aa`, marginBottom: 4 }}>Conversion rate</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: A, transition: "all 0.05s" }}>{conversion.gr8}%</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <span style={{ fontSize: 13, background: `${A}14`, border: `1px solid ${A}33`, color: A, borderRadius: 8, padding: "6px 16px", fontWeight: 700 }}>
          {((conversion.gr8 / 2.1 - 1) * 100).toFixed(0)}% more conversions with an optimised page
        </span>
      </div>
    </div>
  );
}

const FEATS = [
  { i: "🎨", t: "40+ professional templates", b: "Every template is built to convert — proper above-the-fold hierarchy, trust signals, social proof, and one clear CTA." },
  { i: "📱", t: "Mobile-first by default", b: "Over 60% of traffic is mobile. Every GR8 RESULT landing page is optimised for mobile first, then desktop." },
  { i: "🔗", t: "Custom domain in one click", b: "Connect your domain in under 60 seconds. SSL automatically provisioned. Looks like it cost $5,000 to build." },
  { i: "🧪", t: "A/B split testing", b: "Run two versions of any page head-to-head. Traffic splits automatically. Winner declared by data, not gut feeling." },
  { i: "⚡", t: "Speed-optimised delivery", b: "Pages load under 2 seconds on 3G. Core Web Vitals in the green zone. Faster pages rank higher and convert more." },
  { i: "📊", t: "Heatmaps & analytics", b: "See where people click, scroll, and drop off. Fix the leaks. Stop guessing what's not working." },
];

export default function LandingPagesFeaturePage() {
  return (
    <>
      <Head>
        <title>Landing Pages — GR8 RESULT | Pages that convert, not just look nice</title>
        <meta name="description" content="40+ conversion-optimised templates, A/B testing, custom domains, heatmaps, and speed-optimised delivery." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Builder →" ctaHref="/modules/landing-pages" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>🎯 Landing Pages</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Pages that convert,<br />not just<br /><span style={{ color: A }}>look nice.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Every template in GR8 RESULT is built around conversion science — hierarchy, trust, urgency, and the right CTA in the right place. Not just a pretty page. A machine that turns visitors into customers.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/landing-pages" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Build my page →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><ABDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["40+","Conversion-optimised templates"],["<2s","Page load time on mobile 3G"],["5.4×","Average conversion lift vs generic pages"],["1-click","Custom domain SSL setup"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Beautiful isn't enough.<br />Your page needs to convert.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>Canva templates and website builders give you pretty layouts. GR8 RESULT gives you pages engineered around conversion principles that actually work.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>More traffic deserves<br />a page that converts it.</h2>
        <Link href="/modules/landing-pages" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Build my first page →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>40+ templates. Custom domains. A/B testing. Included in all plans.</div>
      </section>
    </>
  );
}
