// /pages/api/workspaces/index.js
// GET  — list workspaces the authenticated user belongs to
// POST — create a new workspace (authenticated user becomes owner)
import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  const { user } = req;

  try {
    // ── GET: list user's workspaces ──────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("workspace_members")
        .select("role, status, workspace:workspaces(id, name, slug, plan, created_at)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) throw error;

      const workspaces = (data || []).map((row) => ({
        ...row.workspace,
        role: row.role,
      }));

      return res.status(200).json({ ok: true, workspaces });
    }

    // ── POST: create a workspace ─────────────────────────────────────────────
    if (req.method === "POST") {
      const { name, slug } = req.body || {};

      if (!String(name || "").trim()) {
        return res.status(400).json({ ok: false, error: "name is required" });
      }

      // Create workspace
      const { data: ws, error: wsErr } = await supabaseAdmin
        .from("workspaces")
        .insert({
          name: String(name).trim(),
          slug: slug ? String(slug).trim() : null,
          owner_id: user.id,
          plan: "starter",
        })
        .select("*")
        .single();

      if (wsErr) throw wsErr;

      // Add creator as owner member
      const { error: memberErr } = await supabaseAdmin
        .from("workspace_members")
        .insert({
          workspace_id: ws.id,
          user_id: user.id,
          role: "owner",
          status: "active",
        });

      if (memberErr) throw memberErr;

      return res.status(201).json({ ok: true, workspace: ws });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/workspaces]", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
