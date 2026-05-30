// /pages/api/vendor/resolve-marketplace-user.js
// Admin endpoint to resolve marketplace users by user_code (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userCode } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: "userCode required" });
    }

    // Look up user by user_code
    const { data: userRow, error: queryErr } = await supabaseAdmin
      .from("users")
      .select("id,name,email,phone,user_code")
      .eq("user_code", userCode)
      .single();

    if (queryErr) {
      if (queryErr.code === "PGRST116") {
        return res.status(404).json({ error: "User account not found in marketplace" });
      }
      console.error("User lookup error:", queryErr);
      return res.status(500).json({ error: "Failed to lookup user", details: queryErr.message });
    }

    return res.status(200).json({ user: userRow });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
