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
import {
  buildUnsubscribeUrls,
  injectUnsubscribeUrl,
  normalizeUnsubscribeEmail,
  uniqEmails,
} from "../../../lib/email/unsubscribe";

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
    .select("business_name, brand_name, company_name, sendgrid_from_name, from_name, sendgrid_from_email, from_email, email")
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ success: false });

    if (!SENDGRID_KEY)
      return res
        .status(500)
        .json({ success: false, error: "Missing SendGrid key" });

    sgMail.setApiKey(SENDGRID_KEY);

    const user = await getUserFromBearer(req);
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized" });

    const body = req.body || {};

    const {
      broadcastId,
      subject,
      abSubjectA,
      abSubjectB,
      abEnabled,
      html,
      fromEmail,
      fromName,
      replyTo,
      sandbox,
      recipients, // 👈 use direct recipients if provided
    } = body;

    const accountBranding = await getAccountBranding(user.id);

    // Always send FROM the verified system sender — user's address goes in reply_to
    const SYSTEM_FROM_EMAIL =
      process.env.SENDGRID_FROM_EMAIL ||
      process.env.SENDGRID_FROM ||
      "no-reply@gr8result.com";
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
      (fromEmail && isEmail(fromEmail) && fromEmail) ||
      (accountBranding?.email && isEmail(accountBranding.email) && accountBranding.email) ||
      (user.email && isEmail(user.email) && user.email) ||
      SYSTEM_FROM_EMAIL;

    if (!html || !subject)
      return res.status(400).json({
        success: false,
        error: "Missing subject or html",
      });

    let finalBroadcastId = broadcastId;

    // CREATE BROADCAST
    if (!finalBroadcastId) {
      const { data, error } = await supabaseAdmin
        .from("email_broadcasts")
        .insert({
          user_id: user.id,
          subject,
          from_name: senderName,
          from_email: senderEmail,
          reply_to: replyToEmail,
          ab_enabled: !!abEnabled,
          ab_subject_a: abSubjectA || null,
          ab_subject_b: abSubjectB || null,
          html_content: html,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error)
        return res.status(500).json({
          success: false,
          error: error.message,
        });

      finalBroadcastId = data.id;
    } else {
      await supabaseAdmin
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
        })
        .eq("id", finalBroadcastId)
        .eq("user_id", user.id);
    }

    // ==========================================
    // GET RECIPIENTS
    // ==========================================

    let finalRecipients = [];

    // 1️⃣ Use explicit recipients if passed
    if (Array.isArray(recipients) && recipients.length) {
      finalRecipients = recipients.filter(isEmail);
    }

    // 2️⃣ Otherwise send to ALL leads for user
    if (!finalRecipients.length) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("email")
        .eq("user_id", user.id);

      finalRecipients = (data || [])
        .map((r) => r.email)
        .filter(isEmail);
    }

    finalRecipients = await filterSuppressedRecipients(user.id, finalRecipients);

    if (!finalRecipients.length)
      return res.status(400).json({
        success: false,
        error: "No recipients available. The audience is empty or all matching emails are unsubscribed.",
      });

    let emailGuard = null;
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

    let sent = 0;

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
