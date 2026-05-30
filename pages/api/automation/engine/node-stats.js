// /pages/api/automation/engine/node-stats.js
// FULL REPLACEMENT — STRICT FLOW-ONLY COUNTS (NO GHOST DATA)

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function handler(req, res) {
  try {
    const flow_id = String(req.query?.flow_id || "").trim();
    if (!flow_id) {
      return res.status(400).json({ ok: false, error: "Missing flow_id" });
    }

    // ACTIVE MEMBERS
    const { data: members, error: memberErr } = await supabase
      .from("automation_flow_members")
      .select("lead_id")
      .eq("flow_id", flow_id)
      .in("status", ["active", "pending"]);

    if (memberErr) {
      return res.status(500).json({ ok: false, error: memberErr.message });
    }

    const activeLeadIds = (members || []).map((m) => m.lead_id);
    const trigger_active = activeLeadIds.length;

    // CURRENT RUN POSITIONS (only for current members)
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("lead_id,current_node_id,status")
      .eq("flow_id", flow_id)
      .in("status", ["pending", "active", "waiting_event"]);

    const counts = {};
    for (const r of runs || []) {
      if (!r.current_node_id) continue;
      if (!activeLeadIds.includes(r.lead_id)) continue;
      counts[r.current_node_id] = (counts[r.current_node_id] || 0) + 1;
    }

    // STRICT PASSED COUNTS (only for current members)
    const { data: history } = await supabase
      .from("automation_flow_node_history")
      .select("node_id,lead_id")
      .eq("flow_id", flow_id);

    const passed_counts = {};
    const seen = new Set();
    for (const row of history || []) {
      if (!activeLeadIds.includes(row.lead_id)) continue;
      const key = `${row.node_id}::${row.lead_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      passed_counts[row.node_id] = (passed_counts[row.node_id] || 0) + 1;
    }

    // Build stats object for each node
    const stats = {};
    const allNodeIds = new Set([
      ...Object.keys(counts),
      ...Object.keys(passed_counts),
    ]);
    for (const nodeId of allNodeIds) {
      stats[nodeId] = {
        active: counts[nodeId] || 0,
        passed: passed_counts[nodeId] || 0,
      };
    }
    // Add trigger node stats
    stats['trigger'] = {
      active: trigger_active,
      passed: passed_counts['trigger'] || 0,
    };
    return res.json({
      ok: true,
      trigger_active,
      counts,
      passed_counts,
      stats,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}

export default withAuth(handler);
