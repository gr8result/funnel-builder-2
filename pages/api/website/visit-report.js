import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/** Rough browser name from user-agent string */
function detectBrowser(ua) {
  if (!ua) return "Unknown";
  if (/Googlebot|bingbot|Slurp|DuckDuckBot|facebookexternalhit|Twitterbot/i.test(ua)) return "Bot";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "Other";
}

/** Mask last octet of IPv4 / last group of IPv6 for display */
function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes(":")) return ip.replace(/:[^:]+$/, ":****");
  return ip.replace(/\.\d+$/, ".***");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const projectId = String(req.query.projectId || "").trim();
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  // Auth check — only the project owner (matched via user session or service key query) should see this.
  // For now we verify the projectId exists in website_builder_projects.
  const { data: proj, error: projError } = await supabaseAdmin
    .from("website_builder_projects")
    .select("id, name, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projError || !proj) {
    return res.status(404).json({ error: "Project not found" });
  }

  const days = Math.min(90, Math.max(7, parseInt(req.query.days || "30", 10)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [totalResult, uniqueResult, recentResult, dailyResult] = await Promise.all([
    // Total visits
    supabaseAdmin
      .from("website_page_views")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),

    // Unique visitors (by cookie)
    supabaseAdmin
      .from("website_page_views")
      .select("visitor_id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("visitor_id", "is", null),

    // Most recent 100 visits for the table
    supabaseAdmin
      .from("website_page_views")
      .select("id, created_at, ip_address, user_agent, page_path, visitor_id, referrer")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100),

    // Daily totals for the chart window
    supabaseAdmin
      .from("website_page_views")
      .select("created_at")
      .eq("project_id", projectId)
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
  ]);

  // Build daily buckets
  const buckets = {};
  for (const row of (dailyResult.data || [])) {
    const day = row.created_at.slice(0, 10);
    buckets[day] = (buckets[day] || 0) + 1;
  }
  // Fill missing days with 0
  const dailyChart = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.now() - (days - 1 - d) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyChart.push({ date: day, visits: buckets[day] || 0 });
  }

  // Count visits today and this week
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayCount = buckets[today] || 0;
  const weekCount = Object.entries(buckets).filter(([d]) => d >= weekAgo).reduce((s, [, v]) => s + v, 0);

  // Format recent visits for the table
  const recentVisits = (recentResult.data || []).map((r) => ({
    id: r.id,
    time: r.created_at,
    ipMasked: maskIp(r.ip_address),
    browser: detectBrowser(r.user_agent),
    userAgent: r.user_agent,
    page: r.page_path || "/",
    referrer: r.referrer || null,
    isReturning: r.visitor_id ? undefined : null, // expanded below
    visitorId: r.visitor_id,
  }));

  // Mark returning visitors: any visitor_id that appears more than once
  const visitorCounts = {};
  for (const v of recentVisits) {
    if (v.visitorId) visitorCounts[v.visitorId] = (visitorCounts[v.visitorId] || 0) + 1;
  }
  for (const v of recentVisits) {
    v.isReturning = v.visitorId ? (visitorCounts[v.visitorId] > 1) : false;
    delete v.visitorId;
  }

  return res.status(200).json({
    projectId,
    projectName: proj.name || projectId,
    totalVisits: totalResult.count || 0,
    uniqueVisitors: uniqueResult.count || 0,
    todayVisits: todayCount,
    weekVisits: weekCount,
    days,
    dailyChart,
    recentVisits,
  });
}
