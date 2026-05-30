// /pages/api/crm/append-lead-note.js
// POST { leadId, note, workspace_id }
// Appends a timestamped note to leads.notes.
// Requires authentication + workspace membership verification.
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { workspaceId } = req;
  const leadId = String(req.body?.leadId || "").trim();
  const note = String(req.body?.note || "").trim();

  if (!leadId) return res.status(400).json({ ok: false, error: "Missing leadId" });
  if (!note) return res.status(400).json({ ok: false, error: "Missing note" });

  try {
    // Fetch lead — enforce workspace ownership in the query itself
    const { data: lead, error: selErr } = await supabaseAdmin
      .from("leads")
      .select("id, notes")
      .eq("id", leadId)
      .eq("workspace_id", workspaceId)
      .single();

    if (selErr || !lead) {
      return res.status(404).json({ ok: false, error: "Lead not found in this workspace" });
    }

    const prev = String(lead?.notes || "");
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${note}`;
    const merged = prev ? `${prev}\n\n${newNote}` : newNote;

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({ notes: merged, updated_at: new Date() })
      .eq("id", leadId)
      .eq("workspace_id", workspaceId);
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[/api/crm/append-lead-note] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

export default withWorkspace(handler);
