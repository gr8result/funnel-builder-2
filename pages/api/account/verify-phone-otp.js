// /pages/api/account/verify-phone-otp.js
// Verifies a phone OTP entirely server-side. The code is never sent to the browser.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Rate limit by user ID to prevent brute force
  const rl = checkRateLimit(`verify-otp:${req.user.id}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });

  const { code } = req.body;
  if (!code?.trim()) return res.status(400).json({ ok: false, error: "Code is required" });

  const userId = req.user.id;

  try {
    const { data: account, error } = await supabaseAdmin
      .from("accounts")
      .select("phone_otp_pending")
      .eq("id", userId)
      .maybeSingle();

    if (error || !account) return res.status(400).json({ ok: false, error: "No pending verification found" });

    let pending;
    try { pending = JSON.parse(account.phone_otp_pending || "null"); } catch { pending = null; }

    if (!pending?.code || !pending?.expiresAt) {
      return res.status(400).json({ ok: false, error: "No pending verification found" });
    }

    if (new Date() > new Date(pending.expiresAt)) {
      return res.status(400).json({ ok: false, error: "Code expired. Please request a new one." });
    }

    if (pending.code !== String(code).trim()) {
      return res.status(400).json({ ok: false, error: "Incorrect code. Please try again." });
    }

    // Clear the pending OTP
    await supabaseAdmin
      .from("accounts")
      .update({ phone_otp_pending: null })
      .eq("id", userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ verify-phone-otp error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Verification failed" });
  }
}

export default withAuth(handler);
