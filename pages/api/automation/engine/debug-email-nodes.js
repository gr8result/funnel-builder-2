// Debug email nodes
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

    let nodes = [];
    if (flow.nodes) {
      if (typeof flow.nodes === "object") {
        nodes = flow.nodes;
      } else if (typeof flow.nodes === "string") {
        nodes = JSON.parse(flow.nodes);
      }
    }

    // Get email nodes and their data
    const emailNodes = nodes.filter((n) => n.type?.toLowerCase() === "email");

    return res.json({
      flow_id: flow.id,
      flow_name: flow.name,
      email_nodes: emailNodes.map((n) => ({
        id: n.id,
        label: n.data?.label,
        emailPreviewUrl: n.data?.emailPreviewUrl,
        emailId: n.data?.emailId,
        preview_url: n.data?.preview_url,
        email_id: n.data?.email_id,
        htmlPath: n.data?.htmlPath,
        storagePath: n.data?.storagePath,
        all_keys: Object.keys(n.data || {}),
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
