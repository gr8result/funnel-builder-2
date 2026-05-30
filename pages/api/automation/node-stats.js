import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    const { flowId } = req.query;
    if (!flowId) {
      return res.status(400).json({ ok: false, error: "Missing flowId" });
    }

    // Fetch node stats for this flow
    const { data: visits, error } = await supabase
      .from("automation_flow_node_visits")
      .select("node_id,status")
      .eq("flow_id", flowId);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Aggregate stats per node
    const stats = {};
    for (const v of visits || []) {
      const id = v.node_id;
      if (!stats[id]) {
        stats[id] = {
          node_id: id,
          processed: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          passed: 0,
        };
      }
      if (v.status === "processed") stats[id].processed++;
      if (v.status === "delivered") stats[id].delivered++;
      if (v.status === "opened") stats[id].opened++;
      if (v.status === "clicked") stats[id].clicked++;
      if (v.status === "bounced") stats[id].bounced++;
      if (v.status === "unsubscribed") stats[id].unsubscribed++;
      if (v.status === "passed") stats[id].passed++;
    }

    return res.json({ ok: true, data: Object.values(stats) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

export default withAuth(handler);
