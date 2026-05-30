import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const { flowId } = req.body || {};
  if (!flowId) {
    return res.status(400).json({ ok: false, error: "Missing flowId" });
  }
  try {
    // Delete node history
    const { error: histErr } = await supabase
      .from("automation_flow_node_history")
      .delete()
      .eq("flow_id", flowId);
    if (histErr) return res.status(500).json({ ok: false, error: histErr.message });

    // Delete runs
    const { error: runErr } = await supabase
      .from("automation_flow_runs")
      .delete()
      .eq("flow_id", flowId);
    if (runErr) return res.status(500).json({ ok: false, error: runErr.message });

    // Delete email queue
    const { error: queueErr } = await supabase
      .from("automation_email_queue")
      .delete()
      .eq("flow_id", flowId);
    if (queueErr) return res.status(500).json({ ok: false, error: queueErr.message });

    // Delete email sends
    const { error: sendErr } = await supabase
      .from("automation_email_sends")
      .delete()
      .eq("flow_id", flowId);
    if (sendErr) return res.status(500).json({ ok: false, error: sendErr.message });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

export default withAuth(handler);
