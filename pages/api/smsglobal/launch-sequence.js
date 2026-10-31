// /pages/api/smsglobal/launch-sequence.js
// FULL REPLACEMENT
//
// ✅ Supports audience.type: 'lead' | 'manual' | 'list'
// ✅ Robust lead phone picking (doesn't assume column names)
// ✅ Robust sms_queue insert (tries multiple column name variants automatically)
// ✅ Fallback to main SMSGlobal account for users without SMS subaccount
// ✅ Multi-tenant safe for 'lead' (checks common ownership fields)
// ✅ Uses service role for inserts
//
// UI payload supported:
//  {
//    audience: { type:'lead', lead_id } OR { type:'manual', phone } OR { type:'list', list_id },
//    steps: [{ delay, unit, message }...] (max 3)
//  }
//
// NOTE: This endpoint ENQUEUES. Your sender/worker should flush sms_queue.

import { createClient } from "@supabase/supabase-js";
import { guardSmsSend } from "../../../lib/smsValidation";
import { getRequestDemoState, requestWorkspaceId } from "../../../lib/demoWorkspace";
import { hasSmsMarketingConsent } from "../../../lib/marketingConsent";
import { validateAustralianBrandedSenderId } from "../../../lib/smsSenderId";
import { buildSmsSequenceQueueRows } from "../../../lib/smsglobal/marketingCampaign.mjs";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

function s(v) {
  return String(v ?? "").trim();
}

function json(res, status, body) {
  return res.status(status).json(body);
}

function digitsOnly(v) {
  return s(v).replace(/[^\d]/g, "");
}

function normalizePhoneForSend(raw) {
  const t = s(raw);
  if (!t) return "";
  
  // Strip everything but digits and +
  let v = t.replace(/[^\d+]/g, "");
  if (!v) return "";
  
  // Strip leading + if present
  if (v.startsWith("+")) v = v.slice(1);
  
  // Convert 0XXXXXXXXX to 61XXXXXXXXX (AU)
  if (v.startsWith("0") && v.length >= 9) v = "61" + v.slice(1);
  
  // Ensure it starts with 61 for AU numbers without explicit country code
  if (!v.startsWith("61") && /^\d{9,}$/.test(v)) v = "61" + v;
  
  // SMSGlobal v2 API expects format without + (e.g., 61417004315)
  return v;
}

async function getUserFromBearer(req, supabaseAnon) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function pickLeadPhone(leadRow) {
  if (!leadRow || typeof leadRow !== "object") return "";

  // Simplified: check only the most common columns
  const candidates = [
    leadRow.phone,
    leadRow.mobile,
    leadRow.phone_number,
    leadRow.mobile_phone,
  ];

  for (const c of candidates) {
    const v = s(c);
    if (v) return v;
  }
  return "";
}

function isOwnedByUser(lead, userId) {
  if (!lead || typeof lead !== "object") return false;

  // Prefer explicit ownership fields if they exist
  const checks = [
    lead.user_id,
    lead.owner_id,
    lead.created_by,
    lead.profile_id,
    lead.account_user_id,
  ].map((x) => s(x));

  // If any of these fields exist and match, accept
  for (const v of checks) {
    if (v && v === s(userId)) return true;
  }

  // If the table doesn’t have any of those fields populated,
  // we refuse (safer than leaking / sending to other tenant)
  const hasAnyOwnershipField = checks.some((v) => v.length > 0);
  if (!hasAnyOwnershipField) return false;

  return false;
}

// --- LIST MEMBERSHIP LOOKUP (tries a few common tables) ---
async function getLeadIdsForList(supabaseAdmin, listId) {
  const lid = s(listId);
  if (!lid) return [];

  const found = new Set();

  const directAttempts = [
    { table: "leads", leadCol: "id", listCol: "list_id" },
    { table: "leads", leadCol: "id", listCol: "lead_list_id" },
  ];

  const membershipAttempts = [
    { table: "lead_list_members", leadCol: "lead_id", listCol: "list_id" },
    { table: "lead_lists_members", leadCol: "lead_id", listCol: "list_id" },
    { table: "email_list_members", leadCol: "lead_id", listCol: "list_id" },
    { table: "lead_list_memberships", leadCol: "lead_id", listCol: "list_id" },
  ];

  for (const a of [...directAttempts, ...membershipAttempts]) {
    try {
      const { data, error } = await supabaseAdmin
        .from(a.table)
        .select(a.leadCol)
        .eq(a.listCol, lid)
        .limit(50000);

      if (!error && Array.isArray(data)) {
        data
          .map((r) => s(r?.[a.leadCol]))
          .filter(Boolean)
          .forEach((id) => found.add(id));
      }
      // if relation missing or other error, try next
    } catch {
      // try next
    }
  }

  return Array.from(found);
}

// --- SMS QUEUE INSERT (tries multiple column variants until one works) ---
function buildInsertVariants({
  user_id,
  lead_id,
  step_no,
  to_phone,
  body,
  workspace_id,
  campaign_id,
  contact_id,
  send_at_iso,
  scheduled_for,
  available_at,
  status,
  sender_id,
  origin,
}) {
  const campaignFields = campaign_id ? { campaign_id, contact_id } : {};
  // We will try these shapes in order until one inserts without "column does not exist" errors.
  // Your sms_queue schema has: id, user_id, lead_id, step_no, to_phone, body, scheduled_for, status, 
  // provider_message_id, error, created_at, updated_at, origin, available_at, provider_id, last_error, sender_id
  return [
    // Variant A (matches your actual schema exactly)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      status,
      available_at,
      sender_id,
      origin,
    },
    // Variant B (no origin)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      status,
      available_at,
      sender_id,
    },
    // Variant C (minimal - let defaults handle created_at, updated_at)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      sender_id,
      origin,
    },
    // Variant D (no available_at)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      status,
      sender_id,
      origin,
    },
    // Variant E (no sender_id column)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      status,
      available_at,
      origin,
    },
    // Variant F (minimal, no sender_id)
    {
      user_id,
      lead_id,
      step_no,
      to_phone,
      body,
      workspace_id,
      ...campaignFields,
      scheduled_for,
      origin,
    },
  ];
}

async function insertSmsQueueRows(supabaseAdmin, baseRows) {
  // baseRows is an array of objects: { user_id, lead_id, step_no, to_phone, body, send_at_iso }
  // We try one “shape” across all rows so it’s consistent.

  if (!Array.isArray(baseRows) || !baseRows.length) {
    return { ok: true, inserted: 0, ids: [] };
  }

  // Build variants for FIRST row, then apply same shape to all rows.
  const first = baseRows[0];
  const firstVariants = buildInsertVariants(first);

  for (let i = 0; i < firstVariants.length; i++) {
    const shape = firstVariants[i];
    const keys = Object.keys(shape);

    const shapedRows = baseRows.map((r) => {
      const v = buildInsertVariants(r)[i] || {};
      // ensure only the keys for this variant
      const out = {};
      for (const k of keys) out[k] = v[k];
      return out;
    });

    const ins = await supabaseAdmin.from("sms_queue").insert(shapedRows).select("id");
    if (!ins.error) {
      return {
        ok: true,
        inserted: shapedRows.length,
        ids: (ins.data || []).map((x) => x.id),
        used_variant: i,
        used_keys: keys,
      };
    }

    // If it's a "column does not exist" type mismatch, try next variant.
    const msg = s(ins.error.message);
    const isColumnMismatch =
      msg.includes("does not exist") ||
      msg.includes("column") ||
      msg.includes("schema cache") ||
      msg.includes("Could not find") ||
      msg.includes("unknown");

    if (!isColumnMismatch) {
      // real error like RLS, not-null, etc -> stop
      return { ok: false, error: ins.error.message, detail: ins.error };
    }
  }

  return { ok: false, error: "Could not match sms_queue columns (all insert variants failed)" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json(res, 500, { ok: false, error: "Missing Supabase env" });
  }

  const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const user = await getUserFromBearer(req, supabaseAnon);
  if (!user) return json(res, 401, { ok: false, error: "Unauthorized" });

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = req.body || {};
  }
  const workspaceId = requestWorkspaceId({ ...req, body });
  if (!workspaceId) return json(res, 400, { ok: false, error: "Select a builder workspace before creating an SMS campaign." });
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json(res, 500, { ok: false, error: "Could not verify workspace access." });
  if (!membership) return json(res, 403, { ok: false, error: "You do not have access to this builder workspace." });
  const demoState = await getRequestDemoState({ ...req, body });

  // Fetch user's SMS account info
  // accounts.sender_id = approved sender name (SMS origin)
  // business_name = fallback if origin is missing
  let originSenderId = null;
  let businessName = null;
  let smsApiKey = null;
  let smsApiSecret = null;
  let usingMainAccount = false;
  
  try {
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("sender_id,business_name,sms_api_key,sms_api_secret")
      .eq("user_id", user.id)
      .maybeSingle();

    if (account?.sender_id) originSenderId = s(account.sender_id);
    if (account?.business_name) businessName = s(account.business_name);
    if (account?.sms_api_key) smsApiKey = s(account.sms_api_key);
    if (account?.sms_api_secret) smsApiSecret = s(account.sms_api_secret);
  } catch (err) {
    console.warn("⚠️ Error fetching SMS config:", err.message);
  }

  // Real builder campaigns require that builder's own provider credentials.
  if (!smsApiKey || !smsApiSecret) {
    if (demoState.isDemo) {
      smsApiKey = "demo";
      smsApiSecret = "demo";
      usingMainAccount = true;
    } else {
      return json(res, 403, {
        ok: false,
        error: "SMS not activated for this account.",
        detail: "Configure this builder's own SMSGlobal credentials before sending.",
      });
    }
  }

  // Marketing messages require an explicitly registered SMS sender ID.
  let finalOrigin;
  const allowedOrigins = String(process.env.SMSGLOBAL_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => s(value).toLowerCase())
    .filter(Boolean);
  const candidateOrigin = demoState.isDemo ? "demo" : s(originSenderId);
  if (demoState.isDemo) {
    finalOrigin = "demo";
  } else if (!allowedOrigins.length) {
    return json(res, 503, { ok: false, error: "SMS marketing is disabled until a registered sender ID is configured in SMSGLOBAL_ALLOWED_ORIGINS." });
  } else if (!candidateOrigin || !allowedOrigins.some((origin) => origin.toLowerCase() === candidateOrigin.toLowerCase())) {
    return json(res, 403, { ok: false, error: "This builder's sender ID is not registered and approved for SMS marketing." });
  } else {
    const senderIdCheck = validateAustralianBrandedSenderId(candidateOrigin);
    if (!senderIdCheck.ok) return json(res, 400, { ok: false, error: senderIdCheck.error });
    finalOrigin = candidateOrigin;
  }

  console.log("📱 Launching SMS campaign with origin:", {
    user_id: user.id,
    originSenderId: originSenderId || "none",
    businessName: businessName || "none",
    finalOrigin,
    usingMainAccount,
  });
  
  if (finalOrigin === "gr8result" && !originSenderId && !businessName) {
    console.warn("⚠️  FALLBACK ORIGIN USED FOR CAMPAIGN: User has no sender_id set. Campaign will queue with default 'gr8result'. " +
      "User should set their approved sender name in Account → SMS Activation first.");
  }

  const campaignId = s(body.campaign_id);
  let savedCampaign = null;
  if (campaignId) {
    if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
      return json(res, 503, { ok: false, error: "Saved SMS campaigns require the central contacts migration." });
    }
    const { data, error } = await supabaseAdmin
      .from("sms_marketing_campaigns")
      .select("id,workspace_id,user_id,name,audience_type,lead_id,list_id,steps,scheduled_at,status")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .maybeSingle();
    if (error) return json(res, 503, { ok: false, error: "Could not verify the saved SMS campaign." });
    if (!data) return json(res, 409, { ok: false, error: "Only your saved draft campaign can be launched." });
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("sms_queue")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", campaignId)
      .limit(1);
    if (existingError) return json(res, 503, { ok: false, error: "Could not verify whether this campaign was already queued." });
    if (existingRows?.length) return json(res, 409, { ok: false, error: "This campaign already has queued messages." });
    savedCampaign = data;
  }

  const audience = savedCampaign
    ? { type: savedCampaign.audience_type, lead_id: savedCampaign.lead_id, list_id: savedCampaign.list_id }
    : body.audience || {};
  const audienceType = s(audience.type || body.audienceType || "lead").toLowerCase();

  const stepsRaw = savedCampaign ? savedCampaign.steps : Array.isArray(body.steps) ? body.steps : [];
  if (!stepsRaw.length) return json(res, 400, { ok: false, error: "Missing steps" });

  const steps = stepsRaw
    .map((st) => ({
      delay: Number(st.delay || 0),
      unit: s(st.unit || "minutes"),
      message: s(st.message || st.body || st.text),
    }))
    .filter((x) => x.message)
    .slice(0, 3);

  if (!steps.length) return json(res, 400, { ok: false, error: "No valid messages in steps" });

  // Build recipients [{ lead_id?, to_phone }]
  const recipients = [];

  if (audienceType === "manual") {
    return json(res, 400, { ok: false, error: "Marketing SMS can only be sent to a CRM contact with recorded SMS consent." });
  } else if (audienceType === "lead") {
    const lead_id = s(audience.lead_id || body.lead_id || body.leadId);
    if (!lead_id) return json(res, 400, { ok: false, error: "Missing lead_id" });

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (leadErr) {
      return json(res, 500, { ok: false, error: "Lead lookup failed", detail: leadErr.message });
    }
    if (!lead) return json(res, 404, { ok: false, error: "Lead not found" });

    if (!hasSmsMarketingConsent(lead)) return json(res, 403, { ok: false, error: "This contact has no recorded SMS marketing consent or has opted out." });

    const phone = normalizePhoneForSend(pickLeadPhone(lead));
    if (!phone) return json(res, 400, { ok: false, error: "Lead has no phone number" });

    recipients.push({ lead_id, contact_id: lead.contact_id || null, to_phone: phone });
  } else if (audienceType === "list") {
    const list_id = s(audience.list_id || body.list_id || body.listId);
    if (!list_id) return json(res, 400, { ok: false, error: "Missing list_id" });

    const { data: list, error: listError } = await supabaseAdmin
      .from("lead_lists")
      .select("id")
      .eq("id", list_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (listError) return json(res, 500, { ok: false, error: "Could not verify the selected contact list." });
    if (!list) return json(res, 404, { ok: false, error: "The selected list was not found in this workspace." });
    const leadIds = await getLeadIdsForList(supabaseAdmin, list_id);
    if (!leadIds.length) {
      return json(res, 400, { ok: false, error: "No leads found in this list (membership table mismatch?)" });
    }

    // Load leads in chunks
    const chunkSize = 500;
    for (let i = 0; i < leadIds.length; i += chunkSize) {
      const chunk = leadIds.slice(i, i + chunkSize);
      const { data: leadRows, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("id", chunk);

      if (error) {
        return json(res, 500, { ok: false, error: "Lead batch lookup failed", detail: error.message });
      }

      for (const lead of leadRows || []) {
        if (!hasSmsMarketingConsent(lead)) continue;
        const phone = normalizePhoneForSend(pickLeadPhone(lead));
        if (!phone) continue;
        recipients.push({ lead_id: s(lead.id), contact_id: lead.contact_id || null, to_phone: phone });
      }
    }

    if (!recipients.length) {
      return json(res, 400, { ok: false, error: "No contacts with recorded SMS marketing consent and a valid phone number were found in this list." });
    }
  } else {
    return json(res, 400, { ok: false, error: "Invalid audience.type" });
  }

  // Build sms_queue rows with cumulative delays
  const now = Date.now();
  const scheduledAt = savedCampaign?.scheduled_at ? Date.parse(savedCampaign.scheduled_at) : now;
  if (!Number.isFinite(scheduledAt)) return json(res, 400, { ok: false, error: "Saved campaign schedule is invalid." });
  const baseRows = buildSmsSequenceQueueRows({
    userId: user.id,
    workspaceId,
    campaignId: campaignId || null,
    recipients,
    steps,
    origin: finalOrigin,
    scheduledAt: savedCampaign?.scheduled_at || null,
    now,
  });

  // ✅ Check SMS limit before enqueueing
  let smsGuard = null;
  if (!demoState.isDemo) {
    try {
      smsGuard = await guardSmsSend(user.id, baseRows.length);
    } catch (limitErr) {
      return json(res, 429, { ok: false, error: limitErr.message, code: limitErr.code, details: limitErr.details });
    }
  } else {
    smsGuard = { demo: true, allowed: true, requested: baseRows.length };
  }

  const ins = await insertSmsQueueRows(supabaseAdmin, baseRows);
  if (!ins.ok) {
    return json(res, 500, {
      ok: false,
      error: "Failed to enqueue sms_queue rows",
      detail: ins.error || ins,
      message: typeof ins?.error === "string" ? ins.error : ins?.error?.message,
    });
  }

  let campaignStatus = null;
  if (savedCampaign) {
    campaignStatus = scheduledAt > now ? "scheduled" : "queued";
    const { data: updatedCampaign, error: campaignError } = await supabaseAdmin
      .from("sms_marketing_campaigns")
      .update({ status: campaignStatus, updated_at: new Date().toISOString() })
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (campaignError || !updatedCampaign) {
      const { error: cleanupError } = await supabaseAdmin
        .from("sms_queue")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("campaign_id", campaignId)
        .eq("status", "queued");
      if (cleanupError) {
        return json(res, 503, { ok: false, error: "Campaign queue was created but status could not be saved; do not relaunch until it is reviewed." });
      }
      return json(res, campaignError ? 503 : 409, { ok: false, error: "Campaign could not be claimed for launch; queued messages were removed." });
    }
  }

  // Auto-flush queued SMS after queueing (like automation does for emails)
  let flushResult = null;
  try {
    const isDev = process.env.NODE_ENV === "development";
    const requestHost = req.headers?.host || "localhost:3000";
    const siteUrl = isDev
      ? `http://${requestHost}`
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const cronKey = process.env.CRON_SECRET || process.env.AUTOMATION_CRON_KEY || "";
    const authHeader = req.headers.authorization || "";

    // Use key if available, otherwise rely on Bearer auth
    const flushUrl = cronKey
      ? `${siteUrl}/api/smsglobal/flush-queue?key=${encodeURIComponent(cronKey)}&limit=50`
      : `${siteUrl}/api/smsglobal/flush-queue?limit=50`;

    const flushResponse = await fetch(flushUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
    });
    
    if (flushResponse.ok) {
      flushResult = await flushResponse.json();
      console.log("Auto-flush result:", JSON.stringify(flushResult, null, 2));
    } else {
      console.error("Auto-flush HTTP error:", flushResponse.status);
      flushResult = { error: `HTTP ${flushResponse.status}` };
    }
  } catch (flushErr) {
    // Flush error doesn't fail the response, just log it
    console.error("Auto-flush SMS failed:", flushErr?.message || flushErr);
    flushResult = { error: flushErr?.message || "Flush error" };
  }

  return json(res, 200, {
    ok: true,
    recipients: recipients.length,
    steps: steps.length,
    queued: baseRows.length,
    usage: smsGuard || null,
    inserted_ids: ins.ids || [],
    campaign_id: campaignId || null,
    campaign_status: campaignStatus,
    used_variant: ins.used_variant,
    used_keys: ins.used_keys,
    auto_flush: flushResult,
  });
}
