// /pages/api/automation/engine/email-members.js
// Get active members at a specific email node in the flow
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  const { flow_id, node_id } = req.query;

  if (!flow_id || !node_id) {
    return res.status(400).json({ error: "Missing flow_id or node_id" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing Supabase config" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Get all runs at this node
    const { data: runs, error: runsErr } = await supabase
      .from("automation_flow_runs")
      .select("id, lead_id, status")
      .eq("flow_id", flow_id)
      .eq("current_node_id", node_id);

    if (runsErr) throw runsErr;

    const memberCount = runs?.length || 0;

    return res.status(200).json({ ok: true, count: memberCount, members: runs || [] });
  } catch (e) {
    console.error("Error fetching email members:", e);
    return res.status(500).json({ error: e?.message || String(e), ok: false });
  }
}
