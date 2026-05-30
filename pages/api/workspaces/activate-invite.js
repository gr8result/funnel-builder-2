// POST /api/workspaces/activate-invite
// Activates all pending "invited" workspace memberships for the current user.
// Called automatically by /accept-invite page after the user logs in from
// a Supabase invite email link.
import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { user } = req;

  try {
    const { data: pending, error: findErr } = await supabaseAdmin
      .from("workspace_members")
      .select("id, role, workspace_id, workspace:workspaces(id, name, plan)")
      .eq("user_id", user.id)
      .eq("status", "invited");

    if (findErr) throw findErr;

    if (!pending || pending.length === 0) {
      return res.status(200).json({ ok: true, activated: [] });
    }

    const ids = pending.map((m) => m.id);

    const { error: updateErr } = await supabaseAdmin
      .from("workspace_members")
      .update({ status: "active" })
      .in("id", ids);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      ok: true,
      activated: pending.map((m) => ({ ...m.workspace, role: m.role })),
    });
  } catch (e) {
    console.error("[/api/workspaces/activate-invite]", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
