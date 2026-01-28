// /pages/api/automation/email/flush-queue.js
// Sends queued automation emails via SendGrid and tracks delivery
//
// Auth: x-cron-key header (same as tick engine)
// GET or POST to /api/automation/email/flush-queue?limit=50
//
// Process:
// 1. Get pending emails from automation_email_queue
// 2. Send via SendGrid
// 3. Record SendGrid message ID
// 4. Update status to 'sent' and sent_at timestamp
// 5. Log to email_sends table
// 6. Return summary

import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

const CRON_SECRET =
  (process.env.AUTOMATION_CRON_SECRET || "").trim() ||
  (process.env.AUTOMATION_CRON_KEY || "").trim() ||
  (process.env.CRON_SECRET || "").trim();

function okAuth(req) {
  const h = (req.headers.authorization || "").trim();
  const bearer = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  const q = (req.query.key || "").toString().trim();
  const x = (req.headers["x-cron-key"] || "").toString().trim();
  const secret = CRON_SECRET;
  if (!secret) return true; // dev-safe
  return bearer === secret || q === secret || x === secret;
}

export default async function handler(req, res) {
  if (!okAuth(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const sgKey = (process.env.SENDGRID_API_KEY || "").trim();
  if (!sgKey) {
    return res.status(500).json({ ok: false, error: "Missing SENDGRID_API_KEY" });
  }

  sgMail.setApiKey(sgKey);

  const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
  const debug = {
    limit,
    fetched: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Get pending emails - use .from() but handle schema cache error gracefully
    let queued = [];
    let fetchErr = null;
    
    try {
      const result = await supabase
        .from("automation_email_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      
      queued = result.data || [];
      fetchErr = result.error;
    } catch (err) {
      // Schema cache error - table exists but client doesn't know
      // Return empty for now, cache will refresh soon
      if (String(err.message || err).includes('schema cache')) {
        debug.errors.push('Schema cache needs refresh - try again in a few minutes');
        return res.json({ ok: true, debug, note: 'Table exists but schema cache needs refresh' });
      }
      throw err;
    }

    if (fetchErr) {
      debug.errors.push(fetchErr.message);
      throw fetchErr;
    }

    debug.fetched = queued?.length || 0;

    // Process each email
    for (const email of queued || []) {
      try {
        // Get account info for sender
        const { data: account } = await supabase
          .from("accounts")
          .select("id, user_id, business_name, full_name, name")
          .eq("user_id", email.user_id)
          .maybeSingle();

        const fromEmail =
          (process.env.DEFAULT_FROM_EMAIL || "").trim() || "no-reply@gr8result.com";
        let fromName = (process.env.DEFAULT_FROM_NAME || "").trim() || "GR8 RESULT";
        if (account?.business_name) fromName = account.business_name;
        else if (account?.full_name) fromName = account.full_name;
        else if (account?.name) fromName = account.name;

        // Decode base64 HTML content
        let htmlContent = email.html_content;
        try {
          // Try to decode from base64 - if it fails, use as-is (backwards compat)
          htmlContent = Buffer.from(email.html_content, 'base64').toString('utf8');
        } catch {
          // Not base64, use raw HTML
        }

        // Send via SendGrid
        const sendResult = await sgMail.send({
          to: email.to_email,
          from: { email: fromEmail, name: fromName },
          subject: email.subject,
          html: htmlContent,
        });

        const sendgridMessageId = sendResult?.[0]?.headers?.["x-message-id"] || null;

        // Mark as sent
        await supabase
          .from("automation_email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            sendgrid_message_id: sendgridMessageId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        // Log to email_sends
        await supabase.from("email_sends").insert({
          user_id: email.user_id,
          automation_id: email.flow_id,
          email: email.to_email,
          recipient_email: email.to_email,
          email_type: "automation",
          variant: email.variant || email.subject,
          sent_at: new Date().toISOString(),
          open_count: 0,
          click_count: 0,
          unsubscribed: false,
        });

        debug.sent += 1;
      } catch (err) {
        debug.failed += 1;
        debug.errors.push(`${email.to_email}: ${err?.message || String(err)}`);

        // Mark as failed
        await supabase
          .from("automation_email_queue")
          .update({
            status: "failed",
            last_error: err?.message || String(err),
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);
      }
    }

    return res.json({
      ok: true,
      debug,
    });
  } catch (e) {
    debug.errors.push(e?.message || String(e));
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      debug,
    });
  }
}
