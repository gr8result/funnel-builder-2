// /pages/api/website/contact-form-email.js
// Sends a website Contact Form submission to a configured business email address,
// with an optional auto-reply back to the submitter.

import { sendEmail } from "../../../lib/sendEmail";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findSubmitterEmail(fields = []) {
  const emailField = fields.find((field) => String(field?.type || "").toLowerCase() === "email")
    || fields.find((field) => EMAIL_RE.test(String(field?.value || "")));
  const value = String(emailField?.value || "").trim();
  return EMAIL_RE.test(value) ? value : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const rl = checkRateLimit(`contact-form-email:${getIp(req)}`, 10, 60 * 1000);
  if (!rl.ok) return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });

  const {
    toEmail = "",
    subject = "",
    fields = [],
    page = "",
    submittedAt = "",
    autoReply = null,
  } = req.body || {};

  const to = String(toEmail || "").trim();
  if (!to || !EMAIL_RE.test(to)) {
    return res.status(500).json({ ok: false, error: "This form is not configured with a valid recipient email address." });
  }
  if (!Array.isArray(fields) || !fields.length) {
    return res.status(400).json({ ok: false, error: "No form fields were submitted." });
  }

  const cleanFields = fields
    .map((field) => ({
      label: String(field?.label || field?.name || "").trim(),
      value: String(field?.value || "").trim(),
    }))
    .filter((field) => field.label);

  const submitterEmail = findSubmitterEmail(fields);
  const emailSubject = String(subject || "").trim() || "New website enquiry";

  const textLines = cleanFields.map((field) => `${field.label}: ${field.value || "-"}`);
  if (page) textLines.push(`Page: ${page}`);
  if (submittedAt) textLines.push(`Submitted: ${submittedAt}`);

  const htmlRows = cleanFields
    .map((field) => `<tr><td style="padding:4px 12px 4px 0;color:#475569;font-weight:600;white-space:nowrap;">${escapeHtml(field.label)}</td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(field.value || "-")}</td></tr>`)
    .join("");

  const result = await sendEmail({
    to,
    from: process.env.WEBSITE_CONTACT_FORM_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || to,
    replyTo: submitterEmail || undefined,
    subject: emailSubject,
    text: textLines.join("\n"),
    html: `<table cellpadding="0" cellspacing="0">${htmlRows}</table>`,
  });

  if (!result.ok) {
    return res.status(500).json({ ok: false, error: result.error || "Could not send the enquiry email." });
  }

  if (autoReply?.enabled && submitterEmail) {
    await sendEmail({
      to: submitterEmail,
      from: process.env.WEBSITE_CONTACT_FORM_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || to,
      subject: String(autoReply.subject || "").trim() || "We received your enquiry",
      text: String(autoReply.message || "").trim() || "Thanks for reaching out - we've received your enquiry and will be in touch shortly.",
    });
  }

  return res.status(200).json({ ok: true });
}
