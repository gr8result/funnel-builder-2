// /pages/dashboard.js
// Workspace Builder — strategic overview with module active/inactive status

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabase-client";

const DASHBOARD_MODULE_ALIASES = {
  crm: "crm",
  email: "email_marketing",
  email_marketing: "email_marketing",
  sms: "sms_marketing",
  sms_marketing: "sms_marketing",
  social: "social_media",
  social_media: "social_media",
  calendar: "booking_calendar",
  booking_calendar: "booking_calendar",
  "website-builder": "website_builder",
  website_builder: "website_builder",
  automation: "business_automation",
  business_automation: "business_automation",
  webinars: "evergreen_webinars",
  evergreen_webinars: "evergreen_webinars",
  subscription: "pipelines",
  pipelines: "pipelines",
  funnels: "funnels",
  affiliates: "affiliate_management",
  affiliate_management: "affiliate_management",
};

function normalizeDashboardModuleId(moduleId) {
  return DASHBOARD_MODULE_ALIASES[moduleId] || moduleId;
}

// Light-background colours that need dark text
const LIGHT_COLORS = new Set(["#facc15", "#84cc16", "#0df118", "#a3e635", "#fbbf24"]);
function textFor(color) { return LIGHT_COLORS.has(color) ? "#0f172a" : "#ffffff"; }

// ─── Core platform items (always available, no billing gate) ─────────────────
const CORE_ITEMS = [
  {
    id: "core_todo",
    title: "Priority To-Do",
    emoji: "📌",
    desc: "Tasks, orders & revenue overview",
    color: "#22c55e",
    href: "/store/dashboard",
  },
  {
    id: "core_marketplace",
    title: "Xchange Marketplace",
    emoji: "🛍️",
    desc: "Browse and manage marketplace offers",
    color: "#0ea5e9",
    href: "/marketplace",
  },
  {
    id: "core_vendor_dashboard",
    title: "Vendors Dashboard",
    emoji: "🏪",
    desc: "Manage your vendor business in Xchange",
    color: "#22c55e",
    href: "/modules/vendor",
  },
  {
    id: "affiliate_management",
    title: "Affiliate Management",
    emoji: "🤝",
    desc: "Xchange: manage affiliate programs",
    color: "#06a9db",
    href: "/modules/affiliates",
    countTable: "affiliate_products",
    activityLabel: "product",
  },
  {
    id: "digital_products",
    title: "Digital Products",
    emoji: "💾",
    desc: "Xchange: sell digital downloads",
    color: "#ec4899",
    href: "/modules/vendor",
    activityLabel: "product",
  },
  {
    id: "physical_products",
    title: "Physical Products",
    emoji: "📦",
    desc: "Xchange: sell physical products",
    color: "#3b82f6",
    href: "/modules/vendor/physical",
    activityLabel: "product",
  },
  {
    id: "online_courses",
    title: "Online Courses",
    emoji: "🎓",
    desc: "Xchange: create and sell courses",
    color: "#10b981",
    href: "/modules/vendor/courses",
    countTable: "course_vendors",
    activityLabel: "course",
  },
  {
    id: "core_assets",
    title: "Media Library",
    emoji: "🖼️",
    desc: "Manage uploaded media assets",
    color: "#6366f1",
    href: "/assets",
  },
  {
    id: "core_leads",
    title: "Leads",
    emoji: "📥",
    desc: "Track and manage your leads",
    color: "#f43f5e",
    href: "/leads",
    countTable: "leads",
    activityLabel: "lead",
  },
  {
    id: "core_account",
    title: "Account",
    emoji: "⚙️",
    desc: "View and update your account settings",
    color: "#8b5cf6",
    href: "/account",
  },
  {
    id: "core_billing",
    title: "Billing & Modules",
    emoji: "🧾",
    desc: "Manage subscriptions and activate modules",
    color: "#f59e0b",
    href: "/billing",
  },
  {
    id: "communities",
    title: "Communities",
    emoji: "👥",
    desc: "Build and manage member communities",
    color: "#14b8a6",
    href: "/modules/communities",
  },
  {
    id: "core_accounting",
    title: "Accounting",
    emoji: "📊",
    desc: "Manage your accounts and finances",
    color: "#0ea5e9",
    href: "/modules/accounting",
  },
];

// ─── Gated modules (require billing activation) ───────────────────────────────
const MODULE_ITEMS = [
  {
    id: "email_marketing",
    title: "Email Marketing",
    emoji: "📧",
    desc: "Broadcasts, autoresponders, lists",
    color: "#facc15",
    href: "/modules/email",
    countTable: "email_lists",
    activityLabel: "list",
  },
  {
    id: "crm",
    title: "CRM",
    emoji: "🗂️",
    desc: "Manage contacts and customer records",
    color: "#ec4899",
    href: "/modules/email/crm",
  },
  {
    id: "sms_marketing",
    title: "SMS Marketing",
    emoji: "💬",
    desc: "Send SMS campaigns and alerts",
    color: "#06b6d4",
    href: "/modules/email/crm/sms-dashboard",
    countTable: "sms_messages",
    activityLabel: "message",
    planKey: "sms",
  },
  {
    id: "social_media",
    title: "Social Media",
    emoji: "📱",
    desc: "Schedule and manage social posts",
    color: "#8126e9",
    href: "/modules/social_media/dashboard",
    countTable: "social_posts",
    activityLabel: "post",
    planKey: "social",
  },
  {
    id: "booking_calendar",
    title: "Booking Calendar",
    emoji: "📅",
    desc: "Scheduling and appointment booking",
    color: "#84cc16",
    href: "/modules/calendar/dashboard",
    planKey: "calendar",
  },
  {
    id: "website_builder",
    title: "Website Builder",
    emoji: "🌐",
    desc: "Drag & drop website builder",
    color: "#2d5dc3",
    href: "/modules/website-builder",
    lsKey: "website_projects",
    activityLabel: "project",
  },
  {
    id: "funnels",
    title: "Sales Funnels",
    emoji: "🧱",
    desc: "Build and manage sales funnels",
    color: "#ef465d",
    href: "/funnels",
    countTable: "funnels",
    activityLabel: "funnel",
  },
  {
    id: "business_automation",
    title: "Business Automation",
    emoji: "⚙️",
    desc: "Automate workflows and triggers",
    color: "#fb923c",
    href: "/modules/business-automation",
    countTable: "email_automations",
    activityLabel: "automation",
  },
  {
    id: "evergreen_webinars",
    title: "Evergreen Webinars",
    emoji: "🎥",
    desc: "Automated webinar funnels",
    color: "#ef4444",
    href: "/modules/webinars",
  },
  {
    id: "pipelines",
    title: "Subscription Pipelines",
    emoji: "🌿",
    desc: "Track subscriptions and deal flow",
    color: "#7c3aed",
    href: "/modules/pipelines",
  },
];

// ─── Solid colour card ────────────────────────────────────────────────────────
function SolidCard({ item, active, count, coreCard }) {
  const hasCount = typeof count === "number" && count > 0;
  const activityText = hasCount && item.activityLabel
    ? `${count} ${item.activityLabel}${count !== 1 ? "s" : ""}`
    : null;
  const fg = textFor(item.color);

  // Inactive module cards: dark with coloured border
  if (!coreCard && !active) {
    return (
      <div style={{
        background: "#0d1522",
        border: `2px solid ${item.color}44`,
        borderRadius: 14,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 12, right: 12,
          fontSize: 16, fontWeight: 600, padding: "3px 10px",
          borderRadius: 20, background: "rgba(69,10,10,0.9)",
          color: "#f87171", whiteSpace: "nowrap", userSelect: "none",
        }}>
          ✕ Not set up
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingRight: 90 }}>
          <div style={{
            fontSize: 22, width: 44, height: 44, display: "grid",
            placeItems: "center", background: item.color + "18",
            border: `1px solid ${item.color}33`, borderRadius: 10, flexShrink: 0,
          }}>
            {item.emoji}
          </div>
          <div style={{ fontWeight: 600, fontSize: 18, color: "#64748b", lineHeight: 1.3 }}>
            {item.title}
          </div>
        </div>
        <div style={{ fontSize: 16, color: "#3c82e4", lineHeight: 1.4 }}>{item.desc}</div>
        <Link href="/billing">
          <span style={{
            display: "inline-block", fontSize: 16, fontWeight: 600,
            padding: "7px 15px", borderRadius: 8,
            background: "rgba(69,10,10,0.6)", color: "#f87171",
            border: "1px solid rgba(127,29,29,0.7)",
            cursor: "pointer", textDecoration: "none",
          }}>
            Start Setup →
          </span>
        </Link>
      </div>
    );
  }

  // Active / core cards: full solid colour
  return (
    <Link href={item.href} style={{ textDecoration: "none" }}>
      <div style={{
        background: item.color,
        borderRadius: 14,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        cursor: "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 8px 28px ${item.color}55`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        {/* Active pill for gated modules */}
        {!coreCard && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            fontSize: 16, fontWeight: 600, padding: "3px 10px",
            borderRadius: 20, background: "rgba(0,0,0,0.25)",
            color: fg, whiteSpace: "nowrap", userSelect: "none",
          }}>
            ● Active
          </div>
        )}

        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingRight: coreCard ? 0 : 74 }}>
          <div style={{
            fontSize: 22, width: 44, height: 44, display: "grid",
            placeItems: "center", background: "rgba(0,0,0,0.18)",
            borderRadius: 10, flexShrink: 0,
          }}>
            {item.emoji}
          </div>
          <div style={{ fontWeight: 600, fontSize: 18, color: fg, lineHeight: 1.25 }}>
            {item.title}
          </div>
        </div>

        {/* Activity count or desc */}
        <div style={{ fontSize: 16, color: fg, opacity: activityText ? 1 : 0.78, fontWeight: activityText ? 600 : 400, lineHeight: 1.4, minHeight: 18 }}>
          {activityText ?? item.desc}
        </div>

        {/* CTA */}
        <div style={{
          display: "inline-block", alignSelf: "flex-start",
          fontSize: 16, fontWeight: 600,
          padding: "6px 14px", borderRadius: 8,
          background: "rgba(0,0,0,0.22)", color: fg,
          border: `1px solid rgba(0,0,0,0.18)`,
        }}>
          Manage →
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton (loading) ───────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: "#0d1522", border: "2px solid #1e2d42",
      borderRadius: 14, padding: "18px 18px 16px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1a2540" }} />
        <div style={{ height: 15, width: "52%", borderRadius: 6, background: "#1a2540" }} />
      </div>
      <div style={{ height: 13, width: "70%", borderRadius: 4, background: "#1a2540" }} />
      <div style={{ height: 30, width: 100, borderRadius: 8, background: "#1a2540" }} />
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionLabel({ label, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: "#e7be08" }}>{label}</h2>
      {note && (
        <span style={{ fontSize: 16, color: "#4586e1", fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase" }}>
          {note}
        </span>
      )}
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeModules, setActiveModules] = useState(new Set());
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) { setLoading(false); return; }

        const [{ data: moduleRows }, { data: acc }] = await Promise.all([
          supabase.from("user_modules").select("module_id").eq("user_id", uid),
          supabase.from("accounts")
            .select("sms_plan_tier, calendar_plan_tier, email_plan_tier")
            .eq("user_id", uid)
            .maybeSingle(),
        ]);

        const active = new Set(
          (moduleRows || [])
            .map((r) => normalizeDashboardModuleId(r.module_id))
            .filter((id) => id && !id.startsWith("__"))
        );
        if (acc?.sms_plan_tier)      active.add("sms_marketing");
        if (acc?.calendar_plan_tier) active.add("booking_calendar");
        if (acc?.email_plan_tier)    active.add("email_marketing");
        if ((moduleRows || []).some(r => r.module_id?.startsWith("__social_plan_tier:"))) {
          active.add("social_media");
        }
        setActiveModules(active);

        const countables = [...CORE_ITEMS, ...MODULE_ITEMS].filter(m => m.countTable);
        const results = await Promise.all(
          countables.map(m =>
            supabase
              .from(m.countTable)
              .select("id", { count: "exact", head: true })
              .eq("user_id", uid)
              .then(({ count }) => ({ id: m.id, n: count ?? 0 }))
              .catch(() => ({ id: m.id, n: 0 }))
          )
        );
        const cm = {};
        results.forEach(r => { cm[r.id] = r.n; });

        try {
          const projs = JSON.parse(localStorage.getItem("website_projects") || "[]");
          cm["website_builder"] = Array.isArray(projs) ? projs.length : 0;
        } catch { cm["website_builder"] = 0; }

        setCounts(cm);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, []);

  const activeCount = activeModules.size;
  const hasInactive = !loading && MODULE_ITEMS.some(m => !activeModules.has(m.id));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px 56px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>

      {/* Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        padding: "28px 32px",
        borderRadius: 16,
        marginBottom: 38,
        width: "100%",
        maxWidth: 1320,
        boxShadow: "0 6px 36px rgba(34,197,94,0.28)",
      }}>
        <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: "50%", padding: 12, flexShrink: 0, fontSize: 48 }}>
          🧩
        </div>
        <div>
          <h1 style={{
            fontSize: 48,
            fontWeight: 600,
            margin: 0,
            lineHeight: 1,
            letterSpacing: "-1.5px",
            color: "#fff",
          }}>
            Main Navigation Dashboard
          </h1>
          <p style={{ margin: "10px 0 0", opacity: 0.88, fontSize: 18, fontWeight: 600, color: "#fff" }}>
            {loading
              ? "Loading your modules…"
              : `${activeCount} module${activeCount !== 1 ? "s" : ""} active — click any card to open or activate`}
          </p>
        </div>
      </div>

      {/* Core Platform */}
      <div style={{ width: "100%", maxWidth: 1320, marginBottom: 40 }}>
        <SectionLabel label="Core Platform" note="Always included" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {CORE_ITEMS.map(item => (
            <SolidCard key={item.id} item={item} active coreCard count={counts[item.id]} />
          ))}
        </div>
      </div>

      {/* Gated Modules */}
      <div style={{ width: "100%", maxWidth: 1320 }}>
        <SectionLabel label="Your Modules" note="Activate via Billing & Modules" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {loading
            ? MODULE_ITEMS.map(m => <SkeletonCard key={m.id} />)
            : MODULE_ITEMS.map(item => (
                <SolidCard
                  key={item.id}
                  item={item}
                  active={activeModules.has(item.id)}
                  count={counts[item.id]}
                />
              ))
          }
        </div>
      </div>

      {/* Billing CTA */}
      {hasInactive && (
        <div style={{
          width: "100%",
          maxWidth: 1320,
          marginTop: 32,
          background: "linear-gradient(135deg, #111a2a, #0d1522)",
          border: "1px solid #1e2d42",
          borderRadius: 14,
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 20, color: "#f1f5f9" }}>Unlock more modules</div>
            <div style={{ fontSize: 18, color: "#4f94f4", marginTop: 4 }}>
              Activate modules from Billing & Modules to expand your workspace.
            </div>
          </div>
          <Link href="/billing">
            <span style={{
              display: "inline-block", fontSize: 18, fontWeight: 600,
              padding: "11px 24px", borderRadius: 10,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff", cursor: "pointer", textDecoration: "none",
            }}>
              Manage Billing →
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
