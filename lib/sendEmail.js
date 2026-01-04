// lib/sendEmail.js
// FULL REPLACEMENT
// Safe email helper used by older endpoints.
// If SendGrid is not configured, it fails gracefully instead of crashing builds.

let sgMail = null;

function getSendGrid() {
  if (sgMail) return sgMail;

  const apiKey = process.env.SENDGRID_API_KEY;
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
  from,
  subject,
  text,
  html,
  replyTo,
  headers,
}) {
  const client = getSendGrid();

  if (!client) {
    return {
      ok: false,
      skipped: true,
      error:
        "Email not sent: SendGrid not configured (SENDGRID_API_KEY missing).",
    };
  }

  try {
    await client.send({
      to,
      from,
      subject,
      text,
      html,
      replyTo,
      headers,
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}

export default sendEmail;
