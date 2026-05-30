import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const MODULES = [
  { slug: "website-builder", emoji: "🌐", name: "Website Builder", accent: "#6366f1" },
  { slug: "funnels",         emoji: "🚀", name: "Sales Funnels",   accent: "#f59e0b" },
  { slug: "calendar",        emoji: "📅", name: "Booking Calendar",accent: "#06b6d4" },
  { slug: "social-media",    emoji: "📱", name: "Social Media",    accent: "#f97316" },
  { slug: "marketplace",     emoji: "🏪", name: "Marketplace",     accent: "#10b981" },
  { slug: "communities",     emoji: "👥", name: "Communities",     accent: "#8b5cf6" },
  { slug: "gantt-charts",    emoji: "📊", name: "Gantt Charts",    accent: "#3b82f6" },
  { slug: "job-tracker",     emoji: "🔧", name: "Job Tracker",     accent: "#ef4444" },
  { slug: "landing-pages",   emoji: "🎯", name: "Landing Pages",   accent: "#ec4899" },
];

export default function FeaturesNav({ cta, ctaHref }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <style>{`
        .fn-dropdown{
          position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%);
          background:#080f1c;border:1px solid #1e293b;border-radius:16px;
          padding:12px;width:560px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;
          box-shadow:0 24px 64px rgba(0,0,0,0.6);z-index:200;
        }
        .fn-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 0.15s;text-decoration:none;}
        .fn-item:hover{background:#0c1830;}
        .fn-chevron{display:inline-block;transition:transform 0.2s;margin-left:4px;font-size:11px;color:#475569;}
        .fn-chevron.open{transform:rotate(180deg);}
        @media(max-width:640px){.fn-dropdown{width:calc(100vw - 32px);left:0;transform:none;grid-template-columns:1fr 1fr;}}
      `}</style>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,12,22,0.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid #1e293b", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <Link href="/" style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", textDecoration: "none" }}>GR8 RESULT</Link>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Modules dropdown trigger */}
          <div ref={ref} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: open ? "#f1f5f9" : "#94a3b8", transition: "color 0.15s" }}
            >
              Modules
              <span className={`fn-chevron${open ? " open" : ""}`}>▾</span>
            </button>

            {open && (
              <div className="fn-dropdown">
                {MODULES.map(m => (
                  <Link key={m.slug} href={`/features/${m.slug}`} className="fn-item" onClick={() => setOpen(false)}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{m.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{m.name}</span>
                  </Link>
                ))}
                <Link href="/features" className="fn-item" onClick={() => setOpen(false)} style={{ gridColumn: "1/-1", borderTop: "1px solid #1e293b", marginTop: 4, paddingTop: 12, justifyContent: "center" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>View all features →</span>
                </Link>
              </div>
            )}
          </div>

          <Link href="/pricing" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 600, color: "#64748b", textDecoration: "none" }}>Pricing</Link>

          {cta && ctaHref && (
            <Link href={ctaHref} style={{ background: "#6366f1", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", marginLeft: 8 }}>{cta}</Link>
          )}
        </div>
      </nav>
    </>
  );
}
