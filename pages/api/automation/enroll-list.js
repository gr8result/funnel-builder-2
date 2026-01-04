// /pages/api/automation/enroll-list.js
// FULL REPLACEMENT
// POST { flow_id, list_id }
//
// ✅ Uses your real schema:
//   - lead_lists (lists)
//   - leads.list_id (list membership)
//   - automation_flow_members (flow membership)
// ✅ Safe: derives user from Bearer token

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
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }
    const user_id = userData.user.id;

    const flow_id = String(req.body?.flow_id || "").trim();
    const list_id = String(req.body?.list_id || "").trim();
    if (!flow_id) return res.status(400).json({ ok: false, error: "Missing flow_id" });
    if (!list_id) return res.status(400).json({ ok: false, error: "Missing list_id" });

    // confirm list belongs to user
    const { data: listRow, error: listErr } = await supabaseAdmin
      .from("lead_lists")
      .select("id,name,user_id")
      .eq("id", list_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (listErr) return res.status(500).json({ ok: false, error: listErr.message, detail: listErr });
    if (!listRow) return res.status(404).json({ ok: false, error: "List not found" });

    // get all leads in list
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("user_id", user_id)
      .eq("list_id", list_id)
      .limit(100000);

    if (leadsErr) return res.status(500).json({ ok: false, error: leadsErr.message, detail: leadsErr });

    const leadIds = (leads || []).map((l) => l.id).filter(Boolean);
    if (leadIds.length === 0) {
      return res.status(200).json({ ok: true, added: 0, skipped: 0, note: "No leads in that list." });
    }

    // upsert membership (skip duplicates using unique constraint)
    const now = new Date().toISOString();
    const rows = leadIds.map((lead_id) => ({
      user_id,
      flow_id,
      lead_id,
      status: "active",
      source: "list",
      created_at: now,
      updated_at: now,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("automation_flow_members")
      .upsert(rows, { onConflict: "flow_id,lead_id" });

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message, detail: upErr });

    return res.status(200).json({
      ok: true,
      lead_count: leadIds.length,
      note: "Upserted into automation_flow_members (duplicates skipped by unique constraint).",
    });
  } catch (err) {
    console.error("enroll-list error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
