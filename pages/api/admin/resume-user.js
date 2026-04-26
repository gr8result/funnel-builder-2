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

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing user ID" });

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
        status: "approved",
        approved: true,
        is_approved: true,
        paused_at: null,
        paused_reason: null,
      })
      .eq("id", id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    try {
      if (account.email) {
        await resend.emails.send({
          from: `GR8 RESULT Digital Solutions <${FROM_EMAIL}>`,
          to: account.email,
          subject: "Your account access has been restored",
          html: `
            <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
              <h2 style="color:#22c55e;">Account Restored</h2>
              <p>Hi ${account.full_name || "there"},</p>
              <p>Your account access has been restored and you can now log in again.</p>
              <p><a href="${LOGIN_URL}" style="background:#22c55e;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Log in</a></p>
              <br>
              <p>– The GR8 RESULT Team</p>
            </div>
          `,
        });
      }
    } catch (emailError) {
      console.error("resume-user email error:", emailError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
