import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";
const { randomUUID } = crypto;

console.log("🚀 Email Campaign Worker Booting...");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

if (!SENDGRID_API_KEY) {
  console.error("❌ Missing SENDGRID_API_KEY");
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

console.log("✅ Email Campaign Worker Started");

// =======================
// ✅ LIMIT CHECK
// =======================
async function checkLimit(userId) {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  let { data: usage } = await supabase
    .from("usage_email")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", startOfMonth)
    .maybeSingle();

  if (!usage) {
    const { data: newRow } = await supabase
      .from("usage_email")
      .insert({
        user_id: userId,
        emails_sent: 0,
        period_start: startOfMonth,
      })
      .select()
      .single();

    usage = newRow;
  }

  const used = usage?.emails_sent || 0;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("account_id", userId)
    .maybeSingle();

  const plan = sub?.plan_id || "free";

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("max_emails_per_month")
    .eq("plan_id", plan)
    .single();

  const max = limits?.max_emails_per_month || 0;

  if (max && used >= max) return false;

  return true;
}

// =======================
// ✅ INCREMENT USAGE
// =======================
async function incrementUsage(userId) {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { data: usage } = await supabase
    .from("usage_email")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", startOfMonth)
    .maybeSingle();

  if (!usage) return;

  await supabase
    .from("usage_email")
    .update({
      emails_sent: (usage.emails_sent || 0) + 1,
    })
    .eq("id", usage.id);
}

async function processQueue() {
  try {
    const { data: rows, error } = await supabase
      .from("email_campaigns_queue")
      .select("*")
      .eq("status", "queued")
      .order("id", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Queue fetch error:", error.message);
      return;
    }

    if (!rows || rows.length === 0) {
      console.log("ℹ️ No queued campaign emails");
      return;
    }

    console.log(`📨 Found ${rows.length} queued emails`);

    for (const row of rows) {
      const recipient =
        row.to_email ||
        row.subscriber_email ||
        null;

      if (!recipient) {
        console.log(`⚠️ Row ${row.id} has no recipient`);
        continue;
      }

      // =======================
      // ✅ LIMIT CHECK
      // =======================
      const allowed = await checkLimit(row.user_id);
      if (!allowed) {
        console.log(`🚫 Limit reached for user ${row.user_id}`);

        await supabase
          .from("email_campaigns_queue")
          .update({
            status: "failed",
            last_error: "Monthly email limit reached",
          })
          .eq("id", row.id);

        continue;
      }

      try {
        const { data: usageRow } = await supabase
          .from("email_sends")
          .insert({
            user_id: row.user_id,
            campaigns_id: row.campaign_id,
            email: recipient,
            recipient_email: recipient,
            email_type: "campaign",
            subject: row.subject || "Campaign email",
            status: "processing",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        const msg = {
          to: recipient,
          from: {
            email: row.from_email,
            name: row.from_name || "GR8 RESULT",
          },
          subject: row.subject,
          html: row.html,
        };

        const [response] = await sgMail.send(msg);

        const sgId =
          response?.headers?.["x-message-id"] ||
          response?.headers?.["X-Message-Id"] ||
          null;

        if (usageRow?.id) {
          await supabase
            .from("email_sends")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              sendgrid_message_id: sgId,
            })
            .eq("id", usageRow.id);
        }

        const { error: insertError } = await supabase
          .from("email_campaigns_sends")
          .insert({
            id: randomUUID(),
            user_id: row.user_id,
            campaign_id: row.campaign_id,
            subscriber_id: row.subscriber_id,
            email_lower: recipient.toLowerCase(),
            status: "sent",
            sent_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("❌ Insert failed:", insertError.message);
          continue;
        }

        const visitBase = {
          flow_id: row.flow_id || row.campaign_id,
          node_id: row.node_id || row.email_node_id,
          user_id: row.user_id,
          subscriber_id: row.subscriber_id,
          visited_at: new Date().toISOString()
        };

        await supabase.from("automation_flow_node_visits").insert({ ...visitBase, status: "processed" });
        await supabase.from("automation_flow_node_visits").insert({ ...visitBase, status: "delivered" });
        await supabase.from("automation_flow_node_visits").insert({ ...visitBase, status: "opened" });
        await supabase.from("automation_flow_node_visits").insert({ ...visitBase, status: "clicked" });

        await supabase
          .from("email_campaigns_queue")
          .delete()
          .eq("id", row.id);

        // =======================
        // ✅ INCREMENT USAGE
        // =======================
        await incrementUsage(row.user_id);

        console.log(`✅ Sent & recorded: ${recipient}`);
      } catch (err) {
        console.error("❌ Send failed:", err.message);

        await supabase
          .from("email_campaigns_queue")
          .update({
            status: "failed",
            last_error: err.message,
          })
          .eq("id", row.id);
      }
    }
  } catch (err) {
    console.error("Worker crash:", err.message);
  }
}

setInterval(processQueue, 5000);
processQueue();