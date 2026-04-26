// /pages/api/smsglobal/flush-queue.js
// FULL REPLACEMENT
//
// Sends queued SMS from sms_queue using per-user SMSGlobal credentials
// Multi-tenant safe

import { createClient } from "@supabase/supabase-js";
import { sendSmsGlobal } from "../../../lib/smsglobal";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

// ✅ Main account fallback
const MAIN_SMS_API_KEY = process.env.SMSGLOBAL_API_KEY || "";
const MAIN_SMS_API_SECRET = process.env.SMSGLOBAL_API_SECRET || "";
const DEFAULT_SMS_ORIGIN = process.env.DEFAULT_SMS_ORIGIN || "gr8result";

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
    sms_api_key: hasUserCreds ? account.sms_api_key : MAIN_SMS_API_KEY,
    sms_api_secret: hasUserCreds ? account.sms_api_secret : MAIN_SMS_API_SECRET,
    sender_id: account.sender_id,
    business_name: account.business_name,
    usingMainAccount: !hasUserCreds,
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

  // Authentication check (allow in dev, require key in production)
  const isDev = process.env.NODE_ENV === "development";
  const authHeader = String(req.headers?.authorization || "");
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const providedKey = req.query?.key || req.headers["x-cron-key"] || "";
  const expectedKey = process.env.CRON_SECRET || 
                      process.env.AUTOMATION_CRON_KEY || 
                      process.env.SMSGLOBAL_CRON_KEY || 
                      "";
  const hasValidSecret =
    !expectedKey ||
    providedKey === expectedKey ||
    bearerToken === expectedKey;
  
  if (!isDev && !hasValidSecret) {
    return res.status(401).json({ 
      ok: false, 
      error: "Unauthorized - invalid or missing cron key" 
    });
  }

  try {
    const limit = Number(req.query?.limit || 25);
    
    console.log("🔄 flush-queue: Starting to process SMS queue", {
      limit,
      isDev: process.env.NODE_ENV === "development",
      hasAuth: !!providedKey || isDev,
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
        
        await updateRow(row.id, { status: "pending", last_error: null });

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
          
          const candidateOrigin = row.origin || settings.sender_id || settings.business_name || "";
          const candidateLower = candidateOrigin.trim().toLowerCase();
          const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(candidateLower);
          
          if (isAllowed && candidateOrigin.trim()) {
            origin = candidateOrigin.trim();
            console.log(`📱 MAIN account: using allowed origin "${origin}"`);
          } else {
            origin = DEFAULT_SMS_ORIGIN || "gr8result";
            console.log(`⚠️ MAIN account: "${candidateOrigin}" not in ALLOWED_ORIGINS, using "${origin}"`);
          }
        } else {
          // User has own subaccount - can use ANY sender_id they've registered (NO ALLOWED_ORIGINS check)
          origin = row.origin || settings.sender_id || settings.business_name || DEFAULT_SMS_ORIGIN || "gr8result";
          console.log(`📱 USER subaccount: using origin "${origin}"`);
        }
        
        console.log(`📱 SMS ${row.id}: Account: ${settings.usingMainAccount ? 'MAIN' : 'USER'}, Origin: "${origin}"`);
        
        const result = await sendSmsGlobal({
          apiKey: settings.sms_api_key,
          apiSecret: settings.sms_api_secret,
          origin,
          toPhone: row.to_phone,
          message: row.body,
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
