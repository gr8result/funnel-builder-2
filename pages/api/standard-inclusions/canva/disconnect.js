import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaDatabaseStatus } from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const database = await canvaDatabaseStatus();
  if (!database.ready) return res.status(501).json({ ok: false, code: "CANVA_MIGRATION_REQUIRED", error: "Canva database migration has not been applied.", database });
  const { error } = await supabaseAdmin
    .from("canva_connections")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("organisation_id", req.workspaceId)
    .eq("user_id", req.user.id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

export default withWorkspace(handler);
