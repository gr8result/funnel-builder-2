// ============================================
// /lib/email/broadcastSender.js
// FULL REPLACEMENT — Deterministic A/B by subscriber_id (fallback email)
// ============================================

import crypto from "crypto";
import sgMail from "@sendgrid/mail";

/**
 * Deterministic 50/50 split
 * Use subscriber_id first (best), fallback to email.
 * This prevents "all B" when emails are blank/duplicated.
 */
export function pickVariant({ subscriberId, email }) {
  const key = String(subscriberId || email || "").trim().toLowerCase();
  const h = crypto.createHash("sha256").update(key).digest();
  return (h[h.length - 1] % 2) === 0 ? "A" : "B";
}

export function ensureSendgrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key)
    throw Object.assign(new Error("Missing SENDGRID_API_KEY"), {
      missing: "SENDGRID_API_KEY",
    });
  sgMail.setApiKey(key);
}

export async function sendOne({
  fromEmail,
  fromName,
  replyTo,
  toEmail,
  subject,
  html,
  text,
  preheader,
  customArgs = {},
}) {
  ensureSendgrid();

  const finalHtml =
    preheader
      ? `<!--preheader--><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
          preheader
        )}</div>${html || ""}`
      : html || "";

  const msg = {
    to: toEmail,
    from: fromName ? { email: fromEmail, name: fromName } : { email: fromEmail },
    replyTo: replyTo ? { email: replyTo } : undefined,
    subject: subject || "",
    html: finalHtml,
    text: text || stripHtml(html || ""),
    customArgs,
    personalizations: [
      {
        to: toEmail,
        subject: subject || "",
        customArgs,
      },
    ],
  };

  const [resp] = await sgMail.send(msg);
  return {
    statusCode: resp?.statusCode || 202,
    headers: resp?.headers || {},
  };
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
