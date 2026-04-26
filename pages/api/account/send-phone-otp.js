// /pages/api/account/send-phone-otp.js
// Generates a 6-digit OTP, sends it via SMS to the given phone number, and returns the code
// so the client can verify it client-side. Acceptable for onboarding phone verification.

import { sendSmsGlobal, normalizeAUTo61 } from "../../../lib/smsglobal";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone } = req.body;
  if (!phone?.trim()) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const normalized = normalizeAUTo61(phone.trim());

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

    return res.status(200).json({ ok: true, code });
  } catch (err) {
    console.error("❌ send-phone-otp error:", err);
    return res.status(500).json({ error: err.message || "Failed to send OTP" });
  }
}
