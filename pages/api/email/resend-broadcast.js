// ============================================
// /pages/api/email/resend-broadcast.js
// FINAL BROADCAST SENDER (STABLE)
//
// FIXES:
// ✅ Ensures ALL broadcast emails write to email_sends
// ✅ Stores sendgrid_message_id
// ✅ Stores sg_message_id
// ✅ Sets sent_at
// ✅ Proper status handling
// ============================================

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../lib/emailValidation";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const SENDGRID_KEY =
  process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function getAccountBranding(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("accounts")
    .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    if (!SENDGRID_KEY) {
      return res.status(500).json({ success: false, error: "Missing SendGrid key" });
    }

    sgMail.setApiKey(SENDGRID_KEY);

    const { broadcastId } = req.body || {};
    if (!broadcastId) {
      return res.status(400).json({ success: false, error: "Missing broadcastId" });
    }

    // Load broadcast
    const { data: broadcast, error: loadErr } = await supabase
      .from("email_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .single();

    if (loadErr || !broadcast) {
      return res.status(404).json({ success: false, error: "Broadcast not found" });
    }

    const subject = broadcast.subject;
    const html = broadcast.html_content;
    const SYSTEM_FROM_EMAIL =
      process.env.SENDGRID_FROM_EMAIL ||
      process.env.SENDGRID_FROM ||
      "no-reply@gr8result.com";
    const SYSTEM_FROM_NAME =
      process.env.SENDGRID_FROM_NAME || "GR8 RESULT";
    const accountBranding = await getAccountBranding(broadcast.user_id);

    const senderEmail = SYSTEM_FROM_EMAIL;
    const senderName =
      String(
        broadcast.from_name ||
          accountBranding?.sendgrid_from_name ||
          accountBranding?.from_name ||
          accountBranding?.brand_name ||
          accountBranding?.business_name ||
          accountBranding?.company_name ||
          SYSTEM_FROM_NAME
      ).trim() || SYSTEM_FROM_NAME;
    const replyToEmail =
      (broadcast.reply_to && isEmail(broadcast.reply_to) && broadcast.reply_to) ||
      (accountBranding?.email && isEmail(accountBranding.email) && accountBranding.email) ||
      SYSTEM_FROM_EMAIL;

    if (!subject || !html) {
      return res.status(400).json({
        success: false,
        error: "Broadcast missing subject or html_content",
      });
    }

    // Get recipients
    let recipients = [];

    if (broadcast.audience_type === "list" && broadcast.list_id) {
      const { data: leads } = await supabase
        .from("leads")
        .select("email")
        .eq("list_id", broadcast.list_id)
        .limit(20000);

      recipients = (leads || []).map((r) => r.email);
    } else if (broadcast.to_field) {
      recipients = String(broadcast.to_field)
        .split(/[,;\n]/)
        .map((x) => x.trim());
    }

    recipients = recipients.filter(isEmail);

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        error: "No valid recipients",
      });
    }

    let emailGuard = null;
    try {
      emailGuard = await guardEmailSend(broadcast.user_id, recipients.length);
    } catch (limitErr) {
      return res.status(429).json({
        success: false,
        error: limitErr.message,
        code: limitErr.code,
        details: limitErr.details,
      });
    }

    let sentCount = 0;

    for (const to of recipients) {
      // 1️⃣ Insert row FIRST
      const { data: row, error: insertErr } = await supabase
        .from("email_sends")
        .insert({
          user_id: broadcast.user_id,
          broadcast_id: broadcastId,
          email: to,
          recipient_email: to,
          email_type: "broadcast",
          subject,
          status: "processing",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Insert failed:", insertErr.message);
        continue;
      }

      try {
        const response = await sgMail.send({
          to,
          from: { email: senderEmail, name: senderName },
          replyTo: replyToEmail,
          subject,
          html,
        });

        let messageId = null;

        if (Array.isArray(response) && response[0]?.headers) {
          messageId =
            response[0].headers["x-message-id"] ||
            response[0].headers["X-Message-Id"] ||
            null;
        }

        await supabase
          .from("email_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            sendgrid_message_id: messageId,
            sg_message_id: messageId,
          })
          .eq("id", row.id);

        sentCount++;
      } catch (err) {
        await supabase
          .from("email_sends")
          .update({
            status: "failed",
            error_message: err?.message || "Send failed",
          })
          .eq("id", row.id);
      }
    }

    return res.status(200).json({
      success: true,
      sent: sentCount,
      total: recipients.length,
      usage: emailGuard || null,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Server error",
    });
  }
}
