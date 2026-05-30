// /pages/api/crm/lead-call-recordings.js
//
// GET ?lead_id=<uuid>&workspace_id=<uuid>
// Returns calls associated with a lead (by lead_id or phone number match).
// Auth + workspace membership enforced via withWorkspace.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

function s(v) { return String(v ?? "").trim(); }

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

async function handler(req, res) {
  try {
    const { workspaceId } = req;
    const lead_id = s(req.query.lead_id);
    if (!lead_id) return res.status(400).json({ ok: false, error: "Missing lead_id" });

    // Verify lead belongs to this workspace
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, workspace_id, phone, mobile")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr) return res.status(500).json({ ok: false, error: leadErr.message });
    if (!lead?.id) return res.status(404).json({ ok: false, error: "Lead not found" });
    if (lead.workspace_id !== workspaceId) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const p1 = normalizePhone(lead.phone);
    const p2 = normalizePhone(lead.mobile);

    let query = supabaseAdmin
      .from("crm_calls")
      .select([
        "id", "created_at", "direction", "from_number", "to_number",
        "status", "duration", "lead_id", "recording_sid", "recording_url",
        "transcription", "caller_name", "twilio_sid",
      ].join(","))
      .order("created_at", { ascending: false })
      .limit(200);

    if (p1 || p2) {
      const phones = [p1, p2].filter(Boolean);
      query = query.or([
        `lead_id.eq.${lead_id}`,
        ...phones.map((ph) => `contact_number.eq.${ph}`),
        ...phones.map((ph) => `to_number.eq.${ph}`),
        ...phones.map((ph) => `from_number.eq.${ph}`),
      ].join(","));
    } else {
      query = query.eq("lead_id", lead_id);
    }

    const { data: rows, error: callsErr } = await query;
    if (callsErr) return res.status(500).json({ ok: false, error: callsErr.message });

    return res.status(200).json({ ok: true, calls: rows || [] });
  } catch (e) {
    console.error("lead-call-recordings error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler);

