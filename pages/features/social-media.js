import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect } from "react";

const A = "#f97316";

const PLATFORMS = [
  {
    name: "Instagram",
    color: "#e1306c",
    bg: "linear-gradient(135deg,#833ab4,#fd1d1d,#f56040)",
    icon: "📷",
    handle: "@yourbrand",
    likes: "2,841",
    comments: "147",
    format: "square",
  },
  {
    name: "Facebook",
    color: "#1877f2",
    bg: "#1877f2",
    icon: "f",
    handle: "Your Brand Page",
    likes: "891",
    comments: "63",
    shares: "204",
    format: "wide",
  },
  {
    name: "LinkedIn",
    color: "#0a66c2",
    bg: "#0a66c2",
    icon: "in",
    handle: "Your Company · 12,400 followers",
    likes: "1,204",
    comments: "88",
    format: "wide",
  },
  {
    name: "Twitter / X",
    color: "#fff",
    bg: "#000",
    icon: "𝕏",
    handle: "@yourbrand",
    likes: "3,700",
    comments: "412",
    format: "wide",
  },
];

const POST_COPY = {
  headline: "Just launched: our biggest service upgrade yet.",
  body: "After 6 months of client feedback, we've rebuilt the entire onboarding experience from scratch. Faster setup. Smarter defaults. Real results from day one.",
  tag: "#ProductUpdate #GrowthHack",
};

function SocialDemo() {
  const [active, setActive] = useState(0);
  const p = PLATFORMS[active];

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % PLATFORMS.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {PLATFORMS.map((pl, i) => (
          <button key={pl.name} onClick={() => setActive(i)}
            style={{ flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: active === i ? `1.5px solid ${pl.color}` : "1px solid #1e293b", background: active === i ? `${pl.color}18` : "#0b1220", color: active === i ? pl.color : "#475569", transition: "all 0.2s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {pl.name.split(" /")[0]}
          </button>
        ))}
      </div>

      {/* Post preview */}
      <div style={{ background: "#0c1524", border: `1px solid ${p.color}33`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 60px ${p.color}18`, transition: "all 0.3s" }}>
        {/* Platform header */}
        <div style={{ padding: "14px 16px", background: `${p.color}12`, borderBottom: `1px solid ${p.color}22`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{p.icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>Your Brand</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{p.handle}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#334155", background: "#0a1120", border: "1px solid #1e293b", borderRadius: 6, padding: "3px 10px" }}>Scheduled · Tomorrow 9am</div>
        </div>

        {/* Content */}
        <div style={{ padding: "18px 18px 14px" }}>
          <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.65, marginBottom: 14 }}>
            <strong>{POST_COPY.headline}</strong><br /><br />
            {POST_COPY.body}<br /><br />
            <span style={{ color: p.color }}>{POST_COPY.tag}</span>
          </p>

          {/* Image placeholder */}
          <div style={{ borderRadius: 10, background: `linear-gradient(135deg, ${p.color}20, #0a1626)`, height: p.format === "square" ? 220 : 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, border: `1px dashed ${p.color}30` }}>
            <div style={{ textAlign: "center", color: "#334155" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 12 }}>Media attached</div>
            </div>
          </div>

          {/* Engagement */}
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#475569" }}>
            <span>❤️ {p.likes}</span>
            <span>💬 {p.comments}</span>
            {p.shares && <span>↗️ {p.shares}</span>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#334155" }}>
        One post · Scheduling to {PLATFORMS.length} platforms simultaneously
      </div>
    </div>
  );
}

const FEATS = [
  { i: "📅", t: "Visual content calendar", b: "Drag and schedule posts across a month view. See every platform at once. Reschedule by dragging." },
  { i: "🤖", t: "AI caption writer", b: "Describe what you want. AI writes platform-appropriate captions with hashtags for every network." },
  { i: "⚡", t: "Bulk scheduling", b: "Upload 30 days of posts in one go. Set it once. Walk away for a month." },
  { i: "📱", t: "8 platforms, 1 dashboard", b: "Instagram, Facebook, LinkedIn, Twitter/X, TikTok, Pinterest, YouTube, Google Business — all connected." },
  { i: "📊", t: "Performance reporting", b: "Which posts got engagement. Best times to post. What to do more of. All in one dashboard." },
  { i: "🖼️", t: "Built-in image editor", b: "Resize, crop, add text overlays and brand colours without leaving the platform." },
];

export default function SocialMediaFeaturePage() {
  return (
    <>
      <Head>
        <title>Social Media Scheduler — GR8 RESULT | Plan it Monday. Post it all month.</title>
        <meta name="description" content="Schedule across 8+ platforms, AI captions, bulk scheduling, and analytics. One dashboard for every channel." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Social →" ctaHref="/modules/social_media/dashboard" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>📱 Social Media</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Plan it Monday.<br /><span style={{ color: A }}>Post it all month.</span><br />Done.
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Schedule across 8 platforms in one sitting. AI writes your captions. Analytics show what's working. You spend 2 hours a month on social media — and it looks like you're always online.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/social_media/dashboard" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Start scheduling →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><SocialDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["8+","Platforms connected and posting"],["2hrs","Per month to run a full social presence"],["10×","More content output vs. manual posting"],["0","Times you forget to post"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>One week of scheduling.<br />A month of presence.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Stop being the business that posts twice and disappears. Show up consistently on every platform without it consuming your life.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your next month of posts,<br />done in one session.</h2>
        <Link href="/modules/social_media/dashboard" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Connect my platforms →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Included in all plans.</div>
      </section>
    </>
  );
}
