import { randomUUID } from "crypto";
import { supabaseAdmin } from "../supabaseAdmin";
import { sendEmail } from "../sendEmail";
import { normalizeDomain } from "./publishConfig";

export const WEBSITE_SUBSCRIBERS_LIST_NAME = "Website Subscribers";
export const WEBSITE_SUBSCRIBER_SOURCE = "Website Footer Signup";

export function normalizeSubscriberEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isValidSubscriberEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function domainMatches(allowed, host) {
  const left = normalizeDomain(allowed);
  const right = normalizeDomain(host);
  if (!left || !right) return false;
  return left === right || `www.${left}` === right || left === `www.${right}`;
}

function cleanString(value = "") {
  return String(value ?? "").trim();
}

function columnFromError(error) {
  const msg = String(error?.message || error?.details || "");
  return (
    msg.match(/'([^']+)' column/)?.[1] ||
    msg.match(/column "([^"]+)"/)?.[1] ||
    msg.match(/Could not find the '([^']+)'/)?.[1] ||
    ""
  );
}

async function insertAdaptive(table, payload, { select = "*" } = {}) {
  let row = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(row).select(select).maybeSingle();
    if (!error) return { data, error: null };
    const column = columnFromError(error);
    if (!column || !(column in row)) return { data: null, error };
    delete row[column];
  }
  return { data: null, error: new Error(`Could not insert ${table}`) };
}

async function updateAdaptive(table, query, payload, { select = "*" } = {}) {
  let row = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let builder = supabaseAdmin.from(table).update(row);
    for (const [column, value] of Object.entries(query || {})) builder = builder.eq(column, value);
    const { data, error } = await builder.select(select).maybeSingle();
    if (!error) return { data, error: null };
    const column = columnFromError(error);
    if (!column || !(column in row)) return { data: null, error };
    delete row[column];
  }
  return { data: null, error: new Error(`Could not update ${table}`) };
}

export async function resolvePublishedWebsiteForSignup({ websiteId = "", projectId = "", originHost = "" } = {}) {
  const normalizedWebsiteId = cleanString(websiteId);
  const normalizedProjectId = cleanString(projectId).replace(/^draft:/, "");
  const host = normalizeDomain(originHost);

  let rows = [];
  if (normalizedWebsiteId) {
    const { data, error } = await supabaseAdmin
      .from("published_websites")
      .select("id, user_id, project_id, name, slug, custom_domain, primary_domain, published, site_data")
      .or(`id.eq.${normalizedWebsiteId},project_id.eq.${normalizedWebsiteId}`)
      .eq("published", true)
      .limit(10);
    if (error) throw error;
    rows = data || [];
  }

  if (!rows.length && normalizedProjectId) {
    const { data, error } = await supabaseAdmin
      .from("published_websites")
      .select("id, user_id, project_id, name, slug, custom_domain, primary_domain, published, site_data")
      .eq("project_id", normalizedProjectId)
      .eq("published", true)
      .limit(10);
    if (error) throw error;
    rows = data || [];
  }

  if (!rows.length && host) {
    const { data, error } = await supabaseAdmin
      .from("published_websites")
      .select("id, user_id, project_id, name, slug, custom_domain, primary_domain, published, site_data")
      .or(`custom_domain.eq.${host},primary_domain.eq.${host}`)
      .eq("published", true)
      .limit(10);
    if (error) throw error;
    rows = data || [];
  }

  const selected = rows.find((row) => domainMatches(row.custom_domain, host))
    || rows.find((row) => domainMatches(row.primary_domain, host))
    || rows[0]
    || null;
  if (!selected?.id) return null;

  const allowedHosts = [selected.custom_domain, selected.primary_domain]
    .map(normalizeDomain)
    .filter(Boolean);
  const isLocal = !host || /^localhost$|^127\.0\.0\.1$/.test(host);
  if (!isLocal && allowedHosts.length && !allowedHosts.some((allowedHost) => domainMatches(allowedHost, host))) {
    return null;
  }
  return selected;
}

export async function resolvePrimaryWorkspaceForUser(userId) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.workspace_id || null;
}

export async function getOrCreateWebsiteSubscribersList({ userId, workspaceId }) {
  let query = supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("name", WEBSITE_SUBSCRIBERS_LIST_NAME)
    .order("created_at", { ascending: true })
    .limit(1);
  query = workspaceId ? query.eq("workspace_id", workspaceId) : query.eq("user_id", userId);
  let existing = await query;
  if (workspaceId && (existing.error || !existing.data?.[0]?.id)) {
    existing = await supabaseAdmin
      .from("lead_lists")
      .select("*")
      .eq("name", WEBSITE_SUBSCRIBERS_LIST_NAME)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
  }
  if (!existing.error && existing.data?.[0]?.id) return existing.data[0];

  const now = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    user_id: userId,
    workspace_id: workspaceId || null,
    name: WEBSITE_SUBSCRIBERS_LIST_NAME,
    source_type: "Website Footer Signup",
    tags: "website,footer,subscriber",
    action: "None",
    auto_add_crm: true,
    color: "#22c55e",
    color_tag: "#22c55e",
    created_at: now,
    updated_at: now,
  };
  const inserted = await insertAdaptive("lead_lists", payload);
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function upsertLeadForWebsiteSubscriber({ userId, workspaceId, listId, email, website, pageUrl }) {
  const normalizedEmail = normalizeSubscriberEmail(email);
  let existingQuery = supabaseAdmin
    .from("leads")
    .select("*")
    .ilike("email", normalizedEmail)
    .order("created_at", { ascending: true })
    .limit(1);
  existingQuery = workspaceId ? existingQuery.eq("workspace_id", workspaceId) : existingQuery.eq("user_id", userId);
  let existing = await existingQuery;
  if (existing.error && workspaceId && columnFromError(existing.error) === "workspace_id") {
    existing = await supabaseAdmin
      .from("leads")
      .select("*")
      .ilike("email", normalizedEmail)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
  }
  const existingLead = Array.isArray(existing.data) ? existing.data[0] : null;

  const now = new Date().toISOString();
  const notesLine = `Website footer signup\nWebsite: ${website?.name || website?.slug || website?.id || ""}\nPage: ${pageUrl || ""}`;
  const payload = {
    user_id: userId,
    workspace_id: workspaceId || null,
    name: normalizedEmail,
    email: normalizedEmail,
    lead_status: "new",
    lead_source: WEBSITE_SUBSCRIBER_SOURCE,
    source: WEBSITE_SUBSCRIBER_SOURCE,
    tags: ["website-subscriber", "footer-signup"],
    list: WEBSITE_SUBSCRIBERS_LIST_NAME,
    list_id: listId || null,
    notes: existingLead?.notes ? `${existingLead.notes}\n\n${notesLine}` : notesLine,
    updated_at: now,
  };

  if (existingLead?.id) {
    const updated = await updateAdaptive("leads", { id: existingLead.id }, payload);
    if (updated.error) throw updated.error;
    return updated.data || { ...existingLead, ...payload };
  }

  const inserted = await insertAdaptive("leads", { id: randomUUID(), ...payload, created_at: now });
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function upsertWebsiteSubscriberRecord({ website, workspaceId, email, source, pageUrl, status = "active" }) {
  const normalizedEmail = normalizeSubscriberEmail(email);
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("website_subscribers")
    .select("*")
    .eq("website_id", website.id)
    .ilike("email", normalizedEmail)
    .eq("status", "active")
    .maybeSingle();
  if (existingError && existingError.code !== "PGRST116") throw existingError;

  const payload = {
    account_id: website.user_id,
    workspace_id: workspaceId || null,
    website_id: website.id,
    project_id: website.project_id || website.site_data?.id || null,
    email: normalizedEmail,
    source: source || "Website Footer",
    page_url: pageUrl || "",
    status,
    updated_at: now,
  };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from("website_subscribers")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return { subscriber: data || { ...existing, ...payload }, duplicate: true };
  }

  const { data, error } = await supabaseAdmin
    .from("website_subscribers")
    .insert({ id: randomUUID(), ...payload, created_at: now })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return { subscriber: data, duplicate: false };
}

export async function notifyWebsiteSubscriberOwner({ email, pageUrl, submittedAt, website }) {
  const subject = `New Website Subscriber - ${website?.name || website?.site_data?.name || "Website"}`;
  const text = [
    "A new visitor subscribed through the website footer.",
    "",
    "Email:",
    email,
    "",
    "Source:",
    "Website Footer",
    "",
    "Page:",
    pageUrl || "",
    "",
    "Date and time:",
    submittedAt || new Date().toISOString(),
  ].join("\n");
  const html = text
    .split("\n")
    .map((line) => line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : "<br/>")
    .join("");

  return sendEmail({
    to: "support@gr8result.com",
    from: process.env.SIGNUP_NOTIFY_FROM || process.env.SENDGRID_FROM_EMAIL || "support@gr8result.com",
    subject,
    text,
    html,
  });
}
