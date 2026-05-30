// /pages/api/admin/approve-user.js
import { supabase } from "../../../utils/supabase-client";
import { sendEmail } from "../../../lib/sendEmail";
import { withAdmin } from "../../../lib/withAdmin";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@gr8result.com";
const APP_BASE_URL = process.env.EMAIL_APP_BASE_URL || "https://www.gr8result.com";
const BILLING_LOGIN_URL = `${APP_BASE_URL.replace(/\/$/, "")}/login?redirect=/billing`;

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    const { data: account, error: selectError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (selectError) {
      return res.status(500).json({ error: "Database lookup failed" });
    }

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        is_approved: true,
        approved: true,
        verified: true,
        status: "approved",
      })
      .eq("id", account.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message || "Update failed" });
    }

    // Send via SendGrid (real key is SENDGRID_API_KEY in .env.local)
    const emailResult = await sendEmail({
      to: account.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com", name: process.env.SENDGRID_FROM_NAME || "GR8 RESULT" },
      subject: "Your GR8 RESULT account has been approved!",
      html: `
        <!doctype html>
        <html>
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Account Approved</title>
          </head>
          <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
              Your GR8 RESULT account is approved. Complete billing to activate your dashboard.
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fb;padding:24px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px;overflow:hidden;">
                    <tr>
                      <td style="padding:0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(120deg,#0f172a 0%,#1d4ed8 65%,#0ea5e9 100%);">
                          <tr>
                            <td style="padding:28px 32px 18px 32px;">
                              <div style="font-size:12px;letter-spacing:1px;font-weight:700;color:#cbd5e1;text-transform:uppercase;">GR8 RESULT</div>
                              <h1 style="margin:12px 0 8px 0;font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;">Your account is approved</h1>
                              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#e2e8f0;">You are one step away from going live.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:30px 32px 8px 32px;">
                        <p style="margin:0 0 14px 0;font-size:17px;line-height:1.6;color:#0f172a;">Hi ${account.full_name || "there"},</p>
                        <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:#334155;">
                          Great news. Your account with <strong style="color:#0f172a;">GR8 RESULT Digital Solutions</strong> has been approved.
                        </p>
                        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#334155;">
                          To activate your dashboard, log in and complete your <strong>billing and module selection</strong>.
                          Once billing is complete, your selected tools will be available immediately.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:4px 32px 8px 32px;" align="center">
                        <a href="${BILLING_LOGIN_URL}"
                           style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;line-height:1;padding:15px 26px;border-radius:10px;box-shadow:0 8px 20px rgba(249,115,22,0.28);">
                          Log In and Complete Billing
                        </a>
                        <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;word-break:break-all;">
                          If the button does not work, copy this link into your browser:<br />
                          <a href="${BILLING_LOGIN_URL}" style="color:#2563eb;text-decoration:underline;">${BILLING_LOGIN_URL}</a>
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:22px 32px 28px 32px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                          <tr>
                            <td style="padding:14px 16px;font-size:14px;line-height:1.7;color:#475569;">
                              Need help? Contact us at
                              <a href="mailto:${SUPPORT_EMAIL}" style="color:#1d4ed8;text-decoration:none;font-weight:700;">${SUPPORT_EMAIL}</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">The GR8 RESULT Team</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (!emailResult.ok && !emailResult.skipped) {
      console.error("Approval email failed:", emailResult.error);
      return res.status(200).json({
        success: true,
        message: "User approved successfully!",
        emailStatus: "failed",
        emailError: emailResult.error,
      });
    }

    console.log("Approval email sent to " + account.email);
    return res.status(200).json({
      success: true,
      message: "User approved successfully!",
      emailStatus: "sent",
    });
  } catch (err) {
    console.error("Uncaught server error:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
export default withAdmin(handler);

