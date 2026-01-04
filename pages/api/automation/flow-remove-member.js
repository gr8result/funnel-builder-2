// /pages/api/automation/flow-remove-member.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (res, body) => res.status(200).json(body);
const bad = (res, code, msg, extra = {}) => res.status(code).json({ ok: false, error: msg, ...extra });

function getBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method not allowed");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return bad(res, 500, "Missing SUPABASE env vars.");

  const token = getBearerToken(req);
  if (!token) return bad(res, 401, "Missing Bearer token.");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user?.id) return bad(res, 401, "Invalid session token.");

  const user_id = userData.user.id;

  let body = {};
  try {
    body = req.body ? (typeof req.body === "string" ? JSON.parse(req.body) : req.body) : {};
  } catch {
    body = {};
  }

  const flow_id = body?.flow_id;
  const lead_id = body?.lead_id;

  if (!flow_id) return bad(res, 400, "Missing flow_id");
  if (!lead_id) return bad(res, 400, "Missing lead_id");

  // mark enrollment removed
  const { data: updated, error: upErr } = await sb
    .from("automation_enrollments")
    .update({
      status: "removed",
      exited_at: new Date().toISOString(),
      exit_reason: "Removed manually",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user_id)
    .eq("flow_id", flow_id)
    .eq("contact_id", lead_id)
    .select("id")
    .maybeSingle();

  if (upErr) return bad(res, 500, "Failed to update enrollment.", { detail: upErr.message });

  // clear pending/running queue rows for this lead in this flow
  const { error: delErr } = await sb
    .from("automation_queue")
    .delete()
    .eq("user_id", user_id)
    .eq("flow_id", flow_id)
    .eq("contact_id", lead_id)
    .in("status", ["pending", "running"]);

  if (delErr) return bad(res, 500, "Failed to clear queue rows.", { detail: delErr.message });

  return ok(res, { ok: true, removed: true, enrollment_id: updated?.id || null });
}
