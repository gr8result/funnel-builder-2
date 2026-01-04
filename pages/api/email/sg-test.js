// /pages/api/email/sg-test.js
// Simple SendGrid key test – GET /api/email/sg-test?to=you@yourdomain.com

import sgMail from "@sendgrid/mail";

const SENDGRID_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "GR8 RESULT";

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  if (!SENDGRID_KEY) {
    return res
      .status(500)
      .json({ error: "SENDGRID_API_KEY env var is missing" });
  }

  if (!FROM_EMAIL) {
    return res
      .status(500)
      .json({ error: "SENDGRID_FROM_EMAIL env var is missing" });
  }

  const to = (req.query.to || FROM_EMAIL).toString().trim();

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "SendGrid SG-TEST",
      html: "<p>If you see this, the API key works.</p>",
    });

    return res.status(200).json({
      ok: true,
      sent_to: to,
    });
  } catch (e) {
    const detail =
      e?.message ||
      e?.response?.body?.errors?.[0]?.message ||
      "Unknown SendGrid error";
    return res.status(500).json({
      error: detail,
    });
  }
}
