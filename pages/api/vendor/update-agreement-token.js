// /pages/api/vendor/update-agreement-token.js
// Admin endpoint to update vendor agreement token (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agreementId, token } = req.body;
    if (!agreementId || !token) {
      return res.status(400).json({ error: "agreementId and token required" });
    }

    const { error } = await supabaseAdmin
      .from("vendor_agreements")
      .update({ token })
      .eq("id", agreementId);

    if (error) {
      console.error("Token update error:", error);
      return res.status(500).json({ error: "Failed to update token", details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
