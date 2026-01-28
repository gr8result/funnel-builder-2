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

    // Use the new flow-stats endpoint for accurate data
    const { data: flowData, error: flowError } = await supabaseAdmin
      .from("automation_flows")
      .select("nodes")
      .eq("id", flow_id)
      .single();

    if (flowError) return res.status(500).json({ ok: false, error: flowError.message });

    let nodes = [];
    try {
      nodes = typeof flowData.nodes === 'string' ? JSON.parse(flowData.nodes) : (flowData.nodes || []);
    } catch {
      nodes = [];
    }

    // Get member count enrolled in flow
    const { count: memberCount } = await supabaseAdmin
      .from("automation_flow_members")
      .select("id", { count: "exact", head: true })
      .eq("flow_id", flow_id);

    // Get runs for this flow (members currently processing)
    const { data: runs } = await supabaseAdmin
      .from("automation_flow_runs")
      .select("current_node_id, status")
      .eq("flow_id", flow_id);

    // Get email queue stats per node
    const { data: queueData } = await supabaseAdmin
      .from("automation_email_queue")
      .select("node_id, status")
      .eq("flow_id", flow_id);

    // Build stats by node
    const stats = {};
    const counts = {};

    // Count members currently at each node
    const nodeMemberCounts = {};
    (runs || []).forEach((r) => {
      if (r.current_node_id) {
        nodeMemberCounts[r.current_node_id] = (nodeMemberCounts[r.current_node_id] || 0) + 1;
      }
    });

    // Build stats for each email node
    for (const node of nodes) {
      if (node.type === "email") {
        const nodeQueueData = (queueData || []).filter(q => q.node_id === node.id);
        const processed = nodeQueueData.length;
        const sent = nodeQueueData.filter(q => q.status === 'sent').length;
        const opened = nodeQueueData.filter(q => q.status === 'opened').length;
        const clicked = nodeQueueData.filter(q => q.status === 'clicked').length;

        stats[node.id] = {
          processed,
          delivered: sent,
          opened,
          clicked,
          activeMembers: nodeMemberCounts[node.id] || 0,
        };
      } else if (node.type === "condition") {
        stats[node.id] = {
          activeMembers: nodeMemberCounts[node.id] || 0,
        };
      }
    }

    return res.json({
      ok: true,
      trigger_active: memberCount || 0,
      stats,
      counts,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
