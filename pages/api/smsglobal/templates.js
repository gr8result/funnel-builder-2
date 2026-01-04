import { supabase } from "../../../utils/supabase-client";

export default async function handler(req, res) {
  const { user_id } = req.query;

  const { data } = await supabase
    .from("sms_templates")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at");

  res.json(data || []);
}
