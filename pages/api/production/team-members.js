// /pages/api/production/team-members.js
// Returns the list of team members (name + user_id) for the current user's
// workspace(s) so the production board can show a dropdown instead of a
// free-text "Who actioned this?" field.
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = String(req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }

  const userId = authData.user.id;

  try {
    // Workspaces this user belongs to
    const { data: memberships } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("status", "active");

    const workspaceIds = (memberships || []).map((m) => m.workspace_id);

    if (!workspaceIds.length) {
      return res.status(200).json({ ok: true, members: [] });
    }

    // All active members of those workspaces
    const { data: allMembers } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .in("workspace_id", workspaceIds)
      .eq("status", "active");

    const memberIds = [...new Set((allMembers || []).map((m) => m.user_id))];

    if (!memberIds.length) {
      return res.status(200).json({ ok: true, members: [] });
    }

    // Get full names from accounts table
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("user_id, full_name")
      .in("user_id", memberIds);

    const nameMap = new Map((accounts || []).filter((a) => a.full_name).map((a) => [a.user_id, a.full_name]));

    // Fall back to email username if no full_name in accounts
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map((authList?.users || []).map((u) => [u.id, u.email]));

    const members = memberIds
      .map((uid) => ({
        user_id: uid,
        name: nameMap.get(uid) || (emailMap.get(uid) ? emailMap.get(uid).split("@")[0] : null),
      }))
      .filter((m) => m.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ ok: true, members });
  } catch (err) {
    console.error("[production/team-members]", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed" });
  }
}
