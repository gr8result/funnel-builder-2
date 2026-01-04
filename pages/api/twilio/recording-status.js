// /pages/api/twilio/recording-status.js
// Receives Twilio recordingStatusCallback and stores it into Lead Notes.
//
// Requires env:
// SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
//
// Notes storage strategy:
// 1) Try insert into "lead_notes" table (lead_id, note, created_at)
// 2) Fallback: append to leads.notes (json array) if it exists

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  try {
    // Twilio sends x-www-form-urlencoded by default
    const body = req.body || {};
    const leadId = String(req.query?.leadId || body?.leadId || "").trim();

    const recordingSid = body?.RecordingSid;
    const callSid = body?.CallSid;
    const status = body?.RecordingStatus;
    const recordingUrl = body?.RecordingUrl; // base URL (no extension)

    // best playable link:
    const mp3Url = recordingUrl ? `${recordingUrl}.mp3` : "";

    const line = `[${new Date().toISOString()}] Call recorded`
      + (status ? ` (${status})` : "")
      + (callSid ? ` • CallSid: ${callSid}` : "")
      + (recordingSid ? ` • RecordingSid: ${recordingSid}` : "")
      + (mp3Url ? ` • ${mp3Url}` : "");

    if (!leadId) {
      // still return 200 to Twilio (don't retry forever)
      return res.status(200).json({ ok: true, skipped: true, reason: "No leadId provided" });
    }

    // 1) Try lead_notes table first
    const { error: insErr } = await supabaseAdmin
      .from("lead_notes")
      .insert([{ lead_id: leadId, note: line }]);

    if (!insErr) {
      return res.status(200).json({ ok: true, stored: "lead_notes" });
    }

    // 2) Fallback to leads.notes as json array
    const { data: leadRow, error: selErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .eq("id", leadId)
      .single();

    if (selErr) {
      return res.status(200).json({ ok: true, stored: "none", error: selErr.message, insertError: insErr.message });
    }

    const existing = Array.isArray(leadRow?.notes) ? leadRow.notes : [];
    const next = [...existing, line];

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({ notes: next })
      .eq("id", leadId);

    return res.status(200).json({ ok: true, stored: updErr ? "none" : "leads.notes", error: updErr?.message || null, insertError: insErr.message });
  } catch (e) {
    // Always 200 to Twilio so it doesn't retry endlessly
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
