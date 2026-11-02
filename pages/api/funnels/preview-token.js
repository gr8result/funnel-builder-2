import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { createFunnelPreviewToken } from "../../../lib/funnels/previewToken";

let databaseOverride = null;
export function setFunnelPreviewTokenDb(client) {
  databaseOverride = client;
}
const db = () => databaseOverride || supabaseAdmin;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const funnelId = String(req.body?.funnelId || "");
    if (!funnelId) return res.status(400).json({ ok: false, error: "Funnel id is required" });
    const { data: funnel, error } = await db().from("funnels")
      .select("id").eq("id", funnelId).eq("owner_user_id", req.user.id)
      .eq("workspace_id", req.workspaceId).eq("is_master_template", false).maybeSingle();
    if (error) throw error;
    if (!funnel) return res.status(404).json({ ok: false, error: "Funnel not found in this workspace" });
    return res.status(200).json({
      ok: true,
      token: createFunnelPreviewToken({ funnelId, workspaceId: req.workspaceId }),
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[funnels/preview-token]", error?.message || error);
    return res.status(status).json({ ok: false, error: status >= 500 ? "Private preview is temporarily unavailable." : error.message });
  }
}

export { handler };
export default withWorkspace(handler);
