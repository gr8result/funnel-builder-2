// /pages/api/workspaces/usage.js
// GET /api/workspaces/usage?workspace_id=<id>
// Returns the current team member count and plan limit for the workspace.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getLimit, PLANS } from "../../../lib/featureGates";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Use GET" });
  }

  try {
    const { workspaceId } = req;

    // Get workspace plan by workspace id
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("id", workspaceId)
      .maybeSingle();

    const plan = wsRow?.plan || "starter";
    const limit = getLimit(plan, "team_members"); // null = unlimited

    // Count active + invited members (both count against the limit)
    const { count, error: countErr } = await supabaseAdmin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "invited"]);

    if (countErr) {
      return res.status(500).json({ ok: false, error: countErr.message });
    }

    const used = count || 0;
    const atLimit = limit !== null && used >= limit;

    return res.status(200).json({
      ok: true,
      used,
      limit,
      atLimit,
      plan,
      planName: PLANS[plan]?.name || plan,
      remaining: limit === null ? null : Math.max(0, limit - used),
    });
  } catch (err) {
    console.error("[workspaces/usage]", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export default withWorkspace(handler);
