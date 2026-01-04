// /pages/api/automation/flow-members.js
// FULL REPLACEMENT
// GET /api/automation/flow-members?flow_id=...
//
// ✅ Uses your real schema:
//   - members: automation_flow_members
//   - leads: leads
// ✅ No table guessing
// ✅ Safe: derives user from Bearer token
// ✅ Joins in code (no FK relationship required in PostgREST)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const user_id = userData.user.id;

    const flow_id = String(req.query.flow_id || "").trim();
    if (!flow_id) return res.status(400).json({ ok: false, error: "Missing flow_id" });

    const { data: members, error: memErr } = await supabaseAdmin
      .from("automation_flow_members")
      .select("id, flow_id, lead_id, status, source, created_at, updated_at")
      .eq("user_id", user_id)
      .eq("flow_id", flow_id)
      .order("created_at", { ascending: false });

    if (memErr) {
      return res.status(500).json({ ok: false, error: memErr.message, detail: memErr });
    }

    const leadIds = Array.from(new Set((members || []).map((m) => m.lead_id).filter(Boolean)));

    let leadsById = {};
    if (leadIds.length > 0) {
      const { data: leads, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("id, name, email, phone, avatar_icon, avatar_color, unsubscribed_at, created_at")
        .eq("user_id", user_id)
        .in("id", leadIds);

      if (!leadErr && Array.isArray(leads)) {
        leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));
      }
    }

    const out = (members || []).map((m) => ({
      enrollment_id: m.id,
      flow_id: m.flow_id,
      lead_id: m.lead_id,
      status: m.status || null,
      source: m.source || null,
      created_at: m.created_at,
      updated_at: m.updated_at,
      lead: leadsById[m.lead_id] || null,
    }));

    return res.status(200).json({ ok: true, members: out });
  } catch (err) {
    console.error("flow-members error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
