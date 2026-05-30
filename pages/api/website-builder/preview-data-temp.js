/**
 * TEMPORARY: Unauthenticated endpoint to serve project data for preview testing.
 * Only works in development mode. Remove after Playwright preview issue is resolved.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

const TABLE_NAME = "published_websites";

async function handler(req, res) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ ok: false });
  }

  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ ok: false, error: "Missing projectId" });

  const draftId = `draft:${projectId}`;
  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .select("site_data, updated_at")
    .eq("project_id", draftId)
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: String(error.message) });
  if (!data?.site_data) return res.status(404).json({ ok: false, error: "Project not found" });

  const project = { ...data.site_data, updatedAt: data.updated_at || data.site_data.updatedAt };
  return res.status(200).json({ ok: true, project });
}

export default withAuth(handler);
