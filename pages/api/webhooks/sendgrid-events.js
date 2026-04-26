// ============================================
// /pages/api/webhooks/sendgrid-events.js
// FINAL UNIFIED SENDGRID WEBHOOK
//
// Handles:
// ✅ Broadcasts (email_sends)
// ✅ Campaigns (email_campaigns_sends)
// ✅ Autoresponders / Automations (email_sends)
// ✅ A/B variant tracking
// ✅ Raw logging to email_events
// ✅ Safe if message id missing
// ✅ Safe if table doesn't match
// ============================================

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const WEBHOOK_SECRET = (process.env.SENDGRID_EVENT_WEBHOOK_SECRET || "").trim();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function verifySignature(req, rawBody) {
  if (!WEBHOOK_SECRET) return true;

  const sig = String(req.headers["x-twilio-email-event-webhook-signature"] || "");
  const ts = String(req.headers["x-twilio-email-event-webhook-timestamp"] || "");
  if (!sig || !ts) return false;

  const payload = ts + rawBody;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("base64");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractVariant(ev) {
  const args =
    ev?.custom_args ||
    ev?.customArgs ||
    ev?.unique_args ||
    ev?.uniqueArgs ||
    {};

  const raw = args?.variant ?? ev?.variant ?? null;

  if (!raw) return "single";

  const v = String(raw).trim().toUpperCase();
  if (v === "A" || v === "B") return v;
  return "single";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const rawBody = JSON.stringify(req.body || []);
    if (!verifySignature(req, rawBody)) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    const events = Array.isArray(req.body) ? req.body : [];
    if (!events.length) {
      return res.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const ev of events) {
      const eventType = String(ev?.event || "").toLowerCase();

      const ts = ev?.timestamp
        ? new Date(Number(ev.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      const rawId =
        ev?.sg_message_id ||
        ev?.sgMessageId ||
        null;

      if (!rawId) continue;

      const sgMessageId = String(rawId).split(".")[0];
      const email = ev?.email || ev?.to || null;
      const variant = extractVariant(ev);

      // ---------------------------------------
      // 1️⃣ RAW EVENT LOGGING (email_events)
      // ---------------------------------------
      await supabase.from("email_events").insert({
        provider: "sendgrid",
        event: eventType,
        email,
        occurred_at: ts,
        sg_message_id: sgMessageId,
        variant,
        raw: ev,
      });

      const patch = {
        last_event: eventType,
        last_event_at: ts,
        variant,
      };

      if (eventType === "delivered") {
        patch.delivered_at = ts;
        patch.status = "delivered";
      }

      if (eventType === "open") {
        patch.opened_at = ts;
      }

      if (eventType === "click") {
        patch.clicked_at = ts;
        patch.status = "clicked";
      }

      if (eventType === "bounce" || eventType === "dropped") {
        patch.bounced_at = ts;
        patch.status = "bounced";
      }

      if (
        eventType === "unsubscribe" ||
        eventType === "group_unsubscribe"
      ) {
        patch.unsubscribed = true;
        patch.status = "unsubscribe";
      }

      // ---------------------------------------
      // 2️⃣ BROADCAST + AUTOMATION TABLE
      // ---------------------------------------
      const { data: sendRow } = await supabase
        .from("email_sends")
        .select("id")
        .or(
          `sendgrid_message_id.eq.${sgMessageId},sg_message_id.eq.${sgMessageId}`
        )
        .maybeSingle();

      if (sendRow?.id) {
        await supabase
          .from("email_sends")
          .update(patch)
          .eq("id", sendRow.id);

        processed++;
        continue;
      }

      // ---------------------------------------
      // 3️⃣ CAMPAIGN TABLE
      // ---------------------------------------
      const { data: campaignRow } = await supabase
        .from("email_campaigns_sends")
        .select("id")
        .eq("sendgrid_message_id", sgMessageId)
        .maybeSingle();

      if (campaignRow?.id) {
        await supabase
          .from("email_campaigns_sends")
          .update(patch)
          .eq("id", campaignRow.id);

        processed++;
      }
    }

    return res.json({ ok: true, processed });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
}
