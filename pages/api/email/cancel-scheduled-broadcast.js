import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only." });
  }
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).json({ ok: false, error: "Central contacts and consent schema is not enabled." });
  }

  const workspaceId = req.workspaceId;
  const userId = req.user.id;
  const broadcastId = String(req.body?.broadcast_id || "").trim();
  if (!broadcastId) return res.status(400).json({ ok: false, error: "broadcast_id is required." });

  const { data: cancelledCount, error } = await supabaseAdmin.rpc("cancel_email_broadcast", {
    p_workspace_id: workspaceId,
    p_broadcast_id: broadcastId,
    p_user_id: userId,
  });
  if (error) return res.status(503).json({ ok: false, error: "Atomic cancellation is unavailable until the scheduler migration is applied." });
  if (cancelledCount === -1) return res.status(404).json({ ok: false, error: "Scheduled broadcast not found." });
  if (cancelledCount === -2) return res.status(409).json({ ok: false, error: "A delivery is already in flight; it cannot be cancelled safely." });

  return res.status(200).json({ ok: true, broadcast_id: broadcastId, cancelled_deliveries: Number(cancelledCount) || 0 });
}

export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"] });
