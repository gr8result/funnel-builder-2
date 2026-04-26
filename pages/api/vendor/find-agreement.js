// /pages/api/vendor/find-agreement.js
// Admin endpoint to find vendor agreement (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, email } = req.body;

    let agreement = null;

    // Try by user_id first
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from("vendor_agreements")
        .select("id, token, verified, email, full_name, signer_name, phone, business_name, abn, app_address")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Agreement lookup by user_id error:", error);
        return res.status(500).json({ error: "Failed to lookup agreement", details: error.message });
      }

      agreement = data;
    }

    // Try by email if not found and email provided
    if (!agreement && email?.trim()) {
      const { data, error } = await supabaseAdmin
        .from("vendor_agreements")
        .select("id, token, verified, email, full_name, signer_name, phone, business_name, abn, app_address")
        .ilike("email", email.trim())
        .maybeSingle();

      if (error) {
        console.error("Agreement lookup by email error:", error);
        return res.status(500).json({ error: "Failed to lookup agreement", details: error.message });
      }

      agreement = data;
    }

    return res.status(200).json({ agreement: agreement || null });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}
