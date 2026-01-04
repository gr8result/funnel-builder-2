// /pages/api/admin/approve-user.js
import { supabase } from "../../../utils/supabase-client";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  console.log("🟢 /api/admin/approve-user called");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.body;
  console.log("📦 Incoming request body:", req.body);

  if (!id) {
    console.error("❌ Missing 'id' in request body");
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    console.log("🌍 Using Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

    // Locate account by ID
    let { data: account, error: selectError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (selectError) {
      console.error("❌ Select error:", selectError.message);
      return res.status(500).json({ error: "Database lookup failed" });
    }

    if (!account) {
      console.error("❌ No account found for:", id);
      return res.status(404).json({ error: "Account not found" });
    }

    console.log("✅ Found account:", account);

    // Update approval status
    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        is_approved: true,
        approved: true,
        status: "approved",
      })
      .eq("id", account.id);

    if (updateError) {
      console.error("❌ Update error:", updateError.message);
      return res.status(500).json({ error: "Error updating account" });
    }

    console.log("✅ Account successfully approved!");

    // Send approval email
    try {
      await resend.emails.send({
        from: "GR8 RESULT Digital Solutions <no-reply@gr8result.com.au>",
        to: account.email,
        subject: "Your GR8 RESULT account has been approved!",
        html: `
          <div style="font-family: system-ui, Arial, sans-serif; line-height: 1.6;">
            <h2 style="color:#f97316;">Your account has been approved!</h2>
            <p>Hi ${account.full_name || "there"},</p>
            <p>Your account with <strong>GR8 RESULT Digital Solutions</strong> has been approved.</p>
            <p>You can now log in and you’ll be automatically taken to the <strong>Billing & Modules</strong> page to select the modules you want and complete payment.</p>
            <p>Once payment is confirmed, your dashboard access will be unlocked automatically.</p>
            <p><a href="https://www.gr8result.com.au/login" style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Log in to your account</a></p>
            <br>
            <p>– The GR8 RESULT Team</p>
          </div>
        `,
      });

      console.log(`📧 Approval email sent to ${account.email}`);
    } catch (emailErr) {
      console.error("⚠️ Email send error:", emailErr);
      // Don’t fail the API if the email fails
    }

    return res.status(200).json({ success: true, message: "User approved successfully!" });
  } catch (err) {
    console.error("🔥 Uncaught server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
