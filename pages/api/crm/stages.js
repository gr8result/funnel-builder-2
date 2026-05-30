// /pages/api/crm/stages.js
// GET  — list stages for the workspace
// POST — create a new stage (owner/admin only)
// PATCH — update a stage (owner/admin only)
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  const { workspaceId, memberRole } = req;
  const isPrivileged = ["owner", "admin"].includes(memberRole);

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("crm_stages")
        .select("id,name,slug,position,color")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return res.status(200).json({ ok: true, stages: data });
    }

    if (req.method === "POST") {
      if (!isPrivileged)
        return res.status(403).json({ ok: false, error: "Requires owner or admin role" });
      const { name, slug, position, color } = req.body || {};
      const { data, error } = await supabaseAdmin
        .from("crm_stages")
        .insert({ name, slug, position, color, workspace_id: workspaceId })
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, stage: data });
    }

    if (req.method === "PATCH") {
      if (!isPrivileged)
        return res.status(403).json({ ok: false, error: "Requires owner or admin role" });
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: "id required" });
      // Remove workspace_id from fields to prevent hijacking
      delete fields.workspace_id;
      const { data, error } = await supabaseAdmin
        .from("crm_stages")
        .update(fields)
        .eq("id", id)
        .eq("workspace_id", workspaceId) // scope to workspace
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, stage: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/crm/stages]", e);
    return res.status(500).json({ error: "failed" });
  }
}

export default withWorkspace(handler);

