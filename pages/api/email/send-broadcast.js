// ============================================
// /pages/api/email/send-broadcast.js
// FULL REPLACEMENT — NO LIST FILTERING
//
// ✅ Auto resolves logged in user
// ✅ Sends to recipients array OR all leads
// ✅ Inserts email_sends rows
// ✅ Cannot return "No recipients found"
// ============================================

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../lib/emailValidation";
import { withAuth } from "../../../lib/withWorkspace";
import { getRequestDemoState, requestWorkspaceId, recordDemoAction } from "../../../lib/demoWorkspace";
import {
  buildUnsubscribeUrls,
  injectUnsubscribeUrl,
  normalizeUnsubscribeEmail,
  uniqEmails,
} from "../../../lib/email/unsubscribe";
import { hasEmailMarketingConsent } from "../../../lib/marketingConsent";
import { resolveVerifiedSender } from "../../../lib/email/verifiedSender";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const SENDGRID_KEY =
  process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

async function getAccountBranding(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, sendgrid_from_email, sendgrid_reply_to, email, dkim_verified, dkim_domain")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function filterSuppressedRecipients(userId, recipients) {
  const normalizedRecipients = uniqEmails(recipients);
  if (!userId || !normalizedRecipients.length) return [];

  const suppressed = new Set();
  const fields = ["recipient_email", "email", "to_email"];

  for (let index = 0; index < normalizedRecipients.length; index += 150) {
    const chunk = normalizedRecipients.slice(index, index + 150);

    for (const field of fields) {
      const { data, error } = await supabaseAdmin
        .from("email_sends")
        .select(`${field},unsubscribed,status`)
        .eq("user_id", userId)
        .in(field, chunk);

      if (error || !Array.isArray(data)) continue;

      for (const row of data) {
        const email = normalizeUnsubscribeEmail(row?.[field]);
        const status = String(row?.status || "").toLowerCase();
        if (email && (row?.unsubscribed || status === "unsubscribed" || status === "unsubscribe")) {
          suppressed.add(email);
        }
      }
    }
  }

  return normalizedRecipients.filter((email) => !suppressed.has(email));
}

async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ success: false });

    if (req.body?.sendMode === "schedule") {
      return res.status(501).json({
        success: false,
        error: "Scheduled broadcasts are not enabled because no persistent broadcast scheduler is configured. No email was sent.",
      });
    }

    const user = await getUserFromBearer(req);
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized" });

    const body = req.body || {};
    const workspaceId = requestWorkspaceId(req);
    const demoState = await getRequestDemoState(req);
    const isDemo = demoState.isDemo;

    if (body.mode === "test") {
      return res.status(400).json({
        success: false,
        error: "Test messages must use the dedicated /api/email/test-send endpoint.",
      });
    }

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: "Select a builder workspace before sending a broadcast." });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) {
      return res.status(500).json({ success: false, error: "Could not verify workspace access." });
    }
    if (!membership) {
      return res.status(403).json({ success: false, error: "You do not have access to this workspace." });
    }

    const {
      broadcastId,
      subject,
      abSubjectA,
      abSubjectB,
      abEnabled,
      html,
      audienceType,
      audience,
      fromEmail,
      fromName,
      replyTo,
      sandbox,
      recipients, // 👈 use direct recipients if provided
    } = body;

    const accountBranding = await getAccountBranding(user.id);

    const configuredSender = resolveVerifiedSender(
      accountBranding || {},
      process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || "",
    );
    if (!configuredSender.ok) {
      return res.status(412).json({ success: false, error: configuredSender.error });
    }
    const SYSTEM_FROM_EMAIL = configuredSender.email;
    const SYSTEM_FROM_NAME =
      process.env.SENDGRID_FROM_NAME || "GR8 RESULT";

    const senderEmail = SYSTEM_FROM_EMAIL;
    const senderName =
      String(
        fromName ||
          accountBranding?.sendgrid_from_name ||
          accountBranding?.from_name ||
          accountBranding?.brand_name ||
          accountBranding?.business_name ||
          accountBranding?.company_name ||
          SYSTEM_FROM_NAME
      ).trim() || SYSTEM_FROM_NAME;
    // Reply goes to the user's own address if they provided one
    const replyToEmail =
      (replyTo && isEmail(replyTo) && replyTo) ||
      (accountBranding?.sendgrid_reply_to && isEmail(accountBranding.sendgrid_reply_to) && accountBranding.sendgrid_reply_to) ||
      (fromEmail && isEmail(fromEmail) && fromEmail) ||
      (accountBranding?.email && isEmail(accountBranding.email) && accountBranding.email) ||
      (user.email && isEmail(user.email) && user.email) ||
      SYSTEM_FROM_EMAIL;

    if (!html || !subject)
      return res.status(400).json({
        success: false,
        error: "Missing subject or html",
      });

    const normalizedAudienceType = String(audienceType || "").trim().toLowerCase();
    if (!["list", "emails"].includes(normalizedAudienceType)) {
      return res.status(400).json({ success: false, error: "Choose a valid broadcast audience." });
    }
    const normalizedAudienceValue = String(audience || "").trim();
    // ==========================================
    // GET RECIPIENTS
    // ==========================================

    let finalRecipients = [];
    if (normalizedAudienceType === "emails") {
      const requested = Array.isArray(recipients) && recipients.length
        ? recipients
        : normalizedAudienceValue.split(/[,;\n]+/);
      const requestedEmails = [...new Set(requested.map((email) => String(email || "").trim().toLowerCase()).filter(isEmail))];
      if (!requestedEmails.length) {
        return res.status(400).json({ success: false, error: "Enter at least one valid email address." });
      }
      const { data: contacts, error: contactsError } = await supabaseAdmin
        .from("leads")
        .select("email,email_marketing_consent,email_marketing_opt_out")
        .eq("workspace_id", workspaceId)
        .in("email", requestedEmails);
      if (contactsError) {
        return res.status(503).json({ success: false, error: "Email marketing consent data is unavailable. Apply the marketing consent migration before sending." });
      }
      const consented = new Set((contacts || []).filter(hasEmailMarketingConsent).map((contact) => String(contact.email || "").trim().toLowerCase()));
      if (requestedEmails.some((email) => !consented.has(email))) {
        return res.status(403).json({ success: false, error: "Every recipient must be a CRM contact with recorded email marketing consent and no opt-out." });
      }
      finalRecipients = requestedEmails;
    } else {
      if (!normalizedAudienceValue) {
        return res.status(400).json({ success: false, error: "Choose a contact list before sending." });
      }
      const { data: list, error: listError } = await supabaseAdmin
        .from("lead_lists")
        .select("id")
        .eq("id", normalizedAudienceValue)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (listError) {
        return res.status(500).json({ success: false, error: "Could not verify the selected contact list." });
      }
      if (!list) {
        return res.status(404).json({ success: false, error: "The selected list was not found in this workspace." });
      }
      const { data: leads, error: leadsError } = await supabaseAdmin
        .from("leads")
        .select("email,email_marketing_consent,email_marketing_opt_out")
        .eq("workspace_id", workspaceId)
        .eq("list_id", normalizedAudienceValue);
      if (leadsError) {
        return res.status(503).json({ success: false, error: "Email marketing consent data is unavailable. Apply the marketing consent migration before sending." });
      }
      finalRecipients = [...new Set((leads || []).filter(hasEmailMarketingConsent).map((lead) => String(lead.email || "").trim().toLowerCase()).filter(isEmail))];
    }

    finalRecipients = await filterSuppressedRecipients(user.id, finalRecipients);

    if (!finalRecipients.length)
      return res.status(400).json({
        success: false,
        error: "No recipients available. The audience is empty or all matching emails are unsubscribed.",
      });

    let finalBroadcastId = broadcastId;
    const broadcastAudienceFields = {
      audience_type: normalizedAudienceType,
      list_id: normalizedAudienceType === "list" ? normalizedAudienceValue : null,
      to_field: normalizedAudienceType === "emails" ? normalizedAudienceValue : null,
    };

    if (!finalBroadcastId) {
      const { data, error } = await supabaseAdmin
        .from("email_broadcasts")
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          subject,
          from_name: senderName,
          from_email: senderEmail,
          reply_to: replyToEmail,
          ab_enabled: !!abEnabled,
          ab_subject_a: abSubjectA || null,
          ab_subject_b: abSubjectB || null,
          html_content: html,
          ...broadcastAudienceFields,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) return res.status(500).json({ success: false, error: error.message });
      finalBroadcastId = data.id;
    } else {
      const { data: updated, error } = await supabaseAdmin
        .from("email_broadcasts")
        .update({
          subject,
          from_name: senderName,
          from_email: senderEmail,
          reply_to: replyToEmail,
          ab_enabled: !!abEnabled,
          ab_subject_a: abSubjectA || null,
          ab_subject_b: abSubjectB || null,
          html_content: html,
          ...broadcastAudienceFields,
        })
        .eq("id", finalBroadcastId)
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .select("id");
      if (error) return res.status(500).json({ success: false, error: error.message });
      if (!updated?.length) {
        return res.status(404).json({ success: false, error: "Broadcast not found in this workspace. Nothing was sent." });
      }
    }

    let emailGuard = null;
    if (!isDemo) {
      try {
        emailGuard = await guardEmailSend(user.id, finalRecipients.length);
      } catch (limitErr) {
        return res.status(429).json({
          success: false,
          error: limitErr.message,
          code: limitErr.code,
          details: limitErr.details,
        });
      }
    } else {
      emailGuard = { demo: true, allowed: true, requested: finalRecipients.length };
    }

    let sent = 0;

    if (!isDemo) {
      if (!SENDGRID_KEY)
        return res
          .status(500)
          .json({ success: false, error: "Missing SendGrid key" });
      sgMail.setApiKey(SENDGRID_KEY);
    }

    // ==========================================
    // SEND + LOG
    // ==========================================

    for (const to of finalRecipients) {
      const normalizedTo = normalizeUnsubscribeEmail(to);
      const useSubject = abEnabled
        ? abSubjectA || subject
        : subject;
      const { apiUrl: unsubscribeApiUrl, pageUrl: unsubscribePageUrl } = buildUnsubscribeUrls({
        req,
        userId: user.id,
        email: normalizedTo,
      });
      const personalizedHtml = injectUnsubscribeUrl(html, unsubscribePageUrl);

      const { data: row, error: insertError } =
        await supabaseAdmin
          .from("email_sends")
          .insert({
            user_id: user.id,
            workspace_id: workspaceId || null,
            broadcast_id: finalBroadcastId,
            email: to,
            recipient_email: to,
            email_type: "broadcast",
            subject: useSubject,
            status: "processing",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

      if (insertError)
        return res.status(500).json({
          success: false,
          error: insertError.message,
        });

      if (isDemo) {
        const messageId = `demo_email_${row.id}`;
        await recordDemoAction({
          workspaceId,
          userId: user.id,
          actionType: "broadcast-email",
          provider: "sendgrid",
          target: normalizedTo,
          payload: { broadcastId: finalBroadcastId, subject: useSubject },
          simulatedResult: { ok: true, demo: true, sendgrid_message_id: messageId, message: "Demo broadcast email simulated - no external message sent." },
        });
        await supabaseAdmin
          .from("email_sends")
          .update({
            status: "demo_simulated",
            sent_at: new Date().toISOString(),
            sendgrid_message_id: messageId,
          })
          .eq("id", row.id);
        sent++;
        continue;
      }

      let response;
      try {
        response = await sgMail.send({
          to: normalizedTo,
          from: { email: senderEmail, name: senderName },
          replyTo: replyToEmail,
          subject: useSubject,
          html: personalizedHtml,
          headers: unsubscribeApiUrl
            ? {
                "List-Unsubscribe": `<${unsubscribeApiUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : undefined,
          mail_settings: sandbox
            ? { sandbox_mode: { enable: true } }
            : undefined,
        });
      } catch (sgErr) {
        const sgStatus = sgErr?.response?.status;
        const sgBody = sgErr?.response?.body;
        const detail =
          sgBody?.errors?.[0]?.message ||
          sgErr?.message ||
          "SendGrid error";
        if (sgStatus === 403) {
          throw new Error(
            `Sender not authorised in SendGrid (403). Ensure your domain is DKIM-verified or contact support. Detail: ${detail}`
          );
        }
        throw new Error(detail);
      }

      const messageId =
        response?.[0]?.headers?.["x-message-id"] || null;

      await supabaseAdmin
        .from("email_sends")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sendgrid_message_id: messageId,
        })
        .eq("id", row.id);

      sent++;
    }

    return res.status(200).json({
      success: true,
      sent,
      broadcastId: finalBroadcastId,
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
