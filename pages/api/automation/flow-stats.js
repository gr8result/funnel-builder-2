// /pages/api/automation/flow-stats.js
// Get detailed stats for a flow including per-node email metrics
// GET /api/automation/flow-stats?flow_id=xxx

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const flowId = (req.query.flow_id || "").toString().trim();
  if (!flowId) {
    return res.status(400).json({ ok: false, error: "Missing flow_id" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Get flow
    const { data: flow, error: flowErr } = await supabase
      .from("automation_flows")
      .select("id, user_id, name, nodes")
      .eq("id", flowId)
      .single();

    if (flowErr || !flow) {
      return res.status(404).json({ ok: false, error: "Flow not found" });
    }

    // Get member count for this flow
    const { count: memberCount } = await supabase
      .from("automation_flow_members")
      .select("*", { count: "exact" })
      .eq("flow_id", flowId);

    // Get stats by node_id from automation_email_queue
    const { data: emailQueueData } = await supabase
      .from("automation_email_queue")
      .select("node_id, status")
      .eq("flow_id", flowId);

    // Group by node_id and status
    const nodeStats = {};
    let nodes = [];
    try {
      nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
    } catch {
      nodes = [];
    }
    
    // Initialize all email nodes with 0 stats
    for (const node of nodes) {
      if ((node.type || "").toLowerCase().includes("email")) {
        nodeStats[node.id] = {
          node_id: node.id,
          label: node.data?.label || "Email",
          queued: 0,
          sent: 0,
          failed: 0,
          opened: 0,
          clicked: 0,
        };
      }
    }

    // Count emails by status per node
    for (const row of emailQueueData || []) {
      if (!nodeStats[row.node_id]) continue;
      if (row.status === "pending") nodeStats[row.node_id].queued += 1;
      else if (row.status === "sent") nodeStats[row.node_id].sent += 1;
      else if (row.status === "failed") nodeStats[row.node_id].failed += 1;
      else if (row.status === "opened") nodeStats[row.node_id].opened += 1;
      else if (row.status === "clicked") nodeStats[row.node_id].clicked += 1;
    }

    // Get run progression stats
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("current_node_id, status")
      .eq("flow_id", flowId);

    const runStats = {
      total_members: memberCount || 0,
      in_progress: (runs || []).filter((r) => r.status === "pending").length,
      completed: (runs || []).filter((r) => r.status === "done").length,
      failed: (runs || []).filter((r) => r.status === "failed").length,
    };

    return res.status(200).json({
      ok: true,
      flow: {
        id: flow.id,
        name: flow.name,
        user_id: flow.user_id,
      },
      stats: {
        members: runStats,
        nodes: Object.values(nodeStats),
      },
    });
  } catch (err) {
    console.error("STATS_ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
