// /pages/api/account/send-phone-otp.js
// Generates a 6-digit OTP, sends it via SMS, and stores the code server-side.
// The code is NEVER returned to the client — verification is done via /api/account/verify-phone-otp.

import { sendSmsGlobal, normalizeAUTo61 } from "../../../lib/smsglobal";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = getIp(req);
  const rl = checkRateLimit(`otp:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please wait before requesting a new code." });
  }

  const { phone } = req.body;
  if (!phone?.trim()) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const normalized = normalizeAUTo61(phone.trim());
  const userId = req.user.id;

  try {
    const result = await sendSmsGlobal({
      toPhone: normalized || phone.trim(),
      message: `Your Gr8 Result verification code is: ${code}`,
    });

    if (!result?.ok) {
      const errMsg = result?.body?.error || result?.body?.message || "SMS send failed";
      console.error("❌ send-phone-otp SMS error:", errMsg);
      return res.status(500).json({ error: errMsg });
    }

    // Store OTP server-side — expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("accounts")
      .update({ phone_otp_pending: JSON.stringify({ code, phone: normalized || phone.trim(), expiresAt }) })
      .eq("user_id", userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ send-phone-otp error:", err);
    return res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
}

export default withAuth(handler);

