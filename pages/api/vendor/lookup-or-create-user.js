// /pages/api/vendor/lookup-or-create-user.js
// Admin endpoint to look up or create marketplace users (bypasses RLS)
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: "accountId required" });
    }

    // Look up existing user by account_id
    let { data: userRow, error: queryErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("account_id", accountId)
      .maybeSingle();

    if (queryErr) {
      console.error("User lookup error:", queryErr);
      return res.status(500).json({ error: "Failed to lookup user", details: queryErr.message });
    }

    // If user exists, return it
    if (userRow) {
      return res.status(200).json({ user: userRow, created: false });
    }

    // Get account details for new user creation
    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, full_name, email")
      .eq("id", accountId)
      .single();

    if (accErr || !account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Create new marketplace user
    const { data: newUser, error: createErr } = await supabaseAdmin
      .from("users")
      .insert({
        account_id: account.id,
        name: account.full_name,
        email: account.email
      })
      .select()
      .single();

    if (createErr) {
      console.error("User creation error:", createErr);
      return res.status(500).json({ error: "Failed to create user", details: createErr.message });
    }

    return res.status(201).json({ user: newUser, created: true });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}
