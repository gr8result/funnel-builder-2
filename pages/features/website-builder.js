import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect, useRef } from "react";

const A = "#6366f1";
const SCRIPT = [
  { k: "sys",  t: "GR8 RESULT AI Builder v3 — ready" },
  { k: "ask",  t: 'Brief: "Premium Roofing Co, Sydney NSW"' },
  { k: "out",  t: "✓ Industry: Construction & Trade Services" },
  { k: "ask",  t: "Generating brand voice..." },
  { k: "out",  t: "✓ Tone: Bold, trustworthy, no-nonsense" },
  { k: "ask",  t: "Writing hero headline..." },
  { k: "out",  t: '✓ "Roofs built to last. Quotes you\'ll understand."' },
  { k: "ask",  t: "Selecting colour palette..." },
  { k: "out",  t: "✓ Slate navy · Safety orange · Crisp white" },
  { k: "ask",  t: "Mapping page structure..." },
  { k: "out",  t: "✓ 7 pages: Home · Services · Gallery · Reviews · FAQ · About · Contact" },
  { k: "ask",  t: "Embedding SEO across all pages..." },
  { k: "out",  t: "✓ Keywords, meta, schema, Open Graph — done" },
  { k: "ask",  t: "Generating 40+ section blocks..." },
  { k: "done", t: "🚀 Site is live-ready.  Total time: 61 seconds." },
];

function TerminalDemo() {
  const [lines, setLines] = useState([]);
  const [typing, setTyping] = useState("");
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => { setLines([]); setTyping(""); setIdx(0); setDone(false); }, 3500);
      return () => clearTimeout(t);
    }
    if (idx >= SCRIPT.length) { setDone(true); return; }
    const e = SCRIPT[idx];
    if (e.k === "ask") {
      let c = 0; setTyping("");
      const iv = setInterval(() => {
        c++; setTyping(e.t.slice(0, c));
        if (c >= e.t.length) {
          clearInterval(iv);
          setLines(p => [...p, e]); setTyping("");
          setTimeout(() => setIdx(i => i + 1), 160);
        }
      }, 26);
      return () => clearInterval(iv);
    } else {
      setLines(p => [...p, e]);
      const t = setTimeout(() => setIdx(i => i + 1), e.k === "done" ? 700 : e.k === "sys" ? 500 : 280);
      return () => clearTimeout(t);
    }
  }, [idx, done]);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);

  const col = (k) => ({ sys: "#475569", ask: "#e2e8f0", out: "#86efac", done: "#fbbf24" })[k] || "#e2e8f0";

  return (
    <div style={{ background: "#060c16", border: `1px solid ${A}44`, borderRadius: 16, overflow: "hidden", fontFamily: "'SF Mono','Fira Code',monospace", width: "100%", maxWidth: 560, boxShadow: `0 0 80px ${A}20` }}>
      <div style={{ background: "#0d1424", padding: "10px 16px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid #1e293b" }}>
        {["#ef4444","#f59e0b","#22c55e"].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, display: "inline-block" }} />)}
        <span style={{ marginLeft: 10, fontSize: 12, color: "#475569" }}>ai-builder — zsh</span>
      </div>
      <div ref={ref} style={{ padding: "20px 22px", minHeight: 320, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.65, color: col(l.k) }}>
            {l.k !== "sys" && <span style={{ color: "#334155", marginRight: 8 }}>{l.k === "done" ? "›" : l.k === "out" ? "  " : "$"}</span>}
            {l.t}
          </div>
        ))}
        {typing && (
          <div style={{ fontSize: 13, lineHeight: 1.65, color: "#e2e8f0" }}>
            <span style={{ color: "#334155", marginRight: 8 }}>$</span>{typing}
            <span style={{ display: "inline-block", width: 2, height: 14, background: A, marginLeft: 2, verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />
          </div>
        )}
      </div>
    </div>
  );
}

const FEATS = [
  { i: "✨", t: "AI writes everything", b: "Real copy for your specific business — headline, services, about page, FAQ, CTAs — not filler templates." },
  { i: "🎨", t: "Industry-matched design", b: "Fonts, colours, layout personality chosen to match your trade. A law firm looks nothing like a gym." },
  { i: "🧩", t: "40+ drag & drop blocks", b: "Hero, gallery, testimonials, pricing, FAQ, video, countdown, maps — add or remove in seconds." },
  { i: "🌐", t: "Custom domain, one click", b: "Connect your domain and go live. SSL included. Your site is at yourbusiness.com in minutes." },
  { i: "📈", t: "SEO baked in from day one", b: "Meta titles, descriptions, schema, Open Graph, sitemap, image alt text — all generated automatically." },
  { i: "📱", t: "Flawless on every screen", b: "Every block is mobile-responsive by default. Looks perfect on iPhone, tablet, or 27-inch desktop." },
];

export default function WebsiteBuilderFeaturePage() {
  return (
    <>
      <Head>
        <title>Website Builder — GR8 RESULT | AI builds your full site in 61 seconds</title>
        <meta name="description" content="Answer 5 questions. AI generates real copy, picks your design, maps your pages, and publishes your site live. No designer needed." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Builder →" ctaHref="/modules/website-builder" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>🌐 Website Builder</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,64px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Your website,<br /><span style={{ color: A }}>built by AI</span><br />in 61 seconds.
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 460 }}>Answer 5 questions. AI generates the copy, picks the design, builds the pages, and publishes. No designer. No developer. No excuses.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/website-builder/new" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Build my site — free →</Link>
              <Link href="/modules/website-builder" style={{ color: "#94a3b8", padding: "15px 24px", borderRadius: 12, fontSize: 16, fontWeight: 600, border: "1px solid #1e293b", display: "inline-block" }}>View live example</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><TerminalDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["61s","To a full, published website"],["40+","Drag & drop section blocks"],["100%","Mobile-responsive every time"],["0","Design skills required"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: A, marginBottom: 16 }}>What you get</div>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Not a template library.<br />A finished website.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Other builders hand you blank pages. This one builds a complete site for your actual business — copy included.</p>
        </div>
        <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 24 }}>
          {FEATS.map(f => (
            <div key={f.t} style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 16, padding: "28px 24px", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 34, marginBottom: 16 }}>{f.i}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{f.t}</h3>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 32px 100px", textAlign: "center", background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${A}14 0%, transparent 70%)` }}>
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your site should already be live.</h2>
        <p style={{ fontSize: 18, color: "#475569", marginBottom: 40 }}>61 seconds from now, you could have a complete website.</p>
        <Link href="/modules/website-builder/new" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Start building — it's free →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>No credit card required.</div>
      </section>
    </>
  );
}
