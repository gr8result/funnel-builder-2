// /lib/withAdmin.js
// Middleware for platform-admin-only API routes.
// Requires a valid Bearer JWT AND that the user's email is in PLATFORM_ADMIN_EMAILS.
//
// Usage:
//   export default withAdmin(handler)
//
// Set in .env.local:
//   PLATFORM_ADMIN_EMAILS=grant@example.com,other@example.com

import { supabaseAdmin } from "./supabaseAdmin";

function getAdminEmails() {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function withAdmin(handler) {
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

    const user = authData.user;
    const adminEmails = getAdminEmails();

    // Fail closed: if no admin emails are configured, deny all access
    if (adminEmails.length === 0) {
      return res.status(403).json({ ok: false, error: "Forbidden: PLATFORM_ADMIN_EMAILS not configured" });
    }

    if (!adminEmails.includes((user.email || "").toLowerCase())) {
      return res.status(403).json({ ok: false, error: "Forbidden: platform admin access required" });
    }

    req.user = user;
    return handler(req, res);
  };
}

export default withAdmin;
