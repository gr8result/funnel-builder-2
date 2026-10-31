import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { authenticateSmsGlobalWebhook, makeSmsWebhookEventHash, normalizeSmsDeliveryStatus } from "../../../lib/smsglobal/webhookSecurity.mjs";

function callbackPayload(req) {
  return req.method === "GET" ? req.query || {} : req.body || {};
}

function parseTimestamp(value) {
  const time = value ? new Date(value) : new Date();
  return Number.isFinite(time.getTime()) ? time.toISOString() : new Date().toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false });
  }
  const auth = authenticateSmsGlobalWebhook(req);
  if (!auth.configured) return res.status(503).json({ ok: false, error: "SMSGlobal webhook is disabled until its shared secret is configured." });
  if (!auth.authorized) return res.status(401).json({ ok: false, error: "Unauthorized." });
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).json({ ok: false, error: "Central contact schema is not enabled." });
  }

  const payload = callbackPayload(req);
  const providerId = String(payload.msgid || payload.message_id || payload.provider_id || payload.id || "").trim();
  const eventId = String(payload.event_id || payload.dlr_id || "").trim();
  const status = normalizeSmsDeliveryStatus(payload.status || payload.dlr || payload.state);
  if (!providerId || !status) return res.status(422).json({ ok: false, error: "A provider message ID and recognized delivery status are required." });

  const occurredAt = parseTimestamp(payload.delivered_at || payload.timestamp || payload.date);
  const eventHash = makeSmsWebhookEventHash({
    kind: "delivery",
    providerId,
    status,
    timestamp: eventId || "",
  });
  const minimalReceipt = {
    provider: "smsglobal",
    provider_id: providerId,
    provider_event_id: eventId || null,
    event_hash: eventHash,
    status,
    delivered_at: status === "delivered" ? occurredAt : null,
    association_status: "pending_match",
    raw: { status, occurred_at: occurredAt, provider_event_id: eventId || null },
  };

  try {
    const { data: matches, error: matchError } = await supabaseAdmin
      .from("sms_sent_history")
      .select("id,workspace_id,contact_id,campaign_id,provider_message_id,status")
      .eq("provider_message_id", providerId)
      .limit(2);
    if (matchError) return res.status(503).json({ ok: false, error: "Could not resolve the SMS delivery record." });
    if ((matches || []).length > 1) return res.status(409).json({ ok: false, error: "Provider message ID is ambiguous; receipt was not linked." });

    const row = matches?.[0] || null;
    const associationStatus = row?.workspace_id && row?.contact_id && row?.campaign_id
      ? "matched"
      : row?.workspace_id && row?.contact_id
        ? "pending_campaign_link"
        : row
          ? "pending_contact_link"
          : "pending_match";
    const receipt = {
      ...minimalReceipt,
      ...(row ? {
        workspace_id: row.workspace_id,
        contact_id: row.contact_id,
        campaign_id: row.campaign_id,
        sms_sent_history_id: row.id,
      } : {}),
      association_status: associationStatus,
    };
    const { error: receiptError } = await supabaseAdmin
      .from("sms_delivery_receipts")
      .upsert(receipt, { onConflict: "provider,event_hash", ignoreDuplicates: true });
    if (receiptError) return res.status(503).json({ ok: false, error: "Could not persist the delivery receipt." });

    if (row?.workspace_id && row?.contact_id && (status === "delivered" || status === "failed")) {
      const patch = status === "delivered"
        ? { status: "delivered", delivered_at: occurredAt, last_error: null }
        : { status: "failed", last_error: `SMSGlobal delivery status: ${status}` };
      const { error: historyError } = await supabaseAdmin
        .from("sms_sent_history")
        .update(patch)
        .eq("id", row.id)
        .eq("workspace_id", row.workspace_id)
        .eq("contact_id", row.contact_id);
      if (historyError) return res.status(503).json({ ok: false, error: "Receipt was saved but its linked SMS row could not be updated." });
    }

    const associated = Boolean(row?.workspace_id && row?.contact_id && row?.campaign_id);
    return res.status(associated ? 200 : 202).json({ ok: true, associated, associationStatus, status });
  } catch (error) {
    console.error("SMSGlobal DLR handler failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: "Could not process this receipt." });
  }
}
