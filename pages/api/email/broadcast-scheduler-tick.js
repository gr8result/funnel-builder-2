import sgMail from "@sendgrid/mail";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { guardEmailSend } from "../../../lib/emailValidation";
import { buildUnsubscribeUrls, injectUnsubscribeUrl, normalizeUnsubscribeEmail } from "../../../lib/email/unsubscribe";
import { resolveVerifiedSender } from "../../../lib/email/verifiedSender";
import { createScheduledBroadcastRepository } from "../../../lib/email/scheduledBroadcastRepository.mjs";
import { isProductionDeliveryEnabled, processDueBroadcastDeliveries } from "../../../lib/email/persistentBroadcastScheduler.mjs";

function hasCronAuth(req) {
  const expected = process.env.CRON_SECRET || process.env.AUTOMATION_CRON_KEY || "";
  const auth = String(req.headers.authorization || "");
  return Boolean(expected && (req.headers["x-cron-secret"] === expected || auth === `Bearer ${expected}`));
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function createSendgridSender(req) {
  return async ({ broadcast, contact, delivery }) => {
    const key = process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;
    if (!key) {
      const error = new Error("SendGrid is not configured.");
      error.definitiveNoSend = true;
      throw error;
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("sendgrid_from_email,sendgrid_from_name,sendgrid_reply_to,email,dkim_domain,dkim_verified")
      .eq("user_id", broadcast.user_id)
      .maybeSingle();
    if (accountError) throw new Error("Could not verify the builder's SendGrid sender.");

    const sender = resolveVerifiedSender(account || {}, process.env.SENDGRID_FROM_EMAIL || "");
    if (!sender.ok) {
      const error = new Error(sender.error);
      error.definitiveNoSend = true;
      throw error;
    }

    const replyTo = [broadcast.reply_to, account?.sendgrid_reply_to, account?.email]
      .find(validEmail);
    const to = normalizeUnsubscribeEmail(contact.email);
    if (!validEmail(to)) {
      const error = new Error("Contact has no valid current email address.");
      error.definitiveNoSend = true;
      throw error;
    }

    try {
      await guardEmailSend(broadcast.user_id, 1);
    } catch (error) {
      error.definitiveNoSend = true;
      throw error;
    }

    const unsubscribeUrls = buildUnsubscribeUrls({ req, userId: broadcast.user_id, email: to });
    if (!unsubscribeUrls.pageUrl) {
      const error = new Error("Unsubscribe URL could not be created; delivery was blocked.");
      error.definitiveNoSend = true;
      throw error;
    }

    sgMail.setApiKey(key);
    try {
      const [response] = await sgMail.send({
        to,
        from: {
          email: sender.email,
          name: String(broadcast.from_name || account?.sendgrid_from_name || process.env.SENDGRID_FROM_NAME || "GR8 RESULT").trim(),
        },
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject: broadcast.subject,
        html: injectUnsubscribeUrl(broadcast.html_content, unsubscribeUrls.pageUrl),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrls.apiUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        customArgs: {
          workspace_id: delivery.workspace_id,
          broadcast_id: delivery.broadcast_id,
          contact_id: delivery.contact_id,
          delivery_id: delivery.id,
        },
      });
      return { providerMessageId: response?.headers?.["x-message-id"] || null };
    } catch (providerError) {
      const status = Number(providerError?.response?.status || 0);
      const error = new Error(status ? `SendGrid rejected delivery (${status}).` : "SendGrid delivery outcome could not be confirmed.");
      error.definitiveNoSend = status >= 400 && status < 500 && status !== 408;
      throw error;
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (!hasCronAuth(req)) return res.status(401).json({ ok: false, error: "Unauthorized." });
  if (!isProductionDeliveryEnabled(process.env)) {
    return res.status(503).json({ ok: false, disabled: true, message: "Broadcast delivery is disabled pending schema and production approval." });
  }
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).json({ ok: false, disabled: true, message: "The central contact and consent migration is not enabled." });
  }

  try {
    const result = await processDueBroadcastDeliveries({
      repository: createScheduledBroadcastRepository(supabaseAdmin),
      send: process.env.EMAIL_BROADCAST_PROVIDER_MODE === "mock"
        ? async ({ delivery }) => ({ providerMessageId: `mock-${delivery.id}` })
        : createSendgridSender(req),
      createClaimToken: randomUUID,
      limit: Math.max(1, Math.min(Number(req.query?.limit || 20) || 20, 100)),
      env: process.env,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("Broadcast scheduler tick failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: "Scheduler failed; unsent claimed items remain recorded for reconciliation." });
  }
}
