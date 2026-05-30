// /lib/withWorkspace.js
// Centralised API middleware that enforces:
//   1. User is authenticated (valid Bearer JWT)
//   2. User is a member of the requested workspace
//   3. User has the required role (if specified)
//   4. Attaches req.user and req.workspace to downstream handlers
//
// Usage:
//   export default withWorkspace(handler)
//   export default withWorkspace(handler, { roles: ['owner', 'admin'] })
//
// The workspace_id must be provided as:
//   - req.query.workspace_id   (GET requests)
//   - req.body.workspace_id    (POST/PATCH/DELETE)
//   - req.headers['x-workspace-id'] (fallback for any method)

import { supabaseAdmin } from "./supabaseAdmin";

/**
 * @param {Function} handler  - Next.js API handler (req, res) => void
 * @param {{ roles?: string[] }} options
 */
export function withWorkspace(handler, options = {}) {
  const { roles } = options;

  return async function (req, res) {
    // ── 1. Extract Bearer token ──────────────────────────────────────────────
    const auth = String(req.headers.authorization || "").trim();
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() || "";

    if (!token) {
      return res.status(401).json({ ok: false, error: "Unauthorized: missing token" });
    }

    // ── 2. Validate token → get user ─────────────────────────────────────────
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Unauthorized: invalid token" });
    }
    const user = authData.user;

    // ── 3. Resolve workspace_id ──────────────────────────────────────────────
    const workspaceId =
      String(
        req.query?.workspace_id ||
          req.body?.workspace_id ||
          req.headers["x-workspace-id"] ||
          ""
      ).trim();

    if (!workspaceId) {
      return res.status(400).json({ ok: false, error: "workspace_id is required" });
    }

    // ── 4. Verify membership ─────────────────────────────────────────────────
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberErr) {
      console.error("[withWorkspace] membership check error:", memberErr);
      return res.status(500).json({ ok: false, error: "Server error" });
    }

    if (!member) {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: not a member of this workspace" });
    }

    // ── 5. Role check (optional) ─────────────────────────────────────────────
    if (roles && roles.length > 0 && !roles.includes(member.role)) {
      return res.status(403).json({
        ok: false,
        error: `Forbidden: requires one of [${roles.join(", ")}]`,
      });
    }

    // ── 6. Attach to request and continue ────────────────────────────────────
    req.user = user;
    req.workspaceId = workspaceId;
    req.memberRole = member.role;

    return handler(req, res);
  };
}

/**
 * Lighter version — only validates the JWT, no workspace check.
 * Use for endpoints that manage workspaces themselves (create, list).
 */
export function withAuth(handler) {
  return async function (req, res) {
    const auth = String(req.headers.authorization || "").trim();
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() || "";

    if (!token) {
      return res.status(401).json({ ok: false, error: "Unauthorized: missing token" });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Unauthorized: invalid token" });
    }

    req.user = authData.user;
    return handler(req, res);
  };
}
