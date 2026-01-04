// /pages/api/automation/crm-transfer.js
// FULL REPLACEMENT — enroll ONE existing lead into a flow (automation_enrollments)
// ✅ POST { flow_id, lead_id, source? }
// ✅ Uses automation_enrollments
// ✅ Upsert on (flow_id,lead_id)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const ok = (res, body) => res.status(200).json(body);
const bad = (res, code, msg, extra = {}) =>
  res.status(code).json({ ok: false, error: msg, ...extra });

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return bad(res, 405, "Method not allowed");
  }

  try {
    if (!SUPABASE_URL) return bad(res, 500, "Missing SUPABASE_URL env var");
    if (!SERVICE_KEY)
      return bad(res, 500, "Missing SUPABASE_SERVICE_ROLE_KEY env var");

    const token = getBearer(req);
    if (!token) return bad(res, 401, "Missing Bearer token");

    const flow_id = String(req.body?.flow_id || "").trim();
    const lead_id = String(req.body?.lead_id || "").trim();
    const source = String(req.body?.source || "manual").trim();

    if (!flow_id) return bad(res, 400, "Missing flow_id");
    if (!lead_id) return bad(res, 400, "Missing lead_id");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return bad(res, 401, "Invalid session", {
        details: userErr?.message || null,
      });
    }

    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (accErr || !account?.id) {
      return bad(res, 400, "Could not resolve account for user", {
        details: accErr?.message || null,
      });
    }

    const now = new Date().toISOString();

    const row = {
      user_id: account.id,
      flow_id,
      lead_id,
      source,
      status: "active",
      current_node_id: null,
      entered_at: now,
      updated_at: now,
    };

    const { data: inserted, error: insErr } = await admin
      .from("automation_enrollments")
      .upsert(row, { onConflict: "flow_id,lead_id" })
      .select()
      .maybeSingle();

    if (insErr) {
      return bad(res, 500, "Failed to enroll lead", { details: insErr.message });
    }

    return ok(res, { ok: true, enrolled: true, enrollment: inserted || row });
  } catch (e) {
    return bad(res, 500, "Server error", { details: e?.message || String(e) });
  }
}
