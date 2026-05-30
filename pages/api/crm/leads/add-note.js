// /pages/api/crm/leads/add-note.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const { workspaceId } = req;
  const userId = req.user.id;

  const { lead_id, note, meta } = req.body || {};
  if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id required" });
  if (!String(note || "").trim()) return res.status(400).json({ ok: false, error: "note required" });

  try {
    // 1) Try insert into lead_notes
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

    // 2) Fallback: append to leads.notes — verify lead belongs to this workspace first
    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .eq("workspace_id", workspaceId)
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
      .eq("workspace_id", workspaceId)
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

export default withWorkspace(handler);

