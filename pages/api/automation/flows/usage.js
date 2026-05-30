// /pages/api/automation/flows/usage.js
// GET /api/automation/flows/usage
// Returns the current automation count and plan limit for the authed user.
// Used by the UI to show a usage bar and disable "New Flow" when at the cap.

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../../lib/withWorkspace";
import { getLimit, PLANS } from "../../../../lib/featureGates";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Use GET" });
  }

  try {
    const auth_user_id = req.user.id;

    // accounts.id is the foreign key used in automation_flows.user_id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", auth_user_id)
      .single();

    if (accErr || !account?.id) {
      return res.status(400).json({ ok: false, error: "Account not found" });
    }

    // Get workspace plan
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("owner_id", auth_user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const plan = wsRow?.plan || "starter";
    const limit = getLimit(plan, "automations"); // null = unlimited

    // Count user's flows
    const { count, error: countErr } = await supabaseAdmin
      .from("automation_flows")
      .select("id", { count: "exact", head: true })
      .eq("user_id", account.id)
      .eq("is_standard", false);

    if (countErr) {
      return res.status(500).json({ ok: false, error: countErr.message });
    }

    const used = count || 0;
    const atLimit = limit !== null && used >= limit;

    return res.status(200).json({
      ok: true,
      used,
      limit,          // null = unlimited
      atLimit,
      plan,
      planName: PLANS[plan]?.name || plan,
      remaining: limit === null ? null : Math.max(0, limit - used),
    });
  } catch (err) {
    console.error("flows/usage error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export default withAuth(handler);
