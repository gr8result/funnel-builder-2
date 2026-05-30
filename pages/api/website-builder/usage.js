// /pages/api/website-builder/usage.js
// GET /api/website-builder/usage
// Returns the current website project count and plan limit for the authed user.

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

    // Get workspace plan
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("owner_id", auth_user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const plan = wsRow?.plan || "starter";
    const limit = getLimit(plan, "websites"); // null = unlimited

    // Count unique website projects. A project can have both a draft: row and
    // a published row — we deduplicate by stripping the draft: prefix.
    const { data: rows, error: countErr } = await supabaseAdmin
      .from("published_websites")
      .select("project_id")
      .eq("user_id", auth_user_id);

    if (countErr) {
      return res.status(500).json({ ok: false, error: countErr.message });
    }

    const uniqueIds = new Set(
      (rows || []).map((r) => String(r.project_id || "").replace(/^draft:/, ""))
    );
    const used = uniqueIds.size;
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
    console.error("[website-builder/usage]", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export default withAuth(handler);
