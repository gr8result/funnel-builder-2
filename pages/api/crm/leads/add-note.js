// /pages/api/crm/leads/add-note.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ ok: false, error: "Invalid auth token" });

    const userId = userData.user.id;

    const { lead_id, note, meta } = req.body || {};
    if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id required" });
    if (!String(note || "").trim()) return res.status(400).json({ ok: false, error: "note required" });

    // 1) Try insert into lead_notes (best)
    // Expected-ish columns: user_id, lead_id, note, meta
    const tryInsert = await supabaseAdmin
      .from("lead_notes")
      .insert({
        user_id: userId,
        lead_id,
        note: String(note),
        meta: meta || null,
      })
      .select("id")
      .single();

    if (!tryInsert.error && tryInsert.data?.id) {
      return res.status(200).json({ ok: true, mode: "lead_notes", id: tryInsert.data.id });
    }

    // 2) Fallback: append to leads.notes (text)
    // If leads.notes doesn't exist, this will error and we return the lead_notes error message for visibility.
    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .eq("user_id", userId)
      .eq("id", lead_id)
      .single();

    if (leadErr) {
      return res.status(500).json({
        ok: false,
        error: tryInsert.error?.message || leadErr.message || "Could not write note",
      });
    }

    const existing = String(leadRow?.notes || "").trim();
    const stamp = new Date().toISOString();
    const next = existing ? `${existing}\n\n[${stamp}]\n${String(note)}` : `[${stamp}]\n${String(note)}`;

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({ notes: next })
      .eq("user_id", userId)
      .eq("id", lead_id);

    if (updErr) {
      return res.status(500).json({
        ok: false,
        error: tryInsert.error?.message || updErr.message || "Could not write note",
      });
    }

    return res.status(200).json({ ok: true, mode: "leads.notes" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
