// /pages/api/automation/email/sendgrid-webhook.js
// Receives SendGrid event webhooks (opens, clicks, bounces, etc.)
// Updates automation_email_queue records with tracking data

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Parse the webhook events from SendGrid
    const events = Array.isArray(req.body) ? req.body : [req.body];

    if (!events || events.length === 0) {
      return res.status(200).json({ ok: true, processed: 0 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let processed = 0;

    for (const event of events) {
      const eventType = event.event || event.type;
      const email = event.email || event.to;
      const timestamp = new Date(event.timestamp * 1000).toISOString();

      if (!email || !eventType) continue;

      try {
        if (eventType === "open") {
          // Email was opened
          const { error } = await supabase
            .from("automation_email_queue")
            .update({
              opened_at: timestamp,
              status: "opened",
            })
            .eq("to_email", email)
            .is("opened_at", null); // Only update if not already opened

          if (!error) processed++;
        } else if (eventType === "click") {
          // Link was clicked
          const { error } = await supabase
            .from("automation_email_queue")
            .update({
              clicked_at: timestamp,
              status: "clicked",
            })
            .eq("to_email", email)
            .is("clicked_at", null); // Only update if not already clicked

          if (!error) processed++;
        } else if (eventType === "bounce") {
          // Email bounced
          const { error } = await supabase
            .from("automation_email_queue")
            .update({
              bounced_at: timestamp,
              status: "bounced",
            })
            .eq("to_email", email);

          if (!error) processed++;
        } else if (eventType === "dropped" || eventType === "spamreport") {
          // Email dropped or marked as spam
          const { error } = await supabase
            .from("automation_email_queue")
            .update({
              status: eventType === "dropped" ? "dropped" : "spammed",
            })
            .eq("to_email", email);

          if (!error) processed++;
        }
      } catch (eventErr) {
        console.error(`Error processing event ${eventType} for ${email}:`, eventErr);
      }
    }

    return res.status(200).json({
      ok: true,
      processed,
      total: events.length,
    });
  } catch (err) {
    console.error("SendGrid webhook error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Webhook processing failed",
    });
  }
}
