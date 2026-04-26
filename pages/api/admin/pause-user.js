import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
const APP_BASE_URL = process.env.EMAIL_APP_BASE_URL || "https://www.gr8result.com";
const LOGIN_URL = `${APP_BASE_URL.replace(/\/$/, "")}/login`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing user ID" });
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: "Missing pause reason" });

  try {
    const { data: account, error: fetchError } = await supabaseAdmin
      .from("accounts")
      .select("id, email, full_name")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!account) return res.status(404).json({ error: "Account not found" });

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({
        status: "paused",
        approved: false,
        is_approved: false,
        paused_at: new Date().toISOString(),
        paused_reason: String(reason).trim(),
      })
      .eq("id", id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    try {
      if (account.email) {
        await resend.emails.send({
          from: `GR8 RESULT Digital Solutions <${FROM_EMAIL}>`,
          to: account.email,
          subject: "Your account has been paused pending review",
          html: `
            <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
              <h2 style="color:#f97316;">Account Temporarily Paused</h2>
              <p>Hi ${account.full_name || "there"},</p>
              <p>Your account has been temporarily paused due to a potential policy or compliance issue.</p>
              <p><strong>Reason:</strong> ${String(reason).trim()}</p>
              <p>Please contact support to resolve this issue. Continued unresolved violations may result in permanent account deletion.</p>
              <p><a href="${LOGIN_URL}" style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Contact Support</a></p>
              <br>
              <p>– The GR8 RESULT Team</p>
            </div>
          `,
        });
      }
    } catch (emailError) {
      console.error("pause-user email error:", emailError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
