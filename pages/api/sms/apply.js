// /pages/api/sms/apply.js
// Sends SMS application to support@gr8result.com

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { mobile, email } = req.body;
    const userId = req.user.id;

    if (!mobile || !email) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Save to profiles (mark as applied, but NO sender_id yet)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          sms_mobile: mobile,
          sms_email: email,
          sms_applied: true,
          sms_applied_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // If profiles table doesn't exist, continue anyway but log it
    if (profileError) {
      if (profileError.message?.includes("profiles")) {
        console.warn("⚠️ Profiles table does not exist - admin needs to create it via SQL");
        // Don't throw - continue with email notification
      } else {
        throw profileError;
      }
    }

    // Get user account info
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("full_name, business_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    const fullName = account?.full_name || "Unknown";
    const businessName = account?.business_name || "N/A";
    const userEmail = account?.email || email;

    // Send email notification to support
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: "support@gr8result.com" }],
        },
      ],
      from: { email: "support@gr8result.com", name: "SMS Applications" },
      subject: `🆕 SMS Subaccount Application - ${businessName}`,
      content: [
        {
          type: "text/html",
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #10b981;">New SMS Subaccount Application</h2>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Business Name:</strong> ${businessName}</p>
                <p><strong>Contact Name:</strong> ${fullName}</p>
                <p><strong>User Email:</strong> ${userEmail}</p>
                <p><strong>SMS Contact Email:</strong> ${email}</p>
                <p><strong>Mobile Number:</strong> ${mobile}</p>
                <p><strong>User ID:</strong> ${userId}</p>
              </div>

              <h3 style="color: #0ea5e9;">Next Steps:</h3>
              <ol style="line-height: 1.8;">
                <li>Create subaccount in SMSGlobal dashboard</li>
                <li>Copy the Sender ID code (e.g., "3q5959hs")</li>
                <li>Reply to <strong>${email}</strong> with the Sender ID</li>
                <li>User will enter the code in their account settings to activate SMS</li>
              </ol>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This application was submitted on ${new Date().toLocaleString()}
              </p>
            </div>
          `,
        },
      ],
    };

    // Send via SendGrid or your email service
    const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
    console.log(`📧 SendGrid configured: ${!!SENDGRID_KEY}`);
    if (SENDGRID_KEY) {
      try {
        console.log(`📤 Sending SMS application email to support@gr8result.com for user ${userId}`);
        const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SENDGRID_KEY}`,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!sgResponse.ok) {
          const errorText = await sgResponse.text();
          console.error("❌ SendGrid HTTP error:", sgResponse.status, errorText);
          console.warn("⚠️ Email notification failed, but application was saved");
        } else {
          console.log("✅ Email sent successfully to support@gr8result.com");
        }
      } catch (emailErr) {
        console.error("SendGrid request failed:", emailErr.message);
        console.warn("⚠️ Could not send email notification, but application was saved");
      }
    } else {
      console.warn("⚠️ SENDGRID_API_KEY not configured - email notification skipped");
    }

    return res.status(200).json({
      ok: true,
      message: "Application submitted successfully. We'll email you the SMS sender code within 24 hours.",
    });
  } catch (error) {
    console.error("SMS apply error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to process application",
    });
  }
}

export default withAuth(handler);
