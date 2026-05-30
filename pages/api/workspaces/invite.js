// POST /api/workspaces/invite
// Invite a user to the workspace by email + role.
//   • Existing account → added to workspace_members immediately (status: active)
//   • New user        → Supabase sends invite email → user lands on /accept-invite
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getLimit } from "../../../lib/featureGates";

const VALID_ROLES = ["admin", "sales", "marketing", "support"];

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { workspaceId, user, memberRole } = req;

  if (!["owner", "admin"].includes(memberRole)) {
    return res.status(403).json({ ok: false, error: "Requires owner or admin role" });
  }

  const { email, role = "sales" } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail) {
    return res.status(400).json({ ok: false, error: "email is required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      ok: false,
      error: `role must be one of: ${VALID_ROLES.join(", ")}`,
    });
  }

  try {
    // ── QUOTA CHECK ──────────────────────────────────────────────────────────
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("id", workspaceId)
      .maybeSingle();

    const plan = wsRow?.plan || "starter";
    const memberLimit = getLimit(plan, "team_members");

    if (memberLimit !== null) {
      const { count: memberCount, error: countErr } = await supabaseAdmin
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "invited"]);

      if (!countErr && memberCount >= memberLimit) {
        return res.status(429).json({
          ok: false,
          code: "TEAM_MEMBER_LIMIT_EXCEEDED",
          error: `Team member limit reached (${memberLimit} on ${plan} plan). Upgrade to add more members.`,
          limit: memberLimit,
          used: memberCount,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Look up whether the user already has an account
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) throw listErr;

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    // Prevent duplicate membership
    if (existingUser) {
      const { data: existing } = await supabaseAdmin
        .from("workspace_members")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          ok: false,
          error: "User is already a member or has a pending invite",
        });
      }

      // Add immediately as active — they already have an account
      const { data: member, error: memberErr } = await supabaseAdmin
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: existingUser.id,
          role,
          status: "active",
          invited_by: user.id,
        })
        .select("*")
        .single();

      if (memberErr) throw memberErr;
      return res.status(201).json({ ok: true, member, newUser: false });
    }

    // New user — send Supabase invite email with magic link.
    // Use the request origin so the redirect works in both dev (localhost) and production.
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : null) ||
      process.env.BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
        redirectTo: `${origin}/accept-invite`,
        data: { workspace_id: workspaceId, role, invited_by: user.id },
      });

    if (inviteErr) throw inviteErr;

    const { data: member, error: memberErr } = await supabaseAdmin
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: invited.user.id,
        role,
        status: "invited",
        invited_by: user.id,
      })
      .select("*")
      .single();

    if (memberErr) throw memberErr;
    return res.status(201).json({ ok: true, member, newUser: true });
  } catch (e) {
    console.error("[/api/workspaces/invite]", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler);
