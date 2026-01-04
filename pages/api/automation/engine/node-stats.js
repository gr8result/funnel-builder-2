// /pages/api/automation/engine/node-stats.js
// FULL REPLACEMENT
//
// ✅ Returns trigger active count from automation_flow_members
// ✅ Returns per-node stats shape so UI can display counters

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  try {
    const flow_id = String(req.query?.flow_id || "").trim();
    if (!flow_id) return res.status(400).json({ ok: false, error: "Missing flow_id" });

    const { count, error } = await supabaseAdmin
      .from("automation_flow_members")
      .select("id", { count: "exact", head: true })
      .eq("flow_id", flow_id)
      .eq("status", "active");

    if (error) return res.status(500).json({ ok: false, error: error.message });

    // UI expects stats by node id. We add a special key for trigger.
    return res.json({
      ok: true,
      trigger_active: count || 0,
      stats: {}, // email nodes will be filled by your existing worker later if you want
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
