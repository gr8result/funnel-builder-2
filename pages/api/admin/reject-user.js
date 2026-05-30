import { supabase } from "../../../utils/supabase-client";
import { withAdmin } from "../../../lib/withAdmin";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing user ID" });

    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) throw error;

    res.status(200).json({ success: true, message: "User rejected successfully" });
  } catch (err) {
    console.error("Reject user error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export default withAdmin(handler);

