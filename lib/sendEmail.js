// lib/sendEmail.js
// FULL REPLACEMENT
// Safe email helper used by older endpoints.
// If SendGrid is not configured, it fails gracefully instead of crashing builds.
import { isDemoWorkspace, demoSimulationResult } from "./demoWorkspace";

let sgMail = null;

function getSendGrid() {
  if (sgMail) return sgMail;

  const apiKey = process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;
  if (!apiKey) return null;

  try {
    // Avoid hard dependency crashes at build time
    const req = eval("require"); // eslint-disable-line no-eval
    const mod = req("@sendgrid/mail");
    mod.setApiKey(apiKey);
    sgMail = mod;
    return sgMail;
  } catch {
    return null;
  }
}

export async function sendEmail({
  to,
  cc,
  bcc,
  from,
  subject,
  text,
  html,
  replyTo,
  headers,
  attachments,
  workspaceId,
  userId,
}) {
  if (workspaceId && await isDemoWorkspace(workspaceId)) {
    return demoSimulationResult({
      workspaceId,
      actionType: "email",
      provider: "sendgrid",
      target: Array.isArray(to) ? to.join(",") : to,
      userId,
      payload: { to, cc, bcc, from, subject, text, html, replyTo, headers, attachmentCount: Array.isArray(attachments) ? attachments.length : 0 },
      message: "Demo email simulated - no external message sent.",
    });
  }

  const client = getSendGrid();

  if (!client) {
    return {
      ok: false,
      skipped: true,
      error:
        "Email not sent: SendGrid not configured (missing SENDGRID_API_KEY or GR8_MAIL_SEND_ONLY).",
    };
  }

  try {
    await client.send({
      to,
      cc,
      bcc,
      from,
      subject,
      text,
      html,
      replyTo,
      headers,
      attachments,
    });

    return { ok: true };
  } catch (err) {
    const providerError = err?.response?.body?.errors
      ?.map((entry) => entry?.message)
      .filter(Boolean)
      .join('; ');

    return {
      ok: false,
      error: providerError || err?.message || String(err),
    };
  }
}

export default sendEmail;
