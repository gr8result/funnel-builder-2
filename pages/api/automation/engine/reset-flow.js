// Reset flow runs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const flowId = (req.query.flow_id || "").toString().trim();
  const action = (req.query.action || "").toString().toLowerCase();
  if (!flowId || !action) return res.status(400).json({ error: "Missing flow_id or action" });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (action === "delete-failed-runs") {
      const { error } = await supabase
        .from("automation_flow_runs")
        .delete()
        .eq("flow_id", flowId)
        .eq("status", "failed");

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, message: "Deleted failed runs" });
    }

    if (action === "delete-all-runs") {
      const { error } = await supabase
        .from("automation_flow_runs")
        .delete()
        .eq("flow_id", flowId);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, message: "Deleted all runs" });
    }

    if (action === "delete-all-queued-emails") {
      const { error } = await supabase
        .from("automation_email_queue")
        .delete()
        .eq("flow_id", flowId)
        .eq("status", "pending");

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, message: "Deleted all queued emails" });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
