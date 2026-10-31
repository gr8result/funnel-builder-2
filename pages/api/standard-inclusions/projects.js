import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  const { data, error } = await supabaseAdmin
    .from("builder_commercial_projects")
    .select("id,project_name,client_name,site_address,status,updated_at")
    .eq("workspace_id", req.workspaceId)
    .not("status", "in", "(cancelled,archived)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) return res.status(503).json({ ok: false, error: "Workspace projects could not be loaded." });
  return res.status(200).json({ ok: true, workspace_id: req.workspaceId, projects: data || [] });
}

export default withWorkspace(handler);
