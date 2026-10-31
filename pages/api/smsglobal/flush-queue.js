// /pages/api/smsglobal/flush-queue.js
// FULL REPLACEMENT
//
// Sends queued SMS from sms_queue using per-user SMSGlobal credentials
// Multi-tenant safe

import { createClient } from "@supabase/supabase-js";
import { sendSmsGlobal } from "../../../lib/smsglobal";
import { isDemoWorkspace, recordDemoAction } from "../../../lib/demoWorkspace";
import { hasSmsMarketingConsent } from "../../../lib/marketingConsent";
import { validateAustralianBrandedSenderId } from "../../../lib/smsSenderId";
import { assertSmsMarketingAllowed, withSmsOptOutFooter } from "../../../lib/smsglobal/marketingSendGuard.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const DEFAULT_SMS_ORIGIN = process.env.DEFAULT_SMS_ORIGIN || "gr8result";

  // ✅ Main account fallback
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function nowIso() {
  return new Date().toISOString();
}

async function updateRow(id, patch) {
  const { error } = await supabaseAdmin
    .from("sms_queue")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/*                        GET USER SMS SETTINGS                                */
/* -------------------------------------------------------------------------- */

async function getUserSettings(user_id) {
  if (!user_id) {
    throw new Error("Missing user_id on sms_queue row");
  }

  // Fetch account settings (required)
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("sms_api_key, sms_api_secret, sender_id, business_name")
    .eq("user_id", user_id)
    .maybeSingle();

  if (accountError || !account) {
    throw new Error("No SMS settings for user account");
  }

  // ✅ Return user settings with flag if using main account fallback
  const hasUserCreds = !!(account.sms_api_key && account.sms_api_secret);
  
  return {
    sms_api_key: account.sms_api_key,
    sms_api_secret: account.sms_api_secret,
    sender_id: account.sender_id,
    business_name: account.business_name,
    usingMainAccount: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                           FETCH QUEUED SMS                                  */
/* -------------------------------------------------------------------------- */

async function fetchQueue(limit = 25) {
  const now = nowIso();

  const { data, error } = await supabaseAdmin
    .from("sms_queue")
    .select("*")
    .in("status", ["queued", "pending"])
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ✅ NOTE: After successful send, queue rows are DELETED (not just marked as "sent")
// This keeps the queue table clean and uncluttered
// If you need historical records of sent SMS, Archive completed rows to a separate table

/* -------------------------------------------------------------------------- */
/*                                HANDLER                                      */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Queue processing can trigger real provider delivery in every environment.
  const authHeader = String(req.headers?.authorization || "");
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const providedKey = req.query?.key || req.headers["x-cron-key"] || "";
  const expectedKey = process.env.CRON_SECRET || 
                      process.env.AUTOMATION_CRON_KEY || 
                      process.env.SMSGLOBAL_CRON_KEY || 
                      "";
  const hasValidSecret = Boolean(expectedKey) && (providedKey === expectedKey || bearerToken === expectedKey);
  
  if (!expectedKey || !hasValidSecret) {
    return res.status(401).json({ 
      ok: false,
      error: expectedKey ? "Unauthorized - invalid or missing cron key" : "SMS queue processing is disabled until a cron secret is configured."
    });
  }

  try {
    const limit = Number(req.query?.limit || 25);
    
    console.log("🔄 flush-queue: Starting to process SMS queue", {
      limit,
      isDev: process.env.NODE_ENV === "development",
      hasAuth: Boolean(providedKey || bearerToken),
    });
    
    const rows = await fetchQueue(limit > 0 ? limit : 25);
    
    console.log(`📋 flush-queue: Found ${rows.length} queued messages`);

    if (!rows.length) {
      return res.status(200).json({
        ok: true,
        processed: 0,
        sent: 0,
        failed: 0,
        message: "No queued SMS",
      });
    }

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        console.log(`📤 Processing SMS queue row ${row.id} for user ${row.user_id}`);

        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("sms_queue")
          .update({ status: "processing", last_error: null })
          .eq("id", row.id)
          .eq("workspace_id", row.workspace_id)
          .in("status", ["queued", "pending"])
          .select("id")
          .maybeSingle();
        if (claimError) throw claimError;
        if (!claimed?.id) continue;

        if (row.workspace_id && await isDemoWorkspace(row.workspace_id)) {
          const providerId = `demo_sms_${row.id}`;
          await recordDemoAction({
            workspaceId: row.workspace_id,
            userId: row.user_id,
            actionType: "sms",
            provider: "smsglobal",
            target: row.to_phone,
            payload: { queueId: row.id, body: row.body, origin: row.origin },
            simulatedResult: { ok: true, demo: true, provider_message_id: providerId, message: "Demo SMS simulated - no external SMS sent." },
          });
          await supabaseAdmin.from("sms_sent_history").insert({
            user_id: row.user_id,
            workspace_id: row.workspace_id,
            to_phone: row.to_phone,
            body: row.body,
            origin: row.origin || DEFAULT_SMS_ORIGIN,
            status: "demo_simulated",
            provider_message_id: providerId,
            sent_at: nowIso(),
          });
          await supabaseAdmin.from("sms_queue").delete().eq("id", row.id);
          sent++;
          continue;
        }

        const settings = await getUserSettings(row.user_id);

        if (!settings.sms_api_key || !settings.sms_api_secret) {
          throw new Error("SMS credentials missing (no user subaccount and no main account fallback)");
        }
        
        // Validate phone number exists
        if (!row.to_phone) {
          throw new Error("Missing to_phone in queue row");
        }
        
        // Validate message exists
        if (!row.body) {
          throw new Error("Missing message body in queue row");
        }

        if (!row.lead_id || !row.workspace_id) {
          throw new Error("SMS marketing queue row is missing its CRM lead or builder workspace.");
        }
        const { data: contact, error: contactError } = await supabaseAdmin
          .from("leads")
          .select("id,workspace_id,sms_marketing_consent,sms_marketing_opt_out,sms_opt_out")
          .eq("id", row.lead_id)
          .eq("workspace_id", row.workspace_id)
          .maybeSingle();
        if (contactError) throw new Error("SMS consent data unavailable; apply the marketing consent migration before sending.");
        if (!contact || !hasSmsMarketingConsent(contact)) throw new Error("Contact consent is missing or withdrawn; SMS was not sent.");
        const { optOutNumber } = await assertSmsMarketingAllowed(supabaseAdmin, { workspaceId: row.workspace_id, phone: row.to_phone });
        const messageBody = withSmsOptOutFooter(row.body, optOutNumber);

        // ✅ CRITICAL LOGIC FOR SENDER ID:
        // - If user has their OWN subaccount credentials: use their custom sender_id (NO restrictions)
        // - If using MAIN account credentials: ONLY use origins registered in main account (check ALLOWED_ORIGINS)
        // - User subaccount sender IDs (like "WaitandSea") won't work with main account credentials!
        
        let origin;
        
        if (settings.usingMainAccount) {
          // Using main account - can ONLY use origins registered in main account
          const rawAllowed = process.env.SMSGLOBAL_ALLOWED_ORIGINS || "";
          const allowedOrigins = rawAllowed
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
          
          const candidateOrigin = row.origin || settings.sender_id || "";
          const candidateLower = candidateOrigin.trim().toLowerCase();
          const isAllowed = allowedOrigins.length > 0 && allowedOrigins.includes(candidateLower);
          
          if (isAllowed && candidateOrigin.trim()) {
            origin = candidateOrigin.trim();
            console.log(`📱 MAIN account: using allowed origin "${origin}"`);
          } else {
            throw new Error("Sender ID is not present in SMSGLOBAL_ALLOWED_ORIGINS; SMS was not sent.");
          }
        } else {
          // User has own subaccount - can use ANY sender_id they've registered (NO ALLOWED_ORIGINS check)
          origin = row.origin || settings.sender_id || "";
          const allowedOrigins = String(process.env.SMSGLOBAL_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
          if (!allowedOrigins.length || !allowedOrigins.includes(origin.toLowerCase())) {
            throw new Error("Sender ID is not explicitly registered in SMSGLOBAL_ALLOWED_ORIGINS; SMS was not sent.");
          }
          const senderIdCheck = validateAustralianBrandedSenderId(origin);
          if (!senderIdCheck.ok) throw new Error(senderIdCheck.error);
          console.log(`📱 USER subaccount: using origin "${origin}"`);
        }
        
        console.log(`📱 SMS ${row.id}: Account: ${settings.usingMainAccount ? 'MAIN' : 'USER'}, Origin: "${origin}"`);
        
        const result = await sendSmsGlobal({
          apiKey: settings.sms_api_key,
          apiSecret: settings.sms_api_secret,
          origin,
          toPhone: row.to_phone,
          message: messageBody,
          workspaceId: row.workspace_id || null,
          userId: row.user_id || null,
        });
        
        if (!result.ok) {
          throw new Error(
            typeof result.body === 'object' 
              ? JSON.stringify(result.body) 
              : String(result.body || 'SMS send failed')
          );
        }
        
        // Extract message ID from SMSGlobal response
        const providerId = result.body?.messages?.[0]?.id || 
                          result.body?.id || 
                          String(result.body || '');

        // ✅ SAVE TO HISTORY before deleting from queue
        // This preserves all sent SMS for historical analysis
        const { error: histErr } = await supabaseAdmin
          .from("sms_sent_history")
          .insert({
            user_id: row.user_id,
            workspace_id: row.workspace_id || null,
            ...(row.campaign_id ? { campaign_id: row.campaign_id, contact_id: row.contact_id || null } : {}),
            to_phone: row.to_phone,
            body: row.body,
            origin: origin,
            status: "sent",
            provider_message_id: providerId,
            sent_at: nowIso(),
          });

        if (histErr) {
          console.warn(`⚠️ Failed to save history for SMS ${row.id}: ${histErr.message}`);
          // Still continue - queue deletion is more important than history
        } else {
          console.log(`💾 Saved SMS ${row.id} to sms_sent_history`);
        }

        // ✅ DELETE the row from queue after successful send (flush the queue)
        const { error: delErr } = await supabaseAdmin
          .from("sms_queue")
          .delete()
          .eq("id", row.id);

        if (delErr) {
          console.warn(`⚠️ Failed to delete queue row ${row.id}: ${delErr.message}`);
          // Still count as sent to avoid retry loops
        } else {
          console.log(`✅ Flushed queue row ${row.id}`);
        }

        sent++;
      } catch (err) {
        await updateRow(row.id, {
          status: "failed",
          last_error: String(err.message || err).slice(0, 1000),
        });
        failed++;
      }
    }

    const campaignKeys = new Map();
    for (const row of rows) {
      if (row.campaign_id && row.workspace_id) campaignKeys.set(`${row.workspace_id}:${row.campaign_id}`, row);
    }
    for (const row of campaignKeys.values()) {
      const { data: remaining, error: remainingError } = await supabaseAdmin
        .from("sms_queue")
        .select("id,status")
        .eq("workspace_id", row.workspace_id)
        .eq("campaign_id", row.campaign_id);
      if (remainingError) {
        console.warn(`Could not finalize SMS campaign ${row.campaign_id}: ${remainingError.message}`);
        continue;
      }
      const statuses = (remaining || []).map((item) => String(item.status || "").toLowerCase());
      const campaignStatus = statuses.includes("failed")
        ? "failed"
        : statuses.length === 0
          ? "sent"
          : null;
      if (!campaignStatus) continue;
      const { error: updateError } = await supabaseAdmin
        .from("sms_marketing_campaigns")
        .update({ status: campaignStatus, updated_at: nowIso() })
        .eq("id", row.campaign_id)
        .eq("workspace_id", row.workspace_id)
        .in("status", ["scheduled", "queued"]);
      if (updateError) console.warn(`Could not update SMS campaign ${row.campaign_id}: ${updateError.message}`);
    }

    console.log(`✅ flush-queue complete: ${sent} sent, ${failed} failed out of ${rows.length} processed`);

    return res.status(200).json({
      ok: true,
      processed: rows.length,
      sent,
      failed,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}
