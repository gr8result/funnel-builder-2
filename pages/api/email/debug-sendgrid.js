// FILE: /pages/api/email/debug-sendgrid.js
import sgMail from "@sendgrid/mail";

export default async function handler(req, res) {
  const key = process.env.SENDGRID_API_KEY || "";
  if (!key) return res.status(500).json({ ok: false, error: "SENDGRID_API_KEY missing" });
  try {
    sgMail.setApiKey(key);
    const resp = await sgMail.client.request({ method: "GET", url: "/v3/scopes" });
    const scopes = resp?.[1]?.scopes || [];
    const has = scopes.includes("mail.send");
    return res.status(200).json({
      ok: true,
      has_mail_send_scope: has,
      sample_scopes: scopes.slice(0, 10),
      hint: has ? "Good." : "Recreate key with Mail Send: Full Access.",
    });
  } catch (e) {
    const code = e?.code || e?.response?.statusCode || e?.response?.status || "unknown";
    return res.status(500).json({
      ok: false,
      code,
      error: e?.message || e?.response?.body?.errors?.[0]?.message || "SendGrid auth check failed",
      hint: code === 401 ? "Wrong/expired key OR server not restarted." : undefined,
    });
  }
}
