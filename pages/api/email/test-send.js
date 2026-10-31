// FILE: /pages/api/email/test-send.js
import sgMail from "@sendgrid/mail";
import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveVerifiedSender } from "../../../lib/email/verifiedSender";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const key = process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY || "";
  if (!key) return res.status(500).json({ error: "SENDGRID_API_KEY missing" });

  const { to, recipients, from_email, from_name, fromEmail, fromName, subject, html, reply_to, sandbox } = req.body || {};
  const targets = [...new Set((Array.isArray(recipients) ? recipients : [to])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean))];
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("sendgrid_from_email,dkim_verified,dkim_domain")
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (accountError) return res.status(500).json({ error: "Could not load sender verification settings." });
  const verifiedSender = resolveVerifiedSender(account || {}, process.env.SENDGRID_FROM_EMAIL || "");
  if (!verifiedSender.ok) return res.status(412).json({ error: verifiedSender.error });
  const requestedSender = String(from_email || fromEmail || verifiedSender.email).trim().toLowerCase();
  if (requestedSender !== verifiedSender.email) {
    return res.status(403).json({ error: "Test email sender must match this account's verified sender address." });
  }
  const senderEmail = verifiedSender.email;
  const senderName = String(from_name || fromName || process.env.SENDGRID_FROM_NAME || "GR8 RESULT").trim();
  const testSubject = String(subject || "SendGrid test").trim();
  const htmlContent = String(html || "");

  if (!targets.length || targets.some((email) => !isEmail(email))) {
    return res.status(400).json({ error: "Provide one or more valid test recipient email addresses." });
  }
  if (!isEmail(senderEmail)) return res.status(400).json({ error: "Provide a valid sender email address." });
  if (!htmlContent.trim()) return res.status(400).json({ error: "Provide test email HTML content." });

  try {
    sgMail.setApiKey(key);
    for (const recipient of targets) {
      await sgMail.send({
        to: recipient,
        from: { email: senderEmail, name: senderName || undefined },
        ...(isEmail(reply_to) ? { replyTo: String(reply_to).trim() } : {}),
        subject: /^\[test\]/i.test(testSubject) ? testSubject : `[TEST] ${testSubject}`,
        html: htmlContent,
        ...(sandbox ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      sent: targets.length,
      sandbox: Boolean(sandbox),
      message: sandbox
        ? `SendGrid accepted ${targets.length} test message${targets.length === 1 ? "" : "s"} in sandbox mode; no delivery occurred.`
        : `Test email sent to ${targets.length} recipient${targets.length === 1 ? "" : "s"}.`,
    });
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

export default withAuth(handler);
