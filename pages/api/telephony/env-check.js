// /pages/api/telephony/env-check.js
export default function handler(req, res) {
  const mask = (v) => {
    const s = String(v || "");
    if (!s) return "";
    if (s.length <= 8) return "***";
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  };

  return res.status(200).json({
    ok: true,
    TWILIO_ACCOUNT_SID: mask(process.env.TWILIO_ACCOUNT_SID),
    TWILIO_API_KEY: mask(process.env.TWILIO_API_KEY),
    TWILIO_API_SECRET: process.env.TWILIO_API_SECRET ? "(set)" : "(missing)",
    TWILIO_TWIML_APP_SID: mask(process.env.TWILIO_TWIML_APP_SID),
    TWILIO_CALLER_ID: process.env.TWILIO_CALLER_ID || "",
  });
}
