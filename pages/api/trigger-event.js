import { supabase } from "../../utils/supabase-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let event;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    console.error("Bad JSON:", e);
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  console.log("Incoming trigger event:", event);

  // Get flows
  const { data: flows, error: flowsError } = await supabase
    .from("automation_flows")
    .select("*")
    .eq("is_active", true);

  if (flowsError) {
    console.error("DB error:", flowsError);
    res.status(500).json({ error: "Database error" });
    return;
  }

  const active = flows || [];
  const type = (event.type || "").toLowerCase();
  const source = event.source || "";

  const matching = active.filter((flow) => {
    try {
      const nodes = JSON.parse(flow.nodes || "[]");
      return nodes.some((n) => {
        if (!n || n.type !== "trigger") return false;
        const t = (n.data?.triggerType || "").toLowerCase();
        const s = n.data?.source || "";
        if (t !== type) return false;
        if (s && s !== source) return false;
        return true;
      });
    } catch (e) {
      console.error("Flow JSON error:", e);
      return false;
    }
  });

  await supabase.from("trigger_logs").insert({
    event_type: event.type || "unknown",
    payload: event,
    matched_flows: matching.map((m) => m.id),
    created_at: new Date().toISOString(),
  });

  res.status(200).json({
    ok: true,
    matched_flows: matching.length,
  });
}
