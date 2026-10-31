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
import { withAuth } from "../../../lib/withWorkspace";
import { isDemoWorkspace, recordDemoAction } from "../../../lib/demoWorkspace";
import { hasEmailMarketingConsent } from "../../../lib/marketingConsent";
import { resolveVerifiedSender } from "../../../lib/email/verifiedSender";
import { buildUnsubscribeUrls, injectUnsubscribeUrl, normalizeUnsubscribeEmail, uniqEmails } from "../../../lib/email/unsubscribe";

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
    .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, email, sendgrid_from_email, dkim_verified, dkim_domain")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const { broadcastId } = req.body || {};
    const user = req.user;
    if (!broadcastId) {
      return res.status(400).json({ success: false, error: "Missing broadcastId" });
    }

    // Load broadcast
    const { data: broadcast, error: loadErr } = await supabase
      .from("email_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .eq("user_id", user.id)
      .single();

    if (loadErr || !broadcast) {
      return res.status(404).json({ success: false, error: "Broadcast not found" });
    }
    // No fallback: a broadcast without its own workspace is quarantined legacy data and cannot be resent.
    const workspaceId = broadcast.workspace_id || null;
    if (!workspaceId) return res.status(400).json({ success: false, error: "Broadcast is not linked to a builder workspace." });
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) return res.status(500).json({ success: false, error: "Could not verify workspace access." });
    if (!membership) return res.status(403).json({ success: false, error: "You do not have access to this broadcast workspace." });
    const isDemo = req.isDemoWorkspace || await isDemoWorkspace(workspaceId);

    const subject = broadcast.subject;
    const html = broadcast.html_content;
    const SYSTEM_FROM_NAME =
      process.env.SENDGRID_FROM_NAME || "GR8 RESULT";
    const accountBranding = await getAccountBranding(broadcast.user_id);

    const verifiedSender = resolveVerifiedSender(
      accountBranding || {},
      process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || "",
    );
    if (!verifiedSender.ok) return res.status(412).json({ success: false, error: verifiedSender.error });

    const senderEmail = verifiedSender.email;
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
      senderEmail;

    if (!subject || !html) {
      return res.status(400).json({
        success: false,
        error: "Broadcast missing subject or html_content",
      });
    }

    // Get recipients
    let recipients = [];

    if (broadcast.audience_type === "list" && broadcast.list_id) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("email,email_marketing_consent,email_marketing_opt_out")
        .eq("workspace_id", workspaceId)
        .eq("list_id", broadcast.list_id)
        .limit(20000);
      if (leadsError) return res.status(503).json({ success: false, error: "Consent data is unavailable. Apply the marketing consent migration before resending." });
      recipients = (leads || []).filter(hasEmailMarketingConsent).map((r) => r.email);
    } else if (broadcast.to_field) {
      const requested = String(broadcast.to_field)
        .split(/[,;\n]/)
        .map((x) => normalizeUnsubscribeEmail(x));
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("email,email_marketing_consent,email_marketing_opt_out")
        .eq("workspace_id", workspaceId)
        .in("email", requested);
      if (leadsError) return res.status(503).json({ success: false, error: "Consent data is unavailable. Apply the marketing consent migration before resending." });
      recipients = (leads || []).filter(hasEmailMarketingConsent).map((lead) => lead.email);
    }

    recipients = uniqEmails(recipients).filter(isEmail);
    const { data: suppressionRows, error: suppressionError } = await supabase
      .from("email_sends")
      .select("recipient_email,email,to_email,unsubscribed,status")
      .eq("user_id", broadcast.user_id)
      .in("recipient_email", recipients);
    if (suppressionError && recipients.length) return res.status(503).json({ success: false, error: "Unsubscribe suppression could not be verified; resend was stopped." });
    const suppressed = new Set((suppressionRows || [])
      .filter((row) => row.unsubscribed || ["unsubscribe", "unsubscribed"].includes(String(row.status || "").toLowerCase()))
      .map((row) => normalizeUnsubscribeEmail(row.recipient_email || row.email || row.to_email)));
    recipients = recipients.filter((email) => !suppressed.has(normalizeUnsubscribeEmail(email)));

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        error: "No valid recipients",
      });
    }

    let emailGuard = null;
    if (!isDemo) {
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
      if (!SENDGRID_KEY) {
        return res.status(500).json({ success: false, error: "Missing SendGrid key" });
      }
      sgMail.setApiKey(SENDGRID_KEY);
    } else {
      emailGuard = { demo: true, allowed: true, requested: recipients.length };
    }

    let sentCount = 0;

    for (const to of recipients) {
      // 1️⃣ Insert row FIRST
      const { data: row, error: insertErr } = await supabase
        .from("email_sends")
        .insert({
          user_id: broadcast.user_id,
          workspace_id: workspaceId,
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

      if (isDemo) {
        await recordDemoAction({
          workspaceId,
          actionType: "broadcast-email-resend",
          provider: "sendgrid",
          target: to,
          payload: { broadcastId, subject },
          simulatedResult: { ok: true, demo: true, simulated: true, message_id: `demo_email_${row.id}` },
          userId: broadcast.user_id,
        });
        await supabase
          .from("email_sends")
          .update({
            status: "demo_simulated",
            sent_at: new Date().toISOString(),
            sendgrid_message_id: `demo_email_${row.id}`,
            sg_message_id: `demo_email_${row.id}`,
          })
          .eq("id", row.id);
        sentCount++;
        continue;
      }

      try {
        const normalizedTo = normalizeUnsubscribeEmail(to);
        const { apiUrl: unsubscribeApiUrl, pageUrl: unsubscribePageUrl } = buildUnsubscribeUrls({ req, userId: broadcast.user_id, email: normalizedTo });
        const response = await sgMail.send({
          to: normalizedTo,
          from: { email: senderEmail, name: senderName },
          replyTo: replyToEmail,
          subject,
          html: injectUnsubscribeUrl(html, unsubscribePageUrl),
            headers: unsubscribeApiUrl
              ? { "List-Unsubscribe": `<${unsubscribeApiUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
            : undefined,
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

export default withAuth(handler);
