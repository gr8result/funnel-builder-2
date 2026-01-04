// /pages/api/twilio/status-callback.js
// FULL REPLACEMENT
// ✅ Logs call outcome + recordings into BOTH:
//    1) lead_notes (if table exists)
//    2) leads.notes (always, so your Leads module definitely shows it)
// ✅ If not answered/busy/failed -> also creates a reminder task (crm_tasks) if table exists

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

function addHoursISO(h) {
  const d = new Date(Date.now() + h * 60 * 60 * 1000);
  return d.toISOString();
}

async function appendLeadsNotesAlways({ userId, leadId, note }) {
  if (!userId || !leadId || !note) return { ok: false };

  const { data: leadRow, error: leadErr } = await supabaseAdmin
    .from("leads")
    .select("id, notes")
    .eq("user_id", userId)
    .eq("id", leadId)
    .single();

  if (leadErr) return { ok: false, error: leadErr.message };

  const existing = String(leadRow?.notes || "").trim();
  const stamped = `[${new Date().toLocaleString()}]\n${String(note)}`;
  const next = existing ? `${existing}\n\n${stamped}` : stamped;

  const { error: updErr } = await supabaseAdmin.from("leads").update({ notes: next }).eq("user_id", userId).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

async function tryInsertLeadNotes({ userId, leadId, note, meta }) {
  if (!userId || !leadId || !note) return { ok: false };

  const ins = await supabaseAdmin
    .from("lead_notes")
    .insert({ user_id: userId, lead_id: leadId, note: String(note), meta: meta || null })
    .select("id")
    .single();

  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, id: ins.data?.id || null };
}

async function createReminderTask({ userId, leadId, title, dueAt, meta }) {
  if (!userId || !leadId) return { ok: false };

  const attempt = await supabaseAdmin
    .from("crm_tasks")
    .insert({
      user_id: userId,
      lead_id: leadId,
      title: title || "Call back",
      due_at: dueAt || addHoursISO(2),
      status: "open",
      meta: meta || null,
    })
    .select("id")
    .single();

  if (attempt.error) return { ok: false, error: attempt.error.message };
  return { ok: true, id: attempt.data?.id || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).send("Method not allowed");

  try {
    const lead_id = (req.query?.lead_id || "").toString().trim() || null;
    const toQuery = normalizePhone((req.query?.to || "").toString());
    const event = (req.query?.event || "").toString().trim() || "";

    const body = req.body || {};

    const CallSid = (body.CallSid || "").toString() || null;
    const CallStatus = (body.CallStatus || "").toString().toLowerCase();
    const From = (body.From || "").toString();
    const To = (body.To || "").toString();
    const Duration = (body.CallDuration || "").toString();

    const RecordingSid = (body.RecordingSid || "").toString() || null;
    const RecordingUrl = (body.RecordingUrl || "").toString() || null;

    if (!lead_id) return res.status(200).send("OK");

    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, name, email, phone")
      .eq("id", lead_id)
      .single();

    if (leadErr || !leadRow?.user_id) return res.status(200).send("OK");
    const userId = leadRow.user_id;

    const leadName = leadRow.name || leadRow.email || leadRow.phone || `Lead #${lead_id}`;
    const target = toQuery || normalizePhone(leadRow.phone) || normalizePhone(To) || "";

    // RECORDING CALLBACK
    if (event === "recording" || RecordingSid || RecordingUrl) {
      const recLink = RecordingSid
        ? `/api/twilio/recording?sid=${encodeURIComponent(RecordingSid)}`
        : RecordingUrl
        ? `/api/twilio/recording?url=${encodeURIComponent(RecordingUrl)}`
        : null;

      const note = `📞 Call recording saved
Lead: ${leadName}
When: ${new Date().toLocaleString()}
To: ${target || "-"}
Recording: ${recLink || "n/a"}
Call SID: ${CallSid || "-"}`;

      // write to both stores
      await tryInsertLeadNotes({
        userId,
        leadId: lead_id,
        note,
        meta: {
          type: "call_recording",
          call_sid: CallSid,
          recording_sid: RecordingSid,
          recording_url: RecordingUrl,
          to: target || To || null,
          from: From || null,
        },
      }).catch(() => {});
      await appendLeadsNotesAlways({ userId, leadId: lead_id, note }).catch(() => {});

      return res.status(200).send("OK");
    }

    // ONLY TERMINAL STATUSES
    const terminal = ["completed", "busy", "failed", "no-answer", "canceled"].includes(CallStatus);
    if (!terminal) return res.status(200).send("OK");

    const dur = Number(Duration) || 0;
    const notAnswered = ["no-answer", "busy", "failed", "canceled"].includes(CallStatus);

    const reminderDue = addHoursISO(2);

    const noteLines = [
      `📞 Call attempt`,
      `Lead: ${leadName}`,
      `Outcome: ${notAnswered ? "❌ Not answered" : "✅ Connected"}`,
      `Status: ${CallStatus || "-"}`,
      `When: ${new Date().toLocaleString()}`,
      `To: ${target || "-"}`,
      `From: ${From || "-"}`,
      `Duration: ${dur}s`,
      CallSid ? `Call SID: ${CallSid}` : null,
      notAnswered ? `⏰ Reminder set: call again later (${new Date(reminderDue).toLocaleString()})` : null,
    ].filter(Boolean);

    const note = noteLines.join("\n");

    // write to both stores
    await tryInsertLeadNotes({
      userId,
      leadId: lead_id,
      note,
      meta: {
        type: "call_outcome",
        call_sid: CallSid,
        status: CallStatus || null,
        duration: dur,
        to: target || null,
        from: From || null,
        not_answered: notAnswered,
      },
    }).catch(() => {});
    await appendLeadsNotesAlways({ userId, leadId: lead_id, note }).catch(() => {});

    // reminder task (optional table)
    if (notAnswered) {
      await createReminderTask({
        userId,
        leadId: lead_id,
        title: `Call back: ${leadName}`,
        dueAt: reminderDue,
        meta: { type: "call_back", call_sid: CallSid || null, phone: target || null },
      }).catch(() => {});
    }

    return res.status(200).send("OK");
  } catch (e) {
    return res.status(200).send("OK");
  }
}
