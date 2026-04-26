// pages/api/calendar/send-verify-code.js
// Generates a 6-digit code, sends it via SMSGlobal, returns the code to the client.
// Called by the public booking page for phone verification.

import { sendSmsGlobal } from "../../../lib/smsglobal";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required." });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const result = await sendSmsGlobal({
    toPhone: phone,
    message: `Your GR8 booking verification code: ${code}`,
  });

  if (!result?.ok) {
    console.error("SMS send failed:", result);
    return res.status(500).json({ error: "Failed to send SMS. Please check the number and try again." });
  }

  return res.status(200).json({ code });
}
