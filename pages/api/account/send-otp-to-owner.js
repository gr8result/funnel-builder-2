// /pages/api/account/send-otp-to-owner.js
// Sends a 6-digit OTP to the phone number already saved on the owner's account.
// No phone number is accepted from the client — it is always read from the DB.

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

  const userId = req.user.id;

  // Look up the owner's saved phone number from the accounts table
  const { data: acct, error: acctErr } = await supabaseAdmin
    .from("accounts")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();

  if (acctErr) {
    console.error("❌ send-otp-to-owner: accounts lookup error", acctErr);
    return res.status(500).json({ error: "Could not retrieve account details." });
  }

  const rawPhone = acct?.phone;
  if (!rawPhone?.trim()) {
    return res.status(400).json({
      error: "No phone number is saved on your account. Please add one in Account Settings before using SMS verification.",
    });
  }

  const phone = normalizeAUTo61(rawPhone.trim()) || rawPhone.trim();
  const code = crypto.randomInt(100000, 1000000).toString();

  try {
    const result = await sendSmsGlobal({
      toPhone: phone,
      message: `Your Gr8 Result verification code is: ${code}`,
    });

    if (!result?.ok) {
      const errMsg = result?.body?.error || result?.body?.message || "SMS send failed";
      console.error("❌ send-otp-to-owner SMS error:", errMsg);
      return res.status(500).json({ error: errMsg });
    }

    // Store OTP server-side — expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("accounts")
      .update({ phone_otp_pending: JSON.stringify({ code, phone, expiresAt }) })
      .eq("id", userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ send-otp-to-owner error:", err);
    return res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
}

export default withAuth(handler);
