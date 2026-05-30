// /pages/api/usage/summary.js
// GET /api/usage/summary
// Returns all plan resource usage counts in one call.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { getLimit, PLANS } from "../../../lib/featureGates";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const authUserId = req.user?.id;
  if (!authUserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  // Look up workspace
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("id, plan")
    .eq("owner_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const plan = ws?.plan || "starter";
  const workspaceId = ws?.id || null;
  const planName = PLANS[plan]?.name || plan;

  // Start of current calendar month for monthly counters
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  // Run all counts in parallel
  const [
    { count: funnelCount },
    ,
    { count: automationCount },
    leadsResult,
    teamResult,
    communityResult,
    smsUsageResult,
    emailUsageResult,
  ] = await Promise.all([
    // Funnels
    supabaseAdmin
      .from("funnels")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", authUserId),

    // Websites — fetched separately below for deduplication
    Promise.resolve({ data: [] }),

    // Automation flows
    supabaseAdmin
      .from("automation_flows")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId),

    // Leads — needs workspace_id
    workspaceId
      ? supabaseAdmin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
      : Promise.resolve({ count: 0 }),

    // Team members — needs workspace_id
    workspaceId
      ? supabaseAdmin
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("status", ["active", "invited"])
      : Promise.resolve({ count: 0 }),

    // Communities
    supabaseAdmin
      .from("communities")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", authUserId)
      .eq("is_global", false),

    // SMS sent this month (usage_sms table)
    supabaseAdmin
      .from("usage_sms")
      .select("sms_sent")
      .eq("user_id", authUserId)
      .gte("period_start", monthStartISO)
      .maybeSingle(),

    // Emails sent this month (usage_email table)
    supabaseAdmin
      .from("usage_email")
      .select("emails_sent")
      .eq("user_id", authUserId)
      .gte("period_start", monthStartISO)
      .maybeSingle(),
  ]);

  // Deduplicate websites by stripping "draft:" prefix
  const { data: websiteRows } = await supabaseAdmin
    .from("published_websites")
    .select("project_id")
    .eq("user_id", authUserId);

  const uniqueWebsiteIds = new Set(
    (websiteRows || []).map((r) => String(r.project_id || "").replace(/^draft:/, ""))
  );
  const websiteUsed = uniqueWebsiteIds.size;

  const smsSent = smsUsageResult?.data?.sms_sent || 0;
  const emailSent = emailUsageResult?.data?.emails_sent || 0;

  // Current month label e.g. "May 2026"
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const resources = [
    {
      key: "funnels",
      label: "Funnels",
      icon: "🔽",
      used: funnelCount || 0,
      limit: getLimit(plan, "funnels"),
      href: "/modules/funnels",
      monthly: false,
    },
    {
      key: "websites",
      label: "Websites",
      icon: "🌐",
      used: websiteUsed,
      limit: getLimit(plan, "websites"),
      href: "/modules/website-builder",
      monthly: false,
    },
    {
      key: "automations",
      label: "Automations",
      icon: "⚡",
      used: automationCount || 0,
      limit: getLimit(plan, "automations"),
      href: "/modules/email/automation",
      monthly: false,
    },
    {
      key: "leads",
      label: "Leads",
      icon: "👥",
      used: leadsResult?.count || 0,
      limit: getLimit(plan, "leads"),
      href: "/leads",
      monthly: false,
    },
    {
      key: "team_members",
      label: "Team Members",
      icon: "🧑‍💼",
      used: teamResult?.count || 0,
      limit: getLimit(plan, "team_members"),
      href: "/modules/email/crm/teams",
      monthly: false,
    },
    {
      key: "communities",
      label: "Communities",
      icon: "🏘️",
      used: communityResult?.count || 0,
      limit: getLimit(plan, "communities"),
      href: "/modules/communities",
      monthly: false,
    },
    {
      key: "sms_monthly",
      label: "SMS",
      icon: "💬",
      used: smsSent,
      limit: getLimit(plan, "sms_monthly"),
      href: "/modules/email/crm/sms-marketing",
      monthly: true,
    },
    {
      key: "email_monthly",
      label: "Emails",
      icon: "📧",
      used: emailSent,
      limit: getLimit(plan, "email_monthly"),
      href: "/modules/email",
      monthly: true,
    },
    {
      key: "ai_credits_monthly",
      label: "AI Credits",
      icon: "🤖",
      used: null, // no tracking table yet
      limit: getLimit(plan, "ai_credits_monthly"),
      href: "/modules/email/automation",
      monthly: true,
      untracked: true,
    },
  ].map((r) => ({
    ...r,
    atLimit: r.used !== null && r.limit !== null && r.used >= r.limit,
    pct: (r.used !== null && r.limit) ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0,
    remaining: (r.used !== null && r.limit !== null) ? Math.max(0, r.limit - r.used) : null,
  }));

  return res.status(200).json({ ok: true, plan, planName, monthLabel, resources });
}

export default withAuth(handler);
