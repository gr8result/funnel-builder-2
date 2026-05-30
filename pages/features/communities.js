import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect, useRef } from "react";

const A = "#8b5cf6";

const FEED = [
  { name: "Sarah M.", avatar: "SM", color: "#6366f1", time: "just now", msg: "Just finished the advanced module — the section on positioning alone was worth the entire price. 🔥" },
  { name: "James K.", avatar: "JK", color: "#06b6d4", time: "2m ago", msg: "Anyone else use the email script from last week? Got 14 replies from a list of 200. That's insane." },
  { name: "Priya R.", avatar: "PR", color: "#10b981", time: "4m ago", msg: "Quick tip: pair the booking calendar with a community welcome sequence. Doubled my show-up rate." },
  { name: "Tom H.", avatar: "TH", color: "#f59e0b", time: "6m ago", msg: "6 months in, up from $0 to $14k/month. This community was the difference. Genuinely." },
  { name: "Lisa W.", avatar: "LW", color: "#ec4899", time: "9m ago", msg: "The Q&A this morning was gold. @admin can we get a replay pinned?" },
];

function CommunityDemo() {
  const [visible, setVisible] = useState([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (idx >= FEED.length) {
      const t = setTimeout(() => { setVisible([]); setIdx(0); }, 3000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisible(p => [...p, FEED[idx]]);
      setIdx(i => i + 1);
    }, idx === 0 ? 600 : 1400);
    return () => clearTimeout(t);
  }, [idx]);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [visible]);

  return (
    <div style={{ width: "100%", maxWidth: 480, background: "#060e18", border: `1px solid ${A}33`, borderRadius: 20, overflow: "hidden", boxShadow: `0 0 80px ${A}18` }}>
      <div style={{ background: `linear-gradient(135deg, ${A}20, #0c1020)`, padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${A}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏆</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Growth Operators</div>
          <div style={{ fontSize: 12, color: "#475569" }}>2,841 members · 12 online now</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, background: "#0b1f0e", border: "1px solid #16a34a33", color: "#4ade80", borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}>● Live</div>
      </div>

      <div ref={ref} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14, minHeight: 340, maxHeight: 380, overflowY: "auto" }}>
        {visible.map((post, i) => (
          <div key={i} style={{ display: "flex", gap: 12, animation: "fadeSlide 0.4s ease" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: post.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{post.avatar}</div>
            <div style={{ background: "#0c1524", borderRadius: 12, borderTopLeftRadius: 4, padding: "12px 14px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{post.name}</span>
                <span style={{ fontSize: 11, color: "#334155" }}>{post.time}</span>
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{post.msg}</p>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#334155", cursor: "pointer" }}>❤️ Like</span>
                <span style={{ fontSize: 12, color: "#334155", cursor: "pointer" }}>💬 Reply</span>
              </div>
            </div>
          </div>
        ))}
        {visible.length < FEED.length && (
          <div style={{ display: "flex", gap: 6, paddingLeft: 50, alignItems: "center" }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e293b", display: "inline-block", animation: `dot 1.2s ease infinite ${i * 0.2}s` }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const FEATS = [
  { i: "🏘️", t: "Public & private communities", b: "Run a free community to build your audience, and a paid members-only space for premium access. Both under your brand." },
  { i: "💬", t: "Topic channels", b: "Organise discussions into channels — just like Slack or Discord, but you own it and the data stays yours." },
  { i: "📝", t: "Rich posts & media", b: "Long-form posts, images, videos, polls, embeds — members can create proper content, not just text replies." },
  { i: "🛡️", t: "Moderation tools", b: "Approve posts, remove members, pin announcements, set posting rules. Your community stays clean and on-brand." },
  { i: "💰", t: "Paid membership gating", b: "Charge monthly or yearly for access to your private community. Stripe payment, automatic access granted." },
  { i: "🔔", t: "Notifications & digest", b: "Members stay engaged with smart notifications. Weekly digest emails keep the community front of mind." },
];

export default function CommunitiesFeaturePage() {
  return (
    <>
      <Head>
        <title>Communities — GR8 RESULT | Turn customers into a loyal tribe</title>
        <meta name="description" content="Public and private communities under your brand. Topic channels, rich posts, moderation, paid memberships." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes dot{0%,80%,100%{opacity:0.3}40%{opacity:1}}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Communities →" ctaHref="/modules/communities" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>👥 Communities</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Turn customers<br />into a tribe that<br /><span style={{ color: A }}>stays forever.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Build a thriving community under your own brand. Public to grow your audience. Private to monetise it. Everything Facebook Groups promised — without giving Zuckerberg your members.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/communities" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Create my community →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><CommunityDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["40%","Higher engagement vs. social media groups"],["100%","You own the data — not Facebook"],["$0","Cost to run a free community indefinitely"],["Paid","Member gating built in — charge monthly"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Your community.<br />Your rules. Your data.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Facebook can change the algorithm tomorrow. You'd lose your reach overnight. Your own community can't be taken from you.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your audience deserves<br />a better home.</h2>
        <Link href="/modules/communities" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Launch my community →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Free community included in all plans.</div>
      </section>
    </>
  );
}
