/**
 * emailCampaignQueueWorker.js
 * FULL REPLACEMENT — CAMPAIGNS ONLY
 *
 * ✅ Uses per-row from_email / from_name (Waite & Sea etc)
 * ✅ Falls back to ENV only if row missing sender
 * ✅ Sends via SendGrid
 * ✅ Moves sent rows → email_campaigns_sends
 * ✅ Deletes queue rows after processing
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";

// ================= ENV =================

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,

  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,

  SENDGRID_API_KEY,
  SENDGRID_API_KEY_SERVER,
  SENDGRID_KEY,
  SENDGRID_PRIVATE_KEY,
} = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

const SENDGRID_KEY_RESOLVED =
  SENDGRID_API_KEY ||
  SENDGRID_API_KEY_SERVER ||
  SENDGRID_KEY ||
  SENDGRID_PRIVATE_KEY;

if (!SENDGRID_KEY_RESOLVED) {
  console.error("❌ No SendGrid API key found");
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_KEY_RESOLVED);

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ================= WORKER =================

async function processCampaignQueue() {
  const now = new Date().toISOString();

  // Process automation_email_queue (AUTOMATIONS)
  const { data: rows, error } = await supabase
    .from("automation_email_queue")
    .select("*")
    .eq("status", "queued")
    .eq("processing", false)
    .lte("scheduled_at", now)
    .limit(10);

  if (error) {
    console.error("❌ Queue fetch error:", error.message);
    return;
  }

  if (!rows || rows.length === 0) {
    return;
  }

  for (const row of rows) {
    const {
      id,
      user_id,
      campaign_id,
      subscriber_id,
      to_email,
      subject,
      html,
      from_email,
      from_name,
    } = row;

    // lock row
    await supabase
      .from("automation_email_queue")
      .update({ processing: true })
      .eq("id", id)
      .eq("processing", false);

    try {
      const senderEmail = from_email || SENDGRID_FROM_EMAIL;
      const senderName = from_name || SENDGRID_FROM_NAME || "GR8 RESULT";

      if (!senderEmail) {
        throw new Error("Missing from_email (campaign sender)");
      }

      await sgMail.send({
        to: to_email,
        from: {
          email: senderEmail,
          name: senderName,
        },
        subject,
        html,
      });

      // ✅ archive send
      await supabase.from("automation_email_sends").insert({
        user_id,
        flow_id: row.flow_id,
        node_id: row.node_id,
        subscriber_id,
        email_lower: to_email.toLowerCase(),
        status: "sent",
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // ✅ remove from queue
      await supabase
        .from("automation_email_queue")
        .delete()
        .eq("id", id);

      console.log("✅ CAMPAIGN SENT:", to_email, "FROM:", senderEmail);
    } catch (err) {
      console.error("❌ SEND FAILED:", err?.response?.body || err.message);

      await supabase
        .from("automation_email_queue")
        .update({
          status: "failed",
          error: err.message,
          processing: false,
        })
        .eq("id", id);
    }
  }
}

// ================= LOOP =================

console.log("🚀 Campaign email worker ACTIVE");

setInterval(processCampaignQueue, 4000);
