// /pages/api/crm/calls.js
// CRM calls API – GET + DELETE only

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

async function handler(req, res) {
  const { workspaceId } = req;
  const { method } = req;

  try {
    // GET – list calls for this workspace
    if (method === "GET") {
      const limit = parseInt(req.query.limit || "500", 10);

      const { data, error } = await supabaseAdmin
        .from("crm_calls")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[/api/crm/calls] GET error:", error);
        return res.status(500).json({ error: "Failed to load calls." });
      }

      return res.status(200).json({ ok: true, calls: data || [] });
    }

    // DELETE – remove a call record
    if (method === "DELETE") {
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: "Missing call id." });
      }

      // Verify the call belongs to this workspace before deleting
      const { data: existing } = await supabaseAdmin
        .from("crm_calls")
        .select("workspace_id")
        .eq("id", id)
        .maybeSingle();

      if (existing && existing.workspace_id !== workspaceId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { error } = await supabaseAdmin.from("crm_calls").delete().eq("id", id);

      if (error) {
        console.error("[/api/crm/calls] DELETE error:", error);
        return res.status(500).json({ error: "Failed to delete call." });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/crm/calls] Unexpected error:", err);
    return res.status(500).json({ error: "Server error." });
  }
}

export default withWorkspace(handler);
