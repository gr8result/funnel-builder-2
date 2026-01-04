// /pages/api/email/automations/trigger.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { lead_id, list_id, flow_id } = req.body;

    // ✅ Check required fields
    if (!lead_id || !list_id || !flow_id) {
      return res
        .status(400)
        .json({ error: "Missing lead_id, list_id, or flow_id" });
    }

const now = new Date().toISOString();

const { error } = await supabase.from("automation_queue").insert([
  {
    user_id: "3c921040-cd45-4a05-ba74-60db34591091", // Waite and Sea UID
    subscriber_id: "b22c33d4-e55f-6677-8899-aabbccddeeff", // test subscriber
    flow_id,
    lead_id,
    list_id,
    next_node_id: "00000000-0000-0000-0000-000000000000", // temp UUID
    run_at: now, // 👈 fix for this error
    status: "pending",
    created_at: now,
    updated_at: now,
  },
]);


    if (error) throw error;

    return res.status(200).json({
      message: "✅ Job added to queue successfully",
    });
  } catch (err) {
    console.error("Trigger error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
