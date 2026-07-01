import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = req.user;
  const emailVerifiedAt = user.email_confirmed_at || user.confirmed_at || null;
  if (!emailVerifiedAt) {
    return res.status(400).json({ error: "Email is not verified yet." });
  }

  const { data: account, error: fetchErr } = await supabaseAdmin
    .from("accounts")
    .select("phone_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!account?.phone_verified) {
    return res.status(400).json({ error: "Phone is not verified yet." });
  }

  const { error } = await supabaseAdmin
    .from("accounts")
    .update({
      email_verified: true,
      email_verified_at: emailVerifiedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

export default withAuth(handler);
