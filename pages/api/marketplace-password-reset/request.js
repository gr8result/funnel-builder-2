import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmail } from "../../../lib/sendEmail";
import { createMarketplaceResetToken } from "../../../lib/marketplacePasswordResetToken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    // Always return success-ish response to avoid account enumeration.
    if (!user?.id) {
      return res.status(200).json({ ok: true, message: "If an account exists, a reset email has been sent." });
    }

    const token = createMarketplaceResetToken(email);
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const resetUrl = `${origin}/marketplace/reset-password?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      from: "support@gr8result.com",
      subject: "Reset your Xchange Marketplace password",
      text: `Click this link to reset your password: ${resetUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>Reset your Xchange Marketplace password</h2>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>This link expires in 30 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true, message: "If an account exists, a reset email has been sent." });
  } catch (error) {
    console.error("Marketplace password reset request error:", error);
    return res.status(500).json({ error: "Failed to process password reset request" });
  }
}
