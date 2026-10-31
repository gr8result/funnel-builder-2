// SendGrid Event Webhook (configured in SendGrid as /api/webhooks/sendgrid-events, signed).
// Fails closed: no public key -> 503 (SendGrid retries), bad signature -> 401.
// With the central contact schema: every event goes through public.record_email_provider_event (idempotent on
// sg_event_id; records the event, updates email_sends, applies bounce/complaint/unsubscribe suppression).
// Without it: only status timestamps on existing email_sends rows are updated.
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  applyLegacyEmailEvent,
  parseEvents,
  readRawBody,
  toPublicKey,
  verifySendgridSignature,
} from "../../../lib/email/sendgridEventWebhook.mjs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  let publicKey = null;
  try {
    publicKey = toPublicKey(process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY);
  } catch {
    publicKey = null;
  }
  if (!publicKey) return res.status(503).json({ ok: false, error: "Event webhook verification key is not configured." });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ ok: false, error: "Could not read the request body." });
  }

  const verified = verifySendgridSignature({
    publicKey,
    signature: req.headers[SIGNATURE_HEADER],
    timestamp: req.headers[TIMESTAMP_HEADER],
    rawBody,
  });
  if (!verified) return res.status(401).json({ ok: false, error: "Invalid signature." });

  let events;
  try {
    events = parseEvents(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid event payload." });
  }

  const counts = {};
  const schemaReady = process.env.MARKETING_CONTACTS_SCHEMA_READY === "true";
  for (const event of events) {
    try {
      let outcome;
      if (schemaReady) {
        if (!event.sg_event_id || !event.event) {
          outcome = "invalid";
        } else {
          const { data, error } = await supabaseAdmin.rpc("record_email_provider_event", { p_event: event });
          if (error) throw error;
          outcome = data;
        }
      } else {
        outcome = await applyLegacyEmailEvent(supabaseAdmin, event);
      }
      counts[outcome] = (counts[outcome] || 0) + 1;
    } catch (error) {
      // Recorded events are idempotent, so a retry of the whole batch is safe.
      console.error("SendGrid event processing failed:", error?.message || error);
      return res.status(503).json({ ok: false, error: "Event could not be persisted; retry.", counts });
    }
  }
  return res.status(200).json({ ok: true, received: events.length, counts });
}
