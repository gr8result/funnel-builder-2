// /pages/api/crm/tasks/create.js
// POST { workspace_id, lead_id, title, due_at?, meta? }
// Creates a CRM task reminder

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const { workspaceId } = req;
    const userId = req.user.id;
    const { lead_id, title, due_at, meta } = req.body || {};

    if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id required" });
    if (!String(title || "").trim()) return res.status(400).json({ ok: false, error: "title required" });

    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        lead_id,
        title: String(title),
        due_at: due_at || null,
        status: "open",
        meta: meta || null,
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler);
