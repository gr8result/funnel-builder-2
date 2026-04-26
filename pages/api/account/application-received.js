// /pages/api/account/application-received.js
// Sends a confirmation email to the user when they submit their account application.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@gr8result.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  try {
    await resend.emails.send({
      from: `GR8 RESULT Digital Solutions <${FROM_EMAIL}>`,
      to: email,
      subject: "We received your GR8 RESULT application!",
      html: `
        <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
          <div style="background: linear-gradient(90deg, #4c1d95, #7c3aed); padding: 32px 28px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">Application Received!</h1>
          </div>
          <div style="background: #0b1220; padding: 32px 28px; border-radius: 0 0 12px 12px; border: 1px solid #1f2937;">
            <p style="color: #e2e8f0; font-size: 16px; margin-top: 0;">Hi ${name || "there"},</p>
            <p style="color: #e2e8f0; font-size: 16px;">
              Thank you for submitting your account application with <strong style="color: #a855f7;">GR8 RESULT Digital Solutions</strong>.
            </p>
            <p style="color: #e2e8f0; font-size: 16px;">
              Our team is reviewing your details and will get back to you within <strong>1–2 business days</strong>.
            </p>
            <p style="color: #e2e8f0; font-size: 16px;">
              You'll receive another email as soon as your account has been approved — at which point you can log in and complete your module selection.
            </p>
            <p style="color: #9ca3af; font-size: 14px; margin-top: 28px; border-top: 1px solid #1f2937; padding-top: 20px;">
              If you have any questions in the meantime, please contact us at
              <a href="mailto:${SUPPORT_EMAIL}" style="color: #a855f7;">${SUPPORT_EMAIL}</a>
            </p>
            <p style="color: #9ca3af; font-size: 14px;">– The GR8 RESULT Team</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("application-received email error:", err);
    // Non-fatal — don't block the user flow
    return res.status(200).json({ ok: true, warning: "Email send failed" });
  }
}
