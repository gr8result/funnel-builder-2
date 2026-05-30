// /pages/api/funnels/usage.js
// GET /api/funnels/usage
// Returns the current funnel count and plan limit for the authed user.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";
import { getLimit, PLANS } from "../../../lib/featureGates";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Use GET" });
  }

  try {
    const auth_user_id = req.user.id;

    // Get workspace plan (owner_id = auth user id)
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("owner_id", auth_user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const plan = wsRow?.plan || "starter";
    const limit = getLimit(plan, "funnels"); // null = unlimited

    // Count user's funnels
    const { count, error: countErr } = await supabaseAdmin
      .from("funnels")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", auth_user_id);

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
    console.error("[funnels/usage]", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export default withAuth(handler);
