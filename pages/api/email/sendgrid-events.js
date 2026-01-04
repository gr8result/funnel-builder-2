// /pages/api/email/sendgrid-events.js
// Receive SendGrid Event Webhook and update:
// - email_events (raw log of every event)
// - email_sends  (per-recipient aggregated stats used by reports)
//
// IMPORTANT:
// - Works with SendGrid "Event Webhook" (POSTs an ARRAY of events)
// - Does NOT require signed webhook (you currently have Signed Event: Disabled)
// - Requires SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL in env

import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeStr(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

function toIsoFromUnixSeconds(sec) {
  if (!sec) return null;
  const n = Number(sec);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

function normalizeEvent(ev) {
  const custom = ev?.custom_args || ev?.customArgs || {};
  // IMPORTANT: SendGrid custom_args are strings.
  const user_id = safeStr(custom.user_id || custom.userId || ev?.user_id);
  const broadcast_id = safeStr(custom.broadcast_id || custom.broadcastId || ev?.broadcast_id);
  const campaigns_id = safeStr(custom.campaigns_id || custom.campaignsId || ev?.campaigns_id);
  const automation_id = safeStr(custom.automation_id || custom.automationId || ev?.automation_id);
  const variant = safeStr(custom.variant || ev?.variant || null);

  const subscriber_id = safeStr(custom.subscriber_id || custom.subscriberId || null);
  const send_id = safeStr(custom.send_id || custom.sendId || null);

  const email = safeStr(ev?.email);
  const event = safeStr(ev?.event);
  const ts = ev?.timestamp;

  // sg_message_id sometimes comes like: "abc.def@sendgrid.net"
  const sg_message_id = safeStr(ev?.sg_message_id || ev?.smtp_id || null);
  const sg_event_id = safeStr(ev?.sg_event_id || null);

  return {
    raw: ev,
    user_id,
    broadcast_id,
    campaigns_id,
    automation_id,
    variant,
    subscriber_id,
    send_id,
    email,
    event,
    timestamp: ts,
    occurred_at: toIsoFromUnixSeconds(ts),
    sg_message_id,
    sg_event_id,
  };
}

async function upsertRawEvent(n) {
  // If you have different columns in email_events, this still usually works
  // because Supabase ignores unknown keys only if table has those columns.
  // If your table is strict, remove/adjust fields as needed.
  const row = {
    user_id: n.user_id,
    broadcast_id: n.broadcast_id,
    campaigns_id: n.campaigns_id,
    automation_id: n.automation_id,
    email: n.email,
    event: n.event,
    occurred_at: n.occurred_at,
    timestamp: n.timestamp,
    sg_message_id: n.sg_message_id,
    sg_event_id: n.sg_event_id,
    variant: n.variant,
    subscriber_id: n.subscriber_id,
    send_id: n.send_id,
    payload: n.raw, // if you have a jsonb column called payload
  };

  // If your table does not have "payload", fallback to "raw" or remove it.
  const { error } = await supabaseAdmin.from("email_events").insert([row]);
  if (error) {
    // fallback attempt without payload
    const row2 = { ...row };
    delete row2.payload;
    const r2 = await supabaseAdmin.from("email_events").insert([row2]);
    if (r2.error) throw r2.error;
  }
}

async function findOrCreateSendRow(n) {
  // Goal: find the email_sends row for this recipient + broadcast/campaigns
  // Priority:
  // 1) send_id (best)
  // 2) sg_message_id + user_id
  // 3) email + broadcast_id/campaigns_id + user_id (fallback)

  if (!n.user_id) return null; // cannot attribute without user_id
  if (!n.email) return null;

  // 1) send_id
  if (n.send_id) {
    const { data } = await supabaseAdmin
      .from("email_sends")
      .select("*")
      .eq("send_id", n.send_id)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 2) sg_message_id + user_id
  if (n.sg_message_id) {
    const { data } = await supabaseAdmin
      .from("email_sends")
      .select("*")
      .eq("user_id", n.user_id)
      .eq("sg_message_id", n.sg_message_id)
      .eq("email", n.email)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 3) fallback by email + broadcast/campaigns + user_id
  if (n.broadcast_id || n.campaigns_id || n.automation_id) {
    let q = supabaseAdmin
      .from("email_sends")
      .select("*")
      .eq("user_id", n.user_id)
      .eq("email", n.email)
      .limit(1);

    if (n.broadcast_id) q = q.eq("broadcast_id", n.broadcast_id);
    if (n.campaigns_id) q = q.eq("campaigns_id", n.campaigns_id);
    if (n.automation_id) q = q.eq("automation_id", n.automation_id);

    const { data } = await q.maybeSingle();
    if (data) return data;
  }

  // Create minimal row if not found
  const insertRow = {
    user_id: n.user_id,
    broadcast_id: n.broadcast_id,
    campaigns_id: n.campaigns_id,
    automation_id: n.automation_id,
    email: n.email,
    variant: n.variant,
    subscriber_id: n.subscriber_id,
    send_id: n.send_id,
    sg_message_id: n.sg_message_id,
    processed_at: null,
    delivered_at: null,
    open_count: 0,
    click_count: 0,
    bounced_at: null,
    unsubscribed: false,
    spam_reported: false,
    last_event: null,
    last_event_at: null,
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabaseAdmin
    .from("email_sends")
    .insert([insertRow])
    .select("*")
    .single();

  if (error) throw error;
  return created;
}

function applyEventToSendRow(existing, n) {
  const patch = {};
  const nowIso = n.occurred_at || new Date().toISOString();

  patch.last_event = n.event;
  patch.last_event_at = nowIso;

  // Mark basic milestones
  if (n.event === "processed") patch.processed_at = nowIso;
  if (n.event === "delivered") patch.delivered_at = nowIso;

  // Opens/clicks
  if (n.event === "open") patch.open_count = Number(existing.open_count || 0) + 1;
  if (n.event === "click") patch.click_count = Number(existing.click_count || 0) + 1;

  // Negative events
  if (n.event === "bounce") patch.bounced_at = nowIso;
  if (n.event === "dropped") patch.bounced_at = existing.bounced_at || nowIso;
  if (n.event === "deferred") patch.last_event_at = nowIso;

  // Unsub/spam
  if (n.event === "unsubscribe" || n.event === "group_unsubscribe") patch.unsubscribed = true;
  if (n.event === "spamreport") patch.spam_reported = true;

  // Keep identifiers filled
  if (!existing.sg_message_id && n.sg_message_id) patch.sg_message_id = n.sg_message_id;
  if (!existing.send_id && n.send_id) patch.send_id = n.send_id;
  if (!existing.subscriber_id && n.subscriber_id) patch.subscriber_id = n.subscriber_id;
  if (!existing.variant && n.variant) patch.variant = n.variant;

  if (!existing.broadcast_id && n.broadcast_id) patch.broadcast_id = n.broadcast_id;
  if (!existing.campaigns_id && n.campaigns_id) patch.campaigns_id = n.campaigns_id;
  if (!existing.automation_id && n.automation_id) patch.automation_id = n.automation_id;

  return patch;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ success: false, error: "Use POST for this endpoint." });
  }

  try {
    const payload = req.body;

    const events = Array.isArray(payload) ? payload : payload ? [payload] : [];
    if (!events.length) {
      return res.status(200).json({ success: true, processed: 0, note: "No events in payload." });
    }

    let processed = 0;
    const errors = [];

    for (const ev of events) {
      const n = normalizeEvent(ev);

      // If we have no user_id OR no email OR no event, we can't do anything useful.
      // Still log raw event best-effort.
      try {
        await upsertRawEvent(n);
      } catch (e) {
        // don't block processing; keep going
      }

      if (!n.user_id || !n.email || !n.event) {
        continue;
      }

      // Create/find send row and update aggregates
      try {
        const existing = await findOrCreateSendRow(n);
        if (!existing) continue;

        const patch = applyEventToSendRow(existing, n);

        const { error: ue } = await supabaseAdmin
          .from("email_sends")
          .update(patch)
          .eq("id", existing.id);

        if (ue) throw ue;

        processed += 1;
      } catch (e) {
        errors.push(String(e?.message || e));
      }
    }

    return res.status(200).json({
      success: true,
      processed,
      errors: errors.length ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err?.message || err) });
  }
}
