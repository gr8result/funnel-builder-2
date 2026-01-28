// /pages/api/automation/nodes/[nodeId]/remove-lead.js
// Remove a specific lead from a node (and delete their run)
// This effectively stops them from advancing further in the automation

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nodeId } = req.query;
  const { flow_id, lead_id, reason } = req.body;

  if (!nodeId || !flow_id || !lead_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Remove the run for this lead/flow
    const { error: deleteRunErr } = await supabase
      .from("automation_flow_runs")
      .delete()
      .eq("flow_id", flow_id)
      .eq("lead_id", lead_id)
      .eq("current_node_id", nodeId);

    if (deleteRunErr) throw deleteRunErr;

    // Update member status to 'removed'
    const { error: updateMemberErr } = await supabase
      .from("automation_flow_members")
      .update({
        status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("flow_id", flow_id)
      .eq("lead_id", lead_id);

    if (updateMemberErr) throw updateMemberErr;

    // Log the removal
    await supabase.from("automation_logs").insert({
      flow_id,
      lead_id,
      node_id: nodeId,
      action: "lead_removed",
      details: reason || "Manually removed from node",
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({
      ok: true,
      message: "Lead removed from automation",
      lead_id,
      node_id: nodeId,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
