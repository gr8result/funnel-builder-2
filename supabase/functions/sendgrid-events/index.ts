// /supabase/functions/sendgrid-events/index.ts
// FULL REPLACEMENT — JS-only SendGrid Event Webhook receiver
// ✅ Stores raw events in public.sendgrid_events
// ✅ Updates public.email_campaigns_queue with delivered/open/bounce/drop status
// ✅ Matches by sendgrid_message_id (recommended) and email fallback

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Normalizes SendGrid message id formats so matching is more reliable
function normalizeMsgId(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // SendGrid sometimes sends "xxx.filter0001p3...@sendgrid.net"
  // and queue might store only left part; keep as-is but also strip surrounding <>
  return s.replace(/^<|>$/g, "");
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let events;
  try {
    events = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  if (!Array.isArray(events)) {
    // SendGrid sends an array of events
    return json(400, { ok: false, error: "Expected an array of events" });
  }

  let inserted = 0;
  let updated = 0;

  for (const ev of events) {
    try {
      const event = String(ev?.event || "").trim();
      const email = String(ev?.email || "").trim().toLowerCase();
      const timestamp = Number(ev?.timestamp || 0) || null;

      // SendGrid provides these fields in event payload
      const sg_message_id = normalizeMsgId(ev?.["sg_message_id"] || ev?.["smtp-id"] || "");
      const sg_event_id = String(ev?.["sg_event_id"] || "").trim() || null;

      // 1) Store raw event for audit/debug
      await supabase.from("sendgrid_events").insert({
        event: event || null,
        email: email || null,
        timestamp,
        sg_message_id: sg_message_id || null,
        sg_event_id,
        payload: ev,
      });

      inserted++;

      // 2) Update queue status fields
      // Prefer matching by sendgrid_message_id (best),
      // fallback to latest unsent row for that email (helps if msg id missing).
      let q = supabase.from("email_campaigns_queue").update({
        sendgrid_event_status: event || null,
      });

      const nowIso = new Date().toISOString();

      if (event === "delivered") q = q.update({ delivered_at: nowIso });
      if (event === "open") q = q.update({ opened_at: nowIso });
      if (event === "bounce") q = q.update({ bounced_at: nowIso });
      if (event === "dropped") q = q.update({ dropped_at: nowIso });

      let updateQuery;

      if (sg_message_id) {
        updateQuery = q.eq("sendgrid_message_id", sg_message_id);
      } else if (email) {
        // fallback: update the most recent row for that email that we accepted/sent
        updateQuery = q
          .or(`to_email.eq.${email},subscriber_email.eq.${email}`)
          .in("status", ["accepted", "sent", "scheduled", "queued"])
          .order("created_at", { ascending: false })
          .limit(1);
      } else {
        continue;
      }

      const { error: upErr } = await updateQuery;
      if (!upErr) updated++;
    } catch {
      // swallow single-event errors so batch still processes
    }
  }

  return json(200, { ok: true, inserted, updated });
});
