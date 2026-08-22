// /pages/dashboard.js
// Workspace Builder — strategic overview with module active/inactive status

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabase-client";
import { useWorkspace } from "../hooks/useWorkspace";
import ICONS from "../components/iconMap";
import {
  MODULE_STATE,
  buildEntitledModuleIds,
  buildSubscriptionSummary,
  moduleSetupLabel,
  readBillingCycle,
  resolveModuleState,
} from "../lib/moduleEntitlements";


// Light-background colours that need dark text
const LIGHT_COLORS = new Set(["#facc15", "#84cc16", "#0df118", "#a3e635", "#fbbf24"]);
function textFor(color) { return LIGHT_COLORS.has(color) ? "#0f172a" : "#ffffff"; }

// ─── Core platform items (always available, no billing gate) ─────────────────
const CORE_ITEMS = [
  {
    id: "core_todo",
    title: "Command Centre",
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
    id: "core_team",
    title: "Team Members",
    emoji: "👥",
    desc: "Manage workspace members and permissions",
    color: "#f97316",
    href: "/modules/email/crm/teams",
  },
  {
    id: "core_billing",
    title: "Pricing & Billing",
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
  {
    id: "construction",
    title: "Project Workspace",
    emoji: "🗂️",
    desc: "Job Board and work schedules — suits any industry",
    color: "#f97316",
    href: "/modules/construction",
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
    icon: ICONS.funnels,

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
    comingSoon: true,
  },
  {
    id: "pipelines",
    title: "Subscription Pipelines",
    emoji: "🌿",
    desc: "Track subscriptions and deal flow",
    color: "#7c3aed",
    href: "/modules/pipelines",
    comingSoon: true,
  },
  {
    id: "human_resources",
    title: "Human Resources",
    emoji: "👨\u200d💼",
    desc: "Employee management and HR workflows",
    color: "#3b82f6",
    href: "/modules/hr",
    comingSoon: true,
  },
];

// ─── Solid colour card ────────────────────────────────────────────────────────
function SolidCard({ item, state = MODULE_STATE.NOT_INCLUDED, count, coreCard }) {
  const active = coreCard || state === MODULE_STATE.READY;
  const hasCount = typeof count === "number" && count > 0;
  const activityText = hasCount && item.activityLabel
    ? `${count} ${item.activityLabel}${count !== 1 ? "s" : ""}`
    : null;
  const fg = textFor(item.color);

  // Coming soon modules: always show as greyed-out / coming soon
  if (state === MODULE_STATE.COMING_SOON) {
    return (
      <Link href={item.href} style={{ textDecoration: "none" }}>
        <div style={{
          background: "#0d1522",
          border: "2px solid #1e293b",
          borderRadius: 14,
          padding: "18px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
          opacity: 0.72,
          cursor: "pointer",
          transition: "opacity 0.15s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "0.72"; }}
        >
          <div style={{
            position: "absolute", top: 12, right: 12,
            fontSize: 16, fontWeight: 600, padding: "3px 10px",
            borderRadius: 20, background: "rgba(30,41,59,0.95)",
            color: "#64748b", whiteSpace: "nowrap", userSelect: "none",
          }}>
            🚧 Coming Soon
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, paddingRight: 110 }}>
            <div style={{
              fontSize: 22, width: 44, height: 44, display: "grid",
              placeItems: "center", background: item.color + "14",
              border: `1px solid ${item.color}28`, borderRadius: 10, flexShrink: 0,
            }}>
              {item.icon ? <item.icon size={22} color={item.color} /> : item.emoji}
            </div>
            <div style={{ fontWeight: 600, fontSize: 18, color: "#475569", lineHeight: 1.3 }}>
              {item.title}
            </div>
          </div>
          <div style={{ fontSize: 16, color: "#334155", lineHeight: 1.4 }}>{item.desc}</div>
          <span style={{
            display: "inline-block", fontSize: 16, fontWeight: 600,
            padding: "5px 12px", borderRadius: 8,
            background: "rgba(30,41,59,0.8)", color: "#64748b",
            border: "1px solid #1e293b",
          }}>
            View Details →
          </span>
        </div>
      </Link>
    );
  }

  // ENTITLED but genuinely needs configuration (item 5).
  // Never implies the customer has not purchased the module.
  if (state === MODULE_STATE.SETUP_REQUIRED) {
    return (
      <Link href={item.href} style={{ textDecoration: "none" }}>
        <div style={{
          background: "#0d1522",
          border: `2px solid ${item.color}66`,
          borderRadius: 14,
          padding: "18px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
          cursor: "pointer",
        }}>
          <div style={{
            position: "absolute", top: 12, right: 12,
            fontSize: 16, fontWeight: 600, padding: "3px 10px",
            borderRadius: 20, background: "rgba(69,39,3,0.9)",
            color: "#fbbf24", whiteSpace: "nowrap", userSelect: "none",
          }}>
            ⚙ Setup required
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, paddingRight: 130 }}>
            <div style={{
              fontSize: 22, width: 44, height: 44, display: "grid",
              placeItems: "center", background: item.color + "18",
              border: `1px solid ${item.color}33`, borderRadius: 10, flexShrink: 0,
            }}>
              {item.icon ? <item.icon size={22} color={item.color} /> : item.emoji}
            </div>
            <div style={{ fontWeight: 600, fontSize: 18, color: "#e2e8f0", lineHeight: 1.3 }}>
              {item.title}
            </div>
          </div>
          <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.4 }}>
            {moduleSetupLabel(item.id) || item.desc}
          </div>
          <span style={{
            display: "inline-block", fontSize: 16, fontWeight: 600,
            padding: "7px 15px", borderRadius: 8,
            background: "rgba(120,53,15,0.5)", color: "#fbbf24",
            border: "1px solid rgba(180,83,9,0.7)",
          }}>
            Set Up →
          </span>
        </div>
      </Link>
    );
  }

  // NOT INCLUDED in the subscription (item 6). Routes to Billing to add it.
  if (!coreCard && state === MODULE_STATE.NOT_INCLUDED) {
    return (
      <div style={{
        background: "#0d1522",
        border: `2px solid ${item.color}33`,
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
          borderRadius: 20, background: "rgba(30,41,59,0.95)",
          color: "#94a3b8", whiteSpace: "nowrap", userSelect: "none",
        }}>
          Not included
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingRight: 120 }}>
          <div style={{
            fontSize: 22, width: 44, height: 44, display: "grid",
            placeItems: "center", background: item.color + "14",
            border: `1px solid ${item.color}28`, borderRadius: 10, flexShrink: 0,
          }}>
            {item.icon ? <item.icon size={22} color={item.color} /> : item.emoji}
          </div>
          <div style={{ fontWeight: 600, fontSize: 18, color: "#94a3b8", lineHeight: 1.3 }}>
            {item.title}
          </div>
        </div>
        <div style={{ fontSize: 16, color: "#64748b", lineHeight: 1.4 }}>{item.desc}</div>
        <Link href="/billing" style={{ textDecoration: "none" }}>
          <span style={{
            display: "inline-block", fontSize: 16, fontWeight: 600,
            padding: "7px 15px", borderRadius: 8,
            background: "rgba(30,58,95,0.6)", color: "#60a5fa",
            border: "1px solid rgba(37,99,235,0.6)",
            cursor: "pointer",
          }}>
            Add Module →
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
            {item.icon ? <item.icon size={22} color="#fff" /> : item.emoji}
          </div>
          <div style={{ fontWeight: 600, fontSize: 18, color: fg, lineHeight: 1.25 }}>
            {item.title}
          </div>
        </div>

        {/* Activity count or desc */}
        <div style={{ fontSize: 16, color: fg, opacity: activityText ? 1 : 0.78, fontWeight: activityText ? 600 : 400, lineHeight: 1.4, minHeight: 18 }}>
          {activityText ?? item.desc}
        </div>

        {/* Entitled and ready: the whole card opens the module (item 4) */}
        {!coreCard && (
          <span style={{
            display: "inline-block", fontSize: 16, fontWeight: 600,
            padding: "5px 12px", borderRadius: 8, alignSelf: "flex-start",
            background: "rgba(0,0,0,0.22)", color: fg,
          }}>
            Open →
          </span>
        )}

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
// ─── Subscription summary (item 9) ───────────────────────────────────────────
// Renders only real subscription data. Any field without backing data is
// omitted rather than invented, and nothing here is hardcoded to a plan name.
function SubscriptionSummary({ subscription, loading }) {
  if (loading || !subscription?.hasSubscription) return null;
  const fields = [
    subscription.plan ? { label: "Current Plan", value: subscription.plan } : null,
    subscription.cycle ? { label: "Billing", value: subscription.cycle } : null,
    subscription.status ? { label: "Status", value: subscription.status } : null,
  ].filter(Boolean);
  if (!fields.length) return null;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center",
      margin: "-6px 0 16px", padding: "12px 16px",
      background: "#0d1522", border: "1px solid #1e2d42", borderRadius: 12,
    }}>
      {fields.map((field) => (
        <div key={field.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>{field.label}:</span>
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: field.label === "Status" && field.value === "Active" ? "#4ade80" : "#e2e8f0",
          }}>
            {field.value}
          </span>
        </div>
      ))}
    </div>
  );
}

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

// ─── Impact stats bar ───────────────────────────────────────────────────────
function ImpactBar({ stats, loading }) {
  const items = [
    { emoji: "👥", label: "Total contacts",    key: "contacts",    color: "#ec4899" },
    { emoji: "📧", label: "Emails sent (30d)", key: "emailsSent",  color: "#facc15" },
    { emoji: "💬", label: "SMS sent (30d)",    key: "smsSent",     color: "#38bdf8" },
    { emoji: "⚙️", label: "Live automations",  key: "automations", color: "#fb923c" },
    { emoji: "🏗️", label: "Active funnels",    key: "funnels",     color: "#ef465d" },
  ];

  return (
    <div style={{
      width: "100%", maxWidth: 1320, marginBottom: 32,
      background: "#0d1522", border: "1px solid #1e2d42",
      borderRadius: 14, padding: "16px 20px",
      display: "flex", alignItems: "stretch", gap: 12, flexWrap: "wrap",
      justifyContent: "space-between",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        fontSize: 12, fontWeight: 700, color: "#4b6480",
        textTransform: "uppercase", letterSpacing: "0.9px",
        marginRight: 4, flexShrink: 0, writingMode: "horizontal-tb",
      }}>
        Your platform
      </div>
      {items.map(item => (
        <div key={item.key} style={{
          flex: "1 1 150px",
          background: "#111827", borderRadius: 10, padding: "12px 16px",
          border: `1px solid ${item.color}28`,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#f9fafb", lineHeight: 1 }}>
            {loading || !stats ? "—" : (stats[item.key] ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span>{item.emoji}</span> {item.label}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
        <Link href="/import-contacts" style={{ textDecoration: "none" }}>
          <div style={{
            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
            borderRadius: 10, padding: "10px 16px",
            fontSize: 13, fontWeight: 600, color: "#fff",
            whiteSpace: "nowrap", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>📥</span> Import from Klaviyo / Mailchimp
          </div>
        </Link>
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { role, workspaceId } = useWorkspace();
  const isOwner = !role || role === "owner";
  const [activeModules, setActiveModules] = useState(new Set());
  const [subscription, setSubscription] = useState(null);
  const [setupContext, setSetupContext] = useState({ account: null });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [impactStats, setImpactStats] = useState(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) { setLoading(false); return; }
        if (!workspaceId) { setLoading(false); return; }

        // ENTITLEMENT SOURCES (item 2 - one source of truth):
        //   workspace_entitlements  canonical, workspace-scoped module rows
        //   user_modules            legacy user-scoped mirror
        //   workspaces.plan         base-plan tier, resolved via lib/featureGates
        //   accounts.*_plan_tier    per-module plan purchases
        //
        // NOTE: user_modules has no `workspace_id` column. Selecting/filtering
        // on it made PostgREST error, the rows returned null, and every module
        // fell through to "Not set up" regardless of subscription.
        const [
          { data: entitlementRows },
          { data: legacyModuleRows },
          { data: acc },
          { data: workspaceRow },
          { data: subscriptionRows },
        ] = await Promise.all([
          supabase
            .from("workspace_entitlements")
            .select("module_id, enabled")
            .eq("workspace_id", workspaceId)
            .eq("enabled", true),
          supabase.from("user_modules").select("module_id").eq("user_id", uid),
          supabase.from("accounts")
            .select("sms_plan_tier, calendar_plan_tier, email_plan_tier, social_plan_tier, sendgrid_connected, sendgrid_from_email, sender_id, sms_api_key, twilio_phone")
            .eq("user_id", uid)
            .maybeSingle(),
          supabase.from("workspaces").select("id, plan").eq("id", workspaceId).maybeSingle(),
          supabase.from("subscriptions").select("plan_id, status, current_period_end").eq("account_id", uid).limit(1),
        ]);

        const legacyRows = legacyModuleRows || [];
        const active = buildEntitledModuleIds({
          planId: workspaceRow?.plan || "",
          entitlementRows: entitlementRows || [],
          legacyRows,
          account: acc || null,
        });
        setActiveModules(active);
        setSetupContext({ account: acc || null });
        setSubscription(buildSubscriptionSummary({
          subscription: subscriptionRows?.[0] || null,
          workspace: workspaceRow || null,
          billingCycle: readBillingCycle(legacyRows.map((row) => row.module_id)),
        }));

        const countables = [...CORE_ITEMS, ...MODULE_ITEMS].filter(m => m.countTable);
        // Workspace-scoped tables must be counted by workspace, not by user.
        const workspaceCountTables = new Set([
          "leads",
          "email_lists",
          "sms_messages",
          "social_posts",
          "funnels",
          "email_automations",
          "sms_sent_history",
          "email_sends",
        ]);
        const results = await Promise.all(
          countables.map(m => {
            let query = supabase
              .from(m.countTable)
              .select("id", { count: "exact", head: true });
            query = workspaceCountTables.has(m.countTable)
              ? query.eq("workspace_id", workspaceId)
              : query.eq("user_id", uid);
            return query
              .then(({ count }) => ({ id: m.id, n: count ?? 0 }))
              .catch(() => ({ id: m.id, n: 0 }));
          })
        );
        const cm = {};
        results.forEach(r => { cm[r.id] = r.n; });

        try {
          const projs = JSON.parse(localStorage.getItem("website_projects") || "[]");
          cm["website_builder"] = Array.isArray(projs) ? projs.length : 0;
        } catch { cm["website_builder"] = 0; }

        setCounts(cm);

        // Impact stats — graceful degradation if any table is missing
        try {
          const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [
            { count: contactCount },
            { count: emailCount },
            { count: smsCount },
            { count: automationCount },
            { count: funnelCount },
          ] = await Promise.all([
            supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", uid),
            supabase.from("email_sends").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("sent_at", since30d),
            supabase.from("sms_sent_history").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since30d),
            supabase.from("email_automations").select("id", { count: "exact", head: true }).eq("user_id", uid),
            supabase.from("funnels").select("id", { count: "exact", head: true }).eq("user_id", uid),
          ]);
          setImpactStats({
            contacts:    contactCount    ?? 0,
            emailsSent:  emailCount      ?? 0,
            smsSent:     smsCount        ?? 0,
            automations: automationCount ?? 0,
            funnels:     funnelCount     ?? 0,
          });
        } catch {
          // Non-critical — dashboard still works without impact stats
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [workspaceId]);

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

      {/* Impact stats */}
      <ImpactBar stats={impactStats} loading={loading} />

      {/* Core Platform */}
      <div style={{ width: "100%", maxWidth: 1320, marginBottom: 40 }}>
        <SectionLabel label="Core Platform" note="Always included" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {CORE_ITEMS.filter(item =>
            isOwner || (item.id !== "core_account" && item.id !== "core_billing")
          ).map(item => (
            <SolidCard key={item.id} item={item} state={MODULE_STATE.READY} coreCard count={counts[item.id]} />
          ))}
        </div>
      </div>

      {/* Gated Modules */}
      <div style={{ width: "100%", maxWidth: 1320 }}>
        <SectionLabel label="Your Modules" note="Manage in Billing & Modules" />
        <SubscriptionSummary subscription={subscription} loading={loading} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {loading
            ? MODULE_ITEMS.map(m => <SkeletonCard key={m.id} />)
            : MODULE_ITEMS.map(item => (
                <SolidCard
                  key={item.id}
                  item={item}
                  state={resolveModuleState({
                    moduleId: item.id,
                    comingSoon: Boolean(item.comingSoon),
                    entitledIds: activeModules,
                    context: setupContext,
                  })}
                  count={counts[item.id]}
                />
              ))
          }
        </div>
      </div>

      {/* Billing CTA */}
      {isOwner && hasInactive && (
        <div style={{
          width: "100%",
          maxWidth: 1320,
          marginTop: 32,
          background: "linear-gradient(135deg, #111a2a, #0d1522)",
          border: "1px solid #1e2d42",
          borderRadius: 14,
          padding: "28px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
        }}>
          <div style={{ textAlign: "center" }}>
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
