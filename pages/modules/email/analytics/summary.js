// /pages/api/email/analytics/summary.js
// Returns totals for: all, broadcasts, campaigns, autoresponders, automations
// Sources: email_events + email_campaign_queue
// IMPORTANT: works even if your schema uses different foreign key column names

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const init = () => ({
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
  spam: 0,
  queued: 0,
});

const normEvent = (r) => String(r?.event || r?.type || r?.name || "").toLowerCase();

const classify = (r) => {
  if (r.broadcast_id || r.email_broadcast_id) return "broadcasts";
  if (r.campaign_id || r.email_campaign_id) return "campaigns";
  if (r.autoresponder_id || r.sequence_id) return "autoresponders";
  if (r.automation_id || r.flow_id) return "automations";
  return "unknown";
};

export default async function handler(req, res) {
  try {
    const { userId, period = "today" } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

    // time filter
    const now = new Date();
    const start = new Date(now);
    if (period === "today") start.setHours(0, 0, 0, 0);
    else if (period === "7") start.setDate(start.getDate() - 7);
    else if (period === "30") start.setDate(start.getDate() - 30);
    else if (period === "90") start.setDate(start.getDate() - 90);
    const timeMin = period === "all" ? null : start.toISOString();

    // pull rows (keep it bounded)
    let evQ = supabaseAdmin
      .from("email_events")
      .select("id,created_at,user_id,event,type,name,broadcast_id,email_broadcast_id,campaign_id,email_campaign_id,autoresponder_id,automation_id,flow_id,sequence_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (timeMin) evQ = evQ.gte("created_at", timeMin);

    let qQ = supabaseAdmin
      .from("email_campaign_queue")
      .select("id,created_at,user_id,status,broadcast_id,email_broadcast_id,campaign_id,email_campaign_id,autoresponder_id,automation_id,flow_id,sequence_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (timeMin) qQ = qQ.gte("created_at", timeMin);

    const [{ data: events, error: evErr }, { data: queue, error: qErr }] = await Promise.all([evQ, qQ]);
    if (evErr) throw evErr;
    if (qErr) throw qErr;

    const out = {
      all: init(),
      broadcasts: init(),
      campaigns: init(),
      autoresponders: init(),
      automations: init(),
      unknown: init(),
      debug: {
        events_rows: events?.length || 0,
        queue_rows: queue?.length || 0,
        timeMin,
      },
    };

    // queue => queued + sent-ish
    for (const r of queue || []) {
      const t = classify(r);
      out.all.queued += 1;
      out[t].queued += 1;

      const st = String(r?.status || "").toLowerCase();
      if (st === "sent" || st === "delivered") {
        out.all.sent += 1;
        out[t].sent += 1;
      }
    }

    // events => delivered/open/click/unsub/bounce/spam
    for (const r of events || []) {
      const t = classify(r);
      const ev = normEvent(r);

      if (ev === "delivered") { out.all.delivered++; out[t].delivered++; }
      else if (ev === "open" || ev === "opened") { out.all.opened++; out[t].opened++; }
      else if (ev === "click" || ev === "clicked") { out.all.clicked++; out[t].clicked++; }
      else if (ev === "unsubscribe" || ev === "unsubscribed" || ev === "group_unsubscribe") { out.all.unsubscribed++; out[t].unsubscribed++; }
      else if (ev === "bounce" || ev === "bounced" || ev === "blocked" || ev === "dropped") { out.all.bounced++; out[t].bounced++; }
      else if (ev === "spamreport" || ev === "spam_report" || ev === "complaint") { out.all.spam++; out[t].spam++; }
    }

    // fallback: if no queue sent, treat delivered as sent
    for (const k of ["all", "broadcasts", "campaigns", "autoresponders", "automations", "unknown"]) {
      if (out[k].sent === 0 && out[k].delivered > 0) out[k].sent = out[k].delivered;
    }

    return res.status(200).json({ success: true, summary: out });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Analytics summary error" });
  }
}
