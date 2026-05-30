import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  const user_id = req.user.id;

  const { data } = await supabase
    .from("sms_templates")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at");

  res.json(data || []);
}

export default withAuth(handler);
