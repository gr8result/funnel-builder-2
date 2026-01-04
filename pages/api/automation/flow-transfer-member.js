// /pages/api/automation/flow-transfer-member.js
// FULL REPLACEMENT — move lead from one flow to another (automation_enrollments)
// ✅ POST { from_flow_id, to_flow_id, lead_id }
// ✅ Marks old enrollment status='stopped'
// ✅ Upserts new enrollment status='active'

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
    if (!SERVICE_KEY) return bad(res, 500, "Missing SUPABASE_SERVICE_ROLE_KEY env var");

    const token = getBearer(req);
    if (!token) return bad(res, 401, "Missing Bearer token");

    const from_flow_id = String(req.body?.from_flow_id || "").trim();
    const to_flow_id = String(req.body?.to_flow_id || "").trim();
    const lead_id = String(req.body?.lead_id || "").trim();

    if (!from_flow_id) return bad(res, 400, "Missing from_flow_id");
    if (!to_flow_id) return bad(res, 400, "Missing to_flow_id");
    if (!lead_id) return bad(res, 400, "Missing lead_id");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return bad(res, 401, "Invalid session", { details: userErr?.message || null });
    }
    const authUserId = userData.user.id;

    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (accErr || !account?.id) {
      return bad(res, 400, "Could not resolve account for user", {
        details: accErr?.message || null,
      });
    }
    const accountId = account.id;

    const now = new Date().toISOString();

    // Stop old
    await admin
      .from("automation_enrollments")
      .update({ status: "stopped", updated_at: now })
      .eq("user_id", accountId)
      .eq("flow_id", from_flow_id)
      .eq("lead_id", lead_id);

    // Start new (upsert)
    const { data: newRow, error: upErr } = await admin
      .from("automation_enrollments")
      .upsert(
        {
          user_id: accountId,
          flow_id: to_flow_id,
          lead_id,
          source: "manual",
          status: "active",
          current_node_id: null,
          entered_at: now,
          updated_at: now,
        },
        { onConflict: "flow_id,lead_id" }
      )
      .select()
      .maybeSingle();

    if (upErr) {
      return bad(res, 500, "Failed to transfer member", { details: upErr.message });
    }

    return ok(res, {
      ok: true,
      transferred: true,
      lead_id,
      from_flow_id,
      to_flow_id,
      enrollment: newRow || null,
    });
  } catch (e) {
    return bad(res, 500, "Server error", { details: e?.message || String(e) });
  }
}
