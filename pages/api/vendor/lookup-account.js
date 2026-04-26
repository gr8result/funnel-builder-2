// /pages/api/vendor/lookup-account.js
// Admin endpoint to look up account by email (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    // Look up account by email
    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, full_name, email")
      .eq("email", email.trim())
      .maybeSingle();

    if (accErr) {
      console.error("Account lookup error:", accErr);
      return res.status(500).json({ error: "Database error", details: accErr.message });
    }

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.status(200).json({ account });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}
