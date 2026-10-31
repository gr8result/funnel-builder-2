// SendGrid Signed Event Webhook: ECDSA signature over (timestamp header + raw request body), SHA-256.
// The public key shown in SendGrid (Mail Settings -> Event Webhook -> Signature verification) is base64 DER SPKI.
import { createPublicKey, verify } from "node:crypto";

export const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
export const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

export function toPublicKey(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const pem = text.includes("BEGIN PUBLIC KEY")
    ? text
    : `-----BEGIN PUBLIC KEY-----\n${text.replace(/\s+/g, "").match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----\n`;
  return createPublicKey(pem);
}

export function verifySendgridSignature({ publicKey, signature, timestamp, rawBody }) {
  if (!publicKey || !signature || !timestamp || !Buffer.isBuffer(rawBody)) return false;
  try {
    return verify("sha256", Buffer.concat([Buffer.from(String(timestamp), "utf8"), rawBody]), publicKey, Buffer.from(String(signature), "base64"));
  } catch {
    return false;
  }
}

export async function readRawBody(req, limitBytes = 5 * 1024 * 1024) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw Object.assign(new Error("Payload too large"), { statusCode: 413 });
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function parseEvents(rawBody) {
  const parsed = JSON.parse(rawBody.toString("utf8"));
  if (!Array.isArray(parsed)) throw new Error("SendGrid posts a JSON array of events.");
  return parsed.filter((event) => event && typeof event === "object");
}

const messageIdOf = (event) => String(event.sg_message_id || "").split(".")[0] || null;

// Pre-migration fallback: timestamps/status on the existing email_sends columns only. Replays are harmless
// (first-seen timestamps are kept, counters are not incremented here).
export async function applyLegacyEmailEvent(db, event) {
  const messageId = messageIdOf(event);
  const kind = String(event.event || "").toLowerCase();
  if (!messageId || !kind) return "skipped";
  const at = Number.isFinite(Number(event.timestamp)) ? new Date(Number(event.timestamp) * 1000).toISOString() : new Date().toISOString();

  let row = null;
  for (const column of ["sendgrid_message_id", "sg_message_id"]) {
    const { data, error } = await db.from("email_sends")
      .select("id,delivered_at,opened_at,first_open_at,clicked_at,bounced_at,unsubscribed_at")
      .eq(column, messageId).limit(2);
    if (error) throw error;
    if ((data || []).length > 1) return "ambiguous";
    if (data?.length === 1) { row = data[0]; break; }
  }
  if (!row) return "unmatched";

  const patch = { last_event: kind, last_event_at: at };
  if (kind === "delivered") Object.assign(patch, { status: "delivered", delivered_at: row.delivered_at || at });
  if (kind === "open") Object.assign(patch, { opened_at: row.opened_at || at, first_open_at: row.first_open_at || at, last_open_at: at });
  if (kind === "click") Object.assign(patch, { clicked_at: row.clicked_at || at, last_click_at: at });
  if (kind === "bounce" && String(event.type || "").toLowerCase() === "bounce") Object.assign(patch, { status: "bounced", bounced_at: row.bounced_at || at });
  if (kind === "dropped") patch.status = "dropped";
  if (kind === "spamreport") patch.spam_reported = true;
  if (kind === "unsubscribe" || kind === "group_unsubscribe") Object.assign(patch, { status: "unsubscribed", unsubscribed: true, unsubscribed_at: row.unsubscribed_at || at });
  const { error } = await db.from("email_sends").update(patch).eq("id", row.id);
  if (error) throw error;
  return "updated";
}
