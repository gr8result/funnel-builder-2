import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";
import {
  getOrCreateWebsiteSubscribersList,
  isValidSubscriberEmail,
  normalizeSubscriberEmail,
  notifyWebsiteSubscriberOwner,
  resolvePrimaryWorkspaceForUser,
  resolvePublishedWebsiteForSignup,
  upsertLeadForWebsiteSubscriber,
  upsertWebsiteSubscriberRecord,
} from "../../../lib/website-builder/subscribers";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function hostFromUrl(value = "") {
  try {
    return new URL(String(value || "")).hostname;
  } catch {
    return "";
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function requireUser(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return null;
  }
  return data.user;
}

async function handlePost(req, res) {
  const ip = getIp(req);
  const rl = checkRateLimit(`website-subscriber:${ip}`, 8, 60 * 1000);
  if (!rl.ok) return res.status(429).json({ ok: false, error: "Too many requests." });

  const body = req.body || {};
  if (String(body.website || body.url || "").trim()) {
    return res.status(200).json({ ok: true, bot: true });
  }

  const email = normalizeSubscriberEmail(body.email);
  if (!email || !isValidSubscriberEmail(email)) {
    return res.status(400).json({ ok: false, code: "INVALID_EMAIL", error: "Please enter a valid email address." });
  }

  const pageUrl = String(body.page || body.page_url || req.headers.referer || "").trim();
  const originHost = hostFromUrl(pageUrl)
    || hostFromUrl(req.headers.origin || "")
    || String(req.headers.host || "").split(":")[0];
  const website = await resolvePublishedWebsiteForSignup({
    websiteId: body.websiteId || body.website_id || "",
    projectId: body.projectId || body.project_id || "",
    originHost,
  });
  if (!website?.id || !website?.user_id) {
    return res.status(403).json({ ok: false, error: "Website is not allowed to accept subscribers." });
  }

  const workspaceId = await resolvePrimaryWorkspaceForUser(website.user_id);
  const list = await getOrCreateWebsiteSubscribersList({ userId: website.user_id, workspaceId });
  const { subscriber, duplicate } = await upsertWebsiteSubscriberRecord({
    website,
    workspaceId,
    email,
    source: body.source || "Website Footer",
    pageUrl,
  });
  const lead = await upsertLeadForWebsiteSubscriber({
    userId: website.user_id,
    workspaceId,
    listId: list?.id || null,
    email,
    website,
    pageUrl,
  });

  const notification = await notifyWebsiteSubscriberOwner({
    email,
    pageUrl,
    submittedAt: body.submittedAt || new Date().toISOString(),
    website,
  });
  if (!notification?.ok) console.warn("[website/subscribers] notification failed", notification);

  return res.status(200).json({
    ok: true,
    duplicate,
    message: duplicate ? "You're already subscribed." : "Thanks - you're subscribed.",
    subscriberId: subscriber?.id || null,
    leadId: lead?.id || null,
    listId: list?.id || null,
    notificationStatus: notification?.ok ? "sent" : notification?.skipped ? "skipped" : "failed",
  });
}

async function handleGet(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const projectId = String(req.query.projectId || req.query.project_id || "").trim();
  const q = String(req.query.q || "").trim();
  const format = String(req.query.format || "").toLowerCase();

  let query = supabaseAdmin
    .from("website_subscribers")
    .select("id, account_id, workspace_id, website_id, project_id, email, source, page_url, status, created_at, updated_at")
    .eq("account_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (projectId) query = query.eq("project_id", projectId);
  if (q) query = query.ilike("email", `%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ ok: false, error: error.message });

  const websiteIds = [...new Set((data || []).map((row) => row.website_id).filter(Boolean))];
  const websiteNames = {};
  if (websiteIds.length) {
    const { data: websites } = await supabaseAdmin
      .from("published_websites")
      .select("id, name, slug, custom_domain, primary_domain")
      .in("id", websiteIds);
    (websites || []).forEach((site) => {
      websiteNames[site.id] = site.name || site.custom_domain || site.primary_domain || site.slug || site.id;
    });
  }

  const rows = (data || []).map((row) => ({
    ...row,
    website: websiteNames[row.website_id] || row.website_id || "",
  }));
  const emails = [...new Set(rows.map((row) => row.email).filter(Boolean))];
  const leadByEmail = {};
  if (emails.length) {
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id,email")
      .eq("user_id", user.id)
      .in("email", emails);
    (leads || []).forEach((lead) => {
      if (lead?.email) leadByEmail[String(lead.email).toLowerCase()] = lead.id;
    });
  }
  rows.forEach((row) => {
    row.lead_id = leadByEmail[String(row.email || "").toLowerCase()] || null;
  });

  if (format === "csv") {
    const header = ["email", "date_subscribed", "website", "source_page", "status"];
    const csv = [
      header.join(","),
      ...rows.map((row) => [
        row.email,
        row.created_at,
        row.website,
        row.page_url,
        row.status,
      ].map(csvEscape).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"website-subscribers.csv\"");
    return res.status(200).send(csv);
  }

  return res.status(200).json({ ok: true, subscribers: rows });
}

async function handlePatch(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const id = String(req.body?.id || "").trim();
  const status = String(req.body?.status || "").trim().toLowerCase();
  if (!id || !["active", "unsubscribed", "bounced"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Valid id and status are required." });
  }

  const { data, error } = await supabaseAdmin
    .from("website_subscribers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, subscriber: data });
}

async function handleDelete(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const id = String(req.body?.id || req.query?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id is required." });

  const { error } = await supabaseAdmin
    .from("website_subscribers")
    .delete()
    .eq("id", id)
    .eq("account_id", user.id);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    if (req.method === "POST") return handlePost(req, res);
    if (req.method === "GET") return handleGet(req, res);
    if (req.method === "PATCH") return handlePatch(req, res);
    if (req.method === "DELETE") return handleDelete(req, res);
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[website/subscribers]", error);
    return res.status(500).json({ ok: false, error: "We couldn't complete your subscription. Please try again." });
  }
}
