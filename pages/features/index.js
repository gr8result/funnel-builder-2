import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";

const MODULES = [
  {
    slug: "website-builder",
    emoji: "🌐",
    name: "Website Builder",
    tagline: "AI builds your site in 60 seconds.",
    body: "Full website, real blocks, your brand. Describe what you need and watch it appear. No designer required.",
    accent: "#6366f1",
    stat: "61s to full site",
  },
  {
    slug: "funnels",
    emoji: "🚀",
    name: "Sales Funnels",
    tagline: "Build funnels that sell 24/7.",
    body: "Drag & drop funnel builder with AI copy, Stripe checkout, and email automation. Your best salesperson never calls in sick.",
    accent: "#f59e0b",
    stat: "3.2× conversion lift",
  },
  {
    slug: "calendar",
    emoji: "📅",
    name: "Booking Calendar",
    tagline: "Bookings arrive while you sleep.",
    body: "Client self-booking, automated reminders, payments at the point of reservation. 80% fewer no-shows.",
    accent: "#06b6d4",
    stat: "80% fewer no-shows",
  },
  {
    slug: "social-media",
    emoji: "📱",
    name: "Social Media",
    tagline: "Plan it Monday. Post it all month.",
    body: "Schedule across 8 platforms, AI-generated captions, bulk upload, and analytics — in 2 hours a month.",
    accent: "#f97316",
    stat: "8+ platforms, 1 dashboard",
  },
  {
    slug: "marketplace",
    emoji: "🏪",
    name: "Marketplace",
    tagline: "Sell anything. Keep every dollar.",
    body: "Digital products, physical goods, built-in affiliate program, Stripe checkout — zero platform fees.",
    accent: "#10b981",
    stat: "$0 transaction fees",
  },
  {
    slug: "communities",
    emoji: "👥",
    name: "Communities",
    tagline: "Turn customers into a loyal tribe.",
    body: "Public & private communities under your brand. Topic channels, paid memberships, and moderation tools — you own the data.",
    accent: "#8b5cf6",
    stat: "40% higher engagement",
  },
  {
    slug: "gantt-charts",
    emoji: "📊",
    name: "Gantt Charts",
    tagline: "Every project on time.",
    body: "Visual project timelines, task dependencies, team assignments, and mobile progress updates. No spreadsheet nightmares.",
    accent: "#3b82f6",
    stat: "40+ stage types",
  },
  {
    slug: "job-tracker",
    emoji: "🔧",
    name: "Job Tracker",
    tagline: "Every job tracked. Zero missed invoices.",
    body: "Kanban pipeline for service businesses. Quote to payment, all in one place. Cards auto-move as jobs progress.",
    accent: "#ef4444",
    stat: "0 missed invoices",
  },
  {
    slug: "landing-pages",
    emoji: "🎯",
    name: "Landing Pages",
    tagline: "Pages that convert, not just look nice.",
    body: "40+ conversion-optimised templates, A/B testing, custom domains, heatmaps, and <2s mobile load times.",
    accent: "#ec4899",
    stat: "5.4× conversion lift",
  },
];

function ModuleCard({ m }) {
  return (
    <Link href={`/features/${m.slug}`} style={{ display: "block", textDecoration: "none" }}>
      <div className="module-card" style={{
        background: "#0a1120", border: `1px solid #1e293b`, borderRadius: 20, padding: "28px 24px", height: "100%",
        transition: "all 0.22s", cursor: "pointer", position: "relative", overflow: "hidden",
      }}
        onMouseEnter={e => {
          e.currentTarget.style.border = `1px solid ${m.accent}55`;
          e.currentTarget.style.boxShadow = `0 0 44px ${m.accent}18`;
          e.currentTarget.style.transform = "translateY(-3px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = "1px solid #1e293b";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{m.emoji}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: m.accent, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>{m.stat}</div>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.01em" }}>{m.name}</h3>
        <p style={{ fontSize: 14, color: "#64748b", fontStyle: "italic", marginBottom: 12, fontWeight: 600 }}>{m.tagline}</p>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.65 }}>{m.body}</p>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: m.accent, fontWeight: 700 }}>
          Explore {m.name} <span>→</span>
        </div>
      </div>
    </Link>
  );
}

export default function FeaturesIndexPage() {
  return (
    <>
      <Head>
        <title>Features — GR8 RESULT | Everything your business needs in one place</title>
        <meta name="description" content="Website builder, funnels, booking calendar, social media, marketplace, communities, Gantt charts, job tracker, landing pages. All in one subscription." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}`}</style>

      <FeaturesNav cta="Get started free →" ctaHref="/signup" />

      {/* Hero */}
      <section style={{ padding: "100px 32px 72px", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#6366f118", border: "1px solid #6366f144", borderRadius: 100, padding: "6px 16px", marginBottom: 32, fontSize: 13, fontWeight: 700, color: "#6366f1", letterSpacing: "0.06em", textTransform: "uppercase" }}>All features</div>
        <h1 style={{ fontSize: "clamp(40px,6vw,76px)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.04em", marginBottom: 28 }}>
          Everything your business<br />needs. <span style={{ color: "#6366f1" }}>One subscription.</span>
        </h1>
        <p style={{ fontSize: "clamp(17px,2vw,21px)", color: "#64748b", lineHeight: 1.75, maxWidth: 620, margin: "0 auto 48px" }}>
          Nine powerful modules — website builder, funnels, calendar, social, marketplace, communities, project management, job tracking, and landing pages — all connected, all included.
        </p>
        <Link href="/signup" style={{ background: "#6366f1", color: "#fff", padding: "18px 48px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: "0 18px 54px #6366f144", display: "inline-block", marginBottom: 16 }}>Start for free →</Link>
        <div style={{ fontSize: 13, color: "#334155" }}>No credit card required. All modules unlocked from day one.</div>
      </section>

      {/* Module grid */}
      <section style={{ padding: "0 32px 100px", maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
          {MODULES.map(m => <ModuleCard key={m.slug} m={m} />)}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: "80px 32px 100px", textAlign: "center", background: "radial-gradient(ellipse 80% 60% at 50% 50%, #6366f112 0%, transparent 70%)", borderTop: "1px solid #1e293b" }}>
        <h2 style={{ fontSize: "clamp(28px,3.5vw,52px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>
          Replace 9 subscriptions<br />with one.
        </h2>
        <p style={{ fontSize: 18, color: "#475569", marginBottom: 40, maxWidth: 500, margin: "0 auto 40px", lineHeight: 1.65 }}>Stop paying separately for website builders, scheduling tools, social media platforms, and project management software. It's all here.</p>
        <Link href="/signup" style={{ background: "#6366f1", color: "#fff", padding: "18px 48px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: "0 18px 54px #6366f144", display: "inline-block" }}>Get started free →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Cancel any time. No lock-in. All 9 modules included.</div>
      </section>
    </>
  );
}
