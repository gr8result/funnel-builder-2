// Debug endpoint to check flow structure
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const flowId = (req.query.flow_id || "").toString().trim();
  if (!flowId) return res.status(400).json({ error: "Missing flow_id" });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: flow, error } = await supabase
      .from("automation_flows")
      .select("id, nodes, edges, name")
      .eq("id", flowId)
      .single();

    if (error || !flow) {
      return res.status(404).json({ error: error?.message || "Not found" });
    }

    // Try to parse nodes
    let parsedNodes = [];
    if (flow.nodes) {
      if (typeof flow.nodes === "object") {
        parsedNodes = flow.nodes;
      } else if (typeof flow.nodes === "string") {
        try {
          parsedNodes = JSON.parse(flow.nodes);
        } catch (e) {
          return res.json({
            raw_nodes: flow.nodes,
            parse_error: e.message,
            nodes_type: typeof flow.nodes,
            nodes_length: flow.nodes?.length || 0,
          });
        }
      }
    }

    // Get runs to see what current_node_id values exist
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("id, lead_id, current_node_id, status")
      .eq("flow_id", flowId);

    return res.json({
      flow_id: flow.id,
      flow_name: flow.name,
      nodes_count: parsedNodes.length,
      nodes: parsedNodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
      edges_count: Array.isArray(flow.edges) ? flow.edges.length : (flow.edges ? "string" : 0),
      runs: runs || [],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
