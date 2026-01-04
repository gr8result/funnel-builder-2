// ============================================
// /pages/api/email/sendgrid-webhook.js
// FULL REPLACEMENT — FIXES VARIANT (A/B) LOGGING
//
// ✅ Reads variant from SendGrid correctly (custom_args / customArgs / unique_args)
// ✅ NEVER defaults to "B" (defaults to "single" so you can see missing data)
// ✅ Writes events into email_events
// ✅ Tries to update email_sends rows too (if you have them)
// ✅ Uses SERVICE ROLE KEY (server-side only)
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function asArray(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (typeof body === "object") return [body];
  return [];
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function pickArgs(event) {
  // SendGrid Event Webhook is usually custom_args (snake_case)
  // but some code sends customArgs (camelCase)
  return (
    event?.custom_args ||
    event?.customArgs ||
    event?.unique_args ||
    event?.uniqueArgs ||
    {}
  );
}

function getVariant(event) {
  const args = pickArgs(event);

  const raw =
    args?.variant ??
    event?.variant ??
    null;

  if (!raw) return "single"; // IMPORTANT: never default to B
  const s = String(raw).trim().toUpperCase();
  if (s === "A" || s === "B") return s;
  return "single";
}

function getIds(event) {
  const args = pickArgs(event);

  // these should match what you send from send-broadcast.js customArgs/custom_args
  const user_id = args?.user_id || args?.userId || null;
  const broadcast_id = args?.broadcast_id || args?.broadcastId || null;
  const campaign_id = args?.campaign_id || args?.campaignId || null;
  const automation_id = args?.automation_id || args?.automationId || null;

  return { user_id, broadcast_id, campaign_id, automation_id };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // SendGrid posts an array of events
    const events = asArray(req.body);

    if (!events.length) {
      return res.status(200).json({ success: true, received: 0 });
    }

    // Build rows for email_events
    const rows = events.map((ev) => {
      const { user_id, broadcast_id, campaign_id, automation_id } = getIds(ev);
      const variant = getVariant(ev);

      // SendGrid fields commonly present:
      const email = ev?.email || ev?.to || null;
      const sg_message_id =
        (ev?.sg_message_id && safeStr(ev.sg_message_id).split(".")[0]) || null;
      const sg_event_id = ev?.sg_event_id ? safeStr(ev.sg_event_id) : null;
      const event = ev?.event ? safeStr(ev.event) : null;

      // timestamp can be unix seconds
      const ts = ev?.timestamp ? Number(ev.timestamp) : null;
      const occurred_at =
        ts && !Number.isNaN(ts)
          ? new Date(ts * 1000).toISOString()
          : new Date().toISOString();

      return {
        user_id,
        broadcast_id,
        campaign_id,
        automation_id,
        variant, // ✅ THIS is what fixes your "all B" reporting
        email,
        event,
        occurred_at,
        sg_message_id,
        sg_event_id,
        raw: ev, // keep raw for debugging (jsonb column recommended)
      };
    });

    // Insert into email_events (if table exists)
    // If your email_events table doesn't have "raw", remove it.
    const { error: insErr } = await supabaseAdmin
      .from("email_events")
      .insert(rows);

    // Best-effort: also update email_sends if you use that for reports
    // We'll try to match by sg_message_id first, else by (email + broadcast_id)
    // This is safe even if it errors (we don't hard fail).
    try {
      for (const r of rows) {
        if (!r.email) continue;

        // only update if we have an id to link
        const hasAnyId = r.broadcast_id || r.campaign_id || r.automation_id;
        if (!hasAnyId) continue;

        const patch = {
          last_event: r.event,
          last_event_at: r.occurred_at,
          variant: r.variant,
        };

        if (r.sg_message_id) {
          await supabaseAdmin
            .from("email_sends")
            .update(patch)
            .eq("sg_message_id", r.sg_message_id);
        } else if (r.broadcast_id) {
          await supabaseAdmin
            .from("email_sends")
            .update(patch)
            .eq("broadcast_id", r.broadcast_id)
            .eq("recipient_email", r.email);
        }
      }
    } catch (_) {
      // ignore
    }

    if (insErr) {
      // If your table schema differs, this is the error you need to see.
      return res.status(500).json({ success: false, error: insErr.message });
    }

    return res.status(200).json({ success: true, received: rows.length });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Webhook failed" });
  }
}

// IMPORTANT FOR SENDGRID:
// Next.js must not try to parse raw body as text incorrectly.
// Default JSON parsing is fine for SendGrid events.
// If you later add signature verification, you'll need raw body.
