// /pages/api/webhooks/sendgrid-events.js
//
// SendGrid Event Webhook receiver
// Updates email_sends based on sendgrid_message_id OR customArgs.gr8_send_row_id
//
// IMPORTANT:
// - In SendGrid dashboard: Settings → Mail Settings → Event Webhook
// - Point it to: https://YOURDOMAIN.com/api/webhooks/sendgrid-events
// - Select events: processed, delivered, open, click, bounce, dropped, spamreport, unsubscribe
//
// Requires SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const supabaseAdmin = sb();

    // SendGrid sends an array of events
    const events = Array.isArray(req.body) ? req.body : [];
    if (!events.length) return res.json({ ok: true, processed: 0 });

    let processed = 0;

    for (const ev of events) {
      const eventType = String(ev?.event || "").toLowerCase();
      const ts = ev?.timestamp ? new Date(ev.timestamp * 1000).toISOString() : new Date().toISOString();

      // Primary match:
      // 1) custom_args.gr8_send_row_id (best)
      // 2) sg_message_id (SendGrid message id)
      const customArgs = ev?.custom_args || ev?.customArgs || {};
      const rowId = customArgs?.gr8_send_row_id ? String(customArgs.gr8_send_row_id) : null;

      const sgMsgIdRaw = ev?.sg_message_id || ev?.sg_messageId || ev?.["sg_message_id"];
      const sgMsgId = sgMsgIdRaw ? String(sgMsgIdRaw).split(".")[0] : null; // SendGrid sometimes appends .filter

      // Build update patch
      const patch = {
        last_event: eventType || "event",
        last_event_at: ts,
      };

      if (eventType === "open") patch.open_count = (ev?.open_count ? Number(ev.open_count) : null); // usually not present
      if (eventType === "click") patch.click_count = (ev?.click_count ? Number(ev.click_count) : null);

      if (eventType === "bounce" || eventType === "dropped") patch.bounced_at = ts;
      if (eventType === "unsubscribe" || eventType === "group_unsubscribe") patch.unsubscribed = true;

      // We increment opens/clicks ourselves if counts not provided
      // (safer: increments rather than overwrite)
      let didUpdate = false;

      if (rowId) {
        // increment counters safely with RPC-like pattern (read then update)
        const { data: existing } = await supabaseAdmin.from("email_sends").select("id, open_count, click_count").eq("id", rowId).maybeSingle();
        if (existing?.id) {
          if (eventType === "open") patch.open_count = Number(existing.open_count || 0) + 1;
          if (eventType === "click") patch.click_count = Number(existing.click_count || 0) + 1;

          const { error } = await supabaseAdmin.from("email_sends").update(patch).eq("id", rowId);
          if (!error) { processed += 1; didUpdate = true; }
        }
      }

      if (!didUpdate && sgMsgId) {
        const { data: existing } = await supabaseAdmin
          .from("email_sends")
          .select("id, open_count, click_count")
          .eq("sendgrid_message_id", sgMsgId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          if (eventType === "open") patch.open_count = Number(existing.open_count || 0) + 1;
          if (eventType === "click") patch.click_count = Number(existing.click_count || 0) + 1;

          const { error } = await supabaseAdmin.from("email_sends").update(patch).eq("id", existing.id);
          if (!error) processed += 1;
        }
      }
    }

    return res.json({ ok: true, processed });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
