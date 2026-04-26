// Create or get a campaign for automation flow
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  const { flow_id, user_id } = req.query;

  if (!flow_id || !user_id) {
    return res.status(400).json({ error: "Missing flow_id or user_id" });
  }

  try {
    // Check if campaign exists for this flow
    const { data: existing } = await supabase
      .from("email_campaigns")
      .select("id")
      .eq("flow_id", flow_id)
      .maybeSingle();

    if (existing) {
      return res.json({ ok: true, campaign_id: existing.id });
    }

    // Create new campaign for this automation flow
    const { data: campaign, error } = await supabase
      .from("email_campaigns")
      .insert({
        user_id,
        flow_id,
        name: `Automation Flow Campaign`,
        status: "active",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, campaign_id: campaign.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
