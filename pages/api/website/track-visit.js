import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
}

export default async function handler(req, res) {
  const projectId = String(req.query.projectId || req.body?.projectId || "").trim();
  if (!projectId) {
    return res.status(400).json({ error: "projectId required" });
  }

  // Optional base offset — seed number set by the site owner.
  const base = Math.max(0, parseInt(req.query.base ?? req.body?.base ?? 0, 10) || 0);

  // Read or mint a persistent visitor cookie for browser identification.
  const cookies = parseCookies(req.headers.cookie);
  let visitorId = cookies["wbv_visitor_id"] || null;
  let isNewVisitor = false;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    isNewVisitor = true;
  }
  // Set visitor cookie — 1 year, HttpOnly, SameSite=Lax
  res.setHeader("Set-Cookie", `wbv_visitor_id=${visitorId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`);

  if (req.method === "POST") {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || null;
    const pagePath = String(req.query.page || "").slice(0, 500) || null;
    const referrer = String(req.headers["referer"] || req.headers["referrer"] || "").slice(0, 500) || null;

    // Try full insert with all tracking columns.
    // Falls back to minimal insert if schema hasn't been migrated yet.
    const fullRow = { project_id: projectId, ip_address: ip, user_agent: userAgent, page_path: pagePath, visitor_id: visitorId, referrer };
    const { error: insertError } = await supabaseAdmin.from("website_page_views").insert(fullRow);

    if (insertError) {
      // Columns likely missing — try minimal insert
      const { error: minimalError } = await supabaseAdmin.from("website_page_views").insert({ project_id: projectId });
      if (minimalError) {
        return res.status(200).json({ count: base, error: minimalError.message });
      }
    }
  }

  // Return total visit count + unique visitor count
  const [{ count: totalCount }, { count: uniqueCount }] = await Promise.all([
    supabaseAdmin.from("website_page_views").select("*", { count: "exact", head: true }).eq("project_id", projectId),
    supabaseAdmin.from("website_page_views").select("visitor_id", { count: "exact", head: true }).eq("project_id", projectId).not("visitor_id", "is", null),
  ]);

  return res.status(200).json({
    count: base + (totalCount || 0),
    totalVisits: totalCount || 0,
    uniqueVisitors: uniqueCount || 0,
    isNewVisitor,
  });
}
