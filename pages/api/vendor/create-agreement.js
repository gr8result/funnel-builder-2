// /pages/api/vendor/create-agreement.js
// Admin endpoint to create vendor agreement (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { record } = req.body;
    if (!record || !record.user_id) {
      return res.status(400).json({ error: "Invalid agreement record" });
    }

    const { data, error } = await supabaseAdmin
      .from("vendor_agreements")
      .insert(record);

    if (error) {
      console.error("Agreement creation error:", error);
      return res.status(500).json({ error: "Failed to create agreement", details: error.message });
    }

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
