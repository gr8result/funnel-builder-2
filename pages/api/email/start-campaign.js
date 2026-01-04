import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { campaignsId } = req.body;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: campaigns } = await supabase.from("email_campaigns").select("*").eq("id", campaignsId).single();
    if (!campaigns) throw new Error("campaigns not found");

    const { data: leads } = await supabase.from("leads").select("id").eq("list_id", campaigns.subscriber_list_id);
    if (!leads || leads.length === 0) throw new Error("List is empty");

    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignsId);

    const queueData = leads.map(l => ({
      campaigns_id: campaignsId,
      subscriber_id: l.id,
      user_id: campaigns.user_id, // THE FIX: Database requires this column
      status: "pending",
      scheduled_at: new Date().toISOString()
    }));

    const { error: queueError } = await supabase.from("email_campaigns_queue").insert(queueData);
    if (queueError) throw queueError;

    return res.status(200).json({ success: true, count: leads.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}