// SMSGlobal inbound messages (STOP / START replies). SMSGlobal requires the body "OK" within five seconds and
// repeats the callback when it does not get it (https://www.smsglobal.com/us/http-api/; retry count undocumented).
// One atomic RPC stores the message in sms_inbound_events, maps the number to a workspace and applies STOP/START.
// Anything other than a stored message returns a non-OK response so SMSGlobal repeats it.
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { authenticateSmsGlobalWebhook, makeSmsWebhookEventHash, normalizeAustralianPhone } from "../../../lib/smsglobal/webhookSecurity.mjs";

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
    return res.status(405).send("Method not allowed");
  }
  const auth = authenticateSmsGlobalWebhook(req);
  if (!auth.configured) return res.status(503).send("SMSGlobal inbound webhook disabled");
  if (!auth.authorized) return res.status(401).send("Unauthorized");
  // Production leads have no opt-out columns until the migration: without it a STOP cannot be stored durably,
  // so refuse (non-OK) and let SMSGlobal repeat rather than acknowledge and lose it.
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).send("Central contact schema not enabled");
  }

  const payload = callbackPayload(req);
  const senderPhone = normalizeAustralianPhone(payload.from || payload.sender || "");
  const receiverPhone = normalizeAustralianPhone(payload.to || payload.destination || "");
  const message = String(payload.msg || payload.message || payload.text || "").trim();
  const providerMessageId = String(payload.msgid || payload.message_id || payload.id || "").trim();
  if (senderPhone.length < 8 || receiverPhone.length < 8) {
    return res.status(422).send("Inbound message has invalid sender or destination; not acknowledged.");
  }

  const receivedAt = parseTimestamp(payload.date || payload.timestamp);
  const eventHash = makeSmsWebhookEventHash({
    kind: "inbound",
    providerId: providerMessageId,
    status: "",
    timestamp: providerMessageId ? "" : String(payload.date || payload.timestamp || ""),
    from: senderPhone,
    to: receiverPhone,
    text: providerMessageId ? "" : message,
  });

  try {
    const { data, error } = await supabaseAdmin.rpc("ingest_sms_inbound", {
      p_provider: "smsglobal",
      p_provider_message_id: providerMessageId || null,
      p_event_hash: eventHash,
      p_from: senderPhone,
      p_to: receiverPhone,
      p_body: message,
      p_received_at: receivedAt,
    });
    if (error) return res.status(503).send("Inbound message could not be stored");
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.keyword === "STOP" && row?.status === "unmapped") {
      console.warn("SMSGlobal STOP received on an unmapped number; marketing SMS to that phone is held in every workspace.");
    }
    return res.status(200).send("OK");
  } catch (error) {
    console.error("SMSGlobal inbound processing failed:", error?.message || error);
    return res.status(503).send("Inbound processing unavailable");
  }
}
