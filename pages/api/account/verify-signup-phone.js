import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

function clean(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getIp(req);
  const rl = checkRateLimit(`verify-signup-phone:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return res.status(429).json({ error: "Too many attempts. Please try again later." });

  const email = clean(req.body?.email).toLowerCase();
  const code = clean(req.body?.code);
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

  const { data: account, error } = await supabaseAdmin
    .from("accounts")
    .select("user_id, phone_otp_pending, email_verified")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !account) return res.status(400).json({ error: "No pending verification found." });

  let pending = null;
  try {
    pending = JSON.parse(account.phone_otp_pending || "null");
  } catch {}

  if (!pending?.code || !pending?.expiresAt) {
    return res.status(400).json({ error: "No pending verification found." });
  }

  if (new Date() > new Date(pending.expiresAt)) {
    return res.status(400).json({ error: "Code expired. Please request a new one." });
  }

  if (String(pending.code) !== code) {
    return res.status(400).json({ error: "Incorrect code. Please try again." });
  }

  const { data: userData } = account.user_id
    ? await supabaseAdmin.auth.admin.getUserById(account.user_id)
    : { data: null };
  const emailVerifiedAt = userData?.user?.email_confirmed_at || null;

  const patch = {
    phone_verified: true,
    phone_verified_at: new Date().toISOString(),
    email_verified: !!emailVerifiedAt || account.email_verified === true,
    email_verified_at: emailVerifiedAt,
    phone_otp_pending: null,
    status: "pending",
    updated_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from("accounts")
    .update(patch)
    .eq("user_id", account.user_id);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  return res.status(200).json({ ok: true, emailVerified: !!emailVerifiedAt });
}
