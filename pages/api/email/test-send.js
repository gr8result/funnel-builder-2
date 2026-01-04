// FILE: /pages/api/email/test-send.js
import sgMail from "@sendgrid/mail";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const key = process.env.SENDGRID_API_KEY || "";
  if (!key) return res.status(500).json({ error: "SENDGRID_API_KEY missing" });

  const { to, from_email, from_name } = req.body || {};
  if (!to || !from_email) return res.status(400).json({ error: "Provide { to, from_email }" });

  try {
    sgMail.setApiKey(key);
    await sgMail.send({
      to,
      from: { email: from_email, name: from_name || undefined },
      subject: "SendGrid test — ✅",
      html: `<div style="font-family:Arial">Test from ${from_email}.</div>`,
    });
    return res.status(200).json({ ok: true, message: "Test email sent." });
  } catch (e) {
    const code = e?.code || e?.response?.statusCode || e?.response?.status || "unknown";
    return res.status(500).json({
      ok: false,
      code,
      error: e?.message || e?.response?.body?.errors?.[0]?.message || "Send failed",
      hint:
        code === 403
          ? "From sender not verified. Verify Single Sender or authenticate domain."
          : code === 401
          ? "API key invalid/not loaded. Fix .env and restart dev."
          : undefined,
    });
  }
}
