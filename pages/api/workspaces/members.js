// /pages/api/workspaces/members.js
// GET    — list members of a workspace (requires membership)
// POST   — invite a user to a workspace (owner/admin only)
// PATCH  — update a member's role (owner only)
// DELETE — remove a member (owner only, cannot remove self if owner)
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  const { workspaceId, user, memberRole } = req;

  try {
    // ── GET: list members ────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("workspace_members")
        .select("id, role, status, created_at, user_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Enrich with email addresses from auth
      const members = data || [];
      if (members.length > 0) {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const emailMap = new Map((authList?.users || []).map((u) => [u.id, u.email]));
        members.forEach((m) => { m.email = emailMap.get(m.user_id) || null; });
      }

      return res.status(200).json({ ok: true, members });
    }

    // ── POST: invite member ──────────────────────────────────────────────────
    if (req.method === "POST") {
      if (!["owner", "admin"].includes(memberRole)) {
        return res.status(403).json({ ok: false, error: "Requires owner or admin role" });
      }

      const { email, role = "sales" } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: "email is required" });

      const VALID_ROLES = ["owner", "admin", "sales", "marketing", "support"];
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ ok: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
      }

      // Look up the invited user by email
      const { data: users, error: userErr } = await supabaseAdmin.auth.admin.listUsers();
      if (userErr) throw userErr;

      const invitedUser = users?.users?.find((u) => u.email === email);
      if (!invitedUser) {
        return res.status(404).json({ ok: false, error: "No account found with that email address" });
      }

      // Prevent duplicate membership
      const { data: existing } = await supabaseAdmin
        .from("workspace_members")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", invitedUser.id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ ok: false, error: "User is already a member or has a pending invite" });
      }

      const { data, error } = await supabaseAdmin
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: invitedUser.id,
          role,
          status: "invited",
          invited_by: user.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      return res.status(201).json({ ok: true, member: data });
    }

    // ── PATCH: update member role ────────────────────────────────────────────
    if (req.method === "PATCH") {
      if (memberRole !== "owner") {
        return res.status(403).json({ ok: false, error: "Only the workspace owner can change roles" });
      }

      const { member_id, role } = req.body || {};
      if (!member_id || !role) {
        return res.status(400).json({ ok: false, error: "member_id and role are required" });
      }

      const { data, error } = await supabaseAdmin
        .from("workspace_members")
        .update({ role, updated_at: new Date() })
        .eq("id", member_id)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, member: data });
    }

    // ── DELETE: remove member ────────────────────────────────────────────────
    if (req.method === "DELETE") {
      if (memberRole !== "owner") {
        return res.status(403).json({ ok: false, error: "Only the workspace owner can remove members" });
      }

      const member_id = req.body?.member_id || req.query?.member_id;
      if (!member_id) return res.status(400).json({ ok: false, error: "member_id is required" });

      // Prevent removing the owner themselves
      const { data: target } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id, role")
        .eq("id", member_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (target?.user_id === user.id && target?.role === "owner") {
        return res.status(400).json({ ok: false, error: "Cannot remove yourself as owner. Transfer ownership first." });
      }

      const { error } = await supabaseAdmin
        .from("workspace_members")
        .delete()
        .eq("id", member_id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/workspaces/members]", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin", "sales", "marketing", "support"] });
