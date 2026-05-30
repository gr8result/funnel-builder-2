// Quick diagnostic to see flow status
import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function handler(req, res) {
  const { flow_id } = req.query;

  if (!flow_id) {
    return res.status(400).json({ error: "Missing flow_id" });
  }

  try {
    // Get members
    const { data: members } = await supabase
      .from("automation_flow_members")
      .select("*")
      .eq("flow_id", flow_id);

    // Get runs
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("*")
      .eq("flow_id", flow_id);

    // Get history
    const { data: history } = await supabase
      .from("automation_flow_node_history")
      .select("*")
      .eq("flow_id", flow_id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get queued emails
    const { data: queue } = await supabase
      .from("email_campaigns_queue")
      .select("*")
      .eq("flow_id", flow_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Count by node
    const historyByNode = {};
    (history || []).forEach((h) => {
      if (!historyByNode[h.node_id]) {
        historyByNode[h.node_id] = [];
      }
      historyByNode[h.node_id].push({
        lead_id: h.lead_id,
        created_at: h.created_at,
      });
    });

    const runsByNode = {};
    (runs || []).forEach((r) => {
      if (!runsByNode[r.current_node_id]) {
        runsByNode[r.current_node_id] = [];
      }
      runsByNode[r.current_node_id].push({
        id: r.id,
        lead_id: r.lead_id,
        status: r.status,
      });
    });

    return res.json({
      ok: true,
      flow_id,
      members_count: members?.length || 0,
      runs_count: runs?.length || 0,
      history_count: history?.length || 0,
      queue_count: queue?.length || 0,
      members: members?.map((m) => ({
        lead_id: m.lead_id,
        status: m.status,
        enrolled_at: m.enrolled_at,
      })),
      runs: runs?.map((r) => ({
        id: r.id,
        lead_id: r.lead_id,
        current_node_id: r.current_node_id,
        status: r.status,
        available_at: r.available_at,
      })),
      history_by_node: historyByNode,
      runs_by_node: runsByNode,
      recent_queue: queue?.map((q) => ({
        id: q.id,
        to_email: q.to_email,
        subject: q.subject,
        status: q.status,
        node_id: q.node_id,
        created_at: q.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err),
    });
  }
}

export default withAuth(handler);
